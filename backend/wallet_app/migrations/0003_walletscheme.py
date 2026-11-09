# Generated migration for WalletScheme
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wallet_app', '0002_walletownertype'),
    ]

    operations = [
        migrations.CreateModel(
            name='WalletScheme',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(db_index=True, help_text='Required scheme name', max_length=255)),
                ('start_date', models.DateField(help_text='Scheme validity start date')),
                ('end_date', models.DateField(help_text='Scheme validity end date')),
                ('remarks', models.TextField(blank=True, help_text='Optional remarks/notes about the scheme', null=True)),
                ('criteria', models.TextField(help_text='Required eligibility criteria or conditions of the scheme')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Wallet Scheme',
                'verbose_name_plural': 'Wallet Schemes',
                'db_table': 'wallet_schemes',
                'ordering': ['-created_at'],
            },
        ),
    ]
