# Generated migration for WalletSchemeCriteria
from decimal import Decimal
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('wallet_app', '0003_walletscheme'),
        ('inventory_app', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='walletscheme',
            name='criteria',
            field=models.TextField(blank=True, default='', help_text='Optional overall criteria summary or legacy criteria text'),
        ),
        migrations.CreateModel(
            name='WalletSchemeCriteria',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('percentage', models.DecimalField(decimal_places=2, default=Decimal('0.00'), help_text='Percentage value for the criterion', max_digits=7)),
                ('value', models.DecimalField(decimal_places=2, default=Decimal('0.00'), help_text='Monetary or numeric criterion value', max_digits=15)),
                ('quantity', models.DecimalField(decimal_places=2, default=Decimal('0.00'), help_text='Required quantity', max_digits=12)),
                ('points', models.DecimalField(decimal_places=2, default=Decimal('0.00'), help_text='Points associated with the criterion', max_digits=12)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('product', models.ForeignKey(blank=True, help_text='Associated StockItem product', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='wallet_scheme_criteria', to='inventory_app.stockitem')),
                ('scheme', models.ForeignKey(help_text='Parent Wallet Scheme', on_delete=django.db.models.deletion.CASCADE, related_name='criteria_rows', to='wallet_app.walletscheme')),
            ],
            options={
                'verbose_name': 'Wallet Scheme Criteria',
                'verbose_name_plural': 'Wallet Scheme Criteria',
                'db_table': 'wallet_scheme_criteria',
                'ordering': ['id'],
            },
        ),
    ]
