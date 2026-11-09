import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, Form, Modal, Button } from "react-bootstrap";
import swal from "sweetalert";
import * as mammoth from "mammoth";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import DigiLockerService from "../../../services/DigiLockerService";
import CreateButton from "../../../components/permissions/CreateButton";
import EditButton from "../../../components/permissions/EditButton";
import DeleteButton from "../../../components/permissions/DeleteButton";
import Pagination from "../Common/Pagination";

const ALLOWED_EXTS = [
  "pdf", "jpg", "jpeg", "png", "gif", "webp",
  "doc", "docx", "xls", "xlsx", "txt", "csv", "zip"
];
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

const UploadFiles = () => {
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFolderFilter, setSelectedFolderFilter] = useState("All");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [destinationFolder, setDestinationFolder] = useState("");
  const [description, setDescription] = useState("");
  const [uploadErrors, setUploadErrors] = useState({});

  // Dynamic preview content cache for non-PDF/non-image documents (DOCX, XLSX, TXT, CSV, ZIP)
  const [parsedPreviewContent, setParsedPreviewContent] = useState({});
  const [previewLoading, setPreviewLoading] = useState(false);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editDocData, setEditDocData] = useState({
    id: null,
    folder: "",
    original_filename: "",
    description: "",
    extension: "",
    file_size_display: "",
    existingPreviewUrl: null,
  });
  const [editNewFiles, setEditNewFiles] = useState([]);
  const [editPreviewSelection, setEditPreviewSelection] = useState({ type: "existing", index: 0 });
  const [editErrors, setEditErrors] = useState({});
  const [isExistingRemoved, setIsExistingRemoved] = useState(false);

  // Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Request Edit Approval Modal State
  const [showRequestEditModal, setShowRequestEditModal] = useState(false);
  const [requestEditDoc, setRequestEditDoc] = useState(null);
  const [requestEditReason, setRequestEditReason] = useState("");
  const [requestEditLoading, setRequestEditLoading] = useState(false);

  useEffect(() => {
    fetchFolders();
    fetchDocuments();
  }, []);

  const fetchFolders = async () => {
    try {
      const res = await DigiLockerService.getFolders({ for_upload: "true" });
      const data = res.data;
      setFolders(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error("Error fetching folders:", err);
    }
  };

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await DigiLockerService.getDocuments();
      const data = res.data;
      setDocuments(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error("Error fetching documents:", err);
      swal("Error", "Failed to fetch uploaded documents.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRequestEditModal = (doc) => {
    setRequestEditDoc(doc);
    setRequestEditReason("");
    setShowRequestEditModal(true);
  };

  const handleSubmitRequestEdit = async (e) => {
    e.preventDefault();
    if (!requestEditDoc) return;
    setRequestEditLoading(true);
    try {
      await DigiLockerService.requestEditApproval(requestEditDoc.id, {
        reason: requestEditReason.trim(),
      });
      swal("Request Submitted", "Your edit approval request has been submitted to the administrator.", "success");
      setShowRequestEditModal(false);
      fetchDocuments();
    } catch (err) {
      console.error("Error requesting edit approval:", err);
      const errMsg = err.response?.data?.error || "Failed to submit edit request.";
      swal("Error", errMsg, "error");
    } finally {
      setRequestEditLoading(false);
    }
  };

  const getApprovalBadge = (status, rejectionReason) => {
    const s = (status || "").toLowerCase();
    if (s === "approved") {
      return (
        <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
          <i className="fa fa-check-circle me-1"></i>Approved
        </span>
      );
    }
    if (s === "rejected") {
      return (
        <div>
          <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">
            <i className="fa fa-times-circle me-1"></i>Rejected
          </span>
          {rejectionReason && (
            <div className="text-danger small mt-1" style={{ fontSize: "11px", maxWidth: "180px" }}>
              <i className="fa fa-info-circle me-1"></i>
              {rejectionReason}
            </div>
          )}
        </div>
      );
    }
    return (
      <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1">
        <i className="fa fa-clock-o me-1"></i>Pending
      </span>
    );
  };


  const handleOpenUploadModal = () => {
    setDestinationFolder(folders.length > 0 ? String(folders[0].id) : "");
    setDescription("");
    setSelectedFiles([]);
    setActivePreviewIndex(0);
    setParsedPreviewContent({});
    setUploadErrors({});
    setShowUploadModal(true);
  };

  const handleCloseUploadModal = () => {
    setShowUploadModal(false);
    selectedFiles.forEach((file) => {
      if (file._previewUrl) {
        URL.revokeObjectURL(file._previewUrl);
      }
    });
    setSelectedFiles([]);
    setActivePreviewIndex(0);
    setParsedPreviewContent({});
    setUploadErrors({});
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = [];
    const errors = [];

    files.forEach((f) => {
      const ext = f.name.split(".").pop().toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) {
        errors.push(`'${f.name}': Disallowed file extension (.${ext}).`);
      } else if (f.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`'${f.name}': Exceeds 25 MB size limit.`);
      } else {
        if (["jpg", "jpeg", "png", "gif", "webp", "pdf"].includes(ext)) {
          f._previewUrl = URL.createObjectURL(f);
        }
        validFiles.push(f);
      }
    });

    if (errors.length > 0) {
      swal("File Validation Warning", errors.join("\n"), "warning");
    }

    setSelectedFiles((prev) => {
      const next = [...prev, ...validFiles];
      if (prev.length === 0 && next.length > 0) {
        setActivePreviewIndex(0);
      }
      return next;
    });
    e.target.value = null; // Reset input
  };

  const handleRemoveSelectedFile = (index) => {
    setSelectedFiles((prev) => {
      const removed = prev[index];
      if (removed?._previewUrl) {
        URL.revokeObjectURL(removed._previewUrl);
      }
      const updated = prev.filter((_, i) => i !== index);
      if (activePreviewIndex >= updated.length) {
        setActivePreviewIndex(Math.max(0, updated.length - 1));
      }
      return updated;
    });
  };

  // Clean up object URLs on component unmount
  useEffect(() => {
    return () => {
      selectedFiles.forEach((f) => {
        if (f._previewUrl) {
          URL.revokeObjectURL(f._previewUrl);
        }
      });
    };
  }, []);

  // Parse document content on demand when active file changes
  useEffect(() => {
    const activeFile = selectedFiles[activePreviewIndex];
    if (!activeFile) return;

    const fileKey = `${activeFile.name}_${activeFile.size}_${activeFile.lastModified || ""}`;
    if (parsedPreviewContent[fileKey]) return; // already parsed

    const ext = activeFile.name.split(".").pop().toLowerCase();

    // Word documents (.docx, .doc)
    if (ext === "docx" || ext === "doc") {
      setPreviewLoading(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const result = await mammoth.convertToHtml({ arrayBuffer });
          setParsedPreviewContent((prev) => ({
            ...prev,
            [fileKey]: {
              type: "docx",
              html: result.value || "<p className='text-muted'>Document appears to be empty.</p>",
            },
          }));
        } catch (err) {
          console.error("Error parsing docx with mammoth:", err);
          // Fallback to text reading if possible
          setParsedPreviewContent((prev) => ({
            ...prev,
            [fileKey]: {
              type: "error",
              message: "Unable to parse Word document formatting directly.",
            },
          }));
        } finally {
          setPreviewLoading(false);
        }
      };
      reader.onerror = () => {
        setPreviewLoading(false);
      };
      reader.readAsArrayBuffer(activeFile);
    }
    // Excel spreadsheets (.xlsx, .xls)
    else if (ext === "xlsx" || ext === "xls") {
      setPreviewLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          setParsedPreviewContent((prev) => ({
            ...prev,
            [fileKey]: {
              type: "xlsx",
              sheetName,
              sheetNames: workbook.SheetNames,
              rows: jsonData.slice(0, 50), // Show first 50 rows
              totalRows: jsonData.length,
            },
          }));
        } catch (err) {
          console.error("Error parsing spreadsheet:", err);
          setParsedPreviewContent((prev) => ({
            ...prev,
            [fileKey]: {
              type: "error",
              message: "Could not parse spreadsheet structure.",
            },
          }));
        } finally {
          setPreviewLoading(false);
        }
      };
      reader.onerror = () => {
        setPreviewLoading(false);
      };
      reader.readAsArrayBuffer(activeFile);
    }
    // Plain text / CSV files (.txt, .csv)
    else if (ext === "txt" || ext === "csv") {
      setPreviewLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result || "";
        if (ext === "csv") {
          try {
            const workbook = XLSX.read(text, { type: "string" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            setParsedPreviewContent((prev) => ({
              ...prev,
              [fileKey]: {
                type: "csv",
                rows: jsonData.slice(0, 50),
                totalRows: jsonData.length,
              },
            }));
          } catch {
            setParsedPreviewContent((prev) => ({
              ...prev,
              [fileKey]: {
                type: "txt",
                text,
              },
            }));
          }
        } else {
          setParsedPreviewContent((prev) => ({
            ...prev,
            [fileKey]: {
              type: "txt",
              text,
            },
          }));
        }
        setPreviewLoading(false);
      };
      reader.onerror = () => {
        setPreviewLoading(false);
      };
      reader.readAsText(activeFile);
    }
    // ZIP Archives (.zip)
    else if (ext === "zip") {
      setPreviewLoading(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const zip = await JSZip.loadAsync(e.target.result);
          const fileList = [];
          zip.forEach((relativePath, zipEntry) => {
            fileList.push({
              name: relativePath,
              dir: zipEntry.dir,
              date: zipEntry.date,
            });
          });
          setParsedPreviewContent((prev) => ({
            ...prev,
            [fileKey]: {
              type: "zip",
              entries: fileList,
            },
          }));
        } catch (err) {
          console.error("Error reading zip contents:", err);
          setParsedPreviewContent((prev) => ({
            ...prev,
            [fileKey]: {
              type: "error",
              message: "Unable to inspect ZIP archive contents.",
            },
          }));
        } finally {
          setPreviewLoading(false);
        }
      };
      reader.onerror = () => {
        setPreviewLoading(false);
      };
      reader.readAsArrayBuffer(activeFile);
    }
  }, [selectedFiles, activePreviewIndex]);

  const handleOpenEditModal = async (doc) => {
    let existingUrl = null;
    const ext = (doc.file_extension || "").toLowerCase();
    if (["pdf", "jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
      try {
        const previewEndpoint = `/api/digilocker/access/documents/${doc.id}/preview/`;
        const res = await DigiLockerService.previewDocumentBlob(previewEndpoint);
        const blob = new Blob([res.data], { type: res.headers["content-type"] || "application/pdf" });
        existingUrl = URL.createObjectURL(blob);
      } catch (e) {
        console.warn("Could not load existing document preview:", e);
      }
    }

    setEditDocData({
      id: doc.id,
      folder: doc.folder ? String(doc.folder) : "",
      original_filename: doc.original_filename || "",
      description: doc.description || "",
      extension: doc.file_extension || "",
      file_size_display: doc.file_size_display || "",
      existingPreviewUrl: existingUrl,
    });
    setEditNewFiles([]);
    setEditPreviewSelection({ type: "existing", index: 0 });
    setIsExistingRemoved(false);
    setEditErrors({});
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    if (editDocData.existingPreviewUrl) {
      URL.revokeObjectURL(editDocData.existingPreviewUrl);
    }
    editNewFiles.forEach((f) => {
      if (f._previewUrl) URL.revokeObjectURL(f._previewUrl);
    });
    setEditNewFiles([]);
    setIsExistingRemoved(false);
    setEditPreviewSelection({ type: "existing", index: 0 });
    setShowEditModal(false);
    setEditDocData({
      id: null,
      folder: "",
      original_filename: "",
      description: "",
      extension: "",
      file_size_display: "",
      existingPreviewUrl: null,
    });
    setEditErrors({});
  };

  const handleEditFileChange = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = [];
    const errors = [];

    files.forEach((f) => {
      const ext = f.name.split(".").pop().toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) {
        errors.push(`'${f.name}': Disallowed file extension (.${ext}).`);
      } else if (f.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`'${f.name}': Exceeds 25 MB size limit.`);
      } else {
        if (["jpg", "jpeg", "png", "gif", "webp", "pdf"].includes(ext)) {
          f._previewUrl = URL.createObjectURL(f);
        }
        validFiles.push(f);
      }
    });

    if (errors.length > 0) {
      swal("File Validation Warning", errors.join("\n"), "warning");
    }

    if (validFiles.length > 0) {
      setEditNewFiles((prev) => {
        const next = [...prev, ...validFiles];
        // Automatically switch preview to the newly added file
        setEditPreviewSelection({ type: "new", index: prev.length });
        return next;
      });
    }
    e.target.value = null;
  };

  const handleRemoveEditFile = (index) => {
    setEditNewFiles((prev) => {
      const removed = prev[index];
      if (removed?._previewUrl) {
        URL.revokeObjectURL(removed._previewUrl);
      }
      const updated = prev.filter((_, i) => i !== index);

      // Adjust preview selection if needed
      setEditPreviewSelection((current) => {
        if (current.type === "new") {
          if (current.index === index) {
            if (updated.length > 0) {
              return { type: "new", index: Math.min(index, updated.length - 1) };
            } else if (!isExistingRemoved) {
              return { type: "existing", index: 0 };
            } else {
              return { type: "none", index: 0 };
            }
          } else if (current.index > index) {
            return { type: "new", index: current.index - 1 };
          }
        }
        return current;
      });

      return updated;
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!editDocData.folder) {
      errors.folder = "Destination folder is required.";
    }
    if (isExistingRemoved && editNewFiles.length === 0) {
      errors.files = "Please select at least one file or keep the current file.";
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setUpdating(true);
    setEditErrors({});

    try {
      // 1. If existing file is kept (!isExistingRemoved), update its destination folder and details
      if (!isExistingRemoved) {
        await DigiLockerService.updateDocument(editDocData.id, {
          folder: editDocData.folder,
          original_filename: editDocData.original_filename?.trim() || undefined,
          description: editDocData.description?.trim() || "",
        });
      } else if (isExistingRemoved && editNewFiles.length > 0) {
        // If user explicitly removed the existing document and added replacement file(s),
        // delete the old document
        try {
          await DigiLockerService.deleteDocument(editDocData.id);
        } catch (delErr) {
          console.warn("Could not delete previous document during replacement:", delErr);
        }
      }

      // 2. If new files were added to the folder, upload them as additional documents in this folder
      if (editNewFiles.length > 0) {
        const formData = new FormData();
        formData.append("folder", editDocData.folder);
        formData.append("description", editDocData.description?.trim() || "");
        editNewFiles.forEach((file) => {
          formData.append("files", file);
        });
        await DigiLockerService.uploadDocuments(formData);
      }

      swal("Success", "Document changes saved successfully.", "success");
      handleCloseEditModal();
      fetchDocuments();
      fetchFolders();
    } catch (err) {
      console.error("Error updating document:", err);
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.details?.[0] ||
        err.response?.data?.original_filename?.[0] ||
        "Failed to update document.";
      swal("Error", errMsg, "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!destinationFolder) {
      errors.folder = "Destination folder is required.";
    }
    if (selectedFiles.length === 0) {
      errors.files = "Please select at least one document to upload.";
    }

    if (Object.keys(errors).length > 0) {
      setUploadErrors(errors);
      return;
    }

    setUploading(true);
    setUploadErrors({});

    const formData = new FormData();
    formData.append("folder", destinationFolder);
    formData.append("description", description.trim());
    selectedFiles.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const res = await DigiLockerService.uploadDocuments(formData);
      swal(
        "Upload Successful",
        res.data?.message || "Documents uploaded successfully.",
        "success"
      );
      handleCloseUploadModal();
      fetchDocuments();
      fetchFolders();
    } catch (err) {
      console.error("Error uploading documents:", err);
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.details?.[0] ||
        "Failed to upload documents.";
      swal("Upload Error", errMsg, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (doc) => {
    const willDelete = await swal({
      title: "Delete Document?",
      text: `Are you sure you want to remove '${doc.original_filename}'?`,
      icon: "warning",
      buttons: ["Cancel", "Yes, Delete"],
      dangerMode: true,
    });

    if (willDelete) {
      try {
        await DigiLockerService.deleteDocument(doc.id);
        swal("Deleted", `'${doc.original_filename}' has been removed.`, "success");
        fetchDocuments();
        fetchFolders();
      } catch (err) {
        console.error("Error deleting document:", err);
        const errMsg =
          err.response?.data?.error || "Failed to delete document.";
        swal("Error", errMsg, "error");
      }
    }
  };

  const handleViewDocument = async (doc) => {
    setActionLoadingId(`view_${doc.id}`);
    try {
      const url = `/api/digilocker/access/documents/${doc.id}/preview/`;
      const fileRes = await DigiLockerService.previewDocumentBlob(url);
      const blob = new Blob([fileRes.data], { type: fileRes.headers["content-type"] || "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      setPreviewDoc(doc);
      setPreviewUrl(blobUrl);
      setShowPreviewModal(true);
    } catch (err) {
      console.error("Error viewing document:", err);
      swal("Preview Notice", "This document cannot be previewed directly inside the browser. You may download it instead.", "info");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDownloadDocument = async (doc) => {
    setActionLoadingId(`download_${doc.id}`);
    try {
      const url = `/api/digilocker/access/documents/${doc.id}/download/`;
      const fileRes = await DigiLockerService.downloadDocumentBlob(url);
      const blob = new Blob([fileRes.data], {
        type: fileRes.headers["content-type"] || "application/octet-stream",
      });
      const blobUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = blobUrl;
      downloadLink.setAttribute("download", doc.original_filename);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
    } catch (err) {
      console.error("Error downloading document:", err);
      let errMsg = "Failed to download document.";
      if (err.response?.status === 403) {
        errMsg = "Access Denied: You do not have permission to download this document.";
      } else if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          if (text) errMsg = text;
        } catch (e) {}
      } else if (err.response?.data?.error) {
        errMsg = err.response.data.error;
      }
      swal("Error", errMsg, "error");
    } finally {
      setActionLoadingId(null);
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


  // Filter & Search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFolderFilter]);

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      !searchTerm ||
      doc.original_filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.folder_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.description &&
        doc.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.uploaded_by_name &&
        doc.uploaded_by_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFolder =
      selectedFolderFilter === "All" ||
      String(doc.folder) === String(selectedFolderFilter);

    return matchesSearch && matchesFolder;
  });

  const totalRecords = filteredDocs.length;
  const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentRecords = filteredDocs.slice(indexOfFirst, indexOfLast);

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
      case "zip":
        return <i className="fa fa-file-archive text-warning me-2 fs-5"></i>;
      default:
        return <i className="fa fa-file-alt text-secondary me-2 fs-5"></i>;
    }
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
            <Link to={"#"}>Upload Files</Link>
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
                  Upload Files
                </Card.Title>
                <p className="mb-0 text-muted" style={{ fontSize: "13px" }}>
                  Store and catalog confidential employee documents
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
                    placeholder="Search documents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <Form.Select
                  size="sm"
                  value={selectedFolderFilter}
                  onChange={(e) => setSelectedFolderFilter(e.target.value)}
                  style={{
                    width: "auto",
                    minWidth: "160px",
                    height: "36px",
                    fontSize: "13px",
                    borderRadius: "8px",
                    borderColor: "#cbd5e1",
                  }}
                >
                  <option value="All">All Folders</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Form.Select>

                <CreateButton
                  module="digilocker_upload"
                  onClick={handleOpenUploadModal}
                  style={{
                    height: "36px",
                    borderRadius: "8px",
                    padding: "0 16px",
                  }}
                >
                  Upload Documents
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
                          <strong>DOCUMENT NAME</strong>
                        </th>
                        <th>
                          <strong>FOLDER NAME</strong>
                        </th>
                        <th>
                          <strong>FILE TYPE</strong>
                        </th>
                        <th>
                          <strong>FILE SIZE</strong>
                        </th>
                        <th>
                          <strong>UPLOADED BY</strong>
                        </th>
                        <th>
                          <strong>UPLOADED DATE</strong>
                        </th>
                        <th>
                          <strong>APPROVAL STATUS</strong>
                        </th>
                        <th className="text-end">
                          <strong>ACTIONS</strong>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDocs.length === 0 ? (
                        <tr>
                          <td
                            colSpan="9"
                            className="text-center py-4 text-muted"
                          >
                            No documents found.
                          </td>
                        </tr>
                      ) : (
                        currentRecords.map((doc, index) => (
                          <tr key={doc.id}>
                            <td>{indexOfFirst + index + 1}</td>
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
                              <span className="badge light badge-primary">
                                <i className="fa fa-folder me-1"></i>
                                {doc.folder_name}
                              </span>
                            </td>
                            <td>
                              <span className="text-uppercase fw-semibold text-muted">
                                {doc.file_extension}
                              </span>
                            </td>
                            <td>{doc.file_size_display}</td>
                            <td>{doc.uploaded_by_name || "-"}</td>
                            <td>
                              {doc.uploaded_at
                                ? new Date(doc.uploaded_at).toLocaleString()
                                : "-"}
                            </td>
                            <td>
                              {getApprovalBadge(doc.approval_status, doc.rejection_reason)}
                            </td>
                            <td className="text-end">
                              <div className="d-flex justify-content-end align-items-center gap-1">
                                {doc.approval_status === "approved" && !doc.can_edit ? (
                                  doc.latest_edit_request?.status === "pending" ? (
                                    <span
                                      className="badge bg-warning-subtle text-dark border border-warning"
                                      style={{ fontSize: "11px" }}
                                      title="Waiting for administrator to approve your edit request"
                                    >
                                      <i className="fa fa-clock-o me-1"></i>Pending Edit
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-warning shadow-sm d-flex align-items-center gap-1"
                                      style={{ fontSize: "11px", padding: "4px 8px" }}
                                      onClick={() => handleOpenRequestEditModal(doc)}
                                      title="Request permission from admin to edit/replace this approved document"
                                    >
                                      <i className="fa fa-key"></i> Request Edit
                                    </button>
                                  )
                                ) : (
                                  <EditButton
                                    module="digilocker_upload"
                                    onClick={() => handleOpenEditModal(doc)}
                                    title={doc.approval_status === 'approved' && doc.can_edit ? "Edit Approved Document" : "Edit Document"}
                                  />
                                )}
                                <DeleteButton
                                  module="digilocker_upload"
                                  onClick={() => handleDeleteDocument(doc)}
                                  title="Delete Document"
                                  disabled={doc.approval_status === "approved"}
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

              {!loading && filteredDocs.length > 0 && (
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

      {/* Modal for File Upload */}
      <Modal show={showUploadModal} onHide={handleCloseUploadModal} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>Upload Documents to DigiLocker</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleUploadSubmit}>
          <Modal.Body>
            <div className="row g-4">
              {/* Left Column: Form Controls and File Selection */}
              <div className="col-12 col-lg-6 border-end">
                <Form.Group className="mb-3">
                  <Form.Label>
                    Destination Folder <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Select
                    value={destinationFolder}
                    onChange={(e) => setDestinationFolder(e.target.value)}
                    isInvalid={!!uploadErrors.folder}
                    required
                  >
                    <option value="">-- Select Destination Folder --</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.folder_path || f.name} ({f.folder_type})
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">
                    {uploadErrors.folder}
                  </Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>
                    Choose Files <span className="text-danger">*</span>
                  </Form.Label>
                  <div
                    className="border border-2 border-dashed p-3 text-center rounded"
                    style={{ backgroundColor: "#f8fafc", cursor: "pointer" }}
                    onClick={() => document.getElementById("file-input-control")?.click()}
                  >
                    <i
                      className="fa fa-cloud-upload-alt text-primary mb-2"
                      style={{ fontSize: "32px" }}
                    ></i>
                    <h6 className="fw-bold mb-1" style={{ fontSize: "14px" }}>Click to select files from your computer</h6>
                    <p className="text-muted small mb-0" style={{ fontSize: "12px" }}>
                      Allowed: PDF, JPG, PNG, DOCX, XLSX, CSV, ZIP (Max 25 MB per file)
                    </p>
                    <input
                      id="file-input-control"
                      type="file"
                      multiple
                      style={{ display: "none" }}
                      onChange={handleFileChange}
                    />
                  </div>
                  {uploadErrors.files && (
                    <div className="text-danger small mt-1">{uploadErrors.files}</div>
                  )}
                </Form.Group>

                {/* Selected Files List with click-to-preview */}
                {selectedFiles.length > 0 && (
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <Form.Label className="fw-semibold mb-0" style={{ fontSize: "13px" }}>
                        Selected Files ({selectedFiles.length}):
                      </Form.Label>
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-danger p-0 text-decoration-none"
                        style={{ fontSize: "12px" }}
                        onClick={() => {
                          selectedFiles.forEach((f) => {
                            if (f._previewUrl) URL.revokeObjectURL(f._previewUrl);
                          });
                          setSelectedFiles([]);
                          setActivePreviewIndex(0);
                        }}
                      >
                        Clear All
                      </button>
                    </div>
                    <div
                      className="border rounded p-2"
                      style={{ maxHeight: "190px", overflowY: "auto", backgroundColor: "#f8fafc" }}
                    >
                      <div className="d-flex flex-column gap-1">
                        {selectedFiles.map((f, idx) => {
                          const ext = f.name.split(".").pop().toLowerCase();
                          const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
                          const isSelected = activePreviewIndex === idx;
                          return (
                            <div
                              key={idx}
                              onClick={() => setActivePreviewIndex(idx)}
                              className={`d-flex align-items-center justify-content-between p-2 rounded border cursor-pointer ${
                                isSelected ? "border-primary bg-white shadow-sm" : "bg-white"
                              }`}
                              style={{
                                cursor: "pointer",
                                borderLeftWidth: isSelected ? "4px" : "1px",
                                borderLeftColor: isSelected ? "rgb(61, 53, 119)" : undefined,
                              }}
                            >
                              <div className="d-flex align-items-center text-truncate me-2" style={{ minWidth: 0 }}>
                                {isImage && f._previewUrl ? (
                                  <img
                                    src={f._previewUrl}
                                    alt={f.name}
                                    style={{
                                      width: "28px",
                                      height: "28px",
                                      objectFit: "cover",
                                      borderRadius: "4px",
                                      flexShrink: 0,
                                    }}
                                    className="me-2 border"
                                  />
                                ) : (
                                  <div
                                    className="d-flex align-items-center justify-content-center me-2 bg-light rounded"
                                    style={{ width: "28px", height: "28px", flexShrink: 0 }}
                                  >
                                    {getFileIcon(ext)}
                                  </div>
                                )}
                                <div className="text-truncate">
                                  <div
                                    className={`text-truncate ${isSelected ? "fw-bold text-primary" : "fw-semibold text-dark"}`}
                                    style={{ fontSize: "12px" }}
                                    title={f.name}
                                  >
                                    {f.name}
                                  </div>
                                  <div className="text-muted" style={{ fontSize: "11px" }}>
                                    {f.size > 1024 * 1024
                                      ? `${(f.size / (1024 * 1024)).toFixed(2)} MB`
                                      : `${(f.size / 1024).toFixed(1)} KB`}
                                  </div>
                                </div>
                              </div>
                              <div className="d-flex align-items-center gap-1 flex-shrink-0">
                                {isSelected && (
                                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle" style={{ fontSize: "10px" }}>
                                    Viewing
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger shadow-sm ms-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveSelectedFile(idx);
                                  }}
                                  style={{ width: "22px", height: "22px", padding: 0, borderRadius: "50%" }}
                                  title="Remove file"
                                >
                                  <i className="fa fa-times" style={{ fontSize: "10px" }}></i>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Description (Optional) removed per user request */}
              </div>

              {/* Right Column: File Preview in the side of the tab */}
              <div className="col-12 col-lg-6 d-flex flex-column">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="fw-semibold text-dark" style={{ fontSize: "14px" }}>
                    <i className="fa fa-eye text-primary me-2"></i>File Preview
                  </span>
                  {selectedFiles.length > 0 && selectedFiles[activePreviewIndex] && (
                    <span className="badge bg-light text-dark border">
                      {activePreviewIndex + 1} of {selectedFiles.length}
                    </span>
                  )}
                </div>

                <div
                  className="card border rounded flex-grow-1 d-flex flex-column m-0 p-0 overflow-hidden"
                  style={{
                    backgroundColor: "#f8fafc",
                    minHeight: "380px",
                    maxHeight: "480px",
                  }}
                >
                  {selectedFiles.length === 0 ? (
                    <div className="d-flex flex-column align-items-center justify-content-center h-100 p-4 text-center my-auto">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center mb-3"
                        style={{
                          width: "68px",
                          height: "68px",
                          backgroundColor: "#edf2f7",
                          color: "#718096",
                        }}
                      >
                        <i className="fa fa-file-alt" style={{ fontSize: "30px" }}></i>
                      </div>
                      <h6 className="fw-semibold text-secondary mb-1">No File Selected</h6>
                      <p className="text-muted small mb-0" style={{ maxWidth: "260px" }}>
                        Select files on the left to inspect their preview here before uploading.
                      </p>
                    </div>
                  ) : (() => {
                    const activeFile = selectedFiles[activePreviewIndex] || selectedFiles[0];
                    if (!activeFile) return null;
                    const activeExt = activeFile.name.split(".").pop().toLowerCase();
                    const isImg = ["jpg", "jpeg", "png", "gif", "webp"].includes(activeExt);
                    const isPdf = activeExt === "pdf";
                    const fileKey = `${activeFile.name}_${activeFile.size}_${activeFile.lastModified || ""}`;
                    const parsedData = parsedPreviewContent[fileKey];

                    return (
                      <div className="d-flex flex-column h-100">
                        {/* Preview Top Bar */}
                        <div className="bg-white border-bottom px-3 py-2 d-flex align-items-center justify-content-between">
                          <div className="d-flex align-items-center text-truncate me-2">
                            <span className="me-2">{getFileIcon(activeExt)}</span>
                            <div className="text-truncate">
                              <div
                                className="fw-bold text-dark text-truncate"
                                style={{ fontSize: "13px" }}
                                title={activeFile.name}
                              >
                                {activeFile.name}
                              </div>
                              <div className="text-muted" style={{ fontSize: "11px" }}>
                                {activeFile.size > 1024 * 1024
                                  ? `${(activeFile.size / (1024 * 1024)).toFixed(2)} MB`
                                  : `${(activeFile.size / 1024).toFixed(1)} KB`}
                              </div>
                            </div>
                          </div>
                          {activeFile._previewUrl && (
                            <a
                              href={activeFile._previewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-xs btn-outline-primary"
                              title="Open in new window"
                            >
                              <i className="fa fa-external-link-alt"></i>
                            </a>
                          )}
                        </div>

                        {/* Preview Content Area */}
                        <div
                          className="flex-grow-1 d-flex flex-column justify-content-start overflow-auto p-2"
                          style={{
                            backgroundColor: isImg ? "#1e293b" : "#f1f5f9",
                            minHeight: "330px",
                            maxHeight: "410px",
                          }}
                        >
                          {previewLoading && !parsedData && !isImg && !isPdf ? (
                            <div className="d-flex flex-column align-items-center justify-content-center m-auto py-5 text-muted">
                              <span className="spinner-border text-primary mb-2" role="status"></span>
                              <span className="small">Rendering document preview...</span>
                            </div>
                          ) : isImg && activeFile._previewUrl ? (
                            <div className="d-flex align-items-center justify-content-center h-100 m-auto">
                              <img
                                src={activeFile._previewUrl}
                                alt={activeFile.name}
                                style={{
                                  maxWidth: "100%",
                                  maxHeight: "380px",
                                  objectFit: "contain",
                                  borderRadius: "4px",
                                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.3)",
                                }}
                              />
                            </div>
                          ) : isPdf && activeFile._previewUrl ? (
                            <iframe
                              src={`${activeFile._previewUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                              title={activeFile.name}
                              style={{
                                width: "100%",
                                height: "390px",
                                border: "none",
                                borderRadius: "4px",
                                backgroundColor: "#ffffff",
                              }}
                            />
                          ) : parsedData?.type === "docx" ? (
                            <div
                              className="bg-white rounded p-4 shadow-sm w-100 overflow-auto"
                              style={{
                                minHeight: "360px",
                                color: "#1e293b",
                                fontSize: "13px",
                                lineHeight: "1.6",
                              }}
                              dangerouslySetInnerHTML={{ __html: parsedData.html }}
                            />
                          ) : (parsedData?.type === "xlsx" || parsedData?.type === "csv") ? (
                            <div className="bg-white rounded p-3 shadow-sm w-100 overflow-auto" style={{ minHeight: "360px" }}>
                              {parsedData.sheetNames && parsedData.sheetNames.length > 0 && (
                                <div className="mb-2 pb-2 border-bottom d-flex align-items-center justify-content-between">
                                  <span className="badge bg-success-subtle text-success border border-success-subtle">
                                    <i className="fa fa-table me-1"></i> {parsedData.sheetName || "Sheet 1"}
                                  </span>
                                  <span className="text-muted small">
                                    Displaying {parsedData.rows?.length || 0} of {parsedData.totalRows || 0} rows
                                  </span>
                                </div>
                              )}
                              <div className="table-responsive">
                                <table className="table table-sm table-bordered table-striped mb-0" style={{ fontSize: "12px" }}>
                                  <tbody>
                                    {parsedData.rows && parsedData.rows.length > 0 ? (
                                      parsedData.rows.map((row, rIdx) => (
                                        <tr key={rIdx} className={rIdx === 0 ? "table-light fw-bold" : ""}>
                                          <td className="text-muted text-center" style={{ width: "35px" }}>{rIdx + 1}</td>
                                          {Array.isArray(row) && row.length > 0 ? (
                                            row.map((cell, cIdx) => (
                                              <td key={cIdx} className="text-nowrap">{cell !== undefined && cell !== null ? String(cell) : ""}</td>
                                            ))
                                          ) : (
                                            <td className="text-muted fst-italic">Empty row</td>
                                          )}
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td className="text-center text-muted p-3">No table data found in file.</td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : parsedData?.type === "txt" ? (
                            <div
                              className="bg-white rounded p-3 shadow-sm w-100 font-monospace overflow-auto"
                              style={{
                                whiteSpace: "pre-wrap",
                                fontSize: "12px",
                                minHeight: "360px",
                                maxHeight: "390px",
                                color: "#334155",
                              }}
                            >
                              {parsedData.text || "Empty text file."}
                            </div>
                          ) : parsedData?.type === "zip" ? (
                            <div className="bg-white rounded p-3 shadow-sm w-100 overflow-auto" style={{ minHeight: "360px" }}>
                              <div className="mb-2 pb-2 border-bottom d-flex align-items-center justify-content-between">
                                <span className="fw-bold text-dark" style={{ fontSize: "13px" }}>
                                  <i className="fa fa-file-archive text-warning me-1"></i> Archive Contents ({parsedData.entries?.length || 0} items)
                                </span>
                              </div>
                              <div className="list-group list-group-flush" style={{ fontSize: "12px" }}>
                                {parsedData.entries?.map((entry, eIdx) => (
                                  <div key={eIdx} className="list-group-item d-flex align-items-center justify-content-between px-2 py-1">
                                    <div className="text-truncate">
                                      <i className={`fa ${entry.dir ? "fa-folder text-warning" : "fa-file text-secondary"} me-2`}></i>
                                      <span>{entry.name}</span>
                                    </div>
                                    {entry.date && (
                                      <span className="text-muted small">
                                        {new Date(entry.date).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center p-4 bg-white rounded shadow-sm m-auto" style={{ maxWidth: "320px" }}>
                              <div className="mb-2">{getFileIcon(activeExt)}</div>
                              <h6 className="fw-bold text-dark mb-1">{activeFile.name}</h6>
                              <p className="text-muted small mb-0">
                                {parsedData?.message || `File ready to upload (.${activeExt.toUpperCase()}).`}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="danger light" onClick={handleCloseUploadModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={uploading}
              style={{
                backgroundColor: "rgb(61, 53, 119)",
                borderColor: "rgb(61, 53, 119)",
              }}
            >
              {uploading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Uploading...
                </>
              ) : (
                "Upload Documents"
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Edit Document Modal matching Upload Modal layout */}
      <Modal show={showEditModal} onHide={handleCloseEditModal} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>Upload Documents to DigiLocker</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleEditSubmit}>
          <Modal.Body>
            <div className="row g-4">
              {/* Left Column: Form Controls and File Selection */}
              <div className="col-12 col-lg-6 border-end">
                <Form.Group className="mb-3">
                  <Form.Label>
                    Destination Folder <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Select
                    value={editDocData.folder}
                    onChange={(e) =>
                      setEditDocData((prev) => ({
                        ...prev,
                        folder: e.target.value,
                      }))
                    }
                    isInvalid={!!editErrors.folder}
                    required
                  >
                    <option value="">-- Select Destination Folder --</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.folder_path || f.name} ({f.folder_type})
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">
                    {editErrors.folder}
                  </Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>
                    Choose Files <span className="text-danger">*</span>
                  </Form.Label>
                  <div
                    className="border border-2 border-dashed p-3 text-center rounded"
                    style={{ backgroundColor: "#f8fafc", cursor: "pointer" }}
                    onClick={() => document.getElementById("edit-file-input-control")?.click()}
                  >
                    <i
                      className="fa fa-cloud-upload-alt text-primary mb-2"
                      style={{ fontSize: "32px" }}
                    ></i>
                    <h6 className="fw-bold mb-1" style={{ fontSize: "14px" }}>
                      Click to select files from your computer
                    </h6>
                    <p className="text-muted small mb-0" style={{ fontSize: "12px" }}>
                      Allowed: PDF, JPG, PNG, DOCX, XLSX, CSV, ZIP (Max 25 MB per file)
                    </p>
                    <input
                      id="edit-file-input-control"
                      type="file"
                      multiple
                      style={{ display: "none" }}
                      onChange={handleEditFileChange}
                    />
                  </div>
                </Form.Group>

                {/* Selected Files / Existing File Item */}
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <Form.Label className="fw-semibold mb-0" style={{ fontSize: "13px" }}>
                      Selected Files ({(isExistingRemoved ? 0 : 1) + editNewFiles.length}):
                    </Form.Label>
                    {(editNewFiles.length > 0 || isExistingRemoved) && (
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-primary p-0 text-decoration-none"
                        style={{ fontSize: "12px" }}
                        onClick={() => {
                          editNewFiles.forEach((f) => {
                            if (f._previewUrl) URL.revokeObjectURL(f._previewUrl);
                          });
                          setEditNewFiles([]);
                          setIsExistingRemoved(false);
                          setEditPreviewSelection({ type: "existing", index: 0 });
                        }}
                      >
                        <i className="fa fa-undo me-1"></i>Reset to Original
                      </button>
                    )}
                  </div>

                  <div
                    className="border rounded p-2"
                    style={{ maxHeight: "200px", overflowY: "auto", backgroundColor: "#f8fafc" }}
                  >
                    <div className="d-flex flex-column gap-2">
                      {/* 1. Existing Document (unless removed) */}
                      {!isExistingRemoved && (
                        <div
                          onClick={() => setEditPreviewSelection({ type: "existing", index: 0 })}
                          className={`d-flex align-items-center justify-content-between p-2 rounded border cursor-pointer ${
                            editPreviewSelection.type === "existing" ? "border-primary bg-white shadow-sm" : "bg-white"
                          }`}
                          style={{
                            cursor: "pointer",
                            borderLeftWidth: editPreviewSelection.type === "existing" ? "4px" : "1px",
                            borderLeftColor: editPreviewSelection.type === "existing" ? "rgb(61, 53, 119)" : undefined,
                          }}
                        >
                          <div className="d-flex align-items-center text-truncate me-2" style={{ minWidth: 0 }}>
                            {["jpg", "jpeg", "png", "gif", "webp"].includes(
                              (editDocData.extension || "").toLowerCase()
                            ) && editDocData.existingPreviewUrl ? (
                              <img
                                src={editDocData.existingPreviewUrl}
                                alt={editDocData.original_filename}
                                style={{
                                  width: "28px",
                                  height: "28px",
                                  objectFit: "cover",
                                  borderRadius: "4px",
                                  flexShrink: 0,
                                }}
                                className="me-2 border"
                              />
                            ) : (
                              <div
                                className="d-flex align-items-center justify-content-center me-2 bg-light rounded"
                                style={{ width: "28px", height: "28px", flexShrink: 0 }}
                              >
                                {getFileIcon(editDocData.extension)}
                              </div>
                            )}
                            <div className="text-truncate">
                              <div
                                className={`text-truncate ${
                                  editPreviewSelection.type === "existing"
                                    ? "fw-bold text-primary"
                                    : "fw-semibold text-dark"
                                }`}
                                style={{ fontSize: "12px" }}
                                title={editDocData.original_filename}
                              >
                                {editDocData.original_filename}
                              </div>
                              <div className="text-muted" style={{ fontSize: "11px" }}>
                                {editDocData.file_size_display || `.${editDocData.extension?.toUpperCase()}`}
                              </div>
                            </div>
                          </div>
                          <div className="d-flex align-items-center gap-1 flex-shrink-0">
                            <span
                              className="badge bg-primary-subtle text-primary border border-primary-subtle"
                              style={{ fontSize: "10px" }}
                            >
                              Current
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger shadow-sm ms-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsExistingRemoved(true);
                                if (editPreviewSelection.type === "existing") {
                                  if (editNewFiles.length > 0) {
                                    setEditPreviewSelection({ type: "new", index: 0 });
                                  } else {
                                    setEditPreviewSelection({ type: "none", index: 0 });
                                  }
                                }
                              }}
                              style={{ width: "22px", height: "22px", padding: 0, borderRadius: "50%" }}
                              title="Remove existing file"
                            >
                              <i className="fa fa-times" style={{ fontSize: "10px" }}></i>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 2. Newly added files */}
                      {editNewFiles.map((f, idx) => {
                        const ext = f.name.split(".").pop().toLowerCase();
                        const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
                        const isSelected = editPreviewSelection.type === "new" && editPreviewSelection.index === idx;
                        return (
                          <div
                            key={idx}
                            onClick={() => setEditPreviewSelection({ type: "new", index: idx })}
                            className={`d-flex align-items-center justify-content-between p-2 rounded border cursor-pointer ${
                              isSelected ? "border-primary bg-white shadow-sm" : "bg-white"
                            }`}
                            style={{
                              cursor: "pointer",
                              borderLeftWidth: isSelected ? "4px" : "1px",
                              borderLeftColor: isSelected ? "rgb(61, 53, 119)" : undefined,
                            }}
                          >
                            <div className="d-flex align-items-center text-truncate me-2" style={{ minWidth: 0 }}>
                              {isImage && f._previewUrl ? (
                                <img
                                  src={f._previewUrl}
                                  alt={f.name}
                                  style={{
                                    width: "28px",
                                    height: "28px",
                                    objectFit: "cover",
                                    borderRadius: "4px",
                                    flexShrink: 0,
                                  }}
                                  className="me-2 border"
                                />
                              ) : (
                                <div
                                  className="d-flex align-items-center justify-content-center me-2 bg-light rounded"
                                  style={{ width: "28px", height: "28px", flexShrink: 0 }}
                                >
                                  {getFileIcon(ext)}
                                </div>
                              )}
                              <div className="text-truncate">
                                <div
                                  className={`text-truncate ${isSelected ? "fw-bold text-primary" : "fw-semibold text-dark"}`}
                                  style={{ fontSize: "12px" }}
                                  title={f.name}
                                >
                                  {f.name}
                                </div>
                                <div className="text-muted" style={{ fontSize: "11px" }}>
                                  {f.size > 1024 * 1024
                                    ? `${(f.size / (1024 * 1024)).toFixed(2)} MB`
                                    : `${(f.size / 1024).toFixed(1)} KB`}
                                </div>
                              </div>
                            </div>
                            <div className="d-flex align-items-center gap-1 flex-shrink-0">
                              <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: "10px" }}>
                                New
                              </span>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger shadow-sm ms-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveEditFile(idx);
                                }}
                                style={{ width: "22px", height: "22px", padding: 0, borderRadius: "50%" }}
                                title="Remove file"
                              >
                                <i className="fa fa-times" style={{ fontSize: "10px" }}></i>
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* 3. Empty state if current file was removed and no new files */}
                      {isExistingRemoved && editNewFiles.length === 0 && (
                        <div className="text-center py-4 px-2 text-muted bg-white rounded border border-dashed">
                          <i className="fa fa-file-text-o fa-2x text-muted mb-2 d-block opacity-50"></i>
                          <div className="small fw-semibold text-danger mb-1">Current file removed</div>
                          <div className="small text-muted" style={{ fontSize: "11px" }}>
                            Click the box above to choose a replacement file or click "Reset to Original".
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: File Preview */}
              <div className="col-12 col-lg-6 d-flex flex-column">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="fw-semibold text-dark" style={{ fontSize: "14px" }}>
                    <i className="fa fa-eye text-primary me-2"></i>File Preview
                  </span>
                  <span className="badge bg-light text-dark border">
                    {(() => {
                      const totalCount = (isExistingRemoved ? 0 : 1) + editNewFiles.length;
                      if (totalCount === 0) return "0 of 0";
                      let currentIndex = 1;
                      if (editPreviewSelection.type === "new") {
                        currentIndex = (isExistingRemoved ? 1 : 2) + editPreviewSelection.index;
                      } else {
                        currentIndex = 1;
                      }
                      return `${Math.min(currentIndex, totalCount)} of ${totalCount}`;
                    })()}
                  </span>
                </div>

                <div
                  className="card border rounded flex-grow-1 d-flex flex-column m-0 p-0 overflow-hidden"
                  style={{
                    backgroundColor: "#f8fafc",
                    minHeight: "380px",
                    maxHeight: "480px",
                  }}
                >
                  {(() => {
                    // Preview active new file
                    if (editPreviewSelection.type === "new") {
                      const activeFile = editNewFiles[editPreviewSelection.index] || editNewFiles[0];
                      if (!activeFile) return null;
                      const activeExt = activeFile.name.split(".").pop().toLowerCase();
                      const isImg = ["jpg", "jpeg", "png", "gif", "webp"].includes(activeExt);
                      const isPdf = activeExt === "pdf";

                      return (
                        <div className="d-flex flex-column h-100">
                          <div className="bg-white border-bottom px-3 py-2 d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center text-truncate me-2">
                              <span className="me-2">{getFileIcon(activeExt)}</span>
                              <div className="text-truncate">
                                <div
                                  className="fw-bold text-dark text-truncate"
                                  style={{ fontSize: "13px" }}
                                  title={activeFile.name}
                                >
                                  {activeFile.name}
                                </div>
                                <div className="text-muted" style={{ fontSize: "11px" }}>
                                  {activeFile.size > 1024 * 1024
                                    ? `${(activeFile.size / (1024 * 1024)).toFixed(2)} MB`
                                    : `${(activeFile.size / 1024).toFixed(1)} KB`}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div
                            className="flex-grow-1 d-flex flex-column justify-content-start overflow-auto p-2"
                            style={{
                              backgroundColor: isImg ? "#1e293b" : "#f1f5f9",
                              minHeight: "330px",
                              maxHeight: "410px",
                            }}
                          >
                            {isImg && activeFile._previewUrl ? (
                              <div className="d-flex align-items-center justify-content-center h-100 m-auto">
                                <img
                                  src={activeFile._previewUrl}
                                  alt={activeFile.name}
                                  style={{
                                    maxWidth: "100%",
                                    maxHeight: "380px",
                                    objectFit: "contain",
                                    borderRadius: "4px",
                                  }}
                                />
                              </div>
                            ) : isPdf && activeFile._previewUrl ? (
                              <iframe
                                src={`${activeFile._previewUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                                title={activeFile.name}
                                style={{
                                  width: "100%",
                                  height: "390px",
                                  border: "none",
                                  borderRadius: "4px",
                                  backgroundColor: "#ffffff",
                                }}
                              />
                            ) : (
                              <div
                                className="text-center p-4 bg-white rounded shadow-sm m-auto"
                                style={{ maxWidth: "320px" }}
                              >
                                <div className="mb-2">{getFileIcon(activeExt)}</div>
                                <h6 className="fw-bold text-dark mb-1">{activeFile.name}</h6>
                                <p className="text-muted small mb-0">
                                  File ready to upload (.{activeExt.toUpperCase()}).
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // If existing document is previewed and not removed
                    if (editPreviewSelection.type === "existing" && !isExistingRemoved) {
                      const existingExt = (editDocData.extension || "").toLowerCase();
                      const isImg = ["jpg", "jpeg", "png", "gif", "webp"].includes(existingExt);
                      const isPdf = existingExt === "pdf";

                      return (
                        <div className="d-flex flex-column h-100">
                          <div className="bg-white border-bottom px-3 py-2 d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center text-truncate me-2">
                              <span className="me-2">{getFileIcon(existingExt)}</span>
                              <div className="text-truncate">
                                <div
                                  className="fw-bold text-dark text-truncate"
                                  style={{ fontSize: "13px" }}
                                  title={editDocData.original_filename}
                                >
                                  {editDocData.original_filename}
                                </div>
                                <div className="text-muted" style={{ fontSize: "11px" }}>
                                  {editDocData.file_size_display || `.${existingExt.toUpperCase()}`}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div
                            className="flex-grow-1 d-flex flex-column justify-content-start overflow-auto p-2"
                            style={{
                              backgroundColor: isImg ? "#1e293b" : "#f1f5f9",
                              minHeight: "330px",
                              maxHeight: "410px",
                            }}
                          >
                            {isImg && editDocData.existingPreviewUrl ? (
                              <div className="d-flex align-items-center justify-content-center h-100 m-auto">
                                <img
                                  src={editDocData.existingPreviewUrl}
                                  alt={editDocData.original_filename}
                                  style={{
                                    maxWidth: "100%",
                                    maxHeight: "380px",
                                    objectFit: "contain",
                                    borderRadius: "4px",
                                  }}
                                />
                              </div>
                            ) : isPdf && editDocData.existingPreviewUrl ? (
                              <iframe
                                src={`${editDocData.existingPreviewUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                                title={editDocData.original_filename}
                                style={{
                                  width: "100%",
                                  height: "390px",
                                  border: "none",
                                  borderRadius: "4px",
                                  backgroundColor: "#ffffff",
                                }}
                              />
                            ) : (
                              <div
                                className="text-center p-4 bg-white rounded shadow-sm m-auto"
                                style={{ maxWidth: "320px" }}
                              >
                                <div className="mb-2">{getFileIcon(existingExt)}</div>
                                <h6 className="fw-bold text-dark mb-1">{editDocData.original_filename}</h6>
                                <p className="text-muted small mb-0">
                                  Current file attached to this document.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // Otherwise empty / removed preview
                    return (
                      <div className="h-100 d-flex flex-column align-items-center justify-content-center p-4 text-center m-auto">
                        <div
                          className="rounded-circle bg-white d-flex align-items-center justify-content-center shadow-sm mb-3"
                          style={{ width: "64px", height: "64px" }}
                        >
                          <i className="fa fa-file-text-o fa-2x text-muted"></i>
                        </div>
                        <h6 className="fw-bold text-dark mb-1">No File Selected</h6>
                        <p className="text-muted small mb-0" style={{ maxWidth: "260px" }}>
                          Select a file from the list on the left to preview it here before saving.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="danger light" onClick={handleCloseEditModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={updating}
              style={{
                backgroundColor: "rgb(61, 53, 119)",
                borderColor: "rgb(61, 53, 119)",
              }}
            >
              {updating ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>


      {/* Request Edit Approval Modal */}
      <Modal
        show={showRequestEditModal}
        onHide={() => setShowRequestEditModal(false)}
        centered
      >
        <Form onSubmit={handleSubmitRequestEdit}>
          <Modal.Header closeButton>
            <Modal.Title className="h6 fw-bold">
              <i className="fa fa-key text-warning me-2"></i> Request Edit Approval
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="alert alert-info py-2 px-3 small mb-3">
              <i className="fa fa-info-circle me-1"></i>
              This document is <strong>Approved</strong> and locked. Please enter a reason explaining why you need to edit or replace this document. An administrator will review your request.
            </div>
            <div className="mb-2">
              <span className="text-muted small">Document:</span>{" "}
              <strong>{requestEditDoc?.original_filename}</strong>
            </div>
            <div className="mb-3">
              <span className="text-muted small">Folder:</span>{" "}
              <span className="badge bg-light text-dark border">{requestEditDoc?.folder_name}</span>
            </div>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">
                Reason for Edit Request (Optional):
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="e.g. Upload updated certificate, rectify typographical error in metadata..."
                value={requestEditReason}
                onChange={(e) => setRequestEditReason(e.target.value)}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="light"
              onClick={() => setShowRequestEditModal(false)}
              disabled={requestEditLoading}
            >
              Cancel
            </Button>
            <Button
              variant="warning"
              type="submit"
              disabled={requestEditLoading}
            >
              {requestEditLoading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Document Preview Modal */}
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
                  handleDownloadDocument(previewDoc);
                }}
                style={{
                  backgroundColor: "rgb(61, 53, 119)",
                  borderColor: "rgb(61, 53, 119)",
                }}
              >
                <i className="fa fa-download me-1"></i> Download Document
              </button>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="danger light" onClick={handleClosePreviewModal}>
            Close Preview
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default UploadFiles;
