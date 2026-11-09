import django.db.models.deletion
from django.db import migrations, models


def seed_default_industries(apps, schema_editor):
    Industry = apps.get_model('crm', 'Industry')
    default_industries = [
        'ASP',
        'Data/Telecom OEM',
        'ERP',
        'Government/Military',
        'Large Enterprise',
        'ManagementISV',
        'MSP (Management Service Provider)',
        'Network Equipment Enterprise',
        'Non-management ISV',
        'Optical Networking',
        'Service Provider',
        'Small/Medium Enterprise',
        'Storage Equipment',
        'Storage Service Provider',
        'Systems Integrator',
        'Wireless Industry',
        'Manufacturing',
        'Retail',
        'Healthcare',
        'Other',
    ]
    for ind in default_industries:
        Industry.objects.get_or_create(
            name=ind,
            defaults={'description': f'Default CRM industry: {ind}', 'is_active': True}
        )


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0003_lead_and_attachments'),
    ]

    operations = [
        migrations.CreateModel(
            name='Industry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Industry',
                'verbose_name_plural': 'Industries',
                'ordering': ['name'],
            },
        ),
        migrations.AlterField(
            model_name='lead',
            name='industry',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='crm_leads', to='crm.industry'),
        ),
        migrations.RunPython(seed_default_industries, migrations.RunPython.noop),
    ]
