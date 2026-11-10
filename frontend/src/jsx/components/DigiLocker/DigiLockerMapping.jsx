import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Card, Form, Modal, Button, Row, Tab, Nav, Badge } from "react-bootstrap";
import Swal from "sweetalert2";
import swal from "sweetalert";
import DigiLockerService from "../../../services/DigiLockerService";
import CreateButton from "../../../components/permissions/CreateButton";
import EditButton from "../../../components/permissions/EditButton";
import DeleteButton from "../../../components/permissions/DeleteButton";
import Pagination from "../Common/Pagination";

// Custom Tree Checkbox supporting indeterminate state
const TreeCheckbox = ({ id, checked, indeterminate, onChange, disabled }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = Boolean(indeterminate);
    }
  }, [indeterminate]);

  return (
    <input
      type="checkbox"
      id={id}
      ref={ref}
      checked={Boolean(checked)}
      onChange={onChange}
      disabled={disabled}
      className="form-check-input"
      style={{ cursor: "pointer", width: "16px", height: "16px" }}
    />
  );
};

const DigiLockerMapping = () => {
  const [mappings, setMappings] = useState([]);
  const [folders, setFolders] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("All");

  // Track expanded folders in mapping modal tree
  const [modalExpandedFolders, setModalExpandedFolders] = useState(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Tab State: 'mapping' | 'ownership_transfer'
  const [activeTab, setActiveTab] = useState('mapping');

  // Ownership Transfer Tab State
  const [transferSearchTerm, setTransferSearchTerm] = useState('');
  const [transferCurrentPage, setTransferCurrentPage] = useState(1);
  const transferItemsPerPage = 10;

  // Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedFolderToTransfer, setSelectedFolderToTransfer] = useState(null);
  const [newOwnerEmployeeId, setNewOwnerEmployeeId] = useState('');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  // Central Default OTP Email
  const [centralDefaultEmail, setCentralDefaultEmail] = useState('digilocker@rarenett.com');

  // Edit Folder OTP Email Modal State
  const [showEditEmailModal, setShowEditEmailModal] = useState(false);
  const [folderToEditEmail, setFolderToEditEmail] = useState(null);
  const [newOtpEmail, setNewOtpEmail] = useState('');
  const [useDefaultEmailOption, setUseDefaultEmailOption] = useState(false);
  const [savingOtpEmail, setSavingOtpEmail] = useState(false);
  const [emailModalError, setEmailModalError] = useState('');

  // Transfer History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedFolderForHistory, setSelectedFolderForHistory] = useState(null);
  const [folderHistoryList, setFolderHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  // selectedFolderIds: Set of folder IDs selected for mapping
  // folderPermsMap: { [folderId]: { can_view: bool, can_upload: bool, can_download: bool } }
  const [formData, setFormData] = useState({
    employee: "",
    folder_ids: [],
    can_view: true,
    view_otp_required: true,
    can_upload: false,
    can_download: false,
    download_otp_required: true,
  });

  const [granularPerms, setGranularPerms] = useState({});
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    fetchMappings();
    fetchFolders();
    fetchDepartments();
    fetchEmployees();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await DigiLockerService.getSettings();
      if (res.data?.default_otp_email) {
        setCentralDefaultEmail(res.data.default_otp_email.trim());
      }
    } catch (err) {
      console.error("Error fetching DigiLocker settings:", err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await DigiLockerService.getDepartments();
      const data = res.data;
      setDepartments(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error("Error fetching departments:", err);
    }
  };

  const fetchMappings = async () => {
    setLoading(true);
    try {
      const res = await DigiLockerService.getMappings();
      const data = res.data;
      setMappings(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error("Error fetching mappings:", err);
      swal("Error", "Failed to fetch folder mappings.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchFolders = async () => {
    try {
      const res = await DigiLockerService.getFolders({ for_mapping: 'true' });
      const data = res.data;
      setFolders(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error("Error fetching folders:", err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await DigiLockerService.getEmployees();
      const data = res.data;
      setEmployees(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  };

  // Build tree index of folders (including both shared and personal folders for mapping)
  const mappableFolders = useMemo(() => {
    return folders.filter((f) => f.is_active);
  }, [folders]);

  const folderMap = useMemo(() => {
    const map = new Map();
    mappableFolders.forEach((f) => map.set(f.id, f));
    return map;
  }, [mappableFolders]);

  const childrenMap = useMemo(() => {
    const map = new Map();
    mappableFolders.forEach((f) => {
      const pId = f.parent_folder || null;
      if (!map.has(pId)) map.set(pId, []);
      map.get(pId).push(f.id);
    });
    return map;
  }, [mappableFolders]);

  // Helper: Get all descendant folder IDs for a given folder
  const getAllDescendants = (folderId) => {
    const desc = [];
    const queue = [...(childrenMap.get(folderId) || [])];
    const visited = new Set();
    while (queue.length > 0) {
      const curr = queue.shift();
      if (!visited.has(curr)) {
        visited.add(curr);
        desc.push(curr);
        queue.push(...(childrenMap.get(curr) || []));
      }
    }
    return desc;
  };

  // Helper: check state computation for a folder
  const getFolderCheckState = (folderId, selectedIds) => {
    const isSelfSelected = selectedIds.includes(folderId);
    const descendants = getAllDescendants(folderId);

    if (descendants.length === 0) {
      return { checked: isSelfSelected, indeterminate: false };
    }

    const allDescSelected = descendants.every((id) => selectedIds.includes(id));
    const someDescSelected = descendants.some((id) => selectedIds.includes(id));

    if (isSelfSelected && allDescSelected) {
      return { checked: true, indeterminate: false };
    } else if (isSelfSelected || someDescSelected) {
      return { checked: false, indeterminate: true };
    } else {
      return { checked: false, indeterminate: false };
    }
  };

  const toggleModalFolderExpand = (folderId) => {
    setModalExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  // Filter employees in the modal based on selected department
  const filteredModalEmployees = useMemo(() => {
    if (!selectedDepartment) {
      return employees;
    }
    return employees.filter((emp) => {
      const deptId = emp.department_id || (emp.department && (emp.department.id || emp.department));
      if (deptId && String(deptId) === String(selectedDepartment)) return true;
      if (emp.department_name) {
        const foundDept = departments.find((d) => String(d.id) === String(selectedDepartment));
        if (foundDept && foundDept.name && emp.department_name.toLowerCase() === foundDept.name.toLowerCase()) {
          return true;
        }
      }
      return false;
    });
  }, [employees, selectedDepartment, departments]);

  const handleOpenModal = (mapping = null) => {
    if (mapping) {
      setIsEditMode(true);
      setCurrentId(mapping.id);
      const mappedEmp = employees.find((e) => String(e.id) === String(mapping.employee));
      const empDeptId = mappedEmp ? (mappedEmp.department_id || (mappedEmp.department?.id || mappedEmp.department)) : "";
      setSelectedDepartment(empDeptId ? String(empDeptId) : "");
      const vOtpReq = mapping.view_otp_required !== undefined ? mapping.view_otp_required : true;
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
    }
    setFormErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setIsEditMode(false);
    setCurrentId(null);
    setSelectedDepartment("");
    setFormErrors({});
  };

  /**
   * Tree Selection Toggle:
   * - If folder is checked or indeterminate: clicking deselects it and all its descendants.
   * - If folder is unchecked: clicking selects it and all its descendants, applying current default permissions.
   */
  const handleTreeFolderToggle = (folderId) => {
    const currentSelected = new Set(formData.folder_ids);
    const descendants = getAllDescendants(folderId);
    const state = getFolderCheckState(folderId, formData.folder_ids);

    const willSelect = !state.checked && !state.indeterminate;

    if (willSelect) {
      // Select folder and all its descendants
      currentSelected.add(folderId);
      descendants.forEach((d) => currentSelected.add(d));

      // Inherit current global permissions into granularPerms for newly selected folders
      setGranularPerms((prev) => {
        const next = { ...prev };
        [folderId, ...descendants].forEach((fid) => {
          if (!next[fid]) {
            next[fid] = {
              can_view: formData.can_view,
              view_otp_required: formData.view_otp_required,
              can_upload: formData.can_upload,
              can_download: formData.can_download,
              download_otp_required: formData.download_otp_required,
            };
          }
        });
        return next;
      });
    } else {
      // Deselect folder and all its descendants
      currentSelected.delete(folderId);
      descendants.forEach((d) => currentSelected.delete(d));
    }

    setFormData((prev) => ({
      ...prev,
      folder_ids: Array.from(currentSelected),
    }));
  };

  // Update granular permission for a specific folder
  const handleGranularPermChange = (folderId, permType, value) => {
    setGranularPerms((prev) => {
      const existing = prev[folderId] || {
        can_view: formData.can_view,
        view_otp_required: formData.view_otp_required,
        can_upload: formData.can_upload,
        can_download: formData.can_download,
        download_otp_required: formData.download_otp_required,
      };
      return {
        ...prev,
        [folderId]: {
          ...existing,
          [permType]: value,
        },
      };
    });
  };

  // Bulk update default permissions (also updates currently selected folders)
  const handleBulkPermChange = (permType, value) => {
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
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.employee) {
      errors.employee = "Please select an employee.";
    }
    if (formData.folder_ids.length === 0) {
      errors.folders = "Please select at least one folder to map.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      if (isEditMode) {
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
        };
        await DigiLockerService.createMapping(payload);
        swal("Success", "Folder mappings saved successfully.", "success");
      }
      handleCloseModal();
      fetchMappings();
    } catch (err) {
      console.error("Error saving mapping:", err);
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.details?.[0] ||
        "Failed to save mapping.";
      swal("Error", errMsg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMapping = async (mapping) => {
    // Check if this mapping is a parent folder with mapped subfolders for this employee
    const activeSubfolders = folders.filter(
      (f) => f.parent_folder === mapping.folder && f.is_active
    );
    const hasMappedSubfolders = activeSubfolders.some((sf) =>
      mappings.some((m) => m.folder === sf.id && m.employee === mapping.employee)
    );

    let cascade = false;
    if (hasMappedSubfolders) {
      const result = await swal({
        title: "Revoke Folder Mapping",
        text: `Folder '${mapping.folder_name}' has subfolders mapped to ${mapping.employee_name}.\n\nDo you want to revoke access to all its subfolders as well?`,
        icon: "warning",
        buttons: {
          cancel: "Cancel",
          onlyThis: { text: "This Folder Only", value: "only" },
          all: { text: "Yes, Revoke All Subfolders", value: "all" },
        },
        dangerMode: true,
      });

      if (!result) return;
      cascade = result === "all";
    } else {
      const willDelete = await swal({
        title: "Revoke Mapping?",
        text: `Are you sure you want to revoke access to '${mapping.folder_name}' for ${mapping.employee_name}?`,
        icon: "warning",
        buttons: ["Cancel", "Yes, Revoke"],
        dangerMode: true,
      });
      if (!willDelete) return;
    }

    try {
      await DigiLockerService.deleteMapping(mapping.id, { cascade });
      swal("Revoked", "Folder mapping has been revoked.", "success");
      fetchMappings();
    } catch (err) {
      console.error("Error deleting mapping:", err);
      const errMsg = err.response?.data?.error || "Failed to remove mapping.";
      swal("Error", errMsg, "error");
    }
  };

  // Filter & Search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, employeeFilter]);

  const filteredMappings = mappings.filter((m) => {
    const matchesSearch =
      !searchTerm ||
      m.folder_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.employee_code.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesEmployee =
      employeeFilter === "All" || String(m.employee) === String(employeeFilter);

    return matchesSearch && matchesEmployee;
  });

  const totalRecords = filteredMappings.length;
  const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentRecords = filteredMappings.slice(indexOfFirst, indexOfLast);

  // Helper for displaying currently mapped folders when employee is selected in create modal
  const mappedFolderIdsForSelectedEmp = formData.employee
    ? mappings
        .filter((m) => String(m.employee) === String(formData.employee))
        .map((m) => m.folder)
    : [];

  // Recursive tree renderer for modal folder selection
  const renderFolderTreeNode = (folderId, depth = 0) => {
    const folder = folderMap.get(folderId);
    if (!folder) return null;

    const childIds = childrenMap.get(folderId) || [];
    const hasChildren = childIds.length > 0;
    const isExpanded = modalExpandedFolders.has(folderId);
    const { checked, indeterminate } = getFolderCheckState(folderId, formData.folder_ids);
    const isAlreadyMapped = mappedFolderIdsForSelectedEmp.includes(folderId);

    // Current effective permissions for this folder
    const itemPerms = granularPerms[folderId] || {
      can_view: formData.can_view,
      view_otp_required: formData.view_otp_required,
      can_upload: formData.can_upload,
      can_download: formData.can_download,
      download_otp_required: formData.download_otp_required,
    };

    return (
      <div key={folder.id} className="folder-tree-node">
        <div
          className={`d-flex align-items-center justify-content-between p-2 rounded mb-1 ${
            checked ? "bg-light border border-primary border-opacity-25" : "hover-bg"
          }`}
          style={{ paddingLeft: `${depth * 22 + 8}px` }}
        >
          <div className="d-flex align-items-center flex-grow-1" style={{ minWidth: 0 }}>
            {hasChildren ? (
              <button
                type="button"
                className="btn btn-xs p-0 me-2 text-muted"
                style={{ width: "18px", height: "18px", border: "none", background: "none" }}
                onClick={() => toggleModalFolderExpand(folder.id)}
                title={isExpanded ? "Collapse" : "Expand"}
              >
                <i
                  className={`fa ${isExpanded ? "fa-chevron-down" : "fa-chevron-right"}`}
                  style={{ fontSize: "10px" }}
                ></i>
              </button>
            ) : (
              <span style={{ width: "18px", display: "inline-block", marginRight: "8px" }}>
                {depth > 0 && <span className="text-muted" style={{ opacity: 0.4 }}>└</span>}
              </span>
            )}

            <div className="me-2 d-flex align-items-center">
              <TreeCheckbox
                id={`modal-folder-${folder.id}`}
                checked={checked}
                indeterminate={indeterminate}
                onChange={() => handleTreeFolderToggle(folder.id)}
              />
            </div>

            <i
              className={`fa ${
                hasChildren && isExpanded ? "fa-folder-open" : "fa-folder"
              } text-warning me-2`}
              style={{ fontSize: "15px" }}
            ></i>

            <div className="text-truncate">
              <span className="fw-semibold text-dark" style={{ fontSize: "13px" }}>
                {folder.name}
              </span>
              {folder.folder_type === "personal" ? (
                <span className="badge badge-xs bg-info-subtle text-info ms-2 border border-info-subtle" style={{ fontSize: "10px" }}>
                  <i className="fa fa-user me-1"></i>Personal{folder.owner_name && folder.owner_name !== '-' ? ` (${folder.owner_name})` : ''}
                </span>
              ) : null}
              <span className="text-muted ms-2" style={{ fontSize: "11px" }}>
                ({folder.documents_count} file{folder.documents_count === 1 ? "" : "s"})
              </span>
              {isAlreadyMapped && (
                <span className="badge badge-xs bg-light text-muted ms-2 border" style={{ fontSize: "10px" }}>
                  Mapped
                </span>
              )}
            </div>
          </div>

          {/* Inline granular permission badges for selected folder */}
          {checked && (
            <div className="d-flex align-items-center gap-1 flex-shrink-0 ms-2">
              <button
                type="button"
                className={`btn btn-xs px-2 py-0 ${itemPerms.can_view ? "btn-info" : "btn-outline-secondary"}`}
                style={{ fontSize: "10px", height: "22px", borderRadius: "4px" }}
                onClick={() => handleGranularPermChange(folder.id, "can_view", !itemPerms.can_view)}
                title="Toggle View Permission"
              >
                <i className="fa fa-eye me-1"></i>View
              </button>
              <button
                type="button"
                className={`btn btn-xs px-2 py-0 ${itemPerms.can_upload ? "btn-success" : "btn-outline-secondary"}`}
                style={{ fontSize: "10px", height: "22px", borderRadius: "4px" }}
                onClick={() => handleGranularPermChange(folder.id, "can_upload", !itemPerms.can_upload)}
                title="Toggle Upload Permission"
              >
                <i className="fa fa-upload me-1"></i>Upload
              </button>
              <button
                type="button"
                className={`btn btn-xs px-2 py-0 ${itemPerms.can_download ? "btn-warning" : "btn-outline-secondary"}`}
                style={{ fontSize: "10px", height: "22px", borderRadius: "4px" }}
                onClick={() => handleGranularPermChange(folder.id, "can_download", !itemPerms.can_download)}
                title="Toggle Download Permission"
              >
                <i className="fa fa-download me-1"></i>Download
              </button>
            </div>
          )}
        </div>

        {/* Render child folders if expanded */}
        {hasChildren && isExpanded && (
          <div className="folder-tree-children">
            {childIds.map((childId) => renderFolderTreeNode(childId, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Open Transfer Modal
  const handleOpenTransferModal = (folder) => {
    setSelectedFolderToTransfer(folder);
    setNewOwnerEmployeeId('');
    setNewOwnerEmail('');
    setTransferReason('');
    setShowTransferModal(true);
  };

  const handleCloseTransferModal = () => {
    setShowTransferModal(false);
    setSelectedFolderToTransfer(null);
    setNewOwnerEmployeeId('');
    setNewOwnerEmail('');
    setTransferReason('');
    setTransferSubmitting(false);
  };

  // Handle New Owner Selection in Modal
  const handleNewOwnerChange = (e) => {
    const empId = e.target.value;
    setNewOwnerEmployeeId(empId);
    if (!empId) {
      setNewOwnerEmail('');
      return;
    }
    const emp = employees.find((empItem) => String(empItem.id) === String(empId));
    const email = emp?.email || emp?.user_email || emp?.work_email || emp?.candidate?.email || '';
    setNewOwnerEmail(email);
  };

  // Submit Ownership Transfer
  const handleSubmitTransfer = async (e) => {
    e.preventDefault();
    if (!selectedFolderToTransfer) return;

    if (!newOwnerEmployeeId) {
      Swal.fire('Validation Error', 'Please select a new owner for this folder.', 'warning');
      return;
    }

    const selectedEmp = employees.find((empItem) => String(empItem.id) === String(newOwnerEmployeeId));
    const newOwnerName = selectedEmp?.full_name || selectedEmp?.employee_name || selectedEmp?.candidate?.full_name || ('Employee #' + newOwnerEmployeeId);

    const confirmRes = await Swal.fire({
      title: 'Confirm Ownership Transfer',
      html: '<p class="text-start mb-2">Are you sure you want to transfer ownership of folder <strong>"' + (selectedFolderToTransfer.name || '') + '"</strong>?</p>' +
             '<div class="alert alert-warning text-start py-2 small mb-0">' +
               '<div><strong>Current Owner:</strong> ' + (selectedFolderToTransfer.owner_name || selectedFolderToTransfer.current_owner_name || '-') + ' (' + (selectedFolderToTransfer.owner_email || selectedFolderToTransfer.current_owner_email || '-') + ')</div>' +
               '<div><strong>New Owner:</strong> ' + newOwnerName + ' (' + (newOwnerEmail || 'No email') + ')</div>' +
               '<div class="mt-1 text-muted">All future OTP access verification requests for documents in this folder will be routed to the new owner. Existing documents, uploaders, and permissions will remain intact.</div>' +
             '</div>',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0a500f',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, Transfer Ownership',
      cancelButtonText: 'Cancel'
    });

    if (!confirmRes.isConfirmed) return;

    setTransferSubmitting(true);
    try {
      await DigiLockerService.transferFolderOwnership(selectedFolderToTransfer.id, {
        new_owner_employee_id: newOwnerEmployeeId,
        new_employee: newOwnerEmployeeId,
        new_employee_id: newOwnerEmployeeId,
        transfer_reason: transferReason.trim()
      });

      Swal.fire('Success', 'Ownership of folder "' + selectedFolderToTransfer.name + '" transferred successfully to ' + newOwnerName + '.', 'success');
      handleCloseTransferModal();
      fetchFolders();
    } catch (err) {
      console.error('Error transferring folder ownership:', err);
      const msg = err.response?.data?.error || 'Failed to transfer folder ownership.';
      Swal.fire('Error', msg, 'error');
    } finally {
      setTransferSubmitting(false);
    }
  };

  // Open Edit Folder OTP Email Modal
  const handleOpenEditEmailModal = (folder) => {
    setFolderToEditEmail(folder);
    const isUsingDefault = folder.uses_default_otp_email === true;
    setUseDefaultEmailOption(isUsingDefault);
    const currentEmail = isUsingDefault
      ? centralDefaultEmail
      : (folder.default_otp_email || folder.current_owner_email || centralDefaultEmail);
    setNewOtpEmail(currentEmail);
    setEmailModalError('');
    setShowEditEmailModal(true);
  };

  const handleCloseEditEmailModal = () => {
    setShowEditEmailModal(false);
    setFolderToEditEmail(null);
    setNewOtpEmail('');
    setUseDefaultEmailOption(false);
    setEmailModalError('');
    setSavingOtpEmail(false);
  };

  // Submit Edit Folder OTP Email
  const handleSaveOtpEmail = async (e) => {
    e.preventDefault();
    if (!folderToEditEmail) return;

    const emailTrimmed = useDefaultEmailOption ? centralDefaultEmail : newOtpEmail.trim();
    if (!emailTrimmed) {
      setEmailModalError('Please provide a valid email address.');
      return;
    }

    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      setEmailModalError('Please enter a valid email format (e.g. name@company.com).');
      return;
    }

    const confirmRes = await Swal.fire({
      title: 'Confirm OTP Email Update',
      html: '<p class="text-start mb-2">Are you sure you want to update the OTP recipient email for folder <strong>"' + (folderToEditEmail.name || '') + '"</strong>?</p>' +
            '<div class="alert alert-info text-start py-2 small mb-0">' +
              '<div><strong>Folder:</strong> ' + (folderToEditEmail.name || '') + '</div>' +
              '<div><strong>Current OTP Email:</strong> ' + (folderToEditEmail.current_owner_email || folderToEditEmail.owner_email || folderToEditEmail.default_otp_email || '-') + '</div>' +
              '<div><strong>New OTP Email:</strong> ' + emailTrimmed + (useDefaultEmailOption ? ' <em>(Central Default)</em>' : ' <em>(Custom)</em>') + '</div>' +
              '<div class="mt-1 text-muted">All future OTP verification requests for documents inside this folder will be delivered to this updated email. Folder ownership and permissions will not be affected.</div>' +
            '</div>',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0a500f',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, Update Email',
      cancelButtonText: 'Cancel'
    });

    if (!confirmRes.isConfirmed) return;

    setSavingOtpEmail(true);
    setEmailModalError('');
    try {
      await DigiLockerService.updateFolderOtpEmail(folderToEditEmail.id, {
        default_otp_email: emailTrimmed,
        use_default_otp_email: useDefaultEmailOption
      });

      Swal.fire('Success', 'OTP recipient email for folder "' + folderToEditEmail.name + '" updated successfully.', 'success');
      handleCloseEditEmailModal();
      fetchFolders();
    } catch (err) {
      console.error('Error updating folder OTP email:', err);
      const msg = err.response?.data?.error || 'Failed to update folder OTP email.';
      setEmailModalError(msg);
      Swal.fire('Error', msg, 'error');
    } finally {
      setSavingOtpEmail(false);
    }
  };

  // Open Transfer History Modal
  const handleOpenHistoryModal = async (folder) => {
    setSelectedFolderForHistory(folder);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const res = await DigiLockerService.getFolderOwnershipHistory(folder.id);
      setFolderHistoryList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching folder ownership history:', err);
      Swal.fire('Error', 'Failed to load folder ownership history.', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Filter & Pagination for Ownership Transfer Tab
  const activeEmployees = useMemo(() => {
    return employees.filter((emp) => emp.is_active !== false);
  }, [employees]);

  const filteredTransferFolders = useMemo(() => {
    return folders.filter((folder) => {
      const search = transferSearchTerm.toLowerCase();
      const folderName = (folder.name || '').toLowerCase();
      const ownerName = (folder.owner_name || folder.current_owner_name || '').toLowerCase();
      const ownerEmail = (folder.owner_email || folder.current_owner_email || '').toLowerCase();
      const latestNewOwner = (folder.latest_transfer?.new_owner_name || '').toLowerCase();
      return (
        !search ||
        folderName.includes(search) ||
        ownerName.includes(search) ||
        ownerEmail.includes(search) ||
        latestNewOwner.includes(search)
      );
    });
  }, [folders, transferSearchTerm]);

  const transferTotalPages = Math.ceil(filteredTransferFolders.length / transferItemsPerPage) || 1;
  const transferIndexOfLast = transferCurrentPage * transferItemsPerPage;
  const transferIndexOfFirst = transferIndexOfLast - transferItemsPerPage;
  const currentTransferFolders = filteredTransferFolders.slice(transferIndexOfFirst, transferIndexOfLast);

  return (
    <div className="container-fluid park-area-page">
      <div className="page-titles">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <Link to={"#"}>DigiLocker</Link>
          </li>
          <li className="breadcrumb-item">
            <Link to={"#"}>Transactions</Link>
          </li>
          <li className="breadcrumb-item active">
            <Link to={"#"}>Mapping</Link>
          </li>
        </ol>
      </div>

      <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
        <Nav variant="tabs" className="mb-3">
          <Nav.Item>
            <Nav.Link eventKey="mapping" className="fw-semibold" style={{ cursor: 'pointer' }}>
              <i className="fa fa-sitemap me-2"></i> Folder Mapping
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="ownership_transfer" className="fw-semibold" style={{ cursor: 'pointer' }}>
              <i className="fa fa-exchange me-2"></i> Ownership Transfer
            </Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content>
          {/* TAB 1: FOLDER MAPPING */}
          <Tab.Pane eventKey="mapping">
      <div className="row">
        <div className="col-12">
          <Card
            style={{
              borderRadius: "12px",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
          >
            <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-3">
              <div>
                <Card.Title
                  className="mb-0 text-nowrap"
                  style={{ fontSize: "1.25rem", fontWeight: "600" }}
                >
                  Folder Mapping
                </Card.Title>
                <p className="mb-0 text-muted" style={{ fontSize: "13px" }}>
                  Assign hierarchical folders and configure granular document permissions for employees
                </p>
              </div>

              <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1 justify-content-end header-actions-wrapper">
                <div
                  className="search-bar-container m-0 search-bar-wrapper"
                  style={{
                    flex: "1 1 auto",
                    minWidth: "180px",
                    maxWidth: "260px",
                  }}
                >
                  <span className="search-icon">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </span>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search mappings..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <Form.Select
                  size="sm"
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                  style={{
                    width: "auto",
                    minWidth: "160px",
                    height: "36px",
                    fontSize: "13px",
                    borderRadius: "8px",
                    borderColor: "#cbd5e1",
                  }}
                >
                  <option value="All">All Employees</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user_name || emp.full_name || `Emp #${emp.id}`}
                    </option>
                  ))}
                </Form.Select>

                <CreateButton
                  module="digilocker_mapping"
                  onClick={() => handleOpenModal()}
                  style={{
                    height: "36px",
                    borderRadius: "8px",
                    padding: "0 16px",
                  }}
                >
                  Map Folder
                </CreateButton>
              </div>
            </Card.Header>

            <Card.Body>
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-responsive-md w-100">
                    <thead>
                      <tr>
                        <th>
                          <strong>SL NO</strong>
                        </th>
                        <th>
                          <strong>EMPLOYEE ID</strong>
                        </th>
                        <th>
                          <strong>EMPLOYEE NAME</strong>
                        </th>
                        <th>
                          <strong>FOLDER NAME</strong>
                        </th>
                        <th>
                          <strong>PERMISSIONS</strong>
                        </th>
                        <th>
                          <strong>ASSIGNED BY</strong>
                        </th>
                        <th>
                          <strong>ASSIGNED DATE</strong>
                        </th>
                        <th className="text-end">
                          <strong>ACTIONS</strong>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMappings.length === 0 ? (
                        <tr>
                          <td
                            colSpan="8"
                            className="text-center py-4 text-muted"
                          >
                            No folder mappings found.
                          </td>
                        </tr>
                      ) : (
                        currentRecords.map((item, index) => (
                          <tr key={item.id}>
                            <td>{indexOfFirst + index + 1}</td>
                            <td>
                              <span className="fw-semibold text-primary">
                                {item.employee_code}
                              </span>
                            </td>
                            <td>
                              <span className="fw-semibold text-dark">
                                {item.employee_name}
                              </span>
                            </td>
                            <td>
                              <span className="badge light badge-primary">
                                <i className="fa fa-folder me-1"></i>
                                {item.folder_name}
                              </span>
                            </td>
                            <td>
                              <div className="d-flex gap-1 flex-wrap">
                                {item.can_view && (
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
                                )}
                              </div>
                            </td>
                            <td>{item.assigned_by_name || "-"}</td>
                            <td>
                              {item.assigned_at
                                ? new Date(item.assigned_at).toLocaleDateString()
                                : "-"}
                            </td>
                            <td className="text-end">
                              <div className="d-flex justify-content-end align-items-center gap-1">
                                <EditButton
                                  module="digilocker_mapping"
                                  onClick={() => handleOpenModal(item)}
                                  title="Edit Permissions"
                                />
                                <DeleteButton
                                  module="digilocker_mapping"
                                  onClick={() => handleDeleteMapping(item)}
                                  title="Revoke Mapping"
                                />
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {!loading && filteredMappings.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  totalPages={totalPages}
                  indexOfFirst={indexOfFirst}
                  indexOfLast={indexOfLast}
                  totalRecords={totalRecords}
                  loading={loading}
                />
              )}
            </Card.Body>
          </Card>
        </div>
      </div>
          </Tab.Pane>

          {/* TAB 2: OWNERSHIP TRANSFER */}
          <Tab.Pane eventKey="ownership_transfer">
            <div className="row">
              <div className="col-12">
                <Card
                  style={{
                    borderRadius: "12px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                >
                  <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div>
                      <Card.Title
                        className="mb-0 text-nowrap"
                        style={{ fontSize: "1.25rem", fontWeight: "600" }}
                      >
                        Folder Ownership Transfer
                      </Card.Title>
                      <p className="mb-0 text-muted" style={{ fontSize: "13px" }}>
                        Transfer folder ownership when employees resign or reassign responsibility for document OTP access verification
                      </p>
                    </div>

                    <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1 justify-content-end header-actions-wrapper">
                      <div
                        className="search-bar-container m-0 search-bar-wrapper"
                        style={{
                          flex: "1 1 auto",
                          minWidth: "180px",
                          maxWidth: "280px",
                        }}
                      >
                        <span className="search-icon">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                          </svg>
                        </span>
                        <input
                          type="text"
                          className="search-input"
                          placeholder="Search folder, owner, email..."
                          value={transferSearchTerm}
                          onChange={(e) => {
                            setTransferSearchTerm(e.target.value);
                            setTransferCurrentPage(1);
                          }}
                          style={{
                            width: "100%",
                            padding: "6px 10px 6px 32px",
                            fontSize: "13px",
                            border: "1px solid #dee2e6",
                            borderRadius: "6px",
                          }}
                        />
                      </div>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={fetchFolders}
                        title="Refresh folders"
                        style={{ borderRadius: "6px" }}
                      >
                        <i className="fa fa-refresh me-1"></i> Refresh
                      </Button>
                    </div>
                  </Card.Header>

                  <Card.Body className="p-0">
                    <div className="table-responsive">
                      <table className="table table-hover mb-0">
                        <thead className="bg-light">
                          <tr>
                            <th style={{ width: "60px", padding: "12px 16px" }}>Sl. No.</th>
                            <th style={{ padding: "12px 16px" }}>Folder Name</th>
                            <th style={{ padding: "12px 16px" }}>Current Owner</th>
                            <th style={{ padding: "12px 16px" }}>Current Owner Email</th>
                            <th style={{ padding: "12px 16px" }}>New Owner</th>
                            <th style={{ padding: "12px 16px" }}>New Owner Email</th>
                            <th style={{ padding: "12px 16px" }}>Transfer Date</th>
                            <th style={{ width: "180px", textAlign: "right", padding: "12px 16px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentTransferFolders.length === 0 ? (
                            <tr>
                              <td colSpan="8" className="text-center py-4 text-muted">
                                {transferSearchTerm ? "No folders found matching your search." : "No folders available."}
                              </td>
                            </tr>
                          ) : (
                            currentTransferFolders.map((folder, index) => {
                              const latestTransfer = folder.latest_transfer;
                              return (
                                <tr key={folder.id} style={{ verticalAlign: "middle" }}>
                                  <td style={{ padding: "12px 16px" }}>
                                    {transferIndexOfFirst + index + 1}
                                  </td>
                                  <td style={{ padding: "12px 16px" }}>
                                    <div className="d-flex align-items-center">
                                      <i className="fa fa-folder text-warning me-2" style={{ fontSize: "16px" }}></i>
                                      <div>
                                        <span className="fw-semibold text-dark">{folder.name}</span>
                                        {folder.folder_type === "personal" && (
                                          <Badge bg="info" className="ms-2" style={{ fontSize: "10px" }}>
                                            Personal
                                          </Badge>
                                        )}
                                        <div className="text-muted" style={{ fontSize: "11px" }}>
                                          {folder.documents_count || 0} document{(folder.documents_count || 0) === 1 ? '' : 's'}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: "12px 16px" }}>
                                    <span className="fw-semibold text-dark">
                                      {folder.owner_name || folder.current_owner_name || '-'}
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px 16px" }}>
                                    <span className="text-dark fw-semibold" style={{ fontSize: "13px" }}>
                                      {folder.current_owner_email || folder.default_otp_email || folder.owner_email || '-'}
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px 16px" }}>
                                    {latestTransfer ? (
                                      <span className="fw-semibold text-primary">
                                        {latestTransfer.new_owner_name}
                                      </span>
                                    ) : (
                                      <span className="text-muted">-</span>
                                    )}
                                  </td>
                                  <td style={{ padding: "12px 16px" }}>
                                    {latestTransfer ? (
                                      <span className="text-muted" style={{ fontSize: "13px" }}>
                                        {latestTransfer.new_owner_email}
                                      </span>
                                    ) : (
                                      <span className="text-muted">-</span>
                                    )}
                                  </td>
                                  <td style={{ padding: "12px 16px" }}>
                                    {latestTransfer?.transfer_date ? (
                                      <span style={{ fontSize: "12px" }}>
                                        {new Date(latestTransfer.transfer_date).toLocaleString([], {
                                          year: 'numeric',
                                          month: 'short',
                                          day: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </span>
                                    ) : (
                                      <span className="text-muted">-</span>
                                    )}
                                  </td>
                                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                    <div className="d-flex justify-content-end align-items-center gap-1">
                                      <Button
                                        variant="outline-primary"
                                        size="sm"
                                        onClick={() => handleOpenEditEmailModal(folder)}
                                        title="Transfer / Update Folder OTP Email"
                                        style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "6px" }}
                                      >
                                        <i className="fa fa-exchange me-1"></i> Transfer
                                      </Button>
                                      <Button
                                        variant="outline-secondary"
                                        size="sm"
                                        onClick={() => handleOpenHistoryModal(folder)}
                                        title="View Ownership Transfer History"
                                        style={{ fontSize: "12px", padding: "4px 8px", borderRadius: "6px" }}
                                      >
                                        <i className="fa fa-history"></i>
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {filteredTransferFolders.length > 0 && (
                      <Pagination
                        currentPage={transferCurrentPage}
                        setCurrentPage={setTransferCurrentPage}
                        totalPages={transferTotalPages}
                        indexOfFirst={transferIndexOfFirst}
                        indexOfLast={transferIndexOfLast}
                        totalRecords={filteredTransferFolders.length}
                        loading={false}
                      />
                    )}
                  </Card.Body>
                </Card>
              </div>
            </div>
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>

      {/* Modal for Editing Folder OTP Email */}
      <Modal show={showEditEmailModal} onHide={handleCloseEditEmailModal} centered>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: '16px', fontWeight: 'bold' }}>
            <i className="fa fa-envelope text-primary me-2"></i>
            Edit Folder OTP Recipient Email
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSaveOtpEmail}>
          <Modal.Body>
            {emailModalError && (
              <div className="alert alert-danger py-2 small mb-3">
                {emailModalError}
              </div>
            )}
            <div className="mb-3">
              <Form.Label className="fw-semibold small">Folder Name</Form.Label>
              <Form.Control
                type="text"
                value={folderToEditEmail?.name || ''}
                disabled
                className="bg-light"
              />
            </div>

            <div className="mb-3">
              <Form.Label className="fw-semibold small">Current Owner</Form.Label>
              <Form.Control
                type="text"
                value={folderToEditEmail?.owner_name || folderToEditEmail?.current_owner_name || '-'}
                disabled
                className="bg-light"
              />
            </div>

            <div className="mb-3">
              <Form.Label className="fw-semibold small">Existing OTP Email</Form.Label>
              <Form.Control
                type="text"
                value={folderToEditEmail?.current_owner_email || folderToEditEmail?.default_otp_email || '-'}
                disabled
                className="bg-light"
              />
            </div>

            <div className="mb-3 p-2 rounded bg-light border">
              <Form.Check
                type="checkbox"
                id="use-default-otp-checkbox"
                label={
                  <div>
                    <strong>Use Centralized Default OTP Email</strong>
                    <div className="text-muted small">
                      Automatically syncs with central default: <code>{centralDefaultEmail}</code>
                    </div>
                  </div>
                }
                checked={useDefaultEmailOption}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setUseDefaultEmailOption(checked);
                  if (checked) {
                    setNewOtpEmail(centralDefaultEmail);
                  }
                }}
              />
            </div>

            <div className="mb-3">
              <Form.Label className="fw-semibold small">
                {useDefaultEmailOption ? 'OTP Recipient Email (Inherited from Central Default)' : 'New OTP Recipient Email (Custom)'}{' '}
                <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="email"
                placeholder="e.g. name@company.com"
                value={useDefaultEmailOption ? centralDefaultEmail : newOtpEmail}
                onChange={(e) => {
                  setNewOtpEmail(e.target.value);
                  if (useDefaultEmailOption) {
                    setUseDefaultEmailOption(false);
                  }
                }}
                disabled={useDefaultEmailOption}
                autoFocus={!useDefaultEmailOption}
                required
              />
              <Form.Text className="text-muted small">
                All DigiLocker OTP verification codes for documents inside this folder will be delivered to this address.
              </Form.Text>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="danger light" onClick={handleCloseEditEmailModal} disabled={savingOtpEmail}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={savingOtpEmail}
              style={{ backgroundColor: "#0a500f", borderColor: "#0a500f" }}
            >
              {savingOtpEmail ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                  Saving...
                </>
              ) : (
                'Save OTP Email'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal for Transfer Ownership */}
      <Modal show={showTransferModal} onHide={handleCloseTransferModal} centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: "16px", fontWeight: "600" }}>
            <i className="fa fa-exchange text-primary me-2"></i> Transfer Folder Ownership
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitTransfer}>
          <Modal.Body>
            <div className="mb-3">
              <Form.Label className="fw-semibold small">Folder Name</Form.Label>
              <Form.Control
                type="text"
                value={selectedFolderToTransfer?.name || ''}
                readOnly
                disabled
                className="bg-light"
              />
            </div>

            <Row className="mb-3">
              <div className="col-md-6">
                <Form.Label className="fw-semibold small">Current Owner</Form.Label>
                <Form.Control
                  type="text"
                  value={selectedFolderToTransfer?.owner_name || selectedFolderToTransfer?.current_owner_name || '-'}
                  readOnly
                  disabled
                  className="bg-light"
                />
              </div>
              <div className="col-md-6">
                <Form.Label className="fw-semibold small">Current Owner Email</Form.Label>
                <Form.Control
                  type="text"
                  value={selectedFolderToTransfer?.owner_email || selectedFolderToTransfer?.current_owner_email || '-'}
                  readOnly
                  disabled
                  className="bg-light"
                />
              </div>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">
                New Owner <span className="text-danger">*</span>
              </Form.Label>
              <Form.Select
                value={newOwnerEmployeeId}
                onChange={handleNewOwnerChange}
                required
              >
                <option value="">-- Select Active Employee --</option>
                {activeEmployees
                  .filter((emp) => {
                    // Exclude current owner if matched by username or email
                    const currentEmail = selectedFolderToTransfer?.owner_email || selectedFolderToTransfer?.current_owner_email;
                    const empEmail = emp.email || emp.user_email || emp.work_email || emp.candidate?.email;
                    if (currentEmail && empEmail && currentEmail.toLowerCase() === empEmail.toLowerCase()) {
                      return false;
                    }
                    return true;
                  })
                  .map((emp) => {
                    const empName = emp.full_name || emp.employee_name || emp.candidate?.full_name || ('Employee #' + emp.id);
                    const empCode = emp.emp_code || ('EMP-' + emp.id);
                    return (
                      <option key={emp.id} value={emp.id}>
                        {empName} ({empCode})
                      </option>
                    );
                  })}
              </Form.Select>
              <Form.Text className="text-muted" style={{ fontSize: "11px" }}>
                Only active employees are eligible to become folder owners.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">New Owner Email</Form.Label>
              <Form.Control
                type="email"
                value={newOwnerEmail}
                readOnly
                placeholder="Automatically populated upon employee selection"
                className="bg-light"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">
                Transfer Reason <span className="text-muted">(Optional)</span>
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="e.g. Employee resignation, role change, handover..."
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
              />
            </Form.Group>

            <div className="alert alert-info py-2 px-3 mb-0" style={{ fontSize: "12px" }}>
              <i className="fa fa-info-circle me-1"></i>
              <strong>Notice:</strong> When ownership is transferred, all subsequent OTP requests for document access verification will be sent to the new owner. Existing document uploaders, mappings, and permissions will remain unchanged.
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="danger light" size="sm" onClick={handleCloseTransferModal} disabled={transferSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={transferSubmitting || !newOwnerEmployeeId}
              style={{
                backgroundColor: "#0a500f",
                borderColor: "#0a500f",
              }}
            >
              {transferSubmitting ? "Transferring..." : "Transfer Ownership"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal for Ownership History */}
      <Modal show={showHistoryModal} onHide={() => setShowHistoryModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: "16px", fontWeight: "600" }}>
            <i className="fa fa-history text-secondary me-2"></i> Ownership Transfer History: {selectedFolderForHistory?.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          {loadingHistory ? (
            <div className="text-center py-4 text-muted">
              <div className="spinner-border spinner-border-sm me-2 text-primary" role="status"></div>
              Loading transfer history...
            </div>
          ) : folderHistoryList.length === 0 ? (
            <div className="text-center py-4 text-muted">
              No ownership transfers recorded for this folder.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0">
                <thead className="bg-light">
                  <tr>
                    <th style={{ padding: "10px 14px" }}>#</th>
                    <th style={{ padding: "10px 14px" }}>Previous Owner</th>
                    <th style={{ padding: "10px 14px" }}>New Owner</th>
                    <th style={{ padding: "10px 14px" }}>Transferred By</th>
                    <th style={{ padding: "10px 14px" }}>Reason</th>
                    <th style={{ padding: "10px 14px" }}>Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  {folderHistoryList.map((hist, idx) => (
                    <tr key={hist.id}>
                      <td style={{ padding: "10px 14px" }}>{idx + 1}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <div className="fw-semibold text-dark">{hist.previous_owner_name}</div>
                        <div className="text-muted small">{hist.previous_owner_email || '-'}</div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div className="fw-semibold text-primary">{hist.new_owner_name}</div>
                        <div className="text-muted small">{hist.new_owner_email || '-'}</div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>{hist.transferred_by_name}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span className="text-muted">{hist.transfer_reason || '-'}</span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {hist.transfer_date ? new Date(hist.transfer_date).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowHistoryModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal for Folder Mapping */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {isEditMode ? "Edit Folder Permissions" : "Hierarchical Folder Mapping to Employee"}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Department</Form.Label>
              <Form.Select
                value={selectedDepartment}
                onChange={(e) => {
                  const newDept = e.target.value;
                  setSelectedDepartment(newDept);
                  setFormData((prev) => ({ ...prev, employee: "" }));
                }}
                disabled={isEditMode}
              >
                <option value="">-- All Departments --</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Select Employee <span className="text-danger">*</span>
              </Form.Label>
              <Form.Select
                value={formData.employee}
                onChange={(e) =>
                  setFormData({ ...formData, employee: e.target.value })
                }
                disabled={isEditMode}
                isInvalid={!!formErrors.employee}
                required
              >
                <option value="">-- Choose Employee --</option>
                {filteredModalEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.user_name || emp.full_name || `Emp #${emp.id}`} ({emp.department_name || "General"})
                  </option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                {formErrors.employee}
              </Form.Control.Feedback>
            </Form.Group>

            {!isEditMode && (
              <Form.Group className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <Form.Label className="mb-0">
                    Select Folders to Map <span className="text-danger">*</span>
                  </Form.Label>
                  <small className="text-muted">
                    {formData.folder_ids.length} folder{formData.folder_ids.length === 1 ? "" : "s"} selected
                  </small>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="text-muted small">
                    Selecting a parent folder automatically selects all its subfolders. You can also select individual subfolders independently.
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-link btn-xs text-primary p-0 text-decoration-none"
                      style={{ fontSize: "12px" }}
                      onClick={() => {
                        const allParentIds = Array.from(folderMap.keys());
                        setModalExpandedFolders(new Set(allParentIds));
                      }}
                    >
                      <i className="fa fa-plus-square-o me-1"></i>Expand All
                    </button>
                    <span className="text-muted small">|</span>
                    <button
                      type="button"
                      className="btn btn-link btn-xs text-secondary p-0 text-decoration-none"
                      style={{ fontSize: "12px" }}
                      onClick={() => setModalExpandedFolders(new Set())}
                    >
                      <i className="fa fa-minus-square-o me-1"></i>Collapse All
                    </button>
                  </div>
                </div>
                <div
                  className="border rounded p-3 bg-white"
                  style={{ maxHeight: "280px", overflowY: "auto" }}
                >
                  {mappableFolders.length === 0 ? (
                    <div className="text-muted text-center py-3">
                      No folders available for mapping. Please create folders first.
                    </div>
                  ) : (
                    (childrenMap.get(null) || []).map((rootId) =>
                      renderFolderTreeNode(rootId, 0)
                    )
                  )}
                </div>
                {formErrors.folders && (
                  <div className="text-danger small mt-1">{formErrors.folders}</div>
                )}
              </Form.Group>
            )}

            <div className="border rounded p-3 bg-light mb-3">
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
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="danger light" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={submitting}
              style={{
                backgroundColor: "#0a500f",
                borderColor: "#0a500f",
              }}
            >
              {submitting
                ? "Saving..."
                : isEditMode
                ? "Update Permissions"
                : `Save Mapping (${formData.folder_ids.length} folder${formData.folder_ids.length === 1 ? "" : "s"})`}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default DigiLockerMapping;
