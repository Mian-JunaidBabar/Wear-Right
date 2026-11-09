"""Mannequin v2: skin-tone variants of bases and layers, and the new slots (kurta, outerwear, eyewear, headwear)."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0009_mannequin_alpha'),
    ]

    operations = [
        migrations.AddField(
            model_name='mannequinbase',
            name='image_fair',
            field=models.ImageField(blank=True, null=True, upload_to='mannequin_alpha/base/'),
        ),
        migrations.AddField(
            model_name='mannequinbase',
            name='image_dark',
            field=models.ImageField(blank=True, null=True, upload_to='mannequin_alpha/base/'),
        ),
        migrations.AddField(
            model_name='mannequinlayer',
            name='image_fair',
            field=models.ImageField(blank=True, null=True, upload_to='mannequin_alpha/layers/'),
        ),
        migrations.AddField(
            model_name='mannequinlayer',
            name='image_dark',
            field=models.ImageField(blank=True, null=True, upload_to='mannequin_alpha/layers/'),
        ),
        migrations.AlterField(
            model_name='mannequinlayer',
            name='slot',
            field=models.CharField(choices=[('top', 'Top'), ('kurta', 'Kurta'), ('outerwear', 'Blazer / waistcoat'), ('bottom', 'Bottom'), ('shoes', 'Shoes'), ('watch', 'Watch'), ('eyewear', 'Sunglasses'), ('headwear', 'Cap')], max_length=10),
        ),
    ]
