from django.db import migrations

def populate_area_data(apps, schema_editor):
    Area = apps.get_model('area_app', 'Area')
    AreaLocationMapping = apps.get_model('area_app', 'AreaLocationMapping')
    
    for area in Area.objects.all():
        if area.route_stop:
            area.name = area.route_stop.stop_name
            area.save()
            
            # Create mapping
            AreaLocationMapping.objects.get_or_create(
                area=area,
                route_stop=area.route_stop
            )

class Migration(migrations.Migration):
    dependencies = [
        ('area_app', '0006_area_name_alter_area_route_stop_arealocationmapping'),
    ]

    operations = [
        migrations.RunPython(populate_area_data),
    ]
