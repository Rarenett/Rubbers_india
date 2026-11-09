# Generated manually

from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('gate_app', '0020_remove_parkarea_description_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='EntryCard',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('company_logo', models.ImageField(blank=True, null=True, upload_to='entry_cards/logos/')),
                ('vehicle_number', models.CharField(max_length=50)),
                ('entry_time', models.DateTimeField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
    ]
