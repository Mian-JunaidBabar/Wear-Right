from django.core.management.base import BaseCommand

from recommender.services import seed_default_rules


class Command(BaseCommand):
    help = "Creates the starting tone-to-colour rules that do not exist yet. Rules edited by staff are kept."

    def handle(self, *args, **options):
        created = seed_default_rules()
        self.stdout.write(self.style.SUCCESS(f"Tone rules: {created} created."))
