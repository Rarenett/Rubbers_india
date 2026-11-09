from django.apps import AppConfig


class ProductionAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'production_app'
