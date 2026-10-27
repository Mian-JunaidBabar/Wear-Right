"""Everything the admin panel calls lives under /api/admin/ (the admin cookies are scoped to that path)."""
from django.urls import path

from . import views

urlpatterns = [
    path('auth/login/', views.AdminLoginView.as_view(), name='api-admin-login'),
    path('auth/logout/', views.AdminLogoutView.as_view(), name='api-admin-logout'),
    path('auth/refresh/', views.AdminRefreshView.as_view(), name='api-admin-refresh'),
    path('auth/me/', views.AdminMeView.as_view(), name='api-admin-me'),
    path('auth/password/', views.AdminPasswordView.as_view(), name='api-admin-password'),

    path('dashboard/', views.AdminDashboardAPIView.as_view(), name='api-admin-dashboard'),

    path('roles/', views.RoleListCreateAPIView.as_view(), name='api-admin-roles'),
    path('roles/<int:role_id>/', views.RoleDetailAPIView.as_view(), name='api-admin-role-detail'),
    path('members/', views.MemberListCreateAPIView.as_view(), name='api-admin-members'),
    path('members/<int:member_id>/', views.MemberDetailAPIView.as_view(), name='api-admin-member-detail'),

    path('products/', views.AdminProductList.as_view(), name='api-admin-products'),
    path('products/color-suggestion/', views.AdminColourSuggestion.as_view(), name='api-admin-colour-suggestion'),
    path('products/<int:product_id>/', views.AdminProductDetail.as_view(), name='api-admin-product-detail'),
    path('categories/', views.AdminCategoryList.as_view(), name='api-admin-categories'),
    path('categories/<int:row_id>/', views.AdminCategoryDetail.as_view(), name='api-admin-category-detail'),
    path('styles/', views.AdminStyleList.as_view(), name='api-admin-styles'),
    path('styles/<int:row_id>/', views.AdminStyleDetail.as_view(), name='api-admin-style-detail'),
    path('colors/', views.AdminColourList.as_view(), name='api-admin-colors'),
    path('colors/<int:row_id>/', views.AdminColourDetail.as_view(), name='api-admin-color-detail'),
    path('tone-rules/', views.AdminToneRuleList.as_view(), name='api-admin-tone-rules'),
    path('tone-rules/<int:rule_id>/', views.AdminToneRuleDetail.as_view(), name='api-admin-tone-rule-detail'),

    path('orders/', views.AdminOrderList.as_view(), name='api-admin-orders'),
    path('orders/<int:order_id>/', views.AdminOrderDetail.as_view(), name='api-admin-order-detail'),
    path('orders/<int:order_id>/status/', views.AdminOrderStatus.as_view(), name='api-admin-order-status'),
    path('bookings/', views.AdminBookingList.as_view(), name='api-admin-bookings'),
    path('bookings/<int:booking_id>/', views.AdminBookingDetail.as_view(), name='api-admin-booking-detail'),
    path('face-scans/', views.AdminFaceScanList.as_view(), name='api-admin-face-scans'),
]
