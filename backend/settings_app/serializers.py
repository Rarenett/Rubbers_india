from rest_framework import serializers
from django_countries.serializer_fields import CountryField
from django_countries.serializers import CountryFieldMixin
from .models import (
    Currency, ExchangeRate, Language, Company, CompanyAddress, CompanyContact, 
    CompanyFinancialYear, Branch, BranchAddress, BranchContact, BranchBankAccount,
    Factory, FactoryAddress, FactoryContact,
    Warehouse, WarehouseAddress, WarehouseContact,
    PrefixType, PrefixConfiguration
)

class CurrencySerializer(CountryFieldMixin, serializers.ModelSerializer):
    class Meta:
        model = Currency
        fields = '__all__'

class ExchangeRateSerializer(serializers.ModelSerializer):
    from_currency_code = serializers.CharField(source='from_currency.code', read_only=True)
    to_currency_code = serializers.CharField(source='to_currency.code', read_only=True)

    class Meta:
        model = ExchangeRate
        fields = '__all__'

class LanguageSerializer(CountryFieldMixin, serializers.ModelSerializer):
    class Meta:
        model = Language
        fields = '__all__'

class CompanySerializer(CountryFieldMixin, serializers.ModelSerializer):
    default_currency_symbol = serializers.CharField(source='default_currency.symbol', read_only=True)
    country = CountryField(name_only=False, required=False, allow_null=True)

    class Meta:
        model = Company
        fields = '__all__'

class CompanyAddressSerializer(serializers.ModelSerializer):
    country = CountryField(name_only=False, required=False, allow_null=True)

    class Meta:
        model = CompanyAddress
        fields = '__all__'

class CompanyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyContact
        fields = '__all__'

class CompanyFinancialYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyFinancialYear
        fields = '__all__'

class BranchAddressSerializer(serializers.ModelSerializer):
    country = CountryField(name_only=False, required=False, allow_null=True)

    class Meta:
        model = BranchAddress
        fields = '__all__'

class BranchContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = BranchContact
        fields = '__all__'

class BranchBankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BranchBankAccount
        fields = '__all__'

class BranchSerializer(CountryFieldMixin, serializers.ModelSerializer):
    department_list = serializers.SerializerMethodField()
    country = CountryField(name_only=False, required=False, allow_null=True)

    def get_department_list(self, obj):
        return [dept.name for dept in obj.departments.all()]

    class Meta:
        model = Branch
        fields = ['id', 'company', 'name', 'branch_code', 'gst_number', 'country', 'default_currency', 'timezone', 'is_active', 'created_at', 'department_list']

class FactorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Factory
        fields = '__all__'

class FactoryAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = FactoryAddress
        fields = '__all__'

class FactoryContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = FactoryContact
        fields = '__all__'

class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = '__all__'

class WarehouseAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = WarehouseAddress
        fields = '__all__'

class WarehouseContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = WarehouseContact
        fields = '__all__'

class PrefixTypeSerializer(serializers.ModelSerializer):
    subtype_name = serializers.CharField(source='subtype.name', read_only=True)

    def validate_subtype(self, value):
        # Treat empty string as null so the FK lookup doesn't fail with a 404
        if value == '' or value is None:
            return None
        return value

    class Meta:
        model = PrefixType
        fields = '__all__'

class PrefixConfigurationSerializer(serializers.ModelSerializer):
    voucher_type_name = serializers.CharField(source='voucher_type.name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    subvoucher_type_name = serializers.CharField(source='subvoucher_type.type_name', read_only=True)
    ledger_name = serializers.CharField(source='ledger.name', read_only=True)

    class Meta:
        model = PrefixConfiguration
        fields = '__all__'
