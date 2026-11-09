import React, { useState, useEffect } from 'react';
import { Form, Button, Row, Col } from 'react-bootstrap';
import { fetchRows } from './api';
import './DynamicDB.css';

const ForeignKeySelect = ({ id, targetTable, displayCol, value, onChange, required }) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchRows(targetTable, { limit: 100 })
      .then(res => {
        const rowsList = res.data.results || [];
        setOptions(rowsList.map(row => ({
          value: row.id,
          label: row[displayCol] || row.name || row.title || `Record #${row.id}`
        })));
      })
      .catch(err => {
        console.error("Failed to load foreign key relation options:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [targetTable, displayCol]);

  return (
    <Form.Select
      id={id}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={loading}
    >
      {loading ? (
        <option>Loading options…</option>
      ) : (
        <>
          <option value="">— Select —</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </>
      )}
    </Form.Select>
  );
};

const DynamicForm = ({ fields, values, onChange, onSubmit, onCancel, saving, mode }) => {

  const handleChange = (fieldName, value) => {
    onChange({ ...values, [fieldName]: value });
  };

  const renderInput = (field) => {
    const val = values[field.field_name] ?? '';
    const dt  = field.data_type;
    const id  = `ddb-form-${field.field_name}`;

    const defStr = String(field.default_value || '');
    if (defStr.startsWith('fk:')) {
      const parts = defStr.split(':');
      const targetTable = parts[1];
      const displayCol = parts[2] || 'name';
      return (
        <ForeignKeySelect
          id={id}
          targetTable={targetTable}
          displayCol={displayCol}
          value={val}
          onChange={(newVal) => handleChange(field.field_name, newVal)}
          required={!field.is_nullable}
        />
      );
    }

    if (dt === 'BOOLEAN') {
      return (
        <Form.Select
          id={id}
          value={val}
          onChange={(e) => handleChange(field.field_name, e.target.value)}
        >
          <option value="">— Select —</option>
          <option value="1">Yes / True</option>
          <option value="0">No / False</option>
        </Form.Select>
      );
    }

    if (dt === 'DATE') {
      return (
        <Form.Control
          id={id} type="date"
          value={val}
          onChange={(e) => handleChange(field.field_name, e.target.value)}
        />
      );
    }

    if (dt === 'DATETIME') {
      return (
        <Form.Control
          id={id} type="datetime-local"
          value={val}
          onChange={(e) => handleChange(field.field_name, e.target.value)}
        />
      );
    }

    if (dt === 'TIME') {
      return (
        <Form.Control
          id={id} type="time"
          value={val}
          onChange={(e) => handleChange(field.field_name, e.target.value)}
        />
      );
    }

    if (['INT', 'BIGINT', 'FLOAT', 'DECIMAL'].includes(dt)) {
      return (
        <Form.Control
          id={id} type="number"
          value={val}
          step={dt === 'DECIMAL' || dt === 'FLOAT' ? 'any' : 1}
          onChange={(e) => handleChange(field.field_name, e.target.value)}
          required={!field.is_nullable}
        />
      );
    }

    if (['TEXT', 'LONGTEXT'].includes(dt)) {
      return (
        <Form.Control
          id={id} as="textarea"
          rows={3}
          value={val}
          onChange={(e) => handleChange(field.field_name, e.target.value)}
          required={!field.is_nullable}
        />
      );
    }

    // Default: VARCHAR / other string types
    return (
      <Form.Control
        id={id} type="text"
        value={val}
        maxLength={field.length || 255}
        onChange={(e) => handleChange(field.field_name, e.target.value)}
        required={!field.is_nullable}
      />
    );
  };

  return (
    <Form onSubmit={onSubmit}>
      <Row className="g-3">
        {fields.map((field) => (
          <Col md={6} key={field.id || field.field_name}>
            <Form.Group id={`group-${field.field_name}`}>
              <Form.Label htmlFor={`ddb-form-${field.field_name}`} className="fw-semibold small text-secondary">
                {field.field_name}
                {!field.is_nullable && <span className="text-danger"> *</span>}
                <span className="badge bg-light text-secondary ms-2" style={{ fontSize: '0.7rem' }}>{field.data_type}</span>
              </Form.Label>
              {renderInput(field)}
            </Form.Group>
          </Col>
        ))}
      </Row>

      <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
        <Button
          onClick={onCancel}
          disabled={saving}
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
      </div>
    </Form>
  );
};

export default DynamicForm;
