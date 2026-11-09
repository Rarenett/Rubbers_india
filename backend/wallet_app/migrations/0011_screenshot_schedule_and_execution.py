# Generated for Wallet Calendar & Scheduled Screenshot System
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('wallet_app', '0010_wallet_working'),
    ]

    operations = [
        migrations.CreateModel(
            name='ScreenshotSchedule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('scheduled_date', models.DateField(db_index=True, help_text='Calendar date for screenshot capture (YYYY-MM-DD)')),
                ('scheduled_time', models.TimeField(db_index=True, help_text='Target clock time for screenshot capture (HH:MM:SS or HH:MM)')),
                ('is_active', models.BooleanField(db_index=True, default=True, help_text='Whether this schedule is currently active')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, help_text='User who created this schedule', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_screenshot_schedules', to=settings.AUTH_USER_MODEL)),
                ('user', models.ForeignKey(help_text='User/Employee for whom the screenshot is scheduled', on_delete=django.db.models.deletion.CASCADE, related_name='wallet_screenshot_schedules', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Screenshot Schedule',
                'verbose_name_plural': 'Screenshot Schedules',
                'db_table': 'wallet_screenshot_schedule',
                'ordering': ['scheduled_date', 'scheduled_time'],
            },
        ),
        migrations.CreateModel(
            name='ScreenshotExecution',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('scheduled_date', models.DateField(db_index=True, help_text='Calendar date of the scheduled capture')),
                ('scheduled_time', models.TimeField(help_text='Clock time of the scheduled capture')),
                ('scheduled_datetime', models.DateTimeField(db_index=True, help_text='Combined timestamp for ordering and scheduling logic')),
                ('executed_at', models.DateTimeField(blank=True, help_text='Timestamp when capture execution was completed', null=True)),
                ('status', models.CharField(choices=[('Scheduled', 'Scheduled'), ('Captured', 'Captured'), ('Failed', 'Failed'), ('Permission Required', 'Permission Required'), ('Missed', 'Missed')], db_index=True, default='Scheduled', help_text='Execution outcome: Scheduled, Captured, Failed, Permission Required, Missed', max_length=30)),
                ('screenshot_file', models.FileField(blank=True, help_text='Captured screenshot image file', null=True, upload_to='wallet_screenshots/%Y/%m/%d/')),
                ('error_message', models.TextField(blank=True, help_text='Diagnostic error or failure description', null=True)),
                ('capture_source', models.CharField(default='Browser Session', help_text='Capture agent mechanism (e.g. Browser Session, Desktop Agent)', max_length=50)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('schedule', models.ForeignKey(blank=True, help_text='Associated schedule if still active', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='executions', to='wallet_app.screenshotschedule')),
                ('user', models.ForeignKey(help_text='User/Employee whose screen was captured', on_delete=django.db.models.deletion.CASCADE, related_name='wallet_screenshot_executions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Screenshot Execution',
                'verbose_name_plural': 'Screenshot Executions',
                'db_table': 'wallet_screenshot_execution',
                'ordering': ['-scheduled_datetime', '-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='screenshotschedule',
            constraint=models.UniqueConstraint(fields=('user', 'scheduled_date', 'scheduled_time'), name='unique_active_user_date_time_schedule'),
        ),
    ]
