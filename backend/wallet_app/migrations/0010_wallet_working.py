# Generated for Wallet Working Inactivity & Break Tracking
from django.conf import settings
import django.core.validators
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('wallet_app', '0009_merge_20261016_1547'),
    ]

    operations = [
        migrations.CreateModel(
            name='WalletWorkingSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('inactivity_timeout_minutes', models.PositiveIntegerField(default=5, help_text='Time without qualifying user interaction before the alert appears (minutes)', validators=[django.core.validators.MinValueValidator(1)])),
                ('confirmation_countdown_seconds', models.PositiveIntegerField(default=30, help_text='Time allowed to click Yes before a break starts (seconds)', validators=[django.core.validators.MinValueValidator(5)])),
                ('break_tracking_enabled', models.BooleanField(default=True, help_text='Enable or disable automatic break tracking')),
                ('break_start_behavior', models.CharField(default='Automatic', help_text="Define how a break is recorded after timeout ('Automatic')", max_length=50)),
                ('monitoring_enabled', models.BooleanField(default=True, help_text='Enable or disable inactivity monitoring')),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('updated_by', models.ForeignKey(blank=True, help_text='User who last updated the settings', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='wallet_working_settings_updates', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Wallet Working Settings',
                'verbose_name_plural': 'Wallet Working Settings',
                'db_table': 'wallet_working_settings',
            },
        ),
        migrations.CreateModel(
            name='WorkingSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('session_start', models.DateTimeField(default=django.utils.timezone.now)),
                ('session_end', models.DateTimeField(blank=True, null=True)),
                ('status', models.CharField(choices=[('Active', 'Active'), ('On Break', 'On Break'), ('Ended', 'Ended')], default='Active', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(help_text='Authenticated user / employee', on_delete=django.db.models.deletion.CASCADE, related_name='working_sessions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'wallet_working_session',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='WorkingBreak',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('break_start', models.DateTimeField(default=django.utils.timezone.now)),
                ('break_end', models.DateTimeField(blank=True, null=True)),
                ('duration_seconds', models.PositiveIntegerField(blank=True, null=True)),
                ('break_source', models.CharField(default='INACTIVITY_TIMEOUT', max_length=50)),
                ('status', models.CharField(choices=[('Active', 'Active'), ('Completed', 'Completed')], default='Active', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('session', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='breaks', to='wallet_app.workingsession')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='working_breaks', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'wallet_working_break',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='InactivityEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('prompt_time', models.DateTimeField(default=django.utils.timezone.now)),
                ('response_deadline', models.DateTimeField(blank=True, null=True)),
                ('response_time', models.DateTimeField(blank=True, null=True)),
                ('outcome', models.CharField(choices=[('CONFIRMED', 'CONFIRMED'), ('TIMED_OUT', 'TIMED_OUT'), ('DISMISSED', 'DISMISSED')], default='TIMED_OUT', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('related_break', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='inactivity_events', to='wallet_app.workingbreak')),
                ('session', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='inactivity_events', to='wallet_app.workingsession')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='inactivity_events', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'wallet_inactivity_event',
                'ordering': ['-created_at'],
            },
        ),
    ]
