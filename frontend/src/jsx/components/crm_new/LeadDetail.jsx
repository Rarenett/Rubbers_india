import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Badge, Button } from 'react-bootstrap';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import CRMNewService from '../../../services/CRMNewService';
import { usePageTitle } from '../../../context/TitleContext';

const LeadDetail = () => {
    const { id } = useParams();
    usePageTitle('Lead Details');
    const navigate = useNavigate();

    const [lead, setLead] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLead();
    }, [id]);

    const fetchLead = async () => {
        setLoading(true);
        try {
            const res = await CRMNewService.getLead(id);
            setLead(res.data);
        } catch (err) {
            console.error('Failed to load lead details', err);
            Swal.fire('Error', 'Failed to load lead details', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        const leadName = `${lead?.first_name || ''} ${lead?.last_name || ''}`.trim() || lead?.company || `#${id}`;
        const result = await Swal.fire({
            title: 'Delete Lead?',
            text: `Are you sure you want to delete lead "${leadName}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await CRMNewService.deleteLead(id);
                Swal.fire('Deleted', 'Lead deleted successfully', 'success');
                navigate('/crm/leads');
            } catch (err) {
                console.error('Failed to delete lead', err);
                Swal.fire('Error', 'Failed to delete lead', 'error');
            }
        }
    };

    if (loading) {
        return (
            <div className="container-fluid text-center py-5">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading lead...</span>
                </div>
            </div>
        );
    }

    if (!lead) {
        return (
            <div className="container-fluid text-center py-5">
                <h4>Lead not found</h4>
                <Button variant="primary" onClick={() => navigate('/crm/leads')} className="mt-3">
                    Back to Leads
                </Button>
            </div>
        );
    }

    const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.company || 'Unnamed Lead';

    return (
        <div className="container-fluid">
            <style>{`
                .lead-detail-card {
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.03);
                    margin-bottom: 20px;
                }
                .lead-detail-card .card-header {
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                    padding: 12px 20px;
                    font-weight: 600;
                    font-size: 14px;
                    color: #1e293b;
                }
                .detail-label {
                    font-size: 12px;
                    color: #64748b;
                    margin-bottom: 2px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .detail-value {
                    font-size: 14px;
                    font-weight: 500;
                    color: #1e293b;
                }
            `}</style>

            <div className="page-titles mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => navigate('/crm/leads')}
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back to Leads
                </button>
                <div className="d-flex gap-2">
                    <button
                        type="button"
                        onClick={() => navigate(`/crm_new/leads/edit/${lead.id}`)}
                        className="btn btn-primary btn-sm"
                        style={{ backgroundColor: '#0a500f', borderColor: '#0a500f', borderRadius: '6px' }}
                    >
                        <i className="fa fa-pencil-alt me-1"></i> Edit Lead
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="btn btn-outline-danger btn-sm"
                        style={{ borderRadius: '6px' }}
                    >
                        <i className="fa fa-trash me-1"></i> Delete
                    </button>
                </div>
            </div>

            {/* Header Banner Card */}
            <Card className="lead-detail-card mb-4">
                <Card.Body className="p-4">
                    <div className="d-flex align-items-center gap-4 flex-wrap">
                        {lead.image ? (
                            <img
                                src={lead.image}
                                alt={fullName}
                                className="rounded-circle shadow-sm"
                                style={{ width: '90px', height: '90px', objectFit: 'cover' }}
                            />
                        ) : (
                            <div
                                className="rounded-circle bg-light border d-flex align-items-center justify-content-center text-primary fw-bold"
                                style={{ width: '90px', height: '90px', fontSize: '32px' }}
                            >
                                {fullName.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="flex-grow-1">
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                <h3 className="mb-0 fw-bold text-dark">{fullName}</h3>
                                <span className="badge badge-success light fs-13">
                                    {lead.lead_status || 'Not Contacted'}
                                </span>
                                {lead.priority && (
                                    <span className="badge badge-warning light fs-13">
                                        Priority: {lead.priority}
                                    </span>
                                )}
                            </div>
                            <div className="text-muted mt-1">
                                {lead.title && <span className="me-2">{lead.title}</span>}
                                {lead.company && <span className="fw-semibold text-secondary">at {lead.company}</span>}
                            </div>
                            <div className="d-flex gap-3 mt-2 text-muted small flex-wrap">
                                {lead.phone && <span><i className="fa fa-phone me-1 text-primary"></i>{lead.phone}</span>}
                                {lead.email && <span><i className="fa fa-envelope me-1 text-primary"></i>{lead.email}</span>}
                                {lead.city && <span><i className="fa fa-map-marker-alt me-1 text-danger"></i>{lead.city}{lead.country ? `, ${lead.country}` : ''}</span>}
                            </div>
                        </div>
                    </div>
                </Card.Body>
            </Card>

            <Row>
                {/* Left Column: Details */}
                <Col lg={8}>
                    {/* Ownership & Classification */}
                    <Card className="lead-detail-card">
                        <Card.Header>
                            <i className="fa fa-user me-2 text-primary"></i>Ownership & Classification
                        </Card.Header>
                        <Card.Body>
                            <Row className="g-3">
                                <Col sm={6}>
                                    <div className="detail-label">Lead Owner (Employee)</div>
                                    <div className="detail-value">{lead.lead_owner_name || '—'}</div>
                                </Col>
                                <Col sm={6}>
                                    <div className="detail-label">External Owner / Person Name</div>
                                    <div className="detail-value text-info">{lead.other_owner_name || '— (None, assigned to employee)'}</div>
                                </Col>
                                <Col sm={6}>
                                    <div className="detail-label">Category</div>
                                    <div className="detail-value">{lead.category_name || '—'}</div>
                                </Col>
                                <Col sm={6}>
                                    <div className="detail-label">Lead Source</div>
                                    <div className="detail-value">{lead.lead_source_name || '—'}</div>
                                </Col>
                                <Col sm={6}>
                                    <div className="detail-label">Industry</div>
                                    <div className="detail-value">{lead.industry_name || (typeof lead.industry === 'object' ? lead.industry?.name : lead.industry) || '—'}</div>
                                </Col>
                                <Col sm={6}>
                                    <div className="detail-label">Rating</div>
                                    <div className="detail-value">{lead.rating || '—'}</div>
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>

                    {/* Products & Services Requirements */}
                    <Card className="lead-detail-card">
                        <Card.Header>
                            <i className="fa fa-cubes me-2 text-info"></i>Products & Services Requirements
                        </Card.Header>
                        <Card.Body>
                            <Row className="g-3">
                                <Col md={6}>
                                    <div className="detail-label mb-2">Interested Products (Stock Items)</div>
                                    {lead.products_details && lead.products_details.length > 0 ? (
                                        <div className="d-flex flex-wrap gap-1">
                                            {lead.products_details.map(p => (
                                                <Badge key={p.id} bg="primary" className="p-2 fw-normal">
                                                    <i className="fa fa-box me-1"></i>
                                                    {p.stock_item_name || p.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-muted">No specific stock products selected.</span>
                                    )}
                                </Col>
                                <Col md={6}>
                                    <div className="detail-label mb-2">Interested Services (CRM Services)</div>
                                    {lead.services_details && lead.services_details.length > 0 ? (
                                        <div className="d-flex flex-wrap gap-1">
                                            {lead.services_details.map(s => (
                                                <Badge key={s.id} bg="info" className="p-2 fw-normal text-white">
                                                    <i className="fa fa-concierge-bell me-1"></i>
                                                    {s.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-muted">No specific services selected.</span>
                                    )}
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>

                    {/* Contact & Address Details */}
                    <Card className="lead-detail-card">
                        <Card.Header>
                            <i className="fa fa-address-book me-2 text-success"></i>Contact & Address Information
                        </Card.Header>
                        <Card.Body>
                            <Row className="g-3">
                                <Col sm={4}>
                                    <div className="detail-label">Mobile</div>
                                    <div className="detail-value">{lead.mobile || '—'}</div>
                                </Col>
                                <Col sm={4}>
                                    <div className="detail-label">Fax</div>
                                    <div className="detail-value">{lead.fax || '—'}</div>
                                </Col>
                                <Col sm={4}>
                                    <div className="detail-label">Secondary Email</div>
                                    <div className="detail-value">{lead.secondary_email || '—'}</div>
                                </Col>
                                <Col sm={4}>
                                    <div className="detail-label">Website</div>
                                    <div className="detail-value">
                                        {lead.website ? (
                                            <a href={lead.website} target="_blank" rel="noopener noreferrer">{lead.website}</a>
                                        ) : '—'}
                                    </div>
                                </Col>
                                <Col sm={4}>
                                    <div className="detail-label">Skype ID</div>
                                    <div className="detail-value">{lead.skype_id || '—'}</div>
                                </Col>
                                <Col sm={4}>
                                    <div className="detail-label">Twitter</div>
                                    <div className="detail-value">{lead.twitter || '—'}</div>
                                </Col>
                                <Col sm={12}>
                                    <div className="detail-label">Contact Preferences</div>
                                    <div className="detail-value">{lead.contact_preferences || '—'}</div>
                                </Col>
                                <Col sm={12}><hr className="my-1" /></Col>
                                <Col sm={6}>
                                    <div className="detail-label">Street Address</div>
                                    <div className="detail-value">
                                        {lead.flat_house_no ? `${lead.flat_house_no}, ` : ''}{lead.street_address || '—'}
                                    </div>
                                </Col>
                                <Col sm={6}>
                                    <div className="detail-label">City, State, Zip, Country</div>
                                    <div className="detail-value">
                                        {[lead.city, lead.state_province, lead.zip_postal_code, lead.country].filter(Boolean).join(', ') || '—'}
                                    </div>
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>

                    {/* Description */}
                    {lead.description && (
                        <Card className="lead-detail-card">
                            <Card.Header>
                                <i className="fa fa-align-left me-2 text-secondary"></i>Description / Remarks
                            </Card.Header>
                            <Card.Body>
                                <p className="mb-0 text-dark" style={{ whiteSpace: 'pre-line' }}>{lead.description}</p>
                            </Card.Body>
                        </Card>
                    )}
                </Col>

                {/* Right Column: Deal Metrics & Multiple Attachments */}
                <Col lg={4}>
                    {/* Deal Metrics */}
                    <Card className="lead-detail-card">
                        <Card.Header>
                            <i className="fa fa-chart-line me-2 text-warning"></i>Deal Metrics
                        </Card.Header>
                        <Card.Body>
                            <div className="mb-3">
                                <div className="detail-label">Estimated Value</div>
                                <div className="h4 fw-bold text-success mb-0">
                                    {lead.estimated_value ? `₹${parseFloat(lead.estimated_value).toLocaleString('en-IN')}` : '—'}
                                </div>
                            </div>
                            <div className="mb-3">
                                <div className="detail-label">Expected Closing Date</div>
                                <div className="detail-value">{lead.expected_closing_date || '—'}</div>
                            </div>
                            <div className="mb-3">
                                <div className="detail-label">Assigned Sales Employees</div>
                                <div className="detail-value text-dark">{lead.assigned_sales_employees || '—'}</div>
                            </div>
                            <div className="mb-2">
                                <div className="detail-label">Email Opt-Out</div>
                                <div className="detail-value">
                                    {lead.email_opt_out ? (
                                        <Badge bg="danger">Opted Out</Badge>
                                    ) : (
                                        <Badge bg="success">Subscribed</Badge>
                                    )}
                                </div>
                            </div>
                        </Card.Body>
                    </Card>

                    {/* Photos & Images Gallery */}
                    <Card className="lead-detail-card">
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <span><i className="fa fa-image me-2 text-success"></i>Photos & Images</span>
                            <Badge bg="light" text="dark">
                                {lead.images?.length || (lead.image ? 1 : 0)}
                            </Badge>
                        </Card.Header>
                        <Card.Body>
                            {lead.images && lead.images.length > 0 ? (
                                <div className="row g-2">
                                    {lead.images.map(img => (
                                        <div key={img.id} className="col-6">
                                            <div className="border rounded p-1 text-center bg-light h-100 position-relative">
                                                <a href={img.image} target="_blank" rel="noopener noreferrer">
                                                    <img
                                                        src={img.image}
                                                        alt={img.image_name || 'Lead Image'}
                                                        className="img-fluid rounded"
                                                        style={{ height: '80px', width: '100%', objectFit: 'cover' }}
                                                    />
                                                </a>
                                                <div className="small text-truncate mt-1 px-1" title={img.image_name || ''} style={{ fontSize: '11px' }}>
                                                    {img.image_name || 'Photo'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : lead.image ? (
                                <div className="text-center">
                                    <a href={lead.image} target="_blank" rel="noopener noreferrer">
                                        <img
                                            src={lead.image}
                                            alt="Lead Photo"
                                            className="img-fluid rounded border shadow-sm"
                                            style={{ maxHeight: '160px', objectFit: 'cover' }}
                                        />
                                    </a>
                                </div>
                            ) : (
                                <p className="text-muted small mb-0 text-center py-3">
                                    No photos uploaded.
                                </p>
                            )}
                        </Card.Body>
                    </Card>

                    {/* Multiple File Attachments */}
                    <Card className="lead-detail-card">
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <span><i className="fa fa-paperclip me-2 text-primary"></i>Attachments</span>
                            <Badge bg="light" text="dark">
                                {lead.attachments?.length || 0}
                            </Badge>
                        </Card.Header>
                        <Card.Body>
                            {lead.attachments && lead.attachments.length > 0 ? (
                                <div>
                                    {lead.attachments.map(att => (
                                        <div
                                            key={att.id}
                                            className="d-flex align-items-center justify-content-between p-2 mb-2 rounded border bg-light"
                                        >
                                            <div className="text-truncate me-2">
                                                <i className="fa fa-file-alt text-primary me-2"></i>
                                                <a
                                                    href={att.file}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="fw-semibold text-dark text-decoration-none"
                                                >
                                                    {att.file_name || 'Download file'}
                                                </a>
                                                {att.file_size && (
                                                    <div className="text-muted" style={{ fontSize: '11px' }}>
                                                        {(att.file_size / 1024).toFixed(1)} KB
                                                    </div>
                                                )}
                                            </div>
                                            <a
                                                href={att.file}
                                                download
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-outline-primary btn-xs"
                                                title="Download Attachment"
                                            >
                                                <i className="fa fa-download"></i>
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted small mb-0 text-center py-3">
                                    No attachments uploaded.
                                </p>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default LeadDetail;
