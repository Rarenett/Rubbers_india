import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Button, Row, Col, Nav, InputGroup, Modal, Alert } from 'react-bootstrap';
import { fetchTables, deleteTable, fetchMysqlTables } from './api';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import './DynamicDB.css';

const TableList = () => {
  const navigate = useNavigate();

  // Tab state: 'dynamic' | 'system'
  const [activeTab,    setActiveTab]    = useState('dynamic');

  const [dynTables,    setDynTables]    = useState([]); // registered dynamic tables
  const [sysTables,    setSysTables]    = useState([]); // system tables (both registered and unregistered)
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [search,       setSearch]       = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null); // dynamic table drop target
  const [deleting,     setDeleting]     = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch metadata registered tables
      const metaRes = await fetchTables();
      const metaTables = metaRes.data.results || [];

      // 2. Fetch raw MySQL tables
      const mysqlRes = await fetchMysqlTables();
      const mysqlSysList = mysqlRes.data.system_tables || [];

      // Classify metadata tables: dynamic (prefixed dyn_) vs registered system tables (no prefix)
      const registeredDyn = metaTables.filter(t => t.table_name.startsWith('dyn_') || t.db_table.startsWith('dyn_'));
      const registeredSys = metaTables.filter(t => !t.table_name.startsWith('dyn_') && !t.db_table.startsWith('dyn_'));

      // Build complete list of system tables:
      // Merge registered system tables with raw mysql system tables (unregistered)
      const mergedSys = [];

      // Add registered system tables
      registeredSys.forEach(sys => {
        mergedSys.push({
          ...sys,
          is_system: true,
          is_registered: true
        });
      });

      // Add raw unregistered system tables
      mysqlSysList.forEach(rawName => {
        const alreadyRegistered = registeredSys.some(r => r.table_name === rawName || r.db_table === rawName);
        if (!alreadyRegistered) {
          mergedSys.push({
            id: `raw-${rawName}`,
            table_name: rawName,
            db_table: rawName,
            description: 'Core ERP system table. Select to customize by adding columns.',
            fields_count: '—',
            created_at: null,
            created_by_name: 'Developer',
            is_system: true,
            is_registered: false
          });
        }
      });

      setDynTables(registeredDyn);
      setSysTables(mergedSys);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load database tables.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Handle Dynamic Table delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTable(deleteTarget.table_name);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete table.');
    } finally {
      setDeleting(false);
    }
  };

  // Filter current active list by search query
  const currentList = activeTab === 'dynamic' ? dynTables : sysTables;
  const filtered = currentList.filter(t =>
    t.table_name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container-fluid px-0">
      {/* ── Header ── */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-primary fw-bold mb-1">🗄️ Database Designer</h3>
          <p className="text-muted mb-0 small">
            Add fields to developer-created tables, or create customized dynamic tables at runtime.
          </p>
        </div>
        <CreateButton
          module="database_designer"
          onClick={() => navigate('/dynamic-db/tables/create')}
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
          New Table
        </CreateButton>
      </div>

      {/* ── Tabs selector ── */}
      <Nav variant="tabs" activeKey={activeTab} onSelect={(key) => { setActiveTab(key); setSearch(''); }} className="mb-4">
        <Nav.Item>
          <Nav.Link eventKey="dynamic" className="fw-semibold">
            📁 Custom Tables ({dynTables.length})
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="system" className="fw-semibold">
            ⚙️ Existing System Tables ({sysTables.length})
          </Nav.Link>
        </Nav.Item>
      </Nav>

      {/* ── Search bar ── */}
      <Row className="mb-4 align-items-center">
        <Col md={5}>
          <InputGroup>
            <InputGroup.Text className="bg-light text-muted">🔍</InputGroup.Text>
            <Form.Control
              type="text"
              placeholder={activeTab === 'dynamic' ? 'Search custom tables…' : 'Search ERP tables…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <Button variant="light" onClick={() => setSearch('')}>✕</Button>
            )}
          </InputGroup>
        </Col>
        <Col className="text-md-end mt-2 mt-md-0">
          <span className="badge bg-secondary p-2">{filtered.length} table{filtered.length !== 1 ? 's' : ''}</span>
        </Col>
      </Row>

      {/* ── Content ── */}
      {loading ? (
        <div className="text-center py-5 text-muted">
          <div className="spinner-border text-primary mb-2" role="status" />
          <div>Loading database structure…</div>
        </div>
      ) : error ? (
        <Alert variant="danger">
          <span>⚠️ {error}</span>
          <Button variant="outline-danger" size="sm" className="ms-3" onClick={loadData}>Retry</Button>
        </Alert>
      ) : filtered.length === 0 ? (
        <div className="text-center py-5 text-muted border rounded bg-white">
          <div className="fs-1 mb-2">📭</div>
          <h5>{search ? 'No tables match your search.' : 'No tables found.'}</h5>
          {activeTab === 'dynamic' && !search && (
            <Button
              variant="primary"
              className="mt-2"
              onClick={() => navigate('/dynamic-db/tables/create')}
            >
              Create your first custom table
            </Button>
          )}
        </div>
      ) : (
        <Row className="g-3">
          {filtered.map((table) => (
            <Col md={4} key={table.id}>
              <Card className="h-100 shadow-sm border-light">
                <Card.Body className="d-flex flex-column p-4">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <span className="fs-4">{table.is_system ? '⚙️' : '⬡'}</span>
                      <div>
                        <Card.Title className="mb-0 fw-bold">{table.table_name}</Card.Title>
                        <code className="small text-muted">{table.db_table}</code>
                      </div>
                    </div>
                    {table.is_system && (
                      <span className="badge bg-info text-white">System</span>
                    )}
                  </div>

                  {table.description && (
                    <Card.Text className="text-muted small mt-2 flex-grow-1">
                      {table.description}
                    </Card.Text>
                  )}

                  <div className="d-flex flex-wrap gap-2 my-3">
                    <span
                      className="badge"
                      style={{
                        backgroundColor: 'rgba(126, 118, 203, 0.15)',
                        color: '#7e76cb',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        padding: '6px 12px',
                        borderRadius: '20px'
                      }}
                    >
                      {table.fields_count} field{table.fields_count !== 1 ? 's' : ''}
                    </span>
                    {table.created_at ? (
                      <span
                        className="badge"
                        style={{
                          backgroundColor: 'rgba(108, 117, 125, 0.12)',
                          color: '#6c757d',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          padding: '6px 12px',
                          borderRadius: '20px'
                        }}
                      >
                        {new Date(table.created_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <span
                        className="badge"
                        style={{
                          backgroundColor: 'rgba(108, 117, 125, 0.12)',
                          color: '#6c757d',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          padding: '6px 12px',
                          borderRadius: '20px'
                        }}
                      >
                        Core Table
                      </span>
                    )}
                    {table.created_by_name && (
                      <span
                        className="badge"
                        style={{
                          backgroundColor: 'rgba(110, 200, 155, 0.15)',
                          color: '#2e7d32',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <i className="fa fa-user" style={{ fontSize: '0.75rem' }}></i>
                        {table.created_by_name}
                      </span>
                    )}
                  </div>

                  <div className="d-flex gap-2 mt-auto pt-2 border-top">
                    <Button
                      variant="outline-success"
                      size="sm"
                      onClick={() => navigate(`/dynamic-db/${table.table_name}/data`)}
                      title="Browse data"
                      className="flex-grow-1"
                      style={{
                        borderColor: '#6ec89b',
                        color: '#6ec89b',
                        height: '38px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'none',
                        backgroundColor: 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#6ec89b';
                        e.currentTarget.style.color = '#fff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#6ec89b';
                      }}
                    >
                      <i className="fa fa-table me-2"></i>
                      Data
                    </Button>
                    <EditButton
                      module="database_designer"
                      to={`/dynamic-db/tables/${table.table_name}/edit`}
                      className="flex-grow-1"
                      style={{
                        borderColor: '#7e76cb',
                        color: '#7e76cb',
                        height: '38px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'none',
                        backgroundColor: 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#7e76cb';
                        e.currentTarget.style.color = '#fff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#7e76cb';
                      }}
                    >
                      <span className="ms-2">Edit Structure</span>
                    </EditButton>
                    {!table.is_system && (
                      <DeleteButton
                        module="database_designer"
                        onClick={() => setDeleteTarget(table)}
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '8px',
                          padding: '0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: 'none'
                        }}
                      />
                    )}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* ── Delete Confirmation Modal ── */}
      <Modal show={!!deleteTarget} onHide={() => !deleting && setDeleteTarget(null)} centered>
        <Modal.Header closeButton={!deleting}>
          <Modal.Title className="text-danger">⚠️ Delete Table?</Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-4">
          <p className="text-center">
            This will permanently drop the MySQL table{' '}
            <strong><code>{deleteTarget?.db_table}</code></strong> and all its data.
          </p>
          <p className="text-danger fw-bold text-center">This action cannot be undone.</p>
          <hr />
          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">
              Type the table name to confirm: <code>{deleteTarget?.table_name}</code>
            </Form.Label>
            <ConfirmInput
              expected={deleteTarget?.table_name || ''}
              onConfirm={handleDelete}
              onCancel={() => setDeleteTarget(null)}
              loading={deleting}
            />
          </Form.Group>
        </Modal.Body>
      </Modal>
    </div>
  );
};

/** Typed-confirmation input inside the delete modal */
const ConfirmInput = ({ expected, onConfirm, onCancel, loading }) => {
  const [value, setValue] = useState('');
  const matches = value === expected;
  return (
    <div className="d-flex flex-column gap-3 mt-2">
      <Form.Control
        type="text"
        placeholder={`Type "${expected}" to confirm`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="d-flex justify-content-end gap-2">
        <Button variant="light" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={onConfirm}
          disabled={!matches || loading}
        >
          {loading ? 'Deleting…' : '🗑️ Delete'}
        </Button>
      </div>
    </div>
  );
};

export default TableList;
