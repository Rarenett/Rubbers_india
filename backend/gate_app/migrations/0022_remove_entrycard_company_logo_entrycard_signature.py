# Generated manually

from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('gate_app', '0021_entrycard'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='entrycard',
            name='company_logo',
        ),
        migrations.AddField(
            model_name='entrycard',
            name='signature',
            field=models.ImageField(blank=True, null=True, upload_to='entry_card/signatures/'),
        ),
    ]
