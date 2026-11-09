import os
import sys

# Add the project root to python path so Django can import backend.settings
sys.path.insert(0, os.path.dirname(__file__))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
