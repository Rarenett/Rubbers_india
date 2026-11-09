# Generated migration for wallet_app WalletMaster owner and configuration fields
from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wallet_app', '0003_walletpointsentry_scheme'),
    ]

    operations = [
        migrations.AddField(
            model_name='walletmaster',
            name='owner_type',
            field=models.CharField(
                choices=[('Employee', 'Employee'), ('Vendor', 'Vendor'), ('Distributor', 'Distributor')],
                db_index=True,
                default='Employee',
                help_text='Owner category: Employee, Vendor, or Distributor',
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='walletmaster',
            name='owner_id',
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text='Unique identifier for the owner (e.g. EMP-0001, VND-0002, DST-0001)',
                max_length=50,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='walletmaster',
            name='owner_record_id',
            field=models.PositiveBigIntegerField(
                blank=True,
                db_index=True,
                help_text='Primary key of the related model record (Employee, HrVendor, or HrDistributor)',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='walletmaster',
            name='mobile',
            field=models.CharField(
                blank=True,
                help_text='Owner contact mobile number',
                max_length=30,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='walletmaster',
            name='email',
            field=models.EmailField(
                blank=True,
                help_text='Owner contact email address',
                max_length=254,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='walletmaster',
            name='opening_points',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0.00'),
                help_text='Opening points for the wallet (default: 0)',
                max_digits=15,
            ),
        ),
        migrations.AddField(
            model_name='walletmaster',
            name='daily_deduction_limit',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0.00'),
                help_text='Daily deduction limit (0 means no limit)',
                max_digits=15,
            ),
        ),
        migrations.AddField(
            model_name='walletmaster',
            name='points_expiry_date',
            field=models.DateField(
                blank=True,
                db_index=True,
                help_text='Points expiry date if applicable',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='walletmaster',
            name='remarks',
            field=models.TextField(
                blank=True,
                help_text='Optional remarks or notes',
                null=True,
            ),
        ),
    ]
