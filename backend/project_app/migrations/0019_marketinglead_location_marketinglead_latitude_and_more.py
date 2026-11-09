from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('project_app', '0018_remove_marketingattendance_attendance_type_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='marketinglead',
            name='latitude',
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name='marketinglead',
            name='location',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='marketinglead',
            name='longitude',
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
    ]
