import React, { useState, useEffect } from 'react';
import { Row, Col, Form, Button, Card } from 'react-bootstrap';
import Select from 'react-select';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import ComplaintService from '../../../services/ComplaintService';
import { usePageTitle } from '../../../context/TitleContext';

const ComplaintForm = ({ onSuccess }) => {
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [patterns, setPatterns] = useState([]);
    const [formData, setFormData] = useState({ 
        title: '', 
        category: null, 
        pattern: null, 
        priority: { value: 'Medium', label: 'Medium Priority' }, 
        cutoff_date: '',
        description: '' 
    });
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingPatterns, setLoadingPatterns] = useState(false);
    const [nextComplaintId, setNextComplaintId] = useState('');
    
    usePageTitle("Complaint Form");

    const customSelectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#6d4aff' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 2px rgba(109,74,255,0.15)' : 'none',
            '&:hover': { borderColor: '#6d4aff' },
            borderRadius: '10px',
            fontSize: '14px',
        }),
        menu: base => ({ ...base, zIndex: 9999, fontSize: '0.875rem' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#6d4aff' : state.isFocused ? '#f0ecff' : 'white',
            color: state.isSelected ? 'white' : '#333',
            cursor: 'pointer',
        }),
    };

    useEffect(() => {
        fetchCategories();
        fetchNextId();
    }, []);

    const fetchNextId = async () => {
        try {
            const res = await ComplaintService.getNextComplaintId();
            if (res.data && res.data.next_id) {
                setNextComplaintId(res.data.next_id);
            }
        } catch (err) {
            console.error("Error fetching next complaint ID", err);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await ComplaintService.getCategories();
            setCategories(res.data.results || res.data);
        } catch (err) {
            console.error("Error fetching categories", err);
        }
    };

    useEffect(() => {
        if (formData.category && formData.category.value) {
            fetchPatterns(formData.category.value);
        } else {
            setPatterns([]);
            setFormData(prev => ({ ...prev, pattern: null, priority: { value: 'Medium', label: 'Medium Priority' }, cutoff_date: '' }));
        }
    }, [formData.category]);

    const fetchPatterns = async (categoryId) => {
        setLoadingPatterns(true);
        try {
            const res = await ComplaintService.getPatterns({ category: categoryId, is_active: true });
            setPatterns(res.data.results || res.data);
        } catch (err) {
            console.error("Error fetching patterns", err);
        } finally {
            setLoadingPatterns(false);
        }
    };

    const handlePatternChange = (selectedOption) => {
        const patternId = selectedOption ? selectedOption.value : null;
        const selectedPattern = patterns.find(p => String(p.id) === String(patternId));
        
        let calculatedCutoff = '';
        if (selectedPattern && selectedPattern.cutoff_days) {
            const date = new Date();
            date.setDate(date.getDate() + selectedPattern.cutoff_days);
            calculatedCutoff = date.toISOString().split('T')[0];
        }

        setFormData(prev => ({ 
            ...prev, 
            pattern: selectedOption,
            priority: selectedPattern 
                ? { value: selectedPattern.priority, label: selectedPattern.priority + ' Priority' } 
                : { value: 'Medium', label: 'Medium Priority' },
            cutoff_date: calculatedCutoff
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        
        const data = new FormData();
        Object.keys(formData).forEach(key => {
            if (formData[key]) {
                if (typeof formData[key] === 'object' && formData[key].value) {
                    data.append(key, formData[key].value);
                } else if (typeof formData[key] !== 'object') {
                    data.append(key, formData[key]);
                }
            }
        });
        if (file) data.append('attachment', file);

        try {
            await ComplaintService.createComplaint(data);
            Swal.fire({
                title: 'Success!',
                text: 'Your complaint has been submitted successfully.',
                icon: 'success',
                confirmButtonColor: '#0a500f',
            }).then(() => {
                if (onSuccess) {
                    onSuccess();
                } else {
                    navigate('/complaints/my');
                }
            });
        } catch (err) {
            console.error("Submission error", err);
            Swal.fire('Error', 'Failed to submit complaint. Please check your inputs.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container-fluid">
            <div className="page-titles">
                <button
                    onClick={() => navigate('/complaints')}
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>
            
            <div className="row scfm-modal">
                <style>{`
                    .scfm-modal .modal-header-custom {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 24px 28px 16px 28px;
                        border-bottom: 1px solid #f1f5f9;
                    }
                    .scfm-modal .modal-icon-circle {
                        width: 48px;
                        height: 48px;
                        background-color: #0a500f;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                    }
                    .scfm-modal .modal-close-x {
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
                    .scfm-modal .modal-close-x:hover { color: #555; }
                    .scfm-modal .modal-body-custom { padding: 24px 28px; }
                    .scfm-modal .modal-footer-custom {
                        display: flex;
                        align-items: center;
                        justify-content: flex-end;
                        padding: 20px 28px 24px 28px;
                        border-top: 1px solid #f1f5f9;
                        background-color: #fafbfc;
                        gap: 12px;
                    }
                    .scfm-modal .form-label-custom {
                        font-size: 14px;
                        font-weight: 500;
                        color: #4a5568;
                        margin-bottom: 8px;
                        display: block;
                    }
                    .scfm-modal .form-control-custom {
                        border: 1px solid #cbd5e1;
                        border-radius: 10px;
                        padding: 12px 16px;
                        font-size: 14px;
                        color: #334155;
                        background-color: #fff;
                        transition: border-color 0.2s, box-shadow 0.2s;
                        width: 100%;
                    }
                    .scfm-modal .form-control-custom:focus {
                        outline: none;
                        border-color: #0a500f;
                        box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                    }
                    .scfm-modal .form-control-custom::placeholder { color: #94a3b8; }
                    .scfm-modal .btn-close-custom {
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
                    .scfm-modal .btn-close-custom:hover { background-color: #bb2d3b !important; }
                    .scfm-modal .btn-save-custom {
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
                    .scfm-modal .btn-save-custom:hover { background-color: #073d0b !important; }
                    .scfm-modal .modal-content-custom {
                        border-radius: 16px;
                        border: none;
                        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
                        overflow: hidden;
                        background: #fff;
                        margin-bottom: 2rem;
                    }
                `}</style>
                <div className="col-12">
                    <div className="modal-content-custom">
                        <div className="modal-header-custom">
                            <div className="d-flex align-items-center gap-3">
                                <div className="modal-icon-circle">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 10H9v-2h6v2zm3-4H6V8h12v2z" fill="white" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                        Raise a New Ticket
                                    </h4>
                                    <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                        Please fill out the form below to submit your issue.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <Form onSubmit={handleSubmit}>
                            <div className="modal-body-custom">
                                <div className="row mb-lg-3">
                                    <div className="col-lg-3 col-md-12 mb-3 mb-lg-0">
                                        <label className="form-label-custom">Complaint ID</label>
                                        <input 
                                            type="text" 
                                            className="form-control-custom"
                                            placeholder={nextComplaintId || "Loading..."} 
                                            disabled
                                            style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b', fontWeight: 500 }}
                                        />
                                    </div>
                                    <div className="col-lg-5 col-md-12 mb-3 mb-lg-0">
                                        <label className="form-label-custom">Complaint Title <span className="text-danger">*</span></label>
                                        <input 
                                            required 
                                            type="text" 
                                            className="form-control-custom"
                                            value={formData.title} 
                                            onChange={e => setFormData({...formData, title: e.target.value})}
                                            placeholder="Enter complaint title"
                                        />
                                    </div>
                                    <div className="col-lg-4 col-md-12 mb-3 mb-lg-0">
                                        <label className="form-label-custom">Category <span className="text-danger">*</span></label>
                                        <Select 
                                            value={formData.category} 
                                            onChange={option => setFormData({...formData, category: option})}
                                            options={categories.map(c => ({ value: c.id, label: c.category_name }))}
                                            placeholder="Select a category"
                                            styles={customSelectStyles}
                                            required
                                        />
                                    </div>
                                </div>
                                
                                <div className="row mb-lg-3">
                                    <div className="col-lg-6 col-md-12 mb-3 mb-lg-0">
                                        <label className="form-label-custom">Comment Pattern <span className="text-danger">*</span></label>
                                        <Select 
                                            isDisabled={!formData.category || loadingPatterns}
                                            value={formData.pattern} 
                                            onChange={handlePatternChange}
                                            options={patterns.map(p => ({ value: p.id, label: p.pattern_head }))}
                                            placeholder={loadingPatterns ? 'Loading...' : 'Select a pattern'}
                                            styles={customSelectStyles}
                                            required
                                        />
                                    </div>
                                    <div className="col-lg-6 col-md-12 mb-3 mb-lg-0">
                                        <label className="form-label-custom">Priority Level</label>
                                        <Select 
                                            value={formData.priority} 
                                            onChange={option => setFormData({...formData, priority: option})}
                                            options={[
                                                { value: 'Low', label: 'Low Priority' },
                                                { value: 'Medium', label: 'Medium Priority' },
                                                { value: 'High', label: 'High Priority' },
                                                { value: 'Critical', label: 'Critical Priority' }
                                            ]}
                                            styles={customSelectStyles}
                                        />
                                    </div>
                                </div>

                                <div className="row mb-lg-3">
                                    <div className="col-lg-6 col-md-12 mb-3 mb-lg-0">
                                        <label className="form-label-custom">Attachment (Optional)</label>
                                        <input 
                                            type="file" 
                                            className="form-control-custom"
                                            onChange={e => setFile(e.target.files[0])}
                                        />
                                    </div>
                                    <div className="col-lg-6 col-md-12 mb-3 mb-lg-0">
                                        <label className="form-label-custom">Cutoff Date (Auto)</label>
                                        <input 
                                            type="date" 
                                            className="form-control-custom"
                                            readOnly
                                            value={formData.cutoff_date} 
                                        />
                                    </div>
                                </div>

                                <div className="row mb-3">
                                    <div className="col-md-12">
                                        <label className="form-label-custom">Detailed Description <span className="text-danger">*</span></label>
                                        <textarea 
                                            required 
                                            className="form-control-custom"
                                            rows={3} 
                                            value={formData.description} 
                                            onChange={e => setFormData({...formData, description: e.target.value})}
                                        ></textarea>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer-custom">
                                <Button type="button" className="btn-close-custom" onClick={() => navigate('/complaints/my')}>
                                    Cancel
                                </Button>
                                <Button type="submit" className="btn-save-custom" disabled={loading}>
                                    {loading ? 'Submitting...' : 'Submit'}
                                </Button>
                            </div>
                        </Form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ComplaintForm;