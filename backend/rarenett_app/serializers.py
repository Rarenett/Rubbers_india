from django.db import models
from django.utils import timezone
from rest_framework import serializers
from register_app.models import CustomUser, Role
from settings_app.models import Company
from rarenett_app.models import (
    Department, Designation, DepartmentDesignation,
    Employee, Candidate, EmploymentDetails, EmployeeRoleExpiry,
    EmployeeDocumentUpload, BankDetails, BoardOfDirector, BODIdProof,
    EmployeeWorkExperience, EmployeeDepartmentHistory
)


class CustomUserSerializer(serializers.ModelSerializer):
    # Employee-related fields (read from Employee model if exists)
    department = serializers.SerializerMethodField()
    designation = serializers.SerializerMethodField()
    designation_level = serializers.SerializerMethodField()
    phone_number = serializers.SerializerMethodField()
    profile_picture = serializers.SerializerMethodField()
    is_board_of_director = serializers.SerializerMethodField()
    date_of_joining = serializers.SerializerMethodField()
    qualifications = serializers.SerializerMethodField()
    customer_type = serializers.SerializerMethodField()
    customer_info = serializers.SerializerMethodField()
    is_driver = serializers.SerializerMethodField()
    address = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    
    # Write-only fields for creating/updating
    department_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    designation_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    profile_picture_file = serializers.ImageField(write_only=True, required=False, allow_null=True)
    password = serializers.CharField(write_only=True, required=False)
    date_of_joining_value = serializers.DateField(write_only=True, required=False, allow_null=True)
    qualifications_value = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    
    class Meta:
        model = CustomUser
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name', 
            'phone', 'role', 'inactivity_timeout_minutes', 'is_active', 'is_staff', 'is_superuser', 'password',
            # Employee & BOD fields (read)
            'department', 'designation', 'designation_level', 'phone_number', 'profile_picture',
            'is_board_of_director',
            'date_of_joining', 'qualifications',
            'customer_type', 'customer_info', 'is_driver', 'address',
            # Employee fields (write)
            'department_id', 'designation_id', 'profile_picture_file',
            'date_of_joining_value', 'qualifications_value'
        ]
        read_only_fields = ['id']
    
    def get_department(self, obj):
        try:
            employee = Employee.objects.filter(user=obj).first()
            if employee and employee.dept_designation and employee.dept_designation.department:
                return {
                    'id': employee.dept_designation.department.id,
                    'name': employee.dept_designation.department.name
                }
            return None
        except Exception:
            return None
    
    def get_designation(self, obj):
        # 1. Direct BOD profile attached to user
        try:
            if hasattr(obj, 'bod_profile') and obj.bod_profile and obj.bod_profile.designation:
                return {
                    'id': obj.bod_profile.designation.id,
                    'title': obj.bod_profile.designation.name
                }
        except Exception:
            pass

        # 2. Linked Employee record
        try:
            employee = Employee.objects.filter(user=obj).first()
            if employee:
                if employee.dept_designation and employee.dept_designation.designation:
                    return {
                        'id': employee.dept_designation.designation.id,
                        'title': employee.dept_designation.designation.name
                    }
                if employee.bod and employee.bod.designation:
                    return {
                        'id': employee.bod.designation.id,
                        'title': employee.bod.designation.name
                    }
        except Exception:
            pass

        # 3. Match BoardOfDirector by email fallback
        try:
            bod = BoardOfDirector.objects.filter(email=obj.email, is_active=True).first()
            if bod and bod.designation:
                return {
                    'id': bod.designation.id,
                    'title': bod.designation.name
                }
        except Exception:
            pass

        # 4. Role fallback if role exists
        try:
            if obj.role:
                return {
                    'id': obj.role.id,
                    'title': obj.role.name
                }
        except Exception:
            pass

        return None

    def get_designation_level(self, obj):
        try:
            employee = Employee.objects.filter(user=obj).first()
            if employee and employee.dept_designation:
                return employee.dept_designation.level
            return None
        except Exception:
            return None
    
    def get_phone_number(self, obj):
        try:
            employee = Employee.objects.filter(user=obj).first()
            if employee and employee.phone:
                return employee.phone
            if hasattr(obj, 'bod_profile') and obj.bod_profile and obj.bod_profile.phone:
                return obj.bod_profile.phone
            bod = BoardOfDirector.objects.filter(email=obj.email, is_active=True).first()
            if bod and bod.phone:
                return bod.phone
            return obj.phone
        except Exception:
            return obj.phone
    
    def get_profile_picture(self, obj):
        # 1. Direct BOD profile
        try:
            if hasattr(obj, 'bod_profile') and obj.bod_profile and obj.bod_profile.profile_picture:
                return obj.bod_profile.profile_picture.url
        except Exception:
            pass

        # 2. Employee record (profile_picture, BOD picture, or candidate photo)
        try:
            employee = Employee.objects.filter(user=obj).first()
            if employee:
                if employee.profile_picture:
                    return employee.profile_picture.url
                if employee.bod and employee.bod.profile_picture:
                    return employee.bod.profile_picture.url
                if employee.candidate and employee.candidate.photo:
                    return employee.candidate.photo.url
        except Exception:
            pass

        # 3. Match BoardOfDirector by email fallback
        try:
            bod = BoardOfDirector.objects.filter(email=obj.email, is_active=True).first()
            if bod and bod.profile_picture:
                return bod.profile_picture.url
        except Exception:
            pass

        return None

    def get_is_board_of_director(self, obj):
        try:
            if hasattr(obj, 'bod_profile') and obj.bod_profile:
                return True
        except Exception:
            pass
        try:
            employee = Employee.objects.filter(user=obj).first()
            if employee and employee.bod:
                return True
        except Exception:
            pass
        try:
            if BoardOfDirector.objects.filter(email=obj.email, is_active=True).exists():
                return True
        except Exception:
            pass
        if obj.role and any(keyword in obj.role.name.lower() for keyword in ['board', 'director', 'bod']):
            return True
        return False
    

    
    def get_date_of_joining(self, obj):
        try:
            employee = Employee.objects.get(user=obj)
            return employee.date_of_joining.strftime('%Y-%m-%d') if employee.date_of_joining else None
        except Employee.DoesNotExist:
            return None
    
    def get_qualifications(self, obj):
        try:
            employee = Employee.objects.get(user=obj)
            return employee.qualifications
        except Employee.DoesNotExist:
            return None

    def get_address(self, obj):
        try:
            employee = Employee.objects.get(user=obj)
            if employee.candidate:
                return employee.candidate.address
        except Employee.DoesNotExist:
            pass
        return None

    def get_customer_info(self, obj):
        try:
            from hr_app.models import HrDistributor, HrVendor, HrOtherCustomer
            from finance_app.models import Ledger
            from django.db.models import Q

            dist = HrDistributor.objects.filter(Q(linked_user=obj) | (Q(email__iexact=obj.email) & ~Q(email=''))).first()
            if dist:
                ledger = None
                if dist.email:
                    ledger = Ledger.objects.filter(email__iexact=dist.email.strip()).first()
                if not ledger and obj.email:
                    ledger = Ledger.objects.filter(email__iexact=obj.email.strip()).first()
                if not ledger and dist.name:
                    ledger = Ledger.objects.filter(name__iexact=dist.name.strip()).first()
                if not ledger and dist.name:
                    from finance_app.models import AccountGroup
                    group = AccountGroup.objects.filter(name__icontains='Sundry Debtor').first()
                    email_val = dist.email.strip() if dist.email else (obj.email.strip() if obj.email else '')
                    ledger, _ = Ledger.objects.get_or_create(
                        name=dist.name.strip(),
                        defaults={
                            'email': email_val,
                            'accountGroup': group,
                            'opening_balance': 0,
                            'closing_balance': 0
                        }
                    )
                return {
                    'id': dist.id,
                    'name': dist.name,
                    'email': dist.email,
                    'customer_type': dist.customer_type.name.lower() if (dist.customer_type and dist.customer_type.name) else 'distributor',
                    'ledger_id': ledger.id if ledger else None,
                    'ledger_name': ledger.name if ledger else None,
                }
            
            vendor = HrVendor.objects.filter(Q(linked_user=obj) | (Q(email__iexact=obj.email) & ~Q(email=''))).first()
            if vendor:
                ledger = None
                if vendor.email:
                    ledger = Ledger.objects.filter(email__iexact=vendor.email.strip()).first()
                if not ledger and obj.email:
                    ledger = Ledger.objects.filter(email__iexact=obj.email.strip()).first()
                if not ledger and vendor.name:
                    ledger = Ledger.objects.filter(name__iexact=vendor.name.strip()).first()
                return {
                    'id': vendor.id,
                    'name': vendor.name,
                    'email': vendor.email,
                    'customer_type': vendor.customer_type.name.lower() if (vendor.customer_type and vendor.customer_type.name) else 'vendor',
                    'ledger_id': ledger.id if ledger else None,
                    'ledger_name': ledger.name if ledger else None,
                }

            other = HrOtherCustomer.objects.filter(Q(linked_user=obj) | (Q(email__iexact=obj.email) & ~Q(email=''))).first()
            if other:
                ledger = None
                if other.email:
                    ledger = Ledger.objects.filter(email__iexact=other.email.strip()).first()
                if not ledger and obj.email:
                    ledger = Ledger.objects.filter(email__iexact=obj.email.strip()).first()
                if not ledger and other.name:
                    ledger = Ledger.objects.filter(name__iexact=other.name.strip()).first()
                return {
                    'id': other.id,
                    'name': other.name,
                    'email': other.email,
                    'customer_type': other.customer_type.name.lower() if (other.customer_type and other.customer_type.name) else 'other',
                    'ledger_id': ledger.id if ledger else None,
                    'ledger_name': ledger.name if ledger else None,
                }

            if obj.role and obj.role.name and obj.role.name.lower() == 'distributor':
                ledger = None
                if obj.email:
                    ledger = Ledger.objects.filter(email__iexact=obj.email.strip()).first()
                if not ledger:
                    full_name = obj.get_full_name()
                    if full_name:
                        ledger = Ledger.objects.filter(name__iexact=full_name.strip()).first()
                if not ledger and obj.username:
                    ledger = Ledger.objects.filter(name__iexact=obj.username.strip()).first()
                return {
                    'id': obj.id,
                    'name': obj.get_full_name() or obj.email,
                    'email': obj.email,
                    'customer_type': 'distributor',
                    'ledger_id': ledger.id if ledger else None,
                    'ledger_name': ledger.name if ledger else None,
                }
        except Exception:
            pass
        return None

    def get_customer_type(self, obj):
        try:
            info = self.get_customer_info(obj)
            if info and info.get('customer_type'):
                return info.get('customer_type')
        except Exception:
            pass
        return None

    def get_is_driver(self, obj):
        try:
            from logistics_app.models import Driver
            return Driver.objects.filter(user=obj).exists()
        except Exception:
            return False

    def get_role(self, obj):
        try:
            role = obj.role
            if not role:
                from register_app.permissions_utils import get_active_roles
                active_roles = get_active_roles(obj)
                if active_roles:
                    role = active_roles[0]
            if role:
                return {
                    'id': role.id,
                    'name': role.name,
                    'assigned_dashboards': [
                        {
                            'dashboard_id': rd.dashboard.id,
                            'name': rd.dashboard.name,
                            'route': rd.dashboard.route,
                            'is_default': rd.is_default
                        } for rd in role.role_dashboards.select_related('dashboard').all()
                    ]
                }
        except Exception:
            pass
        return None


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'company', 'name', 'is_active', 'requires_visitor_approval', 'branches', 'contact_person', 'contact_number']


class DesignationSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = Designation
        fields = '__all__'


class DepartmentDesignationSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    designation_name = serializers.CharField(source='designation.name', read_only=True)

    class Meta:
        model = DepartmentDesignation
        fields = ['id', 'company', 'department', 'designation', 'department_name', 'designation_name', 'level']




class CandidateSerializer(serializers.ModelSerializer):
    employee_profile = serializers.SerializerMethodField()
    position_applied_name = serializers.CharField(source='position_applied.name', read_only=True, allow_null=True, default=None)
    department_applied_name = serializers.CharField(source='department_applied.name', read_only=True, allow_null=True, default=None)
    interviewer_name = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()
    resume_url = serializers.SerializerMethodField()
    branch_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    factory_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Candidate
        fields = [
            'id',
            'first_name', 'last_name', 'full_name', 'gender', 'blood_group', 'date_of_birth',
            'email', 'mobile_number', 'address', 'photo', 'photo_url',
            'position_applied', 'position_applied_name',
            'department_applied', 'department_applied_name',
            'expected_salary', 'notice_period', 'experience_years',
            'qualification', 'skills', 'resume', 'resume_url',
            'status', 'created_at', 'updated_at', 'created_by',
            'employee_profile', 'interview_date', 'interviewer', 'interviewer_name',
            'branch_id', 'factory_id'
        ]
        read_only_fields = ['created_at', 'updated_at']
        extra_kwargs = {
            'photo': {'write_only': True, 'required': False},
            'resume': {'write_only': True, 'required': False},
        }

    def get_full_name(self, obj):
        return obj.full_name

    def get_interviewer_name(self, obj):
        if obj.interviewer:
            return obj.interviewer.get_full_name()
        return None

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None

    def get_resume_url(self, obj):
        if obj.resume:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.resume.url)
            return obj.resume.url
        return None

    def get_employee_profile(self, obj):
        try:
            ep = obj.employee_profile
        except Exception:
            return None
        if ep is None:
            return None
        try:
            dept_name = None
            desig_level = None
            if ep.dept_designation:
                if ep.dept_designation.department:
                    dept_name = ep.dept_designation.department.name
                desig_level = ep.dept_designation.level
            return {
                'id': ep.id,
                'user_email': ep.user.email if ep.user else None,
                'user_name': ep.user.get_full_name() if ep.user else None,
                'user_role': (ep.user.role_id if ep.user else None),
                'department_id': ep.dept_designation.department_id if ep.dept_designation else None,
                'department_name': dept_name,
                'designation_level': desig_level,
            }
        except Exception:
            return {'id': ep.id, 'user_email': None, 'user_name': None, 'user_role': None, 'department_id': None, 'department_name': None, 'designation_level': None}


class EmployeeSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_email = serializers.CharField(source='user.email', read_only=True)
    department_name = serializers.SerializerMethodField()
    department_id = serializers.SerializerMethodField()
    designation_title = serializers.SerializerMethodField()
    designation_level = serializers.SerializerMethodField()
    level = serializers.SerializerMethodField()

    # Candidate details (populated from linked candidate record)
    full_name = serializers.SerializerMethodField()
    date_of_birth = serializers.SerializerMethodField()
    address = serializers.SerializerMethodField()
    experience_years = serializers.SerializerMethodField()
    skills = serializers.SerializerMethodField()
    mobile_number = serializers.SerializerMethodField()
    candidate_id = serializers.SerializerMethodField()
    has_login = serializers.SerializerMethodField()
    user_is_active = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()

    def get_is_online(self, obj):
        if obj.user and hasattr(obj.user, 'active_session_token') and obj.user.active_session_token:
            return True
        return False

    def get_user_name(self, obj):
        if not obj.user:
            return ''
        full = obj.user.get_full_name().strip()
        return full if full else obj.user.username

    def get_department_name(self, obj):
        try:
            return obj.dept_designation.department.name if obj.dept_designation else None
        except Exception:
            return None

    def get_department_id(self, obj):
        try:
            return obj.dept_designation.department.id if obj.dept_designation else None
        except Exception:
            return None

    def get_designation_title(self, obj):
        try:
            return obj.dept_designation.designation.name if obj.dept_designation else None
        except Exception:
            return None

    def get_designation_level(self, obj):
        try:
            return obj.dept_designation.level if obj.dept_designation else None
        except Exception:
            return None

    def get_level(self, obj):
        try:
            return obj.dept_designation.level if obj.dept_designation else None
        except Exception:
            return None

    def get_full_name(self, obj):
        if obj.user:
            name = obj.user.get_full_name().strip()
            if name:
                return name
            if obj.user.username:
                return obj.user.username
        if obj.candidate:
            return obj.candidate.full_name
        return ''

    def get_date_of_birth(self, obj):
        if obj.candidate:
            return obj.candidate.date_of_birth
        return None

    def get_address(self, obj):
        if obj.candidate:
            return obj.candidate.address
        return ''

    def get_experience_years(self, obj):
        if obj.candidate:
            return obj.candidate.experience_years
        return None

    def get_skills(self, obj):
        if obj.candidate:
            return obj.candidate.skills
        return ''

    def get_mobile_number(self, obj):
        if obj.phone:
            return obj.phone
        if obj.candidate:
            return obj.candidate.mobile_number
        return ''

    def get_candidate_id(self, obj):
        return obj.candidate_id

    def get_has_login(self, obj):
        return obj.user_id is not None

    def get_user_is_active(self, obj):
        if obj.user:
            return obj.user.is_active
        return None

    class Meta:
        model = Employee
        fields = [
            'id', 'user', 'user_name', 'user_email', 'has_login', 'user_is_active', 'is_online',
            'company', 'branch', 'factory', 'warehouse',
            'dept_designation', 'department_name', 'department_id', 'designation_title',
            'designation_level', 'level',
            'date_of_joining', 'qualifications', 'phone', 'profile_picture',
            'email',
            'candidate', 'candidate_id',
            # Computed from candidate
            'full_name', 'date_of_birth', 'address',
            'experience_years', 'skills', 'mobile_number',
            'created_by',
        ]
        read_only_fields = ['created_by']


class EmployeeRoleExpirySerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source='role.name', read_only=True)

    class Meta:
        model = EmployeeRoleExpiry
        fields = ['id', 'role', 'role_name', 'expiry_date']


class EmploymentDetailsSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    reporting_manager_name = serializers.SerializerMethodField()
    roles = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Role.objects.all(), required=False
    )
    # New: per-role expiry — read
    role_expiries = EmployeeRoleExpirySerializer(many=True, read_only=True)
    # New: per-role expiry — write (list of {role: id, expiry_date: 'YYYY-MM-DD'})
    role_expiries_input = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )

    def get_reporting_manager_name(self, obj):
        try:
            if obj.reporting_manager_id and obj.reporting_manager and obj.reporting_manager.candidate:
                return f"{obj.reporting_manager.candidate.first_name} {obj.reporting_manager.candidate.last_name}".strip()
        except Exception:
            pass
        return ''

    def create(self, validated_data):
        role_expiries_input = validated_data.pop('role_expiries_input', [])
        roles_data = validated_data.pop('roles', [])
        instance = super().create(validated_data)
        if roles_data:
            instance.roles.set(roles_data)
        self._sync_role_expiries(instance, role_expiries_input)
        return instance

    def update(self, instance, validated_data):
        role_expiries_input = validated_data.pop('role_expiries_input', None)
        roles_data = validated_data.pop('roles', None)
        instance = super().update(instance, validated_data)
        if roles_data is not None:
            instance.roles.set(roles_data)
        if role_expiries_input is not None:
            self._sync_role_expiries(instance, role_expiries_input)
        return instance

    def _sync_role_expiries(self, instance, role_expiries_input):
        """Replace the role_expiries for this employment record.
        Also migrates legacy roles that have no EmployeeRoleExpiry entry
        by using roles_applicable_date as the fallback expiry."""
        incoming_role_ids = set()
        for item in role_expiries_input:
            role_id = item.get('role')
            expiry_date = item.get('expiry_date') or None
            if role_id:
                incoming_role_ids.add(int(role_id))
                EmployeeRoleExpiry.objects.update_or_create(
                    employment=instance,
                    role_id=role_id,
                    defaults={'expiry_date': expiry_date}
                )
        # Remove entries no longer in the list
        instance.role_expiries.exclude(role_id__in=incoming_role_ids).delete()

    class Meta:
        model = EmploymentDetails
        fields = ['id', 'user', 'user_name', 'employment_no', 'date_of_joining', 'employment_type',
                  'probation_period', 'notice_period', 'work_mode', 'roles', 'roles_applicable_date',
                  'role_expiries', 'role_expiries_input',
                  'function', 'office_location',
                  'reporting_manager', 'reporting_manager_name',
                  'ic1_name', 'ic1_relation', 'ic1_number',
                  'ic2_name', 'ic2_relation', 'ic2_number', 
                  'health_card_validity', 'health_insurance_validity',
                  'created_at', 'updated_at']


class EmployeeDocumentUploadSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    
    class Meta:
        model = EmployeeDocumentUpload
        fields = '__all__'


class BankDetailsSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    
    class Meta:
        model = BankDetails
        fields = '__all__'



class BODIdProofSerializer(serializers.ModelSerializer):
    class Meta:
        model = BODIdProof
        fields = ['id', 'bod', 'file', 'uploaded_at']
        read_only_fields = ['bod']

class BoardOfDirectorSerializer(serializers.ModelSerializer):
    id_proofs = BODIdProofSerializer(many=True, read_only=True)
    designation_name = serializers.SerializerMethodField()
    username = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()
    has_login = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    class Meta:
        model = BoardOfDirector
        fields = [
            'id', 'user', 'name', 'email', 'phone', 'designation', 'designation_name',
            'profile_picture', 'bank_name', 'account_name', 'account_number',
            'ifsc_code', 'branch_name', 'pan_number', 'aadhar_number',
            'is_employee', 'created_at', 'updated_at', 'id_proofs', 'username',
            'user_email', 'has_login', 'role'
        ]
        read_only_fields = ['user']

    def get_designation_name(self, obj):
        return obj.designation.name if obj.designation_id else None

    def get_username(self, obj):
        return obj.user.username if obj.user_id else None

    def get_user_email(self, obj):
        return obj.user.email if obj.user_id else None

    def get_has_login(self, obj):
        return obj.user_id is not None
        
    def get_role(self, obj):
        return obj.user.role.name if obj.user_id and obj.user.role_id else None

class EmployeeWorkExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeWorkExperience
        fields = '__all__'


class EmployeeDepartmentHistorySerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    designation_name = serializers.CharField(source='designation.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeDepartmentHistory
        fields = [
            'id', 'employee', 'candidate', 'department', 'department_name',
            'designation', 'designation_name', 'effective_from', 'remarks',
            'status', 'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_status(self, obj):
        today = timezone.now().date()
        if obj.effective_from > today:
            return 'upcoming'
        
        emp_filter = models.Q()
        if obj.employee_id:
            emp_filter = models.Q(employee_id=obj.employee_id)
            if obj.employee and obj.employee.candidate_id:
                emp_filter |= models.Q(candidate_id=obj.employee.candidate_id)
        elif obj.candidate_id:
            emp_filter = models.Q(candidate_id=obj.candidate_id)
            if obj.candidate and hasattr(obj.candidate, 'employee_profile') and obj.candidate.employee_profile:
                emp_filter |= models.Q(employee_id=obj.candidate.employee_profile.id)

        newer_exists = EmployeeDepartmentHistory.objects.filter(
            emp_filter,
            effective_from__lte=today
        ).filter(
            models.Q(effective_from__gt=obj.effective_from) |
            models.Q(effective_from=obj.effective_from, id__gt=obj.id)
        ).exists()

        return 'past' if newer_exists else 'active'


