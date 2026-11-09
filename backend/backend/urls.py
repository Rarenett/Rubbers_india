"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from ast import main
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('register_app.urls')),
    path('api/notifications/', include('notifications_app.urls')),
    path('api/emails/', include('emails_app.urls')), # Internal Mail endpoints
    path('api/chatbot/', include('chatbot_app.urls')),
    path('api/hr/', include('rarenett_app.urls')),  # HR/Employee management endpoints
    path('api/settings/', include('settings_app.urls')),
    path('api/meeting/', include('meeting_app.urls')), # Meeting management endpoints
    path('api/assets/', include('assets.urls')), # File/Asset management endpoints
    path('api/gate/', include('gate_app.urls')),

    path('api/hrm/', include('hr_app.urls')),
    path('api/appointment/', include('appointment_app.urls')),
    path('api/crm/', include('crm_app.urls')),
    path('api/crm_new/', include('crm.urls')),

    path('api/complaints/', include('complaint_app.urls')),
    path('api/teams/', include('team_app.urls')),
    path('api/inventory/', include('inventory_app.urls')),
    path('api/configuration/', include('Configuration_app.urls')),
    path('api/area/', include('area_app.urls')),

    path('api/logistics/', include('logistics_app.urls')),
    path('api/sales/', include('sales_app.urls')),
    path('api/finance/', include('finance_app.urls')),
    path('api/purchase/', include('purchase_app.urls')),
    path('api/tally/', include('tally.urls')),
    path('api/production/', include('production_app.urls')),
    

    path('api/', include('dynamic_db_app.urls')),       # Dynamic Database Designer
    
    path('api/machine/', include('machine_app.urls')),
    path('api/renewal/', include('renewal_app.urls')),
    path('api/project/', include('project_app.urls')),
    path('api/task-management/', include('task_management_app.urls')),
    path('api/tally/', include('tally.urls')),
    path('api/task/', include('task_app.urls')),
    path('api/payroll/', include('payroll_app.urls')),
    path('api/attendance/', include('attendance_app.urls')),
    path('api/rd/', include('rd_app.urls')),
    path('api/wallet/', include('wallet_app.urls')),
    path('api/digilocker/', include('digilocker_app.urls')),

    re_path(r'^email_attachments/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),

    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
