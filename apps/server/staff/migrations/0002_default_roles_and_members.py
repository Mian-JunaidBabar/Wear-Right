"""Create the default roles and give every existing staff account a membership.

Existing staff had full access before RBAC existed, so they start as Super Admin; nobody is locked out.
"""
from django.db import migrations

from staff.catalog import DEFAULT_ROLES


def forwards(apps, schema_editor):
    AdminRole = apps.get_model('staff', 'AdminRole')
    AdminMember = apps.get_model('staff', 'AdminMember')
    User = apps.get_model('auth', 'User')
    for spec in DEFAULT_ROLES:
        AdminRole.objects.get_or_create(slug=spec['slug'], defaults={
            'name': spec['name'], 'description': spec['description'],
            'permissions': spec['permissions'], 'is_system': spec['is_system'],
        })
    super_admin = AdminRole.objects.get(slug='super-admin')
    for user in User.objects.filter(is_staff=True) | User.objects.filter(is_superuser=True):
        AdminMember.objects.get_or_create(user=user, defaults={'role': super_admin})


def backwards(apps, schema_editor):
    apps.get_model('staff', 'AdminMember').objects.all().delete()
    apps.get_model('staff', 'AdminRole').objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ('staff', '0001_initial'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [migrations.RunPython(forwards, backwards)]
