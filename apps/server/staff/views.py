from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.serializers import AdminPasswordResetConfirmSerializer, AdminPasswordResetRequestSerializer

from catalog.views import (
    CategoryDetailAPIView, CategoryListCreateAPIView, ColourDetailAPIView, ColourListCreateAPIView,
    ProductColourSuggestionAPIView, ProductDetailAPIView, ProductListCreateAPIView, StyleDetailAPIView,
    StyleListCreateAPIView,
)
from core.csrf import ensure_csrf_cookie
from orders.selectors import get_dashboard_stats, get_order
from orders.services import cancel_order, delete_order
from orders.views import BookingDetailAPIView, BookingListCreateAPIView, OrderDetailAPIView, OrderListCreateAPIView, OrderStatusAPIView
from recommender.views import ToneRuleDetailAPIView, ToneRuleListCreateAPIView
from scanner.views import FaceScanRecordListAPIView

from .authentication import ADMIN_SCOPE, AdminJWTCookieAuthentication
from .cookies import ADMIN_REFRESH_COOKIE, clear_admin_cookies, set_admin_cookies
from .permissions import HasAdminPermission, IsAdminMember
from .selectors import get_member_by_id, get_members, get_role_by_id, get_roles, is_admin_account
from .serializers import (
    AdminLoginSerializer, MemberCreateSerializer, MemberSerializer, MemberUpdateSerializer, OwnAccountSerializer,
    PasswordChangeSerializer, RoleSerializer, admin_session_payload, permission_catalog,
)
from .services import (
    authenticate_admin, change_password, create_member, create_role, delete_member, delete_role,
    issue_admin_tokens, update_member, update_own_name, update_role,
)


def _error(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({"status": "error", "message": message}, status=code)


class AdminAPIMixin:
    """Every admin endpoint: admin cookie only, then the RBAC permission for the HTTP method."""
    authentication_classes = [AdminJWTCookieAuthentication]
    admin_permissions = {}

    def get_permissions(self):
        return [HasAdminPermission()]


# ---- the admin's own session --------------------------------------------------------------------------------
class AdminLoginView(APIView):
    """POST /api/admin/auth/login/ : team members only. Sets the wr-admin-* cookies."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = AdminLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate_admin(identifier=serializer.validated_data['email'], password=serializer.validated_data['password'])
        if user is None:
            raise ValidationError('Incorrect email or password, or this account has no admin access.')
        access, refresh = issue_admin_tokens(user)
        response = Response(admin_session_payload(user))
        set_admin_cookies(response, access=access, refresh=refresh)
        ensure_csrf_cookie(request)
        return response


class AdminRefreshView(APIView):
    """POST /api/admin/auth/refresh/ : rotates the admin cookies."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        raw = request.COOKIES.get(ADMIN_REFRESH_COOKIE)
        if not raw:
            return self._expired()
        try:
            token = RefreshToken(raw)
        except TokenError:
            return self._expired()
        user = User.objects.filter(**{jwt_settings.USER_ID_FIELD: token.get(jwt_settings.USER_ID_CLAIM)}).first()
        if token.get('scope') != ADMIN_SCOPE or not is_admin_account(user):
            return self._expired()
        serializer = TokenRefreshSerializer(data={'refresh': raw})
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            return self._expired()
        data = serializer.validated_data
        response = Response({'detail': 'Token refreshed.'})
        set_admin_cookies(response, access=data['access'], refresh=data.get('refresh', raw))
        ensure_csrf_cookie(request)
        return response

    @staticmethod
    def _expired():
        response = Response({'error': {'code': 'NotAuthenticated', 'message': 'Admin session expired.', 'details': {}}},
                            status=status.HTTP_401_UNAUTHORIZED)
        clear_admin_cookies(response)
        return response


class AdminLogoutView(APIView):
    """POST /api/admin/auth/logout/ : blacklists the refresh token and clears the admin cookies."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        raw = request.COOKIES.get(ADMIN_REFRESH_COOKIE)
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except Exception:
                pass
        response = Response({'detail': 'Signed out.'})
        clear_admin_cookies(response)
        return response


class AdminMeView(APIView):
    """GET/PATCH /api/admin/auth/me/ : the signed-in admin, their role and permissions."""
    authentication_classes = [AdminJWTCookieAuthentication]
    permission_classes = [IsAdminMember]

    def get(self, request):
        ensure_csrf_cookie(request)
        return Response(admin_session_payload(request.user))

    def patch(self, request):
        serializer = OwnAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        update_own_name(request.user, serializer.validated_data['name'])
        return Response(admin_session_payload(request.user))


class AdminPasswordView(APIView):
    """POST /api/admin/auth/password/ : change the signed-in admin's password."""
    authentication_classes = [AdminJWTCookieAuthentication]
    permission_classes = [IsAdminMember]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        error = change_password(request.user, **serializer.validated_data)
        if error:
            return _error(error)
        return Response({'status': 'success', 'message': 'Password changed.'})


class AdminPasswordResetRequestView(APIView):
    """POST /api/admin/auth/password/reset/ : same answer for every address, email only to team accounts."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'
    serializer_class = AdminPasswordResetRequestSerializer
    detail = 'If an account exists for this email, we sent a reset link.'

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': self.detail}, status=status.HTTP_200_OK)


class AdminPasswordResetConfirmView(APIView):
    """POST /api/admin/auth/password/reset/confirm/ : set the password and sign out this panel."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'
    serializer_class = AdminPasswordResetConfirmSerializer
    detail = 'Password has been reset. You can sign in now.'

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        response = Response({'detail': self.detail}, status=status.HTTP_200_OK)
        clear_admin_cookies(response)
        return response


# ---- dashboard ------------------------------------------------------------------------------------------
class AdminDashboardAPIView(AdminAPIMixin, APIView):
    admin_permissions = {'GET': 'dashboard.view'}

    def get(self, request):
        return Response({"status": "success", "dashboard": get_dashboard_stats()}, status=status.HTTP_200_OK)


# ---- team (RBAC) ------------------------------------------------------------------------------------------
class RoleListCreateAPIView(AdminAPIMixin, APIView):
    admin_permissions = {'GET': 'team.manage', 'POST': 'team.manage'}

    def get(self, request):
        roles = get_roles()
        return Response({"status": "success", "roles": RoleSerializer(roles, many=True).data,
                         "permissions": permission_catalog()})

    def post(self, request):
        serializer = RoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role, error = create_role(**serializer.validated_data)
        if error:
            return _error(error)
        return Response({"status": "success", "role": RoleSerializer(get_role_by_id(role.id)).data}, status=status.HTTP_201_CREATED)


class RoleDetailAPIView(AdminAPIMixin, APIView):
    admin_permissions = {'GET': 'team.manage', 'PATCH': 'team.manage', 'PUT': 'team.manage', 'DELETE': 'team.manage'}

    def _role(self, role_id):
        return get_role_by_id(role_id)

    def get(self, request, role_id):
        role = self._role(role_id)
        if role is None:
            return _error("Role not found", status.HTTP_404_NOT_FOUND)
        return Response({"status": "success", "role": RoleSerializer(role).data})

    def patch(self, request, role_id):
        role = self._role(role_id)
        if role is None:
            return _error("Role not found", status.HTTP_404_NOT_FOUND)
        serializer = RoleSerializer(role, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        role, error = update_role(role, **serializer.validated_data)
        if error:
            return _error(error)
        return Response({"status": "success", "role": RoleSerializer(get_role_by_id(role.id)).data})

    put = patch

    def delete(self, request, role_id):
        role = self._role(role_id)
        if role is None:
            return _error("Role not found", status.HTTP_404_NOT_FOUND)
        error = delete_role(role)
        if error:
            return _error(error)
        return Response({"status": "success", "message": "Role deleted"})


class MemberListCreateAPIView(AdminAPIMixin, APIView):
    admin_permissions = {'GET': 'team.manage', 'POST': 'team.manage'}

    def get(self, request):
        members = get_members()
        data = MemberSerializer(members, many=True).data
        for row in data:
            row['is_self'] = row['id'] == getattr(getattr(request.user, 'admin_member', None), 'id', None)
        return Response({"status": "success", "members": data})

    def post(self, request):
        serializer = MemberCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member, error = create_member(**serializer.validated_data)
        if error:
            return _error(error)
        return Response({"status": "success", "member": MemberSerializer(member).data}, status=status.HTTP_201_CREATED)


class MemberDetailAPIView(AdminAPIMixin, APIView):
    admin_permissions = {'GET': 'team.manage', 'PATCH': 'team.manage', 'PUT': 'team.manage', 'DELETE': 'team.manage'}

    def get(self, request, member_id):
        member = get_member_by_id(member_id)
        if member is None:
            return _error("Team member not found", status.HTTP_404_NOT_FOUND)
        return Response({"status": "success", "member": MemberSerializer(member).data})

    def patch(self, request, member_id):
        member = get_member_by_id(member_id)
        if member is None:
            return _error("Team member not found", status.HTTP_404_NOT_FOUND)
        serializer = MemberUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member, error = update_member(request.user, member, **serializer.validated_data)
        if error:
            return _error(error)
        return Response({"status": "success", "member": MemberSerializer(member).data})

    put = patch

    def delete(self, request, member_id):
        member = get_member_by_id(member_id)
        if member is None:
            return _error("Team member not found", status.HTTP_404_NOT_FOUND)
        error = delete_member(request.user, member)
        if error:
            return _error(error)
        return Response({"status": "success", "message": "Team member removed"})


# ---- shop data, behind admin auth + RBAC. Same handlers as the shop API, different gate. ---------------------
VIEW_MANAGE = {'GET': '{0}.view', 'POST': '{0}.manage', 'PUT': '{0}.manage', 'PATCH': '{0}.manage', 'DELETE': '{0}.manage'}


def _perms(area, write=None):
    perms = {method: key.format(area) for method, key in VIEW_MANAGE.items()}
    if write:
        perms.update({method: write for method in ('POST', 'PUT', 'PATCH', 'DELETE')})
    return perms


class AdminProductList(AdminAPIMixin, ProductListCreateAPIView):
    admin_permissions = _perms('products')


class AdminProductDetail(AdminAPIMixin, ProductDetailAPIView):
    admin_permissions = _perms('products')


class AdminColourSuggestion(AdminAPIMixin, ProductColourSuggestionAPIView):
    admin_permissions = {'POST': 'products.manage'}


class AdminCategoryList(AdminAPIMixin, CategoryListCreateAPIView):
    admin_permissions = _perms('products', write='catalog.manage')


class AdminCategoryDetail(AdminAPIMixin, CategoryDetailAPIView):
    admin_permissions = _perms('products', write='catalog.manage')


class AdminStyleList(AdminAPIMixin, StyleListCreateAPIView):
    admin_permissions = _perms('products', write='catalog.manage')


class AdminStyleDetail(AdminAPIMixin, StyleDetailAPIView):
    admin_permissions = _perms('products', write='catalog.manage')


class AdminColourList(AdminAPIMixin, ColourListCreateAPIView):
    admin_permissions = _perms('products', write='catalog.manage')


class AdminColourDetail(AdminAPIMixin, ColourDetailAPIView):
    admin_permissions = _perms('products', write='catalog.manage')


class AdminToneRuleList(AdminAPIMixin, ToneRuleListCreateAPIView):
    admin_permissions = _perms('products', write='catalog.manage')


class AdminToneRuleDetail(AdminAPIMixin, ToneRuleDetailAPIView):
    admin_permissions = _perms('products', write='catalog.manage')


class AdminOrderList(AdminAPIMixin, OrderListCreateAPIView):
    admin_permissions = {'GET': 'orders.view'}


class AdminOrderDetail(AdminAPIMixin, OrderDetailAPIView):
    admin_permissions = {'GET': 'orders.view', 'DELETE': 'orders.manage'}

    def delete(self, request, order_id):
        order = get_order(order_id, request.user)
        if order is None:
            return _error("Order not found", status.HTTP_404_NOT_FOUND)
        if order.order_status in ('Pending', 'Confirmed'):
            # Deleting an open order would lose its stock; cancel first so the items go back on the shelf.
            cancel_order(order, request.user)
        delete_order(order)
        return Response({"status": "success", "message": "Order deleted successfully"})


class AdminOrderStatus(AdminAPIMixin, OrderStatusAPIView):
    admin_permissions = {'PATCH': 'orders.manage'}


class AdminBookingList(AdminAPIMixin, BookingListCreateAPIView):
    admin_permissions = {'GET': 'bookings.view'}


class AdminBookingDetail(AdminAPIMixin, BookingDetailAPIView):
    admin_permissions = _perms('bookings')


class AdminFaceScanList(AdminAPIMixin, FaceScanRecordListAPIView):
    admin_permissions = {'GET': 'scans.view'}
