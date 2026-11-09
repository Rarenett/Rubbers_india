from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Company
from .branding_sync import sync_company_branding


@receiver(post_save, sender=Company)
def company_post_save_sync_branding(sender, instance, **kwargs):
    """
    Automatically synchronize branding into frontend static files whenever Company model is saved.
    """
    try:
        sync_company_branding(instance)
    except Exception as e:
        print(f"[signals] Failed to sync company branding on save: {e}")
