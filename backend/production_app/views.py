from production_app import serializers
from django.shortcuts import render
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction

from datetime import datetime, timedelta

from production_app.models import (
    EmployeeGroup, EmployeeGroupMember, Shift, ProductionLine, 
    ShiftPlan, ShiftPlanDay, ShiftProductionLine, ShiftProductionEmployee,
    ProductionAttendance, ProductionBreakLog, BreakTypeMaster, PostProductionEntry,
    PostProductionResponsibility
)
from production_app.serializers import (
    EmployeeGroupSerializer, EmployeeGroupMemberSerializer,
    ShiftSerializer, ProductionLineSerializer, ShiftPlanSerializer,
    ShiftPlanDaySerializer, ShiftProductionLineSerializer, ShiftProductionEmployeeSerializer,
    ProductionAttendanceSerializer, ProductionBreakLogSerializer, BreakTypeMasterSerializer,
    PostProductionEntrySerializer, PostProductionResponsibilitySerializer,
    AdjustmentPostProductionSerializer, AdjustmentAvailableEntrySerializer, AdjustmentStockItemSerializer
)
from django.utils import timezone
from django.db.models import Sum, Count, Q
from decimal import Decimal
from inventory_app.models import StockItem
from rd_app.models import ExtraQuantity

class BreakTypeMasterViewSet(viewsets.ModelViewSet):
    queryset = BreakTypeMaster.objects.all()
    serializer_class = BreakTypeMasterSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        shift_id = self.request.query_params.get('shift_id')
        if shift_id:
            queryset = queryset.filter(shifts__id=shift_id)
        return queryset

class EmployeeGroupViewSet(viewsets.ModelViewSet):
    queryset = EmployeeGroup.objects.all()
    serializer_class = EmployeeGroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class EmployeeGroupMemberViewSet(viewsets.ModelViewSet):
    queryset = EmployeeGroupMember.objects.all()
    serializer_class = EmployeeGroupMemberSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        group_id = self.request.query_params.get('group')
        if group_id:
            queryset = queryset.filter(group_id=group_id)
        return queryset

class ShiftViewSet(viewsets.ModelViewSet):
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        factory_id = self.request.query_params.get('factory_id')
        if factory_id:
            queryset = queryset.filter(factory_id=factory_id)
        return queryset

class ProductionLineViewSet(viewsets.ModelViewSet):
    queryset = ProductionLine.objects.all()
    serializer_class = ProductionLineSerializer
    permission_classes = [permissions.IsAuthenticated]

class ShiftPlanViewSet(viewsets.ModelViewSet):
    queryset = ShiftPlan.objects.all()
    serializer_class = ShiftPlanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        factory = self.request.query_params.get('factory')
        if factory:
            queryset = queryset.filter(factory_id=factory)
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def bulk_generate(self, request):
        data = request.data
        plan_id = data.get('plan_id')
        plan_name = data.get('plan_name')
        from_date = data.get('from_date')
        to_date = data.get('to_date')
        remarks = data.get('remarks')
        factory_id = data.get('factory') or None  # May be None if not set
        days_data = data.get('days', [])  # List of objects containing date, and shifts
        conflict_resolution = data.get('conflict_resolution')  # 'overwrite', 'skip', or None
        
        if not all([plan_name, from_date, to_date]):
            return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            start_date = datetime.strptime(from_date, '%Y-%m-%d').date()
            end_date = datetime.strptime(to_date, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format'}, status=status.HTTP_400_BAD_REQUEST)
            
        if start_date > end_date:
            return Response({'error': 'From date must be before To date'}, status=status.HTTP_400_BAD_REQUEST)

        # Collect dates and shifts to check conflicts
        date_list = []
        shift_ids = set()
        
        for day in days_data:
            try:
                d_date = datetime.strptime(day['date'], '%Y-%m-%d').date()
                date_list.append(d_date)
                for s in day.get('shifts', []):
                    shift_ids.add(s['shift_id'])
            except (ValueError, KeyError):
                continue

        # Check conflicts (exclude the current plan if we are editing it)
        existing_days = ShiftPlanDay.objects.filter(plan_date__in=date_list, shift_id__in=list(shift_ids))
        if plan_id:
            existing_days = existing_days.exclude(shift_plan_id=plan_id)
            
        existing_count = existing_days.count()
        total_count = len(date_list) * len(shift_ids)
        available_count = total_count - existing_count

        if existing_count > 0 and not conflict_resolution:
            return Response({
                'conflict': True,
                'message': f"{existing_count} shifts already planned in this date range.",
                'existing_count': existing_count,
                'available_count': available_count,
                'total_count': total_count
            }, status=status.HTTP_409_CONFLICT)

        # Apply conflict resolution
        existing_pairs = set()
        if existing_count > 0:
            if conflict_resolution == 'overwrite':
                existing_days.delete()
            elif conflict_resolution == 'skip':
                # Capture coordinates of days to skip
                existing_pairs = set(
                    existing_days.values_list('plan_date', 'shift_id')
                )

        if plan_id:
            try:
                plan = ShiftPlan.objects.get(id=plan_id)
                plan.plan_name = plan_name
                plan.from_date = start_date
                plan.to_date = end_date
                plan.remarks = remarks
                plan.factory_id = factory_id
                plan.save()
                # Clear previous days to perform complete overwrite for this plan
                plan.days.all().delete()
            except ShiftPlan.DoesNotExist:
                return Response({'error': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            plan, created = ShiftPlan.objects.get_or_create(
                plan_name=plan_name,
                factory_id=factory_id,
                defaults={
                    'from_date': start_date,
                    'to_date': end_date,
                    'remarks': remarks,
                    'created_by': request.user
                }
            )
            if not created:
                plan.from_date = start_date
                plan.to_date = end_date
                plan.remarks = remarks
                plan.factory_id = factory_id
                plan.save()
            
        generated_count = 0
        for day in days_data:
            try:
                current_date = datetime.strptime(day['date'], '%Y-%m-%d').date()
            except (ValueError, KeyError):
                continue
            
            for shift_data in day.get('shifts', []):
                shift_id = int(shift_data['shift_id'])
                
                # If skip and this date/shift combination exists, skip it
                if conflict_resolution == 'skip' and (current_date, shift_id) in existing_pairs:
                    continue
                
                lines = shift_data.get('lines', [])
                
                day_obj, _ = ShiftPlanDay.objects.get_or_create(
                    shift_plan=plan,
                    plan_date=current_date,
                    shift_id=shift_id
                )
                
                for line_data in lines:
                    line_obj, pl_created = ShiftProductionLine.objects.get_or_create(
                        shift_day=day_obj,
                        production_line_id=line_data['production_line_id'],
                        defaults={
                            'stock_item_id': line_data['stock_item_id'],
                            'planned_quantity': line_data['planned_quantity'],
                            'start_time': line_data['start_time'],
                            'end_time': line_data['end_time'],
                            'employee_group_id': line_data.get('employee_group_id'),
                            'remarks': line_data.get('remarks', '')
                        }
                    )
                    if not pl_created:
                        line_obj.stock_item_id = line_data['stock_item_id']
                        line_obj.planned_quantity = line_data['planned_quantity']
                        line_obj.start_time = line_data['start_time']
                        line_obj.end_time = line_data['end_time']
                        line_obj.employee_group_id = line_data.get('employee_group_id')
                        line_obj.remarks = line_data.get('remarks', '')
                        line_obj.save()
                    
                    employees = line_data.get('employees', [])
                    line_obj.employees.all().delete()
                    
                    for emp_id in employees:
                        # Check employee conflict during save (Step 13)
                        overlap_exists = ShiftProductionEmployee.objects.filter(
                            employee_id=emp_id,
                            production_line__shift_day__plan_date=current_date,
                            production_line__start_time__lt=line_data['end_time'],
                            production_line__end_time__gt=line_data['start_time']
                        ).exists()
                        
                        if overlap_exists:
                            transaction.set_rollback(True)
                            conflict_line = ShiftProductionEmployee.objects.filter(
                                employee_id=emp_id,
                                production_line__shift_day__plan_date=current_date,
                                production_line__start_time__lt=line_data['end_time'],
                                production_line__end_time__gt=line_data['start_time']
                            ).first()
                            
                            line_name = conflict_line.production_line.production_line.name if conflict_line else 'another line'
                            return Response({
                                'conflict': True,
                                'message': f"Employee conflict detected: An employee is already assigned to {line_name} on {current_date} during this time."
                            }, status=status.HTTP_409_CONFLICT)
                        
                        ShiftProductionEmployee.objects.create(
                            production_line=line_obj,
                            employee_id=emp_id,
                            added_from_group_id=line_data.get('employee_group_id')
                        )
                generated_count += 1
                        
        return Response({'message': 'Bulk plan generated successfully', 'generated_count': generated_count}, status=status.HTTP_201_CREATED)

class ShiftPlanDayViewSet(viewsets.ModelViewSet):
    queryset = ShiftPlanDay.objects.all().select_related('shift', 'shift__factory', 'shift_plan').prefetch_related(
        'production_lines__production_line',
        'production_lines__stock_item',
        'production_lines__employee_group',
        'production_lines__employees__employee__user',
        'production_lines__employees__employee__dept_designation__designation'
    )
    serializer_class = ShiftPlanDaySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        plan_date = self.request.query_params.get('plan_date')
        if plan_date:
            queryset = queryset.filter(plan_date=plan_date)
        return queryset

class ShiftProductionLineViewSet(viewsets.ModelViewSet):
    queryset = ShiftProductionLine.objects.all()
    serializer_class = ShiftProductionLineSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        date = self.request.query_params.get('date')
        factory_id = self.request.query_params.get('factory_id')
        
        if date:
            queryset = queryset.filter(shift_day__plan_date=date)
        if factory_id:
            queryset = queryset.filter(shift_day__shift__factory_id=factory_id)

        assigned_to_me = self.request.query_params.get('assigned_to_me')
        if assigned_to_me and assigned_to_me.lower() == 'true':
            if not self.request.user.is_superuser:
                queryset = queryset.filter(post_production_responsibility__employee__user=self.request.user).distinct()
            
        return queryset

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status == 'COMPLETED':
            return Response(
                {"detail": "Cannot edit a completed production line."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status == 'COMPLETED':
            return Response(
                {"detail": "Cannot edit a completed production line."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status == 'COMPLETED':
            return Response(
                {"detail": "Cannot delete a completed production line."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

class ShiftProductionEmployeeViewSet(viewsets.ModelViewSet):
    queryset = ShiftProductionEmployee.objects.all()
    serializer_class = ShiftProductionEmployeeSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['post'])
    def validate_conflict(self, request):
        employee_id = request.data.get('employee_id')
        plan_date = request.data.get('plan_date')
        start_time = request.data.get('start_time')
        end_time = request.data.get('end_time')
        
        if not all([employee_id, plan_date, start_time, end_time]):
            return Response({'error': 'Missing parameters'}, status=status.HTTP_400_BAD_REQUEST)
            
        conflicts = ShiftProductionEmployee.objects.filter(
            employee_id=employee_id,
            production_line__shift_day__plan_date=plan_date,
            production_line__start_time__lt=end_time,
            production_line__end_time__gt=start_time
        ).select_related('production_line__shift_day__shift')
        
        if conflicts.exists():
            conflict = conflicts.first()
            return Response({
                'conflict': True,
                'message': f"Employee is already assigned to {conflict.production_line.production_line.name} during this time.",
                'conflict_id': conflict.id
            }, status=status.HTTP_200_OK)
            
        return Response({'conflict': False}, status=status.HTTP_200_OK)
        
    @action(detail=False, methods=['post'])
    @transaction.atomic
    def move_employee(self, request):
        conflict_id = request.data.get('conflict_id')
        new_production_line_id = request.data.get('production_line_id')
        employee_id = request.data.get('employee_id')
        added_from_group_id = request.data.get('added_from_group_id')
        
        if not all([conflict_id, new_production_line_id, employee_id]):
             return Response({'error': 'Missing parameters'}, status=status.HTTP_400_BAD_REQUEST)
             
        ShiftProductionEmployee.objects.filter(id=conflict_id).delete()
        
        new_assignment = ShiftProductionEmployee.objects.create(
            production_line_id=new_production_line_id,
            employee_id=employee_id,
            added_from_group_id=added_from_group_id
        )
        
        serializer = self.get_serializer(new_assignment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ProductionAttendanceViewSet(viewsets.ModelViewSet):
    queryset = ProductionAttendance.objects.all().select_related(
        'employee__user', 'production_line', 
        'shift_day__shift'
    ).prefetch_related('breaks')
    serializer_class = ProductionAttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        date = self.request.query_params.get('date')
        shift_id = self.request.query_params.get('shift_id')
        production_line_id = self.request.query_params.get('production_line_id')
        employee_id = self.request.query_params.get('employee_id')

        if date:
            queryset = queryset.filter(shift_day__plan_date=date)
        if shift_id:
            queryset = queryset.filter(shift_day__shift_id=shift_id)
        if production_line_id:
            queryset = queryset.filter(production_line_id=production_line_id)
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        return queryset

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def bulk_mark(self, request):
        production_line_id = request.data.get('production_line_id')
        shift_day_id = request.data.get('shift_day_id')
        employee_ids = request.data.get('employee_ids', [])
        action_type = request.data.get('action_type') # 'check_in', 'check_out', 'late_check_in', 'update_status', 'overtime_toggle'
        
        # fields below can be passed depending on action
        check_in_time = request.data.get('check_in_time')
        check_out_time = request.data.get('check_out_time')
        status_val = request.data.get('status')
        is_overtime_approved = request.data.get('is_overtime_approved')
        remarks = request.data.get('remarks')

        if not production_line_id or not shift_day_id or not employee_ids:
            return Response({'error': 'Missing line, shift day, or employee details.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            prod_line = ProductionLine.objects.get(id=production_line_id)
            shift_day = ShiftPlanDay.objects.get(id=shift_day_id)
        except (ProductionLine.DoesNotExist, ShiftPlanDay.DoesNotExist):
            return Response({'error': 'Production line or shift day not found.'}, status=status.HTTP_404_NOT_FOUND)

        now = timezone.now()
        if timezone.is_aware(now):
            now = timezone.make_naive(now)

        # Parse inputs once at view level to ensure offset-naive datetimes (USE_TZ = False compat)
        from django.utils.dateparse import parse_datetime
        parsed_in_time = None
        parsed_out_time = None

        if check_in_time:
            parsed_in_time = parse_datetime(check_in_time) if isinstance(check_in_time, str) else check_in_time
            if parsed_in_time and timezone.is_aware(parsed_in_time):
                parsed_in_time = timezone.make_naive(parsed_in_time)

        if check_out_time:
            parsed_out_time = parse_datetime(check_out_time) if isinstance(check_out_time, str) else check_out_time
            if parsed_out_time and timezone.is_aware(parsed_out_time):
                parsed_out_time = timezone.make_naive(parsed_out_time)

        results = []

        for emp_id in employee_ids:
            # Check if assignment actually exists for this line
            is_assigned = ShiftProductionEmployee.objects.filter(
                production_line__production_line=prod_line,
                production_line__shift_day=shift_day,
                employee_id=emp_id
            ).exists()
            if not is_assigned:
                continue

            if action_type in ['check_in', 'late_check_in']:
                # Only block if already checked in on THIS specific line + shift day
                existing_checkin = ProductionAttendance.objects.filter(
                    employee_id=emp_id,
                    shift_day=shift_day,
                    production_line=prod_line,
                    check_in_time__isnull=False
                ).first()
                if existing_checkin:
                    try:
                        emp_name = existing_checkin.employee.user.get_full_name() or existing_checkin.employee.user.username
                    except Exception:
                        emp_name = str(existing_checkin.employee)
                    line_name = existing_checkin.production_line.name
                    return Response(
                        {'error': f"Employee '{emp_name}' is already checked in on line '{line_name}' for this shift."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            attendance, created = ProductionAttendance.objects.get_or_create(
                employee_id=emp_id,
                shift_day=shift_day,
                production_line=prod_line,
                defaults={'status': 'PRESENT'}
            )

            # Update who verified this record
            attendance.verified_by = request.user

            if action_type == 'check_in':
                if not attendance.check_in_time:
                    attendance.check_in_time = parsed_in_time or now
                    attendance.status = 'PRESENT'
            elif action_type == 'late_check_in':
                attendance.check_in_time = parsed_in_time or now
                attendance.status = 'LATE'
            elif action_type == 'check_out':
                if not attendance.check_in_time or attendance.status == 'ABSENT':
                    try:
                        emp_name = attendance.employee.user.get_full_name() or attendance.employee.user.username
                    except Exception:
                        emp_name = str(attendance.employee)
                    return Response(
                        {'error': f"Employee '{emp_name}' cannot check out because they have not checked in yet."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                t_out = parsed_out_time or now
                t_in = attendance.check_in_time
                if t_out and t_in:
                    if hasattr(t_out, 'tzinfo') and t_out.tzinfo is not None:
                        t_out = t_out.replace(tzinfo=None)
                    if hasattr(t_in, 'tzinfo') and t_in.tzinfo is not None:
                        t_in = t_in.replace(tzinfo=None)

                    if t_out < t_in:
                        try:
                            emp_name = attendance.employee.user.get_full_name() or attendance.employee.user.username
                        except Exception:
                            emp_name = str(attendance.employee)
                        try:
                            in_time_str = timezone.localtime(attendance.check_in_time).strftime('%H:%M')
                        except Exception:
                            in_time_str = attendance.check_in_time.strftime('%H:%M')
                        return Response(
                            {'error': f"Employee '{emp_name}' check-out time cannot be earlier than check-in time ({in_time_str})."},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                
                attendance.check_out_time = parsed_out_time or now
            elif action_type == 'update_status':
                if status_val:
                    attendance.status = status_val
            elif action_type == 'overtime_toggle':
                if is_overtime_approved is not None:
                    attendance.is_overtime_approved = is_overtime_approved

            if parsed_in_time and action_type != 'check_in' and action_type != 'late_check_in':
                attendance.check_in_time = parsed_in_time
            if parsed_out_time and action_type != 'check_out':
                attendance.check_out_time = parsed_out_time
            if remarks is not None:
                attendance.remarks = remarks

            attendance.save()
            results.append(attendance)

        serializer = self.get_serializer(results, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def hr_summary(self, request):
        from_date_str = request.query_params.get('from_date')
        to_date_str = request.query_params.get('to_date')
        employee_id = request.query_params.get('employee_id')

        if not from_date_str or not to_date_str:
            return Response({'error': 'Missing from_date or to_date parameters.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            start_date = datetime.strptime(from_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(to_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)

        attendances = ProductionAttendance.objects.filter(
            shift_day__plan_date__range=[start_date, end_date]
        ).select_related('employee__user', 'employee__dept_designation__designation')

        if employee_id:
            attendances = attendances.filter(employee_id=employee_id)

        # Build list of daily records
        daily_records = []
        for att in attendances:
            emp_code = str(att.employee.id)
            try:
                if att.employee.candidate and att.employee.candidate.employment_details.exists():
                    emp_code = att.employee.candidate.employment_details.first().employment_no
            except Exception:
                pass

            daily_records.append({
                'id': att.id,
                'employee_id': att.employee.id,
                'employee_code': emp_code,
                'employee_name': str(att.employee),
                'designation': att.employee.dept_designation.designation.name if att.employee.dept_designation else '',
                'date': str(att.shift_day.plan_date),
                'shift_name': att.shift_day.shift.name,
                'production_line_name': att.production_line.name,
                'status': att.status,
                'check_in_time': att.check_in_time.isoformat() if att.check_in_time else None,
                'check_out_time': att.check_out_time.isoformat() if att.check_out_time else None,
                'total_work_minutes': att.total_work_minutes,
                'total_break_minutes': att.total_break_minutes,
                'net_work_minutes': att.net_work_minutes,
                'overtime_minutes': att.overtime_minutes if att.is_overtime_approved else 0,
                'is_overtime_approved': att.is_overtime_approved,
                'remarks': att.remarks
            })

        # Compile summaries grouped by employee
        summary_map = {}
        for att in attendances:
            emp = att.employee
            if emp.id not in summary_map:
                emp_code = str(emp.id)
                try:
                    if emp.candidate and emp.candidate.employment_details.exists():
                        emp_code = emp.candidate.employment_details.first().employment_no
                except Exception:
                    pass

                summary_map[emp.id] = {
                    'employee_id': emp.id,
                    'employee_code': emp_code,
                    'employee_name': str(emp),
                    'designation': emp.dept_designation.designation.name if emp.dept_designation else '',
                    'total_days_scheduled': 0,
                    'days_present': 0,
                    'days_absent': 0,
                    'days_late': 0,
                    'days_half_day': 0,
                    'days_leave': 0,
                    'total_work_minutes': 0,
                    'total_break_minutes': 0,
                    'net_work_minutes': 0,
                    'approved_overtime_minutes': 0,
                }
            
            s = summary_map[emp.id]
            s['total_days_scheduled'] += 1
            if att.status == 'PRESENT':
                s['days_present'] += 1
            elif att.status == 'ABSENT':
                s['days_absent'] += 1
            elif att.status == 'LATE':
                s['days_late'] += 1
            elif att.status == 'HALF_DAY':
                s['days_half_day'] += 1
            elif att.status == 'LEAVE':
                s['days_leave'] += 1

            s['total_work_minutes'] += att.total_work_minutes
            s['total_break_minutes'] += att.total_break_minutes
            s['net_work_minutes'] += att.net_work_minutes
            if att.is_overtime_approved:
                s['approved_overtime_minutes'] += att.overtime_minutes

        return Response({
            'daily_records': daily_records,
            'summary': list(summary_map.values())
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='employee-report')
    def employee_report(self, request):
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')
        employee_id = request.query_params.get('employee_id')

        # We need all attendances within the date range
        # using the base queryset which handles select_related etc.
        queryset = self.get_queryset()

        if from_date:
            queryset = queryset.filter(shift_day__plan_date__gte=from_date)
        if to_date:
            queryset = queryset.filter(shift_day__plan_date__lte=to_date)
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)

        employee_data = {}

        for attendance in queryset:
            emp = attendance.employee
            emp_id = emp.id
            if emp_id not in employee_data:
                try:
                    emp_name = emp.user.get_full_name() or emp.user.username
                except Exception:
                    emp_name = str(emp)
                
                emp_code = "-"
                try:
                    if hasattr(emp, 'candidate') and emp.candidate is not None:
                        emp_detail = emp.candidate.employment_details.first()
                        if emp_detail and emp_detail.employment_no:
                            emp_code = emp_detail.employment_no
                except Exception:
                    pass
                
                employee_data[emp_id] = {
                    'employee_id': emp_id,
                    'employee_code': emp_code,
                    'employee_name': emp_name,
                    'line_duration_minutes': 0,
                    'total_work_minutes': 0,
                    'net_work_minutes': 0,
                    'overtime_minutes': 0,
                    'late_minutes': 0,
                    'total_break_minutes': 0,
                }
                
            data = employee_data[emp_id]

            # Line duration: scheduled end_time - start_time
            try:
                shift_line = ShiftProductionLine.objects.get(
                    shift_day=attendance.shift_day,
                    production_line=attendance.production_line
                )
                if shift_line.start_time and shift_line.end_time:
                    dt_start = datetime.combine(attendance.shift_day.plan_date, shift_line.start_time)
                    dt_end = datetime.combine(attendance.shift_day.plan_date, shift_line.end_time)
                    if dt_end > dt_start:
                        line_dur = int((dt_end - dt_start).total_seconds() / 60)
                    elif dt_end < dt_start:
                        # Overnight shift
                        from datetime import timedelta
                        dt_end_next = dt_end + timedelta(days=1)
                        line_dur = int((dt_end_next - dt_start).total_seconds() / 60)
                    else:
                        line_dur = 0
                    data['line_duration_minutes'] += line_dur
            except (ShiftProductionLine.DoesNotExist, ShiftProductionLine.MultipleObjectsReturned):
                pass

            data['total_work_minutes'] += attendance.total_work_minutes
            data['net_work_minutes'] += attendance.net_work_minutes
            data['overtime_minutes'] += attendance.overtime_minutes
            data['total_break_minutes'] += attendance.total_break_minutes
            
            # calculate late minutes
            if attendance.check_in_time:
                try:
                    shift_line = ShiftProductionLine.objects.get(
                        shift_day=attendance.shift_day,
                        production_line=attendance.production_line
                    )
                    scheduled_start = shift_line.start_time
                    if scheduled_start:
                        # naive datetime for comparison
                        check_in_local = attendance.check_in_time
                        if timezone.is_aware(check_in_local):
                            check_in_local = timezone.make_naive(check_in_local)
                        
                        dt_start = datetime.combine(attendance.shift_day.plan_date, scheduled_start)
                        if check_in_local > dt_start:
                            delay = check_in_local - dt_start
                            data['late_minutes'] += int(delay.total_seconds() / 60)
                except ShiftProductionLine.DoesNotExist:
                    pass
                except ShiftProductionLine.MultipleObjectsReturned:
                    pass

        def format_hm(minutes):
            h = minutes // 60
            m = minutes % 60
            return f"{h:02d}:{m:02d}"

        result = []
        for emp_id, data in employee_data.items():
            result.append({
                'employee_id': data['employee_id'],
                'employee_code': data['employee_code'],
                'employee_name': data['employee_name'],
                'total_working_hours': format_hm(data['line_duration_minutes']),
                'present_hours': format_hm(data['net_work_minutes']),
                'ot_hours': format_hm(data['overtime_minutes']),
                'late_hours': format_hm(data['late_minutes']),
                'late_minutes': data['late_minutes'],
                'total_break_hours': format_hm(data['total_break_minutes']),
                'net_hours': format_hm(data['net_work_minutes'] + data['overtime_minutes']),
            })
            
        return Response(result, status=status.HTTP_200_OK)



class ProductionBreakLogViewSet(viewsets.ModelViewSet):
    queryset = ProductionBreakLog.objects.all().select_related('attendance__employee__user')
    serializer_class = ProductionBreakLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def break_start(self, request):
        production_line_id = request.data.get('production_line_id')
        shift_day_id = request.data.get('shift_day_id')
        employee_ids = request.data.get('employee_ids', [])
        break_type = request.data.get('break_type', 'GENERAL')
        start_time_str = request.data.get('start_time')

        if not production_line_id or not employee_ids:
            return Response({'error': 'Missing production line or employee details.'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        start_time = now
        if timezone.is_aware(start_time):
            start_time = timezone.make_naive(start_time)
            
        if start_time_str:
            try:
                parsed_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
                if timezone.is_aware(parsed_time):
                    start_time = timezone.make_naive(parsed_time)
                else:
                    start_time = parsed_time
            except ValueError:
                return Response({'error': 'Invalid start_time format.'}, status=status.HTTP_400_BAD_REQUEST)

        results = []
        for emp_id in employee_ids:
            try:
                qs = ProductionAttendance.objects.filter(
                    production_line_id=production_line_id,
                    employee_id=emp_id
                )
                if shift_day_id:
                    qs = qs.filter(shift_day_id=shift_day_id)
                attendance = qs.get()
            except ProductionAttendance.DoesNotExist:
                continue
            except ProductionAttendance.MultipleObjectsReturned:
                # Fallback: take the most recent record for this line
                attendance = qs.order_by('-shift_day__plan_date').first()
                if not attendance:
                    continue

            if not attendance.check_in_time:
                # Can't start break if not checked in
                continue

            # Check if there is an active break already running
            active_break = attendance.breaks.filter(end_time__isnull=True).first()
            if active_break:
                continue

            # Fetch the actual break type master to get duration
            try:
                break_type_master = BreakTypeMaster.objects.get(id=break_type)
                allowed_duration = break_type_master.duration_minutes
            except BreakTypeMaster.DoesNotExist:
                allowed_duration = 15 # Fallback

            brk = ProductionBreakLog.objects.create(
                attendance=attendance,
                break_type_id=break_type,
                start_time=start_time,
                allowed_duration_minutes=allowed_duration
            )
            results.append(brk)

        serializer = self.get_serializer(results, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def break_end(self, request):
        production_line_id = request.data.get('production_line_id')
        shift_day_id = request.data.get('shift_day_id')
        employee_ids = request.data.get('employee_ids', [])
        end_time_str = request.data.get('end_time')

        if not production_line_id or not employee_ids:
            return Response({'error': 'Missing production line or employee details.'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        end_time = now
        if timezone.is_aware(end_time):
            end_time = timezone.make_naive(end_time)
            
        if end_time_str:
            try:
                parsed_time = datetime.fromisoformat(end_time_str.replace('Z', '+00:00'))
                if timezone.is_aware(parsed_time):
                    end_time = timezone.make_naive(parsed_time)
                else:
                    end_time = parsed_time
            except ValueError:
                return Response({'error': 'Invalid end_time format.'}, status=status.HTTP_400_BAD_REQUEST)

        results = []
        for emp_id in employee_ids:
            # Find the active break for the employee, scoped to the specific shift day
            qs = ProductionBreakLog.objects.filter(
                attendance__production_line_id=production_line_id,
                attendance__employee_id=emp_id,
                end_time__isnull=True
            )
            if shift_day_id:
                qs = qs.filter(attendance__shift_day_id=shift_day_id)
            active_break = qs.first()

            if active_break:
                active_break.end_time = end_time
                active_break.save()
                results.append(active_break)

        serializer = self.get_serializer(results, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)



class PostProductionEntryViewSet(viewsets.ModelViewSet):
    queryset = PostProductionEntry.objects.all()
    serializer_class = PostProductionEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        entry = serializer.save()
        line = entry.production_line
        if line and line.status != 'COMPLETED':
            line.status = 'COMPLETED'
            line.save()

    def perform_update(self, serializer):
        instance = serializer.instance
        if hasattr(instance, 'rnd_entry') and instance.rnd_entry is not None:
            raise serializers.ValidationError("This Post Production entry cannot be edited because an R&D entry has already been saved for it.")
        entry = serializer.save()
        line = entry.production_line
        if line and line.status != 'COMPLETED':
            line.status = 'COMPLETED'
            line.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if hasattr(instance, 'rnd_entry') and instance.rnd_entry is not None:
            return Response(
                {"detail": "This Post Production entry cannot be deleted because an R&D entry has already been saved for it."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

    def get_queryset(self):
        queryset = super().get_queryset()
        production_line_id = self.request.query_params.get('production_line_id')
        if production_line_id:
            queryset = queryset.filter(production_line_id=production_line_id)
        return queryset


class PostProductionResponsibilityViewSet(viewsets.ModelViewSet):
    queryset = PostProductionResponsibility.objects.all()
    serializer_class = PostProductionResponsibilitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        line_id = self.request.query_params.get('production_line_id')
        if line_id:
            queryset = queryset.filter(production_line_id=line_id)
        return queryset


class AdjustmentViewSet(viewsets.ModelViewSet):
    queryset = PostProductionEntry.objects.filter(
        production_type='ADJUSTMENT'
    ).select_related(
        'stock_item',
        'stock_item__base_unit',
        'stock_item__alternate_unit',
        'rnd_entry'
    ).prefetch_related('extra_quantities').order_by('-created_at')
    serializer_class = AdjustmentPostProductionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        stock_item_id = self.request.query_params.get('stock_item_id')
        if stock_item_id:
            queryset = queryset.filter(stock_item_id=stock_item_id)
        
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(stock_item__name__icontains=search) |
                Q(stock_item__item_code__icontains=search)
            )

        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')
        if from_date:
            queryset = queryset.filter(created_at__date__gte=from_date)
        if to_date:
            queryset = queryset.filter(created_at__date__lte=to_date)

        return queryset

    @action(detail=False, methods=['get'], url_path='stock-items')
    def stock_items(self, request):
        """
        Returns stock items that have available unadjusted extra quantity.
        If adjustment_id is provided, includes the stock item of that adjustment even if balance is 0.
        """
        adjustment_id = request.query_params.get('adjustment_id')
        extra_stock_item_ids = []
        if adjustment_id:
            try:
                adj = PostProductionEntry.objects.filter(id=adjustment_id, production_type='ADJUSTMENT').first()
                if adj and adj.stock_item_id:
                    extra_stock_item_ids.append(adj.stock_item_id)
            except Exception:
                pass

        available_eqs = ExtraQuantity.objects.filter(
            post_production__isnull=True,
            out_quantity=0,
            in_quantity__gt=0,
            stock_item__isnull=False
        )

        item_stats = available_eqs.values('stock_item_id').annotate(
            total_qty=Sum('in_quantity'),
            entries_count=Count('id')
        )
        stats_map = {stat['stock_item_id']: stat for stat in item_stats}

        all_item_ids = set(stats_map.keys()) | set(extra_stock_item_ids)
        stock_items = StockItem.objects.filter(id__in=all_item_ids).select_related('base_unit', 'alternate_unit').order_by('name')

        items_data = []
        for item in stock_items:
            stat = stats_map.get(item.id, {})
            items_data.append({
                'id': item.id,
                'name': item.name,
                'item_code': item.item_code,
                'base_unit_name': item.base_unit.name if item.base_unit else '',
                'alternate_unit_name': item.alternate_unit.name if item.alternate_unit else '',
                'conversion_value': item.conversion_value or 1,
                'total_available_alt_qty': stat.get('total_qty', 0),
                'available_entries_count': stat.get('entries_count', 0),
            })

        return Response(items_data)

    @action(detail=False, methods=['get'], url_path='available-entries')
    def available_entries(self, request):
        """
        Returns available unadjusted ExtraQuantity rows for a given stock_item_id.
        If adjustment_id is provided, also includes ExtraQuantity rows currently allocated to that adjustment.
        """
        stock_item_id = request.query_params.get('stock_item_id')
        adjustment_id = request.query_params.get('adjustment_id')
        if not stock_item_id:
            return Response({"detail": "stock_item_id query param is required."}, status=status.HTTP_400_BAD_REQUEST)

        q = Q(stock_item_id=stock_item_id, post_production__isnull=True, out_quantity=0, in_quantity__gt=0)
        if adjustment_id:
            try:
                adj_id = int(adjustment_id)
                q |= Q(stock_item_id=stock_item_id, post_production_id=adj_id, in_quantity__gt=0)
            except (ValueError, TypeError):
                pass

        entries = ExtraQuantity.objects.filter(q).select_related(
            'stock_item',
            'unit',
            'production_line__production_line',
            'production_line__shift_day__shift'
        ).order_by('-created_at')

        serializer = AdjustmentAvailableEntrySerializer(entries, many=True, context={'adjustment_id': adjustment_id})
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='create-adjustment')
    def create_adjustment(self, request):
        """
        Creates an adjustment PostProductionEntry from selected ExtraQuantity rows.
        Supports both full and partial consumption of ExtraQuantity rows.
        Payload can contain:
          - entries: [{"id": 1, "consume_quantity": 10}, {"id": 2, "consume_quantity": 1}, ...]
          - extra_quantity_ids: [1, 2, 3] (consumes full available quantity of each)
        """
        stock_item_id = request.data.get('stock_item_id')
        entries_data = request.data.get('entries')
        extra_quantity_ids = request.data.get('extra_quantity_ids', [])

        if not stock_item_id:
            return Response({"detail": "stock_item_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        consume_map = {}
        if entries_data and isinstance(entries_data, list):
            for item in entries_data:
                eq_id = item.get('id')
                qty_raw = item.get('consume_quantity')
                if eq_id is not None and qty_raw is not None:
                    try:
                        qty = Decimal(str(qty_raw))
                        if qty > 0:
                            consume_map[int(eq_id)] = qty
                    except (ValueError, TypeError):
                        pass
            extra_quantity_ids = list(consume_map.keys())
        elif isinstance(extra_quantity_ids, list):
            extra_quantity_ids = [int(x) for x in extra_quantity_ids if str(x).isdigit()]

        if not extra_quantity_ids:
            return Response({"detail": "No valid entries or quantities provided for adjustment."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            stock_item = StockItem.objects.select_related('base_unit', 'alternate_unit').get(id=stock_item_id)
        except StockItem.DoesNotExist:
            return Response({"detail": "StockItem not found."}, status=status.HTTP_404_NOT_FOUND)

        conversion_val = Decimal(str(stock_item.conversion_value or 0))
        if conversion_val <= 0:
            return Response({"detail": f"StockItem '{stock_item.name}' does not have a valid positive conversion value configured."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            selected_entries = list(
                ExtraQuantity.objects.select_for_update().filter(
                    id__in=extra_quantity_ids,
                    stock_item_id=stock_item_id
                )
            )

            if len(selected_entries) != len(extra_quantity_ids):
                return Response(
                    {"detail": "Some selected extra quantity entries were not found or do not belong to the selected stock item."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            already_adjusted = [eq.id for eq in selected_entries if eq.post_production_id is not None or eq.out_quantity > 0]
            if already_adjusted:
                return Response(
                    {"detail": f"Entries {already_adjusted} have already been adjusted or consumed."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            total_qty = Decimal('0')
            for eq in selected_entries:
                consume_qty = consume_map.get(eq.id, eq.in_quantity)
                if consume_qty <= 0 or consume_qty > eq.in_quantity:
                    return Response(
                        {"detail": f"Consume quantity for entry #{eq.id} ({consume_qty}) must be > 0 and <= available quantity ({eq.in_quantity})."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                consume_map[eq.id] = consume_qty
                total_qty += consume_qty

            alt_unit = stock_item.alternate_unit.name if stock_item.alternate_unit else "units"
            prim_unit = stock_item.base_unit.name if stock_item.base_unit else "case"

            if total_qty < conversion_val:
                return Response(
                    {"detail": f"Insufficient alternate quantity selected ({total_qty} {alt_unit}). Exactly {conversion_val} {alt_unit} (or a multiple thereof) is required to produce 1 {prim_unit}."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if total_qty % conversion_val != 0:
                remainder = total_qty % conversion_val
                return Response(
                    {"detail": f"Selected alternate quantity ({total_qty} {alt_unit}) must be an exact multiple of the conversion value ({conversion_val} {alt_unit} per 1 {prim_unit}). Found {remainder} leftover {alt_unit}."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            cases_calculated = int(total_qty // conversion_val)

            post_prod = PostProductionEntry.objects.create(
                production_line=None,
                production_type='ADJUSTMENT',
                stock_item=stock_item,
                manufactured_quantity=cases_calculated,
                damaged_quantity=0,
                balance=cases_calculated,
                balance_primary=cases_calculated,
                balance_alternate=0,
                actual_use_quantity=cases_calculated
            )

            for eq in selected_entries:
                consume_qty = consume_map[eq.id]
                original_in = eq.in_quantity
                if consume_qty == original_in:
                    # Fully consumed entry: link to adjustment, maintain purely as IN (out_quantity=0)
                    eq.post_production = post_prod
                    eq.out_quantity = Decimal('0.00')
                    eq.save(update_fields=['post_production', 'out_quantity', 'updated_at'])
                else:
                    # Partial consumption: update incoming portion to consumed amount (purely as IN)
                    remaining_qty = original_in - consume_qty
                    eq.in_quantity = consume_qty
                    eq.out_quantity = Decimal('0.00')
                    eq.post_production = post_prod
                    eq.save(update_fields=['in_quantity', 'out_quantity', 'post_production', 'updated_at'])

                    # Create a new unallocated entry for the remaining unconsumed balance (purely as IN)
                    ExtraQuantity.objects.create(
                        post_production=None,
                        stock_item=stock_item,
                        production_line=eq.production_line,
                        unit=eq.unit,
                        in_quantity=remaining_qty,
                        out_quantity=Decimal('0.00')
                    )

                # Create dedicated OUT row in extra quantity table for the used quantity
                ExtraQuantity.objects.create(
                    post_production=post_prod,
                    stock_item=stock_item,
                    production_line=eq.production_line,
                    unit=eq.unit,
                    in_quantity=Decimal('0.00'),
                    out_quantity=consume_qty
                )

        serializer = AdjustmentPostProductionSerializer(post_prod)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['put', 'patch', 'post'], url_path='update-adjustment')
    def update_adjustment(self, request, pk=None):
        """
        Updates an existing adjustment PostProductionEntry by re-allocating ExtraQuantity entries.
        Reverts the previous allocation, then allocates the new selection atomically.
        """
        post_prod = self.get_object()
        if post_prod.production_type != 'ADJUSTMENT':
            return Response({"detail": "Only adjustment entries can be modified here."}, status=status.HTTP_400_BAD_REQUEST)

        if hasattr(post_prod, 'rnd_entry') and post_prod.rnd_entry is not None:
            return Response(
                {"detail": "This adjustment entry cannot be edited because an R&D entry has already been saved for it."},
                status=status.HTTP_400_BAD_REQUEST
            )

        stock_item = post_prod.stock_item
        if not stock_item:
            stock_item_id = request.data.get('stock_item_id')
            if stock_item_id:
                try:
                    stock_item = StockItem.objects.select_related('base_unit', 'alternate_unit').get(id=stock_item_id)
                except StockItem.DoesNotExist:
                    return Response({"detail": "StockItem not found."}, status=status.HTTP_404_NOT_FOUND)
            else:
                return Response({"detail": "Adjustment stock item not found."}, status=status.HTTP_400_BAD_REQUEST)

        entries_data = request.data.get('entries')
        extra_quantity_ids = request.data.get('extra_quantity_ids', [])

        consume_map = {}
        if entries_data and isinstance(entries_data, list):
            for item in entries_data:
                eq_id = item.get('id')
                qty_raw = item.get('consume_quantity')
                if eq_id is not None and qty_raw is not None:
                    try:
                        qty = Decimal(str(qty_raw))
                        if qty > 0:
                            consume_map[int(eq_id)] = qty
                    except (ValueError, TypeError):
                        pass
            extra_quantity_ids = list(consume_map.keys())
        elif isinstance(extra_quantity_ids, list):
            extra_quantity_ids = [int(x) for x in extra_quantity_ids if str(x).isdigit()]

        if not extra_quantity_ids:
            return Response({"detail": "No valid entries or quantities provided for adjustment."}, status=status.HTTP_400_BAD_REQUEST)

        conversion_val = Decimal(str(stock_item.conversion_value or 0))
        if conversion_val <= 0:
            return Response({"detail": f"StockItem '{stock_item.name}' does not have a valid positive conversion value configured."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # 1. Revert previous consumption for this adjustment
            # Delete old dedicated OUT rows for this adjustment
            ExtraQuantity.objects.filter(post_production=post_prod, out_quantity__gt=0).delete()
            # Set old allocated incoming rows back to unallocated
            ExtraQuantity.objects.filter(post_production=post_prod, in_quantity__gt=0).update(post_production=None)

            # 2. Select requested entries with lock
            selected_entries = list(
                ExtraQuantity.objects.select_for_update().filter(
                    id__in=extra_quantity_ids,
                    stock_item_id=stock_item.id
                )
            )

            if len(selected_entries) != len(extra_quantity_ids):
                return Response(
                    {"detail": "Some selected extra quantity entries were not found or do not belong to the selected stock item."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check if any entry is allocated to another post production entry
            already_adjusted = [eq.id for eq in selected_entries if eq.post_production_id is not None or eq.out_quantity > 0]
            if already_adjusted:
                return Response(
                    {"detail": f"Entries {already_adjusted} have already been adjusted or consumed."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            total_qty = Decimal('0')
            for eq in selected_entries:
                consume_qty = consume_map.get(eq.id, eq.in_quantity)
                if consume_qty <= 0 or consume_qty > eq.in_quantity:
                    return Response(
                        {"detail": f"Consume quantity for entry #{eq.id} ({consume_qty}) must be > 0 and <= available quantity ({eq.in_quantity})."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                consume_map[eq.id] = consume_qty
                total_qty += consume_qty

            alt_unit = stock_item.alternate_unit.name if stock_item.alternate_unit else "units"
            prim_unit = stock_item.base_unit.name if stock_item.base_unit else "case"

            if total_qty < conversion_val:
                return Response(
                    {"detail": f"Insufficient alternate quantity selected ({total_qty} {alt_unit}). Exactly {conversion_val} {alt_unit} (or a multiple thereof) is required to produce 1 {prim_unit}."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if total_qty % conversion_val != 0:
                remainder = total_qty % conversion_val
                return Response(
                    {"detail": f"Selected alternate quantity ({total_qty} {alt_unit}) must be an exact multiple of the conversion value ({conversion_val} {alt_unit} per 1 {prim_unit}). Found {remainder} leftover {alt_unit}."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            cases_calculated = int(total_qty // conversion_val)

            # Update manufactured_quantity and balance on post_prod
            post_prod.manufactured_quantity = cases_calculated
            post_prod.balance = cases_calculated
            post_prod.balance_primary = cases_calculated
            post_prod.actual_use_quantity = cases_calculated
            post_prod.save(update_fields=['manufactured_quantity', 'balance', 'balance_primary', 'actual_use_quantity', 'updated_at'])

            for eq in selected_entries:
                consume_qty = consume_map[eq.id]
                original_in = eq.in_quantity
                if consume_qty == original_in:
                    eq.post_production = post_prod
                    eq.out_quantity = Decimal('0.00')
                    eq.save(update_fields=['post_production', 'out_quantity', 'updated_at'])
                else:
                    remaining_qty = original_in - consume_qty
                    eq.in_quantity = consume_qty
                    eq.out_quantity = Decimal('0.00')
                    eq.post_production = post_prod
                    eq.save(update_fields=['in_quantity', 'out_quantity', 'post_production', 'updated_at'])

                    ExtraQuantity.objects.create(
                        post_production=None,
                        stock_item=stock_item,
                        production_line=eq.production_line,
                        unit=eq.unit,
                        in_quantity=remaining_qty,
                        out_quantity=Decimal('0.00')
                    )

                ExtraQuantity.objects.create(
                    post_production=post_prod,
                    stock_item=stock_item,
                    production_line=eq.production_line,
                    unit=eq.unit,
                    in_quantity=Decimal('0.00'),
                    out_quantity=consume_qty
                )

        serializer = AdjustmentPostProductionSerializer(post_prod)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def update(self, request, *args, **kwargs):
        return self.update_adjustment(request, pk=kwargs.get('pk'))

    def partial_update(self, request, *args, **kwargs):
        return self.update_adjustment(request, pk=kwargs.get('pk'))

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if hasattr(instance, 'rnd_entry') and instance.rnd_entry is not None:
            return Response(
                {"detail": "This adjustment entry cannot be deleted because an R&D entry has already been saved for it."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)
