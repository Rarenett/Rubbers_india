# Generated migration for WalletReason
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wallet_app', '0004_walletschemecriteria'),
    ]

    operations = [
        migrations.CreateModel(
            name='WalletReason',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('reason', models.CharField(db_index=True, help_text='Required manually entered reason', max_length=255, unique=True)),
                ('description', models.TextField(blank=True, help_text='Optional description or notes for the reason', null=True)),
                ('status', models.CharField(choices=[('Active', 'Active'), ('Inactive', 'Inactive')], db_index=True, default='Active', help_text='Status indicating whether this reason is active', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Wallet Reason',
                'verbose_name_plural': 'Wallet Reasons',
                'db_table': 'wallet_reason',
                'ordering': ['reason'],
            },
        ),
    ]
