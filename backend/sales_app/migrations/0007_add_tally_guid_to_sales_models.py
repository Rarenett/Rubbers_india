from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sales_app', '0006_salesreturn_is_synced_salesreturn_sync_status_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='salesorder',
            name='tally_guid',
            field=models.CharField(
                blank=True,
                help_text='Persisted Tally REMOTEID/GUID from the first successful Create push. Never overwritten — reused for all future Alter pushes.',
                max_length=128,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='salesinvoice',
            name='tally_guid',
            field=models.CharField(
                blank=True,
                help_text='Persisted Tally REMOTEID/GUID from the first successful Create push. Never overwritten — reused for all future Alter pushes.',
                max_length=128,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='salesreturn',
            name='tally_guid',
            field=models.CharField(
                blank=True,
                help_text='Persisted Tally REMOTEID/GUID from the first successful Create push. Never overwritten — reused for all future Alter pushes.',
                max_length=128,
                null=True,
            ),
        ),
    ]
