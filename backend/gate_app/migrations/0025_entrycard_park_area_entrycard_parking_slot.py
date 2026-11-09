from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('gate_app', '0024_parkingslot'),
    ]

    operations = [
        migrations.AddField(
            model_name='entrycard',
            name='park_area',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='entry_cards', to='gate_app.parkarea'),
        ),
        migrations.AddField(
            model_name='entrycard',
            name='parking_slot',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='entry_cards', to='gate_app.parkingslot'),
        ),
    ]
