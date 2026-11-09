with open('frontend/src/jsx/components/DigiLocker/FolderCreation.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Select import from "react-select"
old_import = 'import { Card, Form, Modal, Button } from "react-bootstrap";'
new_import = '''import { Card, Form, Modal, Button } from "react-bootstrap";
import Select from "react-select";'''

assert old_import in content, "old_import not found"
content = content.replace(old_import, new_import, 1)

# 2. Add parentFolderOptions useMemo right after eligibleParentFolders
old_eligible = '''  const eligibleParentFolders = useMemo(() => {
    const invalidIds = new Set();
    if (isEditMode && currentId) {
      invalidIds.add(currentId);
      getDescendantIds(currentId).forEach((id) => invalidIds.add(id));
    }
    return folders.filter((f) => !invalidIds.has(f.id) && f.is_active);
  }, [folders, isEditMode, currentId]);'''

new_eligible = '''  const eligibleParentFolders = useMemo(() => {
    const invalidIds = new Set();
    if (isEditMode && currentId) {
      invalidIds.add(currentId);
      getDescendantIds(currentId).forEach((id) => invalidIds.add(id));
    }
    return folders.filter((f) => !invalidIds.has(f.id) && f.is_active);
  }, [folders, isEditMode, currentId]);

  const parentFolderOptions = useMemo(() => {
    const opts = eligibleParentFolders.map((f) => ({
      value: String(f.id),
      label: `${f.folder_path || f.name} (${f.folder_type === 'shared' ? 'Shared' : 'Personal'})`,
      folder: f,
    }));
    return [
      { value: "", label: "-- None (Root Level Folder) --" },
      ...opts
    ];
  }, [eligibleParentFolders]);'''

assert old_eligible in content, "old_eligible not found"
content = content.replace(old_eligible, new_eligible, 1)

# 3. Replace the Form.Select for Parent Folder with searchable Select
old_parent_select = '''            <Form.Group className="mb-3">
              <Form.Label>
                Parent Folder (Optional)
              </Form.Label>
              <Form.Select
                value={formData.parent_folder}
                onChange={(e) => {
                  const pId = e.target.value;
                  setFormData({
                    ...formData,
                    parent_folder: pId,
                  });
                }}
              >
                <option value="">-- None (Root Level Folder) --</option>
                {eligibleParentFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.folder_path || f.name} ({f.folder_type})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>'''

new_parent_select = '''            <Form.Group className="mb-3">
              <Form.Label>
                Parent Folder (Optional)
              </Form.Label>
              <Select
                classNamePrefix="react-select"
                options={parentFolderOptions}
                value={parentFolderOptions.find((opt) => opt.value === String(formData.parent_folder || "")) || parentFolderOptions[0]}
                onChange={(selected) => {
                  setFormData({
                    ...formData,
                    parent_folder: selected ? selected.value : "",
                  });
                }}
                isSearchable
                isClearable
                placeholder="Type or search parent folder..."
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                styles={{
                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                  control: (base, state) => ({
                    ...base,
                    borderRadius: "8px",
                    borderColor: state.isFocused ? "#3d3577" : "#cbd5e1",
                    boxShadow: state.isFocused ? "0 0 0 1px #3d3577" : "none",
                    minHeight: "42px",
                    "&:hover": {
                      borderColor: "#3d3577",
                    },
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isSelected
                      ? "rgb(61, 53, 119)"
                      : state.isFocused
                      ? "rgba(61, 53, 119, 0.08)"
                      : "transparent",
                    color: state.isSelected ? "#ffffff" : "#1e293b",
                    fontSize: "13px",
                    cursor: "pointer",
                  }),
                  singleValue: (base) => ({
                    ...base,
                    fontSize: "13px",
                    color: "#1e293b",
                  }),
                }}
              />
              <Form.Text className="text-muted" style={{ fontSize: "11px" }}>
                Type to instantly search and select a parent folder, or leave as Root Level.
              </Form.Text>
            </Form.Group>'''

assert old_parent_select in content, "old_parent_select not found"
content = content.replace(old_parent_select, new_parent_select, 1)

with open('frontend/src/jsx/components/DigiLocker/FolderCreation.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully replaced Parent Folder select with searchable react-select input!")

