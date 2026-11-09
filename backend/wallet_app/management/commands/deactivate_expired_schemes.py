from django.core.management.base import BaseCommand
from wallet_app.models import WalletScheme, get_wallet_local_date


class Command(BaseCommand):
    help = "Automatically deactivates Wallet Schemes whose End Date has passed."

    def handle(self, *args, **options):
        today = get_wallet_local_date()
        updated_count = WalletScheme.deactivate_expired()
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully checked schemes as of {today.strftime('%d-%m-%Y')}. "
                f"Deactivated {updated_count} expired scheme(s)."
            )
        )
