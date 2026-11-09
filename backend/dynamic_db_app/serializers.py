"""
DRF Serializers for Dynamic Database Designer.
Handles validation of all incoming payloads before any SQL is generated.
"""
from rest_framework import serializers
from .models import DynamicTable, DynamicField
from .validators import (
    validate_table_name,
    validate_identifier,
    validate_data_type,
    sanitize_default,
    ALLOWED_TYPES,
)


# ---------------------------------------------------------------------------
# Field serializer
# ---------------------------------------------------------------------------

class DynamicFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DynamicField
        fields = [
            'id', 'table', 'field_name', 'field_order', 'data_type',
            'length', 'precision', 'scale',
            'is_nullable', 'is_unique', 'is_primary', 'auto_increment',
            'default_value', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


# ---------------------------------------------------------------------------
# Table serializer (includes nested fields)
# ---------------------------------------------------------------------------

class DynamicTableSerializer(serializers.ModelSerializer):
    fields_count = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    fields = DynamicFieldSerializer(many=True, read_only=True)

    class Meta:
        model  = DynamicTable
        fields = [
            'id', 'table_name', 'db_table', 'description',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'fields_count', 'fields',
        ]
        read_only_fields = ['id', 'db_table', 'created_at', 'updated_at', 'created_by']

    def get_fields_count(self, obj):
        return obj.fields.count()

    def get_created_by_name(self, obj):
        if obj.created_by:
            return getattr(obj.created_by, 'get_full_name', lambda: str(obj.created_by))()
        return None


class DynamicTableListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the table list page (no nested fields)."""
    fields_count = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = DynamicTable
        fields = [
            'id', 'table_name', 'db_table', 'description',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'fields_count',
        ]

    def get_fields_count(self, obj):
        return obj.fields.count()

    def get_created_by_name(self, obj):
        if obj.created_by:
            return getattr(obj.created_by, 'get_full_name', lambda: str(obj.created_by))()
        return None


# ---------------------------------------------------------------------------
# Field input serializer — used in Create & Add Column payloads
# ---------------------------------------------------------------------------

class FieldInputSerializer(serializers.Serializer):
    """
    Validates a single field definition from the frontend.
    Does NOT touch DynamicField model — that is done by the view after SQL succeeds.
    """
    field_name     = serializers.CharField(max_length=64)
    field_order    = serializers.IntegerField(default=0)
    data_type      = serializers.ChoiceField(choices=list(ALLOWED_TYPES.keys()))
    length         = serializers.IntegerField(required=False, allow_null=True, default=None)
    precision      = serializers.IntegerField(required=False, allow_null=True, default=None)
    scale          = serializers.IntegerField(required=False, allow_null=True, default=None)
    is_nullable    = serializers.BooleanField(default=True)
    is_unique      = serializers.BooleanField(default=False)
    is_primary     = serializers.BooleanField(default=False)
    auto_increment = serializers.BooleanField(default=False)
    default_value  = serializers.CharField(
        max_length=255, required=False, allow_null=True, allow_blank=True, default=None
    )


    def validate_field_name(self, value):
        return validate_identifier(value, 'field name')

    def validate(self, data):
        # Validate type + parameters together
        try:
            validate_data_type(
                data['data_type'],
                length    = data.get('length'),
                precision = data.get('precision'),
                scale     = data.get('scale'),
            )
        except ValueError as e:
            raise serializers.ValidationError(str(e))

        # Sanitize default
        if data.get('default_value'):
            try:
                data['default_value'] = sanitize_default(data['default_value'], data['data_type'])
            except ValueError as e:
                raise serializers.ValidationError({'default_value': str(e)})

        # auto_increment only for integer types
        if data.get('auto_increment') and data['data_type'] not in ('INT', 'BIGINT'):
            raise serializers.ValidationError(
                {'auto_increment': 'AUTO_INCREMENT is only allowed for INT and BIGINT types.'}
            )

        return data


# ---------------------------------------------------------------------------
# Create Table request
# ---------------------------------------------------------------------------

class CreateTableRequestSerializer(serializers.Serializer):
    table_name  = serializers.CharField(max_length=64)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True, default=None)
    fields      = FieldInputSerializer(many=True)

    def validate_table_name(self, value):
        try:
            return validate_table_name(value)
        except ValueError as e:
            raise serializers.ValidationError(str(e))

    def validate_fields(self, fields):
        if not fields:
            raise serializers.ValidationError("At least one field is required.")

        names = [f['field_name'] for f in fields]
        if len(names) != len(set(names)):
            raise serializers.ValidationError("Duplicate field names are not allowed.")

        pk_count = sum(1 for f in fields if f.get('is_primary'))
        if pk_count > 1:
            raise serializers.ValidationError("Only one field can be marked as PRIMARY KEY.")

        return fields


# ---------------------------------------------------------------------------
# Add Column request
# ---------------------------------------------------------------------------

class AddColumnSerializer(FieldInputSerializer):
    """Same as FieldInputSerializer — just used for the add-column endpoint."""
    pass


# ---------------------------------------------------------------------------
# Modify Column request
# ---------------------------------------------------------------------------

class ModifyColumnSerializer(FieldInputSerializer):
    """Modify an existing column's type/nullable/default."""
    pass


# ---------------------------------------------------------------------------
# Rename Column request
# ---------------------------------------------------------------------------

class RenameColumnSerializer(serializers.Serializer):
    old_name = serializers.CharField(max_length=64)
    field    = FieldInputSerializer()

    def validate_old_name(self, value):
        return validate_identifier(value, 'old column name')


