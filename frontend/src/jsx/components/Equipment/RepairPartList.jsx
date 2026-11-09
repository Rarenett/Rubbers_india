import React, { useState, useEffect, Fragment } from 'react';
import { Card, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { getRepairParts, deleteRepairPart, getRepairRequests } from '../../../services/MachineManagementService';
import CreateButton from '../../../components/permissions/CreateButton';
import swal from 'sweetalert';

const RepairPartList = ({ refreshTrigger }) => {
    const [repairPartsList, setRepairPartsList] = useState([]);
    const [repairRequests, setRepairRequests] = useState([]);
    const [showUndefinedSection, setShowUndefinedSection] = useState(true);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const navigate = useNavigate();

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const fetchRepairPartsList = async () => {
        try {
            setLoading(true);
            const [partsList, reqsList] = await Promise.all([
                getRepairParts(),
                getRepairRequests()
            ]);
            setRepairPartsList(partsList.results || partsList);
            setRepairRequests(reqsList);
        } catch (err) {
            console.error("Error fetching data in RepairPartList", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRepairPartsList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshTrigger]);

    const handleDelete = (id) => {
        swal({
            title: "Are you sure?",
            text: "Once deleted, you will not be able to recover this repair part!",
            icon: "warning",
            buttons: true,
            dangerMode: true,
        })
        .then(async (willDelete) => {
            if (willDelete) {
                try {
                    await deleteRepairPart(id);
                    swal("Deleted!", "Your repair part has been deleted.", "success");
                    setRepairPartsList(prev => prev.filter(part => part.id !== id));
                } catch (err) {
                    swal("Error", "Failed to delete repair part.", "error");
                }
            }
        });
    };

    const handleEdit = (part) => {
        navigate('/repair-part', { state: { editData: part } });
    };

    const filteredParts = repairPartsList.filter(item => {
        const searchStr = `${item.part_name || ''} ${item.part_code || ''} ${item.typename_name || ''} ${item.machine_name || item.vehicle_name || ''} ${item.pattern_type || ''}`.toLowerCase();
        return searchStr.includes(searchTerm.toLowerCase());
    }).sort((a, b) => {
        const typeA = (a.typename_name || a.typename || '').toLowerCase();
        const typeB = (b.typename_name || b.typename || '').toLowerCase();
        if (typeA !== typeB) return typeA.localeCompare(typeB);
        
        // Secondary sort by part name just in case
        const nameA = (a.part_name || '').toLowerCase();
        const nameB = (b.part_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredParts.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredParts.length / itemsPerPage);

    const undefinedRequests = repairRequests.filter(req => !req.is_defined);

    return (
        <Fragment>
            {/* <div className="page-titles">
                <button 
                    onClick={() => window.history.back()} 
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div> */}

            {undefinedRequests.length > 0 && (
                <Card className="mb-4 shadow-sm" style={{ borderLeft: '4px solid #ffaa00', borderRadius: '8px' }}>
                    <Card.Header className="d-flex justify-content-between align-items-center py-2" style={{ backgroundColor: '#fff9eb', borderBottom: '1px solid #ffeeba' }}>
                        <div className="d-flex align-items-center gap-2">
                            <span style={{ fontSize: '18px' }}>⚠️</span>
                            <div>
                                <strong style={{ color: '#856404', fontSize: '14px' }}>
                                    Pending Definitions Required
                                </strong>
                                <div className="text-muted" style={{ fontSize: '12px' }}>
                                    There are {undefinedRequests.length} repair requests for items without active definition routing patterns.
                                </div>
                            </div>
                        </div>
                        <button 
                            className="btn btn-outline-warning btn-xs"
                            onClick={() => setShowUndefinedSection(!showUndefinedSection)}
                            style={{ borderRadius: '6px', fontSize: '11px', color: '#856404', borderColor: '#ffc107' }}
                        >
                            {showUndefinedSection ? 'Hide Details' : 'Show Details'}
                        </button>
                    </Card.Header>
                    {showUndefinedSection && (
                        <Card.Body className="p-0">
                            <div className="table-responsive">
                                <table className="table table-sm mb-0" style={{ fontSize: '12px' }}>
                                    <thead style={{ backgroundColor: '#fdf5e2' }}>
                                        <tr>
                                            <th className="ps-3"><strong>REQ ID</strong></th>
                                            <th><strong>MACHINE / VEHICLE</strong></th>
                                            <th><strong>COMPLAINT NOTES</strong></th>
                                            <th><strong>POSTED BY</strong></th>
                                            <th className="text-end pe-3"><strong>ACTION</strong></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {undefinedRequests.map(req => (
                                            <tr key={req.id}>
                                                <td className="ps-3">#{req.id}</td>
                                                <td>
                                                    <strong>{req.part_details}</strong>
                                                    <div className="text-muted" style={{ fontSize: '10px' }}>
                                                        Entry: {req.entry_date || '-'} | Due: {req.duedate || '-'}
                                                    </div>
                                                </td>
                                                <td>{req.notes || 'No notes provided'}</td>
                                                <td>{req.created_by_name || 'System'}</td>
                                                <td className="text-end pe-3">
                                                    <button 
                                                        className="btn btn-warning btn-xs py-1 px-2 font-weight-bold"
                                                        style={{ borderRadius: '4px', fontSize: '11px', color: '#fff', backgroundColor: '#ff9800', borderColor: '#ff9800' }}
                                                        onClick={() => navigate('/repair-part', { 
                                                            state: { prefilledMachineId: req.part } 
                                                        })}
                                                    >
                                                        Create Definition
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card.Body>
                    )}
                </Card>
            )}

            <div className="container-fluid">
                <div className="row">
                    <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title className="mb-0">Part List</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Repair Parts..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '35px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                
                                <CreateButton
                                    module="spareparts"
                                    onClick={() => navigate('/repair-part')}
                                >
                                    Repair Part
                                </CreateButton>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-responsive-md">
                                        <thead>
                                            <tr>
                                                <th><strong>TYPE NAME</strong></th>
                                                <th><strong>MACHINE/VEHICLE</strong></th>
                                                <th><strong>CATEGORY</strong></th>
                                                <th><strong>SUBCATEGORY</strong></th>
                                                <th><strong>PART NAME</strong></th>
                                                <th><strong>PART CODE</strong></th>
                                                <th><strong>CUTOFF DAYS</strong></th>
                                                <th><strong>PATTERN TYPE</strong></th>
                                                <th><strong>ACTION</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentItems.length > 0 ? (
                                                currentItems.map(part => (
                                                    <tr key={part.id}>
                                                        <td>{part.typename_name || part.typename || '-'}</td>
                                                        <td>{part.machine_name || part.vehicle_name || '-'}</td>
                                                        <td>{part.category_name || part.category || '-'}</td>
                                                        <td>{part.subcategory_name || part.subcategory || '-'}</td>
                                                        <td><strong>{part.part_name}</strong></td>
                                                        <td>{part.part_code}</td>
                                                        <td>{part.cutoff_days || 0}</td>
                                                        <td>{part.pattern_type}</td>
                                                        <td>
                                                            <div className="d-flex">
                                                                <button className="btn btn-outline-success shadow btn-xs sharp me-1" title="Edit" onClick={() => handleEdit(part)}>
                                                                    <i className="fas fa-pencil-alt"></i>
                                                                </button>
                                                                <button className="btn btn-outline-danger shadow btn-xs sharp" title="Delete" onClick={() => handleDelete(part.id)}>
                                                                    <i className="fas fa-trash"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="9" className="text-center py-4 text-muted">
                                                        No repair parts found
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {!loading && filteredParts.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredParts.length)} of {filteredParts.length} entries
                                    </div>
                                    {totalPages > 1 && (
                                    <nav>
                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                            <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
                                                    <i className="la la-angle-left" />
                                                </button>
                                            </li>
                                            {Array.from({ length: totalPages }, (_, index) => {
                                                const pageNumber = index + 1;
                                                if (
                                                    pageNumber === 1 ||
                                                    pageNumber === totalPages ||
                                                    (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                                                ) {
                                                    return (
                                                        <li key={pageNumber} className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setCurrentPage(pageNumber)} style={{ border: 'none' }}>
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
                                                <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none' }}>
                                                    <i className="la la-angle-right" />
                                                </button>
                                            </li>
                                        </ul>
                                    </nav>
                                    )}
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                    </div>
                </div>
            </div>
        </Fragment>
    );
};

export default RepairPartList;