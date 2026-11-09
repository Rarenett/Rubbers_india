import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.apps import apps
from rarenett_app.models import Designation, DepartmentDesignation

def truncate_designations():
    try:
        Employee = apps.get_model('rarenett_app', 'Employee')
        emp_updated = Employee.objects.filter(dept_designation__isnull=False).update(dept_designation=None)
        if emp_updated > 0:
            print(f"- Unlinked dept_designation from {emp_updated} Employee records.")
    except Exception as e:
        print(f"- Note: Unlinking Employee dept_designation skipped ({e})")

    try:
        EmployeeGroupMember = apps.get_model('production_app', 'EmployeeGroupMember')
        group_deleted, _ = EmployeeGroupMember.objects.all().delete()
        if group_deleted > 0:
            print(f"- Removed {group_deleted} EmployeeGroupMember records.")
    except Exception as e:
        print(f"- Note: Removing EmployeeGroupMember skipped ({e})")

    dept_desig_count, _ = DepartmentDesignation.objects.all().delete()
    desig_count, _ = Designation.objects.all().delete()
    print(f"Successfully truncated designation data:")
    print(f"- Removed {dept_desig_count} DepartmentDesignation link records.")
    print(f"- Removed {desig_count} Designation records.")

if __name__ == '__main__':
    truncate_designations()
