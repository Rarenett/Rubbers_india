with open('frontend/src/jsx/components/DigiLocker/FolderCreation.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

old_validate = """    if (!trimmedName) {
      errors.name = "Folder name is required.";
    } else {
      const selectedParentId = formData.parent_folder ? Number(formData.parent_folder) : null;
      // Client-side duplicate check scoped to the same parent folder
      const isDuplicate = folders.some(
        (f) =>
          f.name.toLowerCase() === trimmedName.toLowerCase() &&
          (f.parent_folder || null) === selectedParentId &&
          f.folder_type === formData.folder_type &&
          (!isEditMode || f.id !== currentId)
      );
      if (isDuplicate) {
        const parentObj = folders.find((f) => f.id === selectedParentId);
        const parentLabel = parentObj ? `under '${parentObj.name}'` : "at root level";
        errors.name = `Folder with name '${trimmedName}' already exists ${parentLabel}.`;
      }
    }"""

new_validate = """    if (!trimmedName) {
      errors.name = "Folder name is required.";
    } else {
      // Check if folder name is same as any existing folder
      const isDuplicate = folders.some(
        (f) =>
          f.name.toLowerCase() === trimmedName.toLowerCase() &&
          (!isEditMode || f.id !== currentId)
      );
      if (isDuplicate) {
        errors.name = `A folder with the name '${trimmedName}' already exists. Please choose a different folder name.`;
      }
    }"""

if '\r\n' in text:
    old_validate = old_validate.replace('\n', '\r\n')
    new_validate = new_validate.replace('\n', '\r\n')

assert old_validate in text, "old_validate not found"
text = text.replace(old_validate, new_validate, 1)

with open('frontend/src/jsx/components/DigiLocker/FolderCreation.jsx', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Updated FolderCreation.jsx client validation successfully.")

