import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Form, Button, Row, Col, Table, Alert, Modal } from 'react-bootstrap';
import { fetchTableDetail, addColumn, modifyColumn, dropColumn } from './api';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import { usePermission } from '../../../hooks/usePermission';
import FieldRow from './FieldRow';
import './DynamicDB.css';

const DEFAULT_NEW_FIELD = {
  field_name: '', data_type: 'VARCHAR', length: 255,
  precision: null, scale: null, is_nullable: true,
  is_unique: false, is_primary: false, auto_increment: false, default_value: null,
};

const EditTable = () => {
  const { tableName } = useParams();
  const navigate       = useNavigate();
  const { can }        = usePermission();

  const [tableData,    setTableData]    = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [toast,        setToast]        = useState(null);

  // Add column state
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [newField,     setNewField]     = useState({ ...DEFAULT_NEW_FIELD });
  const [addingSaving, setAddingSaving] = useState(false);
  const [addErr,       setAddErr]       = useState(null);

  // Inline edit state
  const [editingCol,   setEditingCol]   = useState(null);   // field_name being edited
  const [editData,     setEditData]     = useState({});
  const [editSaving,   setEditSaving]   = useState(false);
  const [editMode,     setEditMode]     = useState('modify'); // 'modify' | 'rename'

  // Drop column state
  const [dropTarget,   setDropTarget]   = useState(null);
  const [dropSaving,   setDropSaving]   = useState(false);
  const [showRawModal, setShowRawModal] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadTable = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTableDetail(tableName);
      setTableData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load table.');
    } finally {
      setLoading(false);
    }
  }, [tableName]);

  useEffect(() => { loadTable(); }, [loadTable]);

  // ── Add column ───────────────────────────────────────────────────────────

  const handleAddColumn = async () => {
    if (!newField.field_name.trim()) {
      setAddErr('Field name is required.');
      return;
    }
    setAddingSaving(true);
    setAddErr(null);
    try {
      await addColumn(tableName, { ...newField, field_order: (tableData?.fields?.length || 0) });
      showToast(`Column '${newField.field_name}' added successfully.`);
      setNewField({ ...DEFAULT_NEW_FIELD });
      setShowAddPanel(false);
      loadTable();
    } catch (err) {
      setAddErr(err.response?.data?.error || JSON.stringify(err.response?.data?.errors) || 'Failed to add column.');
    } finally {
      setAddingSaving(false);
    }
  };

  // ── Inline edit ─────────────────────────────────────────────────────────

  const startEdit = (field, mode = 'modify') => {
    setEditingCol(field.field_name);
    setEditMode(mode);
    setEditData({ ...field });
  };

  const handleModify = async () => {
    setEditSaving(true);
    try {
      if (editMode === 'rename') {
        await modifyColumn(tableName, editingCol, {
          action:   'rename',
          old_name: editingCol,
          field:    editData,
        });
        showToast(`Column renamed to '${editData.field_name}'.`);
      } else {
        await modifyColumn(tableName, editingCol, { action: 'modify', ...editData });
        showToast(`Column '${editingCol}' modified.`);
      }
      setEditingCol(null);
      loadTable();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to modify column.');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Drop column ─────────────────────────────────────────────────────────

  const handleDrop = async () => {
    if (!dropTarget) return;
    setDropSaving(true);
    try {
      await dropColumn(tableName, dropTarget);
      showToast(`Column '${dropTarget}' deleted.`, 'warning');
      setDropTarget(null);
      loadTable();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete column.');
    } finally {
      setDropSaving(false);
    }
  };

  if (loading) return (
    <div className="container-fluid py-5 text-center">
      <div className="spinner-border text-primary mb-2" role="status" />
      <div>Loading table structure…</div>
    </div>
  );

  if (error) return (
    <div className="container-fluid py-4">
      <Alert variant="danger">
        ⚠️ {error}
        <Button size="sm" variant="outline-danger" className="ms-3" onClick={loadTable}>Retry</Button>
      </Alert>
    </div>
  );

  const fields = tableData?.fields || [];

  // Parse system columns if it's a developer-created table
  let systemColumns = [];
  try {
    const parsed = JSON.parse(tableData?.description);
    if (parsed && parsed.is_system) {
      systemColumns = parsed.system_columns || [];
    }
  } catch (e) {
    // Normal user-created table description
  }

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
            <h4 className="mb-1 text-primary fw-bold">Edit Table: {tableName}</h4>
            <p className="text-muted mb-0 small">
              MySQL Table Name: <code>{tableData?.db_table}</code> &bull; {fields.length} columns defined
            </p>
          </div>
          <div className="d-flex gap-2">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => navigate(`/dynamic-db/${tableName}/data`)}
            >
              📊 Browse Data
            </Button>
            <Button
              variant="outline-info"
              size="sm"
              onClick={() => setShowRawModal(true)}
              style={{
                height: '34px',
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: '13px',
                borderRadius: '6px'
              }}
            >
              🔍 Raw Structure
            </Button>
            <CreateButton
              module="database_designer"
              onClick={() => { setShowAddPanel(p => !p); setAddErr(null); }}
              style={{
                backgroundColor: '#0a500f',
                borderColor: '#0a500f',
                color: 'white',
                height: '34px',
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: '13px',
                borderRadius: '6px'
              }}
            >
              Add Column
            </CreateButton>
          </div>
        </Card.Header>

        <Card.Body className="p-4">
          {/* ── Raw MySQL DESCRIBE Info details ── */}
          {tableData?.mysql_structure?.length > 0 && (
            <div className="mb-4">
              <details className="border rounded p-2 bg-light">
                <summary className="fw-semibold text-secondary cursor-pointer" style={{ cursor: 'pointer' }}>
                  🔍 View Raw MySQL Structure (DESCRIBE)
                </summary>
                <div className="table-responsive mt-2">
                  <Table striped bordered hover size="sm" className="mb-0 bg-white" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr className="bg-light">
                        {Object.keys(tableData.mysql_structure[0]).map(k => <th key={k}>{k}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.mysql_structure.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((v, j) => <td key={j}>{v ?? '—'}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </details>
            </div>
          )}

          {/* ── Add Column panel ── */}
          {showAddPanel && (
            <Card className="mb-4 border-primary">
              <Card.Header className="py-2 bg-primary bg-opacity-10 text-primary fw-bold">
                ➕ Add New Column
              </Card.Header>
              <Card.Body>
                {addErr && <Alert variant="danger">⚠️ {addErr}</Alert>}
                <Row className="d-none d-md-flex align-items-center fw-bold py-2 mb-2 border-bottom text-muted small text-uppercase">
                  <Col md={1} className="text-center">#</Col>
                  <Col md={3}>Field Name</Col>
                  <Col md={2}>Type</Col>
                  <Col md={3}>Default Value / Relation</Col>
                  <Col md={2} className="text-center">Required</Col>
                  <Col md={1} className="text-center">Action</Col>
                </Row>
                <FieldRow
                  field={newField}
                  index={fields.length}
                  onChange={(_, updated) => setNewField(updated)}
                  onRemove={() => { setNewField({ ...DEFAULT_NEW_FIELD }); setShowAddPanel(false); }}
                  isFirst={true}
                  isLast={true}
                  onMoveUp={() => {}}
                  onMoveDown={() => {}}
                />
                <div className="d-flex justify-content-end gap-2 mt-3">
                  <Button
                    onClick={() => { setShowAddPanel(false); setAddErr(null); }}
                    style={{
                      backgroundColor: '#7e76cb',
                      borderColor: '#7e76cb',
                      color: 'white',
                      height: '38px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      padding: '0 24px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={handleAddColumn}
                    disabled={addingSaving}
                    style={{
                      backgroundColor: '#6ec89b',
                      borderColor: '#6ec89b',
                      color: 'white',
                      height: '38px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      padding: '0 24px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {addingSaving ? (
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    ) : (
                      <i className="fa fa-save me-2"></i>
                    )}
                    Save
                  </Button>
                </div>
              </Card.Body>
            </Card>
          )}

          {/* ── Current fields table ── */}
          <h5 className="text-secondary fw-bold mb-3">Current Fields</h5>
          {fields.length === 0 ? (
            <div className="text-center py-4 text-muted border rounded">
              <p className="mb-0">No fields found in metadata. The table may only have an auto-generated <code>id</code> column.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table bordered hover align="middle" className="mb-0">
                <thead className="table-light">
                  <tr style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#6c757d' }}>
                    <th className="text-center" style={{ width: '50px' }}>#</th>
                    <th>Field Name</th>
                    <th>Type</th>
                    <th>Length / precision</th>
                    <th className="text-center">Nullable</th>
                    <th className="text-center">Unique</th>
                    <th className="text-center">AI</th>
                    <th className="text-center">PK</th>
                    <th>Default</th>
                    <th className="text-center" style={{ width: '250px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, idx) => {
                    const isSystemCol = systemColumns.includes(field.field_name) || field.field_name === 'id';
                    const isEditingThis = editingCol === field.field_name;

                    return (
                      <React.Fragment key={field.id}>
                        <tr className={isEditingThis ? 'table-warning bg-opacity-10' : ''}>
                          <td className="text-center text-muted">{idx + 1}</td>
                          <td className="fw-semibold">
                            <code>{field.field_name}</code>
                            {isSystemCol && <span className="ms-2 text-warning" title="System Protected Column">🔒</span>}
                          </td>
                          <td>
                            <span className="badge bg-primary bg-opacity-10 text-primary">
                              {field.data_type}
                            </span>
                          </td>
                          <td>
                            {field.data_type === 'VARCHAR' && field.length ? field.length :
                             field.data_type === 'DECIMAL' && field.precision ? `${field.precision},${field.scale}` :
                             <span className="text-muted">—</span>}
                          </td>
                          <td className="text-center">
                            {field.is_nullable ? (
                              <span className="text-success fw-bold">✓</span>
                            ) : (
                              <span className="text-danger fw-bold">✗</span>
                            )}
                          </td>
                          <td className="text-center">
                            {field.is_unique ? (
                              <span className="text-success fw-bold">✓</span>
                            ) : (
                              <span className="text-danger fw-bold">✗</span>
                            )}
                          </td>
                          <td className="text-center">{field.auto_increment ? <span className="text-success fw-bold">✓</span> : <span className="text-muted">—</span>}</td>
                          <td className="text-center">
                            {field.is_primary ? (
                              <span className="badge bg-warning text-dark font-weight-bold">PK</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            <code>{field.default_value ?? <span className="text-muted">—</span>}</code>
                          </td>
                          <td className="text-center">
                            {isSystemCol ? (
                              <span className="badge bg-light text-secondary text-uppercase py-2" style={{ letterSpacing: '0.5px' }}>
                                System Protected
                              </span>
                            ) : (
                              <div className="d-flex justify-content-center gap-1">
                                <EditButton
                                  module="database_designer"
                                  onClick={() => startEdit(field, 'modify')}
                                  title="Modify type/nullable/default"
                                  className="sharp btn-xs"
                                />
                                {can('database_designer', 'edit') && (
                                  <Button
                                    variant="outline-info"
                                    size="sm"
                                    className="sharp btn-xs"
                                    onClick={() => startEdit(field, 'rename')}
                                    title="Rename column"
                                  >
                                    <i className="fa fa-font" />
                                  </Button>
                                )}
                                <DeleteButton
                                  module="database_designer"
                                  onClick={() => setDropTarget(field.field_name)}
                                  title="Drop column"
                                  className="sharp btn-xs"
                                />
                              </div>
                            )}
                          </td>
                        </tr>

                        {/* Inline edit panel */}
                        {isEditingThis && (
                          <tr>
                            <td colSpan={10} className="p-0 border-0">
                              <div className="p-3 bg-light border-top border-bottom border-warning">
                                <h6 className="text-warning fw-bold mb-3">
                                  {editMode === 'rename' ? `🔤 Rename Column: ${editingCol}` : `✏️ Modify Column: ${editingCol}`}
                                </h6>
                                <Row className="d-none d-md-flex align-items-center fw-bold py-2 mb-2 border-bottom text-muted small text-uppercase">
                                  <Col md={1} className="text-center">#</Col>
                                  <Col md={3}>Field Name</Col>
                                  <Col md={2}>Type</Col>
                                  <Col md={3}>Default Value / Relation</Col>
                                  <Col md={2} className="text-center">Required</Col>
                                  <Col md={1} className="text-center">Action</Col>
                                </Row>
                                <FieldRow
                                  field={editData}
                                  index={idx}
                                  onChange={(_, updated) => setEditData(updated)}
                                  onRemove={() => setEditingCol(null)}
                                  isFirst={true}
                                  isLast={true}
                                  onMoveUp={() => {}}
                                  onMoveDown={() => {}}
                                  readOnly={editMode === 'modify'}
                                />
                                <div className="d-flex justify-content-end gap-2 mt-3">
                                  <Button
                                    onClick={() => setEditingCol(null)}
                                    style={{
                                      backgroundColor: '#7e76cb',
                                      borderColor: '#7e76cb',
                                      color: 'white',
                                      height: '38px',
                                      borderRadius: '8px',
                                      fontSize: '14px',
                                      fontWeight: 'bold',
                                      padding: '0 24px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                  >
                                    Close
                                  </Button>
                                  <Button
                                    disabled={editSaving}
                                    onClick={handleModify}
                                    style={{
                                      backgroundColor: '#6ec89b',
                                      borderColor: '#6ec89b',
                                      color: 'white',
                                      height: '38px',
                                      borderRadius: '8px',
                                      fontSize: '14px',
                                      fontWeight: 'bold',
                                      padding: '0 24px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                  >
                                    {editSaving ? (
                                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                                    ) : (
                                      <i className="fa fa-save me-2"></i>
                                    )}
                                    Save
                                  </Button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* ── Drop Column Confirmation Modal ── */}
      <Modal show={!!dropTarget} onHide={() => !dropSaving && setDropTarget(null)} centered>
        <Modal.Header closeButton={!dropSaving}>
          <Modal.Title className="text-danger">⚠️ Drop Column?</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center py-4">
          <p className="mb-0">
            This will permanently drop the column <strong><code>{dropTarget}</code></strong> and all its data from the MySQL table.
          </p>
          <p className="text-danger fw-bold mt-2 mb-0">This action cannot be undone.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setDropTarget(null)} disabled={dropSaving}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDrop} disabled={dropSaving}>
            {dropSaving ? 'Dropping…' : '🗑️ Drop Column'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Raw MySQL Structure Modal ── */}
      <Modal show={showRawModal} onHide={() => setShowRawModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>🔍 Raw MySQL Structure: {tableName}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {tableData?.mysql_structure?.length > 0 ? (
            <div className="table-responsive">
              <Table striped bordered hover size="sm" className="mb-0 bg-white" style={{ fontSize: '0.85rem' }}>
                <thead className="table-light">
                  <tr>
                    {Object.keys(tableData.mysql_structure[0]).map(k => <th key={k}>{k}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {tableData.mysql_structure.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((v, j) => <td key={j}>{v ?? '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-4 text-muted">No raw structure data available.</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRawModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default EditTable;
