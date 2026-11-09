import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../../services/AxiosInstance';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { usePermission } from '../../../hooks/usePermission';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

const LeadList = ({ embedded }) => {
    const navigate = useNavigate();
    const { can } = usePermission();
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchLeads();
    }, []);

    const fetchLeads = async () => {
        try {
            const response = await axiosInstance.get('/api/crm/leads/');
            if (response.status === 200) {
                setLeads(response.data);
            }
        } catch (error) {
            console.error("Error fetching leads:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRowClick = (id) => {
        navigate(`/crm/leads/${id}`);
    };

    const handleEditClick = (e, id) => {
        e.stopPropagation();
        navigate(`/crm/leads/edit/${id}`);
    };

    const handleDeleteClick = (e, id) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to delete this lead record? Source data will be purged.")) {
            axiosInstance.delete(`/api/crm/leads/${id}/`)
                .then(() => {
                    alert("Lead purged successfully.");
                    fetchLeads();
                })
                .catch(err => console.error("Error deleting lead", err));
        }
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'Contacted': return 'badge-success';
            case 'Attempted to Contact': return 'badge-warning';
            case 'Pre Qualified': return 'badge-info';
            case 'Lost Lead': return 'badge-danger';
            case 'Junk Lead': return 'badge-secondary';
            default: return 'badge-primary';
        }
    };

    const filteredLeads = leads.filter(lead => {
        const searchStr = `${lead.first_name} ${lead.last_name} ${lead.company} ${lead.email} ${lead.phone} ${lead.lead_status} ${lead.lead_source}`.toLowerCase();
        return searchStr.includes(searchTerm.toLowerCase());
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentLeads = filteredLeads.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);

    const handleExportPDF = () => {
        const doc = new jsPDF();
        doc.text("CRM Lead Directory", 14, 15);
        
        const tableColumn = ["Name", "Company", "Email", "Phone", "Status", "Source"];
        const tableRows = filteredLeads.map(lead => [
            `${lead.first_name} ${lead.last_name}`,
            lead.company || '—',
            lead.email,
            lead.phone || '—',
            lead.lead_status || 'New',
            lead.lead_source || '—'
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            theme: 'striped',
            headStyles: { fillColor: [44, 44, 44] }
        });
        
        doc.save(`Leads_Export_${new Date().toLocaleDateString()}.pdf`);
    };

    const handleExportExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(filteredLeads.map(lead => ({
            Name: `${lead.first_name} ${lead.last_name}`,
            Company: lead.company || '—',
            Email: lead.email,
            Phone: lead.phone || '—',
            Status: lead.lead_status || 'New',
            Source: lead.lead_source || '—'
        })));
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
        XLSX.writeFile(workbook, `Leads_Export_${new Date().toLocaleDateString()}.xlsx`);
    };

    return (
        <div className="crm-list-view">
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

                /* Search & Tools */
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

                .crm-export-btn {
                    padding: 0.5rem 1rem;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 0.8rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    transition: all 0.22s;
                }

                /* Table Design */
                .crm-table-wrapper {
                    border-radius: 12px;
                    overflow: hidden;
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

                .badge-pill {
                    padding: 0.5rem 1.25rem;
                    border-radius: 2.5rem;
                    font-size: 0.75rem;
                    font-weight: 700;
                    display: inline-block;
                }

                .badge-success { background: rgba(16, 185, 129, 0.1); color: #10b981; }
                .badge-warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
                .badge-info { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
                .badge-danger { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
                .badge-secondary { background: rgba(100, 116, 139, 0.1); color: #64748b; }
                .badge-primary { background: var(--crm-accent-soft); color: var(--crm-accent); }

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
                    transform: translateY(-2px);
                }
            `}</style>

            <div className="crm-section-container">
                <div className="crm-section-header">
                    <h3>Lead Directory</h3>
                    <div className="crm-tools">
                        <div className="crm-search-container">
                            <span className="crm-search-icon">
                                <i className="fa fa-search"></i>
                            </span>
                            <input 
                                type="text" 
                                className="crm-search-input" 
                                placeholder="Search leads by name, company..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                        <div className="d-flex gap-2">
                             <button className="btn btn-sm btn-outline-info crm-export-btn" onClick={() => navigate('/crm/sources')} title="Manage Lead Sources">
                                <i className="fa fa-bullhorn"></i> Sources
                             </button>
                             <button className="btn btn-sm btn-outline-danger crm-export-btn" onClick={handleExportPDF}>
                                <i className="fa fa-file-pdf"></i> PDF
                             </button>
                             <button className="btn btn-sm btn-outline-success crm-export-btn" onClick={handleExportExcel}>
                                <i className="fa fa-file-excel"></i> Excel
                             </button>
                        </div>
                    </div>
                </div>

                <div className="table-responsive crm-table-wrapper">
                    <table className="crm-table">
                        <thead>
                            <tr>
                                <th>Lead Entity</th>
                                <th>Contact Information</th>
                                <th>Latest Findings / Remarks</th>
                                <th>Follow-up Due</th>
                                <th>Status</th>
                                <th className="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" className="text-center py-5 opacity-50">Loading ecosystem data...</td></tr>
                            ) : currentLeads.length === 0 ? (
                                <tr><td colSpan="6" className="text-center py-5 opacity-50">No lead records found.</td></tr>
                            ) : (
                                currentLeads.map((lead) => (
                                    <tr key={lead.id} onClick={() => handleRowClick(lead.id)}>
                                        <td>
                                            <div className="d-flex flex-column">
                                                <span className="fw-bold">{lead.first_name} {lead.last_name}</span>
                                                <small className="text-muted">{lead.company || 'Private Entity'}</small>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="d-flex flex-column" style={{ fontSize: '0.85rem' }}>
                                                <span><i className="fa fa-envelope-o me-1 opacity-50"></i> {lead.email}</span>
                                                <span className="text-muted"><i className="fa fa-phone me-1 opacity-50"></i> {lead.phone || lead.mobile || '—'}</span>
                                                {lead.contact_preferences && (
                                                    <div className="d-flex gap-2 mt-1">
                                                        {lead.contact_preferences.split(',').map(pref => (
                                                            <i key={pref} 
                                                               className={`fa ${pref === 'Phone' ? 'fa-phone' : pref === 'WhatsApp' ? 'fa-whatsapp' : 'fa-envelope'} text-primary`} 
                                                               title={`Prefers ${pref}`} 
                                                               style={{ fontSize: '0.75rem' }}></i>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="text-muted" style={{ fontSize: '0.85rem', maxWidth: '200px' }}>
                                                {lead.latest_log ? (
                                                    <span className="italic" style={{ color: 'var(--crm-text-primary)', fontWeight: '600' }}>
                                                        "{lead.latest_log.remarks?.substring(0, 50)}{lead.latest_log.remarks?.length > 50 ? '...' : ''}"
                                                    </span>
                                                ) : (
                                                    <small className="opacity-50">No interactions logged</small>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            {lead.next_followup ? (
                                                <div className="d-flex flex-column">
                                                    <span className="fw-700" style={{ fontSize: '0.8rem', color: new Date(lead.next_followup) < new Date() ? '#ef4444' : 'var(--crm-text-primary)' }}>
                                                        {new Date(lead.next_followup).toLocaleDateString()}
                                                    </span>
                                                    <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                                                        {new Date(lead.next_followup).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </small>
                                                </div>
                                            ) : (
                                                <span className="text-muted fw-600">—</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`badge-pill ${getStatusBadgeClass(lead.lead_status)}`}>
                                                {lead.lead_status || 'New'}
                                            </span>
                                        </td>
                                        <td className="text-end" onClick={(e) => e.stopPropagation()}>
                                            <div className="d-flex justify-content-end gap-2">
                                                <EditButton
                                                    module="crm-lead"
                                                    onClick={(e) => handleEditClick(e, lead.id)}
                                                    title="Edit Lead"
                                                />
                                                <DeleteButton
                                                    module="crm-lead"
                                                    onClick={(e) => handleDeleteClick(e, lead.id)}
                                                    title="Delete Lead"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    {!loading && totalPages > 1 && (
                        <div className="d-flex justify-content-between align-items-center mt-3 p-3 pt-0">
                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredLeads.length)} of {filteredLeads.length} entries
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

export default LeadList;
