/**
 * DynamicDataGrid.jsx
 * Generic paginated data grid for any user-created table.
 * - Fetches column metadata from DynamicTable API
 * - Loads rows via generic CRUD API
 * - Supports add, edit (modal), and delete
 * - Renders column-appropriate values
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Button, Modal, Alert, Pagination } from 'react-bootstrap';
import { fetchTableDetail, fetchRows, insertRow, updateRow, deleteRow } from './api';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import DynamicForm from './DynamicForm';
import './DynamicDB.css';

const PAGE_SIZE = 25;

const DynamicDataGrid = () => {
  const { tableName } = useParams();
  const navigate       = useNavigate();

  const [columns,      setColumns]      = useState([]);
  const [rows,         setRows]         = useState([]);
  const [total,        setTotal]        = useState(0);
  const [offset,       setOffset]       = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [toast,        setToast]        = useState(null);

  // Modal state
  const [modalMode,    setModalMode]    = useState(null);  // 'add' | 'edit' | null
  const [formValues,   setFormValues]   = useState({});
  const [editingId,    setEditingId]    = useState(null);
  const [formSaving,   setFormSaving]   = useState(false);
  const [formError,    setFormError]    = useState(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load column metadata once
  useEffect(() => {
    fetchTableDetail(tableName)
      .then((res) => setColumns(res.data.fields || []))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load table structure.'));
  }, [tableName]);

  // Load data rows
  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRows(tableName, { limit: PAGE_SIZE, offset });
      setRows(res.data.results || []);
      setTotal(res.data.count || 0);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [tableName, offset]);

  useEffect(() => { loadRows(); }, [loadRows]);

  // ── Pagination ───────────────────────────────────────────────────────────
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  // ── Form submit ─────────────────────────────────────────────────────────

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSaving(true);
    setFormError(null);
    try {
      // Only send values for fields that are actually editable in the form (exclude id/PKs)
      const editableNames = columns
        .filter(c => !c.auto_increment && !c.is_primary)
        .map(c => c.field_name);

      const cleaned = {};
      Object.entries(formValues).forEach(([k, v]) => {
        if (editableNames.includes(k)) {
          cleaned[k] = v === '' ? null : v;
        }
      });

      if (modalMode === 'add') {
        await insertRow(tableName, cleaned);
        showToast('Row inserted successfully.');
      } else {
        await updateRow(tableName, editingId, cleaned);
        showToast('Row updated successfully.');
      }
      setModalMode(null);
      setFormValues({});
      loadRows();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save record.');
    } finally {
      setFormSaving(false);
    }
  };

  const openAdd = () => {
    const defaults = {};
    columns.forEach(c => { defaults[c.field_name] = c.default_value || ''; });
    setFormValues(defaults);
    setEditingId(null);
    setFormError(null);
    setModalMode('add');
  };

  const openEdit = (row) => {
    setFormValues({ ...row });
    setEditingId(row.id);
    setFormError(null);
    setModalMode('edit');
  };

  // ── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    setDeleteSaving(true);
    try {
      await deleteRow(tableName, deleteTarget);
      showToast('Row deleted.', 'warning');
      setDeleteTarget(null);
      loadRows();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete.');
    } finally {
      setDeleteSaving(false);
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────

  const formatCell = (col, value) => {
    if (value === null || value === undefined) return <span className="text-muted italic">NULL</span>;
    if (col.data_type === 'BOOLEAN') return value ? '✅ Yes' : '❌ No';
    if (typeof value === 'string' && value.length > 60) return value.slice(0, 60) + '…';
    return String(value);
  };

  // All columns including the auto id column
  const allColumns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="container-fluid px-0">
      {/* ── Back Navigation ── */}
      <div className="page-titles mb-3">
        <button
          onClick={() => navigate('/dynamic-db/tables')}
          className="btn btn-outline-primary btn-sm d-flex align-items-center"
          style={{ gap: '6px', borderRadius: '6px' }}
        >
          <i className="fa fa-arrow-left"></i> Back
        </button>
      </div>

      {/* ── Toast notification ── */}
      {toast && (
        <div 
          className="position-fixed top-0 end-0 p-3" 
          style={{ zIndex: 1055, marginTop: '50px' }}
        >
          <Alert variant={toast.type === 'warning' ? 'warning' : 'success'} dismissible onClose={() => setToast(null)}>
            {toast.msg}
          </Alert>
        </div>
      )}

      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center bg-white py-3">
          <div>
            <h4 className="mb-1 text-primary fw-bold">Data: {tableName}</h4>
            <p className="text-muted mb-0 small">{total} record{total !== 1 ? 's' : ''} total</p>
          </div>
          <div className="d-flex gap-2">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => navigate(`/dynamic-db/tables/${tableName}/edit`)}
            >
              ✏️ Edit Structure
            </Button>
            <CreateButton
              module="database_designer"
              onClick={openAdd}
              style={{
                backgroundColor: 'rgb(61, 53, 119)',
                borderColor: 'rgb(61, 53, 119)',
                color: 'white',
                height: '34px',
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: '13px',
                borderRadius: '6px'
              }}
            >
              Add Row
            </CreateButton>
          </div>
        </Card.Header>

        <Card.Body className="p-4">
          {error && <Alert variant="danger">⚠️ {error}</Alert>}

          {loading ? (
            <div className="text-center py-5 text-muted">
              <div className="spinner-border text-primary mb-2" role="status" />
              <div>Loading data…</div>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-5 text-muted border rounded bg-white">
              <div className="fs-1 mb-2">📭</div>
              <h5>No records yet.</h5>
              <CreateButton 
                className="mt-2" 
                module="database_designer"
                onClick={openAdd}
                style={{
                  backgroundColor: 'rgb(61, 53, 119)',
                  borderColor: 'rgb(61, 53, 119)',
                  color: 'white',
                  height: '34px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  fontSize: '13px',
                  borderRadius: '6px'
                }}
              >
                Add the first row
              </CreateButton>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <Table bordered hover align="middle" className="mb-0">
                  <thead className="table-light">
                    <tr style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#6c757d' }}>
                      {allColumns.map(col => <th key={col}>{col}</th>)}
                      <th className="text-center" style={{ width: '120px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const colMeta = (col) => columns.find(c => c.field_name === col);
                      return (
                        <tr key={row.id}>
                          {allColumns.map(col => (
                            <td key={col}>{formatCell(colMeta(col) || { data_type: 'VARCHAR' }, row[col])}</td>
                          ))}
                          <td className="text-center">
                            <div className="d-flex justify-content-center gap-1">
                              <EditButton
                                module="database_designer"
                                onClick={() => openEdit(row)}
                                className="sharp btn-xs"
                              />
                              <DeleteButton
                                module="database_designer"
                                onClick={() => setDeleteTarget(row.id)}
                                className="sharp btn-xs"
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
                  <span className="text-muted small">
                    Showing {offset + 1} to {Math.min(offset + PAGE_SIZE, total)} of {total} records
                  </span>
                  <Pagination className="mb-0">
                    <Pagination.Prev
                      disabled={offset === 0}
                      onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    />
                    <Pagination.Item active>{currentPage}</Pagination.Item>
                    <Pagination.Next
                      disabled={offset + PAGE_SIZE >= total}
                      onClick={() => setOffset(offset + PAGE_SIZE)}
                    />
                  </Pagination>
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      {/* ── Add / Edit Modal ── */}
      <Modal show={!!modalMode} onHide={() => !formSaving && setModalMode(null)} size="lg" centered>
        <Modal.Header closeButton={!formSaving}>
          <Modal.Title>
            {modalMode === 'add' ? `➕ Insert Row into ${tableName}` : `✏️ Edit Row #${editingId}`}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formError && <Alert variant="danger">⚠️ {formError}</Alert>}
          <DynamicForm
            fields={columns.filter(c => !c.auto_increment && !c.is_primary)}
            values={formValues}
            onChange={setFormValues}
            onSubmit={handleFormSubmit}
            onCancel={() => setModalMode(null)}
            saving={formSaving}
            mode={modalMode}
          />
        </Modal.Body>
      </Modal>

      {/* ── Delete Confirmation Modal ── */}
      <Modal show={!!deleteTarget} onHide={() => !deleteSaving && setDeleteTarget(null)} centered>
        <Modal.Header closeButton={!deleteSaving}>
          <Modal.Title className="text-danger">⚠️ Delete Row?</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center py-4">
          <p className="mb-0">Are you sure you want to permanently delete record #{deleteTarget}?</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="danger" className="light" onClick={() => setDeleteTarget(null)} disabled={deleteSaving}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleteSaving}>
            {deleteSaving ? 'Deleting…' : '🗑️ Delete'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default DynamicDataGrid;
