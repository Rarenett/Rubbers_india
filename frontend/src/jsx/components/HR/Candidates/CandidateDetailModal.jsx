import React, { useState, useEffect } from 'react';
import { Modal, Row, Col, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { getCandidateById } from '../../../../services/HRManagementService';

const CandidateDetailModal = ({ show, onHide, viewId }) => {
    const [candidate, setCandidate] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show && viewId) {
            fetchCandidate();
        } else {
            setCandidate(null);
        }
    }, [show, viewId]);

    const fetchCandidate = async () => {
        try {
            setLoading(true);
            const data = await getCandidateById(viewId);
            setCandidate(data);
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch candidate details',
            });
            onHide();
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const badgeMap = {
            'Pending': 'warning',
            'Selected': 'success',
            'Rejected': 'danger',
            'Waitlisted': 'info',
            'Resigned': 'secondary'
        };
        return <Badge bg={badgeMap[status] || 'secondary'} className="fs-6">{status}</Badge>;
    };

    const InfoField = ({ label, value }) => (
        <div className="mb-3">
            <div className="text-muted small fw-semibold mb-1" style={{ letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</div>
            <div className="text-dark fw-medium fs-6">{value || '-'}</div>
        </div>
    );

    if (loading) {
        return (
            <Modal className="modal fade item-custom-modal" show={show} onHide={onHide} centered dialogClassName="modal-lg" size="lg">
                <div className="modal-content border-0 shadow">
                    <div className="modal-header border-bottom">
                        <h5 className="modal-title fw-bold">Candidate Details</h5>
                        <button type="button" className="btn-close" onClick={onHide}></button>
                    </div>
                    <div className="modal-body p-5 text-center">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                    </div>
                </div>
            </Modal>
        );
    }

    if (!candidate) {
        return null;
    }

    return (
        <Modal className="modal fade item-custom-modal" show={show} onHide={onHide} centered dialogClassName="modal-lg" size="lg">
            <div className="modal-content border-0 shadow">
                <div className="modal-header border-bottom bg-light">
                    <h5 className="modal-title fw-bold text-dark">Candidate Details</h5>
                    <button type="button" className="btn-close" onClick={onHide}></button>
                </div>
                <div className="modal-body p-4">

                    <div className="d-flex align-items-center mb-4 pb-3 border-bottom">
                        {candidate.photo_url ? (
                            <img
                                src={candidate.photo_url}
                                alt="Profile"
                                style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                        ) : (
                            <div
                                style={{ width: '70px', height: '70px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '24px' }}
                            >
                                <i className="fa fa-user"></i>
                            </div>
                        )}
                        <div className="ms-3">
                            <h4 className="mb-1 text-dark fw-bold">{candidate.full_name}</h4>
                       <div>{getStatusBadge(candidate.status)}</div>
                        </div>
                    </div>

                    <Row>
                        {/* Personal Information */}
                        <Col lg={6} className="mb-4">
                            <h6 className="text-primary fw-bold mb-3 border-bottom pb-2">Personal Information</h6>
                            <Row>
                                <Col sm={6}><InfoField label="Mobile Number" value={candidate.mobile_number} /></Col>
                                <Col sm={12}><InfoField label="Email" value={candidate.email} /></Col>
                                <Col sm={6}>
                                    <InfoField
                                        label="Date of Birth"
                                        value={candidate.date_of_birth ? new Date(candidate.date_of_birth).toLocaleDateString() : '-'}
                                    />
                                </Col>
                                <Col sm={6}><InfoField label="Gender" value={candidate.gender} /></Col>
                                <Col sm={12}><InfoField label="Address" value={candidate.address} /></Col>
                            </Row>
                        </Col>

                        {/* Recruitment Details */}
                        <Col lg={6} className="mb-4">
                            <h6 className="text-primary fw-bold mb-3 border-bottom pb-2">Recruitment Details</h6>
                            <Row>
                                <Col sm={6}><InfoField label="Department" value={candidate.department_applied_name} /></Col>
                                <Col sm={6}><InfoField label="Experience (Years)" value={candidate.experience_years} /></Col>
                                <Col sm={6}><InfoField label="Qualification" value={candidate.qualification} /></Col>
                                <Col sm={6}><InfoField label="Expected Salary" value={candidate.expected_salary} /></Col>
                                <Col sm={6}><InfoField label="Notice Period" value={candidate.notice_period} /></Col>
                                <Col sm={12}><InfoField label="Skills" value={candidate.skills} /></Col>
                            </Row>
                        </Col>

                        {/* System Information & Resume */}
                        <Col lg={12}>
                            <h6 className="text-primary fw-bold mb-3 border-bottom pb-2">Additional Information</h6>
                            <Row>
                                <Col sm={4}>
                                    <InfoField
                                        label="Created At"
                                        value={candidate.created_at ? new Date(candidate.created_at).toLocaleString() : '-'}
                                    />
                                </Col>
                                <Col sm={4}>
                                    <InfoField
                                        label="Updated At"
                                        value={candidate.updated_at ? new Date(candidate.updated_at).toLocaleString() : '-'}
                                    />
                                </Col>
                                <Col sm={4}>
                                    <div className="mb-3">
                                        <div className="text-muted small fw-semibold mb-2" style={{ letterSpacing: '0.5px', textTransform: 'uppercase' }}>Resume</div>
                                        {candidate.resume_url ? (
                                            <a
                                                href={candidate.resume_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-sm btn-light border shadow-sm"
                                            >
                                                <i className="fa fa-file-pdf-o text-danger me-2"></i> View Resume
                                            </a>
                                        ) : (
                                            <div className="text-muted fw-medium fs-6">Not Uploaded</div>
                                        )}
                                    </div>
                                </Col>
                            </Row>
                        </Col>
                    </Row>
                </div>
            </div>
        </Modal>
    );
};

export default CandidateDetailModal;
