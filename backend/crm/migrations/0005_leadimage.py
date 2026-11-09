import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0004_industry_and_lead_industry'),
    ]

    operations = [
        migrations.CreateModel(
            name='LeadImage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('image', models.ImageField(upload_to='crm/leads/images/')),
                ('image_name', models.CharField(blank=True, max_length=255, null=True)),
                ('image_size', models.BigIntegerField(blank=True, null=True)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('lead', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='images', to='crm.lead')),
            ],
            options={
                'verbose_name': 'Lead Image',
                'verbose_name_plural': 'Lead Images',
                'ordering': ['-uploaded_at'],
            },
        ),
    ]
