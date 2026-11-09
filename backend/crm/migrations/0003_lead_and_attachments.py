from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings

class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0002_leadcategory'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Lead',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('other_owner_name', models.CharField(blank=True, help_text='Name of the person if not an employee', max_length=255, null=True)),
                ('company', models.CharField(blank=True, max_length=255, null=True)),
                ('first_name', models.CharField(blank=True, max_length=255, null=True)),
                ('last_name', models.CharField(blank=True, max_length=255, null=True)),
                ('title', models.CharField(blank=True, max_length=255, null=True)),
                ('email', models.EmailField(blank=True, max_length=254, null=True)),
                ('phone', models.CharField(max_length=50)),
                ('fax', models.CharField(blank=True, max_length=50, null=True)),
                ('mobile', models.CharField(blank=True, max_length=50, null=True)),
                ('website', models.URLField(blank=True, max_length=255, null=True)),
                ('lead_status', models.CharField(blank=True, default='Not Contacted', max_length=100, null=True)),
                ('industry', models.CharField(blank=True, max_length=100, null=True)),
                ('no_of_employees', models.IntegerField(blank=True, null=True)),
                ('annual_revenue', models.DecimalField(blank=True, decimal_places=2, max_digits=15, null=True)),
                ('rating', models.CharField(blank=True, max_length=100, null=True)),
                ('email_opt_out', models.BooleanField(default=False)),
                ('skype_id', models.CharField(blank=True, max_length=100, null=True)),
                ('secondary_email', models.EmailField(blank=True, max_length=254, null=True)),
                ('twitter', models.CharField(blank=True, max_length=100, null=True)),
                ('contact_preferences', models.CharField(blank=True, help_text='Comma-separated: Phone, WhatsApp, Email', max_length=255, null=True)),
                ('country', models.CharField(blank=True, max_length=100, null=True)),
                ('flat_house_no', models.CharField(blank=True, max_length=255, null=True)),
                ('street_address', models.CharField(blank=True, max_length=255, null=True)),
                ('city', models.CharField(blank=True, max_length=100, null=True)),
                ('state_province', models.CharField(blank=True, max_length=100, null=True)),
                ('zip_postal_code', models.CharField(blank=True, max_length=20, null=True)),
                ('latitude', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('longitude', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('image', models.ImageField(blank=True, null=True, upload_to='crm/leads/profile_pics/')),
                ('has_product_interest', models.BooleanField(default=False)),
                ('has_service_interest', models.BooleanField(default=False)),
                ('estimated_value', models.DecimalField(blank=True, decimal_places=2, max_digits=15, null=True)),
                ('priority', models.CharField(blank=True, default='Medium', max_length=50, null=True)),
                ('expected_closing_date', models.DateField(blank=True, null=True)),
                ('assigned_sales_employees', models.TextField(blank=True, help_text='Assigned sales employees text field', null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('category', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='crm_leads', to='crm.leadcategory')),
                ('lead_owner', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='crm_new_leads', to=settings.AUTH_USER_MODEL)),
                ('lead_source', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='crm_leads', to='crm.leadsource')),
                ('products', models.ManyToManyField(blank=True, related_name='crm_leads', to='inventory_app.stockitem')),
                ('services', models.ManyToManyField(blank=True, related_name='crm_leads', to='crm.crmservice')),
            ],
            options={
                'verbose_name': 'Lead',
                'verbose_name_plural': 'Leads',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='LeadAttachment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(upload_to='crm/leads/attachments/')),
                ('file_name', models.CharField(blank=True, max_length=255, null=True)),
                ('file_size', models.BigIntegerField(blank=True, null=True)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('lead', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attachments', to='crm.lead')),
            ],
            options={
                'ordering': ['-uploaded_at'],
            },
        ),
    ]
