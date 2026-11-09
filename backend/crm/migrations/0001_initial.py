from django.db import migrations, models


def seed_and_copy_data(apps, schema_editor):
    LeadSource = apps.get_model('crm', 'LeadSource')
    CrmService = apps.get_model('crm', 'CrmService')

    # Seed or copy LeadSource
    try:
        OldLeadSource = apps.get_model('crm_app', 'LeadSource')
        for src in OldLeadSource.objects.all():
            LeadSource.objects.get_or_create(
                name=src.name,
                defaults={'description': src.description, 'is_active': src.is_active}
            )
    except Exception:
        default_sources = [
            'Advertisement', 'Cold Call', 'Employee Referral', 'External Referral',
            'Online Store', 'Twitter', 'Facebook', 'Partner', 'Google+',
            'Public Relations', 'Sales Email Alias', 'Seminar Partner',
            'Internal Seminar', 'Trade Show', 'Web Download', 'Web Research', 'Chat'
        ]
        for s in default_sources:
            LeadSource.objects.get_or_create(
                name=s,
                defaults={'description': f'Default CRM lead source: {s}', 'is_active': True}
            )

    # Seed or copy CrmService
    try:
        OldCrmService = apps.get_model('crm_app', 'CrmService')
        for svc in OldCrmService.objects.all():
            CrmService.objects.get_or_create(
                name=svc.name,
                defaults={'description': svc.description, 'is_active': svc.is_active}
            )
    except Exception:
        default_services = [
            'Consulting', 'Software Development', 'Web Development',
            'Digital Marketing', 'Cloud Solutions', 'IT Support & Maintenance',
            'UI/UX Design', 'Enterprise ERP'
        ]
        for s in default_services:
            CrmService.objects.get_or_create(
                name=s,
                defaults={'description': f'Default CRM service offering: {s}', 'is_active': True}
            )


class Migration(migrations.Migration):

    initial = True

    dependencies = []

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
                'verbose_name': 'Lead Source',
                'verbose_name_plural': 'Lead Sources',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='CrmService',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'CRM Service',
                'verbose_name_plural': 'CRM Services',
                'ordering': ['name'],
            },
        ),
        migrations.RunPython(seed_and_copy_data, migrations.RunPython.noop),
    ]
