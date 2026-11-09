from django.db import migrations, models


def seed_default_services(apps, schema_editor):
    CrmService = apps.get_model('crm_app', 'CrmService')
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

    dependencies = [
        ('crm_app', '0004_lead_attachment'),
    ]

    operations = [
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
                'ordering': ['name'],
            },
        ),
        migrations.RunPython(seed_default_services, migrations.RunPython.noop),
    ]
