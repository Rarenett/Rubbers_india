import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Card, Form } from 'react-bootstrap';
import ComplaintService from '../../../services/ComplaintService';
import { usePageTitle } from '../../../context/TitleContext';
const ComplaintFinalDecisionList = () => {
    const navigate = useNavigate();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('Pending'); // 'Pending' or 'All'
    usePageTitle("Final Decision List");
    // Search Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    // Parse current user context
    const userDetailsStr = localStorage.getItem('userDetails');
    const currentUser = userDetailsStr ? JSON.parse(userDetailsStr).user : null;

    useEffect(() => {
        fetchComplaints();
    }, []);

    const fetchComplaints = async () => {
        setLoading(true);
        try {
            const res = await ComplaintService.getComplaints({ is_review: 'true' });
            setComplaints(res.data.results || res.data);
        } catch (err) {
            console.error("Error fetching complaints", err);
        } finally {
            setLoading(false);
        }
    };

    const getPriorityBadgeClass = (priority) => {
        const classes = {
            'Critical': 'badge-danger light',
            'High': 'badge-warning light',
            'Medium': 'badge-info light',
            'Low': 'badge-success light',
        };
        return classes[priority] || 'badge-info light';
    };

    const getAdminStatusBadgeClass = (status) => {
        const classes = {
            'Pending': 'badge-secondary light',
            'Approved': 'badge-success light',
            'Rejected': 'badge-danger light',
            'On Hold': 'badge-warning light',
        };
        return classes[status] || 'badge-secondary light';
    };

    // Filter and slice data
    let displayedComplaints = [...complaints];
    if (filterType === 'Pending') {
        displayedComplaints = displayedComplaints.filter(c => !c.admin_decision || c.admin_decision === 'Pending');
    }
    
    const filteredComplaints = displayedComplaints.filter(c => 
        (c.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.category_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.id?.toString() || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.priority || '').toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => b.id - a.id);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentComplaints = filteredComplaints.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredComplaints.length / itemsPerPage);

    return (
        <div className="container-fluid">
            <style>
                {`
                    @media (max-width: 991px) {
                        .decision-header-container {
                            flex-direction: column !important;
                            align-items: flex-start !important;
                            gap: 15px !important;
                        }
                        .decision-controls-wrapper {
                            flex-direction: column !important;
                            width: 100% !important;
                            gap: 10px !important;
                        }
                        .decision-filter-btn {
                            width: 100% !important;
                        }
                        .decision-search-bar {
                            width: 100% !important;
                        }
                    }
                    .decision-table {
                        min-width: 850px !important;
                    }
                    .decision-table th, .decision-table td {
                        white-space: nowrap !important;
                    }
                `}
            </style>
            <div className="page-titles">
                <button 
                    onClick={() => navigate('/complaints')} 
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center decision-header-container">
                            <Card.Title className="mb-0">Complaint Final Decision List</Card.Title>
                            <div className="d-flex align-items-center gap-2 decision-controls-wrapper">
                                <button 
                                    className="btn decision-filter-btn"
                                    style={{
                                        backgroundColor: filterType === 'Pending' ? 'rgb(61, 53, 119)' : 'transparent',
                                        borderColor: 'rgb(61, 53, 119)',
                                        color: filterType === 'Pending' ? 'white' : 'rgb(61, 53, 119)',
                                        borderRadius: '10px',
                                        height: '34px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        fontSize: '13px',
                                        padding: '0 1rem'
                                    }}
                                    onClick={() => { setFilterType('Pending'); setCurrentPage(1); }}
                                >
                                    Requires Decision
                                </button>
                                <button 
                                    className="btn decision-filter-btn"
                                    style={{
                                        backgroundColor: filterType === 'All' ? 'rgb(61, 53, 119)' : 'transparent',
                                        borderColor: 'rgb(61, 53, 119)',
                                        color: filterType === 'All' ? 'white' : 'rgb(61, 53, 119)',
                                        borderRadius: '10px',
                                        height: '34px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        fontSize: '13px',
                                        padding: '0 1rem'
                                    }}
                                    onClick={() => { setFilterType('All'); setCurrentPage(1); }}
                                >
                                    All Records
                                </button>
                                <div className="decision-search-bar" style={{ width: '250px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search decisions..."
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <div className="table-responsive">
                                <table className="table table-responsive-md decision-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '60px' }}><strong>SL.NO</strong></th>
                                            <th><strong>COMPLAINT OVERVIEW</strong></th>
                                            <th><strong>CATEGORY</strong></th>
                                            {/* <th><strong>ROUTING PATTERN</strong></th> */}
                                            <th><strong>PRIORITY</strong></th>
                                            <th><strong>ADMIN STATUS</strong></th>
                                            <th className="text-end"><strong>ACTIONS</strong></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? <tr><td colSpan="7" className="text-center py-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div></td></tr> : 
                                            filteredComplaints.length === 0 ? <tr><td colSpan="7" className="text-center py-4 text-muted">No {filterType === 'Pending' ? 'pending decisions required.' : 'complaints found.'}</td></tr> :
                                            currentComplaints.map((item, index) => {
                                                const pClass = getPriorityBadgeClass(item.priority);
                                                const adClass = getAdminStatusBadgeClass(item.admin_decision || 'Pending');
                                                
                                                return (
                                                    <tr key={item.id}>
                                                        <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                                                        <td>
                                                            <div className="d-flex flex-column">
                                                                <strong>{item.title}</strong>
                                                                <small className="text-muted text-truncate" title={item.description}>
                                                                    {item.description.length > 45 ? `${item.description.substring(0, 45)}...` : item.description}
                                                                </small>
                                                            </div>
                                                        </td>
                                                        <td>{item.category_name}</td>
                                                        {/* <td>{item.pattern_name || '-'}</td> */}
                                                        <td>
                                                            <span className={`badge ${pClass}`}>
                                                                {item.priority}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className={`badge ${adClass}`}>
                                                                {item.admin_decision || 'Pending'}
                                                            </span>
                                                        </td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end">
                                                                <button 
                                                                    className="btn btn-outline-secondary btn-sm shadow" 
                                                                    style={{
                                                                        width: '28px',
                                                                        height: '28px',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        padding: '0',
                                                                        fontSize: '12px',
                                                                        borderRadius: '6px',
                                                                    }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        navigate(`/complaint-decision/${item.id}`);
                                                                    }}
                                                                >
                                                                    <i className="fa fa-eye"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                        })}
                                    </tbody>
                                </table>
                                {filteredComplaints.length > 0 && (
                                    <div className="d-flex align-items-center justify-content-between mt-3 mb-4">
                                        <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredComplaints.length)} of {filteredComplaints.length} entries
                                        </div>
                                        {totalPages > 1 && (
                                            <nav>
                                                <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                    <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                        <button type="button" className="page-link" onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.max(prev - 1, 1)); }} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
                                                            <i className="la la-angle-left" />
                                                        </button>
                                                    </li>
                                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNumber => {
                                                        if (
                                                            pageNumber === 1 ||
                                                            pageNumber === totalPages ||
                                                            (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                                                        ) {
                                                            return (
                                                                <li key={pageNumber} className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}>
                                                                    <button type="button" className="page-link" onClick={(e) => { e.stopPropagation(); setCurrentPage(pageNumber); }} style={{ border: 'none' }}>
                                                                        {pageNumber}
                                                                    </button>
                                                                </li>
                                                            );
                                                        } else if (
                                                            pageNumber === currentPage - 2 ||
                                                            pageNumber === currentPage + 2
                                                        ) {
                                                            return (
                                                                <li key={pageNumber} className="page-item disabled">
                                                                    <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                                </li>
                                                            );
                                                        }
                                                        return null;
                                                    })}
                                                    <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                        <button type="button" className="page-link" onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.min(prev + 1, totalPages)); }} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none' }}>
                                                            <i className="la la-angle-right" />
                                                        </button>
                                                    </li>
                                                </ul>
                                            </nav>
                                        )}
                                    </div>
                                )}
                            </div>
                        </Card.Body>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default ComplaintFinalDecisionList;
