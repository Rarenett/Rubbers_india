from django.apps import AppConfig
from django.db.models.signals import post_migrate


def seed_standard_account_groups(sender, **kwargs):
    try:
        from .views import ensure_default_account_groups, ensure_default_voucher_types
        ensure_default_account_groups()
        ensure_default_voucher_types()
    except Exception:
        pass


class FinanceAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'finance_app'

    def ready(self):
        post_migrate.connect(seed_standard_account_groups, sender=self)
