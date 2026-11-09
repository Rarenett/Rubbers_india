with open('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update initial formData state
old_form_state = """  const [formData, setFormData] = useState({
    employee: "",
    folder_ids: [],
    can_view: true,
    can_upload: false,
    can_download: false,
  });"""

new_form_state = """  const [formData, setFormData] = useState({
    employee: "",
    folder_ids: [],
    can_view: true,
    view_otp_required: true,
    can_upload: false,
    can_download: false,
    download_otp_required: true,
  });"""

if old_form_state not in text and old_form_state.replace('\n', '\r\n') in text:
    old_form_state = old_form_state.replace('\n', '\r\n')
    new_form_state = new_form_state.replace('\n', '\r\n')

assert old_form_state in text, "old_form_state not found"
text = text.replace(old_form_state, new_form_state, 1)

# 2. Update handleOpenModal for edit and create
old_open_modal = """      setFormData({
        employee: String(mapping.employee),
        folder_ids: [mapping.folder],
        can_view: mapping.can_view,
        can_upload: mapping.can_upload,
        can_download: mapping.can_download,
      });
      setGranularPerms({
        [mapping.folder]: {
          can_view: mapping.can_view,
          can_upload: mapping.can_upload,
          can_download: mapping.can_download,
        },
      });
    } else {
      setIsEditMode(false);
      setCurrentId(null);
      setSelectedDepartment("");
      // Auto-expand all folders that have children so subfolders (including personal subfolders) are immediately visible
      const allParentIds = [];
      childrenMap.forEach((children, parentId) => {
        if (parentId && children.length > 0) allParentIds.push(parentId);
      });
      const rootIds = childrenMap.get(null) || [];
      setModalExpandedFolders(new Set([...rootIds, ...allParentIds]));
      setFormData({
        employee: "",
        folder_ids: [],
        can_view: true,
        can_upload: false,
        can_download: true,
      });
      setGranularPerms({});
    }"""

new_open_modal = """      const vOtpReq = mapping.view_otp_required !== undefined ? mapping.view_otp_required : true;
      const dlOtpReq = mapping.download_otp_required !== undefined ? mapping.download_otp_required : true;
      setFormData({
        employee: String(mapping.employee),
        folder_ids: [mapping.folder],
        can_view: mapping.can_view,
        view_otp_required: vOtpReq,
        can_upload: mapping.can_upload,
        can_download: mapping.can_download,
        download_otp_required: dlOtpReq,
      });
      setGranularPerms({
        [mapping.folder]: {
          can_view: mapping.can_view,
          view_otp_required: vOtpReq,
          can_upload: mapping.can_upload,
          can_download: mapping.can_download,
          download_otp_required: dlOtpReq,
        },
      });
    } else {
      setIsEditMode(false);
      setCurrentId(null);
      setSelectedDepartment("");
      // Auto-expand all folders that have children so subfolders (including personal subfolders) are immediately visible
      const allParentIds = [];
      childrenMap.forEach((children, parentId) => {
        if (parentId && children.length > 0) allParentIds.push(parentId);
      });
      const rootIds = childrenMap.get(null) || [];
      setModalExpandedFolders(new Set([...rootIds, ...allParentIds]));
      setFormData({
        employee: "",
        folder_ids: [],
        can_view: true,
        view_otp_required: true,
        can_upload: false,
        can_download: false,
        download_otp_required: true,
      });
      setGranularPerms({});
    }"""

if old_open_modal not in text and old_open_modal.replace('\n', '\r\n') in text:
    old_open_modal = old_open_modal.replace('\n', '\r\n')
    new_open_modal = new_open_modal.replace('\n', '\r\n')

assert old_open_modal in text, "old_open_modal not found"
text = text.replace(old_open_modal, new_open_modal, 1)

# 3. Update handleTreeFolderToggle granularPerms inheritance
old_tree_perms = """          if (!next[fid]) {
            next[fid] = {
              can_view: formData.can_view,
              can_upload: formData.can_upload,
              can_download: formData.can_download,
            };
          }"""

new_tree_perms = """          if (!next[fid]) {
            next[fid] = {
              can_view: formData.can_view,
              view_otp_required: formData.view_otp_required,
              can_upload: formData.can_upload,
              can_download: formData.can_download,
              download_otp_required: formData.download_otp_required,
            };
          }"""

if old_tree_perms not in text and old_tree_perms.replace('\n', '\r\n') in text:
    old_tree_perms = old_tree_perms.replace('\n', '\r\n')
    new_tree_perms = new_tree_perms.replace('\n', '\r\n')

assert old_tree_perms in text, "old_tree_perms not found"
text = text.replace(old_tree_perms, new_tree_perms, 1)

# 4. Update handleGranularPermChange
old_granular = """      const existing = prev[folderId] || {
        can_view: formData.can_view,
        can_upload: formData.can_upload,
        can_download: formData.can_download,
      };"""

new_granular = """      const existing = prev[folderId] || {
        can_view: formData.can_view,
        view_otp_required: formData.view_otp_required,
        can_upload: formData.can_upload,
        can_download: formData.can_download,
        download_otp_required: formData.download_otp_required,
      };"""

if old_granular not in text and old_granular.replace('\n', '\r\n') in text:
    old_granular = old_granular.replace('\n', '\r\n')
    new_granular = new_granular.replace('\n', '\r\n')

assert old_granular in text, "old_granular not found"
text = text.replace(old_granular, new_granular, 1)

# 5. Update handleBulkPermChange
old_bulk = """  const handleBulkPermChange = (permType, value) => {
    setFormData((prev) => ({ ...prev, [permType]: value }));
    setGranularPerms((prev) => {
      const next = { ...prev };
      formData.folder_ids.forEach((fid) => {
        next[fid] = {
          ...(next[fid] || {
            can_view: formData.can_view,
            can_upload: formData.can_upload,
            can_download: formData.can_download,
          }),
          [permType]: value,
        };
      });
      return next;
    });
  };"""

new_bulk = """  const handleBulkPermChange = (permType, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [permType]: value };
      // Business rule: If can_view is disabled, clear OTP options
      if (permType === "can_view" && !value) {
        updated.view_otp_required = true;
      }
      // Business rule: If can_download is disabled, clear OTP options
      if (permType === "can_download" && !value) {
        updated.download_otp_required = true;
      }
      return updated;
    });

    setGranularPerms((prev) => {
      const next = { ...prev };
      formData.folder_ids.forEach((fid) => {
        const currentItem = next[fid] || {
          can_view: formData.can_view,
          view_otp_required: formData.view_otp_required,
          can_upload: formData.can_upload,
          can_download: formData.can_download,
          download_otp_required: formData.download_otp_required,
        };
        const updatedItem = {
          ...currentItem,
          [permType]: value,
        };
        if (permType === "can_view" && !value) {
          updatedItem.view_otp_required = true;
        }
        if (permType === "can_download" && !value) {
          updatedItem.download_otp_required = true;
        }
        next[fid] = updatedItem;
      });
      return next;
    });
  };"""

if old_bulk not in text and old_bulk.replace('\n', '\r\n') in text:
    old_bulk = old_bulk.replace('\n', '\r\n')
    new_bulk = new_bulk.replace('\n', '\r\n')

assert old_bulk in text, "old_bulk not found"
text = text.replace(old_bulk, new_bulk, 1)

# 6. Update handleSubmit payloads
old_submit = """      if (isEditMode) {
        const payload = {
          can_view: formData.can_view,
          can_upload: formData.can_upload,
          can_download: formData.can_download,
        };
        await DigiLockerService.updateMapping(currentId, payload);
        swal("Success", "Mapping permissions updated successfully.", "success");
      } else {
        const payload = {
          employee: formData.employee,
          folder_ids: formData.folder_ids,
          can_view: formData.can_view,
          can_upload: formData.can_upload,
          can_download: formData.can_download,
          folder_permissions: granularPerms,
        };"""

new_submit = """      if (isEditMode) {
        const payload = {
          can_view: formData.can_view,
          view_otp_required: formData.can_view ? Boolean(formData.view_otp_required) : true,
          can_upload: formData.can_upload,
          can_download: formData.can_download,
          download_otp_required: formData.can_download ? Boolean(formData.download_otp_required) : true,
        };
        await DigiLockerService.updateMapping(currentId, payload);
        swal("Success", "Mapping permissions updated successfully.", "success");
      } else {
        const payload = {
          employee: formData.employee,
          folder_ids: formData.folder_ids,
          can_view: formData.can_view,
          view_otp_required: formData.can_view ? Boolean(formData.view_otp_required) : true,
          can_upload: formData.can_upload,
          can_download: formData.can_download,
          download_otp_required: formData.can_download ? Boolean(formData.download_otp_required) : true,
          folder_permissions: granularPerms,
        };"""

if old_submit not in text and old_submit.replace('\n', '\r\n') in text:
    old_submit = old_submit.replace('\n', '\r\n')
    new_submit = new_submit.replace('\n', '\r\n')

assert old_submit in text, "old_submit not found"
text = text.replace(old_submit, new_submit, 1)

# 7. Update renderFolderTreeNode itemPerms fallback
old_tree_item_perms = """    const itemPerms = granularPerms[folderId] || {
      can_view: formData.can_view,
      can_upload: formData.can_upload,
      can_download: formData.can_download,
    };"""

new_tree_item_perms = """    const itemPerms = granularPerms[folderId] || {
      can_view: formData.can_view,
      view_otp_required: formData.view_otp_required,
      can_upload: formData.can_upload,
      can_download: formData.can_download,
      download_otp_required: formData.download_otp_required,
    };"""

if old_tree_item_perms not in text and old_tree_item_perms.replace('\n', '\r\n') in text:
    old_tree_item_perms = old_tree_item_perms.replace('\n', '\r\n')
    new_tree_item_perms = new_tree_item_perms.replace('\n', '\r\n')

assert old_tree_item_perms in text, "old_tree_item_perms not found"
text = text.replace(old_tree_item_perms, new_tree_item_perms, 1)

# 8. Update Table Permissions display column
old_table_badges = """                                {item.can_view && (
                                  <span className="badge light badge-info" style={{ fontSize: "10px" }}>
                                    <i className="fa fa-eye me-1"></i>View
                                  </span>
                                )}
                                {item.can_upload && (
                                  <span className="badge light badge-success" style={{ fontSize: "10px" }}>
                                    <i className="fa fa-upload me-1"></i>Upload
                                  </span>
                                )}
                                {item.can_download && (
                                  <span className="badge light badge-warning" style={{ fontSize: "10px" }}>
                                    <i className="fa fa-download me-1"></i>Download
                                  </span>
                                )}"""

new_table_badges = """                                {item.can_view && (
                                  <span className="badge light badge-info" style={{ fontSize: "10px" }}>
                                    <i className="fa fa-eye me-1"></i>View {item.view_otp_required ? "(OTP)" : "(No OTP)"}
                                  </span>
                                )}
                                {item.can_upload && (
                                  <span className="badge light badge-success" style={{ fontSize: "10px" }}>
                                    <i className="fa fa-upload me-1"></i>Upload
                                  </span>
                                )}
                                {item.can_download && (
                                  <span className="badge light badge-warning" style={{ fontSize: "10px" }}>
                                    <i className="fa fa-download me-1"></i>Download {item.download_otp_required ? "(OTP)" : "(No OTP)"}
                                  </span>
                                )}"""

if old_table_badges not in text and old_table_badges.replace('\n', '\r\n') in text:
    old_table_badges = old_table_badges.replace('\n', '\r\n')
    new_table_badges = new_table_badges.replace('\n', '\r\n')

assert old_table_badges in text, "old_table_badges not found"
text = text.replace(old_table_badges, new_table_badges, 1)

# 9. Update Default Document Permissions section in Modal
old_modal_perms = """            <div className="border rounded p-3 bg-light mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-bold mb-0">Default Document Permissions:</h6>
                <small className="text-muted">Applied to all newly selected folders</small>
              </div>
              <Row>
                <div className="col-md-4 mb-2">
                  <Form.Check
                    type="checkbox"
                    id="perm-view"
                    label={
                      <div>
                        <strong>View Documents</strong>
                        <div className="text-muted small">Requires OTP verification</div>
                      </div>
                    }
                    checked={formData.can_view}
                    onChange={(e) => handleBulkPermChange("can_view", e.target.checked)}
                  />
                </div>
                <div className="col-md-4 mb-2">
                  <Form.Check
                    type="checkbox"
                    id="perm-upload"
                    label={
                      <div>
                        <strong>Upload Documents</strong>
                        <div className="text-muted small">Allow uploading into folder</div>
                      </div>
                    }
                    checked={formData.can_upload}
                    onChange={(e) => handleBulkPermChange("can_upload", e.target.checked)}
                  />
                </div>
                <div className="col-md-4 mb-2">
                  <Form.Check
                    type="checkbox"
                    id="perm-download"
                    label={
                      <div>
                        <strong>Download Documents</strong>
                        <div className="text-muted small">Independent OTP verification</div>
                      </div>
                    }
                    checked={formData.can_download}
                    onChange={(e) => handleBulkPermChange("can_download", e.target.checked)}
                  />
                </div>
              </Row>
            </div>"""

new_modal_perms = """            <div className="border rounded p-3 bg-light mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-bold mb-0">Default Document Permissions:</h6>
                <small className="text-muted">Applied to all newly selected folders</small>
              </div>
              <Row>
                <div className="col-md-4 mb-2">
                  <Form.Check
                    type="checkbox"
                    id="perm-view"
                    label={
                      <div>
                        <strong>View Documents</strong>
                        <div className="text-muted small">Allow viewing files</div>
                      </div>
                    }
                    checked={formData.can_view}
                    onChange={(e) => handleBulkPermChange("can_view", e.target.checked)}
                  />
                  {formData.can_view && (
                    <div className="ms-4 mt-2 p-2 rounded bg-white border">
                      <Form.Check
                        type="checkbox"
                        id="view-with-otp"
                        label={<span className="small fw-semibold text-dark">With OTP</span>}
                        checked={formData.view_otp_required === true}
                        onChange={() => {
                          handleBulkPermChange("view_otp_required", true);
                        }}
                        className="mb-1"
                      />
                      <Form.Check
                        type="checkbox"
                        id="view-without-otp"
                        label={<span className="small fw-semibold text-dark">Without OTP</span>}
                        checked={formData.view_otp_required === false}
                        onChange={() => {
                          handleBulkPermChange("view_otp_required", false);
                        }}
                      />
                    </div>
                  )}
                </div>
                <div className="col-md-4 mb-2">
                  <Form.Check
                    type="checkbox"
                    id="perm-upload"
                    label={
                      <div>
                        <strong>Upload Documents</strong>
                        <div className="text-muted small">Allow uploading into folder</div>
                      </div>
                    }
                    checked={formData.can_upload}
                    onChange={(e) => handleBulkPermChange("can_upload", e.target.checked)}
                  />
                </div>
                <div className="col-md-4 mb-2">
                  <Form.Check
                    type="checkbox"
                    id="perm-download"
                    label={
                      <div>
                        <strong>Download Documents</strong>
                        <div className="text-muted small">Allow downloading files</div>
                      </div>
                    }
                    checked={formData.can_download}
                    onChange={(e) => handleBulkPermChange("can_download", e.target.checked)}
                  />
                  {formData.can_download && (
                    <div className="ms-4 mt-2 p-2 rounded bg-white border">
                      <Form.Check
                        type="checkbox"
                        id="download-with-otp"
                        label={<span className="small fw-semibold text-dark">With OTP</span>}
                        checked={formData.download_otp_required === true}
                        onChange={() => {
                          handleBulkPermChange("download_otp_required", true);
                        }}
                        className="mb-1"
                      />
                      <Form.Check
                        type="checkbox"
                        id="download-without-otp"
                        label={<span className="small fw-semibold text-dark">Without OTP</span>}
                        checked={formData.download_otp_required === false}
                        onChange={() => {
                          handleBulkPermChange("download_otp_required", false);
                        }}
                      />
                    </div>
                  )}
                </div>
              </Row>
            </div>"""

if old_modal_perms not in text and old_modal_perms.replace('\n', '\r\n') in text:
    old_modal_perms = old_modal_perms.replace('\n', '\r\n')
    new_modal_perms = new_modal_perms.replace('\n', '\r\n')

assert old_modal_perms in text, "old_modal_perms not found"
text = text.replace(old_modal_perms, new_modal_perms, 1)

with open('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("DigiLockerMapping.jsx updated successfully.")

