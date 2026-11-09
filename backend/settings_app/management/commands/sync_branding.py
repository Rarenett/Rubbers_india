from django.core.management.base import BaseCommand
from settings_app.branding_sync import sync_company_branding
from settings_app.models import Company


class Command(BaseCommand):
    help = 'Dynamically synchronizes company name and branding from the Company database table to frontend index.html and manifest.json'

    def handle(self, *args, **options):
        company = Company.objects.first()
        if not company:
            self.stdout.write(self.style.WARNING("No Company record found in database."))
            return

        sync_company_branding(company)
        name = company.display_name or company.name
        self.stdout.write(self.style.SUCCESS(f"Successfully synchronized company branding for '{name}' to frontend HTML and manifest files."))
