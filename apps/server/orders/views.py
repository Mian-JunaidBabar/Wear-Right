from rest_framework import status
from rest_framework.permissions import SAFE_METHODS, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsStaff
from .selectors import get_booking, get_bookings, get_dashboard_stats, get_order, get_orders
from .serializers import (
    BookingSerializer, CartSerializer, CheckoutSerializer, OrderItemSerializer, OrderSerializer,
)
from .services import (
    add_cart_item, cancel_order, cart_summary, change_order_status, checkout, create_booking, create_order,
    delete_booking, delete_order, get_cart, merge_cart, remove_cart_item, update_booking, update_cart_item, update_order,
)


class AdminDashboardAPIView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        stats = get_dashboard_stats()
        return Response({"status": "success", "dashboard": stats}, status=status.HTTP_200_OK)


class OrderListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        orders = get_orders(request.user)
        serializer = OrderSerializer(orders, many=True, context={'request': request})
        return Response({"status": "success", "total_orders": orders.count(), "orders": serializer.data}, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = OrderSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            order, error = create_order(serializer, request.user)
            if error:
                return Response({"status": "error", "message": error}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"status": "success", "message": "Order created successfully", "order": OrderSerializer(order, context={'request': request}).data}, status=status.HTTP_201_CREATED)
        return Response({"status": "error", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


class OrderDetailAPIView(APIView):
    def get_permissions(self):
        # Reading is scoped to the owner; changing or deleting is staff-only.
        return [IsAuthenticated()] if self.request.method in SAFE_METHODS else [IsStaff()]

    def get(self, request, order_id):
        order = get_order(order_id, request.user)
        if order is None:
            return Response({"status": "error", "message": "Order not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = OrderSerializer(order, context={'request': request})
        return Response({"status": "success", "order": serializer.data}, status=status.HTTP_200_OK)

    def put(self, request, order_id):
        order = get_order(order_id, request.user)
        if order is None:
            return Response({"status": "error", "message": "Order not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = OrderSerializer(order, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            updated_order = update_order(serializer)
            return Response({"status": "success", "message": "Order updated successfully", "order": OrderSerializer(updated_order, context={'request': request}).data}, status=status.HTTP_200_OK)
        return Response({"status": "error", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, order_id):
        order = get_order(order_id, request.user)
        if order is None:
            return Response({"status": "error", "message": "Order not found"}, status=status.HTTP_404_NOT_FOUND)
        delete_order(order)
        return Response({"status": "success", "message": "Order deleted successfully"}, status=status.HTTP_200_OK)


class OrderCancelAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        order = get_order(order_id, request.user)
        if order is None:
            return Response({"status": "error", "message": "Order not found"}, status=status.HTTP_404_NOT_FOUND)
        order, error = cancel_order(order, request.user)
        if error:
            return Response({"status": "error", "message": error}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"status": "success", "message": "Order cancelled", "order": OrderSerializer(order, context={'request': request}).data})


class OrderStatusAPIView(APIView):
    permission_classes = [IsStaff]

    def patch(self, request, order_id):
        order = get_order(order_id, request.user)
        if order is None:
            return Response({"status": "error", "message": "Order not found"}, status=status.HTTP_404_NOT_FOUND)
        order, error = change_order_status(order, request.data.get('order_status'))
        if error:
            return Response({"status": "error", "message": error}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"status": "success", "order": OrderSerializer(order, context={'request': request}).data})


class CartAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart = get_cart(request.user)
        return Response({"status": "success", **self._body(cart)}, status=status.HTTP_200_OK)

    def post(self, request):
        item, error = add_cart_item(
            request.user,
            product_id=request.data.get('product') or request.data.get('product_id'),
            size=request.data.get('size') or 'M',
            quantity=request.data.get('quantity') or 1,
        )
        if error:
            return Response({"status": "error", "message": error}, status=status.HTTP_400_BAD_REQUEST)
        cart = get_cart(request.user)
        return Response({"status": "success", "item_id": item.id, **self._body(cart)}, status=status.HTTP_201_CREATED)

    def delete(self, request):
        cart = get_cart(request.user)
        cart.items.all().delete()
        return Response({"status": "success", **self._body(cart)}, status=status.HTTP_200_OK)

    @staticmethod
    def _body(cart):
        summary = cart_summary(cart)
        data = CartSerializer(cart).data
        return {"cart": data, "items": data["items"], "subtotal": summary["subtotal"], "count": summary["count"]}


class CartItemAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, item_id):
        item, error = update_cart_item(
            request.user, item_id, quantity=request.data.get('quantity'), size=request.data.get('size'),
        )
        if error:
            return Response({"status": "error", "message": error}, status=status.HTTP_400_BAD_REQUEST)
        cart = get_cart(request.user)
        return Response({"status": "success", **CartAPIView._body(cart)}, status=status.HTTP_200_OK)

    def delete(self, request, item_id):
        if not remove_cart_item(request.user, item_id):
            return Response({"status": "error", "message": "Cart item not found"}, status=status.HTTP_404_NOT_FOUND)
        cart = get_cart(request.user)
        return Response({"status": "success", **CartAPIView._body(cart)}, status=status.HTTP_200_OK)


class CartMergeAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        rows = request.data.get('items', request.data if isinstance(request.data, list) else [])
        merged, skipped = merge_cart(request.user, rows)
        cart = get_cart(request.user)
        return Response({"status": "success", "merged": merged, "skipped": skipped, **CartAPIView._body(cart)})


class CheckoutAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"status": "error", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        order, error = checkout(request.user, serializer.validated_data)
        if error:
            return Response({"status": "error", "message": error}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            "status": "success", "message": "Order placed successfully",
            "order": OrderSerializer(order, context={'request': request}).data,
        }, status=status.HTTP_201_CREATED)


class BookingListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        bookings = get_bookings(request.user)
        serializer = BookingSerializer(bookings, many=True, context={'request': request})
        return Response({"status": "success", "total_bookings": bookings.count(), "bookings": serializer.data}, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = BookingSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            create_booking(serializer, request.user)
            return Response({"status": "success", "message": "Booking created successfully", "booking": serializer.data}, status=status.HTTP_201_CREATED)
        return Response({"status": "error", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


class BookingDetailAPIView(APIView):
    def get_permissions(self):
        return [IsAuthenticated()] if self.request.method in SAFE_METHODS else [IsStaff()]

    def get(self, request, booking_id):
        booking = get_booking(booking_id, request.user)
        if booking is None:
            return Response({"status": "error", "message": "Booking not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = BookingSerializer(booking, context={'request': request})
        return Response({"status": "success", "booking": serializer.data}, status=status.HTTP_200_OK)

    def put(self, request, booking_id):
        booking = get_booking(booking_id, request.user)
        if booking is None:
            return Response({"status": "error", "message": "Booking not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = BookingSerializer(booking, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            updated_booking = update_booking(serializer)
            return Response({"status": "success", "message": "Booking updated successfully", "booking": BookingSerializer(updated_booking).data}, status=status.HTTP_200_OK)
        return Response({"status": "error", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, booking_id):
        booking = get_booking(booking_id, request.user)
        if booking is None:
            return Response({"status": "error", "message": "Booking not found"}, status=status.HTTP_404_NOT_FOUND)
        delete_booking(booking)
        return Response({"status": "success", "message": "Booking deleted successfully"}, status=status.HTTP_200_OK)
