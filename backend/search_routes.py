import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from django.apps import apps

for model in apps.get_models():
    for field in model._meta.get_fields():
        if field.is_relation and 'route' in field.name.lower():
            target = field.related_model.__name__ if hasattr(field, 'related_model') and field.related_model else ''
            print(f'{model._meta.app_label}.{model.__name__} has relation field {field.name} to {target}')
