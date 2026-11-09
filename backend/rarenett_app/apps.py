from django.apps import AppConfig


class RarenettAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'rarenett_app'
    
    # DISABLED: Using manual user creation via EmployeeUserForm
    # def ready(self):
    #     """Import signals when the app is ready"""
    #     import rarenett_app.signals
