from rest_framework import serializers
from .models import DistributionZone, Lead, LeadCategory, TeleCallingProject, LeadAssignment, LeadInteractionLog, CallSession
from django.contrib.auth import get_user_model

User = get_user_model()

class UserMiniSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'full_name']

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username

class LeadCategorySerializer(serializers.ModelSerializer):
    lead_count = serializers.SerializerMethodField()

    class Meta:
        model = LeadCategory
        fields = ['id', 'name', 'description', 'lead_count']

    def get_lead_count(self, obj):
        count = obj.leads.count()
        try:
            from crm.models import Lead as CrmLead, LeadCategory as CrmLeadCategory
            crm_cat = CrmLeadCategory.objects.filter(name__iexact=obj.name).first()
            if crm_cat:
                count += CrmLead.objects.filter(category=crm_cat).count()
            else:
                count += CrmLead.objects.filter(category_id=obj.id).count()
        except Exception:
            pass
        return count

class LeadSerializer(serializers.ModelSerializer):
    lead_owner_name = serializers.SerializerMethodField(read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_detail = serializers.SerializerMethodField(read_only=True)
    created_by_detail = serializers.SerializerMethodField(read_only=True)
    lead_source = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True)

    is_allocated = serializers.SerializerMethodField()
    latest_log = serializers.SerializerMethodField(read_only=True)
    next_followup = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Lead
        fields = [
            'id', 'lead_owner', 'lead_owner_name', 'created_by_detail', 'category', 'category_name', 'category_detail',
            'company', 'first_name', 'last_name', 'title', 'email', 'phone',
            'fax', 'mobile', 'website', 'lead_source', 'lead_status',
            'industry', 'no_of_employees', 'annual_revenue', 'rating',
            'email_opt_out', 'skype_id', 'secondary_email', 'twitter',
            'country', 'flat_house_no', 'street_address', 'city',
            'state_province', 'zip_postal_code', 'latitude', 'longitude',
            'description', 'image', 'attachment', 'created_at', 'updated_at',
            'latest_log', 'next_followup', 'contact_preferences', 'is_allocated'
        ]

    def get_category_detail(self, obj):
        if obj.category:
            return {'id': obj.category.id, 'name': obj.category.name}
        return None

    def get_created_by_detail(self, obj):
        if obj.lead_owner:
            first = obj.lead_owner.first_name if obj.lead_owner.first_name else ''
            last = obj.lead_owner.last_name if obj.lead_owner.last_name else ''
            full_name = f"{first} {last}".strip()
            return {'id': obj.lead_owner.id, 'full_name': full_name or obj.lead_owner.username}
        return None

    def get_is_allocated(self, obj):
        # A lead is allocated if it has any assignment records
        return obj.assignments.exists()

    def get_lead_owner_name(self, obj):
        if obj.lead_owner:
            first = obj.lead_owner.first_name if obj.lead_owner.first_name else ''
            last = obj.lead_owner.last_name if obj.lead_owner.last_name else ''
            full_name = f"{first} {last}".strip()
            return full_name if full_name else obj.lead_owner.username
        return None

    def get_latest_log(self, obj):
        # Get the most recent log for any assignment of this lead
        log = LeadInteractionLog.objects.filter(assignment__lead=obj).order_by('-created_at').first()
        if log:
            return LeadInteractionLogSerializer(log).data
        return None

    def get_next_followup(self, obj):
        # Get the next call date from the latest interaction or the assignment target time
        log = LeadInteractionLog.objects.filter(assignment__lead=obj, next_call_date__isnull=False).order_by('-created_at').first()
        if log:
            return log.next_call_date
        
        assignment = LeadAssignment.objects.filter(lead=obj, target_time__isnull=False).order_by('-updated_at').first()
        if assignment:
            return assignment.target_time
        return None

class TeleCallingProjectSerializer(serializers.ModelSerializer):
    category_detail = LeadCategorySerializer(source='category', read_only=True)
    team_leader_detail = UserMiniSerializer(source='team_leader', read_only=True)
    members_detail = UserMiniSerializer(source='members', many=True, read_only=True)
    assignments_count = serializers.SerializerMethodField()
    allocated_count = serializers.SerializerMethodField()
    last_allocated_at = serializers.SerializerMethodField()
    completions_count = serializers.SerializerMethodField()
    progress_percentage = serializers.SerializerMethodField()

    class Meta:
        model = TeleCallingProject
        fields = '__all__'

    def get_assignments_count(self, obj):
        return obj.lead_assignments.count()

    def get_allocated_count(self, obj):
        return obj.lead_assignments.filter(assignee__isnull=False).count()

    def get_last_allocated_at(self, obj):
        # Get the latest updated_at from assignments that have an assignee
        last_asgn = obj.lead_assignments.filter(assignee__isnull=False).order_by('-updated_at').first()
        return last_asgn.updated_at if last_asgn else None

    def get_completions_count(self, obj):
        # Count Opportunity, Disqualified, and Junk as 'processed'
        return obj.lead_assignments.filter(status__in=['Opportunity', 'Disqualified', 'Junk']).count()

    def get_progress_percentage(self, obj):
        total = self.get_assignments_count(obj)
        if total == 0:
            return 0
        done = self.get_completions_count(obj)
        return int((done / total) * 100)

class LeadAssignmentSerializer(serializers.ModelSerializer):
    lead_detail = LeadSerializer(source='lead', read_only=True)
    project_detail = TeleCallingProjectSerializer(source='project', read_only=True)
    assignee_detail = UserMiniSerializer(source='assignee', read_only=True)

    class Meta:
        model = LeadAssignment
        fields = '__all__'

class LeadInteractionLogSerializer(serializers.ModelSerializer):
    user_detail = UserMiniSerializer(source='user', read_only=True)

    class Meta:
        model = LeadInteractionLog
        fields = '__all__'

class CallSessionSerializer(serializers.ModelSerializer):
    caller_detail = UserMiniSerializer(source='caller', read_only=True)

    class Meta:
        model = CallSession
        fields = '__all__'
        read_only_fields = ['caller']


class DistributionZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = DistributionZone
        fields = '__all__'


class DistributorLeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = __import__('crm_app.models', fromlist=['DistributorLead']).DistributorLead
        fields = '__all__'

class VendorLeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = __import__('crm_app.models', fromlist=['VendorLead']).VendorLead
        fields = '__all__'
