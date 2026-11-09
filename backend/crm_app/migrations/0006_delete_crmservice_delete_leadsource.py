from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('crm_app', '0005_crmservice'),
    ]

    operations = [
        migrations.DeleteModel(
            name='CrmService',
        ),
        migrations.DeleteModel(
            name='LeadSource',
        ),
    ]
