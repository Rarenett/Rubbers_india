# Generated for wallet_app points entry scheme field
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('wallet_app', '0002_walletpointsentry'),
    ]

    operations = [
        migrations.CreateModel(
            name='WalletScheme',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(db_index=True, max_length=255)),
                ('start_date', models.DateField()),
                ('end_date', models.DateField()),
                ('remarks', models.TextField(blank=True, null=True)),
                ('criteria', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Wallet Scheme',
                'verbose_name_plural': 'Wallet Schemes',
                'db_table': 'wallet_schemes',
                'ordering': ['name'],
            },
        ),
        migrations.AddField(
            model_name='walletpointsentry',
            name='scheme',
            field=models.ForeignKey(
                blank=True,
                help_text='Scheme associated with this points entry',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='points_entries',
                to='wallet_app.walletscheme',
            ),
        ),
    ]
