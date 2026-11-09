import django.db.models.deletion
from django.db import migrations, models


def seed_default_lead_sources(apps, schema_editor):
    LeadSource = apps.get_model('crm_app', 'LeadSource')
    default_sources = [
        'Advertisement', 'Cold Call', 'Employee Referral', 'External Referral', 'Online Store',
        'Twitter', 'Facebook', 'Partner', 'Google+', 'Public Relations', 'Sales Email Alias',
        'Seminar Partner', 'Internal Seminar', 'Trade Show', 'Web Download', 'Web Research', 'Chat'
    ]
    for src in default_sources:
        LeadSource.objects.get_or_create(
            name=src,
            defaults={'description': f'Default CRM source: {src}', 'is_active': True}
        )


class Migration(migrations.Migration):

    dependencies = [
        ('crm_app', '0002_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='LeadSource',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.AlterField(
            model_name='lead',
            name='lead_source',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.RunPython(seed_default_lead_sources, migrations.RunPython.noop),
    ]
