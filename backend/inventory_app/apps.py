from django.apps import AppConfig
from django.db.models.signals import post_migrate


def seed_default_units(sender, **kwargs):
    try:
        from .views import ensure_default_units
        ensure_default_units()
    except Exception:
        pass


class InventoryAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'inventory_app'

    def ready(self):
        post_migrate.connect(seed_default_units, sender=self)
