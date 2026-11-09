from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth.hashers import make_password
import secrets
import string

from register_app.models import CustomUser
from .models import Candidate, Employee


def generate_random_password(length=12):
    """Generate a secure random password"""
    alphabet = string.ascii_letters + string.digits + string.punctuation
    password = ''.join(secrets.choice(alphabet) for i in range(length))
    return password


@receiver(pre_save, sender=Candidate)
def handle_candidate_selection(sender, instance, **kwargs):
    """
    Signal handler that triggers when a Candidate status changes to 'Selected'.
    Automatically creates a CustomUser and Employee record,then sends a welcome email.
    """
    # Check if this is an update (not a new record)
    if instance.pk:
        try:
            old_instance = Candidate.objects.get(pk=instance.pk)
            old_status = old_instance.status
            new_status = instance.status
            
            # Only proceed if status changed from something else to 'Selected'
            if old_status != 'Selected' and new_status == 'Selected':
                # Check if user already exists with this email
                if CustomUser.objects.filter(email=instance.email).exists():
                    print(f"User with email {instance.email} already exists. Skipping user creation.")
                    return
                
                # Generate a random password
                random_password = generate_random_password()
                
                # Create CustomUser
                user = CustomUser.objects.create(
                    name=instance.full_name,
                    email=instance.email,
                    is_active=True,
                    is_staff=False
                )
                user.set_password(random_password)
                user.save()
                
                print(f"Created CustomUser: {user.email}")
                
                # Create Employee record
                employee = Employee.objects.create(
                    user=user,
                    candidate=instance,
                    phone=instance.phone if instance.phone else '',
                    qualifications=instance.qualification if instance.qualification else '',
                    created_by=instance.created_by
                )
                
                print(f"Created Employee record for: {employee.user.name}")   
                
                # Send welcome email
                try:
                    subject = 'Congratulations! You have been selected'
                    message = f"""
Dear {instance.full_name},

Congratulations! We are pleased to inform you that you have been selected for the position of {instance.position_applied}.

Your account has been created with the following credentials:

Email: {instance.email}
Temporary Password: {random_password}

Please login and change your password at your earliest convenience.

We look forward to having you on our team!

Best regards,
HR Department
                    """
                    
                    email_from = settings.DEFAULT_FROM_EMAIL if hasattr(settings, 'DEFAULT_FROM_EMAIL') else settings.EMAIL_HOST_USER
                    
                    send_mail(
                        subject=subject,
                        message=message,
                        from_email=email_from,
                        recipient_list=[instance.email],
                        fail_silently=False,
                    )
                    
                    print(f"Welcome email sent to: {instance.email}")
                    
                except Exception as e:
                    print(f"Failed to send email to {instance.email}: {str(e)}")
                    # Don't fail the entire operation if email fails
                    
        except Candidate.DoesNotExist:
            # This is a new candidate, do nothing
            pass
        except Exception as e:
            print(f"Error in candidate selection signal: {str(e)}")
            raise
