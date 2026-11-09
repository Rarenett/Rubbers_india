"""
URL configuration for dynamic_db_app.
"""
from django.urls import path
from .views import (
    TableListView,
    TableDetailView,
    ColumnManageView,
    ShowMysqlTablesView,
    DynamicCRUDView,
)

urlpatterns = [
    # -----------------------------------------------------------------------
    # Schema management (admin only)
    # -----------------------------------------------------------------------
    # List all tables / create a new table
    path('dynamic-db/tables/', TableListView.as_view(), name='dynamic-db-table-list'),

    # Get table detail / delete table
    path('dynamic-db/tables/<str:table_name>/', TableDetailView.as_view(), name='dynamic-db-table-detail'),

    # Add a column (POST)
    path('dynamic-db/tables/<str:table_name>/columns/', ColumnManageView.as_view(), name='dynamic-db-column-add'),

    # Modify (PUT) or Drop (DELETE) a specific column
    path('dynamic-db/tables/<str:table_name>/columns/<str:column_name>/', ColumnManageView.as_view(), name='dynamic-db-column-manage'),

    # Diagnostic: list raw MySQL tables
    path('dynamic-db/mysql-tables/', ShowMysqlTablesView.as_view(), name='dynamic-db-mysql-tables'),

    # -----------------------------------------------------------------------
    # Generic CRUD (authenticated users)
    # -----------------------------------------------------------------------
    # List + Create
    path('dynamic/<str:table_name>/', DynamicCRUDView.as_view(), name='dynamic-crud-list'),

    # Retrieve + Update + Delete
    path('dynamic/<str:table_name>/<int:pk>/', DynamicCRUDView.as_view(), name='dynamic-crud-detail'),
]
