/**
 * FieldRow.jsx
 * Reusable single field/column definition row used in both CreateTable and EditTable.
 * Simplified for non-technical users:
 *   - Simplified data types list
 *   - Automatically handles default length / precision / scale under-the-hood
 *   - Hides advanced settings like Primary Key, Auto Increment, and Unique
 */
import React, { useState, useEffect } from 'react';
import { Form, Button, Row, Col } from 'react-bootstrap';

// Simplified user-friendly data types
const SIMPLIFIED_TYPES = [
  { value: 'VARCHAR',     label: 'Text (Short)' },
  { value: 'TEXT',        label: 'Text (Long/Paragraph)' },
  { value: 'INT',         label: 'Number (Whole)' },
  { value: 'DECIMAL',     label: 'Number (Decimal)' },
  { value: 'BOOLEAN',     label: 'Yes / No' },
  { value: 'DATE',        label: 'Date' },
  { value: 'DATETIME',    label: 'Date & Time' },
  { value: 'TIME',        label: 'Time' },
  { value: 'FOREIGN_KEY', label: 'Link to another table 🔗' },
];

const NO_DEFAULT_TYPES = ['TEXT', 'LONGTEXT'];

const FieldRow = ({ field, index, onChange, onRemove, isFirst, isLast, onMoveUp, onMoveDown, readOnly, onAdd }) => {

  const handleChange = (key, value) => {
    const updated = { ...field, [key]: value };

    // Automatically set default lengths/precisions under-the-hood
    if (key === 'data_type') {
      if (value === 'VARCHAR') {
        updated.length = 255;
        updated.precision = null;
        updated.scale = null;
      } else if (value === 'DECIMAL') {
        updated.length = null;
        updated.precision = 15;
        updated.scale = 4;
      } else if (value === 'FOREIGN_KEY') {
        updated.data_type = 'BIGINT'; // Foreign key column is stored as BIGINT in database
        updated.length = null;
        updated.precision = null;
        updated.scale = null;
        if (!String(updated.default_value || '').startsWith('fk:')) {
          updated.default_value = 'fk::name'; // Placeholder pattern
        }
      } else {
        updated.length = null;
        updated.precision = null;
        updated.scale = null;
      }
      // Force non-primary, non-auto-increment for user columns
      updated.is_primary = false;
      updated.auto_increment = false;
    }
    onChange(index, updated);
  };

  const isFK = String(field.default_value || '').startsWith('fk:');
  const dt = isFK ? 'FOREIGN_KEY' : (field.data_type || 'VARCHAR');

  const [tablesList, setTablesList] = useState([]);
  const [tableSearch, setTableSearch] = useState('');

  useEffect(() => {
    if (isFK || dt === 'FOREIGN_KEY') {
      import('./api').then(({ fetchTables, fetchMysqlTables }) => {
        Promise.all([fetchTables(), fetchMysqlTables()]).then(([res1, res2]) => {
          const registered = (res1.data.results || []).map(t => t.table_name);
          const rawSystem = res2.data.system_tables || [];
          const all = Array.from(new Set([...registered, ...rawSystem]));
          setTablesList(all.sort());
        }).catch(err => {
          console.error("Failed to load tables inside FieldRow:", err);
        });
      });
    }
  }, [dt, isFK]);

  let selectedTable = '';
  let selectedCol = 'name';
  if (isFK) {
    const parts = String(field.default_value).split(':');
    selectedTable = parts[1] || '';
    selectedCol = parts[2] || 'name';
  }

  const handleFKChange = (table, col) => {
    handleChange('default_value', `fk:${table}:${col}`);
  };

  return (
    <div className="p-3 mb-2 border rounded bg-white shadow-sm">
      <Row className="align-items-center g-3">
        {/* ── Order controls ── */}
        <Col xs={12} md={1} className="d-flex align-items-center justify-content-center">
          <div className="d-flex flex-column align-items-center justify-content-center gap-1">
            <Button
              variant="link"
              className="p-0 text-decoration-none text-muted"
              onClick={() => onMoveUp(index)}
              disabled={isFirst}
              title="Move Up"
              style={{ fontSize: '0.9rem', lineHeight: 1 }}
            >
              ▲
            </Button>
            <span className="fw-bold text-secondary my-1" style={{ fontSize: '0.85rem' }}>
              #{index + 1}
            </span>
            <Button
              variant="link"
              className="p-0 text-decoration-none text-muted"
              onClick={() => onMoveDown(index)}
              disabled={isLast}
              title="Move Down"
              style={{ fontSize: '0.9rem', lineHeight: 1 }}
            >
              ▼
            </Button>
          </div>
        </Col>

        {/* ── Field name ── */}
        <Col xs={12} md={3}>
          <Form.Group>
            <Form.Label className="d-md-none text-muted fw-bold small">Field Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g. customer_name"
              value={field.field_name || ''}
              onChange={(e) => handleChange('field_name', e.target.value)}
              disabled={readOnly}
              pattern="^[a-zA-Z][a-zA-Z0-9_]*$"
              title="Must start with a letter, only letters/digits/underscores"
            />
          </Form.Group>
        </Col>

        {/* ── Data type ── */}
        <Col xs={12} md={2}>
          <Form.Group>
            <Form.Label className="d-md-none text-muted fw-bold small">Type</Form.Label>
            <Form.Select
              value={dt}
              onChange={(e) => handleChange('data_type', e.target.value)}
              disabled={readOnly}
            >
              {SIMPLIFIED_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>

        {/* ── Default value / FK settings ── */}
        <Col xs={12} md={3}>
          <Form.Group>
            <Form.Label className="d-md-none text-muted fw-bold small">Default Value / Settings</Form.Label>
            {isFK ? (
              <div className="d-flex flex-column gap-1">
                <Form.Control
                  type="text"
                  size="sm"
                  placeholder="Search table…"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  disabled={readOnly}
                  style={{ fontSize: '12px' }}
                />
                <div className="d-flex gap-2">
                  <Form.Select
                    style={{ flex: 1, minWidth: 100, fontSize: '13px' }}
                    value={selectedTable}
                    onChange={(e) => handleFKChange(e.target.value, selectedCol)}
                    disabled={readOnly}
                    size={4}
                  >
                    <option value="">— Target Table —</option>
                    {tablesList
                      .filter(t => t.toLowerCase().includes(tableSearch.toLowerCase()))
                      .map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                  </Form.Select>
                  <Form.Control
                    type="text"
                    style={{ flex: 1, minWidth: 80, alignSelf: 'flex-start' }}
                    placeholder="Label field (e.g. name)"
                    value={selectedCol}
                    onChange={(e) => handleFKChange(selectedTable, e.target.value)}
                    disabled={readOnly}
                    title="Column of target table to display in dropdown list"
                  />
                </div>
              </div>
            ) : !NO_DEFAULT_TYPES.includes(dt) ? (
              <Form.Control
                type="text"
                placeholder={dt === 'BOOLEAN' ? 'e.g. 1 (Yes) or 0 (No)' : 'Optional default value'}
                value={field.default_value || ''}
                onChange={(e) => handleChange('default_value', e.target.value)}
                disabled={readOnly}
              />
            ) : (
              <div className="text-muted text-center pt-2">—</div>
            )}
          </Form.Group>
        </Col>

        {/* ── Required Toggle ── */}
        <Col xs={12} md={2} className="d-flex align-items-center justify-content-md-center mt-2 mt-md-0">
          <Form.Check
            type="checkbox"
            id={`required-check-${index}`}
            label="Required"
            checked={!field.is_nullable}
            onChange={(e) => handleChange('is_nullable', !e.target.checked)}
            disabled={readOnly}
            className="fw-semibold text-secondary"
          />
        </Col>

        {/* ── Remove/Add buttons ── */}
        <Col xs={12} md={1} className="d-flex justify-content-end justify-content-md-center align-items-center gap-2">
          {!readOnly && (
            <>
              {onAdd && (
                <Button
                  variant="outline-success"
                  size="sm"
                  onClick={() => onAdd(index)}
                  title="Insert field below"
                >
                  ＋
                </Button>
              )}
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => onRemove(index)}
                title="Remove field"
              >
                ✕
              </Button>
            </>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default FieldRow;
