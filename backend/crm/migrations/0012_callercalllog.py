import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Standalone migration for CallerCallLog - bypasses the broken merge migration
    by depending only on the last stable leaf that includes TelecallingLeadAssignment.
    """

    dependencies = [
        ('crm', '0010_alter_telecallingleadassignment_unique_together_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CallerCallLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('call_outcome', models.CharField(
                    choices=[
                        ('Not Answered', 'Not Answered'),
                        ('Busy', 'Busy'),
                        ('Wrong Number', 'Wrong Number'),
                        ('Contacted', 'Contacted'),
                        ('Interested', 'Interested'),
                        ('Not Interested', 'Not Interested'),
                        ('Call Back Later', 'Call Back Later'),
                        ('Converted', 'Converted'),
                    ],
                    default='Contacted',
                    max_length=50,
                )),
                ('duration_seconds', models.IntegerField(blank=True, help_text='Call duration in seconds', null=True)),
                ('notes', models.TextField(blank=True, help_text='Notes / remarks after the call', null=True)),
                ('follow_up_date', models.DateField(blank=True, help_text='Next follow-up date if applicable', null=True)),
                ('called_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('assignment', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='call_logs',
                    to='crm.telecallingleadassignment',
                )),
                ('caller', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='crm_call_logs',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Caller Call Log',
                'verbose_name_plural': 'Caller Call Logs',
                'db_table': 'crm_caller_call_log',
                'ordering': ['-called_at'],
            },
        ),
    ]
