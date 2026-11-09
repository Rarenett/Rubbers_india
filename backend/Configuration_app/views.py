from rest_framework import viewsets, views
from rest_framework.response import Response
from django.apps import apps
from .models import DynamicTableConfiguration
from .serializers import DynamicTableConfigurationSerializer

class TableConfigurationView(views.APIView):
    def get(self, request):
        table_name = request.query_params.get('table_name')
        form_name = request.query_params.get('form_name')
        if not table_name or not form_name:
            return Response({'error': 'table_name and form_name required'}, status=400)
            
        config = DynamicTableConfiguration.objects.filter(table_name=table_name, form_name=form_name).first()
        if config:
            serializer = DynamicTableConfigurationSerializer(config)
            return Response(serializer.data)
        return Response({'error': 'Not found'}, status=404)

    def put(self, request):
        table_name = request.data.get('table_name')
        form_name = request.data.get('form_name')
        if not table_name or not form_name:
            return Response({'error': 'table_name and form_name required'}, status=400)
            
        config, created = DynamicTableConfiguration.objects.get_or_create(
            table_name=table_name, 
            form_name=form_name
        )
        serializer = DynamicTableConfigurationSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

class ConfigurableModelsView(views.APIView):
    def get(self, request):
        allowed_apps = ['machine_app', 'logistics_app', 'finance_app', 'sales_app', 'purchase_app', 'inventory_app', 'register_app', 'crm_app', 'appointment_app', 'assets', 'chatbot_app', 'complaint_app', 'emails_app', 'gate_app', 'hr_app', 'meeting_app', 'notifications_app', 'rarenett_app', 'settings_app', 'team_app', 'production_app', 'renewal_app', 'dynamic_db_app', 'Configuration_app']
        models_info = []
        for app_label in allowed_apps:
            try:
                app_config = apps.get_app_config(app_label)
                for model in app_config.get_models():
                    models_info.append({
                        'app_label': app_label,
                        'model_name': model.__name__,
                        'table_name': model._meta.db_table,
                        'verbose_name': str(model._meta.verbose_name).title()
                    })
            except LookupError:
                continue
        return Response(models_info)

class ModelFieldsView(views.APIView):
    def get(self, request):
        app_label = request.query_params.get('app_label')
        model_name = request.query_params.get('model_name')
        
        if not app_label or not model_name:
            return Response({'error': 'app_label and model_name are required'}, status=400)
            
        try:
            model = apps.get_model(app_label, model_name)
            fields = []
            for field in model._meta.get_fields():
                # Only include concrete fields
                if hasattr(field, 'verbose_name'):
                    is_required = not getattr(field, 'blank', True) and not getattr(field, 'null', True) and not field.primary_key
                    fields.append({
                        'name': field.name,
                        'label': str(field.verbose_name).title(),
                        'type': field.get_internal_type(),
                        'required': is_required
                    })
            return Response(fields)
        except LookupError:
            return Response({'error': 'Model not found'}, status=404)

import json
from pathlib import Path
from django.conf import settings
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework import status
from django.core.management import call_command

class BackupStatusView(views.APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        backup_dir = getattr(settings, 'DATABASE_BACKUP_DIR', settings.BASE_DIR / 'backups' / 'database')
        backup_dir = Path(backup_dir)
        status_file = backup_dir / 'backup_status.json'
        
        if not status_file.exists():
            return Response({'status': 'No backups run yet.'})
            
        try:
            with open(status_file, 'r') as f:
                data = json.load(f)
            return Response(data)
        except Exception as e:
            return Response({'error': 'Could not read backup status.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class BackupManualView(views.APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        try:
            # Run the command synchronously
            call_command('backup_database')
            
            # Read the status to return it
            backup_dir = getattr(settings, 'DATABASE_BACKUP_DIR', settings.BASE_DIR / 'backups' / 'database')
            backup_dir = Path(backup_dir)
            status_file = backup_dir / 'backup_status.json'
            
            if status_file.exists():
                with open(status_file, 'r') as f:
                    data = json.load(f)
                    
                if data.get('status') == 'success':
                    return Response({'message': 'Backup completed successfully.', 'details': data})
                else:
                    return Response({'error': 'Backup failed.', 'details': data}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            else:
                return Response({'error': 'Backup failed, status file not found.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except SystemExit:
            return Response({'error': 'Backup command failed and exited.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
