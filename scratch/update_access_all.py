with open('backend/digilocker_app/views.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Locate DigiLockerAccessView.get
old_access_get = """        # Determine target employee
        if not is_admin:
            # Non-admin users strictly only see their own employee locker
            target_employee = get_employee_for_user(user)
            if not target_employee:
                return Response({"error": "No employee profile linked to your user account."}, status=status.HTTP_404_NOT_FOUND)
        else:
            # Admin users can view their own or select any employee
            if employee_id:
                try:
                    target_employee = Employee.objects.get(id=employee_id)
                except Employee.DoesNotExist:
                    return Response({"error": "Selected employee not found."}, status=status.HTTP_404_NOT_FOUND)
            else:
                target_employee = get_employee_for_user(user) or Employee.objects.first()
                if not target_employee:
                    return Response({
                        "message": "No employees found in the system.",
                        "is_admin": True,
                        "folders": []
                    })

        is_self_access = bool(target_employee.user and target_employee.user == user)

        # Mapped folders for this employee (including subfolder inheritance)
        direct_mappings = DigiLockerFolderMapping.objects.filter(
            employee=target_employee, is_active=True, folder__is_active=True
        ).select_related('folder')"""

new_access_get = """        # Determine target employee or "all"
        is_all_employees = is_admin and (str(employee_id).lower() == 'all')

        if is_all_employees:
            target_employee = None
            is_self_access = False
            # When admin selects "All", include active mappings across all employees
            direct_mappings = DigiLockerFolderMapping.objects.filter(
                is_active=True, folder__is_active=True
            ).select_related('folder')
        elif not is_admin:
            # Non-admin users strictly only see their own employee locker
            target_employee = get_employee_for_user(user)
            if not target_employee:
                return Response({"error": "No employee profile linked to your user account."}, status=status.HTTP_404_NOT_FOUND)
            is_self_access = True
            direct_mappings = DigiLockerFolderMapping.objects.filter(
                employee=target_employee, is_active=True, folder__is_active=True
            ).select_related('folder')
        else:
            # Admin users can view their own or select a specific employee
            if employee_id:
                try:
                    target_employee = Employee.objects.get(id=employee_id)
                except Employee.DoesNotExist:
                    return Response({"error": "Selected employee not found."}, status=status.HTTP_404_NOT_FOUND)
            else:
                target_employee = get_employee_for_user(user) or Employee.objects.first()
                if not target_employee:
                    return Response({
                        "message": "No employees found in the system.",
                        "is_admin": True,
                        "folders": []
                    })
            is_self_access = bool(target_employee.user and target_employee.user == user)
            direct_mappings = DigiLockerFolderMapping.objects.filter(
                employee=target_employee, is_active=True, folder__is_active=True
            ).select_related('folder')"""

old_return = """        emp_name = target_employee.user.get_full_name() if target_employee.user else (target_employee.candidate.full_name if target_employee.candidate else f"Employee #{target_employee.id}")
        emp_email = target_employee.user.email if target_employee.user and target_employee.user.email else target_employee.email

        return Response({
            'employee_id': target_employee.id,
            'employee_name': emp_name,
            'employee_email_masked': mask_email(emp_email),
            'is_self_access': is_self_access,
            'is_admin': is_admin,
            'folders': folders_data
        })"""

new_return = """        if is_all_employees:
            return Response({
                'employee_id': 'all',
                'employee_name': 'All Employees',
                'employee_email_masked': '***',
                'is_self_access': False,
                'is_admin': True,
                'folders': folders_data
            })

        emp_name = target_employee.user.get_full_name() if target_employee.user else (target_employee.candidate.full_name if target_employee.candidate else f"Employee #{target_employee.id}")
        emp_email = target_employee.user.email if target_employee.user and target_employee.user.email else target_employee.email

        return Response({
            'employee_id': target_employee.id,
            'employee_name': emp_name,
            'employee_email_masked': mask_email(emp_email),
            'is_self_access': is_self_access,
            'is_admin': is_admin,
            'folders': folders_data
        })"""

if '\r\n' in text:
    old_access_get = old_access_get.replace('\n', '\r\n')
    new_access_get = new_access_get.replace('\n', '\r\n')
    old_return = old_return.replace('\n', '\r\n')
    new_return = new_return.replace('\n', '\r\n')

assert old_access_get in text, "old_access_get not found"
text = text.replace(old_access_get, new_access_get, 1)

assert old_return in text, "old_return not found"
text = text.replace(old_return, new_return, 1)

with open('backend/digilocker_app/views.py', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Updated DigiLockerAccessView in views.py successfully.")

