from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Email, EmailRecipient, Attachment

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name'] # Using email as username

class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = ['id', 'file', 'uploaded_at']

class EmailRecipientSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = EmailRecipient
        fields = ['user', 'is_read', 'is_starred', 'recipient_type']

class EmailSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    recipients_details = serializers.SerializerMethodField()
    attachments = AttachmentSerializer(many=True, read_only=True)
    recipients = serializers.PrimaryKeyRelatedField(
        many=True, 
        queryset=User.objects.all(), 
        write_only=True,
        required=False
    )
    is_read = serializers.SerializerMethodField()
    is_starred = serializers.SerializerMethodField()
    label = serializers.SerializerMethodField() # To tell FE if it is Inbox or Sent

    class Meta:
        model = Email
        fields = [
            'id', 'sender', 'subject', 'body', 'created_at', 
            'recipients', 'recipients_details', 'attachments',
            'is_read', 'is_starred', 'label', 'recipient_emails', 'files'
        ]

    recipient_emails = serializers.ListField(
        child=serializers.EmailField(), write_only=True, required=False
    )
    files = serializers.ListField(
        child=serializers.FileField(), write_only=True, required=False
    )

    def get_recipients_details(self, obj):
        # Return list of recipients for this email
        recipients = EmailRecipient.objects.filter(email=obj)
        return EmailRecipientSerializer(recipients, many=True).data

    def get_is_read(self, obj):
        user = self.context.get('request').user
        if obj.sender == user:
            return True # Sender always read their own sent mail
        try:
            recipient = EmailRecipient.objects.get(email=obj, user=user)
            return recipient.is_read
        except EmailRecipient.DoesNotExist:
            return False

    def get_is_starred(self, obj):
        user = self.context.get('request').user
        if obj.sender == user:
            return obj.sender_starred  # Return sender's starred status
        try:
            recipient = EmailRecipient.objects.get(email=obj, user=user)
            return recipient.is_starred
        except EmailRecipient.DoesNotExist:
            return False
            
    def get_label(self, obj):
        user = self.context.get('request').user
        if obj.sender == user:
            return 'sent'
        return 'inbox'

    def create(self, validated_data):
        recipient_emails = validated_data.pop('recipient_emails', [])
        recipients_data = validated_data.pop('recipients', [])
        files = validated_data.pop('files', [])
        
        print(f"DEBUG: create email called. recipient_emails={recipient_emails}")

        # Resolve emails to users
        for email_str in recipient_emails:
            try:
                # Case-insensitive lookup
                user = User.objects.get(email__iexact=email_str)
                recipients_data.append(user)
                print(f"DEBUG: Found user {user} for email {email_str}")
            except User.DoesNotExist:
                print(f"DEBUG: User not found for email {email_str}")
                pass # Ignore invalid emails for now or raise error

        sender = self.context['request'].user
        email = Email.objects.create(sender=sender, **validated_data)
        
        # Create attachments
        for file in files:
            Attachment.objects.create(email=email, file=file)

        # Deduplicate
        unique_recipients = set(recipients_data)
        print(f"DEBUG: Creating recipients for: {unique_recipients}")
        
        for user in unique_recipients:
            EmailRecipient.objects.create(email=email, user=user, recipient_type='to')
            
        return email
