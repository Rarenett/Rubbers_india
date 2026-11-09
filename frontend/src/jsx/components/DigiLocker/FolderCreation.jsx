import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, Form, Modal, Button } from "react-bootstrap";
import Select from "react-select";
import swal from "sweetalert";
import DigiLockerService from "../../../services/DigiLockerService";
import CreateButton from "../../../components/permissions/CreateButton";
import EditButton from "../../../components/permissions/EditButton";
import DeleteButton from "../../../components/permissions/DeleteButton";
import Pagination from "../Common/Pagination";

const FolderCreation = () => {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");

  // Track expanded parent folders in tree view
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Central Default OTP Email Settings Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingDefaultEmail, setEditingDefaultEmail] = useState('');
  const [editingDefaultPhone, setEditingDefaultPhone] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    folder_type: "shared",
    parent_folder: "",
    is_active: true,
    default_otp_email: "",
    phone_number: "",
  });

  const [defaultOtpEmail, setDefaultOtpEmail] = useState("");
  const [defaultPhoneNumber, setDefaultPhoneNumber] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Check if current user is an administrator
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      const userDetails = JSON.parse(localStorage.getItem("userDetails") || "{}");
      const user = userDetails.user || {};
      const roleName = (user.role?.name || user.role_name || user.role || "").toLowerCase().trim();
      return Boolean(
        user.is_superuser ||
        ["admin", "super admin", "superadmin", "administrator"].includes(roleName)
      );
    } catch (e) {
      return false;
    }
  });



  useEffect(() => {
    fetchFolders();
    fetchDigiLockerSettings();
  }, []);

  const fetchDigiLockerSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await DigiLockerService.getSettings();
      if (res.data) {
        if (res.data.default_otp_email) setDefaultOtpEmail(res.data.default_otp_email);
        if (res.data.default_phone_number) setDefaultPhoneNumber(res.data.default_phone_number);
      }
    } catch (err) {
      console.error('Error loading central DigiLocker default OTP email setting:', err);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleOpenSettingsModal = () => {
    setEditingDefaultEmail(defaultOtpEmail || 'digilocker@rarenett.com');
    setEditingDefaultPhone(defaultPhoneNumber || '');
    setSettingsError('');
    setShowSettingsModal(true);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const emailToSave = editingDefaultEmail.trim();
    if (!emailToSave) {
      setSettingsError('Please provide a valid default OTP email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToSave)) {
      setSettingsError('Please provide a valid email format (e.g. digilocker@rarenett.com).');
      return;
    }

    setSavingSettings(true);
    setSettingsError('');
    try {
      const res = await DigiLockerService.updateSettings({ default_otp_email: emailToSave, default_phone_number: editingDefaultPhone.trim() });
      const updated = res.data?.settings?.default_otp_email || emailToSave;
      setDefaultOtpEmail(updated);
      swal('Success', 'Centralized Default OTP Email updated to ' + updated + '. It will now automatically reflect when creating folders for all employees.', 'success');
      setShowSettingsModal(false);
      fetchFolders();
    } catch (err) {
      console.error('Error updating central settings:', err);
      const msg = err.response?.data?.error || 'Failed to update centralized Default OTP Email.';
      setSettingsError(msg);
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchFolders = async () => {
    setLoading(true);
    try {
      const response = await DigiLockerService.getFolders();
      const data = response.data;
      const list = Array.isArray(data) ? data : data.results || [];
      setFolders(list);
    } catch (error) {
      console.error("Error fetching DigiLocker folders:", error);
      swal("Error", "Failed to fetch folders.", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleFolderExpand = (folderId) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  /**
   * handleOpenModal:
   * - default: root folder creation
   * - isSubfolder = true: create subfolder under parentFolder
   * - folder != null && !isSubfolder: edit existing folder
   */
  const handleOpenModal = (folder = null, isSubfolder = false) => {
    if (folder && !isSubfolder) {
      // Edit mode
      setIsEditMode(true);
      setCurrentId(folder.id);
      setFormData({
        name: folder.name || "",
        description: folder.description || "",
        folder_type: folder.folder_type || "shared",
        parent_folder: folder.parent_folder ? String(folder.parent_folder) : "",
        is_active: folder.is_active !== undefined ? folder.is_active : true,
        default_otp_email: folder.default_otp_email || defaultOtpEmail || "digilocker@rarenett.com",
        phone_number: folder.phone_number || "",
      });
    } else if (isSubfolder && folder) {
      // Create subfolder under this parent folder
      setIsEditMode(false);
      setCurrentId(null);
      setFormData({
        name: "",
        description: "",
        folder_type: "shared",
        parent_folder: String(folder.id),
        is_active: true,
        default_otp_email: defaultOtpEmail || "digilocker@rarenett.com",
        phone_number: defaultPhoneNumber || "",
      });
    } else {
      // Create brand new root folder
      setIsEditMode(false);
      setCurrentId(null);
      setFormData({
        name: "",
        description: "",
        folder_type: "shared",
        parent_folder: "",
        is_active: true,
        default_otp_email: defaultOtpEmail || "digilocker@rarenett.com",
        phone_number: defaultPhoneNumber || "",
      });
    }
    setFormErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setIsEditMode(false);
    setCurrentId(null);
    setFormErrors({});
  };

  // Find descendants to disallow choosing own descendant as parent during edit
  const getDescendantIds = (folderId) => {
    const descendants = new Set();
    const queue = [folderId];
    while (queue.length > 0) {
      const curr = queue.shift();
      folders.forEach((f) => {
        if (f.parent_folder === curr && !descendants.has(f.id)) {
          descendants.add(f.id);
          queue.push(f.id);
        }
      });
    }
    return descendants;
  };

  const eligibleParentFolders = useMemo(() => {
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
  }, [eligibleParentFolders]);

  const validateForm = () => {
    const errors = {};
    const trimmedName = formData.name.trim();

    if (!trimmedName) {
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
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    const chosenEmail = (formData.default_otp_email !== undefined && formData.default_otp_email !== null && formData.default_otp_email.trim() !== '')
      ? formData.default_otp_email.trim()
      : (defaultOtpEmail || 'digilocker@rarenett.com').trim();

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      folder_type: formData.folder_type,
      parent_folder: formData.parent_folder ? Number(formData.parent_folder) : null,
      is_active: formData.is_active,
      default_otp_email: chosenEmail,
      phone_number: (formData.phone_number || '').trim(),
    };

    try {
      if (isEditMode) {
        await DigiLockerService.updateFolder(currentId, payload);
        swal("Success", "Folder updated successfully.", "success");
      } else {
        await DigiLockerService.createFolder(payload);
        swal("Success", "Folder created successfully.", "success");
        // Automatically expand the parent so the newly created subfolder is immediately visible
        if (payload.parent_folder) {
          setExpandedFolders((prev) => new Set([...prev, payload.parent_folder]));
        }
      }
      handleCloseModal();
      fetchFolders();
    } catch (error) {
      console.error("Error saving folder:", error);
      const errMsg =
        error.response?.data?.name?.[0] ||
        error.response?.data?.parent_folder?.[0] ||
        error.response?.data?.error ||
        "Failed to save folder.";
      swal("Error", errMsg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (folder) => {
    if (folder.subfolders_count > 0) {
      swal(
        "Cannot Delete",
        `Folder '${folder.name}' contains ${folder.subfolders_count} subfolder(s). Please delete or move subfolders before deleting this folder.`,
        "warning"
      );
      return;
    }

    if (folder.documents_count > 0) {
      swal(
        "Cannot Delete",
        `Folder '${folder.name}' contains ${folder.documents_count} document(s). Please remove or reassign documents before deleting the folder.`,
        "warning"
      );
      return;
    }

    const willDelete = await swal({
      title: "Delete Folder?",
      text: `Are you sure you want to delete folder '${folder.name}'?`,
      icon: "warning",
      buttons: ["Cancel", "Yes, Delete"],
      dangerMode: true,
    });

    if (willDelete) {
      try {
        await DigiLockerService.deleteFolder(folder.id);
        swal("Deleted", `Folder '${folder.name}' has been deleted.`, "success");
        fetchFolders();
      } catch (error) {
        console.error("Error deleting folder:", error);
        const errMsg =
          error.response?.data?.error || "Failed to delete folder.";
        swal("Error", errMsg, "error");
      }
    }
  };

  // Filter & Search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter]);

  // Build hierarchical table rows preserving parent/child nesting
  const hierarchicalRows = useMemo(() => {
    // Apply type filter
    const pool = folders.filter((f) => typeFilter === "All" || f.folder_type === typeFilter);
    const byParent = new Map();
    pool.forEach((f) => {
      const pId = f.parent_folder || null;
      if (!byParent.has(pId)) byParent.set(pId, []);
      byParent.get(pId).push(f);
    });

    // Check search term matching (if searching, show matching folders and auto-expand)
    const term = searchTerm.trim().toLowerCase();

    const result = [];
    const traverse = (parentId, depth) => {
      const children = byParent.get(parentId) || [];
      children.forEach((child) => {
        const hasChildren = (byParent.get(child.id) || []).length > 0;
        const matchesChild =
          !term ||
          child.name.toLowerCase().includes(term) ||
          (child.description && child.description.toLowerCase().includes(term)) ||
          (child.created_by_name && child.created_by_name.toLowerCase().includes(term));

        const isExpanded = expandedFolders.has(child.id) || Boolean(term);

        if (term) {
          // In search mode, include if this child matches or any of its descendants match
          if (matchesChild) {
            result.push({ ...child, depth, hasChildren, isExpanded });
          }
          traverse(child.id, depth + 1);
        } else {
          result.push({ ...child, depth, hasChildren, isExpanded });
          if (hasChildren && isExpanded) {
            traverse(child.id, depth + 1);
          }
        }
      });
    };

    traverse(null, 0);
    return result;
  }, [folders, typeFilter, searchTerm, expandedFolders]);

  const totalRecords = hierarchicalRows.length;
  const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentRecords = hierarchicalRows.slice(indexOfFirst, indexOfLast);

  return (
    <div className="container-fluid park-area-page">
      <div className="page-titles">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <Link to={"#"}>DigiLocker</Link>
          </li>
          <li className="breadcrumb-item">
            <Link to={"#"}>Master</Link>
          </li>
          <li className="breadcrumb-item active">
            <Link to={"#"}>Folder Creation</Link>
          </li>
        </ol>
      </div>

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
                  Folder Creation
                </Card.Title>
                <p className="mb-0 text-muted" style={{ fontSize: "13px" }}>
                  Manage secure hierarchical folders and subfolders for employee documents
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
                    placeholder="Search folders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <Form.Select
                  size="sm"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{
                    width: "auto",
                    minWidth: "140px",
                    height: "36px",
                    fontSize: "13px",
                    borderRadius: "8px",
                    borderColor: "#cbd5e1",
                  }}
                >
                  <option value="All">All Types</option>
                  <option value="shared">Shared / Managed</option>
                  <option value="personal">Personal</option>
                </Form.Select>

                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={handleOpenSettingsModal}
                  title="View / Configure Centralized Default OTP Email"
                  style={{
                    height: '36px',
                    borderRadius: '8px',
                    padding: '0 14px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <i className="fa fa-envelope-o"></i> Set Default OTP Email
                </Button>
                <CreateButton
                  module="digilocker_folder"
                  onClick={() => handleOpenModal()}
                  style={{
                    height: "36px",
                    borderRadius: "8px",
                    padding: "0 16px",
                  }}
                >
                  Create Folder
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
                          <strong>FOLDER NAME</strong>
                        </th>
                        <th>
                          <strong>TYPE</strong>
                        </th>
                        <th>
                          <strong>DOCUMENTS</strong>
                        </th>
                        <th>
                          <strong>MAPPED TO</strong>
                        </th>
                        <th>
                          <strong>CREATED BY</strong>
                        </th>
                        <th>
                          <strong>CREATED DATE</strong>
                        </th>
                        <th>
                          <strong>STATUS</strong>
                        </th>
                        <th className="text-end">
                          <strong>ACTIONS</strong>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {hierarchicalRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan="9"
                            className="text-center py-4 text-muted"
                          >
                            No folders found.
                          </td>
                        </tr>
                      ) : (
                        currentRecords.map((folder, index) => (
                          <tr key={folder.id}>
                            <td>{indexOfFirst + index + 1}</td>
                            <td>
                              <div
                                className="d-flex align-items-center"
                                style={{ paddingLeft: `${folder.depth * 24}px` }}
                              >
                                {folder.hasChildren ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleFolderExpand(folder.id)}
                                    className="btn btn-xs p-0 me-1 d-flex align-items-center justify-content-center text-muted"
                                    style={{
                                      width: "20px",
                                      height: "20px",
                                      border: "none",
                                      background: "none",
                                      cursor: "pointer",
                                    }}
                                    title={folder.isExpanded ? "Collapse" : "Expand"}
                                  >
                                    <i
                                      className={`fa ${
                                        folder.isExpanded
                                          ? "fa-chevron-down"
                                          : "fa-chevron-right"
                                      }`}
                                      style={{ fontSize: "11px" }}
                                    ></i>
                                  </button>
                                ) : (
                                  <span
                                    style={{
                                      width: "20px",
                                      display: "inline-block",
                                    }}
                                  >
                                    {folder.depth > 0 && (
                                      <span
                                        className="text-muted"
                                        style={{ fontSize: "12px", opacity: 0.5 }}
                                      >
                                        └
                                      </span>
                                    )}
                                  </span>
                                )}

                                <i
                                  className={`fa ${
                                    folder.hasChildren && folder.isExpanded
                                      ? "fa-folder-open"
                                      : "fa-folder"
                                  } text-warning me-2`}
                                  style={{ fontSize: "16px" }}
                                ></i>
                                <div>
                                  <span className="fw-semibold text-dark">
                                    {folder.name}
                                  </span>
                                  {folder.parent_folder_name && (
                                    <span
                                      className="badge light badge-light text-muted ms-2 px-1"
                                      style={{ fontSize: "10px" }}
                                    >
                                      Inside: {folder.parent_folder_name}
                                    </span>
                                  )}
                                  {folder.description && (
                                    <div
                                      className="text-muted"
                                      style={{ fontSize: "11px" }}
                                    >
                                      {folder.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span
                                className={`badge light badge-${
                                  folder.folder_type === "shared"
                                    ? "info"
                                    : "primary"
                                }`}
                              >
                                {folder.folder_type === "shared"
                                  ? "Shared"
                                  : "Personal"}
                              </span>
                            </td>
                            <td>
                              <span className="badge light badge-dark">
                                {folder.documents_count} file(s)
                              </span>
                            </td>
                            <td>
                              <span className="badge light badge-secondary">
                                {folder.mappings_count} employee(s)
                              </span>
                            </td>
                            <td>{folder.created_by_name || "-"}</td>
                            <td>
                              {folder.created_at
                                ? new Date(folder.created_at).toLocaleDateString()
                                : "-"}
                            </td>
                            <td>
                              <span
                                className={`badge light badge-${
                                  folder.is_active ? "success" : "danger"
                                }`}
                              >
                                {folder.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="text-end">
                              <div className="d-flex justify-content-end align-items-center gap-1">
                                <EditButton
                                  module="digilocker_folder"
                                  onClick={() => handleOpenModal(folder, false)}
                                  title="Edit Folder"
                                />
                                <DeleteButton
                                  module="digilocker_folder"
                                  onClick={() => handleDelete(folder)}
                                  title="Delete Folder"
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

              {!loading && hierarchicalRows.length > 0 && (
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

      {/* Modal for Folder Create / Edit / Subfolder */}
      <Modal show={showModal} onHide={handleCloseModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {isEditMode
              ? "Edit Folder"
              : formData.parent_folder
              ? "Create Subfolder"
              : "Create New Root Folder"}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
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
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Folder Name <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. Identity Documents, Personal Documents, SSLC"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                isInvalid={!!formErrors.name}
                required
              />
              <Form.Control.Feedback type="invalid">
                {formErrors.name}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Folder Type</Form.Label>
              <Form.Select
                value={formData.folder_type}
                onChange={(e) =>
                  setFormData({ ...formData, folder_type: e.target.value })
                }
              >
                <option value="shared">Shared / Managed (Assignable to Employees)</option>
                <option value="personal">Personal (Employee Own Documents)</option>
              </Form.Select>
            </Form.Group>

            {/* Default OTP Email */}
            <Form.Group className="mb-3">
              <Form.Label>
                Default OTP Email <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="email"
                placeholder="e.g. digilocker@rarenett.com"
                value={formData.default_otp_email || ""}
                onChange={(e) =>
                  setFormData({ ...formData, default_otp_email: e.target.value })
                }
                isInvalid={!!formErrors.default_otp_email}
                disabled={isEditMode}
                readOnly={isEditMode}
                className={isEditMode ? "bg-light text-muted" : ""}
                required
              />
              <Form.Control.Feedback type="invalid">
                {formErrors.default_otp_email}
              </Form.Control.Feedback>
              <Form.Text className="text-muted" style={{ fontSize: "11px" }}>
                {isEditMode
                  ? "OTP recipient email cannot be edited here. Use Ownership Transfer in Mapping to update OTP recipient email."
                  : "All DigiLocker OTP verification emails for documents in this folder will be delivered to this email."}
              </Form.Text>
            </Form.Group>

            {/* Phone Number Field */}
            <Form.Group className="mb-3">
              <Form.Label>
                Phone Number <span className="text-muted">(Optional)</span>
              </Form.Label>
              <Form.Control
                type="tel"
                placeholder="e.g. +91 9876543210"
                value={formData.phone_number || ""}
                onChange={(e) =>
                  setFormData({ ...formData, phone_number: e.target.value })
                }
                disabled={isEditMode}
                readOnly={isEditMode}
                className={isEditMode ? "bg-light text-muted" : ""}
              />
              <Form.Text className="text-muted" style={{ fontSize: "11px" }}>
                {isEditMode
                  ? "Phone number cannot be edited for existing folders."
                  : "Contact or notification phone number associated with this folder."}
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Active Status"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
              />
            </Form.Group>
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
                backgroundColor: "rgb(61, 53, 119)",
                borderColor: "rgb(61, 53, 119)",
              }}
            >
              {submitting
                ? "Saving..."
                : isEditMode
                ? "Update Folder"
                : formData.parent_folder
                ? "Create Subfolder"
                : "Create Folder"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
      {/* Central Default OTP Email Configuration Modal */}
      <Modal show={showSettingsModal} onHide={() => setShowSettingsModal(false)} centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: '16px', fontWeight: '600' }}>
            <i className="fa fa-envelope text-primary me-2"></i> Central Default OTP Email Configuration
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSaveSettings}>
          <Modal.Body>
            <p className="text-muted small mb-3">
              Set the centralized Default OTP Email for the DigiLocker module. Once set, this email address will automatically reflect whenever anyone creates a folder.
            </p>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">
                Default OTP Email Address <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="email"
                required
                readOnly={!isAdmin}
                disabled={!isAdmin}
                placeholder="e.g. digilocker@rarenett.com"
                value={editingDefaultEmail}
                onChange={(e) => {
                  setEditingDefaultEmail(e.target.value);
                  setSettingsError('');
                }}
                isInvalid={!!settingsError}
              />
              <Form.Control.Feedback type="invalid">
                {settingsError}
              </Form.Control.Feedback>
              <Form.Text className="text-muted" style={{ fontSize: '11px' }}>
                All document access verification OTP emails will be sent to this address by default.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">
                Default Phone Number <span className="text-muted">(Optional)</span>
              </Form.Label>
              <Form.Control
                type="tel"
                readOnly={!isAdmin}
                disabled={!isAdmin}
                placeholder="e.g. +91 9876543210"
                value={editingDefaultPhone}
                onChange={(e) => setEditingDefaultPhone(e.target.value)}
              />
              <Form.Text className="text-muted" style={{ fontSize: '11px' }}>
                Default contact phone number auto-populated when creating new folders.
              </Form.Text>
            </Form.Group>

            <div className="alert alert-info py-2 px-3 small mb-0">
              <i className="fa fa-info-circle me-1"></i>
              <strong>Centralized Setting:</strong> Updating this email automatically synchronizes it across all existing folders and pre-populates it for every employee when creating new folders.
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" size="sm" onClick={() => setShowSettingsModal(false)} disabled={savingSettings}>
              {isAdmin ? "Cancel" : "Close"}
            </Button>
            {isAdmin && (
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={savingSettings || !editingDefaultEmail.trim()}
                style={{
                  backgroundColor: 'rgb(61, 53, 119)',
                  borderColor: 'rgb(61, 53, 119)',
                }}
              >
                {savingSettings ? 'Saving...' : 'Save Default Email'}
              </Button>
            )}
          </Modal.Footer>
        </Form>
      </Modal>

    </div>
  );
};

export default FolderCreation;
