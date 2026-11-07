"""Mannequin (alpha): the fixed base photo per gender and one garment layer per product."""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0008_product_kind'),
    ]

    operations = [
        migrations.CreateModel(
            name='MannequinBase',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('gender', models.CharField(choices=[('men', 'Men'), ('women', 'Women')], max_length=10, unique=True)),
                ('image', models.ImageField(upload_to='mannequin_alpha/base/')),
                ('base_top', models.ImageField(blank=True, null=True, upload_to='mannequin_alpha/base/')),
                ('base_bottom', models.ImageField(blank=True, null=True, upload_to='mannequin_alpha/base/')),
                ('width', models.PositiveIntegerField(default=960)),
                ('height', models.PositiveIntegerField(default=1280)),
                ('label', models.CharField(default='AI-generated model', max_length=80)),
                ('source_sha', models.CharField(blank=True, default='', max_length=64)),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='MannequinLayer',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('slot', models.CharField(choices=[('top', 'Top'), ('bottom', 'Bottom'), ('shoes', 'Shoes'), ('watch', 'Watch')], max_length=10)),
                ('image', models.ImageField(upload_to='mannequin_alpha/layers/')),
                ('source', models.CharField(default='gemini_app', max_length=30)),
                ('source_sha', models.CharField(blank=True, default='', max_length=64)),
                ('report', models.JSONField(blank=True, default=dict)),
                ('approved', models.BooleanField(default=False)),
                ('note', models.CharField(blank=True, default='', max_length=255)),
                ('base', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='layers', to='catalog.mannequinbase')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='mannequin_layers', to='catalog.product')),
            ],
            options={
                'ordering': ['slot', 'id'],
                'constraints': [models.UniqueConstraint(fields=('base', 'product'), name='unique_mannequin_layer_per_product')],
            },
        ),
    ]
