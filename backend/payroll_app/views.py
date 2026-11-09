from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from payroll_app.models import (
    PayrollUnit,
    PayrollCompoundUnit,
    AttendanceProductionType,
    CalculationType,
    PayHead,
    EmployeePayHead,
)
from payroll_app.serializers import (
    PayrollUnitSerializer,
    PayrollCompoundUnitSerializer,
    AttendanceProductionTypeSerializer,
    CalculationTypeSerializer,
    PayHeadSerializer,
    EmployeePayHeadSerializer,
)

def ensure_default_calculation_types():
    try:
        if not CalculationType.objects.exists():
            default_types = [
                "Formula & Slab Computed",
                "Manual Value",
                "Fixed Flat Rate",
                "Attendance-Based",
                "Production / Output-Based",
            ]
            all_units = list(PayrollUnit.objects.all())
            for name in default_types:
                ct = CalculationType.objects.create(name=name)
                if all_units:
                    ct.payroll_units.set(all_units)
    except Exception:
        pass


class PayrollUnitViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = PayrollUnit.objects.all()
    serializer_class = PayrollUnitSerializer


class PayrollCompoundUnitViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = PayrollCompoundUnit.objects.all()
    serializer_class = PayrollCompoundUnitSerializer


class AttendanceProductionTypeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = AttendanceProductionType.objects.select_related(
        'payroll_unit',
        'compound_unit__compound_unit',
        'compound_unit__base_unit'
    ).all()
    serializer_class = AttendanceProductionTypeSerializer


class CalculationTypeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = CalculationType.objects.prefetch_related(
        'payroll_units',
        'attendance_production_types__payroll_unit',
        'attendance_production_types__compound_unit__compound_unit',
        'attendance_production_types__compound_unit__base_unit',
    ).all()
    serializer_class = CalculationTypeSerializer

    def get_queryset(self):
        ensure_default_calculation_types()
        qs = super().get_queryset()
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(name__icontains=search)
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            if is_active.lower() in ['true', '1']:
                qs = qs.filter(is_active=True)
            elif is_active.lower() in ['false', '0']:
                qs = qs.filter(is_active=False)
        return qs


class PayHeadViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = PayHead.objects.select_related(
        'under',
        'created_by',
        'calculation_type',
        'calculation_period',
        'attendance_production_type',
        'attendance_production_type__payroll_unit',
        'attendance_production_type__compound_unit__compound_unit',
        'computation',
    ).prefetch_related(
        'computation__slabs'
    ).all()
    serializer_class = PayHeadSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        pay_head_type = self.request.query_params.get('pay_head_type')
        if pay_head_type:
            qs = qs.filter(pay_head_type=pay_head_type)

        income_type = self.request.query_params.get('income_type')
        if income_type:
            qs = qs.filter(income_type=income_type)

        calculation_type = self.request.query_params.get('calculation_type')
        if calculation_type:
            qs = qs.filter(calculation_type=calculation_type)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            if is_active.lower() in ['true', '1']:
                qs = qs.filter(is_active=True)
            elif is_active.lower() in ['false', '0']:
                qs = qs.filter(is_active=False)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(name__icontains=search)

        return qs

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(created_by=user)


class EmployeePayHeadViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = EmployeePayHead.objects.select_related(
        'employee',
        'pay_head',
        'pay_head__calculation_type',
        'pay_head__calculation_period',
        'pay_head__attendance_production_type',
        'pay_head__attendance_production_type__payroll_unit',
        'pay_head__attendance_production_type__compound_unit__compound_unit',
        'pay_head__computation',
    ).all()
    serializer_class = EmployeePayHeadSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        emp_id = self.request.query_params.get('employee') or self.request.query_params.get('employee_id')
        cand_id = self.request.query_params.get('candidate') or self.request.query_params.get('candidate_id')
        if emp_id:
            qs = qs.filter(employee_id=emp_id)
        elif cand_id:
            from django.db.models import Q
            qs = qs.filter(Q(employee__candidate_id=cand_id) | Q(employee__user_id=cand_id) | Q(employee_id=cand_id))
        effective_from = self.request.query_params.get('effective_from')
        if effective_from:
            qs = qs.filter(effective_from=effective_from)
        return qs.order_by('order', 'id')

    @action(detail=False, methods=['post'], url_path='bulk-save')
    def bulk_save(self, request):
        emp_id = request.data.get('employee') or request.data.get('employee_id')
        cand_id = request.data.get('candidate') or request.data.get('candidate_id')

        if not emp_id and cand_id:
            from hr_app.models import Candidate
            candidate_obj = Candidate.objects.filter(id=cand_id).first()
            if candidate_obj and hasattr(candidate_obj, 'employee_profile') and candidate_obj.employee_profile:
                emp_id = candidate_obj.employee_profile.id

        if not emp_id and cand_id:
            from rarenett_app.models import Employee
            emp = Employee.objects.filter(candidate_id=cand_id).first()
            if not emp:
                emp = Employee.objects.filter(user_id=cand_id).first()
            if emp:
                emp_id = emp.id

        if not emp_id:
            return Response({'detail': 'Employee ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        rows = request.data.get('rows', [])
        with transaction.atomic():
            EmployeePayHead.objects.filter(employee_id=emp_id).delete()
            created_instances = []
            for idx, r in enumerate(rows):
                pay_head_id = r.get('pay_head')
                if not pay_head_id:
                    continue
                rate_val = r.get('rate')
                if rate_val == '' or rate_val is None:
                    rate_val = None
                else:
                    try:
                        rate_val = float(str(rate_val).replace(',', '').strip())
                    except (ValueError, TypeError):
                        rate_val = None
                per_val = r.get('per')
                if not per_val:
                    ph = PayHead.objects.filter(id=pay_head_id).first()
                    if ph:
                        if ph.calculation_period:
                            per_val = ph.calculation_period.symbol or ph.calculation_period.formal_name or ''
                        elif ph.attendance_production_type:
                            apt = ph.attendance_production_type
                            if apt.payroll_unit:
                                per_val = apt.payroll_unit.symbol or apt.payroll_unit.formal_name or ''
                            elif apt.compound_unit and apt.compound_unit.compound_unit:
                                per_val = apt.compound_unit.compound_unit.symbol or apt.compound_unit.compound_unit.formal_name or ''
                            else:
                                per_val = apt.name or ''
                if not per_val:
                    per_val = ''
                inst = EmployeePayHead.objects.create(
                    employee_id=emp_id,
                    effective_from=r.get('effective_from') or None,
                    pay_head_id=pay_head_id,
                    rate=rate_val,
                    per=per_val,
                    order=r.get('order', idx),
                )
                created_instances.append(inst)

            serialized = EmployeePayHeadSerializer(created_instances, many=True)
            return Response(serialized.data, status=status.HTTP_200_OK)



