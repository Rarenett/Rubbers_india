from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.mail import send_mail
from django.core.cache import cache
from django.conf import settings
from django.db import models, transaction
from django.utils import timezone
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from register_app.permissions import module_permission

from register_app.models import CustomUser
from rarenett_app.models import (
    Department, Designation, DepartmentDesignation,
    Employee, Candidate, EmploymentDetails,
    EmployeeDocumentUpload, BankDetails,
    BoardOfDirector, BODIdProof,
    EmployeeWorkExperience, EmployeeDepartmentHistory, sync_employee_department_designation
)
from rarenett_app.serializers import (
    CustomUserSerializer, DepartmentSerializer, DesignationSerializer,
    DepartmentDesignationSerializer,
    EmployeeSerializer, CandidateSerializer,
    EmploymentDetailsSerializer, EmployeeDocumentUploadSerializer,
    BankDetailsSerializer, 
    BoardOfDirectorSerializer,
    EmployeeWorkExperienceSerializer, EmployeeDepartmentHistorySerializer
)


class CustomUserViewSet(viewsets.ModelViewSet):
    queryset = CustomUser.objects.all()
    serializer_class = CustomUserSerializer
    permission_classes = [module_permission('users')]

    def get_permissions(self):
        # Allow any authenticated user to list/retrieve users (for dropdowns)
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = super().get_queryset()
        department_name = self.request.query_params.get('department')
        if department_name:
            dept_clean = department_name.strip().replace(' ', '').lower()
            if dept_clean == 'telecalling':
                queryset = queryset.filter(
                    Q(employee__dept_designation__department__name__iexact='Tele Calling') |
                    Q(employee__dept_designation__department__name__iexact='Telecalling')
                ).distinct()
            else:
                queryset = queryset.filter(employee__dept_designation__department__name__iexact=department_name).distinct()
        return queryset

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Create CustomUser and automatically create linked Employee record"""
        # Extract employee-specific fields
        department_id = request.data.get('department_id')
        designation_id = request.data.get('designation_id')
        profile_picture = request.FILES.get('profile_picture_file')
        password = request.data.get('password')
        date_of_joining = request.data.get('date_of_joining_value')
        qualifications = request.data.get('qualifications_value')
        
        # Create the CustomUser
        user_data = {
            'email': request.data.get('email'),
            'username': request.data.get('username', request.data.get('email')),  # Use email as username if not provided
            'first_name': request.data.get('first_name', ''),
            'last_name': request.data.get('last_name', ''),
            'phone': request.data.get('phone', ''),
            'is_active': request.data.get('is_active', True),
        }
        
        # Create user
        user = CustomUser.objects.create_user(
            email=user_data['email'],
            username=user_data['username'],
            password=password if password else 'defaultPassword123',  # Set default if not provided
            first_name=user_data['first_name'],
            last_name=user_data['last_name'],
            phone=user_data.get('phone', ''),
            is_staff=request.data.get('is_staff', True) if isinstance(request.data.get('is_staff'), bool) else str(request.data.get('is_staff', 'true')).lower() == 'true',
            is_superuser=request.data.get('is_superuser', False) if isinstance(request.data.get('is_superuser'), bool) else str(request.data.get('is_superuser', 'false')).lower() == 'true',
            role_id=request.data.get('role_id')
        )
        if request.data.get('inactivity_timeout_minutes'):
            try:
                user.inactivity_timeout_minutes = int(request.data.get('inactivity_timeout_minutes'))
                user.save(update_fields=['inactivity_timeout_minutes'])
            except (ValueError, TypeError):
                pass
        
        # Link user to Employee record
        candidate_id = request.data.get('candidate_id')
        
        if candidate_id:
            # Candidate already has an Employee row — just update it
            try:
                employee = Employee.objects.get(candidate_id=candidate_id)
                employee.user = user
                employee.email = user.email
                employee.save(update_fields=['user', 'email'])
            except Employee.DoesNotExist:
                # No existing employee row for this candidate; create one
                employee_data = {
                    'user': user,
                    'email': user.email,
                    'candidate_id': candidate_id,
                }
                Employee.objects.create(**employee_data, created_by=request.user)
        else:
            # Regular (non-candidate) employee creation — build full employee record
            employee_data = {
                'user': user,
                'phone': request.data.get('phone', ''),
                'email': user.email,
            }
            
            if department_id and designation_id:
                dept_desig = DepartmentDesignation.objects.filter(
                    department_id=department_id,
                    designation_id=designation_id
                ).order_by(models.F('company').desc(nulls_last=True), '-level').first()
                if dept_desig:
                    employee_data['dept_designation'] = dept_desig
            
            if profile_picture:
                employee_data['profile_picture'] = profile_picture
            
            if date_of_joining:
                employee_data['date_of_joining'] = date_of_joining
            
            if qualifications:
                employee_data['qualifications'] = qualifications
            
            Employee.objects.create(**employee_data, created_by=request.user)
        
        # Send credentials email to candidate's personal email
        if candidate_id and password:
            try:
                candidate = Candidate.objects.get(id=candidate_id)
                personal_email = candidate.email
                if personal_email:
                    email_from = getattr(settings, 'DEFAULT_FROM_EMAIL', getattr(settings, 'EMAIL_HOST_USER', ''))
                    html_content = f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h2 style="color: #1e293b; margin: 0;">Welcome to the Team!</h2>
                        </div>
                        <p style="color: #334155; font-size: 16px;">Dear <strong>{candidate.full_name}</strong>,</p>
                        <p style="color: #334155; font-size: 16px;">Your employee login credentials have been successfully created. You can use the details below to access the system.</p>
                        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
                            <p style="margin: 0; color: #475569; font-size: 15px;"><strong>Login Email:</strong> {user.email}</p>
                            <p style="margin: 10px 0 0 0; color: #475569; font-size: 15px;"><strong>Temporary Password:</strong> {password}</p>
                        </div>
                        <p style="color: #334155; font-size: 14px;"><em>Please log in and change your password at your earliest convenience for security purposes.</em></p>
                        <br/>
                        <p style="color: #334155; font-size: 14px; margin-bottom: 0;">Best regards,</p>
                        <p style="color: #1e293b; font-weight: bold; font-size: 14px; margin-top: 5px;">HR Department</p>
                    </div>
                    """
                    
                    send_mail(
                        subject='Your Login Credentials',
                        message=(
                            f"Dear {candidate.full_name},\n\n"
                            f"Your employee login credentials have been created.\n\n"
                            f"Login Email: {user.email}\n"
                            f"Password: {password}\n\n"
                            f"Please log in and change your password at your earliest convenience.\n\n"
                            f"Best regards,\nHR Department"
                        ),
                        html_message=html_content,
                        from_email=email_from,
                        recipient_list=[personal_email],
                        fail_silently=False,
                    )
            except Candidate.DoesNotExist:
                pass
            except Exception as e:
                print(f"Failed to send credentials email: {e}")

        serializer = self.get_serializer(user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    
    def update(self, request, *args, **kwargs):
        """Update CustomUser and linked Employee record"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Update CustomUser fields
        if 'first_name' in request.data:
            instance.first_name = request.data['first_name']
        if 'last_name' in request.data:
            instance.last_name = request.data['last_name']
        if 'phone' in request.data:
            instance.phone = request.data['phone']
        if 'password' in request.data and request.data['password']:
            try:
                validate_password(request.data['password'], user=instance)
            except DjangoValidationError as e:
                return Response({'error': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
            instance.set_password(request.data['password'])
        
        # Update permission fields
        if 'is_active' in request.data:
            is_active_val = request.data.get('is_active')
            instance.is_active = is_active_val if isinstance(is_active_val, bool) else str(is_active_val).lower() == 'true'
            if not instance.is_active:
                if hasattr(instance, 'active_session_token'):
                    instance.active_session_token = None
                try:
                    cache.delete(f'active_session_{instance.id}')
                    cache.delete(f'last_activity_{instance.id}')
                except Exception:
                    pass

        if 'is_staff' in request.data:
            is_staff_val = request.data.get('is_staff')
            instance.is_staff = is_staff_val if isinstance(is_staff_val, bool) else is_staff_val.lower() == 'true'
        if 'is_superuser' in request.data:
            is_superuser_val = request.data.get('is_superuser')
            instance.is_superuser = is_superuser_val if isinstance(is_superuser_val, bool) else is_superuser_val.lower() == 'true'
        
        if 'role_id' in request.data:
            instance.role_id = request.data.get('role_id')
        if 'inactivity_timeout_minutes' in request.data:
            try:
                instance.inactivity_timeout_minutes = int(request.data['inactivity_timeout_minutes'])
            except (ValueError, TypeError):
                pass
        
        instance.save()
        
        # Update or create Employee record
        try:
            employee = Employee.objects.get(user=instance)
        except Employee.DoesNotExist:
            employee = Employee.objects.create(user=instance, created_by=request.user)
        
        # Update Employee fields
        # Update dept_designation mapping
        department_id = request.data.get('department_id')
        designation_id = request.data.get('designation_id')
        if department_id and designation_id:
            dept_desig = DepartmentDesignation.objects.filter(
                department_id=department_id,
                designation_id=designation_id
            ).order_by(models.F('company').desc(nulls_last=True), '-level').first()
            if dept_desig:
                employee.dept_designation = dept_desig
        elif department_id or designation_id:
            # If only one is provided, we might need more complex logic or just clear it
            # But usually both are sent from the form
            pass
        
        if 'phone' in request.data:
            employee.phone = request.data['phone']
        

        
        if 'date_of_joining_value' in request.data and request.data['date_of_joining_value']:
            employee.date_of_joining = request.data['date_of_joining_value']
        
        if 'qualifications_value' in request.data:
            employee.qualifications = request.data['qualifications_value']
        
        if 'profile_picture_file' in request.FILES:
            employee.profile_picture = request.FILES['profile_picture_file']
        
        employee.save()
        
        # Send updated credentials email if requested (e.g. password reset from modal)
        new_password = request.data.get('password')
        send_email_flag = request.data.get('send_credentials_email')
        candidate_id = request.data.get('candidate_id')
        if send_email_flag and candidate_id and new_password:
            try:
                candidate_obj = Candidate.objects.get(id=candidate_id)
                personal_email = candidate_obj.email
                if personal_email:
                    email_from = getattr(settings, 'DEFAULT_FROM_EMAIL', getattr(settings, 'EMAIL_HOST_USER', ''))
                    html_content = f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h2 style="color: #1e293b; margin: 0;">Password Updated</h2>
                        </div>
                        <p style="color: #334155; font-size: 16px;">Dear <strong>{candidate_obj.full_name}</strong>,</p>
                        <p style="color: #334155; font-size: 16px;">Your employee login password has been updated. You can use the new details below to access the system.</p>
                        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
                            <p style="margin: 0; color: #475569; font-size: 15px;"><strong>Login Email:</strong> {instance.email}</p>
                            <p style="margin: 10px 0 0 0; color: #475569; font-size: 15px;"><strong>New Password:</strong> {new_password}</p>
                        </div>
                        <p style="color: #334155; font-size: 14px;"><em>Please log in and change your password at your earliest convenience for security purposes.</em></p>
                        <br/>
                        <p style="color: #334155; font-size: 14px; margin-bottom: 0;">Best regards,</p>
                        <p style="color: #1e293b; font-weight: bold; font-size: 14px; margin-top: 5px;">HR Department</p>
                    </div>
                    """
                    
                    send_mail(
                        subject='Your Login Password Has Been Updated',
                        message=(
                            f"Dear {candidate_obj.full_name},\n\n"
                            f"Your employee login password has been updated.\n\n"
                            f"Login Email: {instance.email}\n"
                            f"New Password: {new_password}\n\n"
                            f"Please log in and change your password at your earliest convenience.\n\n"
                            f"Best regards,\nHR Department"
                        ),
                        html_message=html_content,
                        from_email=email_from,
                        recipient_list=[personal_email],
                        fail_silently=False,
                    )
            except Candidate.DoesNotExist:
                pass
            except Exception as e:
                print(f"Failed to send updated-credentials email: {e}")

        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [module_permission('departments')]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return super().get_permissions()
    
    def get_queryset(self):
        queryset = super().get_queryset()
        branch_id = self.request.query_params.get('branch')
        if branch_id:
            queryset = queryset.filter(branches__id=branch_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class DesignationViewSet(viewsets.ModelViewSet):
    queryset = Designation.objects.all()
    serializer_class = DesignationSerializer
    permission_classes = [module_permission('designations')]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = super().get_queryset()
        department_id = self.request.query_params.get('department', None)
        if department_id:
            # Return only designations linked to the given department
            from rarenett_app.models import DepartmentDesignation
            designation_ids = DepartmentDesignation.objects.filter(
                department_id=department_id
            ).values_list('designation_id', flat=True)
            queryset = queryset.filter(id__in=designation_ids)
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)



class CandidateViewSet(viewsets.ModelViewSet):
    queryset = Candidate.objects.all()
    serializer_class = CandidateSerializer
    permission_classes = [module_permission('candidates')]
    
    def get_queryset(self):
        """Filter candidates based on query parameters"""
        queryset = super().get_queryset().filter(is_active=True)
        
        # Filter by status if provided
        status_param = self.request.query_params.get('status', None)
        if status_param:
            if ',' in status_param:
                statuses = status_param.split(',')
                queryset = queryset.filter(status__in=statuses)
            else:
                queryset = queryset.filter(status=status_param)
        
        # Filter by position_applied
        position_param = self.request.query_params.get('position_applied', None)
        if position_param:
            queryset = queryset.filter(position_applied_id=position_param)

        # Filter by department_applied
        department_param = self.request.query_params.get('department_applied', None)
        if department_param:
            queryset = queryset.filter(department_applied_id=department_param)
        
        # Exclude candidates who already have user accounts
        without_user = self.request.query_params.get('without_user', None)
        if without_user and without_user.lower() == 'true':
            # Get all emails that exist in CustomUser
            existing_emails = CustomUser.objects.values_list('email', flat=True)
            # Exclude candidates with those emails
            queryset = queryset.exclude(email__in=existing_emails)
        
        return queryset
    
    def _auto_create_employee(self, instance, request=None):
        """Helper to create an Employee when candidate status is 'Selected'"""
        if instance.status != 'Selected':
            return None
            
        try:
            # Resolve dept_designation from the candidate's position_applied
            dept_designation = None
            if instance.position_applied_id and instance.department_applied_id:
                try:
                    from rarenett_app.models import DepartmentDesignation
                    dept_designation = DepartmentDesignation.objects.filter(
                        designation_id=instance.position_applied_id,
                        department_id=instance.department_applied_id,
                    ).order_by(models.F('company').desc(nulls_last=True), '-level').first()
                    if not dept_designation:
                        dept_designation = DepartmentDesignation.objects.create(
                            designation_id=instance.position_applied_id,
                            department_id=instance.department_applied_id,
                            level=1,
                        )
                except Exception:
                    pass

            created_by = None
            if request and hasattr(request, 'user') and getattr(request.user, 'is_authenticated', False):
                created_by = request.user
            elif instance.created_by:
                created_by = instance.created_by

            employee_defaults = {
                'created_by': created_by,
            }
            if dept_designation:
                employee_defaults['dept_designation'] = dept_designation
            if instance.email:
                employee_defaults['email'] = instance.email
            if hasattr(instance, 'mobile_number') and instance.mobile_number:
                employee_defaults['phone'] = instance.mobile_number
            if hasattr(instance, 'qualification') and instance.qualification:
                employee_defaults['qualifications'] = instance.qualification
                
            branch_id = None
            factory_id = None
            if request and hasattr(request, 'data'):
                try:
                    data = request.data if isinstance(request.data, dict) else {}
                    branch_id = data.get('branch_id')
                    factory_id = data.get('factory_id')
                except Exception:
                    pass

            if branch_id:
                employee_defaults['branch_id'] = branch_id
            if factory_id:
                employee_defaults['factory_id'] = factory_id

            from rarenett_app.models import Employee
            employee, created = Employee.objects.get_or_create(
                candidate=instance,
                defaults=employee_defaults,
            )
            if not created:
                update_fields = []
                if dept_designation and not employee.dept_designation_id:
                    employee.dept_designation = dept_designation
                    update_fields.append('dept_designation')
                if branch_id and employee.branch_id != branch_id:
                    employee.branch_id = branch_id
                    update_fields.append('branch_id')
                if factory_id and employee.factory_id != factory_id:
                    employee.factory_id = factory_id
                    update_fields.append('factory_id')
                if instance.email and employee.email != instance.email:
                    employee.email = instance.email
                    update_fields.append('email')
                if hasattr(instance, 'mobile_number') and instance.mobile_number and employee.phone != instance.mobile_number:
                    employee.phone = instance.mobile_number
                    update_fields.append('phone')
                    
                if update_fields:
                    employee.save(update_fields=update_fields)
            return employee
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(
                f"Failed to auto-create Employee for candidate {instance.id}: {e}"
            )
            return None

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])

    def perform_create(self, serializer):
        created_by = self.request.user if getattr(self.request.user, 'is_authenticated', False) else None
        instance = serializer.save(created_by=created_by)
        if instance.status == 'Selected':
            self._auto_create_employee(instance, self.request)

    def perform_update(self, serializer):
        """On status → 'Selected' (or when candidate is 'Selected' and needs syncing),
        auto-create or update an Employee record. Runs for both PUT and PATCH."""
        instance = serializer.save()

        if instance.status == 'Selected':
            self._auto_create_employee(instance, self.request)

        # Sync changes to Employee and CustomUser if they exist
        from rarenett_app.models import Employee
        try:
            employee = Employee.objects.get(candidate=instance)
            update_emp_fields = []
            if instance.email and employee.email != instance.email:
                employee.email = instance.email
                update_emp_fields.append('email')
            if hasattr(instance, 'mobile_number') and hasattr(employee, 'phone'):
                if instance.mobile_number and employee.phone != instance.mobile_number:
                    employee.phone = instance.mobile_number
                    update_emp_fields.append('phone')
            if update_emp_fields:
                employee.save(update_fields=update_emp_fields)
                
            if employee.user:
                update_user_fields = []
                if instance.first_name and employee.user.first_name != instance.first_name:
                    employee.user.first_name = instance.first_name
                    update_user_fields.append('first_name')
                if hasattr(instance, 'last_name') and hasattr(employee.user, 'last_name'):
                    if instance.last_name != employee.user.last_name:
                        employee.user.last_name = instance.last_name
                        update_user_fields.append('last_name')
                if instance.email and employee.user.email != instance.email:
                    employee.user.email = instance.email
                    update_user_fields.append('email')
                if hasattr(instance, 'mobile_number') and hasattr(employee.user, 'phone'):
                    if instance.mobile_number and employee.user.phone != instance.mobile_number:
                        employee.user.phone = instance.mobile_number
                        update_user_fields.append('phone')
                if update_user_fields:
                    employee.user.save(update_fields=update_user_fields)
        except Employee.DoesNotExist:
            pass

    @action(detail=True, methods=['post'])
    def select(self, request, pk=None):
        """Endpoint to mark a candidate as selected"""
        candidate = self.get_object()
        candidate.status = 'Selected'
        candidate.save()
        
        self._auto_create_employee(candidate, request)

        serializer = self.get_serializer(candidate)
        return Response({
            'message': 'Candidate marked as selected. Employee record created.',
            'candidate': serializer.data
        })
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if hasattr(instance, 'employee_profile') and instance.employee_profile:
            sync_employee_department_designation(employee=instance.employee_profile)
        instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_status(self, request):
        """Filter candidates by status"""
        status_param = request.query_params.get('status', None)
        if status_param:
            candidates = self.queryset.filter(status=status_param)
        else:
            candidates = self.queryset.all()
        
        serializer = self.get_serializer(candidates, many=True)
        return Response(serializer.data)


class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.select_related(
        'user', 'candidate', 'dept_designation',
        'dept_designation__department', 'dept_designation__designation',
    ).all()
    serializer_class = EmployeeSerializer
    permission_classes = [module_permission('employees')]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return super().get_permissions()
    
    def _sync_selected_candidates(self):
        """Ensures any candidates marked 'Selected' that do not yet have an Employee record
        are automatically populated into the Employee table."""
        try:
            from rarenett_app.models import Candidate, Employee, DepartmentDesignation
            orphans = Candidate.objects.filter(
                status='Selected',
                employee_profile__isnull=True
            ).exclude(first_name__isnull=True).exclude(first_name='')

            for cand in orphans:
                dept_designation = None
                if cand.position_applied_id and cand.department_applied_id:
                    dept_designation = DepartmentDesignation.objects.filter(
                        designation_id=cand.position_applied_id,
                        department_id=cand.department_applied_id,
                    ).order_by(models.F('company').desc(nulls_last=True), '-level').first()
                    if not dept_designation:
                        try:
                            dept_designation = DepartmentDesignation.objects.create(
                                designation_id=cand.position_applied_id,
                                department_id=cand.department_applied_id,
                                level=1,
                            )
                        except Exception:
                            pass

                emp_defaults = {
                    'created_by': cand.created_by,
                }
                if dept_designation:
                    emp_defaults['dept_designation'] = dept_designation
                if cand.email:
                    emp_defaults['email'] = cand.email
                if cand.mobile_number:
                    emp_defaults['phone'] = cand.mobile_number
                if cand.qualification:
                    emp_defaults['qualifications'] = cand.qualification

                Employee.objects.get_or_create(candidate=cand, defaults=emp_defaults)
        except Exception:
            pass

    def get_queryset(self):
        self._sync_selected_candidates()
        queryset = super().get_queryset()
        # Only apply BOD/list-specific filters for list actions.
        # For retrieve (getEmployeeById), we need to find any employee by PK
        # regardless of BOD status or department filters.
        if self.action == 'retrieve':
            return queryset
        if not self.request.query_params.get('include_bod'):
            queryset = queryset.filter(bod__isnull=True)
        dept_id = self.request.query_params.get('department')
        if dept_id:
            queryset = queryset.filter(dept_designation__department_id=dept_id)
            
        designation_id = self.request.query_params.get('designation')
        if designation_id:
            queryset = queryset.filter(dept_designation_id=designation_id)
            
        is_hod = self.request.query_params.get('is_hod')
        if is_hod in ['true', '1', True]:
            queryset = queryset.filter(
                Q(dept_designation__designation__name__iexact='HOD') |
                Q(dept_designation__designation__name__icontains='HOD') |
                Q(dept_designation__designation__name__icontains='Head of Department')
            )
            
        max_level = self.request.query_params.get('max_level')
        department_id = self.request.query_params.get('department_id')
        if max_level is not None and department_id is not None:
            try:
                max_level_int = int(max_level)
                dept_id_int = int(department_id)
                queryset = queryset.filter(
                    dept_designation__department_id=dept_id_int,
                    dept_designation__level__lt=max_level_int
                )
            except (ValueError, TypeError):
                pass
        elif department_id is not None:
            # No level filter — just filter by department (used when a different dept is selected)
            try:
                dept_id_int = int(department_id)
                queryset = queryset.filter(dept_designation__department_id=dept_id_int)
            except (ValueError, TypeError):
                pass
        elif max_level is not None:
            try:
                max_level_int = int(max_level)
                queryset = queryset.filter(dept_designation__level__lt=max_level_int)
            except (ValueError, TypeError):
                pass

        exclude_id = self.request.query_params.get('exclude_id') or self.request.query_params.get('exclude_employee')
        if exclude_id:
            try:
                queryset = queryset.exclude(id=int(exclude_id))
            except (ValueError, TypeError):
                pass
            
        return queryset

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        sync_employee_department_designation(employee=instance)
        instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)



class EmploymentDetailsViewSet(viewsets.ModelViewSet):
    queryset = EmploymentDetails.objects.select_related(
        'user', 'reporting_manager', 'reporting_manager__candidate'
    ).all()
    serializer_class = EmploymentDetailsSerializer
    permission_classes = [module_permission('employees')]

    def get_queryset(self):
        queryset = self.queryset
        user_id = self.request.query_params.get('user', None)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        return queryset

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        if not data.get('user') and data.get('employee_id'):
            try:
                from rarenett_app.models import Employee, Candidate
                employee = Employee.objects.get(id=data['employee_id'])
                if not employee.candidate:
                    name = "Employee"
                    email = employee.email
                    if employee.user:
                        name = employee.user.first_name or employee.user.username or "Employee"
                        email = employee.user.email or email
                    
                    if email and Candidate.objects.filter(email=email).exists():
                        email = None

                    candidate = Candidate.objects.create(
                        first_name=name,
                        email=email,
                        mobile_number=employee.phone,
                        status='Selected'
                    )
                    employee.candidate = candidate
                    employee.save()
                data['user'] = employee.candidate.id
            except Exception as e:
                return Response({'message': f'Error linking candidate: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
                
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        data = request.data.copy()
        if 'user' in data and not data.get('user'):
            data.pop('user')
            
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}

        return Response(serializer.data)

    def perform_update(self, serializer):
        instance = serializer.save()
        
        # Handle Primary Role Deletion
        # If the user removes the primary role from the "Additional Roles" dropdown in the UI,
        # we should remove it from their CustomUser.role as well.
        try:
            candidate = instance.user
            if candidate and hasattr(candidate, 'employee_profile'):
                employee = candidate.employee_profile
                if employee and employee.user:
                    custom_user = employee.user
                    primary_role = custom_user.role
                    
                    if primary_role:
                        if 'roles' in serializer.validated_data:
                            submitted_roles = serializer.validated_data['roles']
                            if primary_role not in submitted_roles:
                                custom_user.role = None
                                custom_user.save()
        except Exception:
            pass


class EmployeeDocumentUploadViewSet(viewsets.ModelViewSet):
    queryset = EmployeeDocumentUpload.objects.all()
    serializer_class = EmployeeDocumentUploadSerializer
    permission_classes = [module_permission('employees')]

    def get_queryset(self):
        queryset = self.queryset
        user_id = self.request.query_params.get('user', None)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        return queryset


class BankDetailsViewSet(viewsets.ModelViewSet):
    queryset = BankDetails.objects.all()
    serializer_class = BankDetailsSerializer
    permission_classes = [module_permission('employees')]

    def get_queryset(self):
        queryset = self.queryset
        user_id = self.request.query_params.get('user', None)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        return queryset



from django.db.models.deletion import ProtectedError
from rest_framework import status
from rest_framework.response import Response

class DepartmentDesignationViewSet(viewsets.ModelViewSet):
    queryset = DepartmentDesignation.objects.all()
    serializer_class = DepartmentDesignationSerializer
    permission_classes = [module_permission('departments')]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = super().get_queryset()
        department_name = self.request.query_params.get('department__name')
        if department_name:
            queryset = queryset.filter(department__name__iexact=department_name)
        return queryset

    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            designation_name = instance.designation.name if instance.designation else "Unknown"
            return super().destroy(request, *args, **kwargs)
        except ProtectedError as e:
            return Response(
                {"detail": f"Cannot remove '{designation_name}' from the department because it is currently assigned to one or more employees."},
                status=status.HTTP_400_BAD_REQUEST
            )


class BoardOfDirectorViewSet(viewsets.ModelViewSet):
    queryset = BoardOfDirector.objects.all()
    serializer_class = BoardOfDirectorSerializer
    # permission_classes = [module_permission('users')] # You can adjust permission as needed

    def get_queryset(self):
        return super().get_queryset().filter(is_active=True)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])
        if instance.user:
            instance.user.is_active = False
            instance.user.save(update_fields=['is_active'])

    def _auto_create_or_update_employee(self, bod, request):
        if not bod.is_employee:
            return
            
        try:
            from rarenett_app.models import Employee, DepartmentDesignation
            
            dept_designation = None
            if bod.designation_id:
                try:
                    dept_designation = DepartmentDesignation.objects.filter(designation_id=bod.designation_id).first()
                except Exception:
                    pass

            employee_defaults = {
                'created_by': request.user,
                'email': bod.email,
                'phone': bod.phone,
                'user': bod.user,
                'profile_picture': bod.profile_picture,
                'dept_designation': dept_designation,
            }
            
            employee, created = Employee.objects.get_or_create(
                bod=bod,
                defaults=employee_defaults,
            )
            
            if not created:
                employee.email = bod.email
                employee.phone = bod.phone
                employee.user = bod.user
                if bod.profile_picture:
                    employee.profile_picture = bod.profile_picture
                if dept_designation and not employee.dept_designation:
                    employee.dept_designation = dept_designation
                employee.save(update_fields=['email', 'phone', 'user', 'profile_picture', 'dept_designation'])
                
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to auto-create Employee for BOD {bod.id}: {e}")

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        # 1. Handle user creation if username/password provided
        username = request.data.get('username')
        password = request.data.get('password')
        email = request.data.get('email')
        name = request.data.get('name', '')
        
        user = None
        if username and password:
            name_parts = name.split(' ', 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            # Fetch the Role if provided
            from register_app.models import Role
            role_name = request.data.get('role')
            role_instance = None
            if role_name:
                role_instance = Role.objects.filter(name__iexact=role_name).first()
            
            user = CustomUser.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                is_staff=True, # Allow login to admin/ERP
                is_superuser=False,
                role=role_instance
            )
        
        # 2. Create BOD record
        data = request.data.copy()
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        bod = serializer.save(user=user)
        
        # 3. Handle multiple file uploads for ID proofs
        id_proofs = request.FILES.getlist('id_proofs')
        for proof_file in id_proofs:
            BODIdProof.objects.create(bod=bod, file=proof_file)
            
        # 4. Auto create/update employee if is_employee is True
        self._auto_create_or_update_employee(bod, request)
            
        # Refetch to include nested id_proofs in response
        return Response(self.get_serializer(bod).data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # 1. Update user if password or role changed
        password = request.data.get('password')
        role_name = request.data.get('role')
        email = request.data.get('email')
        
        if instance.user:
            user_updated = False
            if password:
                try:
                    validate_password(password, user=instance.user)
                except DjangoValidationError as e:
                    return Response({'error': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
                instance.user.set_password(password)
                user_updated = True
                
            if email and instance.user.email != email:
                instance.user.email = email
                user_updated = True
            
            if role_name is not None: # role could be passed as empty to remove, or string to update
                from register_app.models import Role
                role_instance = Role.objects.filter(name__iexact=role_name).first() if role_name else None
                if instance.user.role != role_instance:
                    instance.user.role = role_instance
                    user_updated = True

            if user_updated:
                instance.user.save()
            
            # Send updated credentials email if password changed
            if password and instance.email:
                try:
                    email_from = getattr(settings, 'DEFAULT_FROM_EMAIL', getattr(settings, 'EMAIL_HOST_USER', ''))
                    html_content = f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h2 style="color: #1e293b; margin: 0;">Password Updated</h2>
                        </div>
                        <p style="color: #334155; font-size: 16px;">Dear <strong>{instance.name}</strong>,</p>
                        <p style="color: #334155; font-size: 16px;">Your login password has been updated. You can use the new details below to access the system.</p>
                        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
                            <p style="margin: 0; color: #475569; font-size: 15px;"><strong>Login Email:</strong> {instance.email}</p>
                            <p style="margin: 10px 0 0 0; color: #475569; font-size: 15px;"><strong>New Password:</strong> {password}</p>
                        </div>
                        <p style="color: #334155; font-size: 14px;"><em>Please log in and change your password at your earliest convenience for security purposes.</em></p>
                        <br/>
                        <p style="color: #334155; font-size: 14px; margin-bottom: 0;">Best regards,</p>
                        <p style="color: #1e293b; font-weight: bold; font-size: 14px; margin-top: 5px;">HR Department</p>
                    </div>
                    """
                    
                    send_mail(
                        subject='Your Login Password Has Been Updated',
                        message=(
                            f"Dear {instance.name},\n\n"
                            f"Your login password has been updated.\n\n"
                            f"Login Email: {instance.email}\n"
                            f"New Password: {password}\n\n"
                            f"Please log in and change your password at your earliest convenience.\n\n"
                            f"Best regards,\nHR Department"
                        ),
                        html_message=html_content,
                        from_email=email_from,
                        recipient_list=[instance.email],
                        fail_silently=False,
                    )
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).error(f"Failed to send password update email to {instance.email}: {str(e)}")
            
        # 2. Update BOD record
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        bod = serializer.save()
        
        # 3. Handle multiple file uploads for ID proofs (append new ones)
        id_proofs = request.FILES.getlist('id_proofs')
        for proof_file in id_proofs:
            BODIdProof.objects.create(bod=bod, file=proof_file)
            
        # 4. Auto create/update employee if is_employee is True
        self._auto_create_or_update_employee(bod, request)
            
        return Response(self.get_serializer(bod).data)

class EmployeeWorkExperienceViewSet(viewsets.ModelViewSet):
    queryset = EmployeeWorkExperience.objects.all()
    serializer_class = EmployeeWorkExperienceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        employee_id = self.request.query_params.get('employee_id')
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        return queryset


class EmployeeDepartmentHistoryViewSet(viewsets.ModelViewSet):
    queryset = EmployeeDepartmentHistory.objects.select_related(
        'employee', 'candidate', 'department', 'designation', 'created_by'
    ).all()
    serializer_class = EmployeeDepartmentHistorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        employee_id = self.request.query_params.get('employee')
        candidate_id = self.request.query_params.get('candidate')

        if employee_id or candidate_id:
            conditions = models.Q()
            if employee_id:
                conditions |= models.Q(employee_id=employee_id)
            if candidate_id:
                conditions |= models.Q(candidate_id=candidate_id)
                try:
                    cand = Candidate.objects.get(id=candidate_id)
                    if hasattr(cand, 'employee_profile') and cand.employee_profile:
                        conditions |= models.Q(employee_id=cand.employee_profile.id)
                except Candidate.DoesNotExist:
                    pass

            filtered_qs = queryset.filter(conditions)

            # Auto-seed initial history entry if employee/candidate has existing dept & designation but no history
            if not filtered_qs.exists():
                self._seed_initial_history(employee_id, candidate_id)
                filtered_qs = queryset.filter(conditions)

            return filtered_qs

        return queryset

    def _seed_initial_history(self, employee_id=None, candidate_id=None):
        emp = None
        cand = None
        if employee_id:
            emp = Employee.objects.filter(id=employee_id).first()
            if emp and emp.candidate:
                cand = emp.candidate
        if not cand and candidate_id:
            cand = Candidate.objects.filter(id=candidate_id).first()
            if cand and hasattr(cand, 'employee_profile') and cand.employee_profile:
                emp = cand.employee_profile

        dept = None
        desig = None
        effective_from = None

        if emp and emp.dept_designation:
            dept = emp.dept_designation.department
            desig = emp.dept_designation.designation
            effective_from = emp.date_of_joining
        elif cand:
            dept = cand.department_applied
            desig = cand.position_applied
            effective_from = getattr(cand, 'date_of_joining', None)

        if not effective_from:
            effective_from = timezone.now().date()

        if dept and desig:
            EmployeeDepartmentHistory.objects.create(
                employee=emp,
                candidate=cand,
                department=dept,
                designation=desig,
                effective_from=effective_from,
                remarks='Initial Department & Designation'
            )

    @transaction.atomic
    def perform_create(self, serializer):
        employee = serializer.validated_data.get('employee')
        candidate = serializer.validated_data.get('candidate')

        if not employee and candidate:
            try:
                employee = candidate.employee_profile
            except Exception:
                employee = None
        if not candidate and employee and employee.candidate:
            candidate = employee.candidate

        history = serializer.save(
            employee=employee,
            candidate=candidate,
            created_by=self.request.user if self.request.user.is_authenticated else None
        )
        sync_employee_department_designation(employee=history.employee, candidate=history.candidate)

    @transaction.atomic
    def perform_update(self, serializer):
        history = serializer.save()
        sync_employee_department_designation(employee=history.employee, candidate=history.candidate)

    @transaction.atomic
    def perform_destroy(self, instance):
        emp = instance.employee
        cand = instance.candidate
        instance.delete()
        sync_employee_department_designation(employee=emp, candidate=cand)






from rest_framework import permissions
