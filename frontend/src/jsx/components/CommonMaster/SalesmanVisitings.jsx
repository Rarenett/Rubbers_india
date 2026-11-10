import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { navtoggle } from '../../../store/actions/AuthActions';
import swal from 'sweetalert';
import { Card, Button, Form, Modal } from 'react-bootstrap';
import Select from 'react-select';
import { AreaService } from '../../../services/AreaService';
import { usePageTitle } from '../../../context/TitleContext';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';
import axiosInstance from '../../../services/axiosInstance';

const SalesmanVisitings = () => {
    usePageTitle("Salesman Visitings");
    const dispatch = useDispatch();
    const sideMenu = useSelector(state => state.sideMenu);
    const sideMenuRef = useRef(sideMenu);
    const prevWidthRef = useRef(window.innerWidth);
    
    useEffect(() => {
        sideMenuRef.current = sideMenu;
    }, [sideMenu]);

    useEffect(() => {
        const handleResize = () => {
            const currentWidth = window.innerWidth;
            if (prevWidthRef.current > 1199 && currentWidth <= 1199) {
                if (sideMenuRef.current) {
                    dispatch(navtoggle());
                }
            }
            prevWidthRef.current = currentWidth;
        };

        if (window.innerWidth <= 1199 && sideMenuRef.current) {
            dispatch(navtoggle());
        }

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [dispatch]);
    const [visitings, setVisitings] = useState([]);
    const [mappings, setMappings] = useState([]);
    const [deliveryLocations, setDeliveryLocations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [locationsLoading, setLocationsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    // Auto-filled info for read-only display
    const [mappedArea, setMappedArea] = useState('');
    const [mappedDepartment, setMappedDepartment] = useState('');
    const [mappedReportingPerson, setMappedReportingPerson] = useState('');
    const [mappedTotalKm, setMappedTotalKm] = useState('');
    
    const [formData, setFormData] = useState({ 
        salesman_mapping: '', 
        delivery_locations: [], 
        visiting_date: '', 
        status: 'Planned', 
        remarks: '' 
    });

    const fetchVisitings = useCallback(async () => {
        setLoading(true);
        try {
            const res = await AreaService.getSalesmanVisitings();
            let rawData = res.results ?? res;
            setVisitings(Array.isArray(rawData) ? rawData : []);
        } catch (err) {
            console.error('Error fetching salesman visitings:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchMappings = useCallback(async () => {
        try {
            const res = await AreaService.getSalesmanMappings();
            let rawData = res.results ?? res;
            setMappings(Array.isArray(rawData) ? rawData : []);
        } catch (err) {
            console.error('Error fetching salesman mappings:', err);
        }
    }, []);

    useEffect(() => {
        fetchVisitings();
        fetchMappings();
    }, [fetchVisitings, fetchMappings]);

    const loadDeliveryLocations = useCallback(async (areaId) => {
        setLocationsLoading(true);
        try {
            const areaDetails = await AreaService.getAreaById(areaId);
            if (areaDetails && areaDetails.delivery_locations) {
                setDeliveryLocations(areaDetails.delivery_locations);
            } else {
                setDeliveryLocations([]);
            }
        } catch (err) {
            console.error('Error fetching delivery locations:', err);
            setDeliveryLocations([]);
        } finally {
            setLocationsLoading(false);
        }
    }, []);

    // Update read-only fields and fetch delivery locations when a mapping is selected
    useEffect(() => {
        const updateMappingDetails = async () => {
            if (!formData.salesman_mapping) {
                setMappedArea('');
                setMappedDepartment('');
                setMappedReportingPerson('');
                setMappedTotalKm('');
                setDeliveryLocations([]);
                return;
            }
            
            const selectedMapping = mappings.find(m => m.id.toString() === formData.salesman_mapping.toString());
            
            if (selectedMapping) {
                setMappedArea(selectedMapping.area_name || '');
                setMappedDepartment(selectedMapping.department_name || '');
                setMappedReportingPerson(selectedMapping.reporting_person_name || '');
                setMappedTotalKm(''); // Clear stale value before fetching new area data
                
                // Fetch delivery locations for this area
                if (selectedMapping.area) {
                    loadDeliveryLocations(selectedMapping.area);
                    try {
                        axiosInstance.get(`/api/area/geofence-history/?area=${selectedMapping.area}`)
                        .then(res => {
                            let dataArray = [];
                            if (Array.isArray(res.data)) {
                                dataArray = res.data;
                            } else if (res.data && Array.isArray(res.data.results)) {
                                dataArray = res.data.results;
                            }
                            
                            if (dataArray && dataArray.length > 0) {
                                let totalDist = dataArray[0].total_distance_km;
                                let polyDist = dataArray[0].polygon_distances;
                                
                                if (totalDist !== null && totalDist !== undefined && totalDist !== "") {
                                    setMappedTotalKm(`${parseFloat(totalDist).toFixed(2)} Km`);
                                } else if (polyDist) {
                                    if (typeof polyDist === 'string') {
                                        try { polyDist = JSON.parse(polyDist); } catch(e) { polyDist = []; }
                                    }
                                    if (Array.isArray(polyDist) && polyDist.length > 0) {
                                        const total = polyDist.reduce((sum, segment) => sum + (parseFloat(segment.distance_km) || 0), 0);
                                        setMappedTotalKm(`${total.toFixed(2)} Km`);
                                    } else {
                                        setMappedTotalKm('');
                                    }
                                } else {
                                    setMappedTotalKm('');
                                }
                            } else {
                                setMappedTotalKm('');
                            }
                        }).catch((err) => {
                            console.error("Area geofence fetch failed:", err);
                            setMappedTotalKm('');
                        });
                    } catch (e) {
                        setMappedTotalKm('');
                    }
                } else {
                    setDeliveryLocations([]);
                    setMappedTotalKm('');
                }
            }
        };
        
        updateMappingDetails();
    }, [formData.salesman_mapping, mappings]);



    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            // Reset delivery location if mapping changes
            if (name === 'salesman_mapping') {
                return { ...prev, [name]: value, delivery_locations: [] };
            }
            return { ...prev, [name]: value };
        });
    };

    const resetForm = () => {
        setFormData({ salesman_mapping: '', delivery_locations: [], visiting_date: '', status: 'Planned', remarks: '' });
        setMappedArea('');
        setMappedDepartment('');
        setMappedReportingPerson('');
        setMappedTotalKm('');
        setIsEditing(false);
        setSelectedGroup(null);
    };

    const handleAdd = () => {
        resetForm();
        setShowModal(true);
    };

    const handleEdit = (group) => {
        setFormData({
            salesman_mapping: group.salesman_mapping || '',
            delivery_locations: group.locations.map(loc => ({ value: loc.id, label: loc.location_name })),
            visiting_date: group.visiting_date || '',
            status: group.status || 'Planned',
            remarks: group.remarks || ''
        });
        setIsEditing(true);
        setSelectedGroup(group);
        setShowModal(true);
    };

    const handleDelete = (group) => {
        swal({
            title: "Are you sure?",
            text: "Once deleted, you will not be able to recover these records!",
            icon: "warning",
            buttons: true,
            dangerMode: true,
        }).then(async (willDelete) => {
            if (willDelete) {
                try {
                    for (const item of group.original_items) {
                        await AreaService.deleteSalesmanVisiting(item.id);
                    }
                    swal("Success", "Records deleted successfully", "success");
                    fetchVisitings();
                } catch (error) {
                    console.error('Error deleting record:', error);
                    swal("Error", "Failed to delete records.", "error");
                }
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (!formData.delivery_locations || formData.delivery_locations.length === 0) {
                swal("Error", "Please select at least one delivery location.", "error");
                return;
            }
            if (isEditing) {
                const existingItems = selectedGroup.original_items;
                const newLocationIds = formData.delivery_locations.map(s => s.value);
                
                const toDelete = existingItems.filter(e => !newLocationIds.includes(e.delivery_location));
                const existingLocationIds = existingItems.map(e => e.delivery_location);
                const toAdd = newLocationIds.filter(id => !existingLocationIds.includes(id));
                const toUpdate = existingItems.filter(e => newLocationIds.includes(e.delivery_location));
                
                for (const item of toDelete) {
                    await AreaService.deleteSalesmanVisiting(item.id);
                }
                
                for (const item of toUpdate) {
                    await AreaService.updateSalesmanVisiting(item.id, {
                        ...formData,
                        delivery_location: item.delivery_location
                    });
                }
                
                for (const locId of toAdd) {
                    await AreaService.createSalesmanVisiting({
                        ...formData,
                        delivery_location: locId
                    });
                }
                swal("Success", "Record updated successfully", "success");
            } else {
                for (const loc of formData.delivery_locations) {
                    await AreaService.createSalesmanVisiting({
                        ...formData,
                        delivery_location: loc.value
                    });
                }
                swal("Success", "Record(s) added successfully", "success");
            }
            setShowModal(false);
            resetForm();
            fetchVisitings();
        } catch (error) {
            console.error('Error submitting form:', error);
            if (error.response?.data) {
                let errorMsgs = [];
                Object.values(error.response.data).forEach(msgs => {
                    if (Array.isArray(msgs)) {
                        errorMsgs.push(...msgs);
                    } else if (typeof msgs === 'string') {
                        errorMsgs.push(msgs);
                    }
                });
                swal("Error", errorMsgs.join('\n') || "Failed to submit. Please check inputs.", "error");
            } else {
                swal("Error", "An unexpected error occurred.", "error");
            }
        }
    };

    const groupedVisitings = Object.values(visitings.reduce((acc, item) => {
        const key = `${item.salesman_mapping}_${item.visiting_date}`;
        if (!acc[key]) {
            acc[key] = {
                group_key: key,
                salesman_mapping: item.salesman_mapping,
                salesman_name: item.salesman_name,
                area_name: item.area_name,
                visiting_date: item.visiting_date,
                status: item.status,
                remarks: item.remarks,
                locations: [],
                original_items: []
            };
        }
        acc[key].locations.push({
            id: item.delivery_location,
            location_name: item.delivery_location_name,
            visiting_id: item.id
        });
        acc[key].original_items.push(item);
        return acc;
    }, {}));

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const filteredVisitings = groupedVisitings.filter(group => {
        const salesmanName = group.salesman_name?.toLowerCase() || '';
        const areaName = group.area_name?.toLowerCase() || '';
        const locNames = group.locations.map(l => l.location_name?.toLowerCase() || '').join(' ');
        const statusStr = group.status?.toLowerCase() || '';
        const term = searchTerm.toLowerCase();
        
        return salesmanName.includes(term) || areaName.includes(term) || locNames.includes(term) || statusStr.includes(term);
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentVisitings = filteredVisitings.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredVisitings.length / itemsPerPage);

    const customSelectStyles = {
        control: (base, state) => ({
            ...base,
            border: state.isFocused ? '1px solid #0a500f' : '1px solid #cbd5e1',
            borderRadius: '10px',
            fontSize: '13px',
            color: '#334155',
            backgroundColor: '#fff',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15, 0.15)' : 'none',
            minHeight: '43px',
            '&:hover': {
                border: state.isFocused ? '1px solid #0a500f' : '1px solid #cbd5e1'
            }
        }),
        valueContainer: (base) => ({
            ...base,
            padding: '2px 8px',
        }),
        dropdownIndicator: (base) => ({
            ...base,
            padding: '4px 8px',
            color: '#6e7e8f'
        }),
        clearIndicator: (base) => ({
            ...base,
            padding: '4px'
        }),
        multiValue: (base) => ({
            ...base,
            backgroundColor: '#f1f5f9',
            borderRadius: '6px'
        }),
        multiValueLabel: (base) => ({
            ...base,
            color: '#334155',
            fontSize: '12px',
            padding: '3px 6px'
        }),
        multiValueRemove: (base) => ({
            ...base,
            color: '#64748b',
            ':hover': {
                backgroundColor: '#cbd5e1',
                color: '#334155'
            }
        }),
        menu: (base) => ({
            ...base,
            borderRadius: '10px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            marginTop: '4px',
            zIndex: 9999
        }),
        option: (base, state) => ({
            ...base,
            fontSize: '13px',
            padding: '10px 14px',
            backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? '#f8fafc' : 'white',
            color: state.isSelected ? 'white' : '#334155',
            cursor: 'pointer',
            '&:active': {
                backgroundColor: '#073d0b'
            }
        })
    };

    return (
        <div className="container-fluid">
            <div className="page-titles">
                <button
                    onClick={() => window.history.back()}
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>

            <Card className="w-100 overflow-hidden">
                <Card.Header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 flex-wrap">
                    <Card.Title className="mb-0 text-nowrap">Salesman Visitings</Card.Title>
                    <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 flex-grow-1 justify-content-md-end">
                        <div className="search-bar-container w-100" style={{ margin: 0, maxWidth: '250px' }}>
                            <span className="search-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </span>
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Search visitings..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                            <CreateButton 
                                module="salesman_visitings" 
                                onClick={handleAdd}
                                className="d-flex align-items-center justify-content-center btn btn-primary"
                                style={{ height: '38px', borderRadius: '6px', padding: '0 16px', whiteSpace: 'nowrap' }}
                            >
                                Add Visiting
                            </CreateButton>
                        </div>
                    </div>
                </Card.Header>
                <Card.Body style={{ minWidth: 0 }}>
                    <div className="table-responsive w-100">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th><strong>SL NO</strong></th>
                                    <th><strong>SALESMAN</strong></th>
                                    <th><strong>AREA</strong></th>
                                    <th><strong>DATE</strong></th>
                                    <th><strong>STATUS</strong></th>
                                    <th><strong>REMARKS</strong></th>
                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="7" className="text-center py-4">Loading...</td></tr>
                                ) : filteredVisitings.length === 0 ? (
                                    <tr><td colSpan="7" className="text-center py-4 text-muted">No visitings found.</td></tr>
                                ) : (
                                    currentVisitings.map((group, index) => (
                                        <tr key={group.group_key}>
                                            <td className="fw-bold text-primary">{indexOfFirstItem + index + 1}</td>
                                            <td className="fw-bold">{group.salesman_name || 'N/A'}</td>
                                            <td className="fw-bold">{group.area_name || 'N/A'}</td>
                                            <td className="text-muted">{group.visiting_date ? group.visiting_date.split('-').reverse().join('-') : '-'}</td>
                                            <td>
                                                <span className={`badge light badge-${group.status === 'Completed' ? 'success' : group.status === 'Cancelled' ? 'danger' : 'warning'}`}>
                                                    {group.status}
                                                </span>
                                            </td>
                                            <td className="text-muted">{group.remarks || '-'}</td>
                                            <td className="text-end">
                                                <div className="d-flex justify-content-end gap-2">
                                                    <EditButton
                                                        module="salesman_visitings"
                                                        onClick={() => handleEdit(group)}
                                                        className="sharp btn-xs"
                                                    />
                                                    <DeleteButton
                                                        module="salesman_visitings"
                                                        onClick={() => handleDelete(group)}
                                                        className="sharp btn-xs"
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {filteredVisitings.length > 0 && (
                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredVisitings.length)} of {filteredVisitings.length} entries
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

            <Modal show={showModal} onHide={() => setShowModal(false)} centered dialogClassName="pkg-custom-modal" backdrop="static">
                <style>{`
                    .pkg-custom-modal .modal-content { border-radius: 16px !important; border: none !important; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important; overflow: hidden; }
                    .pkg-custom-modal .modal-header-custom { display: flex; align-items: center; justify-content: space-between; padding: 24px 28px 16px 28px; border-bottom: 1px solid #f1f5f9; }
                    .pkg-custom-modal .modal-icon-circle { width: 48px; height: 48px; background-color: #0a500f; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2); }
                    .pkg-custom-modal .modal-close-x { border: none; background: transparent; font-size: 24px; color: #aaa; cursor: pointer; transition: color 0.2s; display: flex; align-items: center; justify-content: center; padding: 4px; }
                    .pkg-custom-modal .modal-close-x:hover { color: #555; }
                    .pkg-custom-modal .modal-body-custom { padding: 24px 28px; max-height: 70vh; overflow-y: auto; }
                    .pkg-custom-modal .modal-footer-custom { display: flex; align-items: center; justify-content: flex-end; padding: 20px 28px 24px 28px; border-top: 1px solid #f1f5f9; background-color: #fafbfc; gap: 12px; }
                    .pkg-custom-modal .form-label-custom { font-size: 13px; font-weight: 500; color: #4a5568; margin-bottom: 6px; }
                    .pkg-custom-modal .form-control-custom { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #334155; background-color: #fff; transition: border-color 0.2s, box-shadow 0.2s; width: 100%; }
                    .pkg-custom-modal .form-control-custom:focus { outline: none; border-color: #0a500f; box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15); }
                    .pkg-custom-modal .btn-close-custom { background-color: #dc3545 !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; transition: background-color 0.2s, transform 0.1s; }
                    .pkg-custom-modal .btn-close-custom:hover { background-color: #bb2d3b !important; }
                    .pkg-custom-modal .btn-save-custom { background-color: #0a500f !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; transition: background-color 0.2s, transform 0.1s; }
                    .pkg-custom-modal .btn-save-custom:hover { background-color: #073d0b !important; }
                `}</style>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                <line x1="12" y1="22.08" x2="12" y2="12"></line>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {isEditing ? 'Edit Salesman Visiting' : 'Add Salesman Visiting'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                {isEditing ? 'Update visiting details' : 'Enter details to add a new visiting schedule'}
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowModal(false)}>
                        &times;
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-12 col-md-6 mb-3">
                                <label className="form-label-custom">Salesman <span className="text-danger">*</span></label>
                                <Form.Select
                                    name="salesman_mapping"
                                    value={formData.salesman_mapping}
                                    onChange={handleInputChange}
                                    required
                                    className="form-control-custom"
                                >
                                    <option value="">Select Salesman</option>
                                    {mappings.map(map => (
                                        <option key={map.id} value={map.id}>
                                            {map.employee_name}
                                        </option>
                                    ))}
                                </Form.Select>
                            </div>
                            
                            <div className="col-12 col-md-6 mb-3">
                                <label className="form-label-custom">Area</label>
                                <input type="text" className="form-control-custom" value={mappedArea} readOnly disabled />
                            </div>
                            
                            <div className="col-12 col-md-6 mb-3">
                                <label className="form-label-custom">Department</label>
                                <input type="text" className="form-control-custom" value={mappedDepartment} readOnly disabled />
                            </div>
                            
                            <div className="col-12 col-md-6 mb-3">
                                <label className="form-label-custom">Reporting Person</label>
                                <input type="text" className="form-control-custom" value={mappedReportingPerson} readOnly disabled />
                            </div>
                        </div>

                        <div className="row salesman-layout-wrapper">
                            <style>{`
                                @media (max-width: 767px) {
                                    .salesman-layout-wrapper {
                                        display: flex !important;
                                        flex-direction: column !important;
                                    }
                                    .mobile-contents {
                                        display: contents !important;
                                    }
                                    .mob-order-1 { order: 1; }
                                    .mob-order-2 { order: 2; }
                                    .mob-order-3 { order: 3; }
                                    .mob-order-4 { order: 4; }
                                }
                            `}</style>
                            <div className="col-12 col-md-6 mobile-contents">
                                <div className="mb-3 mob-order-1">
                                    <label className="form-label-custom">Delivery Location <span className="text-danger">*</span></label>
                                    <Select
                                        isMulti
                                        classNamePrefix="react-select"
                                        value={formData.delivery_locations}
                                        onChange={(selected) => {
                                            if (selected && selected.find(opt => opt.value === 'select_all')) {
                                                setFormData({ ...formData, delivery_locations: deliveryLocations.map(loc => ({ value: loc.id, label: loc.location_name })) });
                                            } else {
                                                setFormData({ ...formData, delivery_locations: selected || [] });
                                            }
                                        }}
                                        options={deliveryLocations.length > 0 ? [{ value: 'select_all', label: '--- Select All ---' }, ...deliveryLocations.map(loc => ({ value: loc.id, label: loc.location_name }))] : []}
                                        placeholder={!formData.salesman_mapping ? 'Select Salesman First' : locationsLoading ? 'Loading locations...' : 'Select Location(s)...'}
                                        styles={customSelectStyles}
                                        isDisabled={!formData.salesman_mapping || locationsLoading || deliveryLocations.length === 0}
                                    />
                                    {formData.salesman_mapping && !locationsLoading && deliveryLocations.length === 0 && (
                                        <small className="text-danger d-block mt-1">
                                            No delivery locations have been created for {mappedArea}. Please add delivery locations in Area Creation.
                                        </small>
                                    )}
                                </div>
                                <div className="mb-3 mob-order-3">
                                    <label className="form-label-custom">Status <span className="text-danger">*</span></label>
                                    <Form.Select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleInputChange}
                                        required
                                        className="form-control-custom"
                                    >
                                        <option value="Planned">Planned</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </Form.Select>
                                </div>
                            </div>

                            <div className="col-12 col-md-6 mobile-contents">
                                <div className="mb-3 mob-order-2">
                                    <label className="form-label-custom">Visiting Date <span className="text-danger">*</span></label>
                                    <input
                                        type="date"
                                        name="visiting_date"
                                        value={formData.visiting_date}
                                        onChange={handleInputChange}
                                        required
                                        className="form-control-custom"
                                    />
                                </div>
                                <div className="mb-3 mob-order-4">
                                    <label className="form-label-custom">Total Km</label>
                                    <input type="text" className="form-control-custom" value={mappedTotalKm} readOnly disabled />
                                </div>
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-12 col-md-12 mb-3">
                                <label className="form-label-custom">Remarks</label>
                                <textarea
                                    rows="3"
                                    name="remarks"
                                    value={formData.remarks}
                                    onChange={handleInputChange}
                                    className="form-control-custom"
                                ></textarea>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={() => setShowModal(false)}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-save-custom">
                            Save
                        </button>
                    </div>
                </form>
            </Modal>

        </div>
    );
};

export default SalesmanVisitings;
