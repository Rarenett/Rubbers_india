import React, { useState, useEffect } from 'react';
import CRMService from '../../../services/CRMService';
import Swal from 'sweetalert2';

const DistributionZoneList = () => {
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [currentZone, setCurrentZone] = useState({
        name: '',
        pincode: '',
        district: '',
        state: '',
        remarks: ''
    });
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        fetchZones();
    }, []);

    const fetchZones = async () => {
        try {
            setLoading(true);
            const response = await CRMService.getDistributionZones();
            setZones(response.data || []);
        } catch (error) {
            console.error("Error fetching distribution zones", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await CRMService.updateDistributionZone(editingId, currentZone);
            } else {
                await CRMService.createDistributionZone(currentZone);
            }
            fetchZones();
            setCurrentZone({ name: '', pincode: '', district: '', state: '', remarks: '' });
            setEditingId(null);
            alert("Distribution Zone ecosystem synchronized.");
        } catch (error) {
            console.error("Error saving distribution zone", error);
            alert("Synchronization failure. Field validation required.");
        }
    };

    const handleEdit = (zone) => {
        setCurrentZone({
            name: zone.name || '',
            pincode: zone.pincode || '',
            district: zone.district || '',
            state: zone.state || '',
            remarks: zone.remarks || ''
        });
        setEditingId(zone.id);
    };

    const handleDelete = async (id) => {
        if (window.confirm("Purge this distribution zone from the CRM ecosystem?")) {
            try {
                await CRMService.deleteDistributionZone(id);
                fetchZones();
            } catch (error) {
                console.error("Error deleting zone", error);
            }
        }
    };

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentZones = zones.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(zones.length / itemsPerPage);

    return (
        <div className="crm-category-mgmt">
            <style>{`
                .mgmt-grid {
                    display: grid;
                    grid-template-columns: 350px 1fr;
                    gap: 2.5rem;
                }
                .mgmt-form-card, .mgmt-list-card {
                    background: var(--crm-card-bg);
                    border-radius: var(--crm-card-radius);
                    border: 1px solid var(--crm-border);
                    box-shadow: var(--crm-shadow);
                    padding: 2rem;
                }
                .cat-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.25rem;
                    border-bottom: 1px solid var(--crm-border);
                    transition: all 0.2s;
                }
                .cat-item:last-child {
                    border-bottom: none;
                }
                .cat-item:hover {
                    background: var(--crm-accent-soft);
                    border-radius: 12px;
                }
                .cat-info h5 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 800;
                    color: var(--crm-text-primary);
                }
                .cat-info p {
                    margin: 0;
                    font-size: 0.85rem;
                    color: var(--crm-text-secondary);
                }
                .cat-actions {
                    display: flex;
                    gap: 0.75rem;
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
                .crm-input {
                    width: 100%;
                    padding: 0.8rem 1.25rem;
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
                .crm-textarea {
                    min-height: 80px;
                    resize: vertical;
                }
                .crm-submit-btn {
                    background: var(--crm-accent);
                    color: #fff;
                    border: none;
                    padding: 0.8rem 1.5rem;
                    border-radius: 12px;
                    font-weight: 800;
                    font-size: 0.9rem;
                    box-shadow: 0 10px 20px rgba(0, 209, 255, 0.2);
                    transition: all 0.3s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.75rem;
                    cursor: pointer;
                }
                .crm-submit-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 15px 30px rgba(0, 209, 255, 0.3);
                }
                .crm-action-btn {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid var(--crm-border);
                    background: var(--crm-card-bg);
                    color: var(--crm-text-secondary);
                    transition: all 0.2s;
                }
                .crm-action-btn:hover {
                    border-color: var(--crm-accent);
                    color: var(--crm-accent);
                    background: var(--crm-accent-soft);
                }
            `}</style>

            <div className="mgmt-grid">
                <div className="mgmt-form-card">
                    <h4 className="fw-800 text-primary mb-4">{editingId ? 'Edit Distribution Zone' : 'Define New Zone'}</h4>
                    <form onSubmit={handleSave}>
                        <div className="crm-input-group">
                            <label className="crm-label">Zone Name</label>
                            <input 
                                type="text" 
                                className="crm-input" 
                                placeholder="e.g. North Region"
                                value={currentZone.name}
                                onChange={(e) => setCurrentZone({...currentZone, name: e.target.value})}
                                required
                            />
                        </div>
                        <div className="crm-input-group">
                            <label className="crm-label">Pincode</label>
                            <input 
                                type="text" 
                                className="crm-input" 
                                placeholder="Enter pincode"
                                value={currentZone.pincode}
                                onChange={(e) => setCurrentZone({...currentZone, pincode: e.target.value})}
                                required
                            />
                        </div>
                        <div className="crm-input-group">
                            <label className="crm-label">District</label>
                            <input 
                                type="text" 
                                className="crm-input" 
                                placeholder="Enter district"
                                value={currentZone.district}
                                onChange={(e) => setCurrentZone({...currentZone, district: e.target.value})}
                            />
                        </div>
                        <div className="crm-input-group">
                            <label className="crm-label">State</label>
                            <input 
                                type="text" 
                                className="crm-input" 
                                placeholder="Enter state"
                                value={currentZone.state}
                                onChange={(e) => setCurrentZone({...currentZone, state: e.target.value})}
                            />
                        </div>
                        <div className="crm-input-group">
                            <label className="crm-label">Remarks</label>
                            <textarea 
                                className="crm-input crm-textarea" 
                                placeholder="Additional zone context..."
                                value={currentZone.remarks}
                                onChange={(e) => setCurrentZone({...currentZone, remarks: e.target.value})}
                            ></textarea>
                        </div>
                        <div className="d-flex gap-2">
                            <button type="submit" className="crm-submit-btn w-100">
                                {editingId ? 'UPDATE CONFIG' : 'SYNCHRONIZE'}
                            </button>
                            {editingId && (
                                <button type="button" className="btn btn-outline-secondary" onClick={() => {setEditingId(null); setCurrentZone({name:'', pincode:'', district:'', state:'', remarks:''})}}>
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                <div className="mgmt-list-card">
                    <h4 className="fw-800 text-primary mb-4">Distribution Zone Repository</h4>
                    {loading ? (
                        <div className="text-center py-5 opacity-50">Syncing repository...</div>
                    ) : zones.length === 0 ? (
                        <div className="text-center py-5 opacity-50">No zones identified in the ecosystem.</div>
                    ) : (
                        <div className="cat-list">
                            {currentZones.map(zone => (
                                <div key={zone.id} className="cat-item">
                                    <div className="cat-info">
                                        <h5>{zone.name}</h5>
                                        <p>
                                            {zone.pincode && <span>Pincode: {zone.pincode} • </span>}
                                            {zone.district && <span>{zone.district}, </span>}
                                            {zone.state && <span>{zone.state}</span>}
                                        </p>
                                        <p style={{fontStyle: 'italic', marginTop: '4px'}}>{zone.remarks || 'No remarks provided.'}</p>
                                    </div>
                                    <div className="cat-actions">
                                        <button className="crm-action-btn" onClick={() => handleEdit(zone)} title="Edit Configuration">
                                            <i className="fa fa-pencil"></i>
                                        </button>
                                        <button className="crm-action-btn text-danger" onClick={() => handleDelete(zone.id)} title="Purge Record">
                                            <i className="fa fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {!loading && totalPages > 1 && (
                        <div className="d-flex justify-content-between align-items-center mt-3">
                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, zones.length)} of {zones.length} entries
                            </div>
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
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DistributionZoneList;
