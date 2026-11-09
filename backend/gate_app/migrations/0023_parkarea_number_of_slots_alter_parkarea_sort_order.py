# Generated manually
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('gate_app', '0022_remove_entrycard_company_logo_entrycard_signature'),
    ]

    operations = [
        migrations.AddField(
            model_name='parkarea',
            name='number_of_slots',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='parkarea',
            name='sort_order',
            field=models.IntegerField(blank=True, default=0, null=True),
        ),
    ]
