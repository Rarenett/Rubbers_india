from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('wallet_app', '0011_screenshot_schedule_and_execution'),
    ]

    operations = [
        migrations.AddField(
            model_name='walletworkingsettings',
            name='idle_threshold_minutes',
            field=models.PositiveIntegerField(default=10),
        ),
        migrations.AddField(
            model_name='walletworkingsettings',
            name='check_interval_seconds',
            field=models.PositiveIntegerField(default=60),
        ),
        migrations.AddField(
            model_name='walletworkingsettings',
            name='heartbeat_timeout_minutes',
            field=models.PositiveIntegerField(default=15),
        ),
        migrations.CreateModel(
            name='EmployeeWorkingStatus',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('ACTIVE', 'Active'), ('IDLE', 'Idle')], default='ACTIVE', max_length=10)),
                ('last_change', models.DateTimeField()),
                ('last_activity_at', models.DateTimeField()),
                ('last_heartbeat_at', models.DateTimeField(blank=True, null=True)),
                ('device_identifier', models.CharField(blank=True, default='', max_length=120)),
                ('agent_version', models.CharField(blank=True, default='', max_length=30)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='working_status', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'wallet_employee_working_status',
            },
        ),
        migrations.CreateModel(
            name='WorkingStatusHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('ACTIVE', 'Active'), ('IDLE', 'Idle')], max_length=10)),
                ('changed_at', models.DateTimeField()),
                ('last_activity_at', models.DateTimeField(blank=True, null=True)),
                ('device_identifier', models.CharField(blank=True, default='', max_length=120)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='working_status_histories', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'wallet_working_status_history',
                'ordering': ['-changed_at'],
            },
        ),
    ]
