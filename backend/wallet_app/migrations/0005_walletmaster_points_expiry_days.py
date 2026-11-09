# Generated migration for wallet_app WalletMaster points_expiry_days
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wallet_app', '0004_walletmaster_owner_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='walletmaster',
            name='points_expiry_days',
            field=models.PositiveIntegerField(
                blank=True,
                help_text='Points expiry period in days (e.g. 30, 60, 90, 365)',
                null=True,
            ),
        ),
    ]
