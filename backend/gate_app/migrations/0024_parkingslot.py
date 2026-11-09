from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('gate_app', '0023_parkarea_number_of_slots_alter_parkarea_sort_order'),
    ]

    operations = [
        migrations.CreateModel(
            name='ParkingSlot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slot_number', models.PositiveIntegerField()),
                ('status', models.CharField(default='Available', max_length=50)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('park_area', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='slots', to='gate_app.parkarea')),
            ],
            options={
                'ordering': ['slot_number'],
                'unique_together': {('park_area', 'slot_number')},
            },
        ),
    ]
