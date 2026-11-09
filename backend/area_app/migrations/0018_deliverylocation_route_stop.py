# Generated manually
import django.db.models.deletion
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('area_app', '0017_merge_20261002_1430'),
        ('logistics_app', '0008_alter_routestopmaster_latitude_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='deliverylocation',
            name='route_stop',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='area_delivery_locations', to='logistics_app.routestopmaster'),
        ),
    ]
