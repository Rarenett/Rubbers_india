# Generated for WalletScheme status field
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wallet_app', '0005_walletreason'),
        ('wallet_app', '0003_walletpointsentry_scheme'),
    ]

    operations = [
        migrations.AddField(
            model_name='walletscheme',
            name='status',
            field=models.CharField(
                choices=[('Active', 'Active'), ('Inactive', 'Inactive')],
                db_index=True,
                default='Active',
                help_text='Status indicating whether this scheme is active or inactive',
                max_length=20
            ),
        ),
    ]
