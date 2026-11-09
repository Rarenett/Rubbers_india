# Generated for WalletSchemeCriteria criteria_group field
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wallet_app', '0006_walletscheme_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='walletschemecriteria',
            name='criteria_group',
            field=models.CharField(
                choices=[('criteria', 'Criteria'), ('criteria_2', 'Criteria 2')],
                db_index=True,
                default='criteria',
                help_text='Identifies which criteria tab/group this record belongs to (criteria or criteria_2)',
                max_length=50
            ),
        ),
    ]
