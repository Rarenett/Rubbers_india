import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Row, Col, Form, Button, Modal, Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import ComplaintService from '../../../services/ComplaintService';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import './Complaints.css';

const getBodDesignationLabel = (bod) =>
    bod.designation_name ||
    bod.designation_title ||
    bod.designation?.name ||
    'BOD';

const CommentPattern = () => {
    const navigate = useNavigate();
    
    // Pattern State
    const [patterns, setPatterns] = useState([]);
    const [loadingPatterns, setLoadingPatterns] = useState(false);
    const [showPatternModal, setShowPatternModal] = useState(false);
    const [editPatternId, setEditPatternId] = useState(null);
    const [patternFormData, setPatternFormData] = useState({ 
        pattern_no: '', category: '', pattern_head: '', cutoff_days: '', 
        pattern_type: 'Single', is_active: true, departments: [], designations: [], employees: [],
        decision_type: 'Single', decision_departments: [], decision_makers: []
    });
    
    // Support Data State
    const [categories, setCategories] = useState([]);
    const [allDepartments, setAllDepartments] = useState([]);
    const [masterDesignations, setMasterDesignations] = useState([]);
    const [mappedDesignations, setMappedDesignations] = useState([]);
    const [allEmployees, setAllEmployees] = useState([]);
    const [allBODs, setAllBODs] = useState([]);
    
    // Search Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [deptSearch, setDeptSearch] = useState('');
    const [desigSearch, setDesigSearch] = useState('');
    const [decisionSearch, setDecisionSearch] = useState('');
    const [decisionDeptSearch, setDecisionDeptSearch] = useState('');

    // Wizard State (replaces the old tab layout)
    const [formStep, setFormStep] = useState(1); // 1 Details, 2 Responders, 3 Evaluators, 4 Review
    const [stepError, setStepError] = useState('');
    const WIZARD_STEPS = [
        { n: 1, label: 'Details', icon: 'ti-file-text' },
        { n: 2, label: 'Responders', icon: 'ti-users' },
        { n: 3, label: 'Evaluators', icon: 'ti-shield-check' },
        { n: 4, label: 'Review', icon: 'ti-check' },
    ];

    const nameOf = (list, id, key1, key2) => {
        const item = list.find(x => String(x.id) === String(id));
        if (!item) return '';
        return item[key1] || item[key2] || '';
    };

    const getEmpLevel = useCallback((emp) => {
        if (!emp) return null;
        if (emp.level != null && emp.level !== '') return Number(emp.level);
        if (emp.designation_level != null && emp.designation_level !== '') return Number(emp.designation_level);
        if (emp.dept_designation && mappedDesignations?.length) {
            const mapping = mappedDesignations.find(m => String(m.id) === String(emp.dept_designation));
            if (mapping && mapping.level != null && mapping.level !== '') return Number(mapping.level);
        }
        return null;
    }, [mappedDesignations]);

    const selectedResponderEmps = useMemo(() => {
        if (patternFormData.pattern_type === 'BOD') return [];
        return allEmployees.filter(emp => patternFormData.employees.some(id => String(id) === String(emp.id)));
    }, [patternFormData.pattern_type, patternFormData.employees, allEmployees]);

    const selectedResponderBODs = useMemo(() => {
        if (patternFormData.pattern_type !== 'BOD') return [];
        return allBODs.filter(bod => patternFormData.employees.some(id => String(id) === String(bod.id)));
    }, [patternFormData.pattern_type, patternFormData.employees, allBODs]);

    const responderLevels = useMemo(() => {
        return selectedResponderEmps
            .map(getEmpLevel)
            .filter(l => l != null && !isNaN(l));
    }, [selectedResponderEmps, getEmpLevel]);

    const highestResponderRank = useMemo(() => {
        if (patternFormData.pattern_type === 'BOD') return 'BOD';
        if (responderLevels.length === 0) return null;
        return Math.min(...responderLevels);
    }, [patternFormData.pattern_type, responderLevels]);

    const isHigherEvaluator = useCallback((candidateEmp) => {
        if (!candidateEmp) return false;

        // Cannot evaluate self
        if (patternFormData.employees.some(id => String(id) === String(candidateEmp.id))) {
            return false;
        }
        if (candidateEmp.user && selectedResponderEmps.some(r => r.user && String(r.user) === String(candidateEmp.user))) {
            return false;
        }

        // If responder is BOD, regular employee cannot evaluate BOD
        if (patternFormData.pattern_type === 'BOD') {
            return false;
        }

        const cLevel = getEmpLevel(candidateEmp);

        // If responders have no level set, any candidate with a defined rank/level is higher
        if (highestResponderRank == null) {
            return cLevel != null;
        }

        // Candidate must have a defined level
        if (cLevel == null) return false;

        // Numerical rank: Level 1 is highest rank.
        // Higher rank = strictly lower number. Peers (equal level) and juniors (higher level) are excluded.
        return Number(cLevel) < Number(highestResponderRank);
    }, [patternFormData.employees, patternFormData.pattern_type, selectedResponderEmps, highestResponderRank, getEmpLevel]);

    const isEligibleBodEvaluator = useCallback((bod) => {
        if (!bod) return false;
        // Cannot evaluate self: if responder was BOD, cannot be the same BOD
        if (patternFormData.pattern_type === 'BOD') {
            if (patternFormData.employees.some(id => String(id) === String(bod.id))) return false;
        }
        // If responder was employee, BOD cannot be the same user/employee
        if (bod.user && selectedResponderEmps.some(r => r.user && String(r.user) === String(bod.user))) {
            return false;
        }
        if (selectedResponderEmps.some(r => (r.bod && String(r.bod) === String(bod.id)) || (bod.employee_profile_id && String(r.id) === String(bod.employee_profile_id)))) {
            return false;
        }
        return true;
    }, [patternFormData.pattern_type, patternFormData.employees, selectedResponderEmps]);

    // Clean up decision_makers if responders change and current evaluators are no longer strictly higher level
    useEffect(() => {
        if (allEmployees.length === 0 && allBODs.length === 0) return;
        if (patternFormData.decision_makers.length > 0) {
            if (patternFormData.employees.length === 0) {
                setPatternFormData(prev => ({ ...prev, decision_makers: [] }));
                return;
            }
            if (patternFormData.decision_type === 'BOD') {
                const valid = patternFormData.decision_makers.filter(id => {
                    const bod = allBODs.find(b => String(b.id) === String(id));
                    return bod && isEligibleBodEvaluator(bod);
                });
                if (valid.length !== patternFormData.decision_makers.length) {
                    setPatternFormData(prev => ({ ...prev, decision_makers: valid }));
                }
            } else {
                const valid = patternFormData.decision_makers.filter(id => {
                    const emp = allEmployees.find(e => String(e.id) === String(id));
                    return emp && isHigherEvaluator(emp);
                });
                if (valid.length !== patternFormData.decision_makers.length) {
                    setPatternFormData(prev => ({ ...prev, decision_makers: valid }));
                }
            }
        }
    }, [patternFormData.employees, patternFormData.pattern_type, patternFormData.decision_type, highestResponderRank, isHigherEvaluator, isEligibleBodEvaluator, allEmployees, allBODs]);

    const validateStep = (step) => {
        if (step === 1) {
            if (!patternFormData.category || !patternFormData.pattern_head || !patternFormData.cutoff_days) {
                setStepError('Fill in category, heading and cutoff days before continuing.');
                return false;
            }
        }
        if (step === 2) {
            const deptOk = ['HOD', 'BOD'].includes(patternFormData.pattern_type) || patternFormData.departments.length > 0;
            if (!deptOk) { setStepError('Select at least one target department.'); return false; }
            if (patternFormData.employees.length === 0) { setStepError('Select at least one responder.'); return false; }
        }
        if (step === 3) {
            const deptOk = ['HOD', 'BOD'].includes(patternFormData.decision_type) || patternFormData.decision_departments.length > 0;
            if (!deptOk) { setStepError('Select at least one target department.'); return false; }
            if (patternFormData.decision_makers.length === 0) { setStepError('Select at least one evaluator.'); return false; }
            if (patternFormData.decision_type === 'BOD') {
                const invalid = patternFormData.decision_makers.some(id => {
                    const bod = allBODs.find(b => String(b.id) === String(id));
                    return !bod || !isEligibleBodEvaluator(bod);
                });
                if (invalid) {
                    setStepError('Selected evaluator(s) must be eligible higher-level evaluators and cannot be the responder.');
                    return false;
                }
            } else {
                const invalid = patternFormData.decision_makers.some(id => {
                    const emp = allEmployees.find(e => String(e.id) === String(id));
                    return !emp || !isHigherEvaluator(emp);
                });
                if (invalid) {
                    setStepError('Selected evaluator(s) must hold a higher designation rank than the primary handler(s).');
                    return false;
                }
            }
        }
        setStepError('');
        return true;
    };

    const goToStep = (target) => {
        if (target > formStep) {
            for (let s = formStep; s < target; s++) {
                if (!validateStep(s)) { setFormStep(s); return; }
            }
        }
        setStepError('');
        setFormStep(target);
    };

    useEffect(() => {
        fetchPatterns();
        fetchInitialHRData();
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const res = await ComplaintService.getCategories();
            setCategories(res.data.results || res.data);
        } catch (err) {
            console.error("Error fetching categories", err);
        }
    };

    const fetchInitialHRData = async () => {
        const fetchSafe = async (apiCall) => {
            try {
                const res = await apiCall();
                return res.data?.results || res.data || [];
            } catch (err) {
                console.error("Error in HR API call:", err);
                return [];
            }
        };

        try {
            const depts = await fetchSafe(ComplaintService.getDepartments);
            setAllDepartments(depts);
            
            const masters = await fetchSafe(ComplaintService.getDesignations);
            setMasterDesignations(masters);
            
            const mappings = await fetchSafe(ComplaintService.getDepartmentDesignations);
            setMappedDesignations(mappings);
            
            const emps = await fetchSafe(ComplaintService.getEmployees);
            setAllEmployees(emps);

            const bods = await fetchSafe(ComplaintService.getBoardOfDirectors);
            setAllBODs(bods);
        } catch (err) {
            console.error("Error in fetchInitialHRData orchestration", err);
        }
    };

    const fetchPatterns = async () => {
        setLoadingPatterns(true);
        try {
            const res = await ComplaintService.getPatterns();
            setPatterns(res.data.results || res.data);
        } catch (err) {
            console.error("Error fetching patterns", err);
        } finally {
            setLoadingPatterns(false);
        }
    };

    const handleShowPatternModal = (pat = null) => {
        if (pat) {
            setEditPatternId(pat.id);
            setPatternFormData({
                pattern_no: pat.pattern_no || '',
                category: pat.category || '',
                pattern_head: pat.pattern_head || '',
                cutoff_days: pat.cutoff_days || '',
                pattern_type: pat.pattern_type || 'Single',
                departments: pat.departments || [],
                designations: pat.designations || [],
                employees: pat.employees || [],
                decision_makers: pat.decision_makers || [],
                decision_type: pat.decision_type || 'Single',
                decision_departments: pat.decision_departments || [],
                is_active: pat.is_active
            });
            setFormStep(1);
            setStepError('');
        } else {
            setEditPatternId(null);
            
            let nextNum = 1;
            if (patterns && patterns.length > 0) {
                const nums = patterns.map(p => {
                    const match = (p.pattern_no || '').match(/CN-(\d+)/i);
                    return match ? parseInt(match[1], 10) : 0;
                });
                const maxNum = Math.max(0, ...nums);
                nextNum = maxNum + 1;
            }
            const nextCode = `CN-${String(nextNum).padStart(3, '0')}`;
            
            setPatternFormData({ 
                pattern_no: nextCode, category: '', pattern_head: '', cutoff_days: '', 
                pattern_type: 'Single', departments: [], designations: [], employees: [],
                decision_makers: [], decision_type: 'Single', decision_departments: [], is_active: true 
            });
            setFormStep(1);
            setStepError('');
        }
        setShowPatternModal(true);
    };

    const handleClosePatternModal = () => {
        setShowPatternModal(false);
        setEditPatternId(null);
        setFormStep(1);
        setStepError('');
    };

    // The form's onSubmit is intentionally a no-op safety net only.
    // Saving is triggered directly from the Save button's onClick (see handleSavePattern),
    // never via native form submission — this avoids a React quirk where a button that
    // flips from type="button" to type="submit" on the same click can trigger a
    // native form submit before the re-render (Continue) finishes.
    const handleFormSubmit = (e) => {
        e.preventDefault();
    };

    const handleSavePattern = async () => {
        if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
            setFormStep(!validateStep(1) ? 1 : !validateStep(2) ? 2 : 3);
            return;
        }
        try {
            if (editPatternId) {
                await ComplaintService.updatePattern(editPatternId, patternFormData);
            } else {
                await ComplaintService.createPattern(patternFormData);
            }
            fetchPatterns();
            handleClosePatternModal();
        } catch (err) {
            console.error("Error saving pattern", err);
            alert("Error saving pattern. Ensure name is unique.");
        }
    };

    const filteredPatterns = patterns.filter(p => 
        (p.pattern_no || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.category_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.pattern_head || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentPatterns = filteredPatterns.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredPatterns.length / itemsPerPage);

    return (
        <div className="container-fluid">
            <style>
                {`
                    @media (max-width: 991px) {
                        .pattern-header-container {
                            flex-direction: column !important;
                            align-items: flex-start !important;
                            gap: 15px !important;
                        }
                        .pattern-controls-wrapper {
                            flex-direction: column !important;
                            width: 100% !important;
                            gap: 10px !important;
                        }
                        .pattern-search-bar {
                            width: 100% !important;
                        }
                        .pattern-add-btn {
                            width: 100% !important;
                        }
                    }
                    .pattern-table {
                        min-width: 850px !important;
                    }
                    .pattern-table th, .pattern-table td {
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

            {!showPatternModal ? (
                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex justify-content-between align-items-center pattern-header-container">
                                <Card.Title className="mb-0">Comment Pattern List</Card.Title>
                                <div className="d-flex align-items-center gap-2 pattern-controls-wrapper">
                                    <div className="pattern-search-bar" style={{ width: '300px', position: 'relative' }}>
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search patterns..."
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />
                                    </div>
                                    <Button
                                        variant="primary"
                                        onClick={() => handleShowPatternModal()}
                                        className="d-flex align-items-center justify-content-center pattern-add-btn"
                                        style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px', backgroundColor: '#0a500f', borderColor: '#0a500f', color: 'white' }}
                                    >
                                        <i className="fa fa-plus me-2"></i>
                                        ADD PATTERN
                                    </Button>
                                </div>
                            </Card.Header>
                            <Card.Body>
                                <div className="table-responsive pb-4">
                                    <table className="table table-responsive-md pattern-table">
                                        <thead>
                                            <tr>
                                                <th><strong>CN NO</strong></th>
                                                <th><strong>CATEGORY</strong></th>
                                                <th><strong>COMMENT HEAD</strong></th>
                                                <th><strong>TYPE</strong></th>
                                                <th><strong>CUTOFF DAYS</strong></th>
                                                {/* <th><strong>STATUS</strong></th> */}
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loadingPatterns ? <tr><td colSpan="7" className="text-center py-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div></td></tr> : 
                                                filteredPatterns.length === 0 ? <tr><td colSpan="7" className="text-center py-4 text-muted">No patterns found.</td></tr> :
                                                currentPatterns.map((p, idx) => (
                                                <tr key={p.id}>
                                                    <td><strong>{p.pattern_no}</strong></td>
                                                    <td>{p.category_name || '-'}</td>
                                                    <td><strong>{p.pattern_head}</strong></td>
                                                    <td>
                                                        <span style={{background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--cm-text-primary)'}}>
                                                            {p.pattern_type}
                                                        </span>
                                                    </td>
                                                    <td>{p.cutoff_days || 0}</td>
                                                    {/* <td>
                                                        <span className={`badge light badge-${p.is_active ? 'success' : 'danger'}`}>
                                                            {p.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td> */}
                                                    <td className="text-end">
                                                        <div className="d-flex justify-content-end">
                                                            <EditButton
                                                                module="feedback_patterns"
                                                                onClick={() => handleShowPatternModal(p)}
                                                                className="me-1"
                                                            />
                                                            <DeleteButton
                                                                module="feedback_patterns"
                                                                onClick={() => {
                                                                    if (window.confirm("Are you sure you want to delete this pattern?")) {
                                                                        ComplaintService.deletePattern(p.id).then(() => fetchPatterns());
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    </td>  
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {filteredPatterns.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3">
                                            <div className="dataTables_info">
                                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredPatterns.length)} of {filteredPatterns.length} entries
                                            </div>
                                            {totalPages > 1 && (
                                                <nav>
                                                    <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                        <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
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
                                </div>
                            </Card.Body>
                        </Card>
                    </div>
                </div>
            ) : (
                <div className="cm-section-container" style={{ padding: 0, backgroundColor: 'transparent', border: 'none' }}>
                    <Card style={{ border: 'none', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                        <div style={{ background: '#fff', padding: '1.75rem 2.5rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>
                            <div className="d-flex justify-content-between align-items-start mb-4">
                                <div>
                                    <h2 style={{ fontWeight: 800, margin: 0, fontSize: '1.5rem', color: '#1e293b' }}>{editPatternId ? 'Refine comment pattern' : 'Create new pattern'}</h2>
                                    <p style={{ color: '#64748b', marginBottom: 0, marginTop: '0.3rem', fontWeight: 500, fontSize: '0.9rem' }}>
                                        {patternFormData.pattern_no || 'New pattern'} &middot; step {formStep} of {WIZARD_STEPS.length}
                                    </p>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={handleClosePatternModal} 
                                    className="btn btn-light d-flex align-items-center justify-content-center" 
                                    style={{ height: '36px', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '0 14px', gap: '6px', fontWeight: 600, fontSize: '0.85rem', color: '#475569' }} 
                                    aria-label="Back"
                                >
                                    <i className="fa fa-arrow-left"></i> Back
                                </button>
                            </div>

                            {/* Step Progress */}
                            <div className="d-flex align-items-center">
                                {WIZARD_STEPS.map((s, idx) => {
                                    const isDone = s.n < formStep;
                                    const isActive = s.n === formStep;
                                    return (
                                        <React.Fragment key={s.n}>
                                            <div
                                                role="button"
                                                onClick={() => goToStep(s.n)}
                                                className="d-flex flex-column align-items-center"
                                                style={{ cursor: 'pointer', minWidth: '84px' }}
                                            >
                                                <div style={{
                                                    width: '32px', height: '32px', borderRadius: '50%',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.85rem', fontWeight: 700,
                                                    background: isActive ? '#0a500f' : isDone ? '#0a500f' : '#f1f5f9',
                                                    color: (isActive || isDone) ? '#fff' : '#94a3b8',
                                                    border: (isActive || isDone) ? 'none' : '1px solid #e2e8f0',
                                                    transition: 'all 0.2s'
                                                }}>
                                                    {isDone ? <i className="fa fa-check" style={{ fontSize: '0.75rem' }}></i> : s.n}
                                                </div>
                                                <span style={{ fontSize: '0.75rem', marginTop: '0.4rem', fontWeight: isActive ? 700 : 500, color: isActive ? '#1e293b' : '#94a3b8' }}>{s.label}</span>
                                            </div>
                                            {idx < WIZARD_STEPS.length - 1 && (
                                                <div style={{ flex: 1, height: '2px', background: s.n < formStep ? '#0a500f' : '#e2e8f0', marginBottom: '1.4rem', transition: 'background 0.2s' }}></div>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                        
                        <Card.Body style={{ padding: '2.5rem' }}>

                        <Form onSubmit={handleFormSubmit}>
                            {stepError && (
                                <div className="d-flex align-items-center gap-2 mb-4" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.75rem 1rem', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 600 }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                    {stepError}
                                </div>
                            )}
                            {formStep === 1 && (
                            <>
                            {/* Section 1: Core Configuration */}
                            <div className="mb-4">
                                <p style={{ fontWeight: 700, color: '#1e293b', fontSize: '1.05rem', marginBottom: '1.2rem' }}>Pattern details</p>
                                <Row>
                                    <Col md={3}>
                                        <Form.Group className="mb-4">
                                            <Form.Label style={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem', marginBottom: '0.6rem' }}>COMMENT NO</Form.Label>
                                            <Form.Control 
                                                required 
                                                type="text" 
                                                value={patternFormData.pattern_no} 
                                                onChange={e => setPatternFormData({...patternFormData, pattern_no: e.target.value})} 
                                                placeholder="e.g. CN-001"
                                                readOnly 
                                                style={{ padding: '0.8rem 1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem', background: '#f1f5f9', cursor: 'not-allowed' }}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={3}>
                                        <Form.Group className="mb-4">
                                            <Form.Label style={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem', marginBottom: '0.6rem' }}>FEEDBACK CATEGORY</Form.Label>
                                            <Form.Select 
                                                required 
                                                value={patternFormData.category} 
                                                onChange={e => setPatternFormData({...patternFormData, category: e.target.value})}
                                                style={{ padding: '0.8rem 1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem', background: '#f8fafc' }}
                                            >
                                                <option value="">Select Category</option>
                                                {categories.filter(cat => cat.is_active !== false).map(cat => (
                                                    <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                                                ))}
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                    <Col md={4}>
                                        <Form.Group className="mb-4">
                                            <Form.Label style={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem', marginBottom: '0.6rem' }}>PATTERN HEADING</Form.Label>
                                            <Form.Control 
                                                required 
                                                type="text" 
                                                value={patternFormData.pattern_head} 
                                                onChange={e => setPatternFormData({...patternFormData, pattern_head: e.target.value})} 
                                                placeholder="Identify the pattern purpose" 
                                                style={{ padding: '0.8rem 1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem', background: '#f8fafc' }}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={2}>
                                        <Form.Group className="mb-4">
                                            <Form.Label style={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem', marginBottom: '0.6rem' }}>CUTOFF DAYS</Form.Label>
                                            <div className="input-group">
                                                <Form.Control 
                                                    required 
                                                    type="number" 
                                                    value={patternFormData.cutoff_days} 
                                                    onChange={e => setPatternFormData({...patternFormData, cutoff_days: e.target.value})} 
                                                    style={{ padding: '0.8rem 1.2rem', borderRadius: '12px 0 0 12px', border: '1px solid #e2e8f0', fontSize: '1rem', background: '#f8fafc' }}
                                                />
                                                <span className="input-group-text bg-white border-start-0" style={{border: '1px solid #e2e8f0', borderRadius: '0 12px 12px 0', fontSize: '0.8rem', fontWeight: 600, color: '#64748b'}}>Days</span>
                                            </div>
                                        </Form.Group>
                                    </Col>
                                </Row>
                            </div>
                            </>
                            )}

                            {formStep === 2 && (
                            <>
                            <p style={{ fontWeight: 700, color: '#1e293b', fontSize: '1.05rem', marginBottom: '0.3rem' }}>Primary handlers (responders)</p>
                            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.2rem' }}>Choose who first receives and works complaints raised under this pattern.</p>
                            {/* Section 2: Pattern Type Selection */}
                            <div className="mb-4">
                            <div className="cm-type-selection-cards">
                                {[
                                    { id: 'Single', label: 'Single Route', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> },
                                    { id: 'Multiple', label: 'Multiple Route', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
                                    { id: 'HOD', label: 'Dept Head (HOD)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
                                    { id: 'BOD', label: 'BOD', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="14.31" y1="8" x2="20.05" y2="17.94"/><line x1="9.69" y1="8" x2="21.17" y2="8"/><line x1="7.38" y1="12" x2="13.12" y2="2.06"/><line x1="9.69" y1="16" x2="3.95" y2="6.06"/><line x1="14.31" y1="16" x2="2.83" y2="16"/><line x1="16.62" y1="12" x2="10.88" y2="21.94"/></svg> }
                                ].map(type => (
                                    <div 
                                        key={type.id}
                                        className={`cm-type-card ${patternFormData.pattern_type === type.id ? 'active' : ''}`}
                                        onClick={() => {
                                            setPatternFormData({
                                                ...patternFormData, 
                                                pattern_type: type.id, 
                                                designations: []
                                            });
                                        }}
                                    >
                                        <div className="icon-box">{type.icon}</div>
                                        <span>{type.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                            {/* Section 3: Distribution Matrix */}
                            <div className="mb-4">
                                <Row>
                                    <Col md={6}>
                                        <Form.Label style={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem', marginBottom: '0.6rem' }}>TARGET DEPARTMENTS</Form.Label>
                                        {(() => {
                                            const isSingle = patternFormData.pattern_type === 'Single';
                                            const isDeptDisabled = ['HOD', 'BOD'].includes(patternFormData.pattern_type);
                                            return (
                                        <div className="cm-selection-list-container" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', opacity: isDeptDisabled ? 0.5 : 1, pointerEvents: isDeptDisabled ? 'none' : 'auto' }}>
                                            <div className="cm-list-search" style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                                                <div className="position-relative">
                                                    <svg style={{position:'absolute', left:'15px', top:'12px', opacity:0.4}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                                    <input 
                                                        type="text" 
                                                        className="form-control" 
                                                        placeholder={isDeptDisabled ? 'Not applicable for this protocol' : 'Search departments...'}
                                                        disabled={isDeptDisabled}
                                                        style={{padding: '0.8rem 1rem 0.8rem 2.8rem', border: 'none', background: 'transparent', fontSize: '0.9rem'}}
                                                        value={deptSearch}
                                                        onChange={e => setDeptSearch(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="cm-list-scroll" style={{ maxHeight: '300px', backgroundColor: '#fff' }}>
                                                {allDepartments
                                                    .filter(d => (d.department_name || d.name || '').toLowerCase().includes(deptSearch.toLowerCase()))
                                                    .map(dept => (
                                                    <div key={dept.id} className="cm-selection-item d-flex align-items-center gap-2 p-3 border-bottom" onClick={() => {
                                                        if (isDeptDisabled) return;
                                                        if (isSingle) {
                                                            const alreadySelected = patternFormData.departments.length === 1 && patternFormData.departments[0] === dept.id;
                                                            setPatternFormData({
                                                                ...patternFormData,
                                                                departments: alreadySelected ? [] : [dept.id],
                                                                // Changing (or clearing) the department invalidates the previously picked employee
                                                                employees: alreadySelected ? patternFormData.employees : []
                                                            });
                                                        } else {
                                                            const newDepts = patternFormData.departments.includes(dept.id)
                                                                ? patternFormData.departments.filter(id => id !== dept.id)
                                                                : [...patternFormData.departments, dept.id];
                                                            setPatternFormData({...patternFormData, departments: newDepts});
                                                        }
                                                    }} style={{ cursor: 'pointer', transition: 'background 0.2s' }}>
                                                        <Form.Check 
                                                            type={isSingle ? 'radio' : 'checkbox'}
                                                            name="dept-selection"
                                                            id={`dept-check-${dept.id}`}
                                                            checked={patternFormData.departments.includes(dept.id)}
                                                            readOnly
                                                        />
                                                        <label className="mb-0" style={{ fontSize: '0.95rem', cursor: 'pointer', fontWeight: patternFormData.departments.includes(dept.id) ? 600 : 400 }}>{dept.department_name || dept.name}</label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                            );
                                        })()}
                                    </Col>
                                    <Col md={6}>
                                        <Form.Label style={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem', marginBottom: '0.6rem' }}>EMPLOYEES / DESIGNATIONS</Form.Label>
                                        <div className="cm-selection-list-container" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                            <div className="cm-list-search" style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                                                <div className="position-relative">
                                                    <svg style={{position:'absolute', left:'15px', top:'12px', opacity:0.4}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                                    <input 
                                                        type="text" 
                                                        className="form-control" 
                                                        placeholder="Search employees..." 
                                                        style={{padding: '0.8rem 1rem 0.8rem 2.8rem', border: 'none', background: 'transparent', fontSize: '0.9rem'}}
                                                        value={desigSearch}
                                                        onChange={e => setDesigSearch(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="cm-list-scroll" style={{ maxHeight: '300px', backgroundColor: '#fff' }}>
                                                {patternFormData.departments.length === 0 && !['HOD', 'BOD'].includes(patternFormData.pattern_type) ? (
                                                    <div className="cm-empty-state p-5 text-center text-muted">
                                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-20"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                                        <p style={{fontSize: '0.9rem'}}>Select a department first to browse employees.</p>
                                                    </div>
                                                ) : (() => {
                                                    if (patternFormData.pattern_type === 'BOD') {
                                                        const filteredBODs = allBODs.filter(bod => {
                                                            const name = (bod.name || '').toLowerCase();
                                                            const designation = getBodDesignationLabel(bod).toLowerCase();
                                                            const search = desigSearch.toLowerCase();

                                                            return name.includes(search) || designation.includes(search);
                                                        });

                                                        if (filteredBODs.length === 0) {
                                                            return (
                                                                <div className="cm-empty-state p-5 text-center text-muted">
                                                                    <p style={{fontSize: '0.9rem'}}>
                                                                        {allBODs.length === 0
                                                                            ? 'No BOD members found.'
                                                                            : 'No BOD members match your search.'}
                                                                    </p>
                                                                </div>
                                                            );
                                                        }

                                                        return filteredBODs.map(bod => {
                                                            const designation = getBodDesignationLabel(bod);
                                                            const displayLabel = `${bod.name} (${designation})`;
                                                            const isSelected = patternFormData.employees.some(
                                                                id => String(id) === String(bod.id)
                                                            );

                                                            return (
                                                                <div
                                                                    key={bod.id}
                                                                    className="cm-selection-item d-flex align-items-center gap-2 p-3 border-bottom"
                                                                    onClick={() => {
                                                                        const newEmps = isSelected
                                                                            ? patternFormData.employees.filter(
                                                                                id => String(id) !== String(bod.id)
                                                                            )
                                                                            : [...patternFormData.employees, bod.id];

                                                                        setPatternFormData({
                                                                            ...patternFormData,
                                                                            employees: newEmps
                                                                        });
                                                                    }}
                                                                    style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                                                                >
                                                                    <Form.Check
                                                                        type="checkbox"
                                                                        name="employee-selection"
                                                                        id={`bod-check-${bod.id}`}
                                                                        checked={isSelected}
                                                                        readOnly
                                                                    />
                                                                    <label
                                                                        className="mb-0"
                                                                        style={{
                                                                            fontSize: '0.95rem',
                                                                            cursor: 'pointer',
                                                                            fontWeight: isSelected ? 600 : 400
                                                                        }}
                                                                    >
                                                                        {displayLabel}
                                                                    </label>
                                                                </div>
                                                            );
                                                        });
                                                    }

                                                    // The "BOD" department is a stand-in for the real BoardOfDirectors
                                                    // table, so anyone in it should come from there, not from the
                                                    // normal Employee/department mapping below.
                                                    const bodDepartmentIds = allDepartments
                                                        .filter(d => (d.department_name || d.name || '').trim().toUpperCase() === 'BOD')
                                                        .map(d => String(d.id));
                                                    const bodDeptSelected = patternFormData.departments.some(
                                                        d => bodDepartmentIds.includes(String(d))
                                                    );

                                                    const filteredEmps = allEmployees.filter(emp => {
                                                        const mapping = mappedDesignations.find(m => String(m.id) === String(emp.dept_designation));
                                                        if (!mapping) return false;
                                                        if (bodDepartmentIds.includes(String(mapping.department))) return false;

                                                        const deptMatch = patternFormData.departments.length === 0 || patternFormData.departments.some(d => String(d) === String(mapping.department));
                                                        const title = (emp.designation_title || '').toLowerCase();
                                                        const searchMatch = (emp.user_name || '').toLowerCase().includes(desigSearch.toLowerCase()) || 
                                                                           title.includes(desigSearch.toLowerCase());
                                                        
                                                        // Apply Protocol-Based Filtering
                                                        let protocolMatch = true;
                                                        if (patternFormData.pattern_type === 'HOD') {
                                                            protocolMatch = title.includes('hod') || title.includes('head');
                                                        }
                                                        
                                                        return deptMatch && searchMatch && protocolMatch;
                                                    });

                                                    const filteredBODs = bodDeptSelected
                                                        ? allBODs.filter(bod => {
                                                            const name = (bod.name || '').toLowerCase();
                                                            const designation = getBodDesignationLabel(bod).toLowerCase();
                                                            const search = desigSearch.toLowerCase();
                                                            return name.includes(search) || designation.includes(search);
                                                        })
                                                        : [];
                                                    
                                                    if (filteredEmps.length === 0 && filteredBODs.length === 0) {
                                                        return (
                                                            <div className="cm-empty-state p-5 text-center text-muted">
                                                                <p style={{fontSize: '0.9rem'}}>
                                                                    {patternFormData.pattern_type === 'HOD'
                                                                        ? 'No HOD employees found.'
                                                                        : 'No employees found.'}
                                                                </p>
                                                            </div>
                                                        );
                                                    }

                                                    const isMultiSelect = ['Multiple', 'HOD'].includes(patternFormData.pattern_type);
                                                    const toggleSelection = (id) => {
                                                        if (isMultiSelect) {
                                                            const newEmps = patternFormData.employees.some(existing => String(existing) === String(id))
                                                                ? patternFormData.employees.filter(existing => String(existing) !== String(id))
                                                                : [...patternFormData.employees, id];
                                                            setPatternFormData({...patternFormData, employees: newEmps});
                                                        } else {
                                                            setPatternFormData({...patternFormData, employees: [id]});
                                                        }
                                                    };

                                                    return (
                                                        <>
                                                            {filteredEmps.map(emp => {
                                                                const displayLabel = `${emp.user_name} (${emp.designation_title})`;
                                                                const isSelected = patternFormData.employees.some(id => String(id) === String(emp.id));

                                                                return (
                                                                    <div key={emp.id} className="cm-selection-item d-flex align-items-center gap-2 p-3 border-bottom" onClick={() => toggleSelection(emp.id)} style={{ cursor: 'pointer', transition: 'background 0.2s' }}>
                                                                         <Form.Check 
                                                                             type={isMultiSelect ? 'checkbox' : 'radio'}
                                                                            name="employee-selection"
                                                                            id={`emp-check-${emp.id}`}
                                                                            checked={isSelected}
                                                                            readOnly
                                                                        />
                                                                        <label className="mb-0" style={{ fontSize: '0.95rem', cursor: 'pointer', fontWeight: isSelected ? 600 : 400 }}>{displayLabel}</label>
                                                                    </div>
                                                                );
                                                            })}
                                                            {filteredBODs.map(bod => {
                                                                const designation = getBodDesignationLabel(bod);
                                                                const displayLabel = `${bod.name} (${designation})`;
                                                                const isSelected = patternFormData.employees.some(id => String(id) === String(bod.id));

                                                                return (
                                                                    <div
                                                                        key={`bod-${bod.id}`}
                                                                        className="cm-selection-item d-flex align-items-center gap-2 p-3 border-bottom"
                                                                        onClick={() => toggleSelection(bod.id)}
                                                                        style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                                                                    >
                                                                        <Form.Check
                                                                            type={isMultiSelect ? 'checkbox' : 'radio'}
                                                                            name="employee-selection"
                                                                            id={`bod-check-${bod.id}`}
                                                                            checked={isSelected}
                                                                            readOnly
                                                                        />
                                                                        <label
                                                                            className="mb-0"
                                                                            style={{
                                                                                fontSize: '0.95rem',
                                                                                cursor: 'pointer',
                                                                                fontWeight: isSelected ? 600 : 400
                                                                            }}
                                                                        >
                                                                            {displayLabel}
                                                                        </label>
                                                                    </div>
                                                                );
                                                            })}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </Col>
                                </Row>
                            </div>
                            </>
                            )}

                            {formStep === 3 && (
                            <>
                            {/* Section 4: Final Decision Makers (Evaluators) */}
                            <div className="mb-4">
                                <p style={{ fontWeight: 700, color: '#1e293b', fontSize: '1.05rem', marginBottom: '0.3rem' }}>Final decision makers (evaluators)</p>
                                <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.2rem' }}>
                                    Select who is allowed to make the final decision on complaints raised under this category and pattern.
                                </p>

                                <div className="cm-type-selection-cards mb-3">
                                    {[
                                        { id: 'Single', label: 'Single Route', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> },
                                        { id: 'Multiple', label: 'Multiple Route', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
                                        { id: 'HOD', label: 'Dept Head (HOD)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
                                        { id: 'BOD', label: 'BOD', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="14.31" y1="8" x2="20.05" y2="17.94"/><line x1="9.69" y1="8" x2="21.17" y2="8"/><line x1="7.38" y1="12" x2="13.12" y2="2.06"/><line x1="9.69" y1="16" x2="3.95" y2="6.06"/><line x1="14.31" y1="16" x2="2.83" y2="16"/><line x1="16.62" y1="12" x2="10.88" y2="21.94"/></svg> }
                                    ].map(type => (
                                        <div 
                                            key={type.id}
                                            className={`cm-type-card ${patternFormData.decision_type === type.id ? 'active' : ''}`}
                                            onClick={() => {
                                                setPatternFormData({
                                                    ...patternFormData, 
                                                    decision_type: type.id, 
                                                    decision_makers: []
                                                });
                                            }}
                                        >
                                            <div className="icon-box">{type.icon}</div>
                                            <span>{type.label}</span>
                                        </div>
                                    ))}
                                </div>

                                <Row>
                                    <Col md={6}>
                                        <Form.Label style={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem', marginBottom: '0.6rem' }}>TARGET DEPARTMENTS</Form.Label>
                                        {(() => {
                                            const isDeptDisabled = ['HOD', 'BOD'].includes(patternFormData.decision_type);
                                            const isSingle = patternFormData.decision_type === 'Single';
                                            return (
                                        <div className="cm-selection-list-container" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', opacity: isDeptDisabled ? 0.5 : 1, pointerEvents: isDeptDisabled ? 'none' : 'auto' }}>
                                            <div className="cm-list-search" style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                                                <div className="position-relative">
                                                    <svg style={{position:'absolute', left:'15px', top:'12px', opacity:0.4}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                                    <input 
                                                        type="text" 
                                                        className="form-control" 
                                                        placeholder={isDeptDisabled ? 'Not applicable for this protocol' : 'Search departments...'}
                                                        disabled={isDeptDisabled}
                                                        style={{padding: '0.8rem 1rem 0.8rem 2.8rem', border: 'none', background: 'transparent', fontSize: '0.9rem'}}
                                                        value={decisionDeptSearch}
                                                        onChange={e => setDecisionDeptSearch(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="cm-list-scroll" style={{ maxHeight: '300px', backgroundColor: '#fff' }}>
                                                {allDepartments
                                                    .filter(d => (d.department_name || d.name || '').toLowerCase().includes(decisionDeptSearch.toLowerCase()))
                                                    .map(dept => (
                                                    <div key={dept.id} className="cm-selection-item d-flex align-items-center gap-2 p-3 border-bottom" onClick={() => {
                                                        if (isDeptDisabled) return;
                                                        if (isSingle) {
                                                            const alreadySelected = patternFormData.decision_departments.length === 1 && patternFormData.decision_departments[0] === dept.id;
                                                            setPatternFormData({
                                                                ...patternFormData,
                                                                decision_departments: alreadySelected ? [] : [dept.id],
                                                                // Changing (or clearing) the department invalidates the previously picked evaluator
                                                                decision_makers: alreadySelected ? patternFormData.decision_makers : []
                                                            });
                                                        } else {
                                                            const newDepts = patternFormData.decision_departments.includes(dept.id)
                                                                ? patternFormData.decision_departments.filter(id => id !== dept.id)
                                                                : [...patternFormData.decision_departments, dept.id];
                                                            setPatternFormData({...patternFormData, decision_departments: newDepts});
                                                        }
                                                    }} style={{ cursor: 'pointer', transition: 'background 0.2s' }}>
                                                        <Form.Check 
                                                            type={isSingle ? 'radio' : 'checkbox'}
                                                            name="decision-dept-selection"
                                                            id={`decision-dept-check-${dept.id}`}
                                                            checked={patternFormData.decision_departments.includes(dept.id)}
                                                            readOnly
                                                        />
                                                        <label className="mb-0" style={{ fontSize: '0.95rem', cursor: 'pointer', fontWeight: patternFormData.decision_departments.includes(dept.id) ? 600 : 400 }}>{dept.department_name || dept.name}</label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                            );
                                        })()}
                                    </Col>
                                    <Col md={6}>
                                        <Form.Label style={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem', marginBottom: '0.6rem' }}>EVALUATOR EMPLOYEES</Form.Label>
                                        <div className="cm-selection-list-container" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                            <div className="cm-list-search" style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                                                <div className="position-relative">
                                                    <svg style={{position:'absolute', left:'15px', top:'12px', opacity:0.4}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                                    <input 
                                                        type="text" 
                                                        className="form-control" 
                                                        placeholder="Search employees..." 
                                                        style={{padding: '0.8rem 1rem 0.8rem 2.8rem', border: 'none', background: 'transparent', fontSize: '0.9rem'}}
                                                        value={decisionSearch}
                                                        onChange={e => setDecisionSearch(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="cm-list-scroll" style={{ maxHeight: '300px', backgroundColor: '#fff' }}>
                                                {patternFormData.employees.length === 0 ? (
                                                    <div className="cm-empty-state p-5 text-center text-muted">
                                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-20"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                                        <p style={{fontSize: '0.9rem'}}>Please select Primary handlers (responders) in Step 2 first.</p>
                                                    </div>
                                                ) : patternFormData.decision_departments.length === 0 && !['HOD', 'BOD'].includes(patternFormData.decision_type) ? (
                                                    <div className="cm-empty-state p-5 text-center text-muted">
                                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-20"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                                        <p style={{fontSize: '0.9rem'}}>Select a department first to browse employees.</p>
                                                    </div>
                                                ) : (() => {
                                                    const isSingle = patternFormData.decision_type === 'Single';

                                                    if (patternFormData.decision_type === 'BOD') {
                                                        const filteredBODs = allBODs.filter(bod => {
                                                            const name = (bod.name || '').toLowerCase();
                                                            const designation = getBodDesignationLabel(bod).toLowerCase();
                                                            const search = decisionSearch.toLowerCase();
                                                            const searchMatch = name.includes(search) || designation.includes(search);

                                                            return searchMatch && isEligibleBodEvaluator(bod);
                                                        });

                                                        if (filteredBODs.length === 0) {
                                                            return (
                                                                <div className="cm-empty-state p-5 text-center text-muted">
                                                                    <p style={{fontSize: '0.9rem'}}>
                                                                        {allBODs.length === 0
                                                                            ? 'No BOD members found.'
                                                                            : 'No eligible BOD members available (peers or self excluded).'}
                                                                    </p>
                                                                </div>
                                                            );
                                                        }

                                                        return filteredBODs.map(bod => {
                                                            const designation = getBodDesignationLabel(bod);
                                                            const displayLabel = `${bod.name} (${designation})`;
                                                            const isSelected = patternFormData.decision_makers.some(
                                                                id => String(id) === String(bod.id)
                                                            );

                                                            return (
                                                                <div
                                                                    key={bod.id}
                                                                    className="cm-selection-item d-flex align-items-center gap-2 p-3 border-bottom"
                                                                    onClick={() => {
                                                                        if (isSingle) {
                                                                            const alreadySelected = patternFormData.decision_makers.length === 1 && String(patternFormData.decision_makers[0]) === String(bod.id);
                                                                            setPatternFormData({
                                                                                ...patternFormData,
                                                                                decision_makers: alreadySelected ? [] : [bod.id]
                                                                            });
                                                                        } else {
                                                                            const newDecisionMakers = isSelected
                                                                                ? patternFormData.decision_makers.filter(
                                                                                    id => String(id) !== String(bod.id)
                                                                                )
                                                                                : [...patternFormData.decision_makers, bod.id];

                                                                            setPatternFormData({
                                                                                ...patternFormData,
                                                                                decision_makers: newDecisionMakers
                                                                            });
                                                                        }
                                                                    }}
                                                                    style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                                                                >
                                                                    <Form.Check
                                                                        type={isSingle ? 'radio' : 'checkbox'}
                                                                        name="decision-maker-selection"
                                                                        id={`bod-decision-check-${bod.id}`}
                                                                        checked={isSelected}
                                                                        readOnly
                                                                    />
                                                                    <label
                                                                        className="mb-0"
                                                                        style={{
                                                                            fontSize: '0.95rem',
                                                                            cursor: 'pointer',
                                                                            fontWeight: isSelected ? 600 : 400
                                                                        }}
                                                                    >
                                                                        {displayLabel}
                                                                    </label>
                                                                </div>
                                                            );
                                                        });
                                                    }

                                                    const filteredEmps = allEmployees.filter(emp => {
                                                        const mapping = mappedDesignations.find(m => String(m.id) === String(emp.dept_designation));
                                                        const deptMatch = mapping && (patternFormData.decision_departments.length === 0 || patternFormData.decision_departments.some(d => String(d) === String(mapping.department)));
                                                        const title = (emp.designation_title || '').toLowerCase();
                                                        const searchMatch = (emp.user_name || '').toLowerCase().includes(decisionSearch.toLowerCase()) || 
                                                                           title.includes(decisionSearch.toLowerCase());

                                                        // Apply the same protocol-based filtering as the routing section,
                                                        // but driven by decision_type instead of pattern_type
                                                        let protocolMatch = true;
                                                        if (patternFormData.decision_type === 'HOD') {
                                                            protocolMatch = title.includes('hod') || title.includes('head');
                                                        }

                                                        return deptMatch && searchMatch && protocolMatch && isHigherEvaluator(emp);
                                                    });

                                                    if (filteredEmps.length === 0) {
                                                        let emptyMsg = 'No employees found.';
                                                        if (highestResponderRank === 'BOD') {
                                                            emptyMsg = 'Primary handler is BOD. Regular employees cannot evaluate BOD members; please use BOD mode for evaluators.';
                                                        } else if (highestResponderRank === 1) {
                                                            emptyMsg = 'Selected responder is at the highest designation level (Level 1). No employees are higher; please use BOD mode.';
                                                        } else if (highestResponderRank != null) {
                                                            emptyMsg = patternFormData.decision_type === 'HOD'
                                                                ? 'No higher-level HOD employees found (peers and juniors excluded).'
                                                                : 'No higher-level employees found in this department (peers and juniors excluded).';
                                                        } else if (['HOD', 'BOD'].includes(patternFormData.decision_type)) {
                                                            emptyMsg = `No ${patternFormData.decision_type} employees found.`;
                                                        }

                                                        return (
                                                            <div className="cm-empty-state p-5 text-center text-muted">
                                                                <p style={{fontSize: '0.9rem'}}>
                                                                    {emptyMsg}
                                                                </p>
                                                            </div>
                                                        );
                                                    }

                                                    return filteredEmps.map(emp => {
                                                        const displayLabel = `${emp.user_name} (${emp.designation_title})`;
                                                        return (
                                                            <div key={emp.id} className="cm-selection-item d-flex align-items-center gap-2 p-3 border-bottom" onClick={() => {
                                                                if (isSingle) {
                                                                    const alreadySelected = patternFormData.decision_makers.length === 1 && patternFormData.decision_makers[0] === emp.id;
                                                                    setPatternFormData({
                                                                        ...patternFormData,
                                                                        decision_makers: alreadySelected ? [] : [emp.id]
                                                                    });
                                                                } else {
                                                                    const newDecisionMakers = patternFormData.decision_makers.includes(emp.id)
                                                                        ? patternFormData.decision_makers.filter(id => id !== emp.id)
                                                                        : [...patternFormData.decision_makers, emp.id];
                                                                    setPatternFormData({...patternFormData, decision_makers: newDecisionMakers});
                                                                }
                                                            }} style={{ cursor: 'pointer', transition: 'background 0.2s' }}>
                                                                <Form.Check 
                                                                    type={isSingle ? 'radio' : 'checkbox'}
                                                                    name="decision-maker-selection"
                                                                    id={`decision-check-${emp.id}`}
                                                                    checked={patternFormData.decision_makers.includes(emp.id)}
                                                                    readOnly
                                                                />
                                                                <label className="mb-0" style={{ fontSize: '0.95rem', cursor: 'pointer', fontWeight: patternFormData.decision_makers.includes(emp.id) ? 600 : 400 }}>{displayLabel}</label>
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    </Col>
                                </Row>
                            </div>
                            </>
                            )}

                            {formStep === 4 && (
                            <div className="mb-4">
                                <p style={{ fontWeight: 700, color: '#1e293b', fontSize: '1.05rem', marginBottom: '0.3rem' }}>Review and save</p>
                                <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.2rem' }}>Double check the pattern before saving. Use edit to jump back to any step.</p>

                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
                                    <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#94a3b8' }}>PATTERN DETAILS</span>
                                            <Button variant="outline-primary" size="sm" className="shadow" style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '12px', borderRadius: '6px' }} onClick={() => goToStep(1)}>
                                                <i className="fa fa-pencil-alt"></i>
                                            </Button>
                                        </div>
                                        <Row className="gy-2">
                                            <Col md={3}><span className="text-muted" style={{ fontSize: '0.8rem' }}>Comment no</span><div style={{ fontWeight: 600 }}>{patternFormData.pattern_no || '-'}</div></Col>
                                            <Col md={3}><span className="text-muted" style={{ fontSize: '0.8rem' }}>Category</span><div style={{ fontWeight: 600 }}>{nameOf(categories, patternFormData.category, 'category_name') || '-'}</div></Col>
                                            <Col md={4}><span className="text-muted" style={{ fontSize: '0.8rem' }}>Heading</span><div style={{ fontWeight: 600 }}>{patternFormData.pattern_head || '-'}</div></Col>
                                            <Col md={2}><span className="text-muted" style={{ fontSize: '0.8rem' }}>Cutoff</span><div style={{ fontWeight: 600 }}>{patternFormData.cutoff_days ? `${patternFormData.cutoff_days} days` : '-'}</div></Col>
                                        </Row>
                                    </div>

                                    <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#94a3b8' }}>PRIMARY HANDLERS (RESPONDERS)</span>
                                            <Button variant="outline-primary" size="sm" className="shadow" style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '12px', borderRadius: '6px' }} onClick={() => goToStep(2)}>
                                                <i className="fa fa-pencil-alt"></i>
                                            </Button>
                                        </div>
                                        <div className="mb-2">
                                            <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>{patternFormData.pattern_type} route</span>
                                        </div>
                                        {!['HOD', 'BOD'].includes(patternFormData.pattern_type) && patternFormData.departments.length > 0 && (
                                            <div className="d-flex flex-wrap gap-2 mb-2">
                                                {patternFormData.departments.map(id => (
                                                    <span key={id} style={{ background: '#eef2ff', color: '#3730a3', padding: '4px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>{nameOf(allDepartments, id, 'department_name', 'name')}</span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="d-flex flex-wrap gap-2">
                                            {patternFormData.employees.length === 0 ? <span className="text-muted" style={{ fontSize: '0.85rem' }}>No responders selected.</span> :
                                                patternFormData.employees.map(id => (
                                                    <span key={id} style={{ background: '#ecfdf5', color: '#065f46', padding: '4px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>
                                                        {patternFormData.pattern_type === 'BOD' ? nameOf(allBODs, id, 'name') : nameOf(allEmployees, id, 'user_name')}
                                                    </span>
                                                ))}
                                        </div>
                                    </div>

                                    <div style={{ padding: '1.2rem 1.5rem' }}>
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#94a3b8' }}>FINAL DECISION MAKERS (EVALUATORS)</span>
                                            <Button variant="outline-primary" size="sm" className="shadow" style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '12px', borderRadius: '6px' }} onClick={() => goToStep(3)}>
                                                <i className="fa fa-pencil-alt"></i>
                                            </Button>
                                        </div>
                                        <div className="mb-2">
                                            <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>{patternFormData.decision_type} route</span>
                                        </div>
                                        {!['HOD', 'BOD'].includes(patternFormData.decision_type) && patternFormData.decision_departments.length > 0 && (
                                            <div className="d-flex flex-wrap gap-2 mb-2">
                                                {patternFormData.decision_departments.map(id => (
                                                    <span key={id} style={{ background: '#eef2ff', color: '#3730a3', padding: '4px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>{nameOf(allDepartments, id, 'department_name', 'name')}</span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="d-flex flex-wrap gap-2">
                                            {patternFormData.decision_makers.length === 0 ? <span className="text-muted" style={{ fontSize: '0.85rem' }}>No evaluators selected.</span> :
                                                patternFormData.decision_makers.map(id => (
                                                    <span key={id} style={{ background: '#ecfdf5', color: '#065f46', padding: '4px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>
                                                        {patternFormData.decision_type === 'BOD' ? nameOf(allBODs, id, 'name') : nameOf(allEmployees, id, 'user_name')}
                                                    </span>
                                                ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            )}
                            
                            <div className="d-flex justify-content-end align-items-center gap-2 mt-5 pt-4 border-top">
                                <Button 
                                    type="button" 
                                    className="btn-cancel-custom"
                                    onClick={handleClosePatternModal} 
                                    style={{ borderRadius: '8px', fontWeight: 600, padding: '0.6rem 2rem', backgroundColor: '#dc3545', borderColor: '#dc3545', color: '#ffffff' }}
                                >
                                    Cancel
                                </Button>
                                {/* {formStep > 1 && (
                                    <Button variant="outline-secondary" onClick={() => { setStepError(''); setFormStep(formStep - 1); }} style={{ borderRadius: '8px', fontWeight: 600, padding: '0.6rem 1.6rem' }}>
                                        Back
                                    </Button>
                                )} */}
                                {formStep < WIZARD_STEPS.length ? (
                                    <Button type="button" onClick={() => goToStep(formStep + 1)} style={{ fontWeight: '700', padding: '0.6rem 2.2rem', borderRadius: '8px', backgroundColor: '#0a500f', borderColor: '#0a500f', color: 'white' }}>
                                        Continue
                                    </Button>
                                ) : (
                                    <Button type="button" onClick={handleSavePattern} style={{ fontWeight: '700', padding: '0.6rem 2.2rem', borderRadius: '8px', backgroundColor: '#0a500f', borderColor: '#0a500f' }}>
                                        {editPatternId ? 'Update pattern' : 'Save pattern'}
                                    </Button>
                                )}
                            </div>
                        </Form>
                    </Card.Body>
                </Card>
            </div>
        )}
        </div>
    );
};

export default CommentPattern;