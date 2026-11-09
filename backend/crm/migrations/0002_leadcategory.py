from django.db import migrations, models


def seed_and_copy_categories(apps, schema_editor):
    LeadCategory = apps.get_model('crm', 'LeadCategory')

    try:
        OldCategory = apps.get_model('crm_app', 'LeadCategory')
        for cat in OldCategory.objects.all():
            LeadCategory.objects.get_or_create(
                name=cat.name,
                defaults={'description': getattr(cat, 'description', '') or '', 'is_active': True}
            )
    except Exception:
        pass

    default_categories = [
        'Vendor', 'Distributor', 'Bulk sell', 'Partner', 'Inbound Lead', 'Outbound Lead'
    ]
    for name in default_categories:
        LeadCategory.objects.get_or_create(
            name=name,
            defaults={'description': f'Default CRM lead category: {name}', 'is_active': True}
        )


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='LeadCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Lead Category',
                'verbose_name_plural': 'Lead Categories',
                'ordering': ['name'],
            },
        ),
        migrations.RunPython(seed_and_copy_categories, migrations.RunPython.noop),
    ]
