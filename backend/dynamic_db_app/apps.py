from django.apps import AppConfig


class DynamicDbAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'dynamic_db_app'
    verbose_name = 'Dynamic Database Designer'
