# Merge migration covering all branch leaves

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0007_leadimportbatch_leadimportstaging'),
        ('crm', '0008_crmpurpose'),
        ('crm', '0012_callercalllog'),
    ]

    operations = [
    ]
