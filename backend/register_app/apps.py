from django.apps import AppConfig
from django.db.models.signals import post_migrate


def seed_default_menus(sender, **kwargs):
    pass


class RegisterAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'register_app'

    def ready(self):
        post_migrate.connect(seed_default_menus, sender=self)

