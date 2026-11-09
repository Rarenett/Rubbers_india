# Generated for wallet_app initial schema
from decimal import Decimal
import django.core.validators
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='WalletMaster',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('wallet_code', models.CharField(db_index=True, help_text='Unique identifier for the wallet (e.g. WAL-001)', max_length=50, unique=True)),
                ('wallet_name', models.CharField(help_text='Display name of the wallet', max_length=150)),
                ('description', models.TextField(blank=True, help_text='Optional description or purpose of this wallet', null=True)),
                ('status', models.CharField(choices=[('Active', 'Active'), ('Inactive', 'Inactive')], db_index=True, default='Active', help_text='Status indicating whether this wallet is active for transactions', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_wallets', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Wallet Master',
                'verbose_name_plural': 'Wallet Masters',
                'db_table': 'wallet_master',
                'ordering': ['wallet_name'],
            },
        ),
        migrations.CreateModel(
            name='WalletTransaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('transaction_number', models.CharField(db_index=True, help_text='Unique transaction identifier', max_length=50, unique=True)),
                ('transaction_date', models.DateField(db_index=True, default=django.utils.timezone.now, help_text='Date when transaction occurred')),
                ('transaction_type', models.CharField(choices=[('Credit', 'Credit'), ('Debit', 'Debit')], db_index=True, help_text='Credit (inflow) or Debit (outflow)', max_length=10)),
                ('amount', models.DecimalField(decimal_places=2, help_text='Transaction monetary amount (must be > 0)', max_digits=15, validators=[django.core.validators.MinValueValidator(Decimal('0.01'))])),
                ('reference_number', models.CharField(blank=True, db_index=True, help_text='Optional external reference number', max_length=100, null=True)),
                ('description', models.TextField(blank=True, help_text='Optional description or remarks', null=True)),
                ('status', models.CharField(choices=[('Posted', 'Posted'), ('Cancelled', 'Cancelled')], db_index=True, default='Posted', help_text='Transaction lifecycle status', max_length=20)),
                ('cancellation_reason', models.TextField(blank=True, help_text='Reason if transaction is cancelled', null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='wallet_transactions', to=settings.AUTH_USER_MODEL)),
                ('wallet', models.ForeignKey(help_text='Wallet associated with this transaction', on_delete=django.db.models.deletion.PROTECT, related_name='transactions', to='wallet_app.walletmaster')),
            ],
            options={
                'verbose_name': 'Wallet Transaction',
                'verbose_name_plural': 'Wallet Transactions',
                'db_table': 'wallet_transaction',
                'ordering': ['-transaction_date', '-created_at'],
            },
        ),
    ]
