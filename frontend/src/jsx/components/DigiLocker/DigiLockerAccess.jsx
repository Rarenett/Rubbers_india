import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Card, Form, Modal, Button, Accordion, Badge, Spinner } from "react-bootstrap";
import swal from "sweetalert";
import DigiLockerService from "../../../services/DigiLockerService";

const DigiLockerAccess = () => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [accessData, setAccessData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // OTP Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpRequestLoading, setOtpRequestLoading] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", ""]);
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [countdown, setCountdown] = useState(300); // 5 minutes
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const timerRef = useRef(null);
  const cooldownRef = useRef(null);
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  // Document Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    // Check if user is an administrator (superuser or admin role, strictly excluding HOD, staff, employees)
    const userDetails = JSON.parse(localStorage.getItem("userDetails") || "{}");
    const user = userDetails.user || {};
    const roleName = (user.role?.name || user.role_name || user.role || "").toLowerCase().trim();
    const isClientAdmin = Boolean(
      user.is_superuser ||
      ["admin", "super admin", "superadmin", "administrator"].includes(roleName)
    );

    setIsAdmin(isClientAdmin);

    if (isClientAdmin) {
      // Default to "all" employees for administrators when opening the page
      setSelectedEmployeeId("all");
      await fetchAccessData("all");
      fetchEmployees("all");
    } else {
      setEmployees([]);
      await fetchAccessData();
    }
  };

  const fetchEmployees = async (currentEmpId = "all") => {
    try {
      const res = await DigiLockerService.getEmployees();
      const data = res.data;
      const empList = Array.isArray(data) ? data : data.results || [];
      setEmployees(empList);
      if (currentEmpId) {
        setSelectedEmployeeId(String(currentEmpId));
      }
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  };

  const fetchAccessData = async (empId = null) => {
    setLoading(true);
    try {
      const params = empId ? { employee_id: empId } : {};
      const res = await DigiLockerService.getAccessData(params);
      setAccessData(res.data);
      if (res.data?.is_admin !== undefined) {
        setIsAdmin(Boolean(res.data.is_admin));
      }
      return res.data;
    } catch (err) {
      console.error("Error fetching DigiLocker access data:", err);
      const errMsg = err.response?.data?.error || "Failed to load DigiLocker folders.";
      swal("Access Notice", errMsg, "info");
      setAccessData(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeChange = (e) => {
    const empId = e.target.value;
    setSelectedEmployeeId(empId);
    if (empId) {
      fetchAccessData(empId);
    }
  };

  // Timer Handlers
  const startTimer = (seconds = 300) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(seconds);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startResendCooldown = (seconds = 30) => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setCanResend(false);
    setResendCooldown(seconds);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  // Request OTP for View or Download
  const handleInitiateAccess = async (docItem, operation) => {
    // Check whether OTP is required for this specific operation
    const requiresOtpForOperation = operation === "view"
      ? (docItem.view_otp_required !== undefined ? docItem.view_otp_required : docItem.requires_otp !== false)
      : (docItem.download_otp_required !== undefined ? docItem.download_otp_required : docItem.requires_otp !== false);

    if (!requiresOtpForOperation) {
      if (operation === "view") {
        setPreviewDoc(docItem);
        try {
          const url = docItem.direct_preview_url || `/api/digilocker/access/documents/${docItem.id}/preview/`;
          const fileRes = await DigiLockerService.previewDocumentBlob(url);
          const blob = new Blob([fileRes.data], { type: fileRes.headers["content-type"] || "application/pdf" });
          const blobUrl = URL.createObjectURL(blob);
          setPreviewUrl(blobUrl);
          setShowPreviewModal(true);
        } catch (err) {
          console.error("Error previewing document:", err);
          let errMsg = "Preview is not supported for this file format. You may download it directly.";
          if (err.response?.status === 403) {
            errMsg = "Access Denied: You do not have permission to preview this document.";
          } else if (err.response?.data instanceof Blob) {
            try {
              const text = await err.response.data.text();
              if (text) errMsg = text;
            } catch (e) {}
          }
          swal("Notice", errMsg, "info");
        }
      } else if (operation === "download") {
        try {
          const url = docItem.direct_download_url || `/api/digilocker/access/documents/${docItem.id}/download/`;
          const fileRes = await DigiLockerService.downloadDocumentBlob(url);
          const blob = new Blob([fileRes.data], {
            type: fileRes.headers["content-type"] || "application/octet-stream",
          });
          const blobUrl = URL.createObjectURL(blob);
          const downloadLink = window.document.createElement("a");
          downloadLink.href = blobUrl;
          downloadLink.setAttribute("download", docItem.original_filename);
          window.document.body.appendChild(downloadLink);
          downloadLink.click();
          window.document.body.removeChild(downloadLink);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
        } catch (err) {
          console.error("Error downloading document:", err);
          let errMsg = "";
          if (err.response?.data instanceof Blob) {
            try {
              const text = await err.response.data.text();
              if (text) errMsg = text;
            } catch (e) {}
          }
          if (!errMsg && err.response?.data?.error) {
            errMsg = err.response.data.error;
          }
          if (!errMsg && err.response?.status === 403) {
            errMsg = "Access Denied: You do not have permission to download this document.";
          }
          if (!errMsg && err.response?.status) {
            errMsg = `Server error ${err.response.status}: ${err.message || ''}`;
          }
          if (!errMsg) {
            errMsg = err.message || "Failed to download document.";
          }
          swal("Download Error", errMsg, "error");
        }
      }
      return;
    }

    setOtpRequestLoading(true);
    try {
      const payload = {
        document_id: docItem.id,
        operation: operation, // 'view' or 'download'
        employee_id: accessData?.employee_id || selectedEmployeeId,
      };

      const res = await DigiLockerService.requestOtp(payload);
      setActiveChallenge({
        challenge_id: res.data.challenge_id,
        document: docItem,
        operation: operation,
        email_masked: res.data.email_masked || docItem.owner_email_masked,
      });

      setOtpDigits(["", "", "", ""]);
      setShowOtpModal(true);
      startTimer(res.data.expires_in_seconds || 300);
      startResendCooldown(30);

      swal(
        "Verification Code Sent",
        `A 4-digit security authorization code has been sent to the document owner at ${res.data.email_masked || docItem.owner_email_masked}.`,
        "info"
      );

      // Focus first digit input
      setTimeout(() => inputRefs[0]?.current?.focus(), 200);
    } catch (err) {
      console.error("Error requesting OTP:", err);
      const errMsg =
        err.response?.data?.error || "Failed to generate security verification code.";
      swal("Verification Error", errMsg, "error");
    } finally {
      setOtpRequestLoading(false);
    }
  };

  // OTP Input Changes
  const handleOtpDigitChange = (index, value) => {
    if (value && !/^\d+$/.test(value)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1); // Only take last character
    setOtpDigits(newDigits);

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs[index + 1]?.current?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs[index - 1]?.current?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").trim();
    if (/^\d{4}$/.test(pasted)) {
      setOtpDigits(pasted.split(""));
      inputRefs[3]?.current?.focus();
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    const enteredOtp = otpDigits.join("");
    if (enteredOtp.length !== 4) {
      swal("Incomplete Code", "Please enter the complete 4-digit OTP code.", "warning");
      return;
    }

    setOtpVerifying(true);
    try {
      const payload = {
        challenge_id: activeChallenge.challenge_id,
        otp: enteredOtp,
      };

      const res = await DigiLockerService.verifyOtp(payload);
      setShowOtpModal(false);

      if (activeChallenge.operation === "view") {
        setPreviewDoc(activeChallenge.document);
        try {
          const fileRes = await DigiLockerService.previewDocumentBlob(res.data.preview_url);
          const blob = new Blob([fileRes.data], { type: fileRes.headers["content-type"] || "application/pdf" });
          const blobUrl = URL.createObjectURL(blob);
          setPreviewUrl(blobUrl);
        } catch (errBlob) {
          console.warn("Direct blob load fallback:", errBlob);
          setPreviewUrl(res.data.preview_url);
        }
        setShowPreviewModal(true);
      } else if (activeChallenge.operation === "download") {
        swal("Authorized", "Your secure download is starting now.", "success");
        try {
          const fileRes = await DigiLockerService.downloadDocumentBlob(res.data.download_url);
          const blob = new Blob([fileRes.data], {
            type: fileRes.headers["content-type"] || "application/octet-stream",
          });
          const blobUrl = URL.createObjectURL(blob);
          const downloadLink = document.createElement("a");
          downloadLink.href = blobUrl;
          downloadLink.setAttribute("download", activeChallenge.document.original_filename);
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
        } catch (errBlob) {
          console.warn("Direct download fallback:", errBlob);
          const downloadLink = document.createElement("a");
          downloadLink.href = res.data.download_url;
          downloadLink.setAttribute("download", activeChallenge.document.original_filename);
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        }
      }
    } catch (err) {
      console.error("Error verifying OTP:", err);
      const errMsg = err.response?.data?.error || "OTP verification failed.";
      swal("Verification Failed", errMsg, "error");
      setOtpDigits(["", "", "", ""]);
      inputRefs[0]?.current?.focus();
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || !activeChallenge) return;
    await handleInitiateAccess(activeChallenge.document, activeChallenge.operation);
  };

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const getFileIcon = (ext) => {
    switch (ext?.toLowerCase()) {
      case "pdf":
        return <i className="fa fa-file-pdf text-danger me-2 fs-5"></i>;
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "webp":
        return <i className="fa fa-file-image text-primary me-2 fs-5"></i>;
      case "doc":
      case "docx":
        return <i className="fa fa-file-word text-info me-2 fs-5"></i>;
      case "xls":
      case "xlsx":
        return <i className="fa fa-file-excel text-success me-2 fs-5"></i>;
      default:
        return <i className="fa fa-file-alt text-secondary me-2 fs-5"></i>;
    }
  };

  const handleClosePreviewModal = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setShowPreviewModal(false);
    setPreviewUrl("");
    setPreviewDoc(null);
  };

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
            <Link to={"#"}>Access</Link>
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
                  {isAdmin ? "DigiLocker Document Access" : "My DigiLocker"}
                </Card.Title>
                <p className="mb-0 text-muted" style={{ fontSize: "13px" }}>
                  {isAdmin
                    ? "Manage and inspect employee documents with OTP verification"
                    : "Your personal secure document locker"}
                </p>
              </div>

              <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1 justify-content-end header-actions-wrapper">
                {isAdmin && (
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
                      placeholder="Search documents..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                )}

                {isAdmin && employees.length > 0 && (
                  <div className="d-flex align-items-center gap-2">
                    <span className="text-muted small text-nowrap fw-semibold d-none d-sm-inline">
                      Employee:
                    </span>
                    <Form.Select
                      size="sm"
                      value={selectedEmployeeId || accessData?.employee_id || ""}
                      onChange={handleEmployeeChange}
                      style={{
                        width: "auto",
                        minWidth: "180px",
                        height: "36px",
                        fontSize: "13px",
                        borderRadius: "8px",
                        borderColor: "#cbd5e1",
                      }}
                    >
                      <option value="all">All Employees</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.user_name || emp.full_name || `Emp #${emp.id}`}
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                )}
              </div>
            </Card.Header>

            <Card.Body>
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : !accessData || !accessData.folders || accessData.folders.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i
                    className="fa fa-folder-open text-muted mb-3"
                    style={{ fontSize: "48px", opacity: 0.4 }}
                  ></i>
                  <h5>No Accessible Folders Found</h5>
                  <p className="small mb-0">
                    No active DigiLocker folders are currently mapped to this employee.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="p-3 mb-4 rounded bg-light border d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div>
                      <span className="text-muted small">Accessing DigiLocker for:</span>
                      <h6 className="mb-0 fw-bold text-dark">
                        {accessData.employee_name}
                      </h6>
                    </div>
                    <div>
                      <span className="text-muted small">Registered Security Email:</span>
                      <div className="fw-semibold text-primary">
                        <i className="fa fa-envelope me-1"></i>
                        {accessData.employee_email_masked || "No email registered"}
                      </div>
                    </div>
                    <div>
                      <span className="badge light badge-info me-2">
                        {accessData.folders.length} Authorized Folder(s)
                      </span>
                      {accessData.is_self_access ? (
                        <span className="badge light badge-success">
                          <i className="fa fa-unlock me-1"></i> Your Personal Locker (Direct Access)
                        </span>
                      ) : (
                        <span className="badge light badge-warning">
                          <i className="fa fa-shield-alt me-1"></i> Admin View (OTP Protected)
                        </span>
                      )}
                    </div>
                  </div>

                  <Accordion defaultActiveKey="0" alwaysOpen>
                    {accessData.folders.map((folder, fIndex) => {
                      const myDocs = (folder.my_documents || []).filter(
                        (doc) =>
                          !searchTerm ||
                          doc.original_filename
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase()) ||
                          (doc.description &&
                            doc.description
                              .toLowerCase()
                              .includes(searchTerm.toLowerCase()))
                      );

                      const otherDocs = (folder.other_documents || []).filter(
                        (doc) =>
                          !searchTerm ||
                          doc.original_filename
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase()) ||
                          (doc.owner_name &&
                            doc.owner_name
                              .toLowerCase()
                              .includes(searchTerm.toLowerCase())) ||
                          (doc.description &&
                            doc.description
                              .toLowerCase()
                              .includes(searchTerm.toLowerCase()))
                      );

                      const totalDocsCount = myDocs.length + otherDocs.length;

                      const renderDocumentRow = (doc, dIdx, isOther = false) => (
                        <tr key={doc.id}>
                          <td>{dIdx + 1}</td>
                          <td>
                            <div className="d-flex align-items-center">
                              {getFileIcon(doc.file_extension)}
                              <div>
                                <span className="fw-semibold text-dark">
                                  {doc.original_filename}
                                </span>
                                {doc.description && (
                                  <div
                                    className="text-muted"
                                    style={{ fontSize: "11px" }}
                                  >
                                    {doc.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="badge light badge-secondary" style={{ fontSize: "11px" }}>
                              <i className="fa fa-user me-1"></i>
                              {doc.owner_name}
                            </span>
                          </td>
                          <td>{doc.file_size_display}</td>
                          <td>
                            {doc.uploaded_at
                              ? new Date(doc.uploaded_at).toLocaleDateString()
                              : "-"}
                          </td>
                          <td>
                            {!doc.requires_otp ? (
                              <span
                                className="badge light badge-success"
                                style={{ fontSize: "11px" }}
                              >
                                <i className="fa fa-unlock me-1"></i>
                                Direct Admin Access
                              </span>
                            ) : (
                              <span
                                className="badge light badge-warning"
                                style={{ fontSize: "11px" }}
                              >
                                <i className="fa fa-lock me-1"></i>
                                Protected (OTP Required)
                              </span>
                            )}
                          </td>
                          <td className="text-end">
                            <div className="d-flex justify-content-end align-items-center gap-2">
                              {doc.can_view && (
                                <button
                                  type="button"
                                  className="btn btn-outline-info shadow btn-sm d-inline-flex align-items-center gap-1"
                                  onClick={() => handleInitiateAccess(doc, "view")}
                                  disabled={otpRequestLoading}
                                  style={{
                                    height: "32px",
                                    padding: "0 12px",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                  }}
                                  title={doc.requires_otp ? "Verify OTP to view document" : "View Document"}
                                >
                                  <i className="fa fa-eye"></i>
                                  <span>View</span>
                                </button>
                              )}
                              {doc.can_download && (
                                <button
                                  type="button"
                                  className="btn btn-outline-primary shadow btn-sm d-inline-flex align-items-center gap-1"
                                  onClick={() => handleInitiateAccess(doc, "download")}
                                  disabled={otpRequestLoading}
                                  style={{
                                    height: "32px",
                                    padding: "0 12px",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                  }}
                                  title={doc.requires_otp ? "Verify OTP to download document" : "Download Document"}
                                >
                                  <i className="fa fa-download"></i>
                                  <span>Download</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );

                      return (
                        <Accordion.Item
                          key={folder.folder_id}
                          eventKey={String(fIndex)}
                          className="mb-3 border rounded overflow-hidden"
                        >
                          <Accordion.Header>
                            <div className="d-flex align-items-center gap-2">
                              <i className="fa fa-folder-open text-warning fs-5"></i>
                              <span className="fw-bold text-dark">
                                {folder.folder_name}
                              </span>
                              <span className="badge light badge-dark ms-2">
                                {totalDocsCount} document(s)
                              </span>
                              {folder.can_upload && (
                                <span className="badge light badge-success ms-1">
                                  Upload Allowed
                                </span>
                              )}
                            </div>
                          </Accordion.Header>
                          <Accordion.Body className="p-0">
                            {totalDocsCount === 0 ? (
                              <div className="text-center py-4 text-muted small">
                                No documents in this folder.
                              </div>
                            ) : (
                              <div>
                                {/* Section 1: My Documents */}
                                {myDocs.length > 0 && (
                                  <div>
                                    <div className="px-3 py-2 bg-light border-bottom d-flex align-items-center justify-content-between">
                                      <span className="fw-bold text-dark small text-uppercase">
                                        <i className="fa fa-folder me-2 text-primary"></i>
                                        My Documents ({myDocs.length})
                                      </span>
                                      <span className="badge light badge-info" style={{ fontSize: "11px" }}>
                                        <i className="fa fa-id-card me-1"></i> Mapped Documents
                                      </span>
                                    </div>
                                    <div className="table-responsive">
                                      <table className="table table-hover mb-0">
                                        <thead className="bg-white">
                                          <tr>
                                            <th><strong>SL NO</strong></th>
                                            <th><strong>DOCUMENT NAME</strong></th>
                                            <th><strong>DOCUMENT OWNER</strong></th>
                                            <th><strong>FILE SIZE</strong></th>
                                            <th><strong>UPLOADED DATE</strong></th>
                                            <th><strong>SECURITY STATUS</strong></th>
                                            <th className="text-end"><strong>ACTIONS</strong></th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {myDocs.map((doc, idx) => renderDocumentRow(doc, idx, false))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}

                                {/* Section 2: Other Employees' Documents */}
                                {otherDocs.length > 0 && (
                                  <div className={myDocs.length > 0 ? "border-top mt-2" : ""}>
                                    <div className="px-3 py-2 bg-light border-bottom d-flex align-items-center justify-content-between">
                                      <span className="fw-bold text-secondary small text-uppercase">
                                        <i className="fa fa-users me-2 text-warning"></i>
                                        Other Employees' Documents ({otherDocs.length})
                                      </span>
                                      <span className="badge light badge-warning" style={{ fontSize: "11px" }}>
                                        <i className="fa fa-shield-alt me-1"></i> Owner OTP Verification Required
                                      </span>
                                    </div>
                                    <div className="table-responsive">
                                      <table className="table table-hover mb-0">
                                        <thead className="bg-white">
                                          <tr>
                                            <th><strong>SL NO</strong></th>
                                            <th><strong>DOCUMENT NAME</strong></th>
                                            <th><strong>DOCUMENT OWNER</strong></th>
                                            <th><strong>FILE SIZE</strong></th>
                                            <th><strong>UPLOADED DATE</strong></th>
                                            <th><strong>SECURITY STATUS</strong></th>
                                            <th className="text-end"><strong>ACTIONS</strong></th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {otherDocs.map((doc, idx) => renderDocumentRow(doc, idx, true))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </Accordion.Body>
                        </Accordion.Item>
                      );
                    })}
                  </Accordion>
                </div>
              )}
            </Card.Body>
          </Card>
        </div>
      </div>

      {/* OTP Verification Modal */}
      <Modal
        show={showOtpModal}
        onHide={() => setShowOtpModal(false)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center gap-2">
            <i className="fa fa-shield-alt text-primary"></i>
            <span>Two-Factor Security Verification</span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleVerifyOtp}>
          <Modal.Body className="text-center py-4">
            <div
              className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle bg-light text-primary"
              style={{ width: "64px", height: "64px", fontSize: "28px" }}
            >
              <i className="fa fa-lock"></i>
            </div>

            <h5 className="fw-bold mb-1">
              Verify {activeChallenge?.operation?.toUpperCase()} Access
            </h5>
            <p className="text-muted small mb-2">
              For document: <strong>{activeChallenge?.document?.original_filename}</strong>
            </p>
            <p className="small mb-4 text-secondary">
              A 4-digit code was sent to the employee's registered email:
              <br />
              <strong className="text-dark">{activeChallenge?.email_masked}</strong>
            </p>

            {/* 4-Digit Numeric Inputs */}
            <div
              className="d-flex justify-content-center gap-3 mb-4"
              onPaste={handleOtpPaste}
            >
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={inputRefs[idx]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e.target)}
                  className="form-control text-center fw-bold fs-4"
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "10px",
                    borderColor: digit ? "#0a500f" : "#cbd5e1",
                    backgroundColor: "#f8fafc",
                  }}
                  autoFocus={idx === 0}
                />
              ))}
            </div>

            {/* Countdown & Resend */}
            <div className="d-flex justify-content-between align-items-center px-4 mb-2 small">
              <span className="text-muted">
                Expires in:{" "}
                <strong className={countdown < 60 ? "text-danger" : "text-dark"}>
                  {formatCountdown(countdown)}
                </strong>
              </span>

              {canResend ? (
                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none small fw-semibold"
                  onClick={handleResendOtp}
                >
                  Resend OTP
                </button>
              ) : (
                <span className="text-muted">
                  Resend in {resendCooldown}s
                </span>
              )}
            </div>

            {countdown === 0 && (
              <div className="alert alert-danger py-2 mt-3 mb-0 small">
                The verification code has expired. Please click "Resend OTP".
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="danger light"
              onClick={() => setShowOtpModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={otpVerifying || countdown === 0 || otpDigits.join("").length !== 4}
              style={{
                backgroundColor: "#0a500f",
                borderColor: "#0a500f",
              }}
            >
              {otpVerifying ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Verifying...
                </>
              ) : (
                "Verify & Open"
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Secure Document Preview Modal */}
      <Modal
        show={showPreviewModal}
        onHide={handleClosePreviewModal}
        size="xl"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center gap-2 text-truncate">
            <i className="fa fa-file text-primary"></i>
            <span className="text-truncate">
              Document Preview: {previewDoc?.original_filename}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0 text-center" style={{ minHeight: "65vh" }}>
          {previewDoc?.file_extension?.toLowerCase() === "pdf" ? (
            <iframe
              src={previewUrl}
              title={previewDoc?.original_filename}
              width="100%"
              height="650px"
              style={{ border: "none" }}
            />
          ) : ["jpg", "jpeg", "png", "gif", "webp"].includes(
              previewDoc?.file_extension?.toLowerCase()
            ) ? (
            <div className="p-4 d-flex align-items-center justify-content-center">
              <img
                src={previewUrl}
                alt={previewDoc?.original_filename}
                style={{
                  maxWidth: "100%",
                  maxHeight: "650px",
                  objectFit: "contain",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
              />
            </div>
          ) : (
            <div className="py-5 text-muted">
              <i className="fa fa-file-alt mb-3 fs-1"></i>
              <h5>Preview Not Supported</h5>
              <p className="small mb-3">
                This document format (.{previewDoc?.file_extension}) cannot be previewed directly inside the browser.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  handleClosePreviewModal();
                  handleInitiateAccess(previewDoc, "download");
                }}
                style={{
                  backgroundColor: "#0a500f",
                  borderColor: "#0a500f",
                }}
              >
                <i className="fa fa-download me-1"></i> Download Document
              </button>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <span className="text-muted small me-auto">
            Authorized session active. Preview expires in 10 minutes.
          </span>
          <Button variant="danger light" onClick={handleClosePreviewModal}>
            Close Preview
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default DigiLockerAccess;
