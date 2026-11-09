from django.db import models
from django.conf import settings

class Task(models.Model):
    PRIORITY_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High'),
        ('Critical', 'Critical'),
    ]

    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
        ('Incomplete', 'Incomplete'),
        ('Cancelled', 'Cancelled'),
    ]

    # Use a string or settings.AUTH_USER_MODEL depending on Glenda's structure. 
    # Usually 'auth.User' or settings.AUTH_USER_MODEL.
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tasks')
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tasks')
    department = models.ForeignKey('rarenett_app.Department', on_delete=models.SET_NULL, null=True, blank=True)
    
    taskName = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    completionNotes = models.TextField(blank=True, null=True)
    
    plannedDate = models.DateField()
    plannedStartTime = models.TimeField()
    expectedHours = models.IntegerField(default=0)
    expectedMinutes = models.IntegerField(default=0)

    expectedDuration = models.CharField(max_length=50, blank=True, null=True) # e.g. "2h 30m"
    deadline = models.DateTimeField(blank=True, null=True)
    
    allowPostpone = models.BooleanField(default=False)
    maxPostponeDays = models.IntegerField(default=0)
    postponedDaysUsed = models.IntegerField(default=0)
    
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='Medium')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    
    reminderSystem = models.CharField(max_length=50, default='Duration Based')
    firstReminderMinutes = models.IntegerField(default=30)
    secondReminderMinutes = models.IntegerField(default=15)
    thirdReminderMinutes = models.IntegerField(null=True, blank=True)
    fourthReminderMinutes = models.IntegerField(null=True, blank=True)
    fifthReminderMinutes = models.IntegerField(null=True, blank=True)
    
    # State tracking
    startedAt = models.DateTimeField(blank=True, null=True)
    completedAt = models.DateTimeField(blank=True, null=True)
    createdAt = models.DateTimeField(auto_now_add=True)
    updatedAt = models.DateTimeField(auto_now=True)
    deletedAt = models.DateTimeField(blank=True, null=True) # Soft delete
    
    # Reminder trigger states to avoid duplicates
    firstReminderTriggered = models.BooleanField(default=False)
    secondReminderTriggered = models.BooleanField(default=False)
    thirdReminderTriggered = models.BooleanField(default=False)
    fourthReminderTriggered = models.BooleanField(default=False)
    fifthReminderTriggered = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.taskName} - {self.status}"

class WebPushSubscription(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='push_subscriptions', db_constraint=False)
    endpoint = models.URLField(max_length=1000)
    auth = models.CharField(max_length=255)
    p256dh = models.CharField(max_length=255)
    createdAt = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'endpoint')

    def __str__(self):
        return f"Push Sub for {self.user.username}"
