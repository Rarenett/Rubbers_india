from django.urls import path
from .views import TableConfigurationView, ConfigurableModelsView, ModelFieldsView, BackupStatusView, BackupManualView

urlpatterns = [
    path('models/', ConfigurableModelsView.as_view(), name='configurable-models'),
    path('fields/', ModelFieldsView.as_view(), name='model-fields'),
    path('settings/', TableConfigurationView.as_view(), name='table-settings'),
    path('backup-status/', BackupStatusView.as_view(), name='backup-status'),
    path('backup-manual/', BackupManualView.as_view(), name='backup-manual'),
]
