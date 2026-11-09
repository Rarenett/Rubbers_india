# Generated migration for WalletCriteriaValue
from decimal import Decimal
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('wallet_app', '0007_walletschemecriteria_criteria_group'),
        ('inventory_app', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='WalletCriteriaValue',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('value', models.DecimalField(decimal_places=2, default=Decimal('0.00'), help_text='Threshold purchase value for the criterion', max_digits=15)),
                ('discount_percentage', models.DecimalField(decimal_places=2, default=Decimal('0.00'), help_text='Discount percentage (%)', max_digits=7)),
                ('discount_value', models.DecimalField(decimal_places=2, default=Decimal('0.00'), help_text='Discount monetary value', max_digits=15)),
                ('points', models.DecimalField(decimal_places=2, default=Decimal('0.00'), help_text='Points associated with the criterion', max_digits=12)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('product', models.ForeignKey(blank=True, help_text='Associated StockItem product', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='wallet_criteria_values', to='inventory_app.stockitem')),
                ('scheme', models.ForeignKey(help_text='Parent Wallet Scheme', on_delete=django.db.models.deletion.CASCADE, related_name='criteria_values', to='wallet_app.walletscheme')),
            ],
            options={
                'verbose_name': 'Wallet Criteria Value',
                'verbose_name_plural': 'Wallet Criteria Values',
                'db_table': 'wallet_criteria_values',
                'ordering': ['id'],
            },
        ),
    ]
