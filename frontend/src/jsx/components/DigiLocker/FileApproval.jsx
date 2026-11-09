import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DigiLockerService from '../../../services/DigiLockerService';
import Pagination from '../Common/Pagination';
import { Modal, Button, Card, Row, Col, Badge, Form, Tab, Nav } from 'react-bootstrap';
import Swal from 'sweetalert2';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

const FileApproval = () => {
  // Tabs: 'files' | 'edit_requests'
  const [activeTab, setActiveTab] = useState('files');

  // Tab 1: File Approvals State
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docSearch, setDocSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [folderFilter, setFolderFilter] = useState('');
  const [docCurrentPage, setDocCurrentPage] = useState(1);
  const [docRowsPerPage, setDocRowsPerPage] = useState(10);

  // Tab 2: Edit Approval Requests State
  const [editRequests, setEditRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState('');
  const [reqCurrentPage, setReqCurrentPage] = useState(1);
  const [reqRowsPerPage] = useState(10);

  // Reference data
  const [folders, setFolders] = useState([]);

  // Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [parsedPreviewContent, setParsedPreviewContent] = useState(null);

  // Rejection Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingItem, setRejectingItem] = useState(null); // { type: 'file' | 'edit_request', id: number, name: string }
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingLoading, setRejectingLoading] = useState(false);

  // History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyDoc, setHistoryDoc] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Action loading indicators
  const [actionInProgressId, setActionInProgressId] = useState(null);

  // Load Folders filter
  useEffect(() => {
    const fetchFolders = async () => {
      try {
        const res = await DigiLockerService.getFolders();
        const data = res.data;
        setFolders(Array.isArray(data) ? data : data.results || []);
      } catch (err) {
        console.error('Error fetching folders:', err);
      }
    };
    fetchFolders();
  }, []);

  // Fetch File Approvals
  const fetchFileApprovals = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (folderFilter) params.folder = folderFilter;
      if (docSearch) params.search = docSearch;

      const res = await DigiLockerService.getFileApprovals(params);
      const data = res.data;
      setDocuments(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error('Error fetching file approvals:', err);
      Swal.fire('Error', 'Failed to load file approvals list.', 'error');
    } finally {
      setLoadingDocs(false);
    }
  }, [statusFilter, folderFilter, docSearch]);

  // Fetch Edit Approval Requests
  const fetchEditRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const params = {};
      if (requestStatusFilter) params.status = requestStatusFilter;
      if (requestSearch) params.search = requestSearch;

      const res = await DigiLockerService.getEditRequests(params);
      const data = res.data;
      setEditRequests(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error('Error fetching edit requests:', err);
      Swal.fire('Error', 'Failed to load edit approval requests.', 'error');
    } finally {
      setLoadingRequests(false);
    }
  }, [requestStatusFilter, requestSearch]);

  useEffect(() => {
    if (activeTab === 'files') {
      fetchFileApprovals();
    } else {
      fetchEditRequests();
    }
  }, [activeTab, fetchFileApprovals, fetchEditRequests]);

  // Handle Approve File
  const handleApproveFile = async (doc) => {
    const result = await Swal.fire({
      title: 'Approve File?',
      text: `Are you sure you want to approve "${doc.original_filename}"? Once approved, the document is locked for the employee.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Approve',
      confirmButtonColor: '#28a745',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    setActionInProgressId(doc.id);
    try {
      await DigiLockerService.approveFile(doc.id);
      Swal.fire('Approved!', `"${doc.original_filename}" has been approved successfully.`, 'success');
      fetchFileApprovals();
    } catch (err) {
      console.error('Error approving document:', err);
      const msg = err.response?.data?.error || 'Failed to approve document.';
      Swal.fire('Error', msg, 'error');
    } finally {
      setActionInProgressId(null);
    }
  };

  // Handle Changing Approved Document back to Pending
  const handleSetPendingFile = async (doc) => {
    const result = await Swal.fire({
      title: 'Change to Pending?',
      text: `Do you want to change "${doc.original_filename}" back to Pending status? This will allow the document to be edited or re-reviewed.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Change to Pending',
      confirmButtonColor: '#ffc107',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    setActionInProgressId(doc.id);
    try {
      await DigiLockerService.setFilePending(doc.id, { remarks: 'Status changed to Pending by administrator for editing or re-evaluation.' });
      Swal.fire('Changed to Pending!', `"${doc.original_filename}" is now in Pending status.`, 'success');
      fetchFileApprovals();
    } catch (err) {
      console.error('Error reverting document to pending:', err);
      const msg = err.response?.data?.error || 'Failed to change status to Pending.';
      Swal.fire('Error', msg, 'error');
    } finally {
      setActionInProgressId(null);
    }
  };

  // Open Rejection Modal
  const handleOpenRejectModal = (type, item) => {
    setRejectingItem({
      type,
      id: item.id,
      name: type === 'file' ? item.original_filename : (item.document_name || `Document #${item.document}`)
    });
    setRejectionReason('');
    setShowRejectModal(true);
  };

  // Submit Rejection
  const handleSubmitReject = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      Swal.fire('Validation Warning', 'Please provide a reason for rejection.', 'warning');
      return;
    }

    setRejectingLoading(true);
    try {
      if (rejectingItem.type === 'file') {
        await DigiLockerService.rejectFile(rejectingItem.id, { reason: rejectionReason.trim() });
        Swal.fire('Rejected', `"${rejectingItem.name}" has been rejected.`, 'info');
        fetchFileApprovals();
      } else {
        await DigiLockerService.rejectEditRequest(rejectingItem.id, { reason: rejectionReason.trim() });
        Swal.fire('Rejected', `Edit request for "${rejectingItem.name}" has been rejected.`, 'info');
        fetchEditRequests();
      }
      setShowRejectModal(false);
    } catch (err) {
      console.error('Error rejecting:', err);
      const msg = err.response?.data?.error || 'Failed to complete rejection.';
      Swal.fire('Error', msg, 'error');
    } finally {
      setRejectingLoading(false);
    }
  };

  // Handle Approve Edit Request
  const handleApproveEditRequest = async (reqItem) => {
    const result = await Swal.fire({
      title: 'Approve Edit Request?',
      text: `Grant edit permission to employee "${reqItem.employee_name}" for document "${reqItem.document_name}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Grant Edit Permission',
      confirmButtonColor: '#28a745',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    setActionInProgressId(reqItem.id);
    try {
      await DigiLockerService.approveEditRequest(reqItem.id);
      Swal.fire('Edit Approved!', `Edit permission granted to "${reqItem.employee_name}".`, 'success');
      fetchEditRequests();
    } catch (err) {
      console.error('Error approving edit request:', err);
      const msg = err.response?.data?.error || 'Failed to approve edit request.';
      Swal.fire('Error', msg, 'error');
    } finally {
      setActionInProgressId(null);
    }
  };

  // Preview Document
  const handlePreviewDocument = async (docId, fileName, ext) => {
    setPreviewLoading(true);
    setShowPreviewModal(true);
    setPreviewDoc({ id: docId, name: fileName, extension: ext });
    setPreviewUrl('');
    setParsedPreviewContent(null);

    const safeExt = (ext || (fileName ? fileName.split('.').pop() : '') || '').toLowerCase();

    try {
      const endpoint = `/api/digilocker/access/documents/${docId}/preview/`;
      const res = await DigiLockerService.previewDocumentBlob(endpoint);
      const contentType = res.headers['content-type'] || 'application/octet-stream';
      const blob = new Blob([res.data], { type: contentType });

      // Standard object URL for iframe (PDF) and img (images)
      const objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);

      // Parse rich content for Word (.docx, .doc), Excel (.xlsx, .xls), CSV, Text (.txt), and ZIP (.zip)
      if (['docx', 'doc'].includes(safeExt)) {
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          setParsedPreviewContent({
            type: 'docx',
            html: result.value || '<p class="text-muted">Document contains no readable text.</p>'
          });
        } catch (docxErr) {
          console.error('Error parsing docx:', docxErr);
          setParsedPreviewContent({
            type: 'fallback',
            message: 'Unable to render Word document inline.'
          });
        }
      } else if (['xlsx', 'xls', 'csv'].includes(safeExt)) {
        try {
          let workbook;
          if (safeExt === 'csv') {
            const text = await blob.text();
            workbook = XLSX.read(text, { type: 'string' });
          } else {
            const arrayBuffer = await blob.arrayBuffer();
            workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
          }
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          setParsedPreviewContent({
            type: 'xlsx',
            sheetName: sheetName || 'Sheet1',
            sheetNames: workbook.SheetNames || [],
            rows: jsonData.slice(0, 100),
            totalRows: jsonData.length
          });
        } catch (xlsxErr) {
          console.error('Error parsing spreadsheet:', xlsxErr);
          setParsedPreviewContent({
            type: 'fallback',
            message: 'Unable to render spreadsheet inline.'
          });
        }
      } else if (['txt', 'log', 'json', 'xml'].includes(safeExt)) {
        try {
          const text = await blob.text();
          setParsedPreviewContent({
            type: 'txt',
            text: text
          });
        } catch (txtErr) {
          console.error('Error reading text file:', txtErr);
        }
      } else if (['zip'].includes(safeExt)) {
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const zip = await JSZip.loadAsync(arrayBuffer);
          const fileList = [];
          zip.forEach((relativePath, zipEntry) => {
            fileList.push({
              name: relativePath,
              dir: zipEntry.dir,
              date: zipEntry.date
            });
          });
          setParsedPreviewContent({
            type: 'zip',
            entries: fileList
          });
        } catch (zipErr) {
          console.error('Error reading zip file:', zipErr);
          setParsedPreviewContent({
            type: 'fallback',
            message: 'Unable to inspect zip archive entries.'
          });
        }
      }
    } catch (err) {
      console.error('Error previewing document:', err);
      Swal.fire('Preview Error', 'Failed to load document preview. Ensure you have administrator access.', 'error');
      setShowPreviewModal(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreviewModal = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setShowPreviewModal(false);
    setPreviewDoc(null);
    setPreviewUrl('');
    setParsedPreviewContent(null);
  };

  // View Document Audit History
  const handleViewHistory = async (doc) => {
    setHistoryDoc(doc);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const res = await DigiLockerService.getDocumentApprovalHistory(doc.id);
      setHistoryList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching approval history:', err);
      Swal.fire('Error', 'Failed to load approval audit history.', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Helpers
  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'approved') {
      return (
        <span className="badge light badge-success">
          <i className="fa fa-check-circle me-1"></i>Approved
        </span>
      );
    }
    if (s === 'rejected') {
      return (
        <span className="badge light badge-danger">
          <i className="fa fa-times-circle me-1"></i>Rejected
        </span>
      );
    }
    if (s === 'used') {
      return (
        <span className="badge light badge-dark">
          <i className="fa fa-archive me-1"></i>Used
        </span>
      );
    }
    return (
      <span className="badge light badge-warning">
        <i className="fa fa-clock-o me-1"></i>Pending
      </span>
    );
  };

  const getFileIcon = (ext) => {
    const e = (ext || '').toLowerCase();
    if (e === 'pdf') return <i className="fa fa-file-pdf-o text-danger me-2" style={{ fontSize: '18px' }}></i>;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(e)) return <i className="fa fa-file-image-o text-info me-2" style={{ fontSize: '18px' }}></i>;
    if (['doc', 'docx'].includes(e)) return <i className="fa fa-file-word-o text-primary me-2" style={{ fontSize: '18px' }}></i>;
    if (['xls', 'xlsx'].includes(e)) return <i className="fa fa-file-excel-o text-success me-2" style={{ fontSize: '18px' }}></i>;
    if (['zip', 'rar'].includes(e)) return <i className="fa fa-file-archive-o text-warning me-2" style={{ fontSize: '18px' }}></i>;
    return <i className="fa fa-file-text-o text-secondary me-2" style={{ fontSize: '18px' }}></i>;
  };

  // Filter & Pagination - Tab 1 (Files)
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchSearch =
        !docSearch ||
        doc.original_filename?.toLowerCase().includes(docSearch.toLowerCase()) ||
        doc.employee_name?.toLowerCase().includes(docSearch.toLowerCase()) ||
        doc.employee_id?.toLowerCase().includes(docSearch.toLowerCase()) ||
        doc.folder_name?.toLowerCase().includes(docSearch.toLowerCase());
      const matchStatus = !statusFilter || doc.approval_status === statusFilter;
      const matchFolder = !folderFilter || String(doc.folder) === String(folderFilter);
      return matchSearch && matchStatus && matchFolder;
    });
  }, [documents, docSearch, statusFilter, folderFilter]);

  const docTotalPages = Math.ceil(filteredDocs.length / docRowsPerPage) || 1;
  const docIndexOfLast = docCurrentPage * docRowsPerPage;
  const docIndexOfFirst = docIndexOfLast - docRowsPerPage;
  const currentDocs = filteredDocs.slice(docIndexOfFirst, docIndexOfLast);

  // Filter & Pagination - Tab 2 (Edit Requests)
  const filteredRequests = useMemo(() => {
    return editRequests.filter((req) => {
      const matchSearch =
        !requestSearch ||
        req.document_name?.toLowerCase().includes(requestSearch.toLowerCase()) ||
        req.employee_name?.toLowerCase().includes(requestSearch.toLowerCase()) ||
        req.employee_id?.toLowerCase().includes(requestSearch.toLowerCase()) ||
        req.request_reason?.toLowerCase().includes(requestSearch.toLowerCase());
      const matchStatus = !requestStatusFilter || req.status === requestStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [editRequests, requestSearch, requestStatusFilter]);

  const reqTotalPages = Math.ceil(filteredRequests.length / reqRowsPerPage) || 1;
  const reqIndexOfLast = reqCurrentPage * reqRowsPerPage;
  const reqIndexOfFirst = reqIndexOfLast - reqRowsPerPage;
  const currentRequests = filteredRequests.slice(reqIndexOfFirst, reqIndexOfLast);

  return (
    <div className="container-fluid park-area-page">
      {/* Breadcrumb Header */}
      <div className="page-titles">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <Link to={"#"}>DigiLocker</Link>
          </li>
          <li className="breadcrumb-item">
            <Link to={"#"}>Transactions</Link>
          </li>
          <li className="breadcrumb-item active">
            <Link to={"#"}>File Approval</Link>
          </li>
        </ol>
      </div>

      {/* Tabs */}
      <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
        <Nav variant="tabs" className="mb-3">
          <Nav.Item>
            <Nav.Link eventKey="files" className="fw-semibold">
              <i className="fa fa-files-o me-2"></i> File Approvals
              {documents.filter((d) => d.approval_status === 'pending').length > 0 && (
                <span className="badge light badge-warning ms-2">
                  {documents.filter((d) => d.approval_status === 'pending').length}
                </span>
              )}
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="edit_requests" className="fw-semibold">
              <i className="fa fa-edit me-2"></i> Edit Approval Requests
              {editRequests.filter((r) => r.status === 'pending').length > 0 && (
                <span className="badge light badge-danger ms-2">
                  {editRequests.filter((r) => r.status === 'pending').length}
                </span>
              )}
            </Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content>
          {/* TAB 1: FILE APPROVALS */}
          <Tab.Pane eventKey="files">
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
                        File Approval
                      </Card.Title>
                      <p className="mb-0 text-muted" style={{ fontSize: "13px" }}>
                        Review, preview, and authorize employee document uploads and status changes
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
                          value={docSearch}
                          onChange={(e) => {
                            setDocSearch(e.target.value);
                            setDocCurrentPage(1);
                          }}
                        />
                      </div>

                      <Form.Select
                        size="sm"
                        value={statusFilter}
                        onChange={(e) => {
                          setStatusFilter(e.target.value);
                          setDocCurrentPage(1);
                        }}
                        style={{
                          width: "auto",
                          minWidth: "150px",
                          height: "36px",
                          fontSize: "13px",
                          borderRadius: "8px",
                          borderColor: "#cbd5e1",
                        }}
                      >
                        <option value="">All Approval Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </Form.Select>

                      <Form.Select
                        size="sm"
                        value={folderFilter}
                        onChange={(e) => {
                          setFolderFilter(e.target.value);
                          setDocCurrentPage(1);
                        }}
                        style={{
                          width: "auto",
                          minWidth: "150px",
                          height: "36px",
                          fontSize: "13px",
                          borderRadius: "8px",
                          borderColor: "#cbd5e1",
                        }}
                      >
                        <option value="">All Folders</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </Form.Select>

                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => fetchFileApprovals()}
                        title="Refresh List"
                        style={{
                          height: "36px",
                          borderRadius: "8px",
                          padding: "0 14px",
                          fontSize: "13px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <i className="fa fa-refresh"></i> Refresh
                      </Button>
                    </div>
                  </Card.Header>

                  <Card.Body>
                    {/* Table */}
                    <div className="table-responsive">
                      <table className="table table-responsive-md w-100">
                        <thead>
                          <tr>
                            <th>
                              <strong>SL NO</strong>
                            </th>
                            <th>
                              <strong>EMPLOYEE NAME</strong>
                            </th>
                            <th>
                              <strong>EMPLOYEE ID</strong>
                            </th>
                            <th>
                              <strong>FOLDER NAME</strong>
                            </th>
                            <th>
                              <strong>FILE NAME</strong>
                            </th>
                            <th>
                              <strong>FILE TYPE</strong>
                            </th>
                            <th>
                              <strong>UPLOADED DATE</strong>
                            </th>
                            <th>
                              <strong>UPLOADED TIME</strong>
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
                          {loadingDocs ? (
                            <tr>
                              <td colSpan="10" className="text-center py-5">
                                <div className="spinner-border text-primary" role="status">
                                  <span className="visually-hidden">Loading...</span>
                                </div>
                              </td>
                            </tr>
                          ) : currentDocs.length === 0 ? (
                            <tr>
                              <td colSpan="10" className="text-center py-4 text-muted">
                                No uploaded documents found matching criteria.
                              </td>
                            </tr>
                          ) : (
                            currentDocs.map((doc, idx) => {
                              const uploadDate = doc.uploaded_at ? new Date(doc.uploaded_at) : null;
                              const dateStr = uploadDate ? uploadDate.toLocaleDateString() : '-';
                              const timeStr = uploadDate ? uploadDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
                              const isPending = doc.approval_status === 'pending';

                              return (
                                <tr key={doc.id}>
                                  <td>{docIndexOfFirst + idx + 1}</td>
                                  <td>
                                    <span className="fw-bold text-dark">{doc.employee_name || '-'}</span>
                                  </td>
                                  <td>
                                    <span className="badge light badge-secondary">
                                      {doc.employee_id || '-'}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="badge light badge-primary">
                                      <i className="fa fa-folder me-1"></i> {doc.folder_name}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="d-flex align-items-center">
                                      {getFileIcon(doc.file_extension)}
                                      <div>
                                        <span className="fw-semibold text-dark text-truncate d-inline-block" style={{ maxWidth: '220px' }}>
                                          {doc.original_filename}
                                        </span>
                                        <div className="text-muted" style={{ fontSize: '11px' }}>
                                          {doc.file_size_display}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <span className="text-uppercase fw-semibold text-muted">
                                      {doc.file_extension}
                                    </span>
                                  </td>
                                  <td>{dateStr}</td>
                                  <td>{timeStr}</td>
                                  <td>
                                    {getStatusBadge(doc.approval_status)}
                                    {doc.approval_status === 'rejected' && doc.rejection_reason && (
                                      <div className="text-danger small mt-1" style={{ fontSize: '11px' }}>
                                        <i className="fa fa-info-circle me-1"></i> {doc.rejection_reason}
                                      </div>
                                    )}
                                  </td>
                                  <td className="text-end">
                                    <div className="d-flex justify-content-end align-items-center gap-1">
                                      {/* Preview Button */}
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-info shadow"
                                        style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                        title="View / Preview Document"
                                        onClick={() => handlePreviewDocument(doc.id, doc.original_filename, doc.file_extension)}
                                      >
                                        <i className="fa fa-eye"></i>
                                      </button>

                                      {/* Approve / Set Pending Button */}
                                      {isPending ? (
                                        <>
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-success shadow"
                                            style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                            title="Approve Document"
                                            disabled={actionInProgressId === doc.id}
                                            onClick={() => handleApproveFile(doc)}
                                          >
                                            <i className="fa fa-check"></i>
                                          </button>
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger shadow"
                                            style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                            title="Reject Document"
                                            disabled={actionInProgressId === doc.id}
                                            onClick={() => handleOpenRejectModal('file', doc)}
                                          >
                                            <i className="fa fa-times"></i>
                                          </button>
                                        </>
                                      ) : doc.approval_status === 'approved' ? (
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-success shadow"
                                          style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px', backgroundColor: '#28a745', borderColor: '#28a745', color: '#fff' }}
                                          title="Approved - Click to change to Pending"
                                          disabled={actionInProgressId === doc.id}
                                          onClick={() => handleSetPendingFile(doc)}
                                        >
                                          <i className="fa fa-check"></i>
                                        </button>
                                      ) : (
                                        /* Rejected: Allow re-approving */
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-outline-success shadow"
                                          style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                          title="Re-approve Document"
                                          disabled={actionInProgressId === doc.id}
                                          onClick={() => handleApproveFile(doc)}
                                        >
                                          <i className="fa fa-check"></i>
                                        </button>
                                      )}

                                      {/* Audit History Button */}
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary shadow"
                                        style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                        title="View Approval History"
                                        onClick={() => handleViewHistory(doc)}
                                      >
                                        <i className="fa fa-history"></i>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {!loadingDocs && filteredDocs.length > 0 && (
                      <div className="mt-3">
                        <Pagination
                          currentPage={docCurrentPage}
                          setCurrentPage={setDocCurrentPage}
                          totalPages={docTotalPages}
                          indexOfFirst={docIndexOfFirst}
                          indexOfLast={docIndexOfLast}
                          totalRecords={filteredDocs.length}
                          loading={loadingDocs}
                        />
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </div>
            </div>
          </Tab.Pane>

          {/* TAB 2: EDIT APPROVAL REQUESTS */}
          <Tab.Pane eventKey="edit_requests">
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
                        Edit Approval Requests
                      </Card.Title>
                      <p className="mb-0 text-muted" style={{ fontSize: "13px" }}>
                        Authorize or reject requests submitted by employees to edit approved documents
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
                          placeholder="Search edit requests..."
                          value={requestSearch}
                          onChange={(e) => {
                            setRequestSearch(e.target.value);
                            setReqCurrentPage(1);
                          }}
                        />
                      </div>

                      <Form.Select
                        size="sm"
                        value={requestStatusFilter}
                        onChange={(e) => {
                          setRequestStatusFilter(e.target.value);
                          setReqCurrentPage(1);
                        }}
                        style={{
                          width: "auto",
                          minWidth: "160px",
                          height: "36px",
                          fontSize: "13px",
                          borderRadius: "8px",
                          borderColor: "#cbd5e1",
                        }}
                      >
                        <option value="">All Request Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="used">Used / Completed</option>
                      </Form.Select>

                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => fetchEditRequests()}
                        title="Refresh List"
                        style={{
                          height: "36px",
                          borderRadius: "8px",
                          padding: "0 14px",
                          fontSize: "13px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <i className="fa fa-refresh"></i> Refresh
                      </Button>
                    </div>
                  </Card.Header>

                  <Card.Body>
                    {/* Table */}
                    <div className="table-responsive">
                      <table className="table table-responsive-md w-100">
                        <thead>
                          <tr>
                            <th>
                              <strong>SL NO</strong>
                            </th>
                            <th>
                              <strong>EMPLOYEE NAME</strong>
                            </th>
                            <th>
                              <strong>EMPLOYEE ID</strong>
                            </th>
                            <th>
                              <strong>DOCUMENT NAME</strong>
                            </th>
                            <th>
                              <strong>FOLDER</strong>
                            </th>
                            <th>
                              <strong>EDIT REQUEST REASON</strong>
                            </th>
                            <th>
                              <strong>REQUESTED AT</strong>
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
                          {loadingRequests ? (
                            <tr>
                              <td colSpan="9" className="text-center py-5">
                                <div className="spinner-border text-primary" role="status">
                                  <span className="visually-hidden">Loading...</span>
                                </div>
                              </td>
                            </tr>
                          ) : currentRequests.length === 0 ? (
                            <tr>
                              <td colSpan="9" className="text-center py-4 text-muted">
                                No edit requests found matching criteria.
                              </td>
                            </tr>
                          ) : (
                            currentRequests.map((req, idx) => {
                              const reqDate = req.created_at ? new Date(req.created_at) : null;
                              const dateStr = reqDate
                                ? `${reqDate.toLocaleDateString()} ${reqDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                : '-';
                              const isPending = req.status === 'pending';

                              return (
                                <tr key={req.id}>
                                  <td>{reqIndexOfFirst + idx + 1}</td>
                                  <td>
                                    <span className="fw-bold text-dark">{req.employee_name || req.requested_by_name || '-'}</span>
                                  </td>
                                  <td>
                                    <span className="badge light badge-secondary">
                                      {req.employee_id || '-'}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="d-flex align-items-center">
                                      {getFileIcon(req.file_extension)}
                                      <span className="fw-semibold text-dark text-truncate d-inline-block" style={{ maxWidth: '200px' }}>
                                        {req.document_name}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <span className="badge light badge-primary">
                                      <i className="fa fa-folder me-1"></i> {req.folder_name}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="text-dark fst-italic">
                                      {req.request_reason || <span className="text-muted">No reason specified</span>}
                                    </span>
                                  </td>
                                  <td>{dateStr}</td>
                                  <td>
                                    {getStatusBadge(req.status)}
                                    {req.status === 'rejected' && req.rejection_reason && (
                                      <div className="text-danger small mt-1" style={{ fontSize: '11px' }}>
                                        <i className="fa fa-info-circle me-1"></i> {req.rejection_reason}
                                      </div>
                                    )}
                                  </td>
                                  <td className="text-end">
                                    <div className="d-flex justify-content-end align-items-center gap-1">
                                      {/* Preview Existing Document */}
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-info shadow"
                                        style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                        title="Preview Existing Document"
                                        onClick={() => handlePreviewDocument(req.document_id || req.document, req.document_name, req.file_extension)}
                                      >
                                        <i className="fa fa-eye"></i>
                                      </button>

                                      {/* Approve / Reject buttons */}
                                      {isPending && (
                                        <>
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-success shadow"
                                            style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                            title="Approve Edit Request"
                                            disabled={actionInProgressId === req.id}
                                            onClick={() => handleApproveEditRequest(req)}
                                          >
                                            <i className="fa fa-check"></i>
                                          </button>
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger shadow"
                                            style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                            title="Reject Edit Request"
                                            disabled={actionInProgressId === req.id}
                                            onClick={() => handleOpenRejectModal('edit_request', req)}
                                          >
                                            <i className="fa fa-times"></i>
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {!loadingRequests && filteredRequests.length > 0 && (
                      <div className="mt-3">
                        <Pagination
                          currentPage={reqCurrentPage}
                          setCurrentPage={setReqCurrentPage}
                          totalPages={reqTotalPages}
                          indexOfFirst={reqIndexOfFirst}
                          indexOfLast={reqIndexOfLast}
                          totalRecords={filteredRequests.length}
                          loading={loadingRequests}
                        />
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </div>
            </div>
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>

      {/* Preview Modal */}
      <Modal show={showPreviewModal} onHide={handleClosePreviewModal} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title className="h6 fw-bold">
            <i className="fa fa-eye text-primary me-2"></i> Document Preview:{' '}
            <span className="text-primary">{previewDoc?.name}</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0 text-center" style={{ minHeight: '550px', backgroundColor: '#0f172a' }}>
          {previewLoading ? (
            <div className="d-flex align-items-center justify-content-center" style={{ height: '550px' }}>
              <div className="text-white">
                <i className="fa fa-spinner fa-spin fa-2x mb-2 d-block text-primary"></i>
                <span className="fw-semibold">Loading document preview...</span>
              </div>
            </div>
          ) : previewUrl ? (
            ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes((previewDoc?.extension || '').toLowerCase()) ? (
              <div className="p-3 d-flex align-items-center justify-content-center" style={{ minHeight: '550px' }}>
                <img
                  src={previewUrl}
                  alt={previewDoc?.name}
                  style={{ maxWidth: '100%', maxHeight: '700px', objectFit: 'contain', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
                />
              </div>
            ) : (previewDoc?.extension || '').toLowerCase() === 'pdf' ? (
              <iframe
                src={`${previewUrl}#toolbar=0`}
                title={previewDoc?.name}
                style={{ width: '100%', height: '700px', border: 'none' }}
              />
            ) : parsedPreviewContent?.type === 'docx' ? (
              <div className="p-4 text-start bg-light overflow-auto" style={{ minHeight: '550px', maxHeight: '720px' }}>
                <div
                  className="bg-white rounded p-4 shadow-sm mx-auto"
                  style={{
                    maxWidth: '850px',
                    color: '#1e293b',
                    fontSize: '14px',
                    lineHeight: '1.7',
                    minHeight: '500px'
                  }}
                  dangerouslySetInnerHTML={{ __html: parsedPreviewContent.html }}
                />
              </div>
            ) : parsedPreviewContent?.type === 'xlsx' ? (
              <div className="p-3 text-start bg-light overflow-auto" style={{ minHeight: '550px', maxHeight: '720px' }}>
                <div className="bg-white rounded p-3 shadow-sm mx-auto" style={{ maxWidth: '1050px' }}>
                  <div className="mb-3 pb-2 border-bottom d-flex align-items-center justify-content-between">
                    <div>
                      <span className="badge bg-success-subtle text-success border border-success-subtle me-2">
                        <i className="fa fa-table me-1"></i> {parsedPreviewContent.sheetName}
                      </span>
                      {parsedPreviewContent.sheetNames?.length > 1 && (
                        <span className="text-muted small">
                          ({parsedPreviewContent.sheetNames.length} sheets total)
                        </span>
                      )}
                    </div>
                    <span className="text-muted small">
                      Showing first {parsedPreviewContent.rows?.length || 0} of {parsedPreviewContent.totalRows || 0} rows
                    </span>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered table-striped mb-0" style={{ fontSize: '12px' }}>
                      <tbody>
                        {parsedPreviewContent.rows && parsedPreviewContent.rows.length > 0 ? (
                          parsedPreviewContent.rows.map((row, rIdx) => (
                            <tr key={rIdx} className={rIdx === 0 ? "table-light fw-bold" : ""}>
                              <td className="text-muted text-center" style={{ width: '40px' }}>{rIdx + 1}</td>
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
                            <td className="text-center text-muted p-4">Empty spreadsheet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : parsedPreviewContent?.type === 'txt' ? (
              <div className="p-4 text-start bg-light overflow-auto" style={{ minHeight: '550px', maxHeight: '720px' }}>
                <pre
                  className="bg-white rounded p-4 shadow-sm mx-auto font-monospace"
                  style={{
                    maxWidth: '850px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    color: '#334155',
                    minHeight: '500px'
                  }}
                >
                  {parsedPreviewContent.text || 'Empty text document.'}
                </pre>
              </div>
            ) : parsedPreviewContent?.type === 'zip' ? (
              <div className="p-4 text-start bg-light overflow-auto" style={{ minHeight: '550px', maxHeight: '720px' }}>
                <div className="bg-white rounded p-4 shadow-sm mx-auto" style={{ maxWidth: '850px' }}>
                  <div className="mb-3 pb-2 border-bottom d-flex align-items-center justify-content-between">
                    <h6 className="fw-bold mb-0 text-dark">
                      <i className="fa fa-file-archive-o text-warning me-2"></i> Archive Contents ({parsedPreviewContent.entries?.length || 0} items)
                    </h6>
                  </div>
                  <div className="list-group list-group-flush" style={{ fontSize: '13px' }}>
                    {parsedPreviewContent.entries?.map((entry, eIdx) => (
                      <div key={eIdx} className="list-group-item d-flex align-items-center justify-content-between px-2 py-2">
                        <div className="text-truncate">
                          <i className={`fa ${entry.dir ? 'fa-folder text-warning' : 'fa-file-text-o text-secondary'} me-2`}></i>
                          <span className="fw-semibold">{entry.name}</span>
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
              </div>
            ) : (
              <div className="p-5 text-white">
                <i className="fa fa-file-text-o fa-3x mb-3 text-warning"></i>
                <h5>.{previewDoc?.extension?.toUpperCase()} Document File</h5>
                <p className="text-muted small mb-3">
                  Direct inline preview is not supported for this file format. You can download the file directly to view it.
                </p>
                {previewUrl && (
                  <a
                    href={previewUrl}
                    download={previewDoc?.name}
                    className="btn btn-primary btn-sm px-3"
                  >
                    <i className="fa fa-download me-1"></i> Download File to View
                  </a>
                )}
              </div>
            )
          ) : (
            <div className="p-5 text-muted">No preview available.</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClosePreviewModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Rejection Modal */}
      <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)} centered>
        <Form onSubmit={handleSubmitReject}>
          <Modal.Header closeButton>
            <Modal.Title className="h6 fw-bold text-danger">
              <i className="fa fa-times-circle me-2"></i> Reject{' '}
              {rejectingItem?.type === 'file' ? 'File Upload' : 'Edit Request'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="small text-muted mb-2">
              Please enter the reason for rejecting <strong>{rejectingItem?.name}</strong>.
              This reason will be recorded in the audit trail and visible to the employee.
            </p>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">Rejection Reason *</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                required
                placeholder="e.g., Incomplete document, missing signature, outdated certificate..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowRejectModal(false)} disabled={rejectingLoading}>
              Cancel
            </Button>
            <Button variant="danger" type="submit" disabled={rejectingLoading}>
              {rejectingLoading ? (
                <>
                  <i className="fa fa-spinner fa-spin me-1"></i> Rejecting...
                </>
              ) : (
                'Confirm Rejection'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Audit History Modal */}
      <Modal show={showHistoryModal} onHide={() => setShowHistoryModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title className="h6 fw-bold">
            <i className="fa fa-history text-primary me-2"></i> Approval Audit History:{' '}
            <span className="text-primary">{historyDoc?.original_filename}</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingHistory ? (
            <div className="text-center py-4 text-muted">
              <i className="fa fa-spinner fa-spin me-2"></i> Loading history...
            </div>
          ) : historyList.length === 0 ? (
            <div className="text-center py-4 text-muted">No approval history recorded yet.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle" style={{ fontSize: '12px' }}>
                <thead className="table-light">
                  <tr>
                    <th>Date & Time</th>
                    <th>Action</th>
                    <th>Performed By</th>
                    <th>Previous Status</th>
                    <th>New Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map((h) => {
                    const dt = h.created_at ? new Date(h.created_at) : null;
                    return (
                      <tr key={h.id}>
                        <td>{dt ? `${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}` : '-'}</td>
                        <td>
                          <span className="fw-semibold text-dark">{h.action_type_display || h.action_type}</span>
                        </td>
                        <td>{h.performed_by_name || 'System'}</td>
                        <td>{getStatusBadge(h.previous_status)}</td>
                        <td>{getStatusBadge(h.new_status)}</td>
                        <td>
                          <span className="small text-muted">{h.remarks || '-'}</span>
                        </td>
                      </tr>
                    );
                  })}
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
    </div>
  );
};

export default FileApproval;

