with open('backend/digilocker_app/serializers.py', 'r', encoding='utf-8') as f:
    text = f.read()

old_validation = """        # Unique validation scoped under the same parent_folder
        qs = DigiLockerFolder.objects.filter(
            name__iexact=name,
            parent_folder=parent_folder,
            is_active=True
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if folder_type == 'shared':
            if qs.filter(folder_type='shared').exists():
                parent_desc = f"under '{parent_folder.name}'" if parent_folder else "at root level"
                raise serializers.ValidationError({"name": f"A shared folder with name '{name}' already exists {parent_desc}."})
        else:
            target_owner = owner or user
            if qs.filter(folder_type='personal', owner=target_owner).exists():
                parent_desc = f"under '{parent_folder.name}'" if parent_folder else "at root level"
                raise serializers.ValidationError({"name": f"A personal folder with name '{name}' already exists {parent_desc} for this user."})"""

new_validation = """        # Check for duplicate folder name
        # A folder cannot have the same name as an existing folder (regardless of parent level or casing)
        dup_qs = DigiLockerFolder.objects.filter(
            name__iexact=name,
            is_active=True
        )
        if self.instance:
            dup_qs = dup_qs.exclude(pk=self.instance.pk)

        if dup_qs.exists():
            existing_f = dup_qs.first()
            p_desc = f"under '{existing_f.parent_folder.name}'" if existing_f.parent_folder else "at root level"
            raise serializers.ValidationError({
                "name": f"A folder with the name '{name}' already exists ({p_desc}). Duplicate folder names are not allowed."
            })"""

if '\r\n' in text:
    old_validation = old_validation.replace('\n', '\r\n')
    new_validation = new_validation.replace('\n', '\r\n')

assert old_validation in text, "old_validation not found"
text = text.replace(old_validation, new_validation, 1)

with open('backend/digilocker_app/serializers.py', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Updated duplicate folder validation in serializers.py successfully.")

