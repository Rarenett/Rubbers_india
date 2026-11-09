import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, Row, Col } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
    getPriorityRules,
    createPriorityRule,
    updatePriorityRule,
    deletePriorityRule
} from '../../../services/PriorityService';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import { usePermission } from '../../../hooks/usePermission';

const PriorityRules = () => {
    const navigate = useNavigate();
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({ 
        rule_name: '', 
        priority_level: 'Medium', 
        description: '', 
        is_active: true 
    });
    const { can } = usePermission();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await getPriorityRules();
            setRules(data.results || data);
        } catch (err) {
            console.error("Error fetching priority rules", err);
            Swal.fire('Error', 'Failed to fetch priority rules', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (rule = null) => {
        if (rule) {
            setEditId(rule.id);
            setFormData({
                rule_name: rule.rule_name || '',
                priority_level: rule.priority_level || 'Medium',
                description: rule.description || '',
                is_active: rule.is_active
            });
        } else {
            setEditId(null);
            setFormData({ rule_name: '', priority_level: 'Medium', description: '', is_active: true });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editId) {
                await updatePriorityRule(editId, formData);
                Swal.fire('Updated', 'Priority rule updated successfully', 'success');
            } else {
                await createPriorityRule(formData);
                Swal.fire('Created', 'Priority rule created successfully', 'success');
            }
            fetchData();
            handleCloseModal();
        } catch (err) {
            console.error("Error saving priority rule", err);
            Swal.fire('Error', 'Operation failed. Ensure rule name is unique.', 'error');
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete priority rule?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deletePriorityRule(id);
                Swal.fire('Deleted', 'Priority rule deleted successfully', 'success');
                fetchData();
            } catch (error) {
                Swal.fire('Error', 'Failed to delete priority rule', 'error');
            }
        }
    };

    return (
        <div className="cm-dashboard-container" style={{ padding: 0, backgroundColor: 'transparent', minHeight: 'auto' }}>
            {/* Header / Hero Section */}
            <div className="cm-hero-card" style={{ padding: '1.5rem 2.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="cm-hero-content" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="d-flex align-items-center mb-2">
                        <button
                            className="btn btn-sm me-3"
                            style={{ background: '#f0f7ff', color: '#00d2ff', border: 'none', borderRadius: '8px', fontWeight: '800', padding: '0.4rem 0.8rem' }}
                            onClick={() => navigate('/complaints')}
                        >
                            ‹ Back
                        </button>
                        <h1 style={{ fontSize: '1.8rem', margin: 0, fontWeight: 800 }}>Matrix <span style={{ color: '#00d2ff'}}>Access Model</span></h1>
                    </div>
                    <p style={{ fontSize: '0.9rem', marginBottom: 0, color: '#64748b', marginLeft: '4.5rem' }}>
                        Configure and manage your priority logic within the ComplaintCore infrastructure.
                    </p>
                </div>
                <div className="cm-header-actions">
                    <CreateButton
                        module="complaints"
                        onClick={() => handleShowModal()}
                    >
                        PRIORITY
                    </CreateButton>
                </div>
            </div>

<div className="cm-section-container" style={{ padding: '1.5rem 2rem', backgroundColor: '#fff', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                <div className="cm-section-header d-flex justify-content-between align-items-center" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Priority Rules List</h3>
                    <div className="d-flex align-items-center gap-3">
                        <div className="search-bar-container" style={{ position: 'relative' }}>
                            <span className="search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            </span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Search rules..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: '2.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', height: '38px', minWidth: '220px' }}
                            />
                        </div>
                        <button className="btn btn-sm" style={{ background: '#f1f5f9', color: '#475569', border: 'none', height: '36px', borderRadius: '6px', padding: '0 12px', fontWeight: 600 }} onClick={fetchData}>
                            Refresh
                        </button>
                    </div>
                </div>
            
                <div className="table-responsive">
                    <table className="cm-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 10px' }}>
                        <thead>
                            <tr style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase' }}>
                                <th style={{ padding: '1rem' }}>#</th>
                                <th style={{ padding: '1rem' }}>RULE NAME</th>
                                <th style={{ padding: '1rem' }}>PRIORITY</th>
                                <th style={{ padding: '1rem' }}>DESCRIPTION</th>
                                <th style={{ padding: '1rem' }}>STATUS</th>
                                <th style={{ padding: '1rem', textAlign: 'right' }}>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <tr><td colSpan="6" className="text-center py-5">Loading...</td></tr> : 
                                rules.filter(r => (r.rule_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (r.priority_level || '').toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? <tr><td colSpan="6" className="text-center py-5 text-muted">No rules found.</td></tr> :
                                rules.filter(r => (r.rule_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (r.priority_level || '').toLowerCase().includes(searchTerm.toLowerCase())).map((r, idx) => (
                                <tr key={r.id} style={{ backgroundColor: '#fff', borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '1rem' }}>{idx + 1}</td>
                                    <td style={{ padding: '1rem' }}><strong>{r.rule_name}</strong></td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{ 
                                            padding: '4px 12px', 
                                            borderRadius: '20px', 
                                            fontSize: '0.8rem', 
                                            fontWeight: '700',
                                            backgroundColor: r.priority_level === 'Critical' ? '#fee2e2' : r.priority_level === 'High' ? '#fff7ed' : r.priority_level === 'Medium' ? '#f0f9ff' : '#f0fdf4',
                                            color: r.priority_level === 'Critical' ? '#991b1b' : r.priority_level === 'High' ? '#9a3412' : r.priority_level === 'Medium' ? '#075985' : '#166534'
                                        }}>
                                            {r.priority_level}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', color: '#64748b', maxWidth: '300px' }} className="text-truncate">{r.description || '—'}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{ 
                                            padding: '4px 12px', 
                                            borderRadius: '20px', 
                                            fontSize: '0.8rem', 
                                            fontWeight: '700',
                                            backgroundColor: r.is_active ? '#ecfdf5' : '#fef2f2',
                                            color: r.is_active ? '#10b981' : '#ef4444'
                                        }}>
                                            {r.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                        {can('complaints', 'edit') || can('complaints', 'delete') ? (
                                            <>
                                                <EditButton
                                                    module="complaints"
                                                    onClick={() => handleShowModal(r)}
                                                    className="me-2"
                                                />
                                                <DeleteButton
                                                    module="complaints"
                                                    onClick={() => handleDelete(r.id, r.rule_name)}
                                                />
                                            </>
                                        ) : (
                                            <span className="badge badge-danger light">No Access</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Priority Modal */}
            <Modal show={showModal} onHide={handleCloseModal} centered size="lg">
                <Modal.Header closeButton style={{ 
                    background: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)', 
                    color: '#fff',
                    border: 'none',
                    padding: '1.5rem 2rem'
                }}>
                    <Modal.Title style={{ fontWeight: 800, fontSize: '1.4rem' }}>
                        {editId ? 'Edit Priority Rule' : 'New Priority Logic'}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ padding: '2.5rem' }}>
                    <Form onSubmit={handleSubmit}>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-4">
                                    <Form.Label style={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem', marginBottom: '0.6rem' }}>RULE NAME</Form.Label>
                                    <Form.Control 
                                        required 
                                        type="text" 
                                        value={formData.rule_name} 
                                        onChange={e => setFormData({...formData, rule_name: e.target.value})} 
                                        placeholder="e.g. Critical Server Down" 
                                        style={{ padding: '0.8rem 1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem', background: '#f8fafc' }}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-4">
                                    <Form.Label style={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem', marginBottom: '0.6rem' }}>PRIORITY LEVEL</Form.Label>
                                    <Form.Select 
                                        required 
                                        value={formData.priority_level} 
                                        onChange={e => setFormData({...formData, priority_level: e.target.value})} 
                                        style={{ padding: '0.8rem 1.2rem', borderRadius: '12px', border: '2px solid #00d2ff', fontSize: '1rem', background: '#fff', fontWeight: 700, color: '#0ea5e9' }}
                                    >
                                        <option value="Low">Low Priority</option>
                                        <option value="Medium">Medium Priority</option>
                                        <option value="High">High Priority</option>
                                        <option value="Critical">Critical Priority</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={12}>
                                <Form.Group className="mb-4">
                                    <Form.Label style={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem', marginBottom: '0.6rem' }}>RULE DESCRIPTION</Form.Label>
                                    <Form.Control 
                                        as="textarea" 
                                        rows={3} 
                                        value={formData.description} 
                                        onChange={e => setFormData({...formData, description: e.target.value})} 
                                        placeholder="Explain the criteria for this priority level..." 
                                        style={{ padding: '0.8rem 1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem', background: '#f8fafc' }}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={12}>
                                <Form.Group className="mb-4">
                                    <Form.Check 
                                        type="switch" 
                                        id="active-switch-rule" 
                                        label={formData.is_active ? "Status: Active Rule" : "Status: Inactive"} 
                                        checked={formData.is_active} 
                                        onChange={e => setFormData({...formData, is_active: e.target.checked})} 
                                        style={{ fontWeight: 600, color: formData.is_active ? '#10b981' : '#64748b' }}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                        <div className="d-flex justify-content-end gap-2 mt-2 pt-4 border-top">
                            <Button variant="light" onClick={handleCloseModal} style={{ borderRadius: '12px', fontWeight: 600, padding: '0.8rem 1.5rem' }}>
                                Discard
                            </Button>
                            <Button type="submit" style={{ 
                                background: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)', 
                                color: '#fff', 
                                fontWeight: '800', 
                                borderRadius: '12px', 
                                padding: '0.8rem 2.5rem', 
                                border: 'none',
                                boxShadow: '0 4px 12px rgba(0, 210, 255, 0.2)'
                            }}>
                                {editId ? 'Save Configuration' : 'Create Rule'}
                            </Button>
                        </div>
                    </Form>
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default PriorityRules;
