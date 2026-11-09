# Generated migration for WalletOwnerType
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wallet_app', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='WalletOwnerType',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('owner_type', models.CharField(db_index=True, help_text='Required owner type name (e.g. Employee, Customer, Vendor, Partner)', max_length=100, unique=True)),
                ('description', models.TextField(blank=True, help_text='Optional description of the owner type', null=True)),
                ('status', models.CharField(choices=[('Active', 'Active'), ('Inactive', 'Inactive')], db_index=True, default='Active', help_text='Status indicating whether this owner type is active', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Wallet Owner Type',
                'verbose_name_plural': 'Wallet Owner Types',
                'db_table': 'wallet_ownertype',
                'ordering': ['owner_type'],
            },
        ),
    ]
