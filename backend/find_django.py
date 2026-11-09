import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from django.apps import apps

models = apps.get_models()
found = False
for model in models:
    try:
        if hasattr(model, 'objects'):
            for obj in model.objects.all()[:1000]:
                for field in model._meta.fields:
                    val = getattr(obj, field.name)
                    if isinstance(val, str) and 'Rarenett' in val:
                        print(f"Found 'Rarenett' in Model: {model.__name__} (app: {model._meta.app_label}), Field: {field.name}, Value: {val}")
                        found = True
                        break
                if found:
                    pass
    except Exception as e:
        pass
print("Search complete.")
