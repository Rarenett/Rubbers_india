import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Card, Table, Form, Button, Modal } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import { 
    getDepartmentDesignations, 
    getCandidates, 
    getUsers, 
    updateCandidateInterview 
} from '../../../../services/HRManagementService';
import { fetchBranches, fetchFactories } from '../../../../services/CompanyService';
import { usePageTitle } from '../../../../context/TitleContext';

const ScheduleInterview = () => {
    const [designations, setDesignations] = useState([]);
    const [selectedDesignation, setSelectedDesignation] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [interviewers, setInterviewers] = useState([]);
    const [loading, setLoading] = useState(false);
    
    usePageTitle("Schedule Interviews");

    // State to hold unsaved changes per candidate { [candidateId]: { interview_date, interviewer, status, branch_id, factory_id } }
    const [interviewData, setInterviewData] = useState({});
    const [selectedCandidates, setSelectedCandidates] = useState([]);

    const [showPopup, setShowPopup] = useState(false);
    const [currentCandidateId, setCurrentCandidateId] = useState(null);
    const [branches, setBranches] = useState([]);
    const [factories, setFactories] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState(null);
    const [selectedFactory, setSelectedFactory] = useState(null);

    const branchSelectRef = useRef(null);
    const factorySelectRef = useRef(null);
    const saveBtnRef = useRef(null);

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '42px',
            borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15,0.15)' : 'none',
            '&:hover': { borderColor: '#0a500f' },
            borderRadius: '10px',
            fontSize: '13px',
            color: '#334155',
            backgroundColor: '#fff',
        }),
        menu: base => ({ ...base, zIndex: 99999, fontSize: '13px' }),
        menuPortal: base => ({ ...base, zIndex: 99999 }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? '#f0fdf4' : 'white',
            color: state.isSelected ? 'white' : '#334155',
            cursor: 'pointer',
        }),
        placeholder: base => ({ ...base, color: '#94a3b8' }),
    };

    useEffect(() => {
        fetchDesignations();
        fetchInterviewers();
        fetchBranchesData();
    }, []);

    useEffect(() => {
        if (showPopup) {
            setTimeout(() => {
                if (branchSelectRef.current) {
                    branchSelectRef.current.focus();
                }
            }, 100);
        }
    }, [showPopup]);

    useEffect(() => {
        const fetchFactoriesData = async () => {
            try {
                const params = selectedBranch ? { branch: selectedBranch.value } : {};
                const res = await fetchFactories(params);
                const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
                setFactories(data.map(f => ({ value: f.id, label: f.name })));
                
                // If the selected factory is not in the new list, clear it
                if (selectedFactory) {
                    const exists = data.some(f => f.id === selectedFactory.value);
                    if (!exists) setSelectedFactory(null);
                }
            } catch (error) {
                console.error('Failed to fetch factories', error);
            }
        };
        fetchFactoriesData();
    }, [selectedBranch]);

    const fetchBranchesData = async () => {
        try {
            const res = await fetchBranches();
            const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            setBranches(data.map(b => ({ value: b.id, label: b.name })));
        } catch (error) {
            console.error('Failed to fetch branches', error);
        }
    };

    const fetchDesignations = async () => {
        try {
            const data = await getDepartmentDesignations();
            // Use dd.id (unique DeptDesignation PK) as value so React Select never
            // highlights two options that share the same designation FK id.
            const options = data
                .filter(dd => dd.designation_name && dd.department_name)
                .map(dd => ({
                    value: dd.id,                  // unique DepartmentDesignation id
                    designationId: dd.designation, // designation FK (position_applied filter)
                    departmentId: dd.department,   // department FK (department_applied filter)
                    label: `${dd.designation_name} - ${dd.department_name}`,
                }))
                .sort((a, b) => a.label.localeCompare(b.label));
            setDesignations(options);
        } catch (error) {
            console.error('Failed to fetch department-designations', error);
        }
    };

    const fetchInterviewers = async () => {
        try {
            const data = await getUsers();
            const options = data.map(u => ({ 
                value: u.id, 
                label: u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.email 
            })).sort((a, b) => a.label.localeCompare(b.label));
            setInterviewers(options);
        } catch (error) {
            console.error('Failed to fetch interviewers', error);
        }
    };

    const fetchCandidates = async (designationId, departmentId) => {
        if (!designationId) {
            setCandidates([]);
            return;
        }
        setLoading(true);
        try {
            const data = await getCandidates(null, false, designationId, departmentId);
            setCandidates(data);
            
            // Initialize interview data state
            const initialData = {};
            data.forEach(c => {
                initialData[c.id] = {
                    interview_date: c.interview_date ? new Date(c.interview_date).toISOString().slice(0, 16) : '',
                    interviewer: c.interviewer ? interviewers.find(i => i.value === c.interviewer) : null,
                    status: c.status || 'Pending'
                };
            });
            setInterviewData(initialData);
        } catch (error) {
            Swal.fire('Error', 'Failed to fetch candidates', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDesignationChange = (selectedOption) => {
        setSelectedDesignation(selectedOption);
        fetchCandidates(selectedOption?.designationId, selectedOption?.departmentId);
    };

    const handleDateChange = (candidateId, dateStr) => {
        setInterviewData(prev => ({
            ...prev,
            [candidateId]: { ...prev[candidateId], interview_date: dateStr }
        }));
    };

    const handleInterviewerChange = (candidateId, selectedOption) => {
        setInterviewData(prev => ({
            ...prev,
            [candidateId]: { ...prev[candidateId], interviewer: selectedOption }
        }));
    };

    const handleStatusChange = (candidateId, newStatus) => {
        if (newStatus === 'Selected') {
            setCurrentCandidateId(candidateId);
            setSelectedBranch(null);
            setSelectedFactory(null);
            setShowPopup(true);
        } else {
            setInterviewData(prev => ({
                ...prev,
                [candidateId]: { ...prev[candidateId], status: newStatus }
            }));
        }
    };

    const handleBranchChange = (opt) => {
        setSelectedBranch(opt);
        if (opt && opt.value !== '') {
            setTimeout(() => {
                if (factorySelectRef.current) {
                    factorySelectRef.current.focus();
                }
            }, 50);
        }
    };

    const handleFactoryChange = (opt) => {
        setSelectedFactory(opt);
    };

    const handleBranchKeyDown = (e) => {
        if (e.key === 'Enter') {
            const menuOpen = !!document.querySelector('.react-select__menu');
            if (!menuOpen) {
                e.preventDefault();
                if (factorySelectRef.current) {
                    factorySelectRef.current.focus();
                }
            }
        }
    };

    const handleFactoryKeyDown = (e) => {
        if (e.key === 'Enter') {
            const menuOpen = !!document.querySelector('.react-select__menu');
            if (!menuOpen) {
                e.preventDefault();
                handleConfirmSelection();
            }
        }
    };

    const handleConfirmSelection = () => {
        if (!selectedBranch || selectedBranch.value === '' || !selectedFactory || selectedFactory.value === '') {
            Swal.fire('Warning', 'Please select both Branch and Factory.', 'warning');
            return;
        }
        setInterviewData(prev => ({
            ...prev,
            [currentCandidateId]: { 
                ...prev[currentCandidateId], 
                status: 'Selected',
                branch_id: selectedBranch.value,
                factory_id: selectedFactory.value
            }
        }));
        setShowPopup(false);
        setCurrentCandidateId(null);
    };

    const handleCancelSelection = () => {
        setShowPopup(false);
        setCurrentCandidateId(null);
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedCandidates(candidates.map(c => c.id));
        } else {
            setSelectedCandidates([]);
        }
    };

    const handleSelectCandidate = (id) => {
        setSelectedCandidates(prev => 
            prev.includes(id) ? prev.filter(candId => candId !== id) : [...prev, id]
        );
    };

    const handleSaveSelected = async () => {
        if (selectedCandidates.length === 0) {
            Swal.fire('Warning', 'Please select at least one candidate.', 'warning');
            return;
        }

        const validSchedules = [];
        for (const candidateId of selectedCandidates) {
            const data = interviewData[candidateId];
            if (!data || !data.interview_date || !data.interviewer) {
                Swal.fire('Warning', 'Please select both Date/Time and Interviewer for all selected candidates.', 'warning');
                return;
            }
            validSchedules.push({
                id: candidateId,
                data: {
                    interview_date: new Date(data.interview_date).toISOString(),
                    interviewer: data.interviewer.value,
                    status: data.status,
                    ...(data.branch_id && { branch_id: data.branch_id }),
                    ...(data.factory_id && { factory_id: data.factory_id })
                }
            });
        }
        
        try {
            await Promise.all(
                validSchedules.map(schedule => 
                    updateCandidateInterview(schedule.id, schedule.data)
                )
            );
            Swal.fire('Success', 'Interviews scheduled successfully', 'success');
            setSelectedCandidates([]);
            // Re-fetch to confirm changes
            fetchCandidates(selectedDesignation?.value);
        } catch (error) {
            Swal.fire('Error', 'Failed to schedule interviews', 'error');
        }
    };

    const handleApplyToAll = (sourceId) => {
        const sourceData = interviewData[sourceId];
        if (!sourceData || !sourceData.interview_date || !sourceData.interviewer) {
            Swal.fire('Warning', 'Please select both Date/Time and Interviewer before applying to all.', 'warning');
            return;
        }

        Swal.fire({
            title: 'Apply to All?',
            text: 'This will copy this row\'s date, time, and interviewer to all other candidates in the list. Are you sure?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, apply to all',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
        }).then((result) => {
            if (result.isConfirmed) {
                const newData = { ...interviewData };
                candidates.forEach(c => {
                    newData[c.id] = {
                        ...newData[c.id],
                        interview_date: sourceData.interview_date,
                        interviewer: sourceData.interviewer,
                        status: sourceData.status
                    };
                });
                setInterviewData(newData);
                
                // Automatically select all so they are ready to save
                setSelectedCandidates(candidates.map(c => c.id));
                
                Swal.fire({
                    title: 'Applied',
                    text: 'The date, time, and interviewer have been applied to all candidates. Please click "Save Selected" to confirm.',
                    icon: 'success',
                    timer: 2500
                });
            }
        });
    };
    

    return (
        <div className="container-fluid">

            <Card>
                <Card.Header className="d-flex justify-content-between align-items-center flex-wrap">
                    <Card.Title className="mb-0">Schedule Interviews</Card.Title>
                    {candidates.length > 0 && selectedCandidates.length > 0 && (
                        <Button variant="primary" onClick={handleSaveSelected}>
                            <i className="fa fa-save me-2"></i> Save Selected
                        </Button>
                    )}
                </Card.Header>
                <Card.Body>
                    <div className="mb-4" style={{ maxWidth: '400px' }}>
                        <Form.Label className="fw-bold">Select Position Applied (Designation)</Form.Label>
                        <Select
                            options={designations}
                            value={selectedDesignation}
                            onChange={handleDesignationChange}
                            placeholder="Select Designation..."
                            isClearable
                        />
                    </div>

                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    ) : selectedDesignation && candidates.length === 0 ? (
                        <div className="text-center py-4 text-muted">
                            No candidates found for this position.
                        </div>
                    ) : candidates.length > 0 ? (
                        <div className="table-responsive" style={{ minHeight: '300px' }}>
                            <Table bordered hover className="align-middle">
                                <thead className="table-light">
                                    <tr>
                                        <th style={{ width: '50px' }}>
                                            <Form.Check 
                                                type="checkbox" 
                                                onChange={handleSelectAll} 
                                                checked={candidates.length > 0 && selectedCandidates.length === candidates.length} 
                                            />
                                        </th>
                                        <th>Candidate Details</th>
                                        <th style={{ width: '220px' }}>Interview Date & Time</th>
                                        <th style={{ width: '220px' }}>Interviewer</th>
                                        <th style={{ width: '150px' }}>Status</th>
                                        <th style={{ width: '80px', textAlign: 'center' }} title="Apply to all candidates">Copy</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {candidates.map(candidate => (
                                        <tr key={candidate.id}>
                                            <td>
                                                <Form.Check 
                                                    type="checkbox" 
                                                    checked={selectedCandidates.includes(candidate.id)} 
                                                    onChange={() => handleSelectCandidate(candidate.id)} 
                                                />
                                            </td>
                                            <td>
                                                <div className="d-flex align-items-center">
                                                    {candidate.photo_url ? (
                                                        <img src={candidate.photo_url} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} className="me-3" />
                                                    ) : (
                                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', color: '#64748b' }} className="me-3">
                                                            <i className="fa fa-user"></i>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <h6 className="mb-0 fw-bold">{candidate.full_name}</h6>
                                                        <small className="text-muted">{candidate.email} | {candidate.mobile_number}</small>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <Form.Control
                                                    type="datetime-local"
                                                    value={interviewData[candidate.id]?.interview_date || ''}
                                                    onChange={(e) => handleDateChange(candidate.id, e.target.value)}
                                                    min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                                                />
                                            </td>
                                            <td>
                                                <Select
                                                    options={interviewers}
                                                    value={interviewData[candidate.id]?.interviewer || null}
                                                    onChange={(selected) => handleInterviewerChange(candidate.id, selected)}
                                                    placeholder="Select..."
                                                    menuPortalTarget={document.body}
                                                    styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                                                />
                                            </td>
                                            <td>
                                                <Form.Select 
                                                    value={interviewData[candidate.id]?.status || 'Pending'}
                                                    onChange={(e) => handleStatusChange(candidate.id, e.target.value)}
                                                >
                                                    <option value="Pending">Pending</option>
                                                    <option value="Selected">Selected</option>
                                                    <option value="Rejected">Rejected</option>
                                                    <option value="Waitlisted">Waitlisted</option>
                                                    <option value="Resigned">Resigned</option>
                                                </Form.Select>
                                            </td>
                                            <td className="text-center align-middle">
                                                <Button 
                                                    variant="outline-primary" 
                                                    size="sm"
                                                    onClick={() => handleApplyToAll(candidate.id)}
                                                    title="Apply this date, time and interviewer to all candidates"
                                                >
                                                    <i className="fa fa-copy"></i>
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    ) : null}
                </Card.Body>
            </Card>

            <Modal 
                show={showPopup} 
                onHide={handleCancelSelection} 
                centered 
                dialogClassName="cfm-modal item-custom-modal"
            >
                <style>{`
                    .cfm-modal .modal-header-custom {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 24px 28px 16px 28px;
                        border-bottom: 1px solid #f1f5f9;
                    }
                    .cfm-modal .modal-icon-circle {
                        width: 48px;
                        height: 48px;
                        background-color: #0a500f;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                    }
                    .cfm-modal .modal-close-x {
                        border: none;
                        background: transparent;
                        font-size: 24px;
                        color: #aaa;
                        cursor: pointer;
                        transition: color 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 4px;
                    }
                    .cfm-modal .modal-close-x:hover { color: #555; }
                    .cfm-modal .modal-body-custom { padding: 24px 28px; }
                    .cfm-modal .modal-footer-custom {
                        display: flex;
                        align-items: center;
                        justify-content: flex-end;
                        padding: 20px 28px 24px 28px;
                        border-top: 1px solid #f1f5f9;
                        background-color: #fafbfc;
                        gap: 12px;
                    }
                    .cfm-modal .btn-close-custom {
                        background-color: #dc3545 !important;
                        color: white !important;
                        border-radius: 8px !important;
                        font-weight: 500 !important;
                        font-size: 14px !important;
                        padding: 10px 24px !important;
                        border: none !important;
                        cursor: pointer;
                        transition: background-color 0.2s;
                    }
                    .cfm-modal .btn-close-custom:hover { background-color: #bb2d3b !important; }
                    .cfm-modal .btn-save-custom {
                        background-color: #0a500f !important;
                        color: white !important;
                        border-radius: 8px !important;
                        font-weight: 500 !important;
                        font-size: 14px !important;
                        padding: 10px 24px !important;
                        border: none !important;
                        cursor: pointer;
                        transition: background-color 0.2s;
                    }
                    .cfm-modal .btn-save-custom:hover { background-color: #073d0b !important; }
                `}</style>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-building" style={{ fontSize: '20px', color: '#fff' }}></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Placement Details
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Assign branch and factory for the selected candidate.
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={handleCancelSelection}>&times;</button>
                </div>
                <div className="modal-body-custom">
                    <div className="mb-4">
                        <Form.Label className="font-w600">Branch <span className="text-danger">*</span></Form.Label>
                        <Select 
                            ref={branchSelectRef}
                            classNamePrefix="react-select"
                            options={[{ value: '', label: '------------' }, ...branches]}
                            value={selectedBranch}
                            onChange={handleBranchChange}
                            onKeyDown={handleBranchKeyDown}
                            openMenuOnFocus
                            placeholder="Select Branch..."
                            menuPortalTarget={document.body}
                            styles={selectStyles}
                            isClearable
                        />
                    </div>
                    <div>
                        <Form.Label className="font-w600">Factory <span className="text-danger">*</span></Form.Label>
                        <Select 
                            ref={factorySelectRef}
                            classNamePrefix="react-select"
                            options={[{ value: '', label: '------------' }, ...factories]}
                            value={selectedFactory}
                            onChange={handleFactoryChange}
                            onKeyDown={handleFactoryKeyDown}
                            openMenuOnFocus
                            placeholder="Select Factory..."
                            menuPortalTarget={document.body}
                            styles={selectStyles}
                            isClearable
                        />
                    </div>
                </div>
                <div className="modal-footer-custom">
                    <button type="button" className="btn-close-custom" onClick={handleCancelSelection}>
                        Cancel
                    </button>
                    <button 
                        type="button" 
                        className="btn-save-custom" 
                        onClick={handleConfirmSelection}
                        ref={saveBtnRef}
                    >
                        Confirm
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default ScheduleInterview;
