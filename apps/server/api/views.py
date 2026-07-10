from django.db.models import Sum
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Product, UserProfile, Order, Booking, FaceScanRecord
from .serializers import (
    ProductSerializer,
    UserProfileSerializer,
    OrderSerializer,
    BookingSerializer,
    FaceScanRecordSerializer,
)
from .utils import classify_skin_tone


class AdminDashboardAPIView(APIView):
    def get(self, request):
        today = timezone.now()
        month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        products = Product.objects.all()
        orders = Order.objects.all()
        bookings = Booking.objects.all()
        face_scans = FaceScanRecord.objects.all()

        monthly_orders = orders.filter(order_date__gte=month_start)

        monthly_revenue = monthly_orders.aggregate(
            total=Sum('total_amount')
        )['total'] or 0

        monthly_profit = monthly_orders.aggregate(
            total=Sum('profit_amount')
        )['total'] or 0

        low_stock_products = products.filter(stock_quantity__lte=5).count()

        style_counts = {
            "Eastern": products.filter(cultural_tag="Eastern").count(),
            "Western": products.filter(cultural_tag="Western").count(),
            "Formal": products.filter(cultural_tag="Formal").count(),
            "Casual": products.filter(cultural_tag="Casual").count(),
        }

        skin_tone_counts = {
            "Fair": products.filter(compatible_skin_tone="Fair").count(),
            "Medium": products.filter(compatible_skin_tone="Medium").count(),
            "Dark": products.filter(compatible_skin_tone="Dark").count(),
        }

        order_status_counts = {
            "Pending": orders.filter(order_status="Pending").count(),
            "Confirmed": orders.filter(order_status="Confirmed").count(),
            "Shipped": orders.filter(order_status="Shipped").count(),
            "Delivered": orders.filter(order_status="Delivered").count(),
            "Cancelled": orders.filter(order_status="Cancelled").count(),
        }

        booking_status_counts = {
            "Pending": bookings.filter(status="Pending").count(),
            "Confirmed": bookings.filter(status="Confirmed").count(),
            "Completed": bookings.filter(status="Completed").count(),
            "Cancelled": bookings.filter(status="Cancelled").count(),
        }

        return Response({
            "status": "success",
            "dashboard": {
                "total_products": products.count(),
                "total_orders": orders.count(),
                "total_bookings": bookings.count(),
                "total_face_scans": face_scans.count(),
                "monthly_revenue": monthly_revenue,
                "monthly_profit": monthly_profit,
                "low_stock_products": low_stock_products,
                "style_counts": style_counts,
                "skin_tone_counts": skin_tone_counts,
                "order_status_counts": order_status_counts,
                "booking_status_counts": booking_status_counts,
            }
        }, status=status.HTTP_200_OK)


class ProductListCreateAPIView(APIView):
    def get(self, request):
        products = Product.objects.all().order_by('-id')
        serializer = ProductSerializer(
            products,
            many=True,
            context={'request': request}
        )

        return Response({
            "status": "success",
            "total_products": products.count(),
            "products": serializer.data
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = ProductSerializer(
            data=request.data,
            context={'request': request}
        )

        if serializer.is_valid():
            serializer.save()

            return Response({
                "status": "success",
                "message": "Product created successfully",
                "product": serializer.data
            }, status=status.HTTP_201_CREATED)

        return Response({
            "status": "error",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class ProductDetailAPIView(APIView):
    def get_object(self, product_id):
        try:
            return Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return None

    def get(self, request, product_id):
        product = self.get_object(product_id)

        if product is None:
            return Response({
                "status": "error",
                "message": "Product not found"
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = ProductSerializer(
            product,
            context={'request': request}
        )

        return Response({
            "status": "success",
            "product": serializer.data
        }, status=status.HTTP_200_OK)

    def put(self, request, product_id):
        product = self.get_object(product_id)

        if product is None:
            return Response({
                "status": "error",
                "message": "Product not found"
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = ProductSerializer(
            product,
            data=request.data,
            partial=True,
            context={'request': request}
        )

        if serializer.is_valid():
            serializer.save()

            return Response({
                "status": "success",
                "message": "Product updated successfully",
                "product": serializer.data
            }, status=status.HTTP_200_OK)

        return Response({
            "status": "error",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, product_id):
        product = self.get_object(product_id)

        if product is None:
            return Response({
                "status": "error",
                "message": "Product not found"
            }, status=status.HTTP_404_NOT_FOUND)

        product.delete()

        return Response({
            "status": "success",
            "message": "Product deleted successfully"
        }, status=status.HTTP_200_OK)


class FaceScannerAPIView(APIView):
    def post(self, request, *args, **kwargs):
        uploaded_images = request.FILES.getlist('images')

        if not uploaded_images and 'image' in request.FILES:
            uploaded_images = [request.FILES['image']]

        if not uploaded_images:
            return Response(
                {"error": "No image frame provided"},
                status=status.HTTP_400_BAD_REQUEST
            )

        analysis_results = []

        for uploaded_image in uploaded_images:
            result = classify_skin_tone(uploaded_image)
            analysis_results.append(result)

        reliable_results = [
            result for result in analysis_results
            if result.get("tone") not in ["Rescan Required", "Unknown"]
            and result.get("confidence", 0) > 0
        ]

        if not reliable_results:
            best_failed_result = analysis_results[0]

            FaceScanRecord.objects.create(
                visitor_name="Guest User",
                detected_skin_tone="Rescan Required",
                confidence_score=0,
                lighting_quality=best_failed_result.get("lighting_quality", "Unknown"),
                brightness=best_failed_result.get("brightness", 0),
            )

            return Response({
                "status": "failed",
                "detected_skin_tone": "Rescan Required",
                "confidence_score": 0,
                "lighting_quality": best_failed_result.get("lighting_quality", "Unknown"),
                "brightness": best_failed_result.get("brightness", 0),
                "message": (
                    "All captured frames had unsuitable lighting. "
                    "Please scan again in better light and keep your face centered."
                ),
                "all_frame_results": analysis_results
            }, status=status.HTTP_200_OK)

        def result_score(result):
            confidence = result.get("confidence", 0)
            lighting = result.get("lighting_quality", "")

            lighting_bonus = {
                "Good": 20,
                "Normal": 12,
                "Low": 2
            }.get(lighting, 0)

            return confidence + lighting_bonus

        best_result = max(reliable_results, key=result_score)

        FaceScanRecord.objects.create(
            visitor_name="Guest User",
            detected_skin_tone=best_result["tone"],
            confidence_score=best_result["confidence"],
            lighting_quality=best_result["lighting_quality"],
            brightness=best_result["brightness"],
        )

        return Response({
            "status": "success",
            "detected_skin_tone": best_result["tone"],
            "confidence_score": best_result["confidence"],
            "lighting_quality": best_result["lighting_quality"],
            "brightness": best_result["brightness"],
            "message": best_result["message"],
            "selected_frame_debug": best_result.get("debug", {}),
            "total_frames_analyzed": len(analysis_results),
            "all_frame_results": analysis_results
        }, status=status.HTTP_200_OK)


class CuratedRecommendationAPIView(APIView):
    def get(self, request):
        target_tone = request.query_params.get('tone', 'Medium')
        target_culture = request.query_params.get('style', 'Western')

        filtered_products = Product.objects.filter(
            compatible_skin_tone=target_tone,
            cultural_tag=target_culture,
            status='Active'
        )[:15]

        serializer = ProductSerializer(
            filtered_products,
            many=True,
            context={'request': request}
        )

        return Response({
            "status": "success",
            "target_tone": target_tone,
            "target_style": target_culture,
            "total_items": len(serializer.data),
            "curated_items": serializer.data
        }, status=status.HTTP_200_OK)


class UserProfileAPIView(APIView):
    def get(self, request):
        profiles = UserProfile.objects.all()
        serializer = UserProfileSerializer(profiles, many=True)

        return Response({
            "status": "success",
            "profiles": serializer.data
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = UserProfileSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save()

            return Response({
                "status": "success",
                "message": "User profile saved successfully",
                "profile": serializer.data
            }, status=status.HTTP_201_CREATED)

        return Response({
            "status": "error",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class OutfitGenerationAPIView(APIView):
    def get(self, request):
        product_id = request.query_params.get('product_id')

        if not product_id:
            return Response({
                "status": "error",
                "message": "product_id is required"
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            main_product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({
                "status": "error",
                "message": "Main product not found"
            }, status=status.HTTP_404_NOT_FOUND)

        matching_products = Product.objects.filter(
            compatible_skin_tone=main_product.compatible_skin_tone,
            cultural_tag=main_product.cultural_tag,
            status='Active'
        ).exclude(id=main_product.id)

        shirt = matching_products.filter(category__icontains='shirt').first()
        pant = matching_products.filter(category__icontains='pant').first()
        shoes = matching_products.filter(category__icontains='shoe').first() \
            or matching_products.filter(category__icontains='sandal').first() \
            or matching_products.filter(category__icontains='chappal').first()

        accessory = matching_products.filter(category__icontains='accessory').first() \
            or matching_products.filter(category__icontains='watch').first() \
            or matching_products.filter(category__icontains='cap').first() \
            or matching_products.filter(category__icontains='tie').first()

        coat_or_jacket = matching_products.filter(category__icontains='coat').first() \
            or matching_products.filter(category__icontains='jacket').first() \
            or matching_products.filter(category__icontains='waistcoat').first()

        return Response({
            "status": "success",
            "message": "Smart outfit generated successfully",
            "main_item": ProductSerializer(main_product, context={'request': request}).data,
            "outfit": {
                "shirt": ProductSerializer(shirt, context={'request': request}).data if shirt else None,
                "pant": ProductSerializer(pant, context={'request': request}).data if pant else None,
                "shoes": ProductSerializer(shoes, context={'request': request}).data if shoes else None,
                "accessory": ProductSerializer(accessory, context={'request': request}).data if accessory else None,
                "coat_or_jacket": ProductSerializer(coat_or_jacket, context={'request': request}).data if coat_or_jacket else None,
            }
        }, status=status.HTTP_200_OK)


class OrderListCreateAPIView(APIView):
    def get(self, request):
        orders = Order.objects.all().order_by('-order_date')
        serializer = OrderSerializer(
            orders,
            many=True,
            context={'request': request}
        )

        return Response({
            "status": "success",
            "total_orders": orders.count(),
            "orders": serializer.data
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = OrderSerializer(
            data=request.data,
            context={'request': request}
        )

        if serializer.is_valid():
            product = serializer.validated_data.get('product')
            quantity = serializer.validated_data.get('quantity', 1)

            if quantity <= 0:
                return Response({
                    "status": "error",
                    "message": "Quantity must be greater than 0"
                }, status=status.HTTP_400_BAD_REQUEST)

            if product.status != 'Active':
                return Response({
                    "status": "error",
                    "message": "This product is not available for order"
                }, status=status.HTTP_400_BAD_REQUEST)

            if product.stock_quantity < quantity:
                return Response({
                    "status": "error",
                    "message": f"Only {product.stock_quantity} item(s) available in stock"
                }, status=status.HTTP_400_BAD_REQUEST)

            order = serializer.save()

            product.stock_quantity -= quantity

            if product.stock_quantity == 0:
                product.status = 'Out of Stock'

            product.save()

            return Response({
                "status": "success",
                "message": "Order created successfully",
                "order": OrderSerializer(order, context={'request': request}).data
            }, status=status.HTTP_201_CREATED)

        return Response({
            "status": "error",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

class OrderDetailAPIView(APIView):
    def get_object(self, order_id):
        try:
            return Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            return None

    def get(self, request, order_id):
        order = self.get_object(order_id)

        if order is None:
            return Response({
                "status": "error",
                "message": "Order not found"
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = OrderSerializer(order, context={'request': request})

        return Response({
            "status": "success",
            "order": serializer.data
        }, status=status.HTTP_200_OK)

    def put(self, request, order_id):
        order = self.get_object(order_id)

        if order is None:
            return Response({
                "status": "error",
                "message": "Order not found"
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = OrderSerializer(
            order,
            data=request.data,
            partial=True,
            context={'request': request}
        )

        if serializer.is_valid():
            serializer.save()

            return Response({
                "status": "success",
                "message": "Order updated successfully",
                "order": serializer.data
            }, status=status.HTTP_200_OK)

        return Response({
            "status": "error",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, order_id):
        order = self.get_object(order_id)

        if order is None:
            return Response({
                "status": "error",
                "message": "Order not found"
            }, status=status.HTTP_404_NOT_FOUND)

        order.delete()

        return Response({
            "status": "success",
            "message": "Order deleted successfully"
        }, status=status.HTTP_200_OK)


class BookingListCreateAPIView(APIView):
    def get(self, request):
        bookings = Booking.objects.all().order_by('-created_at')
        serializer = BookingSerializer(
            bookings,
            many=True,
            context={'request': request}
        )

        return Response({
            "status": "success",
            "total_bookings": bookings.count(),
            "bookings": serializer.data
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = BookingSerializer(
            data=request.data,
            context={'request': request}
        )

        if serializer.is_valid():
            serializer.save()

            return Response({
                "status": "success",
                "message": "Booking created successfully",
                "booking": serializer.data
            }, status=status.HTTP_201_CREATED)

        return Response({
            "status": "error",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class BookingDetailAPIView(APIView):
    def get_object(self, booking_id):
        try:
            return Booking.objects.get(id=booking_id)
        except Booking.DoesNotExist:
            return None

    def get(self, request, booking_id):
        booking = self.get_object(booking_id)

        if booking is None:
            return Response({
                "status": "error",
                "message": "Booking not found"
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = BookingSerializer(
            booking,
            context={'request': request}
        )

        return Response({
            "status": "success",
            "booking": serializer.data
        }, status=status.HTTP_200_OK)

    def put(self, request, booking_id):
        booking = self.get_object(booking_id)

        if booking is None:
            return Response({
                "status": "error",
                "message": "Booking not found"
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = BookingSerializer(
            booking,
            data=request.data,
            partial=True,
            context={'request': request}
        )

        if serializer.is_valid():
            serializer.save()

            return Response({
                "status": "success",
                "message": "Booking updated successfully",
                "booking": serializer.data
            }, status=status.HTTP_200_OK)

        return Response({
            "status": "error",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, booking_id):
        booking = self.get_object(booking_id)

        if booking is None:
            return Response({
                "status": "error",
                "message": "Booking not found"
            }, status=status.HTTP_404_NOT_FOUND)

        booking.delete()

        return Response({
            "status": "success",
            "message": "Booking deleted successfully"
        }, status=status.HTTP_200_OK)


class FaceScanRecordListAPIView(APIView):
    def get(self, request):
        records = FaceScanRecord.objects.all().order_by('-scan_date')
        serializer = FaceScanRecordSerializer(records, many=True)

        return Response({
            "status": "success",
            "total_records": records.count(),
            "face_scan_records": serializer.data
        }, status=status.HTTP_200_OK)