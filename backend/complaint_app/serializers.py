from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import ComplaintCategory, Complaint, ComplaintUpdate, Pattern, CommentAction, PriorityRule

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'first_name', 'last_name', 'email')

class PriorityRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriorityRule
        fields = '__all__'

class PatternSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.category_name')

    class Meta:
        model = Pattern
        fields = '__all__'


class ComplaintCategorySerializer(serializers.ModelSerializer):

    class Meta:
        model = ComplaintCategory
        fields = '__all__'

class ComplaintUpdateSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)

    class Meta:
        model = ComplaintUpdate
        fields = '__all__'
        read_only_fields = ('user',)

class CommentActionSerializer(serializers.ModelSerializer):
    created_by_details = UserSerializer(source='created_by', read_only=True)
    complaint_title = serializers.ReadOnlyField(source='complaint_post.title')
    complaint_id_display = serializers.ReadOnlyField(source='complaint_post.id')
    pattern_no = serializers.ReadOnlyField(source='complaint_post.pattern.pattern_no')
    pattern_head = serializers.ReadOnlyField(source='complaint_post.pattern.pattern_head')
    designations = serializers.SerializerMethodField()

    class Meta:
        model = CommentAction
        fields = '__all__'
        read_only_fields = ('created_by',)

    def get_designations(self, obj):
        return [d.name for d in obj.designations_list if d.name]

class ComplaintSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    category_name = serializers.ReadOnlyField(source='category.category_name')
    pattern_name = serializers.ReadOnlyField(source='pattern.pattern_head')
    assigned_to_details = UserSerializer(source='assigned_to', read_only=True)
    can_respond = serializers.SerializerMethodField()
    is_evaluator = serializers.SerializerMethodField()
    evaluator_name = serializers.SerializerMethodField()
    updates = ComplaintUpdateSerializer(many=True, read_only=True)
    actions = CommentActionSerializer(many=True, read_only=True)

    class Meta:
        model = Complaint
        fields = [
            'id', 'title', 'description', 'category', 'category_name',
            'pattern', 'pattern_name',
            'priority', 'status', 'attachment', 'assigned_to',
            'assigned_to_details', 'user', 'user_details', 'created_at',
            'updated_at', 'updates', 'can_respond', 'is_evaluator', 'evaluator_name',
            'positive_feedback', 'negative_feedback', 'decision_type',
            'responder_remarks', 'responder_attachment', 'admin_decision', 'admin_remarks', 'actions',
            'cutoff_date'
        ]
        read_only_fields = ('user', 'status', 'assigned_to')

    def get_evaluator_name(self, obj):
        if obj.pattern and obj.pattern.decision_makers.exists():
            names = []
            for dm in obj.pattern.decision_makers.all():
                if dm.user:
                    full_name = dm.user.get_full_name().strip()
                    names.append(full_name or dm.user.username or dm.user.email)
                elif dm.candidate:
                    names.append(dm.candidate.full_name)
                else:
                    names.append(str(dm))
            if names:
                return ", ".join(names)
        if obj.admin_decision and obj.admin_decision != 'Pending':
            admin_update = obj.updates.filter(remark__startswith="Admin Final Decision:").select_related('user').first()
            if admin_update and admin_update.user:
                full_name = admin_update.user.get_full_name().strip()
                return full_name or admin_update.user.username or admin_update.user.email
        return "—"

    def get_is_evaluator(self, obj):
        user = self.context['request'].user
        if user.is_superuser:
            return True
        employee = getattr(user, 'employee', None)
        if employee and obj.pattern:
            return obj.pattern.decision_makers.filter(id=employee.id).exists()
        return False

    def get_can_respond(self, obj):
        user = self.context['request'].user
        
        if obj.user == user:
            return False

        employee = getattr(user, 'employee', None)
        # Predefined final evaluators evaluate AFTER the first person votes;
        # they should not be treated as the primary responder unless explicitly listed in pattern.employees
        if employee and obj.pattern and obj.pattern.decision_makers.filter(id=employee.id).exists():
            if not obj.pattern.employees.filter(id=employee.id).exists():
                return False

        if user.is_superuser or user.is_staff:
            return True
        
        if obj.assigned_to == user:
            return True
            
        if employee and obj.pattern:
            # Check pattern (logic duplicated from get_queryset but for single object)
            pattern = obj.pattern
            dept = employee.dept_designation.department if employee.dept_designation else None
            desig = employee.dept_designation.designation if employee.dept_designation else None
            
            if pattern.employees.filter(id=employee.id).exists():
                return True
                
            if dept and desig:
                if (not pattern.departments.exists() or pattern.departments.filter(id=dept.id).exists()) and \
                   (not pattern.designations.exists() or pattern.designations.filter(id=desig.id).exists()):
                    return True
        
        return False

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)
