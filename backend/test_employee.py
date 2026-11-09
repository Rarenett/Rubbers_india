import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from rarenett_app.models import Candidate
from django.contrib.auth import get_user_model
User = get_user_model()
user = User.objects.first()
c = Candidate.objects.create(status='Pending', email='test_employee_creation@example.com', first_name='Test')
from rarenett_app.views import CandidateViewSet
class MockRequest:
    pass
req = MockRequest()
req.user = user
v = CandidateViewSet()
v.request = req
print('Before auto_create')
c.status = 'Selected'
v._auto_create_employee(c, req)
print('After auto_create')
c.delete()
