import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.apps import apps
from django.db import transaction

# Defined Modules & Tables to Truncate
TABLE_GROUPS = {
    'designations': [
        ('rarenett_app', 'DepartmentDesignation'),
        ('rarenett_app', 'Designation'),
    ],
    'departments': [
        ('rarenett_app', 'DepartmentDesignation'),
        ('rarenett_app', 'Department'),
    ],
    'hr': [
        ('production_app', 'EmployeeGroupMember'),
        ('production_app', 'EmployeeGroup'),
        ('rarenett_app', 'Employee'),
        ('rarenett_app', 'DepartmentDesignation'),
        ('rarenett_app', 'Designation'),
        ('rarenett_app', 'Department'),
        ('rarenett_app', 'Candidate'),
    ],
    'hr_masters': [
        ('production_app', 'EmployeeGroupMember'),
        ('production_app', 'EmployeeGroup'),
        ('rarenett_app', 'Employee'),
        ('rarenett_app', 'DepartmentDesignation'),
        ('rarenett_app', 'Designation'),
        ('rarenett_app', 'Department'),
        ('rarenett_app', 'Candidate'),
    ],
    'sales': [
        ('sales_app', 'SalesInvoiceDetail'),
        ('sales_app', 'SalesInvoice'),
        ('sales_app', 'SalesReturnDetail'),
        ('sales_app', 'SalesReturn'),
        ('sales_app', 'SalesOrderDetail'),
        ('sales_app', 'SalesOrder'),
        ('sales_app', 'DailyEntry'),
    ],
    'purchase': [
        ('purchase_app', 'PurchaseInvoiceDetail'),
        ('purchase_app', 'PurchaseInvoice'),
        ('purchase_app', 'PurchaseReturnDetail'),
        ('purchase_app', 'PurchaseReturn'),
        ('purchase_app', 'PurchaseOrderDetail'),
        ('purchase_app', 'PurchaseOrder'),
    ],
    'roles': [
        ('register_app', 'RoleMenuPermission'),
        ('register_app', 'UserRoleAssignment'),
        ('register_app', 'Role'),
    ],
    'candidate_employee': [
        ('production_app', 'EmployeeGroupMember'),
        ('production_app', 'EmployeeGroup'),
        ('rarenett_app', 'EmployeeWorkExperience'),
        ('rarenett_app', 'EmployeeDocumentUpload'),
        ('rarenett_app', 'BankDetails'),
        ('rarenett_app', 'EmployeeRoleExpiry'),
        ('rarenett_app', 'EmploymentDetails'),
        ('rarenett_app', 'Employee'),
        ('rarenett_app', 'Candidate'),
    ],
    'production': [
        ('production_app', 'PostProductionDamagedMaterial'),
        ('production_app', 'PostProductionResponsibility'),
        ('production_app', 'PostProductionEntry'),
        ('production_app', 'ProductionBreakLog'),
        ('production_app', 'ProductionAttendance'),
        ('production_app', 'ShiftProductionEmployee'),
        ('production_app', 'ShiftProductionLine'),
        ('production_app', 'ShiftPlanDay'),
        ('production_app', 'ShiftPlan'),
        ('production_app', 'ProductionLine'),
        ('production_app', 'Shift'),
        ('production_app', 'EmployeeGroupMember'),
        ('production_app', 'EmployeeGroup'),
        ('production_app', 'BreakTypeMaster'),
    ],
    'rarenett_app': [
        ('production_app', 'EmployeeGroupMember'),
        ('production_app', 'EmployeeGroup'),
        ('rarenett_app', 'EmployeeWorkExperience'),
        ('rarenett_app', 'BODIdProof'),
        ('rarenett_app', 'BoardOfDirector'),
        ('rarenett_app', 'Comment'),
        ('rarenett_app', 'BankDetails'),
        ('rarenett_app', 'EmployeeDocumentUpload'),
        ('rarenett_app', 'EmployeeRoleExpiry'),
        ('rarenett_app', 'EmploymentDetails'),
        ('rarenett_app', 'Holiday'),
        ('rarenett_app', 'Employee'),
        ('rarenett_app', 'Candidate'),
        ('rarenett_app', 'DepartmentDesignation'),
        ('rarenett_app', 'Designation'),
        ('rarenett_app', 'Department'),
    ],
}

def clear_protected_role_references():
    try:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        users_updated = User.objects.filter(role__isnull=False).update(role=None)
        if users_updated > 0:
            print(f"✓ Unlinked role from {users_updated} User records.")
    except Exception as e:
        print(f"✗ Failed unlinking User role: {e}")

    try:
        Candidate = apps.get_model('rarenett_app', 'Candidate')
        cand_updated = Candidate.objects.filter(role__isnull=False).update(role=None)
        if cand_updated > 0:
            print(f"✓ Unlinked role from {cand_updated} Candidate records.")
    except Exception as e:
        print(f"✗ Failed unlinking Candidate role: {e}")

def clear_protected_designation_references():
    try:
        Employee = apps.get_model('rarenett_app', 'Employee')
        emp_updated = Employee.objects.filter(dept_designation__isnull=False).update(dept_designation=None)
        if emp_updated > 0:
            print(f"✓ Unlinked dept_designation from {emp_updated} Employee records.")
    except Exception as e:
        print(f"✗ Failed unlinking Employee dept_designation: {e}")

    try:
        EmployeeGroupMember = apps.get_model('production_app', 'EmployeeGroupMember')
        group_deleted, _ = EmployeeGroupMember.objects.all().delete()
        if group_deleted > 0:
            print(f"✓ Removed {group_deleted} EmployeeGroupMember records.")
    except Exception as e:
        print(f"✗ Failed removing EmployeeGroupMember: {e}")

    try:
        ShiftProductionEmployee = apps.get_model('production_app', 'ShiftProductionEmployee')
        shift_emp_deleted, _ = ShiftProductionEmployee.objects.all().delete()
        if shift_emp_deleted > 0:
            print(f"✓ Removed {shift_emp_deleted} ShiftProductionEmployee records.")
    except Exception as e:
        print(f"✗ Failed removing ShiftProductionEmployee: {e}")

    try:
        RenewalReminder = apps.get_model('renewal_app', 'RenewalReminder')
        rr_updated = RenewalReminder.objects.filter(department__isnull=False).update(department=None)
        if rr_updated > 0:
            print(f"✓ Unlinked department from {rr_updated} RenewalReminder records.")
    except Exception as e:
        print(f"✗ Failed unlinking RenewalReminder department: {e}")

def truncate_group(group_name):
    if group_name not in TABLE_GROUPS:
        print(f"Group '{group_name}' not recognized.")
        print(f"Available groups: {', '.join(TABLE_GROUPS.keys())}, all")
        return

    print(f"\n--- Truncating Group: {group_name} ---")
    if group_name in ['designations', 'departments', 'hr', 'hr_masters', 'rarenett_app']:
        clear_protected_designation_references()
    if group_name in ['roles', 'all']:
        clear_protected_role_references()

    targets = TABLE_GROUPS[group_name]
    with transaction.atomic():
        for app_label, model_name in targets:
            try:
                model = apps.get_model(app_label, model_name)
                count, _ = model.objects.all().delete()
                print(f"✓ [{app_label}.{model_name}] Removed {count} records.")
            except Exception as e:
                print(f"✗ [{app_label}.{model_name}] Error: {str(e)}")

def truncate_all():
    print("\n--- Truncating ALL Configured Module Tables ---")
    for group_name in TABLE_GROUPS:
        truncate_group(group_name)

if __name__ == '__main__':
    if len(sys.argv) > 1:
        target = sys.argv[1].lower()
        if target == 'all':
            truncate_all()
        else:
            truncate_group(target)
    else:
        print("Usage:")
        print("  python truncate_tables.py designations")
        print("  python truncate_tables.py departments")
        print("  python truncate_tables.py hr_masters")
        print("  python truncate_tables.py sales")
        print("  python truncate_tables.py purchase")
        print("  python truncate_tables.py finance_vouchers")
        print("  python truncate_tables.py stock")
        print("  python truncate_tables.py all")
