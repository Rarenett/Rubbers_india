import os

with open('backend/crm/models.py', encoding='utf-8') as f:
    content = f.read()

if 'class TelecallingTeam' not in content:
    with open('backend/crm/models.py', 'a', encoding='utf-8') as f:
        f.write('''\n
class TelecallingTeam(models.Model):
    name = models.CharField(max_length=255)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='crm_telecalling_teams')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'crm_telecalling_team'

    def __str__(self):
        return self.name

class TelecallingLeadAssignment(models.Model):
    team = models.ForeignKey(TelecallingTeam, on_delete=models.CASCADE, related_name='lead_assignments')
    lead_id = models.IntegerField()
    lead_source = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'crm_telecalling_lead_assignment'
        unique_together = ('team', 'lead_id', 'lead_source')

    def __str__(self):
        return f"Team {self.team.name} - Lead {self.lead_id} ({self.lead_source})"
''')
    print('Models added')
else:
    print('Models already exist')
