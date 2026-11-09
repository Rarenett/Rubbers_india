from urllib import request

from rest_framework import serializers

from rarenett_app.models import BoardOfDirector,Employee,Department
from .models import Subtask, SubtaskAttachment, Task,TaskProgressUpdate, TaskCategory, TaskSubCategory,TaskAttachment,TaskVoteRequest, TaskVoter,TeamMember,Team,TaskAssignment
from django.db.models import Sum
from decimal import Decimal

class TaskCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskCategory
        fields = '__all__'


class TaskSubCategorySerializer(serializers.ModelSerializer):
    # Read-only convenience field so the frontend list can show the parent
    # category's name without a second lookup.
    category_name = serializers.CharField(source='category.category_name', read_only=True)
 
    class Meta:
        model = TaskSubCategory
        fields = [
            'id',
            'category',
            'category_name',
            'subcategory_name',
            'description',
            'is_active',
            'created_at',
        ]
 
    def validate(self, attrs):
        category = attrs.get('category', getattr(self.instance, 'category', None))
        subcategory_name = attrs.get('subcategory_name', getattr(self.instance, 'subcategory_name', None))
 
        if category and subcategory_name:
            qs = TaskSubCategory.objects.filter(
                category=category,
                subcategory_name__iexact=subcategory_name.strip() if subcategory_name else subcategory_name
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"subcategory_name": "This sub-category name already exists under the selected category."}
                )
        return attrs

class TaskSubCategorySerializer(serializers.ModelSerializer):
    # Read-only convenience field so the frontend list can show the parent
    # category's name without a second lookup.
    category_name = serializers.CharField(source='category.category_name', read_only=True)
 
    class Meta:
        model = TaskSubCategory
        fields = [
            'id',
            'category',
            'category_name',
            'subcategory_name',
            'description',
            'is_active',
            'created_at',
        ]
 
    def validate(self, attrs):
        category = attrs.get('category', getattr(self.instance, 'category', None))
        subcategory_name = attrs.get('subcategory_name', getattr(self.instance, 'subcategory_name', None))
 
        if category and subcategory_name:
            qs = TaskSubCategory.objects.filter(
                category=category,
                subcategory_name__iexact=subcategory_name.strip() if subcategory_name else subcategory_name
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"subcategory_name": "This sub-category name already exists under the selected category."}
                )
        return attrs
 
 
class TaskAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskAttachment
        fields = [
            'id',
            'file',
            'original_filename',
            'uploaded_at',
        ]
        read_only_fields = ['id', 'original_filename', 'uploaded_at']
 
 
class TaskSerializer(serializers.ModelSerializer):
    task_type_display = serializers.CharField(source='get_task_type_display', read_only=True)
   
    subcategory_name = serializers.CharField(source='subcategory.subcategory_name', read_only=True)
    category_name = serializers.CharField(source='subcategory.category.category_name', read_only=True)
    
    attachments = TaskAttachmentSerializer(many=True, read_only=True)
 
    completed_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)

    class Meta:
        model = Task
        fields = [
            'id',
            'task_name',
            'task_type',
            'task_type_display',
            'subcategory',
            'subcategory_name',
            'category_name',
            'description',
            'start_date',
            'due_date',
            'attachments',
            'completed_percentage',
            'is_active',
            'created_at',
        ]
        extra_kwargs = {
            'subcategory': {'required': False, 'allow_null': True},
        }
 
    def validate_task_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Task name cannot be empty.")
        return value.strip()

class NullableDateField(serializers.DateField):
    def to_internal_value(self, value):
        if value in ('', None):
            return None
        return super().to_internal_value(value)

class SubtaskAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubtaskAttachment
        fields = ['id', 'file', 'original_filename', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at']

class SubtaskSerializer(serializers.ModelSerializer):
    attachments = SubtaskAttachmentSerializer(many=True, read_only=True)
    task_type_display = serializers.CharField(source='get_task_type_display', read_only=True)
    completed_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    start_date = NullableDateField(required=False, allow_null=True)
    end_date = NullableDateField(required=False, allow_null=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Subtask
        fields = [
            'id', 'task', 'parent_subtask', 'subtask_name', 'task_type', 'task_type_display',
            'description', 'start_date', 'end_date', 'attachments', 'completed_percentage',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']
        extra_kwargs = {
            'task': {'required': False, 'allow_null': True},
            'parent_subtask': {'required': False, 'allow_null': True},
            'start_date': {'required': False, 'allow_null': True},
            'end_date': {'required': False, 'allow_null': True},
        }

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        subtask = Subtask.objects.create(**validated_data)
        files = request.FILES.getlist('attachments') if request else []
        for f in files:
            SubtaskAttachment.objects.create(subtask=subtask, file=f, original_filename=f.name)
        return subtask

    def update(self, instance, validated_data):
        request = self.context.get('request')
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        files = request.FILES.getlist('attachments') if request else []
        for f in files:
            SubtaskAttachment.objects.create(subtask=instance, file=f, original_filename=f.name)
        return instance

class TaskVoterSerializer(serializers.ModelSerializer):
    voter_name = serializers.SerializerMethodField()

    class Meta:
        model = TaskVoter
        fields = ['id', 'bod', 'employee', 'voter_name', 'vote', 'remarks', 'voted_at']

    def get_voter_name(self, obj):
        if obj.bod_id:
            return obj.bod.name
        if obj.employee_id:
            return str(obj.employee)
        return None


class TaskVoteRequestSerializer(serializers.ModelSerializer):
    voters = TaskVoterSerializer(many=True, read_only=True)
    task_name = serializers.CharField(source='task.task_name', read_only=True)
    task_description = serializers.CharField(source='task.description', read_only=True)
    assigned_employee_name = serializers.SerializerMethodField()
    assigned_department_name = serializers.CharField(source='assigned_department.name', read_only=True, default=None)
    created_by_name = serializers.SerializerMethodField()
    is_open = serializers.BooleanField(read_only=True)
    my_vote = serializers.SerializerMethodField()
    my_remarks = serializers.SerializerMethodField()

    result_status = serializers.CharField(read_only=True)
    yes_count = serializers.SerializerMethodField()
    no_count = serializers.SerializerMethodField()
    pending_count = serializers.SerializerMethodField()
    my_assigned_subtasks = serializers.SerializerMethodField()
    team_lead_name = serializers.SerializerMethodField()

    # write-only, used only when creating the request
    bod_ids = serializers.PrimaryKeyRelatedField(queryset=BoardOfDirector.objects.all(), many=True, write_only=True, required=False)
    employee_ids = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all(), many=True, write_only=True, required=False)

    task_type = serializers.CharField(source='task.task_type', read_only=True)
    task_type_display = serializers.CharField(source='task.get_task_type_display', read_only=True)
    task_start_date = serializers.DateField(source='task.start_date', read_only=True)
    task_due_date = serializers.DateField(source='task.due_date', read_only=True)
    task_attachments = TaskAttachmentSerializer(source='task.attachments', many=True, read_only=True)
    completed_percentage = serializers.SerializerMethodField()

    class Meta:
        model = TaskVoteRequest
        fields = [
            'id', 'task', 'task_name', 'task_description',
            'assigned_employee', 'assigned_employee_name', 'assigned_department', 'assigned_department_name',
            'created_by', 'created_by_name', 'team_lead_name',
            'approval_type', 'cutoff_date', 'remarks', 'is_active', 'is_open', 'my_vote', 'my_remarks',
            'result_status', 'yes_count', 'no_count', 'pending_count',
            'created_at', 'voters', 'bod_ids', 'employee_ids', 'task_description',
            'task_type', 'task_type_display', 'task_start_date', 'task_due_date', 'task_attachments',
            'my_assigned_subtasks', 'completed_percentage',
        ]
        read_only_fields = ['created_at']

    def get_completed_percentage(self, obj):
        if not obj.task_id:
            return 0.0
        return float(obj.task.completed_percentage)

    def get_team_lead_name(self, obj):
        if not obj.task_id:
            return None
        team = obj.task.teams.first()
        if team and team.created_by:
            return team.created_by.get_full_name() or team.created_by.username
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_my_assigned_subtasks(self, obj):
        """Returns ONLY the subtask(s) the currently logged-in employee was
        assigned on this task — never the whole task or another person's
        subtask. This is what makes John see 'Identify Missing Information'
        and Aswathy see 'Collect Pending Documents' on the same task."""
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return []
        if not obj.task_id:
            return []
        employee = Employee.objects.filter(user=request.user).first()
        if not employee:
            return []
        assignments = TaskAssignment.objects.filter(task=obj.task, employee=employee).select_related('subtask')
        return [
            {
                'id': a.id,
                'subtask_id': a.subtask.id if a.subtask else None,
                'subtask_name': a.subtask.subtask_name if a.subtask else '',
                'description': a.subtask.description if a.subtask else '',
                'start_date': a.subtask.start_date if a.subtask else None,
                'end_date': a.subtask.end_date if a.subtask else None,
                'due_date': a.subtask.end_date if a.subtask else None,
                'task_type': a.subtask.task_type if a.subtask else 'individual',
                'percentage': float(a.percentage) if a.percentage is not None else 0,
                'attachments': [
                    {
                        'id': att.id,
                        'file': att.file.url if att.file else None,
                        'original_filename': att.original_filename or 'Attachment',
                    }
                    for att in a.subtask.attachments.all()
                ] if a.subtask else [],
            }
            for a in assignments
        ]

    def get_assigned_employee_name(self, obj):
        return str(obj.assigned_employee) if obj.assigned_employee_id else None

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_yes_count(self, obj):
        return obj.vote_counts['yes']

    def get_no_count(self, obj):
        return obj.vote_counts['no']

    def get_pending_count(self, obj):
        return obj.vote_counts['pending']

    def get_my_vote(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return None
        employee = Employee.objects.filter(user=user).first()
        bod = getattr(user, 'bod_profile', None)
        voter = None
        if employee:
            voter = obj.voters.filter(employee=employee).first()
        if not voter and bod:
            voter = obj.voters.filter(bod=bod).first()
        return voter.vote if voter else None

    def get_my_remarks(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return None
        employee = Employee.objects.filter(user=user).first()
        bod = getattr(user, 'bod_profile', None)
        voter = None
        if employee:
            voter = obj.voters.filter(employee=employee).first()
        if not voter and bod:
            voter = obj.voters.filter(bod=bod).first()
        return voter.remarks if voter else None

    def create(self, validated_data):
        bod_ids = validated_data.pop('bod_ids', [])
        employee_ids = validated_data.pop('employee_ids', [])
        vote_request = TaskVoteRequest.objects.create(
            created_by=self.context['request'].user, **validated_data
        )
        if vote_request.approval_type == 'bod':
            for bod in bod_ids:
                TaskVoter.objects.create(vote_request=vote_request, bod=bod)
        else:  # single / multiple both create Employee voter rows
            for emp in employee_ids:
                TaskVoter.objects.create(vote_request=vote_request, employee=emp)
        return vote_request

# --- Team creation ---
 
 
class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        # NOTE: adjust 'name' below if your Department model's display
        # field is called something else.
        fields = ['id', 'name']
 
 
class EmployeeMiniSerializer(serializers.ModelSerializer):
    """Lightweight employee representation used for team-member pickers."""
    name = serializers.SerializerMethodField()
    user_id = serializers.IntegerField(read_only=True)
    department_id = serializers.SerializerMethodField()
    is_current_user = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = ['id', 'name', 'user_id', 'department_id', 'is_current_user']

    def get_name(self, obj):
        return str(obj)

    def get_department_id(self, obj):
        return obj.dept_designation.department_id if (obj.dept_designation and obj.dept_designation.department_id) else None

    def get_is_current_user(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return obj.user_id == request.user.id
        return False
 
 
class TeamMemberSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    # Lets the "All Departments" picker auto-expand the departments that
    # already-assigned members belong to, so they show up pre-checked
    # without the user having to manually open each department.
    employee_department = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    designation_name = serializers.SerializerMethodField()

    class Meta:
        model = TeamMember
        fields = ['id', 'employee', 'employee_name', 'employee_department', 'department_name', 'designation_name']

    def get_employee_name(self, obj):
        return str(obj.employee)

    def get_employee_department(self, obj):
        dept_designation = getattr(obj.employee, 'dept_designation', None)
        return dept_designation.department_id if dept_designation else None

    def get_department_name(self, obj):
        dd = getattr(obj.employee, 'dept_designation', None)
        return dd.department.name if (dd and dd.department) else None

    def get_designation_name(self, obj):
        dd = getattr(obj.employee, 'dept_designation', None)
        return dd.designation.name if (dd and dd.designation) else None
 
 
class TeamSerializer(serializers.ModelSerializer):
    members = TeamMemberSerializer(many=True, read_only=True)
    task_name = serializers.CharField(source='task.task_name', read_only=True)
    subtask_name = serializers.CharField(source='subtask.subtask_name', read_only=True)
    team_lead_name = serializers.SerializerMethodField()

    employee_ids = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(), many=True, write_only=True, required=True
    )

    class Meta:
        model = Team
        fields = [
            'id', 'task', 'task_name', 'subtask', 'subtask_name',
            'members', 'employee_ids',
            'created_by', 'team_lead_name', 'created_at',
        ]
        read_only_fields = ['created_by', 'created_at']
        extra_kwargs = {
            'task': {'required': False, 'allow_null': True},
            'subtask': {'required': False, 'allow_null': True},
        }

    def get_team_lead_name(self, obj):
        if not obj.created_by:
            return None
        return obj.created_by.get_full_name() or obj.created_by.username

    def validate(self, attrs):
        task = attrs.get('task', getattr(self.instance, 'task', None))
        subtask = attrs.get('subtask', getattr(self.instance, 'subtask', None))
        if not task and not subtask:
            raise serializers.ValidationError("A team must belong to either a task or a subtask.")
        if task and subtask:
            raise serializers.ValidationError("A team can't belong to both a task and a subtask.")
        return attrs

    def validate_employee_ids(self, value):
        if not value:
            raise serializers.ValidationError("Select at least one employee for the team.")
        return value

    def create(self, validated_data):
        employee_ids = validated_data.pop('employee_ids', [])
        team = Team.objects.create(
            created_by=self.context['request'].user, **validated_data
        )
        TeamMember.objects.bulk_create([
            TeamMember(team=team, employee=emp) for emp in employee_ids
        ])
        return team

     
     

    def update(self, instance, validated_data):
        employee_ids = validated_data.pop('employee_ids', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if employee_ids is not None:
            new_ids = {emp.id for emp in employee_ids}
            existing_ids = set(instance.members.values_list('employee_id', flat=True))

            instance.members.filter(employee_id__in=(existing_ids - new_ids)).delete()
            TeamMember.objects.bulk_create([
                TeamMember(team=instance, employee_id=emp_id)
                for emp_id in (new_ids - existing_ids)
            ])
        return instance

# Assign Task 
class TaskAssignmentSerializer(serializers.ModelSerializer):
    """Read representation of one row in the assignment table."""
    subtask_name = serializers.CharField(source='subtask.subtask_name', read_only=True)
    employee_name = serializers.SerializerMethodField()
    completed_percentage = serializers.SerializerMethodField()

    class Meta:
        model = TaskAssignment
        fields = [
            'id', 'task', 'parent_subtask', 'subtask', 'subtask_name',
            'employee', 'employee_name', 'percentage', 'completed_percentage',
            'is_approved', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_employee_name(self, obj):
        return str(obj.employee)

    def get_completed_percentage(self, obj):
        return float(obj.completed_percentage)


class TaskAssignmentRowSerializer(serializers.Serializer):
    subtask = serializers.PrimaryKeyRelatedField(queryset=Subtask.objects.all())
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all())
    percentage = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=100)


class TaskAssignmentBulkSaveSerializer(serializers.Serializer):
    """Payload for POST /task-assignments/bulk-save/.
    Provide EITHER 'task' (splitting a top-level task across its direct
    subtasks) OR 'parent_subtask' (splitting one person's OWN subtask
    across its own child subtasks) — never both."""
    task = serializers.PrimaryKeyRelatedField(queryset=Task.objects.all(), required=False, allow_null=True)
    parent_subtask = serializers.PrimaryKeyRelatedField(queryset=Subtask.objects.all(), required=False, allow_null=True)
    assignments = TaskAssignmentRowSerializer(many=True)

    def validate(self, attrs):
        task = attrs.get('task')
        parent_subtask = attrs.get('parent_subtask')
        if not task and not parent_subtask:
            raise serializers.ValidationError("Provide either 'task' or 'parent_subtask'.")
        if task and parent_subtask:
            raise serializers.ValidationError("Provide only one of 'task' or 'parent_subtask', not both.")
        return attrs

    def validate_assignments(self, value):
        if not value:
            raise serializers.ValidationError("Add at least one row before saving.")

        pairs = [(row['subtask'].id, row['employee'].id) for row in value]
        if len(pairs) != len(set(pairs)):
            raise serializers.ValidationError("The same subtask and team member combination cannot be added twice.")

        total = sum(row['percentage'] for row in value)
        if total != 100:
            raise serializers.ValidationError(f"Percentages must add up to exactly 100% (currently {total}%).")

        return value

    def save(self):
        task = self.validated_data.get('task')
        parent_subtask = self.validated_data.get('parent_subtask')
        rows = self.validated_data['assignments']

        if task:
            TaskAssignment.objects.filter(task=task, parent_subtask__isnull=True).delete()
        else:
            TaskAssignment.objects.filter(parent_subtask=parent_subtask).delete()

        assigned_by = self.context['request'].user
        result = []
        for row in rows:
            obj = TaskAssignment.objects.create(
                task=task,
                parent_subtask=parent_subtask,
                subtask=row['subtask'],
                employee=row['employee'],
                percentage=row['percentage'],
                assigned_by=assigned_by,
                is_approved=False,
            )
            result.append(obj)
        return result


class MyAssignedSubtaskSerializer(serializers.ModelSerializer):
    """One row = one subtask assigned to the current employee, shaped as an
    INDEPENDENT task card (own name, own team, own documents) — never the
    parent task's name or team lead.

    Works for ALL levels:
    - Level 2: Aswathy assigns subtask → Anu/John  (parent_subtask = null)
    - Level 3: Anu assigns sub-subtask → Aleena     (parent_subtask = Anu's subtask)
    team_lead_name = the person who assigned THIS subtask (assigned_by).
    """
    subtask_name = serializers.CharField(source='subtask.subtask_name', read_only=True)
    description = serializers.CharField(source='subtask.description', read_only=True)
    start_date = serializers.DateField(source='subtask.start_date', read_only=True)
    end_date = serializers.DateField(source='subtask.end_date', read_only=True)
    due_date = serializers.DateField(source='subtask.end_date', read_only=True)
    task_type = serializers.CharField(source='subtask.task_type', read_only=True)
    task_type_display = serializers.CharField(source='subtask.get_task_type_display', read_only=True)
    attachments = SubtaskAttachmentSerializer(source='subtask.attachments', many=True, read_only=True)
    team = serializers.SerializerMethodField()
    child_subtask_count = serializers.SerializerMethodField()

    # Who assigned THIS subtask to me — this is the "team lead" from the
    # assignee's perspective (e.g. Aswathy for Anu, Anu for Aleena).
    team_lead_name = serializers.SerializerMethodField()
    assigned_by_name = serializers.SerializerMethodField()
    employee = serializers.PrimaryKeyRelatedField(read_only=True)
    employee_name = serializers.SerializerMethodField()
    employee_department = serializers.SerializerMethodField()
    completed_percentage = serializers.SerializerMethodField()

    # Which subtask this assignment is nested under (null = top-level).
    parent_subtask_id = serializers.IntegerField(source='parent_subtask.id', read_only=True, default=None)
    parent_subtask_name = serializers.CharField(source='parent_subtask.subtask_name', read_only=True, default=None)

    class Meta:
        model = TaskAssignment
        fields = [
            'id', 'subtask', 'subtask_name', 'description',
            'start_date', 'end_date', 'due_date',
            'task_type', 'task_type_display', 'percentage',
            'attachments', 'team', 'child_subtask_count',
            'team_lead_name', 'assigned_by_name', 'employee', 'employee_name', 'employee_department',
            'parent_subtask_id', 'parent_subtask_name',
            'completed_percentage',
        ]

    def get_employee_name(self, obj):
        return str(obj.employee) if obj.employee else None

    def get_completed_percentage(self, obj):
        return float(obj.completed_percentage)

    def get_employee_department(self, obj):
        return obj.employee.dept_designation.department_id if (obj.employee and obj.employee.dept_designation) else None

    def get_team_lead_name(self, obj):
        """The team lead of the subtask's team, or fallback to the assigner if no team exists."""
        team = obj.subtask.subtask_teams.first() if obj.subtask_id else None
        if team and team.created_by:
            return team.created_by.get_full_name() or team.created_by.username
        if obj.assigned_by_id:
            return obj.assigned_by.get_full_name() or obj.assigned_by.username
        return None

    def get_assigned_by_name(self, obj):
        if obj.assigned_by_id:
            return obj.assigned_by.get_full_name() or obj.assigned_by.username
        if obj.task and obj.task.created_by:
            return obj.task.created_by.get_full_name() or obj.task.created_by.username
        return None

    def get_team(self, obj):
        team = obj.subtask.subtask_teams.first() if obj.subtask_id else None
        return TeamSerializer(team, context=self.context).data if team else None

    def get_child_subtask_count(self, obj):
        return obj.subtask.child_subtasks.count() if obj.subtask_id else 0


#  Progress
class MyLeafAssignmentSerializer(serializers.ModelSerializer):
    """One row for the 'Assigned Task' dropdown on the progress-update page.
    Delegator rows auto-derive their percentage from direct children and display
    the immediate parent task name with can_update_progress set to False."""
    subtask_name = serializers.SerializerMethodField()
    subtask_description = serializers.CharField(source='subtask.description', read_only=True, default=None)
    task_name = serializers.SerializerMethodField()
    task_start_date = serializers.SerializerMethodField()
    task_due_date = serializers.SerializerMethodField()
    start_date = serializers.SerializerMethodField()
    end_date = serializers.SerializerMethodField()
    parent_subtask_name = serializers.CharField(source='parent_subtask.subtask_name', read_only=True, default=None)
    assigned_by_name = serializers.SerializerMethodField()
    completed_percentage = serializers.SerializerMethodField()
    remaining_percentage = serializers.SerializerMethodField()
    is_delegated = serializers.BooleanField(read_only=True)
    can_update_progress = serializers.SerializerMethodField()
    cutoff_date = serializers.SerializerMethodField()
    submission_date = serializers.SerializerMethodField()
    due_dates_count = serializers.SerializerMethodField()

    class Meta:
        model = TaskAssignment
        fields = [
            'id', 'subtask', 'subtask_name', 'subtask_description', 'task_name',
            'task_start_date', 'task_due_date', 'start_date', 'end_date', 'created_at',
            'parent_subtask_name', 'assigned_by_name',
            'completed_percentage', 'remaining_percentage', 'is_delegated', 'can_update_progress',
            'cutoff_date', 'submission_date', 'due_dates_count',
        ]

    def get_subtask_name(self, obj):
        if obj.subtask and obj.subtask.subtask_name:
            return obj.subtask.subtask_name
        if obj.task and obj.task.task_name:
            return obj.task.task_name
        return None

    def get_task_name(self, obj):
        root = obj.subtask.get_root_task() if obj.subtask_id else None
        if root and root.task_name:
            return root.task_name
        if obj.task and obj.task.task_name:
            return obj.task.task_name
        return None

    def get_task_start_date(self, obj):
        if obj.subtask and obj.subtask.start_date:
            return obj.subtask.start_date
        root = obj.subtask.get_root_task() if obj.subtask_id else None
        if root and root.start_date:
            return root.start_date
        if obj.task and obj.task.start_date:
            return obj.task.start_date
        if obj.created_at:
            return obj.created_at.date()
        return None

    def get_task_due_date(self, obj):
        if obj.subtask and obj.subtask.end_date:
            return obj.subtask.end_date
        root = obj.subtask.get_root_task() if obj.subtask_id else None
        if root and root.due_date:
            return root.due_date
        if obj.task and obj.task.due_date:
            return obj.task.due_date
        return None

    def get_start_date(self, obj):
        return self.get_task_start_date(obj)

    def get_end_date(self, obj):
        return self.get_task_due_date(obj)

    def get_assigned_by_name(self, obj):
        if obj.is_delegated:
            return None
        if not obj.assigned_by_id:
            return None
        return obj.assigned_by.get_full_name() or obj.assigned_by.username

    def get_completed_percentage(self, obj):
        return float(obj.completed_percentage)

    def get_remaining_percentage(self, obj):
        return float(max(Decimal('0'), Decimal('100') - obj.completed_percentage))

    def get_can_update_progress(self, obj):
        return not obj.is_delegated

    def get_cutoff_date(self, obj):
        from .utils import get_task_cutoff_date
        return get_task_cutoff_date(obj)

    def get_submission_date(self, obj):
        from .utils import get_task_submission_date
        completed = float(obj.completed_percentage or 0)
        return get_task_submission_date(obj, completed_pct=completed)

    def get_due_dates_count(self, obj):
        from .utils import get_completion_and_due_info
        completed = float(obj.completed_percentage or 0)
        _, _, count = get_completion_and_due_info(obj, completed_pct=completed)
        return count


class TaskProgressUpdateSerializer(serializers.ModelSerializer):
    """Read = one entry in an assignment's update history (with a progress
    snapshot to drive a progress bar). Write = submit a new entry; 'percentage'
    is ADDED to the running total, never overwrites it.

    Edits: an entry can only be PATCHed/PUT by the person who created it,
    and only on the same calendar day it was created — see is_editable_today
    on the model and validate() below."""
    subtask_name = serializers.SerializerMethodField()
    task_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    cumulative_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    document_name = serializers.SerializerMethodField()
    is_editable = serializers.SerializerMethodField()

    class Meta:
        model = TaskProgressUpdate
        fields = [
            'id', 'assignment', 'task', 'subtask_name', 'task_name',
            'description_of_work', 'challenges_faced', 'pending_task', 'notes',
            'document', 'document_name',
            'percentage', 'cumulative_percentage',
            'created_by_name', 'assigned_to_name', 'created_at', 'updated_at', 'is_editable',
        ]
        read_only_fields = ['id', 'cumulative_percentage', 'created_at', 'updated_at']
        extra_kwargs = {
            'document': {'required': False, 'allow_null': True, 'write_only': False},
            'assignment': {'required': False, 'allow_null': True},
            'task': {'required': False, 'allow_null': True},
        }

    def get_subtask_name(self, obj):
        if obj.assignment and obj.assignment.subtask:
            return obj.assignment.subtask.subtask_name
        if obj.task:
            return obj.task.task_name
        return None

    def get_assigned_to_name(self, obj):
        if obj.assignment and obj.assignment.employee:
            return str(obj.assignment.employee)
        return None

    def get_task_name(self, obj):
        if obj.task_id:
            return obj.task.task_name
        subtask = obj.assignment.subtask if obj.assignment_id else None
        root = subtask.get_root_task() if subtask else None
        return root.task_name if root else None

    def get_created_by_name(self, obj):
        if not obj.created_by_id:
            return None
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_document_name(self, obj):
        if not obj.document:
            return None
        return obj.document.name.rsplit('/', 1)[-1]

    def get_is_editable(self, obj):
        request = self.context.get('request')
        if not obj.is_editable_today:
            return False
        if request and obj.created_by_id and obj.created_by_id != getattr(request.user, 'id', None):
            return False
        return True

    def validate_percentage(self, value):
        if value < 0:
            raise serializers.ValidationError("Percentage cannot be negative.")
        if value > 100:
            raise serializers.ValidationError("Percentage can't be more than 100.")
        return value

    def validate_assignment(self, assignment):
        # On edit, 'assignment' isn't resent by the frontend (it can't be
        # changed), so nothing to re-check against the logged-in employee.
        if self.instance is not None:
            return assignment
        if assignment is None:
            return None
        request = self.context.get('request')
        from .views import is_admin_user
        if request and is_admin_user(request.user):
            return assignment

        employee = Employee.objects.filter(user=request.user).first() if request else None
        is_assignee = employee and assignment.employee_id == employee.id
        is_assigner = request and assignment.assigned_by_id == request.user.id
        is_parent_assignee = (
            employee and assignment.parent_subtask_id and
            TaskAssignment.objects.filter(subtask_id=assignment.parent_subtask_id, employee=employee).exists()
        )
        if not (is_assignee or is_assigner or is_parent_assignee):
            raise serializers.ValidationError("You can only log progress on your own assigned or delegated task.")
        return assignment

    def validate(self, attrs):
        assignment = attrs.get('assignment', getattr(self.instance, 'assignment', None))
        task = attrs.get('task', getattr(self.instance, 'task', None))
        percentage = attrs.get('percentage', getattr(self.instance, 'percentage', None))

        if not assignment and not task:
            raise serializers.ValidationError("Either an assignment or a task is required.")

        request = self.context.get('request')
        is_cumulative = False
        if request and hasattr(request, 'data'):
            is_cumulative = request.data.get('is_cumulative') in ['true', 'True', True]

        if self.instance is not None:
            # ── Editing an existing entry ───────────────────────────────
            if (
                self.instance.created_by_id
                and request
                and self.instance.created_by_id != getattr(request.user, 'id', None)
            ):
                raise serializers.ValidationError("You can only edit your own update.")
            if not self.instance.is_editable_today:
                raise serializers.ValidationError(
                    "This update can only be edited on the day it was submitted."
                )
            if task:
                already_done = Decimal('0')
            elif assignment:
                already_done = assignment.progress_updates.exclude(
                    pk=self.instance.pk
                ).aggregate(total=Sum('percentage'))['total'] or Decimal('0')
            else:
                already_done = Decimal('0')
        else:
            if task:
                already_done = task.completed_percentage
            elif assignment:
                already_done = assignment.completed_percentage
            else:
                already_done = Decimal('0')

        if percentage is not None:
            if task or (not assignment and is_cumulative):
                # The user confirmed or system set the overall / cumulative percentage for root tasks
                new_total = percentage
            else:
                if percentage <= 0:
                    raise serializers.ValidationError({"percentage": "Enter a percentage greater than 0."})
                new_total = already_done + percentage
                if self.instance is None and already_done >= 100:
                    raise serializers.ValidationError(
                        {"percentage": "This task is already at 100% — no further updates are needed."}
                    )
                if new_total > 100:
                    remaining = (Decimal('100') - already_done).quantize(Decimal('0.01'))
                    raise serializers.ValidationError(
                        {"percentage": f"Only {remaining}% is left on this task; that would put it over 100%."}
                    )
            attrs['_cumulative_percentage'] = new_total
        return attrs

    def create(self, validated_data):
        validated_data['cumulative_percentage'] = validated_data.pop('_cumulative_percentage')
        validated_data['created_by'] = self.context['request'].user
        return TaskProgressUpdate.objects.create(**validated_data)

    def update(self, instance, validated_data):
        validated_data['cumulative_percentage'] = validated_data.pop(
            '_cumulative_percentage', instance.cumulative_percentage
        )
        return super().update(instance, validated_data)