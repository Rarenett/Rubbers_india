from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('wallet_app', '0012_idle_status_tracker'),
    ]

    operations = [
        migrations.AddField(
            model_name='employeeworkingstatus',
            name='custom_idle_threshold_minutes',
            field=models.PositiveIntegerField(blank=True, null=True, help_text="Custom idle threshold in minutes for this employee. If null, global settings value is used."),
        ),
        migrations.AddField(
            model_name='workingbreak',
            name='threshold_minutes',
            field=models.PositiveIntegerField(blank=True, null=True, help_text="Threshold in minutes assigned for this break / employee"),
        ),
    ]
