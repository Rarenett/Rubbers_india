import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Button, Row, Col, InputGroup } from 'react-bootstrap';
import FieldRow from './FieldRow';
import { createTable } from './api';
import CreateButton from '../../../components/permissions/CreateButton';
import './DynamicDB.css';

const DEFAULT_FIELD = {
  field_name:     '',
  data_type:      'VARCHAR',
  length:         255,
  precision:      null,
  scale:          null,
  is_nullable:    true,
  is_unique:      false,
  is_primary:     false,
  auto_increment: false,
  default_value:  null,
};

/** Build a simple SQL preview string (display only, not executed). */
const buildSQLPreview = (tableName, fields) => {
  if (!tableName) return '-- Enter a table name to preview SQL';
  const dbName = `dyn_${tableName}`;
  const lines = [];

  // Backend always auto-injects 'id' as primary key
  lines.push('  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY');

  fields.forEach((f) => {
    if (!f.field_name) return;
    let typeStr = f.data_type;
    
    // Auto default VARCHAR length to 255 if not specified
    if (f.data_type === 'VARCHAR') {
      typeStr += `(${f.length || 255})`;
    }
    // Auto default DECIMAL precision to (15,4) if not specified
    if (f.data_type === 'DECIMAL') {
      typeStr += `(${f.precision || 15},${f.scale || 4})`;
    }

    const nullable     = f.is_nullable ? 'NULL' : 'NOT NULL';
    const def          = f.default_value ? ` DEFAULT '${f.default_value}'` : '';
    lines.push(`  \`${f.field_name}\` ${typeStr} ${nullable}${def}`);
  });

  return (
    `CREATE TABLE \`${dbName}\` (\n` +
    lines.join(',\n') +
    `\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );
};

const CreateTable = () => {
  const navigate = useNavigate();

  const [tableName,   setTableName]   = useState('');
  const [description, setDescription] = useState('');
  const [fields,      setFields]      = useState([{ ...DEFAULT_FIELD }]);
  const [saving,      setSaving]      = useState(false);
  const [errors,      setErrors]      = useState({});
  const [showPreview, setShowPreview] = useState(false);

  // ── Field operations ────────────────────────────────────────────────────

  const addField = () =>
    setFields(prev => [...prev, { ...DEFAULT_FIELD }]);

  const removeField = (index) =>
    setFields(prev => prev.filter((_, i) => i !== index));

  const insertField = (index) => {
    setFields(prev => {
      const next = [...prev];
      next.splice(index + 1, 0, { ...DEFAULT_FIELD });
      return next;
    });
  };

  const updateField = (index, updated) =>
    setFields(prev => prev.map((f, i) => (i === index ? updated : f)));

  const moveUp = (index) => {
    if (index === 0) return;
    setFields(prev => {
      const arr = [...prev];
      [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
      return arr;
    });
  };

  const moveDown = (index) => {
    setFields(prev => {
      if (index === prev.length - 1) return prev;
      const arr = [...prev];
      [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
      return arr;
    });
  };

  // ── Validation ──────────────────────────────────────────────────────────

  const validate = () => {
    const errs = {};
    if (!tableName.trim()) {
      errs.table_name = 'Table name is required.';
    } else if (!/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(tableName.trim())) {
      errs.table_name = 'Must start with a letter, only letters/digits/underscores.';
    }

    const names = fields.map(f => f.field_name.trim().toLowerCase()).filter(Boolean);
    const hasDups = names.length !== new Set(names).size;
    const emptyNames = fields.some(f => !f.field_name.trim());
    const pkCount = fields.filter(f => f.is_primary).length;

    const fieldErrs = [];
    fields.forEach((f, i) => {
      const fe = {};
      if (!f.field_name.trim()) fe.field_name = 'Required';
      else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(f.field_name.trim())) fe.field_name = 'Invalid name';
      if (f.data_type === 'VARCHAR' && !f.length) fe.length = 'Length required';
      if (f.data_type === 'DECIMAL' && (!f.precision || f.scale == null)) fe.precision = 'Precision & scale required';
      if (Object.keys(fe).length) fieldErrs[i] = fe;
    });

    if (emptyNames) errs.fields = 'All field names are required.';
    if (hasDups)    errs.fields = 'Duplicate field names found.';
    if (pkCount > 1) errs.fields = 'Only one field can be marked as Primary Key.';
    if (fieldErrs.length) errs.fieldErrors = fieldErrs;

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        table_name:  tableName.trim(),
        description: description.trim() || null,
        fields:      fields.map((f, i) => ({ ...f, field_order: i })),
      };
      await createTable(payload);
      navigate('/dynamic-db/tables', { state: { success: `Table '${tableName}' created successfully!` } });
    } catch (err) {
      const serverErr = err.response?.data;
      let msg = 'Failed to create table.';
      if (serverErr) {
        if (serverErr.error)  msg = serverErr.error;
        else if (serverErr.detail) msg = serverErr.detail;
        else if (serverErr.errors) msg = JSON.stringify(serverErr.errors, null, 2);
      }
      setErrors(prev => ({ ...prev, server: msg }));
    } finally {
      setSaving(false);
    }
  };

  const sqlPreview = buildSQLPreview(tableName, fields);

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

      <Form id="create-table-form" onSubmit={handleSubmit}>
        <Card className="mb-4">
          <Card.Header className="d-flex justify-content-between align-items-center bg-white py-3">
            <div>
              <h4 className="mb-1 text-primary fw-bold">Create New Table</h4>
              <p className="text-muted mb-0 small">Define fields and click Create to generate the MySQL table.</p>
            </div>
            <div className="d-flex gap-2">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setShowPreview(p => !p)}
              >
                {showPreview ? '🙈 Hide SQL' : '👁️ Preview SQL'}
              </Button>
            </div>
          </Card.Header>

          <Card.Body className="p-4">
            {/* ── Server error ── */}
            {errors.server && (
              <div className="alert alert-danger d-flex align-items-center mb-3">
                <span className="me-2">⚠️</span>
                <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{errors.server}</span>
              </div>
            )}

            {/* ── SQL Preview panel ── */}
            {showPreview && (
              <Card className="mb-4 border-info">
                <Card.Header className="py-2 bg-info bg-opacity-10 text-info fw-bold small">
                  📋 SQL Preview (read-only)
                </Card.Header>
                <Card.Body className="p-0">
                  <pre className="m-0 p-3 bg-dark text-white rounded-bottom" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {sqlPreview}
                  </pre>
                </Card.Body>
              </Card>
            )}

            {/* ── Table info ── */}
            <h5 className="text-secondary fw-bold mb-3">Table Information</h5>
            <Row className="mb-4">
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-semibold">Table Name <span className="text-danger">*</span></Form.Label>
                  <InputGroup hasValidation>
                    <InputGroup.Text className="bg-light text-muted">dyn_</InputGroup.Text>
                    <Form.Control
                      type="text"
                      isInvalid={!!errors.table_name}
                      placeholder="e.g. customer_feedback"
                      value={tableName}
                      onChange={(e) => setTableName(e.target.value.toLowerCase().replace(/\s/g, '_'))}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errors.table_name}
                    </Form.Control.Feedback>
                  </InputGroup>
                  <Form.Text className="text-muted">
                    Lowercase letters, digits, underscores. Will be stored as <code>dyn_{tableName || '…'}</code>
                  </Form.Text>
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-semibold">Description <span className="text-muted">(optional)</span></Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Brief description of this table"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Form.Group>
              </Col>
            </Row>

            <hr className="my-4 text-muted" />

            {/* ── Fields Section ── */}
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <div className="d-flex align-items-center gap-3">
                <h5 className="text-secondary fw-bold m-0">Fields</h5>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={addField}
                  style={{ fontSize: '12px', padding: '4px 8px' }}
                >
                  ＋ Add Field
                </Button>
              </div>
              <Form.Text className="text-muted">
                An <code>id</code> primary key is automatically added to this table for tracking records.
              </Form.Text>
            </div>

            {errors.fields && (
              <div className="alert alert-warning mb-3">⚠️ {errors.fields}</div>
            )}

            {/* ── Column headers (visible on larger screens) ── */}
            <Row className="d-none d-md-flex align-items-center fw-bold py-2 mb-2 border-bottom text-muted small text-uppercase">
              <Col md={1} className="text-center">#</Col>
              <Col md={3}>Field Name</Col>
              <Col md={2}>Type</Col>
              <Col md={3}>Default Value / Relation</Col>
              <Col md={2} className="text-center">Required</Col>
              <Col md={1} className="text-center d-flex align-items-center justify-content-center gap-2">
                <span>Actions</span>
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 text-primary border-0"
                  onClick={addField}
                  title="Add Field"
                  style={{ fontSize: '1rem', lineHeight: 1 }}
                >
                  ➕
                </Button>
              </Col>
            </Row>

            {/* ── Field rows ── */}
            {fields.map((field, idx) => (
              <FieldRow
                key={idx}
                field={field}
                index={idx}
                onChange={updateField}
                onRemove={removeField}
                onMoveUp={moveUp}
                onMoveDown={moveDown}
                isFirst={idx === 0}
                isLast={idx === fields.length - 1}
                onAdd={insertField}
              />
            ))}
          </Card.Body>

          <Card.Footer className="bg-white py-3 d-flex gap-2 justify-content-end">
            <Button
              onClick={() => navigate('/dynamic-db/tables')}
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
              type="submit"
              disabled={saving}
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
              {saving ? (
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
              ) : (
                <i className="fa fa-save me-2"></i>
              )}
              Save
            </Button>
          </Card.Footer>
        </Card>
      </Form>
    </div>
  );
};

export default CreateTable;
