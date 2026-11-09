import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'glenda_vite.settings')
django.setup()

from django.apps import apps
for m in apps.get_models():
    fields = [f.name for f in m._meta.fields if 'lat' in f.name.lower() or 'lon' in f.name.lower()]
    if fields:
        print(m.__name__, fields)
