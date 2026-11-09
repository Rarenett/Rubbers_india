import React, { useState, useEffect } from 'react';
import CRMService from '../../../services/CRMService';
import { getStockItems } from '../../../services/InventoryService';
import { Modal, Button } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';

const PartnerLeadsList = () => {
    const navigate = useNavigate();
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('All Types');
    const [filterStatus, setFilterStatus] = useState('All Statuses'); // Assuming statuses will come later or not needed

    // Lookup caches
    const [zones, setZones] = useState([]);
    const [stockItems, setStockItems] = useState([]);

    const [selectedLead, setSelectedLead] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [distResp, vendResp, zonesResp, stockResp] = await Promise.all([
                CRMService.getDistributorLeads(),
                CRMService.getVendorLeads(),
                CRMService.getDistributionZones(),
                getStockItems()
            ]);

            const distData = distResp.data;
            const vendData = vendResp.data;
            const zonesData = zonesResp.data;
            const stockData = stockResp.data;

            const distLeads = Array.isArray(distData) ? distData : distData.results || [];
            const vendLeads = Array.isArray(vendData) ? vendData : vendData.results || [];
            
            const distWithTypes = distLeads.map(l => ({ ...l, type: 'Distributor' }));
            const vendWithTypes = vendLeads.map(l => ({ ...l, type: 'Vendor' }));

            setLeads([...distWithTypes, ...vendWithTypes].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
            
            setZones(Array.isArray(zonesData) ? zonesData : zonesData.results || []);
            setStockItems(Array.isArray(stockData) ? stockData : stockData.results || []);

        } catch (error) {
            console.error("Error fetching partner leads", error);
        } finally {
            setLoading(false);
        }
    };

    const getCoverageString = (lead) => {
        if (!lead) return 'N/A';
        if (lead.type === 'Distributor' && lead.coverage_areas) {
            return lead.coverage_areas.map(zId => {
                const z = zones.find(zz => zz.id === zId);
                return z ? `${z.name} (${z.district || 'N/A'})` : zId;
            }).join(', ') || 'None';
        } else if (lead.type === 'Vendor' && lead.material_names) {
            return lead.material_names.map(mId => {
                const m = stockItems.find(mm => mm.id === mId);
                return m ? m.name : mId;
            }).join(', ') || 'None';
        }
        return 'N/A';
    };

    const handleView = (lead) => {
        setSelectedLead(lead);
        setShowModal(true);
    };

    const handleEdit = (lead) => {
        if (lead.type === 'Distributor') {
            navigate('/crm/distributor-leads', { state: { editId: lead.id } });
        } else {
            navigate('/crm/vendor-leads', { state: { editId: lead.id } });
        }
    };

    const handleDelete = async (lead) => {
        const result = await Swal.fire({
            title: 'Purge Lead?',
            text: `Are you sure you want to delete ${lead.full_name}? This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, delete it!'
        });
        
        if (result.isConfirmed) {
            try {
                if (lead.type === 'Distributor') {
                    await CRMService.deleteDistributorLead(lead.id);
                } else if (lead.type === 'Vendor') {
                    await CRMService.deleteVendorLead(lead.id);
                }
                Swal.fire('Deleted!', 'The lead has been purged from the ecosystem.', 'success');
                fetchInitialData();
            } catch (error) {
                console.error("Error deleting lead:", error);
                Swal.fire('Error', 'Failed to delete the lead.', 'error');
            }
        }
    };

    const filteredLeads = leads.filter(lead => {
        const matchesType = filterType === 'All Types' || lead.type === filterType;
        const matchesSearch = (lead.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) || 
                              (lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                              (lead.contact_number?.includes(searchTerm));
        return matchesType && matchesSearch;
    }).sort((a, b) => {
        const nameA = a.full_name || '';
        const nameB = b.full_name || '';
        return nameA.toLowerCase().localeCompare(nameB.toLowerCase());
    });

    return (
        <div className="crm-section-container">
            <style>{`
                .crm-section-container {
                    background: var(--crm-card-bg);
                    border-radius: var(--crm-card-radius);
                    padding: 1.5rem 2rem;
                    box-shadow: var(--crm-shadow);
                    margin-bottom: 2.5rem;
                    border: 1px solid var(--crm-border);
                }
                .crm-section-header {
                    margin-bottom: 2rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 1rem;
                }
                .crm-section-header h3 {
                    font-size: 1.4rem;
                    font-weight: 800;
                    margin: 0;
                    color: var(--crm-text-primary);
                }
                .crm-tools {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    flex-wrap: wrap;
                }
                .crm-search-container {
                    position: relative;
                    width: 300px;
                }
                .crm-search-icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--crm-text-secondary);
                    opacity: 0.6;
                    pointer-events: none;
                }
                .crm-search-input {
                    width: 100%;
                    padding: 0.6rem 1rem 0.6rem 2.5rem;
                    background: var(--crm-bg);
                    border: 1px solid var(--crm-border);
                    border-radius: 10px;
                    color: var(--crm-text-primary);
                    font-size: 0.85rem;
                    transition: all 0.3s ease;
                }
                .crm-search-input:focus {
                    outline: none;
                    border-color: var(--crm-accent);
                    box-shadow: 0 0 0 3px var(--crm-accent-soft);
                }
                .crm-table-wrapper {
                    border-radius: 12px;
                    overflow-x: auto;
                    border: 1px solid var(--crm-border);
                }
                .crm-table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                }
                .crm-table th {
                    font-size: 0.85rem;
                    color: var(--crm-text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    font-weight: 700;
                    padding: 1.25rem 1rem;
                    background: var(--crm-bg);
                    border-bottom: 2px solid var(--crm-border);
                }
                .crm-table td {
                    padding: 1.25rem 1rem;
                    border-bottom: 1px solid var(--crm-border);
                    color: var(--crm-text-primary);
                    font-size: 0.95rem;
                }
                .crm-table tr:last-child td {
                    border-bottom: none;
                }
                .crm-table tr {
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .crm-table tr:hover td {
                    background: var(--crm-accent-soft);
                }
                .crm-action-btn {
                    width: 34px;
                    height: 34px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid var(--crm-border);
                    background: var(--crm-card-bg);
                    color: var(--crm-text-secondary);
                    transition: all 0.3s;
                }
                .crm-action-btn:hover {
                    border-color: var(--crm-accent);
                    color: var(--crm-accent);
                    background: var(--crm-accent-soft);
                }

                .crm-submit-btn {
                    background: var(--crm-accent, #00d1ff);
                    color: #fff;
                    border: none;
                    padding: 0.6rem 1.2rem;
                    border-radius: 8px;
                    font-weight: 700;
                    font-size: 0.9rem;
                    box-shadow: 0 4px 10px rgba(0, 209, 255, 0.2);
                    transition: all 0.3s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    cursor: pointer;
                }
                .crm-submit-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 15px rgba(0, 209, 255, 0.3);
                    color: white;
                }
                /* Modal Styling */
                .crm-modal-header {
                    background: var(--crm-card-bg);
                    border-bottom: 1px solid var(--crm-border);
                    padding: 20px;
                }
                .crm-modal-body {
                    background: var(--crm-bg);
                    padding: 20px;
                }
                .detail-section {
                    background: var(--crm-card-bg);
                    padding: 20px;
                    border-radius: 12px;
                    margin-bottom: 20px;
                    border: 1px solid var(--crm-border);
                }
                .detail-title {
                    font-size: 1.1rem;
                    font-weight: 700;
                    margin-bottom: 15px;
                    color: var(--crm-text-primary);
                    border-bottom: 1px solid var(--crm-border);
                    padding-bottom: 10px;
                }
                .detail-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 20px;
                }
                .detail-item label {
                    display: block;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    color: var(--crm-text-secondary);
                    margin-bottom: 5px;
                }
                .detail-item p {
                    margin: 0;
                    font-weight: 600;
                    color: var(--crm-text-primary);
                }
                .badge-new {
                    background: #334155;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.7rem;
                    margin-left: 10px;
                }
                .alert-warn {
                    background: #fecdd3;
                    color: #881337;
                    padding: 10px 15px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    font-size: 0.9rem;
                    font-weight: 500;
                }
                .crm-input {
                    width: 100%;
                    padding: 0.6rem;
                    border: 1px solid var(--crm-border);
                    border-radius: 8px;
                    background: var(--crm-card-bg);
                    color: var(--crm-text-primary);
                }
                .crm-label {
                    display: block;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    color: var(--crm-text-secondary);
                    margin-bottom: 5px;
                    font-weight: 600;
                }
            `}</style>

            <div className="crm-section-header">
                <h3>Partner Leads List</h3>
                <div className="crm-tools">
                    <div className="crm-search-container">
                        <i className="fa fa-search crm-search-icon"></i>
                        <input 
                            type="text" 
                            className="crm-search-input" 
                            placeholder="Search leads..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                        />
                    </div>
                    
                    <select className="crm-search-input" style={{width: 'auto', paddingLeft: '1rem'}} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option>All Statuses</option>
                        <option>New</option>
                        <option>Qualified</option>
                        <option>Converted</option>
                    </select>

                    <select className="crm-search-input" style={{width: 'auto', paddingLeft: '1rem'}} value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option>All Types</option>
                        <option>Distributor</option>
                        <option>Vendor</option>
                    </select>
                    
                    <button className="crm-submit-btn">
                        <i className="fa fa-plus"></i> Create Lead
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center p-5"><i className="fa fa-spin fa-spinner fa-2x text-primary"></i></div>
            ) : (
                <div className="table-responsive crm-table-wrapper">
                    <table className="crm-table">
                        <thead>
                            <tr>
                                <th>Sl No.</th>
                                <th>Full Name</th>
                                <th>Type</th>
                                <th>Contact Number</th>
                                <th>Email</th>
                                <th>Company Name</th>
                                <th>Designation</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLeads.map((lead, i) => (
                                <tr key={`${lead.type}-${lead.id}`}>
                                    <td>{i + 1}</td>
                                    <td>{lead.full_name}</td>
                                    <td>{lead.type}</td>
                                    <td>{lead.contact_number}</td>
                                    <td>{lead.email}</td>
                                    <td>{lead.company_name}</td>
                                    <td>{lead.designation}</td>
                                    <td style={{whiteSpace: 'nowrap'}}>
                                        <div className="d-flex gap-2">
                                            <button className="crm-action-btn" onClick={() => handleView(lead)} title="View Detail"><i className="fa fa-eye"></i></button>
                                            <button className="crm-action-btn" onClick={() => handleEdit(lead)} title="Edit Lead"><i className="fa fa-edit text-warning"></i></button>
                                            <button className="crm-action-btn" onClick={() => handleDelete(lead)} title="Delete Lead"><i className="fa fa-trash text-danger"></i></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredLeads.length === 0 && (
                                <tr><td colSpan="12" className="text-center p-4">No leads found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            
            {/* Read-Only Modal */}
            <Modal show={showModal} onHide={() => setShowModal(false)} size="xl" centered>
                <div className="crm-modal-header d-flex justify-content-between align-items-center">
                    <h4 className="mb-0">
                        Details of {selectedLead?.full_name} - {selectedLead?.company_name}
                        <span className="badge-new">New</span>
                    </h4>
                    <button className="btn-close" onClick={() => setShowModal(false)}></button>
                </div>
                <div className="crm-modal-body">
                    {!selectedLead?.is_registered_business && (
                        <div className="alert-warn">
                            You must be a registered business to qualify as a lead.
                        </div>
                    )}
                    
                    <div className="detail-section">
                        <div className="detail-title">Basic Information</div>
                        <div className="detail-grid">
                            <div className="detail-item">
                                <label>Full Name</label>
                                <p>{selectedLead?.full_name}</p>
                            </div>
                            <div className="detail-item">
                                <label>Contact Number</label>
                                <p>{selectedLead?.contact_number}</p>
                            </div>
                            <div className="detail-item">
                                <label>Email</label>
                                <p>{selectedLead?.email}</p>
                            </div>
                            <div className="detail-item">
                                <label>Designation</label>
                                <p>{selectedLead?.designation}</p>
                            </div>
                            <div className="detail-item">
                                <label>Company Name</label>
                                <p>{selectedLead?.company_name || 'N/A'}</p>
                            </div>
                            <div className="detail-item">
                                <label>Website</label>
                                <p>{selectedLead?.website || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="detail-section">
                        <div className="detail-title">Address Details</div>
                        <div className="detail-item mb-3">
                            <label>Address</label>
                            <p>{selectedLead?.address}</p>
                        </div>
                        <div className="detail-grid">
                            <div className="detail-item">
                                <label>Pincode</label>
                                <p>{selectedLead?.pincode}</p>
                            </div>
                            <div className="detail-item">
                                <label>City</label>
                                <p>{selectedLead?.city}</p>
                            </div>
                            <div className="detail-item">
                                <label>State</label>
                                <p>{selectedLead?.state}</p>
                            </div>
                            <div className="detail-item">
                                <label>Country</label>
                                <p>{selectedLead?.country}</p>
                            </div>
                        </div>
                    </div>

                    <div className="detail-section">
                        <div className="detail-title">Business Registration</div>
                        <div className="detail-grid">
                            <div className="detail-item">
                                <label>Registered Business</label>
                                <p>{selectedLead?.is_registered_business ? 'Yes' : 'No'}</p>
                            </div>
                            <div className="detail-item">
                                <label>GST Number</label>
                                <p>{selectedLead?.gst_number || 'N/A'}</p>
                            </div>
                            <div className="detail-item">
                                <label>FSSAI License</label>
                                <p>{selectedLead?.fssai_license_number || 'N/A'}</p>
                            </div>
                            {selectedLead?.type === 'Vendor' && (
                                <div className="detail-item">
                                    <label>PAN Number</label>
                                    <p>{selectedLead?.pan_number || 'N/A'}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="detail-section">
                        <div className="detail-title">Experience & Logistics</div>
                        <div className="detail-grid">
                            <div className="detail-item">
                                <label>Prior Experience</label>
                                <p>{selectedLead?.has_prior_experience ? 'Yes' : 'No'}</p>
                            </div>
                            <div className="detail-item" style={{gridColumn: 'span 3'}}>
                                <label>Experience Description</label>
                                <p>{selectedLead?.experience_description || 'N/A'}</p>
                            </div>
                            {selectedLead?.type === 'Distributor' && (
                                <>
                                    <div className="detail-item">
                                        <label>Storage Facility</label>
                                        <p>{selectedLead?.has_storage_facility ? 'Yes' : 'No'}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Delivery Infrastructure</label>
                                        <p>{selectedLead?.has_delivery_infrastructure ? 'Yes' : 'No'}</p>
                                    </div>
                                    <div className="detail-item" style={{gridColumn: 'span 2'}}>
                                        <label>Coverage Areas</label>
                                        <p>{getCoverageString(selectedLead)}</p>
                                    </div>
                                </>
                            )}
                            {selectedLead?.type === 'Vendor' && (
                                <div className="detail-item" style={{gridColumn: 'span 4'}}>
                                    <label>Material Names (Stock Items)</label>
                                    <p>{getCoverageString(selectedLead)}</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
                <div className="modal-footer" style={{background: 'var(--crm-bg)', borderTop: '1px solid var(--crm-border)'}}>
                    <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
                </div>
            </Modal>
        </div>
    );
};

export default PartnerLeadsList;
