from rest_framework import serializers
from .models import LeadSource, CrmService, LeadCategory, Industry, Lead, LeadAttachment, LeadImage, CrmPurpose, CrmOffer

class CrmOfferSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)

    class Meta:
        model = CrmOffer
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by_name', 'category_name']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def validate_code(self, value):
        if not value or not str(value).strip():
            return None
        return str(value).strip().upper()

    def validate(self, attrs):
        start_date = attrs.get('start_date') or (self.instance.start_date if self.instance else None)
        end_date = attrs.get('end_date') or (self.instance.end_date if self.instance else None)
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({'end_date': 'End date cannot be earlier than start date.'})
        return attrs

class CrmPurposeSerializer(serializers.ModelSerializer):
    followup_count = serializers.SerializerMethodField()
    usage_count = serializers.SerializerMethodField()

    class Meta:
        model = CrmPurpose
        fields = ['id', 'name', 'description', 'is_active', 'created_at', 'updated_at', 'followup_count', 'usage_count']
        read_only_fields = ['id', 'created_at', 'updated_at', 'followup_count', 'usage_count']

    def get_followup_count(self, obj):
        from .models import CrmLeadFollowUp
        return CrmLeadFollowUp.objects.filter(purpose__iexact=obj.name).count()

    def get_usage_count(self, obj):
        return self.get_followup_count(obj)


class LeadSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadSource
        fields = '__all__'

class CrmServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrmService
        fields = '__all__'

class LeadCategorySerializer(serializers.ModelSerializer):
    lead_count = serializers.SerializerMethodField()

    class Meta:
        model = LeadCategory
        fields = ['id', 'name', 'description', 'is_active', 'created_at', 'updated_at', 'lead_count']

    def get_lead_count(self, obj):
        return obj.crm_leads.count()

class IndustrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Industry
        fields = '__all__'


class LeadAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadAttachment
        fields = ['id', 'file', 'file_name', 'file_size', 'uploaded_at']


class LeadImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadImage
        fields = ['id', 'image', 'image_name', 'image_size', 'uploaded_at']


class StockItemMiniSerializer(serializers.ModelSerializer):
    stock_item_name = serializers.CharField(source='name', read_only=True)

    class Meta:
        from inventory_app.models import StockItem
        model = StockItem
        fields = ['id', 'name', 'stock_item_name']


class CrmServiceMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrmService
        fields = ['id', 'name', 'description']


class LeadSerializer(serializers.ModelSerializer):
    lead_owner_name = serializers.SerializerMethodField(read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_detail = serializers.SerializerMethodField(read_only=True)
    lead_source_name = serializers.CharField(source='lead_source.name', read_only=True)
    industry_name = serializers.CharField(source='industry.name', read_only=True)
    attachments = LeadAttachmentSerializer(many=True, read_only=True)
    images = LeadImageSerializer(many=True, read_only=True)
    products_details = StockItemMiniSerializer(source='products', many=True, read_only=True)
    services_details = CrmServiceMiniSerializer(source='services', many=True, read_only=True)

    class Meta:
        from .models import Lead
        model = Lead
        fields = '__all__'

    def get_category_detail(self, obj):
        if obj.category:
            return {'id': obj.category.id, 'name': obj.category.name}
        return None

    def get_lead_owner_name(self, obj):
        if obj.lead_owner:
            full_name = f"{obj.lead_owner.first_name} {obj.lead_owner.last_name}".strip()
            return full_name or obj.lead_owner.username
        return obj.other_owner_name or '—'

class CrmLeadFollowUpSerializer(serializers.ModelSerializer):
    lead_name = serializers.CharField(source='lead.shop_name', read_only=True)
    lead_mobile = serializers.CharField(source='lead.mobile_number', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        from .models import CrmLeadFollowUp
        model = CrmLeadFollowUp
        fields = '__all__'


class LeadImportStagingSerializer(serializers.ModelSerializer):
    is_existing = serializers.SerializerMethodField()
    is_valid = serializers.SerializerMethodField()
    errors = serializers.ListField(source='error_messages', read_only=True)

    class Meta:
        from .models import LeadImportStaging
        model = LeadImportStaging
        fields = '__all__'

    def get_is_existing(self, obj):
        return obj.existing_lead_id is not None

    def get_is_valid(self, obj):
        return obj.validation_status == 'VALID'


class LeadImportBatchSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    rows = LeadImportStagingSerializer(many=True, read_only=True)

    class Meta:
        from .models import LeadImportBatch
        model = LeadImportBatch
        fields = '__all__'

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            full_name = f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip()
            return full_name or obj.uploaded_by.username
        return 'System'


class LeadImportBatchListSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        from .models import LeadImportBatch
        model = LeadImportBatch
        fields = ['id', 'file_name', 'status', 'total_rows', 'valid_rows', 'invalid_rows', 'created_at', 'pushed_at', 'uploaded_by', 'uploaded_by_name']

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            full_name = f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip()
            return full_name or obj.uploaded_by.username
        return 'System'
class CrmTelecallingSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import CrmTelecalling
        model = CrmTelecalling
        fields = '__all__'

    def validate(self, data):
        team_leader = data.get('team_leader')
        if team_leader:
            if not hasattr(team_leader, 'employee') or not team_leader.employee.dept_designation or team_leader.employee.dept_designation.department.name.lower() != 'telecalling':
                raise serializers.ValidationError({'team_leader': 'Team leader must belong to the Telecalling department.'})
        return data
    
    def validate_members(self, value):
        for member in value:
            if not hasattr(member, 'employee') or not member.employee.dept_designation or member.employee.dept_designation.department.name.lower() != 'telecalling':
                raise serializers.ValidationError(f'Member {member.username} must belong to the Telecalling department.')
        return value


from .models import TelecallingTeam, TelecallingLeadAssignment

class TelecallingLeadAssignmentSerializer(serializers.ModelSerializer):
    lead_details = serializers.SerializerMethodField()
    employee_detail = serializers.SerializerMethodField()
    assigned_by_detail = serializers.SerializerMethodField()
    assigned_caller_detail = serializers.SerializerMethodField()

    class Meta:
        model = TelecallingLeadAssignment
        fields = '__all__'

    def get_assigned_by_detail(self, obj):
        if not obj.assigned_by:
            return None
        return {
            'id': obj.assigned_by.id,
            'full_name': f"{obj.assigned_by.first_name} {obj.assigned_by.last_name}".strip() or getattr(obj.assigned_by, 'name', '') or obj.assigned_by.username,
            'username': obj.assigned_by.username,
            'email': obj.assigned_by.email
        }

    def get_assigned_caller_detail(self, obj):
        if not obj.assigned_caller:
            return None
        return {
            'id': obj.assigned_caller.id,
            'full_name': f"{obj.assigned_caller.first_name} {obj.assigned_caller.last_name}".strip() or getattr(obj.assigned_caller, 'name', '') or obj.assigned_caller.username,
            'username': obj.assigned_caller.username,
            'email': obj.assigned_caller.email
        }

    def get_employee_detail(self, obj):
        if not obj.employee:
            return None
        return {
            'id': obj.employee.id,
            'full_name': f"{obj.employee.first_name} {obj.employee.last_name}".strip() or obj.employee.username,
            'username': obj.employee.username,
            'email': obj.employee.email
        }

    def get_lead_details(self, obj):
        try:
            from crm.models import Lead
            lead = Lead.objects.get(id=obj.lead_id)
            return {
                'id': lead.id,
                'company': lead.company or '',
                'first_name': lead.first_name or '',
                'last_name': lead.last_name or '',
                'category_detail': {
                    'name': (lead.category.name if lead.category else None) or obj.lead_source or 'Direct'
                }
            }
        except Exception:
            return None

class TelecallingTeamSerializer(serializers.ModelSerializer):
    lead_assignments = serializers.SerializerMethodField()
    members_detail = serializers.SerializerMethodField()
    team_leader_detail = serializers.SerializerMethodField()
    closing_date = serializers.SerializerMethodField()

    class Meta:
        model = TelecallingTeam
        fields = '__all__'

    def get_lead_assignments(self, obj):
        from .models import Lead
        valid_lead_ids = set(Lead.objects.values_list('id', flat=True))
        assignments = obj.lead_assignments.filter(lead_id__in=valid_lead_ids)
        return TelecallingLeadAssignmentSerializer(assignments, many=True).data

    def get_closing_date(self, obj):
        first_assignment = obj.lead_assignments.exclude(closing_date__isnull=True).first()
        if first_assignment and first_assignment.closing_date:
            return str(first_assignment.closing_date)
        return None

    def get_members_detail(self, obj):
        return [
            {
                'id': m.id,
                'full_name': f"{m.first_name} {m.last_name}".strip() or m.username,
                'username': m.username,
                'email': m.email
            }
            for m in obj.members.all()
        ]

    def get_team_leader_detail(self, obj):
        if obj.team_leader:
            return {
                'id': obj.team_leader.id,
                'full_name': f"{obj.team_leader.first_name} {obj.team_leader.last_name}".strip() or obj.team_leader.username,
                'username': obj.team_leader.username,
                'email': obj.team_leader.email
            }
        return None


from .models import CallerCallLog

class CallerCallLogSerializer(serializers.ModelSerializer):
    caller_name = serializers.SerializerMethodField()
    duration_display = serializers.SerializerMethodField()

    class Meta:
        model = CallerCallLog
        fields = '__all__'

    def get_caller_name(self, obj):
        if obj.caller:
            full_name = f"{obj.caller.first_name} {obj.caller.last_name}".strip()
            return full_name or getattr(obj.caller, 'name', '') or obj.caller.username
        return 'Unknown'

    def get_duration_display(self, obj):
        if obj.duration_seconds is None:
            return None
        mins = obj.duration_seconds // 60
        secs = obj.duration_seconds % 60
        return f"{mins}m {secs}s"


from .models import OpportunityAccount

class OpportunityAccountSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = OpportunityAccount
        fields = '__all__'

    def get_created_by_name(self, obj):
        if obj.created_by:
            full_name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return full_name or getattr(obj.created_by, 'name', '') or obj.created_by.username
        return 'System'


from .models import OpportunityApproval

class OpportunityApprovalSerializer(serializers.ModelSerializer):
    lead_name = serializers.SerializerMethodField()
    company = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    city = serializers.SerializerMethodField()
    state = serializers.SerializerMethodField()
    converted_by_name = serializers.SerializerMethodField()
    converted_at = serializers.SerializerMethodField()
    submitted_by_name = serializers.SerializerMethodField()
    action_by_name = serializers.SerializerMethodField()
    has_account = serializers.SerializerMethodField()
    opportunity_account_id = serializers.SerializerMethodField()

    class Meta:
        model = OpportunityApproval
        fields = '__all__'

    def get_lead_name(self, obj):
        if obj.lead:
            name = f"{obj.lead.first_name or ''} {obj.lead.last_name or ''}".strip()
            return obj.lead.company or name or f"Lead #{obj.lead_id}"
        if obj.opportunity_account:
            return obj.opportunity_account.name or f"Opportunity #{obj.opportunity_account_id}"
        return f"Lead #{obj.lead_id}" if obj.lead_id else "Opportunity"

    def get_company(self, obj):
        if obj.lead and obj.lead.company:
            return obj.lead.company
        if obj.opportunity_account and obj.opportunity_account.name:
            return obj.opportunity_account.name
        return ''

    def get_phone(self, obj):
        if obj.lead:
            return (obj.lead.phone or obj.lead.mobile or '')
        if obj.opportunity_account:
            return obj.opportunity_account.phone or ''
        return ''

    def get_email(self, obj):
        if obj.lead:
            return (obj.lead.email or '')
        if obj.opportunity_account:
            return obj.opportunity_account.email or ''
        return ''

    def get_city(self, obj):
        if obj.lead:
            return (obj.lead.city or '')
        if obj.opportunity_account:
            return obj.opportunity_account.city or ''
        return ''

    def get_state(self, obj):
        if obj.lead:
            return (obj.lead.state_province or '')
        if obj.opportunity_account:
            return obj.opportunity_account.state or obj.opportunity_account.placeofsupply or ''
        return ''

    def get_converted_by_name(self, obj):
        from .models import CallerCallLog
        log = None
        if obj.assignment_id:
            log = CallerCallLog.objects.filter(
                assignment_id=obj.assignment_id,
                call_outcome__in=['Converted', 'Converted to Opportunity']
            ).select_related('caller').order_by('-called_at').first()
        elif obj.lead_id:
            log = CallerCallLog.objects.filter(
                assignment__lead_id=obj.lead_id,
                call_outcome__in=['Converted', 'Converted to Opportunity']
            ).select_related('caller').order_by('-called_at').first()
        if log and log.caller:
            return f"{log.caller.first_name} {log.caller.last_name}".strip() or log.caller.username
        return '—'

    def get_converted_at(self, obj):
        from .models import CallerCallLog
        log = None
        if obj.assignment_id:
            log = CallerCallLog.objects.filter(
                assignment_id=obj.assignment_id,
                call_outcome__in=['Converted', 'Converted to Opportunity']
            ).order_by('-called_at').first()
        elif obj.lead_id:
            log = CallerCallLog.objects.filter(
                assignment__lead_id=obj.lead_id,
                call_outcome__in=['Converted', 'Converted to Opportunity']
            ).order_by('-called_at').first()
        return log.called_at.isoformat() if (log and log.called_at) else None

    def get_submitted_by_name(self, obj):
        if obj.submitted_by:
            return f"{obj.submitted_by.first_name} {obj.submitted_by.last_name}".strip() or obj.submitted_by.username
        return 'System'

    def get_action_by_name(self, obj):
        if obj.action_by:
            return f"{obj.action_by.first_name} {obj.action_by.last_name}".strip() or obj.action_by.username
        return None

    def get_has_account(self, obj):
        return bool(obj.opportunity_account_id)

    def get_opportunity_account_id(self, obj):
        return obj.opportunity_account_id

