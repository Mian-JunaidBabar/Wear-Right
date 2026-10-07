from rest_framework.views import APIView
from rest_framework.permissions import SAFE_METHODS, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .selectors import get_orders, get_order, get_bookings, get_booking, get_dashboard_stats
from .services import create_order, update_order, delete_order, create_booking, update_booking, delete_booking
from .serializers import OrderSerializer, BookingSerializer
from core.permissions import IsStaff

class AdminDashboardAPIView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        stats = get_dashboard_stats()
        return Response({
            "status": "success",
            "dashboard": stats
        }, status=status.HTTP_200_OK)

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
        # Reading is scoped to the owner; changing or deleting is staff-only.
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
            return Response({"status": "success", "message": "Booking updated successfully", "booking": serializer.data}, status=status.HTTP_200_OK)
        return Response({"status": "error", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, booking_id):
        booking = get_booking(booking_id, request.user)
        if booking is None:
            return Response({"status": "error", "message": "Booking not found"}, status=status.HTTP_404_NOT_FOUND)
        delete_booking(booking)
        return Response({"status": "success", "message": "Booking deleted successfully"}, status=status.HTTP_200_OK)
