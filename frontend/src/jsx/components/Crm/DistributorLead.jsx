import React, { useState, useEffect } from 'react';
import CRMService from '../../../services/CRMService';
import Select from 'react-select';
import axiosInstance from '../../../services/AxiosInstance';
import Swal from 'sweetalert2';
import { useLocation, useNavigate } from 'react-router-dom';

const DistributorLead = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const editId = location.state?.editId;

    const [zones, setZones] = useState([]);
    const [loadingZones, setLoadingZones] = useState(true);

    const [formData, setFormData] = useState({
        // Basic Info
        fullName: '', contactNumber: '', email: '', designation: '', companyName: '', website: '',
        // Address
        address: '', pincode: '', city: '', state: '', country: 'India',
        // Business Reg
        isRegisteredBusiness: false, gstNumber: '', fssaiLicenseNumber: '', hasPriorExperience: false, experienceDescription: '',
        // Capital
        hasWorkingCapital: false, initialInvestmentCapacity: '', hasStorageFacility: false, storageFacilityDescription: '', hasDeliveryInfrastructure: false, deliveryInfrastructureDescription: '',
        // Coverage Areas
        coverageAreas: [],
        // Additional
        leadSource: '', notes: ''
    });

    const [files, setFiles] = useState({
        businessRegCert: null, gstCert: null, addressProof: null, panCard: null,
        bankStatement: null, proprietorPhoto: null, proprietorIdProof: null, fssaiLicense: null
    });

    useEffect(() => {
        fetchZones();
        if (editId) {
            fetchLeadData(editId);
        }
    }, [editId]);

    const fetchLeadData = async (id) => {
        try {
            const response = await CRMService.getDistributorLead(id);
            const data = response.data;
            setFormData({
                fullName: data.full_name || '', contactNumber: data.contact_number || '', email: data.email || '', designation: data.designation || '', companyName: data.company_name || '', website: data.website || '',
                address: data.address || '', pincode: data.pincode || '', city: data.city || '', state: data.state || '', country: data.country || 'India',
                isRegisteredBusiness: data.is_registered_business || false, gstNumber: data.gst_number || '', fssaiLicenseNumber: data.fssai_license_number || '', hasPriorExperience: data.has_prior_experience || false, experienceDescription: data.experience_description || '',
                hasWorkingCapital: data.has_working_capital || false, initialInvestmentCapacity: data.initial_investment_capacity || '', hasStorageFacility: data.has_storage_facility || false, storageFacilityDescription: data.storage_facility_description || '', hasDeliveryInfrastructure: data.has_delivery_infrastructure || false, deliveryInfrastructureDescription: data.delivery_infrastructure_description || '',
                coverageAreas: data.coverage_areas || [], leadSource: data.lead_source || '', notes: data.notes || ''
            });
        } catch (error) {
            console.error("Error fetching lead data for edit", error);
        }
    };

    const fetchZones = async () => {
        try {
            const response = await CRMService.getDistributionZones();
            setZones(response.data || []);
        } catch (error) {
            console.error("Error fetching distribution zones", error);
        } finally {
            setLoadingZones(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleFileChange = (e) => {
        const { name, files: selectedFiles } = e.target;
        if (selectedFiles.length > 0) {
            setFiles(prev => ({
                ...prev,
                [name]: selectedFiles[0]
            }));
        }
    };

    const handleZoneToggle = (zoneId) => {
        setFormData(prev => {
            const current = [...prev.coverageAreas];
            if (current.includes(zoneId)) {
                return { ...prev, coverageAreas: current.filter(id => id !== zoneId) };
            } else {
                return { ...prev, coverageAreas: [...current, zoneId] };
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
          try {
              // Convert camelCase to snake_case for backend
              const payload = {
                  full_name: formData.fullName,
                  contact_number: formData.contactNumber,
                  email: formData.email,
                  designation: formData.designation,
                  company_name: formData.companyName,
                  website: formData.website,
                  address: formData.address,
                  pincode: formData.pincode,
                  city: formData.city,
                  state: formData.state,
                  country: formData.country,
                  is_registered_business: formData.isRegisteredBusiness,
                  gst_number: formData.gstNumber,
                  fssai_license_number: formData.fssaiLicenseNumber,
                  registration_number: formData.registrationNumber,
                  has_prior_experience: formData.hasPriorExperience,
                  experience_description: formData.experienceDescription,
                  has_storage_facility: formData.hasStorageFacility,
                  has_delivery_infrastructure: formData.hasDeliveryInfrastructure,
                  lead_source: formData.leadSource,
                  notes: formData.notes,
                    coverage_areas: formData.coverageAreas,
                };
                
                if (editId) {
                    await CRMService.updateDistributorLead(editId, payload);
                    await Swal.fire({
                        icon: 'success',
                        title: 'Lead Updated',
                        text: 'Distributor lead has been successfully updated.',
                        confirmButtonColor: '#00d1ff'
                    });
                    navigate('/crm/leads-list');
                } else {
                    await axiosInstance.post('/api/crm/distributor-leads/', payload);
                    await Swal.fire({
                        icon: 'success',
                        title: 'Lead Captured',
                        text: 'Distributor lead has been successfully registered in the ecosystem.',
                        confirmButtonColor: '#00d1ff'
                    });
                    // Reset form
                    setFormData({
                        fullName: '', contactNumber: '', email: '', designation: '', companyName: '', website: '',
                        address: '', pincode: '', city: '', state: '', country: 'India',
                        isRegisteredBusiness: false, gstNumber: '', fssaiLicenseNumber: '', hasPriorExperience: false, experienceDescription: '',
                        hasWorkingCapital: false, initialInvestmentCapacity: '', hasStorageFacility: false, storageFacilityDescription: '', hasDeliveryInfrastructure: false, deliveryInfrastructureDescription: '',
                        coverageAreas: [], leadSource: '', notes: ''
                    });
                    setFiles({
                        businessRegCert: null, gstCert: null, addressProof: null, panCard: null,
                        bankStatement: null, proprietorPhoto: null, proprietorIdProof: null, fssaiLicense: null
                    });
                }
            } catch (error) {
                console.error(error);
                Swal.fire({icon: 'error', title: 'Oops...', text: 'Failed to submit form!'});
                return;
            }
        };

    return (
        <div className="crm-lead-form">
            <style>{`
                .lead-form-container {
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .form-section-card {
                    background: var(--crm-card-bg);
                    border-radius: var(--crm-card-radius);
                    border: 1px solid var(--crm-border);
                    box-shadow: var(--crm-shadow);
                    padding: 2.5rem;
                    margin-bottom: 2rem;
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }
                .form-section-card:hover {
                    box-shadow: 0 12px 30px rgba(0, 209, 255, 0.08);
                }
                .section-title {
                    font-size: 1.25rem;
                    font-weight: 800;
                    color: var(--crm-text-primary);
                    margin-bottom: 2rem;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    border-bottom: 2px solid var(--crm-border);
                    padding-bottom: 1rem;
                }
                .section-title i {
                    color: var(--crm-accent);
                    background: var(--crm-accent-soft);
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 12px;
                    font-size: 1.1rem;
                }
                .crm-input-group {
                    margin-bottom: 1.5rem;
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
                .crm-label .required {
                    color: #ef4444;
                    margin-left: 4px;
                }
                .crm-input, .crm-select {
                    width: 100%;
                    padding: 0.85rem 1.25rem;
                    background: var(--crm-bg);
                    border: 1px solid var(--crm-border);
                    border-radius: 12px;
                    color: var(--crm-text-primary);
                    font-size: 0.95rem;
                    font-weight: 500;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .crm-input:focus, .crm-select:focus {
                    outline: none;
                    border-color: var(--crm-accent);
                    box-shadow: 0 0 0 4px var(--crm-accent-soft);
                    background: var(--crm-card-bg);
                }
                .crm-input:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .crm-checkbox-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 0.85rem 1.25rem;
                    background: var(--crm-bg);
                    border: 1px solid var(--crm-border);
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .crm-checkbox-wrapper:hover {
                    border-color: var(--crm-accent);
                    background: var(--crm-accent-soft);
                }
                .crm-checkbox {
                    width: 18px;
                    height: 18px;
                    accent-color: var(--crm-accent);
                    cursor: pointer;
                }
                .crm-checkbox-label {
                    font-weight: 600;
                    color: var(--crm-text-primary);
                    font-size: 0.95rem;
                    cursor: pointer;
                    margin: 0;
                }
                .zones-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                    gap: 1rem;
                }
                .zone-chip {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 1rem;
                    background: var(--crm-bg);
                    border: 2px solid var(--crm-border);
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .zone-chip.selected {
                    border-color: var(--crm-accent);
                    background: var(--crm-accent-soft);
                }
                .zone-chip h6 {
                    margin: 0;
                    font-weight: 700;
                    color: var(--crm-text-primary);
                }
                .zone-chip p {
                    margin: 0;
                    font-size: 0.75rem;
                    color: var(--crm-text-secondary);
                }
                .file-upload-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 1.5rem;
                }
                .file-upload-box {
                    border: 2px dashed var(--crm-border);
                    border-radius: 12px;
                    padding: 1.5rem;
                    text-align: center;
                    background: var(--crm-bg);
                    transition: all 0.3s;
                    position: relative;
                }
                .file-upload-box:hover {
                    border-color: var(--crm-accent);
                    background: var(--crm-accent-soft);
                }
                .file-upload-box input[type="file"] {
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                    opacity: 0;
                    cursor: pointer;
                }
                .file-upload-icon {
                    font-size: 2rem;
                    color: var(--crm-accent);
                    margin-bottom: 0.5rem;
                }
                .file-upload-title {
                    font-weight: 700;
                    font-size: 0.9rem;
                    color: var(--crm-text-primary);
                    margin-bottom: 0.25rem;
                }
                .file-upload-status {
                    font-size: 0.8rem;
                    color: var(--crm-text-secondary);
                    font-weight: 500;
                }
                .file-uploaded-text {
                    color: #22c55e;
                    font-weight: 700;
                }
                .crm-submit-btn {
                    background: linear-gradient(135deg, var(--crm-accent) 0%, #0099ff 100%);
                    color: #fff;
                    border: none;
                    padding: 1rem 3rem;
                    border-radius: 14px;
                    font-weight: 800;
                    font-size: 1.1rem;
                    letter-spacing: 1px;
                    box-shadow: 0 10px 25px rgba(0, 209, 255, 0.3);
                    transition: all 0.3s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 1rem;
                    cursor: pointer;
                    width: auto;
                    min-width: 300px;
                }
                .crm-submit-btn:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 15px 35px rgba(0, 209, 255, 0.4);
                }
            `}</style>

            <div className="lead-form-container">
                <form onSubmit={handleSubmit}>
                    
                    {/* Basic Information */}
                    <div className="form-section-card">
                        <h3 className="section-title"><i className="fa fa-user"></i> Basic Information</h3>
                        <div className="row">
                            <div className="col-md-4">
                                <div className="crm-input-group">
                                    <label className="crm-label">Full Name<span className="required">*</span></label>
                                    <input type="text" className="crm-input" name="fullName" value={formData.fullName} onChange={handleChange} required placeholder="John Doe" />
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="crm-input-group">
                                    <label className="crm-label">Contact Number<span className="required">*</span></label>
                                    <input type="text" className="crm-input" name="contactNumber" value={formData.contactNumber} onChange={handleChange} required placeholder="+91 XXXXX XXXXX" />
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="crm-input-group">
                                    <label className="crm-label">Email<span className="required">*</span></label>
                                    <input type="email" className="crm-input" name="email" value={formData.email} onChange={handleChange} required placeholder="john@company.com" />
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="crm-input-group">
                                    <label className="crm-label">Designation<span className="required">*</span></label>
                                    <input type="text" className="crm-input" name="designation" value={formData.designation} onChange={handleChange} required placeholder="e.g. Director" />
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="crm-input-group">
                                    <label className="crm-label">Company Name<span className="required">*</span></label>
                                    <input type="text" className="crm-input" name="companyName" value={formData.companyName} onChange={handleChange} required placeholder="Doe Enterprises" />
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="crm-input-group">
                                    <label className="crm-label">Website</label>
                                    <input type="url" className="crm-input" name="website" value={formData.website} onChange={handleChange} placeholder="https://..." />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Address Details */}
                    <div className="form-section-card">
                        <h3 className="section-title"><i className="fa fa-map-marker"></i> Address Details</h3>
                        <div className="row">
                            <div className="col-md-12">
                                <div className="crm-input-group">
                                    <label className="crm-label">Address<span className="required">*</span></label>
                                    <textarea className="crm-input" name="address" value={formData.address} onChange={handleChange} required placeholder="Full street address..." rows="2"></textarea>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="crm-input-group">
                                    <label className="crm-label">Pincode<span className="required">*</span></label>
                                    <input type="text" className="crm-input" name="pincode" value={formData.pincode} onChange={handleChange} required placeholder="686691" />
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="crm-input-group">
                                    <label className="crm-label">City<span className="required">*</span></label>
                                    <input type="text" className="crm-input" name="city" value={formData.city} onChange={handleChange} required placeholder="Kochi" />
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="crm-input-group">
                                    <label className="crm-label">State<span className="required">*</span></label>
                                    <input type="text" className="crm-input" name="state" value={formData.state} onChange={handleChange} required placeholder="Kerala" />
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="crm-input-group">
                                    <label className="crm-label">Country<span className="required">*</span></label>
                                    <input type="text" className="crm-input" name="country" value={formData.country} onChange={handleChange} required readOnly />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Business Registration & Experience */}
                    <div className="form-section-card">
                        <h3 className="section-title"><i className="fa fa-briefcase"></i> Business Registration & Experience</h3>
                        <div className="row align-items-center mb-4">
                            <div className="col-md-3">
                                <label className="crm-checkbox-wrapper">
                                    <input type="checkbox" className="crm-checkbox" name="isRegisteredBusiness" checked={formData.isRegisteredBusiness} onChange={handleChange} />
                                    <span className="crm-checkbox-label">Is Registered Business</span>
                                </label>
                            </div>
                            <div className="col-md-4">
                                <div className="crm-input-group mb-0">
                                    <label className="crm-label">GST Number</label>
                                    <input type="text" className="crm-input" name="gstNumber" value={formData.gstNumber} onChange={handleChange} disabled={!formData.isRegisteredBusiness} placeholder="Enter GST Number" />
                                </div>
                            </div>
                            <div className="col-md-5">
                                <div className="crm-input-group mb-0">
                                    <label className="crm-label">FSSAI License Number</label>
                                    <input type="text" className="crm-input" name="fssaiLicenseNumber" value={formData.fssaiLicenseNumber} onChange={handleChange} disabled={!formData.isRegisteredBusiness} placeholder="Enter FSSAI Number" />
                                </div>
                            </div>
                        </div>
                        <div className="row align-items-start">
                            <div className="col-md-3">
                                <label className="crm-checkbox-wrapper">
                                    <input type="checkbox" className="crm-checkbox" name="hasPriorExperience" checked={formData.hasPriorExperience} onChange={handleChange} />
                                    <span className="crm-checkbox-label">Has Prior Experience</span>
                                </label>
                            </div>
                            <div className="col-md-9">
                                <div className="crm-input-group mb-0">
                                    <label className="crm-label">Experience Description</label>
                                    <textarea className="crm-input" name="experienceDescription" value={formData.experienceDescription} onChange={handleChange} disabled={!formData.hasPriorExperience} placeholder="Describe industry experience..." rows="2"></textarea>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Capital & Infrastructure */}
                    <div className="form-section-card">
                        <h3 className="section-title"><i className="fa fa-building"></i> Capital, Investment & Infrastructure</h3>
                        <div className="row align-items-center mb-4">
                            <div className="col-md-4">
                                <label className="crm-checkbox-wrapper mb-3">
                                    <input type="checkbox" className="crm-checkbox" name="hasWorkingCapital" checked={formData.hasWorkingCapital} onChange={handleChange} />
                                    <span className="crm-checkbox-label">Has Working Capital</span>
                                </label>
                            </div>
                            <div className="col-md-8">
                                <div className="crm-input-group mb-0">
                                    <label className="crm-label">Initial Investment Capacity</label>
                                    <input type="text" className="crm-input" name="initialInvestmentCapacity" value={formData.initialInvestmentCapacity} onChange={handleChange} disabled={!formData.hasWorkingCapital} placeholder="e.g. 10 Lakhs" />
                                </div>
                            </div>
                        </div>
                        <div className="row align-items-start mb-4">
                            <div className="col-md-4">
                                <label className="crm-checkbox-wrapper mb-3">
                                    <input type="checkbox" className="crm-checkbox" name="hasStorageFacility" checked={formData.hasStorageFacility} onChange={handleChange} />
                                    <span className="crm-checkbox-label">Has Storage Facility</span>
                                </label>
                            </div>
                            <div className="col-md-8">
                                <div className="crm-input-group mb-0">
                                    <label className="crm-label">Storage Facility Description</label>
                                    <textarea className="crm-input" name="storageFacilityDescription" value={formData.storageFacilityDescription} onChange={handleChange} disabled={!formData.hasStorageFacility} placeholder="Details about cold storage, warehouse size, etc." rows="2"></textarea>
                                </div>
                            </div>
                        </div>
                        <div className="row align-items-start">
                            <div className="col-md-4">
                                <label className="crm-checkbox-wrapper mb-3">
                                    <input type="checkbox" className="crm-checkbox" name="hasDeliveryInfrastructure" checked={formData.hasDeliveryInfrastructure} onChange={handleChange} />
                                    <span className="crm-checkbox-label">Has Delivery Infrastructure</span>
                                </label>
                            </div>
                            <div className="col-md-8">
                                <div className="crm-input-group mb-0">
                                    <label className="crm-label">Delivery Infrastructure Description</label>
                                    <textarea className="crm-input" name="deliveryInfrastructureDescription" value={formData.deliveryInfrastructureDescription} onChange={handleChange} disabled={!formData.hasDeliveryInfrastructure} placeholder="Vehicles, logistics tie-ups, etc." rows="2"></textarea>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Coverage Areas */}
                    <div className="form-section-card">
                        <h3 className="section-title"><i className="fa fa-globe"></i> Coverage Areas <span className="text-danger ms-1" style={{fontSize: '1rem'}}>*</span></h3>
                        {loadingZones ? (
                            <div className="text-muted p-3"><i className="fa fa-spin fa-spinner me-2"></i>Loading distribution zones...</div>
                        ) : zones.length === 0 ? (
                            <div className="text-muted p-3">No distribution zones available.</div>
                        ) : (
                            <Select
                                isMulti
                                name="coverageAreas"
                                options={zones.map(zone => ({
                                    value: zone.id,
                                    label: `${zone.name} (${zone.district ? `${zone.district}, ${zone.state}` : 'Unmapped Area'})`
                                }))}
                                className="basic-multi-select"
                                classNamePrefix="select"
                                value={zones
                                    .filter(zone => formData.coverageAreas.includes(zone.id))
                                    .map(zone => ({
                                        value: zone.id,
                                        label: `${zone.name} (${zone.district ? `${zone.district}, ${zone.state}` : 'Unmapped Area'})`
                                    }))}
                                onChange={(selected) => setFormData({...formData, coverageAreas: selected.map(s => s.value)})}
                                placeholder="Select distribution zones..."
                                styles={{
                                    control: (baseStyles, state) => ({
                                        ...baseStyles,
                                        borderColor: state.isFocused ? 'var(--crm-accent)' : 'var(--crm-border)',
                                        boxShadow: state.isFocused ? '0 0 0 4px var(--crm-accent-soft)' : 'none',
                                        borderRadius: '12px',
                                        padding: '4px',
                                        backgroundColor: 'var(--crm-bg)',
                                        minHeight: '50px'
                                    }),
                                    menu: (baseStyles) => ({
                                        ...baseStyles,
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                                    }),
                                    multiValue: (baseStyles) => ({
                                        ...baseStyles,
                                        backgroundColor: 'var(--crm-accent-soft)',
                                        borderRadius: '6px',
                                        padding: '2px 4px'
                                    }),
                                    multiValueLabel: (baseStyles) => ({
                                        ...baseStyles,
                                        color: 'var(--crm-accent)',
                                        fontWeight: '600'
                                    }),
                                    multiValueRemove: (baseStyles) => ({
                                        ...baseStyles,
                                        color: 'var(--crm-accent)',
                                        ':hover': {
                                            backgroundColor: 'var(--crm-accent)',
                                            color: 'white',
                                        },
                                    })
                                }}
                            />
                        )}
                    </div>

                    {/* Documents Upload */}
                    <div className="form-section-card">
                        <h3 className="section-title"><i className="fa fa-file-text"></i> Documents Upload</h3>
                        <div className="file-upload-grid">
                            {[
                                { name: 'businessRegCert', label: 'Business Registration' },
                                { name: 'gstCert', label: 'GST Certificate' },
                                { name: 'addressProof', label: 'Address Proof' },
                                { name: 'panCard', label: 'PAN Card' },
                                { name: 'bankStatement', label: 'Bank Statement' },
                                { name: 'proprietorPhoto', label: 'Proprietor Photo' },
                                { name: 'proprietorIdProof', label: 'Proprietor ID Proof' },
                                { name: 'fssaiLicense', label: 'FSSAI License' }
                            ].map((doc) => (
                                <div key={doc.name} className="file-upload-box">
                                    <input type="file" name={doc.name} onChange={handleFileChange} />
                                    <div className="file-upload-icon">
                                        <i className={`fa ${files[doc.name] ? 'fa-check-circle text-success' : 'fa-cloud-upload'}`}></i>
                                    </div>
                                    <div className="file-upload-title">{doc.label}</div>
                                    <div className="file-upload-status">
                                        {files[doc.name] ? (
                                            <span className="file-uploaded-text">{files[doc.name].name}</span>
                                        ) : (
                                            "Click or drag file to upload"
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Additional Info */}
                    <div className="form-section-card">
                        <h3 className="section-title"><i className="fa fa-info-circle"></i> Additional Info</h3>
                        <div className="row">
                            <div className="col-md-4">
                                <div className="crm-input-group">
                                    <label className="crm-label">Lead Source<span className="required">*</span></label>
                                    <select className="crm-select" name="leadSource" value={formData.leadSource} onChange={handleChange} required>
                                        <option value="">Select Source...</option>
                                        <option value="Website">Website</option>
                                        <option value="Referral">Referral</option>
                                        <option value="Direct Call">Direct Call</option>
                                        <option value="Field Visit">Field Visit</option>
                                        <option value="Social Media">Social Media</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                            <div className="col-md-8">
                                <div className="crm-input-group">
                                    <label className="crm-label">Notes</label>
                                    <textarea className="crm-input" name="notes" value={formData.notes} onChange={handleChange} placeholder="Any additional observations or context..." rows="3"></textarea>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="d-flex justify-content-end mb-5">
                        <button type="submit" className="crm-submit-btn">
                            <i className={editId ? "fa fa-save" : "fa fa-paper-plane"}></i> {editId ? "UPDATE DISTRIBUTOR LEAD" : "SUBMIT DISTRIBUTOR LEAD"}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default DistributorLead;
