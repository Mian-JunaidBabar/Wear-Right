from django.core.management.base import BaseCommand

from catalog.models import Category, Style
from catalog.taxonomy import seed_taxonomy


class Command(BaseCommand):
    help = "Creates the default categories and styles that do not exist yet. Rows staff edited are left alone."

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS(f"Taxonomy: {seed_taxonomy(Category, Style)} created."))
