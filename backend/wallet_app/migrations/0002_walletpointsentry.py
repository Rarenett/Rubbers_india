# Generated for wallet_app points entry table
from decimal import Decimal
import django.core.validators
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('wallet_app', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='WalletPointsEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('entry_type', models.CharField(choices=[('Addition', '+ Addition'), ('Deduction', '− Deduction')], db_index=True, default='Addition', help_text='Addition or Deduction', max_length=20)),
                ('points', models.DecimalField(decimal_places=2, help_text='Points entered (must be > 0)', max_digits=15, validators=[django.core.validators.MinValueValidator(Decimal('0.01'))])),
                ('reason', models.CharField(choices=[('Reward / Incentive', 'Reward / Incentive'), ('Purchase credit', 'Purchase credit'), ('Bulk allocation', 'Bulk allocation'), ('Refund / Reversal', 'Refund / Reversal'), ('Manual adjustment', 'Manual adjustment')], db_index=True, default='Reward / Incentive', help_text='Reason for the points entry', max_length=50)),
                ('reference_no', models.CharField(blank=True, db_index=True, help_text='Invoice, order, or ticket reference', max_length=255, null=True)),
                ('entry_date', models.DateField(db_index=True, default=django.utils.timezone.now, help_text='Date of points entry')),
                ('remarks', models.TextField(blank=True, help_text='Optional remarks or notes', null=True)),
                ('balance_before', models.DecimalField(decimal_places=2, help_text='Authoritative wallet balance before this entry', max_digits=15)),
                ('balance_after', models.DecimalField(decimal_places=2, help_text='Authoritative wallet balance after this entry', max_digits=15)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('created_by', models.ForeignKey(blank=True, help_text='User who posted the entry', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='wallet_points_entries', to=settings.AUTH_USER_MODEL)),
                ('wallet', models.ForeignKey(help_text='Wallet associated with this points entry', on_delete=django.db.models.deletion.PROTECT, related_name='points_entries', to='wallet_app.walletmaster')),
            ],
            options={
                'verbose_name': 'Wallet Points Entry',
                'verbose_name_plural': 'Wallet Points Entries',
                'db_table': 'wallet_points_entry',
                'ordering': ['-entry_date', '-created_at'],
            },
        ),
    ]
