import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../../../services/AxiosInstance';

const LeadCreate = ({ embedded, id: propId, editMode: propEditMode }) => {
    const { id: paramId } = useParams();
    const id = propId || paramId;
    const editMode = propEditMode || (id && window.location.pathname.includes('edit'));

    const navigate = useNavigate();
    const attachmentInputRef = useRef(null);
    const [users, setUsers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [leadSources, setLeadSources] = useState([]);
    const [loading, setLoading] = useState(editMode ? true : false);
    const [formData, setFormData] = useState({
        lead_owner: '',
        category: '',
        first_name: '', last_name: '', company: '', title: '', email: '', phone: '', fax: '', mobile: '', website: '',
        lead_source: '', lead_status: 'Not Contacted', industry: '', no_of_employees: '', annual_revenue: '', rating: '',
        email_opt_out: false, skype_id: '', secondary_email: '', twitter: '',
        country: '', flat_house_no: '', street_address: '', city: '', state_province: '', zip_postal_code: '', latitude: '', longitude: '',
        description: '', image: null, attachment: null,
        contact_preferences: ''
    });

    const handleRemoveAttachment = () => {
        setFormData(prev => ({ ...prev, attachment: null }));
        if (attachmentInputRef.current) {
            attachmentInputRef.current.value = '';
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Users for dropdown
                const usersRes = await axiosInstance.get('/api/hr/users/');
                if (usersRes.status === 200) {
                    setUsers(usersRes.data);
                    
                    // If creating new, default to current user
                    if (!editMode) {
                        const userDetails = JSON.parse(localStorage.getItem('userDetails'));
                        if (userDetails && userDetails.id) {
                            setFormData(prev => ({ ...prev, lead_owner: userDetails.id }));
                        }
                    }
                }

                // Fetch Lead Categories
                const catRes = await axiosInstance.get('/api/crm/categories/');
                if (catRes.status === 200) {
                    setCategories(catRes.data);
                }

                // Fetch Lead Sources
                try {
                    const sourceRes = await axiosInstance.get('/api/crm/sources/');
                    if (sourceRes.status === 200) {
                        const sData = Array.isArray(sourceRes.data) ? sourceRes.data : (sourceRes.data?.results || []);
                        setLeadSources(sData);
                    }
                } catch (sErr) {
                    console.error("Error fetching lead sources", sErr);
                }

                // If editing, fetch lead details
                if (editMode && id) {
                    const leadRes = await axiosInstance.get(`/api/crm/leads/${id}/`);
                    if (leadRes.status === 200) {
                        const data = leadRes.data;
                        // Map foreign key IDs
                        const mappedData = { ...data };
                        if (data.lead_owner && typeof data.lead_owner === 'object') {
                            mappedData.lead_owner = data.lead_owner.id;
                        }
                        if (data.category && typeof data.category === 'object') {
                            mappedData.category = data.category.id;
                        } else if (data.category) {
                            mappedData.category = data.category;
                        }
                        setFormData(mappedData);
                    }
                }
            } catch (error) {
                console.error("Error fetching initialization data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [editMode, id]);

    const handleChange = (e) => {
        const { name, value, type, checked, files } = e.target;
        if (type === 'file') {
            setFormData(prev => ({ ...prev, [name]: files[0] }));
        } else if (name === 'contact_preferences_checkbox') {
            // Handle multiple checkboxes for contact preferences
            const currentPrefs = formData.contact_preferences ? formData.contact_preferences.split(',').filter(p => p) : [];
            let newPrefs;
            if (checked) {
                newPrefs = [...currentPrefs, value];
            } else {
                newPrefs = currentPrefs.filter(p => p !== value);
            }
            setFormData(prev => ({ ...prev, contact_preferences: newPrefs.join(',') }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            }));
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        
        const data = new FormData();
        Object.keys(formData).forEach(key => {
            if (formData[key] !== null && formData[key] !== undefined) {
                if (key === 'image' && typeof formData[key] === 'string') {
                    // Don't append existing image path
                    return;
                }
                if (key === 'attachment' && typeof formData[key] === 'string') {
                    // Don't append existing attachment path
                    return;
                }
                data.append(key, formData[key]);
            }
        });

        // Numeric fields cleanup in FormData
        const numericFields = ['no_of_employees', 'annual_revenue', 'latitude', 'longitude'];
        numericFields.forEach(field => {
            const val = data.get(field);
            if (val === '' || val === 'null' || val === 'undefined') {
                data.set(field, ''); // DRF numeric fields handle empty string as null if null=True
            }
        });

        try {
            let res;
            const config = {
                headers: { 'Content-Type': 'multipart/form-data' }
            };

            if (editMode && id) {
                res = await axiosInstance.put(`/api/crm/leads/${id}/`, data, config);
            } else {
                res = await axiosInstance.post('/api/crm/leads/', data, config);
            }

            if (res.status === 201 || res.status === 200) {
                if (embedded) {
                    alert(editMode ? "Lead record updated successfully." : "Lead ecosystem entry finalized successfully.");
                    if (editMode) navigate('/crm/leads');
                    else window.location.reload(); 
                } else {
                    navigate('/crm');
                }
            }
        } catch (error) {
            console.error("Error saving lead", error);
            const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : "Lead capturing failed. Verify input connectivity.";
            alert(errorMsg);
        }
    };

    const defaultLeadSourceChoices = [
        'Advertisement', 'Cold Call', 'Employee Referral', 'External Referral', 'Online Store',
        'Twitter', 'Facebook', 'Partner', 'Google+', 'Public Relations', 'Sales Email Alias',
        'Seminar Partner', 'Internal Seminar', 'Trade Show', 'Web Download', 'Web Research', 'Chat'
    ];

    const leadSourceChoices = React.useMemo(() => {
        if (leadSources && leadSources.length > 0) {
            const activeList = leadSources.filter(s => s.is_active !== false).map(s => s.name);
            if (formData.lead_source && !activeList.includes(formData.lead_source)) {
                return [formData.lead_source, ...activeList];
            }
            return activeList;
        }
        return defaultLeadSourceChoices;
    }, [leadSources, formData.lead_source]);

    const leadStatusChoices = [
        'Attempted to Contact', 'Contacted', 'Junk Lead',
        'Lost Lead', 'Not Contacted', 'Qualified / Opportunity', 'Disqualified'
    ];

    const industryChoices = [
        'ASP', 'Data/Telecom OEM', 'ERP', 'Government/Military', 'Large Enterprise',
        'ManagementISV', 'MSP (Management Service Provider)', 'Network Equipment Enterprise',
        'Non-management ISV', 'Optical Networking', 'Service Provider',
        'Small/Medium Enterprise', 'Storage Equipment', 'Storage Service Provider',
        'Systems Integrator', 'Wireless Industry'
    ];

    const ratingChoices = ['Acquired', 'Active', 'Market Failed', 'Project Cancelled', 'Shut Down'];

    return (
        <div className="crm-form-view">
            <style>{`
                .crm-form-section {
                    background: var(--crm-card-bg);
                    border-radius: var(--crm-card-radius);
                    padding: 2.5rem;
                    box-shadow: var(--crm-shadow);
                    margin-bottom: 2.5rem;
                    border: 1px solid var(--crm-border);
                }

                .crm-form-header {
                    margin-bottom: 2rem;
                    border-bottom: 1px solid var(--crm-border);
                    padding-bottom: 1.25rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .crm-form-header h3 {
                    font-size: 1.3rem;
                    font-weight: 800;
                    margin: 0;
                    color: var(--crm-text-primary);
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .crm-form-header h3 i {
                    color: var(--crm-accent);
                    font-size: 1.1rem;
                }

                .crm-input-group {
                    margin-bottom: 1.75rem;
                }

                .crm-label {
                    display: block;
                    font-size: 0.8rem;
                    text-transform: uppercase;
                    color: var(--crm-text-secondary);
                    letter-spacing: 1px;
                    font-weight: 700;
                    margin-bottom: 0.75rem;
                }

                .crm-input {
                    width: 100%;
                    padding: 0.9rem 1.25rem;
                    background: var(--crm-bg);
                    border: 1px solid var(--crm-border);
                    border-radius: 12px;
                    color: var(--crm-text-primary);
                    font-size: 0.95rem;
                    font-weight: 500;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .crm-input:focus {
                    outline: none;
                    border-color: var(--crm-accent);
                    box-shadow: 0 0 0 4px var(--crm-accent-soft);
                    background: var(--crm-card-bg);
                }

                .crm-select {
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 1rem center;
                    background-size: 1.2em;
                }

                .crm-textarea {
                    min-height: 120px;
                    resize: vertical;
                }

                .crm-submit-btn {
                    background: var(--crm-accent);
                    color: #fff;
                    border: none;
                    padding: 1rem 2.5rem;
                    border-radius: 14px;
                    font-weight: 800;
                    font-size: 1rem;
                    box-shadow: 0 10px 20px rgba(0, 209, 255, 0.2);
                    transition: all 0.3s;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .crm-submit-btn:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 15px 30px rgba(0, 209, 255, 0.3);
                }

                .crm-required {
                    color: var(--crm-accent);
                    margin-left: 2px;
                }

                .crm-image-placeholder {
                    width: 70px;
                    height: 70px;
                    background: var(--crm-bg);
                    border: 2px dashed var(--crm-border);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--crm-text-secondary);
                    font-size: 1.5rem;
                    margin-bottom: 0;
                }

                .crm-image-upload {
                    display: none;
                }

                .crm-image-preview {
                    width: 70px;
                    height: 70px;
                    border-radius: 50%;
                    object-fit: cover;
                    border: 2px solid var(--crm-accent);
                }

                .crm-checkbox-group {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-top: 1rem;
                }

                .crm-checkbox {
                    width: 20px;
                    height: 20px;
                    accent-color: var(--crm-accent);
                }

                .crm-loading-overlay {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(var(--crm-card-bg-rgb), 0.7);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                    border-radius: var(--crm-card-radius);
                }

                .crm-attachment-box {
                    border: 2px dashed var(--crm-border);
                    border-radius: 12px;
                    padding: 1.25rem 1.5rem;
                    background: var(--crm-bg);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                }

                .crm-attachment-box:hover {
                    border-color: var(--crm-accent);
                    background: var(--crm-accent-soft);
                }

                .crm-attachment-info {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    min-width: 0;
                }

                .crm-attachment-icon {
                    width: 44px;
                    height: 44px;
                    border-radius: 10px;
                    background: var(--crm-accent-soft, rgba(0, 209, 255, 0.1));
                    color: var(--crm-accent, #00d1ff);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.25rem;
                    flex-shrink: 0;
                }
            `}</style>

            <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
                {loading && (
                    <div className="crm-loading-overlay">
                        <div className="text-center">
                            <i className="fa fa-spinner fa-spin fa-2x text-primary mb-2"></i>
                            <p className="fw-bold">Synchronizing entity data...</p>
                        </div>
                    </div>
                )}
                <div className="crm-form-section">
                    <div className="crm-form-header">
                        <h3><i className="fa fa-user-circle-o"></i> Lead Information</h3>
                        <label className="crm-image-placeholder" style={{ cursor: 'pointer' }}>
                            {formData.image ? (
                                typeof formData.image === 'string' ? (
                                    <img src={formData.image} alt="Preview" className="crm-image-preview" />
                                ) : (
                                    <img src={URL.createObjectURL(formData.image)} alt="Preview" className="crm-image-preview" />
                                )
                            ) : (
                                <i className="fa fa-camera"></i>
                            )}
                            <input type="file" className="crm-image-upload" name="image" accept="image/*" onChange={handleChange} />
                        </label>
                    </div>

                    <div className="row">
                        <div className="col-md-4">
                            <div className="crm-input-group">
                                <label className="crm-label">Lead Owner</label>
                                <select className="crm-input crm-select" name="lead_owner" value={formData.lead_owner} onChange={handleChange}>
                                    <option value="">-Select Owner-</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.first_name} {u.last_name} ({u.department ? u.department.name : 'No Dept'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="crm-input-group">
                                <label className="crm-label">Lead Category <span className="crm-required">*</span></label>
                                <select className="crm-input crm-select" name="category" value={formData.category} onChange={handleChange} required>
                                    <option value="">-Select Category-</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="crm-input-group">
                                <label className="crm-label">Company <span className="crm-required">*</span></label>
                                <input type="text" className="crm-input" name="company" value={formData.company || ''} placeholder="Acme Inc." required onChange={handleChange} />
                            </div>
                        </div>

                        <div className="col-md-6">
                            <div className="crm-input-group">
                                <label className="crm-label">First Name</label>
                                <input type="text" className="crm-input" name="first_name" value={formData.first_name || ''} placeholder="John" onChange={handleChange} />
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="crm-input-group">
                                <label className="crm-label">Last Name <span className="crm-required">*</span></label>
                                <input type="text" className="crm-input" name="last_name" value={formData.last_name || ''} placeholder="Doe" required onChange={handleChange} />
                            </div>
                        </div>

                        <div className="col-md-6">
                            <div className="crm-input-group">
                                <label className="crm-label">Title</label>
                                <input type="text" className="crm-input" name="title" value={formData.title || ''} placeholder="Regional Director" onChange={handleChange} />
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="crm-input-group">
                                <label className="crm-label">Email</label>
                                <input type="email" className="crm-input" name="email" value={formData.email || ''} placeholder="john.doe@company.com" onChange={handleChange} />
                            </div>
                        </div>

                        <div className="col-md-6">
                            <div className="crm-input-group">
                                <label className="crm-label">Phone</label>
                                <input type="text" className="crm-input" name="phone" value={formData.phone || ''} placeholder="+1 (555) 000-0000" onChange={handleChange} />
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="crm-input-group">
                                <label className="crm-label">Fax</label>
                                <input type="text" className="crm-input" name="fax" value={formData.fax || ''} placeholder="+1 (555) 000-0001" onChange={handleChange} />
                            </div>
                        </div>

                        <div className="col-md-6">
                            <div className="crm-input-group">
                                <label className="crm-label">Mobile</label>
                                <input type="text" className="crm-input" name="mobile" value={formData.mobile || ''} placeholder="+1 (555) 999-9999" onChange={handleChange} />
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="crm-input-group">
                                <label className="crm-label">Website</label>
                                <input type="url" className="crm-input" name="website" value={formData.website || ''} placeholder="https://www.acme.com" onChange={handleChange} />
                            </div>
                        </div>

                        <div className="col-md-6">
                            <div className="crm-input-group">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <label className="crm-label mb-0">Lead Source</label>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/crm/sources')}
                                        className="btn btn-link p-0 text-decoration-none"
                                        style={{ fontSize: '11px', color: 'var(--crm-accent, #00d1ff)', fontWeight: 600 }}
                                        title="Manage Lead Sources"
                                    >
                                        <i className="fa fa-plus-circle me-1"></i>Manage
                                    </button>
                                </div>
                                <select className="crm-input crm-select" name="lead_source" value={formData.lead_source || ''} onChange={handleChange}>
                                    <option value="">-None-</option>
                                    {leadSourceChoices.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                        {editMode && (
                            <div className="col-md-6">
                                <div className="crm-input-group">
                                    <label className="crm-label">Lead Status</label>
                                    <select className="crm-input crm-select" name="lead_status" value={formData.lead_status || ''} onChange={handleChange}>
                                        <option value="">-None-</option>
                                        {leadStatusChoices.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="col-md-6">
                            <div className="crm-input-group">
                                <label className="crm-label">Industry</label>
                                <select className="crm-input crm-select" name="industry" value={formData.industry || ''} onChange={handleChange}>
                                    <option value="">-None-</option>
                                    {industryChoices.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="crm-input-group">
                                <label className="crm-label">No. of Employees</label>
                                <input type="number" className="crm-input" name="no_of_employees" value={formData.no_of_employees || ''} placeholder="500" onChange={handleChange} />
                            </div>
                        </div>

                        <div className="col-md-6">
                            <div className="crm-input-group">
                                <label className="crm-label">Annual Revenue</label>
                                <input type="number" className="crm-input" name="annual_revenue" value={formData.annual_revenue || ''} placeholder="" onChange={handleChange} />
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="crm-input-group">
                                <label className="crm-label">Rating</label>
                                <select className="crm-input crm-select" name="rating" value={formData.rating || ''} onChange={handleChange}>
                                    <option value="">-None-</option>
                                    {ratingChoices.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="col-md-6">
                            <div className="crm-checkbox-group">
                                <input type="checkbox" className="crm-checkbox" id="email_opt_out" name="email_opt_out" checked={formData.email_opt_out || false} onChange={handleChange} />
                                <label className="crm-label mb-0" htmlFor="email_opt_out" style={{ cursor: 'pointer' }}>Email Opt Out</label>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="crm-input-group">
                                <label className="crm-label">Skype ID</label>
                                <input type="text" className="crm-input" name="skype_id" value={formData.skype_id || ''} placeholder="live:john.doe" onChange={handleChange} />
                            </div>
                        </div>

                        <div className="col-md-6">
                            <div className="crm-input-group">
                                <label className="crm-label">Twitter</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--crm-text-secondary)', fontWeight: '700' }}>@</span>
                                    <input type="text" className="crm-input" name="twitter" value={formData.twitter || ''} placeholder="johndoe" style={{ paddingLeft: '2.5rem' }} onChange={handleChange} />
                                </div>
                            </div>
                        </div>

                        <div className="col-md-12">
                            <div className="crm-input-group">
                                <label className="crm-label">Contact Preferences</label>
                                <div className="d-flex gap-4 mt-2">
                                    {['Phone', 'WhatsApp', 'Email'].map(pref => (
                                        <div key={pref} className="crm-checkbox-group mt-0">
                                            <input 
                                                type="checkbox" 
                                                className="crm-checkbox" 
                                                id={`pref_${pref}`} 
                                                name="contact_preferences_checkbox" 
                                                value={pref}
                                                checked={formData.contact_preferences?.split(',').includes(pref)} 
                                                onChange={handleChange} 
                                            />
                                            <label className="crm-label mb-0" htmlFor={`pref_${pref}`} style={{ cursor: 'pointer', textTransform: 'none' }}>{pref}</label>
                                        </div>
                                    ))}
                                </div>
                                <small className="text-muted mt-2 d-block">Select all that apply for this lead.</small>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="crm-form-section">
                    <div className="crm-form-header">
                        <h3><i className="fa fa-map-marker"></i> Address Information</h3>
                    </div>

                    <div className="row">
                        <div className="col-md-6">
                            <div className="crm-input-group">
                                <label className="crm-label">Country / Region</label>
                                <input type="text" className="crm-input" name="country" value={formData.country || ''} placeholder="India" onChange={handleChange} />
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="crm-input-group">
                                <label className="crm-label">Flat / House No. / Building / Name</label>
                                <input type="text" className="crm-input" name="flat_house_no" value={formData.flat_house_no || ''} placeholder="Wing A, Flat 501" onChange={handleChange} />
                            </div>
                        </div>

                        <div className="col-md-12">
                            <div className="crm-input-group">
                                <label className="crm-label">Street Address</label>
                                <input type="text" className="crm-input" name="street_address" value={formData.street_address || ''} placeholder="123 Alpha Avenue" onChange={handleChange} />
                            </div>
                        </div>

                        <div className="col-md-6">
                            <div className="crm-input-group">
                                <label className="crm-label">City</label>
                                <input type="text" className="crm-input" name="city" value={formData.city || ''} placeholder="Chennai" onChange={handleChange} />
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="crm-input-group">
                                <label className="crm-label">State / Province</label>
                                <input type="text" className="crm-input" name="state_province" value={formData.state_province || ''} placeholder="Tamil Nadu" onChange={handleChange} />
                            </div>
                        </div>

                        <div className="col-md-6">
                            <div className="crm-input-group">
                                <label className="crm-label">Zip / Postal Code</label>
                                <input type="text" className="crm-input" name="zip_postal_code" value={formData.zip_postal_code || ''} placeholder="600001" onChange={handleChange} />
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="row">
                                <div className="col-6">
                                    <div className="crm-input-group">
                                        <label className="crm-label">Latitude</label>
                                        <input type="number" step="any" className="crm-input" name="latitude" value={formData.latitude || ''} placeholder="13.0827" onChange={handleChange} />
                                    </div>
                                </div>
                                <div className="col-6">
                                    <div className="crm-input-group">
                                        <label className="crm-label">Longitude</label>
                                        <input type="number" step="any" className="crm-input" name="longitude" value={formData.longitude || ''} placeholder="80.2707" onChange={handleChange} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="crm-form-section">
                    <div className="crm-form-header">
                        <h3><i className="fa fa-file-text-o"></i> Description & Attachment</h3>
                    </div>

                    <div className="crm-input-group">
                        <label className="crm-label">Description</label>
                        <textarea className="crm-input crm-textarea" name="description" value={formData.description || ''} placeholder="Provide detailed context for this lead..." onChange={handleChange}></textarea>
                    </div>

                    <div className="crm-input-group">
                        <label className="crm-label">Attachment</label>
                        <input
                            type="file"
                            ref={attachmentInputRef}
                            name="attachment"
                            id="lead-attachment"
                            style={{ display: 'none' }}
                            onChange={handleChange}
                        />
                        {!formData.attachment ? (
                            <div
                                className="crm-attachment-box"
                                onClick={() => attachmentInputRef.current && attachmentInputRef.current.click()}
                                style={{ cursor: 'pointer' }}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        attachmentInputRef.current && attachmentInputRef.current.click();
                                    }
                                }}
                            >
                                <div className="crm-attachment-info">
                                    <div className="crm-attachment-icon">
                                        <i className="fa fa-paperclip"></i>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--crm-text-primary)' }}>
                                            Click to attach a file
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--crm-text-secondary)' }}>
                                            Upload documents, PDFs, spreadsheets, images, etc.
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-sm"
                                    style={{
                                        background: 'transparent',
                                        color: 'var(--crm-accent, #00d1ff)',
                                        border: '1px solid var(--crm-accent, #00d1ff)',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        pointerEvents: 'none',
                                        padding: '0.4rem 1rem'
                                    }}
                                >
                                    Browse File
                                </button>
                            </div>
                        ) : (
                            <div className="crm-attachment-box" style={{ borderColor: 'var(--crm-accent, #00d1ff)', background: 'var(--crm-card-bg)' }}>
                                <div className="crm-attachment-info">
                                    <div className="crm-attachment-icon">
                                        <i className="fa fa-file-text-o"></i>
                                    </div>
                                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--crm-text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                            {typeof formData.attachment === 'string'
                                                ? formData.attachment.split('/').pop()
                                                : formData.attachment.name}
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--crm-text-secondary)' }}>
                                            {typeof formData.attachment === 'string' ? (
                                                <a
                                                    href={formData.attachment}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ color: 'var(--crm-accent, #00d1ff)', textDecoration: 'underline' }}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <i className="fa fa-external-link me-1"></i> View / Download file
                                                </a>
                                            ) : (
                                                `${(formData.attachment.size / 1024).toFixed(1)} KB`
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-primary"
                                        style={{ borderRadius: '8px', fontWeight: 600, padding: '0.4rem 0.8rem' }}
                                        onClick={() => attachmentInputRef.current && attachmentInputRef.current.click()}
                                    >
                                        Change
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger"
                                        style={{ borderRadius: '8px', fontWeight: 600, padding: '0.4rem 0.8rem' }}
                                        onClick={handleRemoveAttachment}
                                        title="Remove attachment"
                                    >
                                        <i className="fa fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="d-flex justify-content-end mt-4">
                        <button type="submit" className="crm-submit-btn">
                            <i className="fa fa-check-circle"></i> {editMode ? 'UPDATE LEAD RECORD' : 'SAVE LEAD RECORD'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default LeadCreate;
