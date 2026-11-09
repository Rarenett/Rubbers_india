from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('crm_app', '0003_leadsource_alter_lead_lead_source'),
    ]

    operations = [
        migrations.AddField(
            model_name='lead',
            name='attachment',
            field=models.FileField(blank=True, null=True, upload_to='leads/attachments/'),
        ),
    ]
