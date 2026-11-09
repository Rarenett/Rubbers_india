with open('backend/digilocker_app/views.py', 'r', encoding='utf-8') as f:
    text = f.read()

old_block = """        else:
            # General listing: non-admin employees strictly only see folders explicitly mapped to them.
            # Folder creators and owners receive NO automatic access without explicit mapping.
            emp = get_employee_for_user(user)
            if emp:
                allowed_folder_ids = get_allowed_folder_ids_for_employee(emp)
                qs = qs.filter(id__in=allowed_folder_ids)
            else:
                qs = qs.none()"""

new_block = """        else:
            # General listing (Folder Creation list): employees see folders created by/owned by them,
            # as well as folders actively mapped to them.
            emp = get_employee_for_user(user)
            mapped_ids = get_allowed_folder_ids_for_employee(emp) if emp else set()
            qs = qs.filter(
                Q(created_by=user) |
                Q(owner=user) |
                Q(id__in=mapped_ids)
            )"""

if old_block not in text and old_block.replace('\n', '\r\n') in text:
    old_block = old_block.replace('\n', '\r\n')
    new_block = new_block.replace('\n', '\r\n')

assert old_block in text, "old_block not found"
text = text.replace(old_block, new_block, 1)

with open('backend/digilocker_app/views.py', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Updated DigiLockerFolderViewSet.get_queryset successfully.")

