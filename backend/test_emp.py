import os, sys
sys.path.append('c:\\Paul@Rarenett\\glenda_vite1\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django
django.setup()

from rarenett_app.models import Employee
print('Total Employees:', Employee.objects.count())
