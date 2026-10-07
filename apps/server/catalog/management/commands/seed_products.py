from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from catalog.models import Product
from accounts.models import UserProfile
from django.conf import settings
import os
import shutil

class Command(BaseCommand):
    help = 'Seeds initial products into the database for development and testing'

    def handle(self, *args, **kwargs):
        self.stdout.write("Seeding sample products...")

        # Copy media
        seed_media_dir = os.path.join(settings.BASE_DIR, 'seed_media', 'products')
        media_dir = os.path.join(settings.MEDIA_ROOT, 'products')
        os.makedirs(media_dir, exist_ok=True)
        if os.path.exists(seed_media_dir):
            for file_name in os.listdir(seed_media_dir):
                src = os.path.join(seed_media_dir, file_name)
                dst = os.path.join(media_dir, file_name)
                if not os.path.exists(dst):
                    shutil.copy2(src, dst)

        # Create admin
        password = os.environ.get('DEMO_ADMIN_PASSWORD')
        if not password and settings.DEBUG:
            password = 'admin12345'
        
        if password:
            admin_user, created = User.objects.get_or_create(
                username='admin',
                defaults={
                    'email': 'admin@wearright.local',
                    'is_staff': True,
                    'is_superuser': True,
                }
            )
            if created:
                admin_user.set_password(password)
                admin_user.save()
                UserProfile.objects.get_or_create(
                    user=admin_user,
                    defaults={'skin_tone': 'Medium', 'cultural_preference': 'Western'}
                )
                self.stdout.write(self.style.SUCCESS(f"Created admin user (admin / {password})"))

        sample_products = [
            { "name": "Black Formal Trouser", "category": "Men Pant", "cultural_tag": "Formal", "compatible_skin_tone": "All", "color": "Black", "garment_type": "Bottom", "image": "products/Black_Formal_Pant.jpeg", "cost_price": 2500, "price": 4200, "stock_quantity": 25, "size_s_stock": 5, "size_m_stock": 10, "size_l_stock": 7, "size_xl_stock": 3, "status": "Active" },
            { "name": "Classic Blue Silk Tie", "category": "Men Cap", "cultural_tag": "Formal", "compatible_skin_tone": "All", "color": "Navy Blue", "garment_type": "Accessory", "image": "products/Blue_Tie.jpeg", "cost_price": 900, "price": 1800, "stock_quantity": 40, "size_m_stock": 40, "status": "Active" },
            { "name": "Brown Casual Loafers", "category": "Men Shoes", "cultural_tag": "Casual", "compatible_skin_tone": "Medium", "color": "Brown", "garment_type": "Footwear", "image": "products/Brown_Casual_Shoes.webp", "cost_price": 3800, "price": 6500, "stock_quantity": 18, "size_m_stock": 8, "size_l_stock": 10, "status": "Active" },
            { "name": "Oxford Brown Formal Shoes", "category": "Men Shoes", "cultural_tag": "Formal", "compatible_skin_tone": "All", "color": "Dark Brown", "garment_type": "Footwear", "image": "products/Brown_Formal_Shoes.jpeg", "cost_price": 4500, "price": 7900, "stock_quantity": 15, "size_m_stock": 6, "size_l_stock": 9, "status": "Active" },
            { "name": "Khaki Casual Chinos", "category": "Men Pant", "cultural_tag": "Casual", "compatible_skin_tone": "Medium", "color": "Khaki", "garment_type": "Bottom", "image": "products/Khaki_Casual_Pant.jpeg", "cost_price": 2200, "price": 3800, "stock_quantity": 30, "size_s_stock": 6, "size_m_stock": 12, "size_l_stock": 12, "status": "Active" },
            { "name": "Off-White Casual Linen Shirt", "category": "Men Shirt", "cultural_tag": "Casual", "compatible_skin_tone": "Fair", "color": "Off-White", "garment_type": "Top", "image": "products/Off_White_Casual_Shirt.jpeg", "cost_price": 2000, "price": 3500, "stock_quantity": 35, "size_s_stock": 10, "size_m_stock": 15, "size_l_stock": 10, "status": "Active" },
            { "name": "Silver Chrono Watch", "category": "Men Cap", "cultural_tag": "Formal", "compatible_skin_tone": "All", "color": "Grey", "garment_type": "Accessory", "image": "products/Silver_Watch.jpeg", "cost_price": 5000, "price": 9500, "stock_quantity": 12, "size_m_stock": 12, "status": "Active" },
            { "name": "Women Formal Embroidered Kurta", "category": "Women Kurta", "cultural_tag": "Eastern", "compatible_skin_tone": "Medium", "color": "Burgundy", "garment_type": "Top", "image": "products/Women_Formal_Kurta.jpeg", "cost_price": 3200, "price": 5800, "stock_quantity": 22, "size_s_stock": 8, "size_m_stock": 10, "size_l_stock": 4, "status": "Active" },
            { "name": "Women Western Tunic Kurta", "category": "Women Kurta", "cultural_tag": "Western", "compatible_skin_tone": "All", "color": "Teal", "garment_type": "Top", "image": "products/Women_western_Kurta.jpeg", "cost_price": 2800, "price": 4900, "stock_quantity": 20, "size_s_stock": 6, "size_m_stock": 8, "size_l_stock": 6, "status": "Active" },
            { "name": "Beige Structured Blazer", "category": "Men Shirt", "cultural_tag": "Formal", "compatible_skin_tone": "Dark", "color": "Beige", "garment_type": "Top", "image": "products/beige_blazer.png", "cost_price": 6000, "price": 11500, "stock_quantity": 14, "size_m_stock": 8, "size_l_stock": 6, "status": "Active" },
            { "name": "Olive Green Tailored Blazer", "category": "Men Shirt", "cultural_tag": "Casual", "compatible_skin_tone": "Fair", "color": "Olive Green", "garment_type": "Top", "image": "products/olive_green_blazer.png", "cost_price": 6200, "price": 11800, "stock_quantity": 16, "size_m_stock": 10, "size_l_stock": 6, "status": "Active" },
        ]

        count = 0
        for item_data in sample_products:
            prod, created = Product.objects.get_or_create(
                name=item_data["name"],
                defaults=item_data,
            )
            if created:
                count += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully seeded {count} products!"))
