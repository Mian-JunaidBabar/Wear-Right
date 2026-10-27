from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('catalog', '0006_phase2_populate_catalog')]
    operations = [
        migrations.AlterField(
            model_name='category', name='slug',
            field=models.SlugField(blank=True, max_length=120, unique=True),
        ),
        migrations.AlterField(
            model_name='product', name='slug',
            field=models.SlugField(blank=True, max_length=280, unique=True),
        ),
    ]
