import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { usePermission } from '../../../hooks/usePermission';
import SalesService from '../../../services/SalesService';
import DailyEntryList from './DailyEntryList';
import { fetchCompany, fetchCompanyAddresses, fetchCompanyContacts } from '../../../services/CompanyService';

const DailyEntryReport = () => {
    const { can } = usePermission();
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);

    const getFirstDayOfMonth = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}-01`;
    };
    const getLastDayOfMonth = () => {
        const d = new Date();
        const lastDayObj = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const year = lastDayObj.getFullYear();
        const month = String(lastDayObj.getMonth() + 1).padStart(2, '0');
        const day = String(lastDayObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [fromDate, setFromDate] = useState(getFirstDayOfMonth());
    const [toDate, setToDate] = useState(getLastDayOfMonth());


    const [companyInfo, setCompanyInfo] = useState(null);
    const [companyAddress, setCompanyAddress] = useState(null);
    const [companyContact, setCompanyContact] = useState(null);

    useEffect(() => {
        const loadCompanyDetails = async () => {
            try {
                const companyRes = await fetchCompany();
                if (companyRes.data && companyRes.data.length > 0) {
                    const companyData = companyRes.data[0];
                    setCompanyInfo(companyData);

                    const [addrRes, contactRes] = await Promise.all([
                        fetchCompanyAddresses(companyData.id),
                        fetchCompanyContacts(companyData.id)
                    ]);

                    const addressesList = addrRes.data || [];
                    const primaryAddr = addressesList.find(a => 
                        a.address_type === 'headquarters' || 
                        a.address_type === 'registered' || 
                        a.address_type === 'corporate'
                    ) || addressesList[0];
                    setCompanyAddress(primaryAddr);

                    const contactsList = contactRes.data || [];
                    const primaryContact = contactsList.find(c => c.is_primary) || contactsList[0];
                    setCompanyContact(primaryContact);
                }
            } catch (err) {
                console.error("Failed to load company details for printing header:", err);
            }
        };
        loadCompanyDetails();
    }, []);

    const formatAddress = () => {
        if (!companyAddress) return 'Thrissur, Kerala, India';
        const parts = [
            companyAddress.address_line_1,
            companyAddress.address_line_2,
            companyAddress.city,
            companyAddress.state,
            companyAddress.pincode
        ].filter(Boolean);
        return parts.join(', ');
    };

    const formatContact = () => {
        if (!companyContact) return 'Tel: +91 487 000 0000';
        const parts = [];
        if (companyContact.phone) parts.push(`Tel: ${companyContact.phone}`);
        if (companyContact.mobile) parts.push(`Mob: ${companyContact.mobile}`);
        if (companyContact.email) parts.push(`Email: ${companyContact.email}`);
        return parts.filter(Boolean).join(' | ');
    };

    const fetchEntries = useCallback(async () => {
        setLoading(true);
        try {
            const res = await SalesService.getDailyEntries();
            setEntries(Array.isArray(res.data) ? res.data : res.data?.results || []);
        } catch (err) {
            console.error('Failed to fetch daily entries:', err);
            Swal.fire({
                icon: 'error',
                title: 'Fetch Error',
                text: 'Could not load daily entries from the server.'
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);

    // Handle date range filter (client-side filtering)
    const filteredData = entries.filter((item) => {
        const dateStr = item.entry_date;
        if (!dateStr) return true;
        if (fromDate && dateStr < fromDate) return false;
        if (toDate && dateStr > toDate) return false;
        return true;
    });

    return (
        <div className="container-fluid py-4" style={{ minHeight: '80vh' }}>
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { margin: 1.5cm; }
                    
                    body {
                        background: #fff !important;
                        color: #000 !important;
                    }

                    #main-wrapper {
                        display: block !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    /* Hide ALL navigation sidebar, header, footer, print button and other UI widgets */
                    .nav-header, .deznav, .header, .footer, .print-hide, .btn, .breadcrumb,
                    input[type="date"], select, .view-switcher, .dropdown, .chatbot-widget, .scroll-to-top {
                        display: none !important;
                    }

                    .content-body {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                    }

                    .container-fluid {
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                    }
                    
                    /* Adjust formatting for printed report card layouts */
                    .card {
                        border: none !important;
                        box-shadow: none !important;
                    }
                }
            ` }} />

            {/* Print-Only Company Header */}
            <div className="d-none d-print-block text-center pb-3 mb-4" style={{ borderBottom: '2px dashed #dee2e6' }}>
                <h2 className="fw-bold text-dark m-0" style={{ fontSize: '1.8rem', letterSpacing: '0.05em' }}>
                    {companyInfo?.display_name || companyInfo?.name || 'TRUETONE ERP'}
                </h2>
                {companyInfo?.description && (
                    <p className="m-0 fw-semibold text-secondary" style={{ fontSize: '0.95rem' }}>
                        {companyInfo.description}
                    </p>
                )}
                <p className="m-0 text-muted" style={{ fontSize: '0.85rem' }}>
                    {formatAddress()} | {formatContact()}
                </p>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="fw-bold text-dark">Daily Summary MIS Report</h2>
                    <p className="text-secondary mb-0 text-muted">View daily production entries, sales totals, and outstanding accounts.</p>
                </div>
                <div className="d-flex gap-2">
                    <button
                        className="btn btn-primary d-flex align-items-center gap-2 print-hide"
                        onClick={() => window.print()}
                        style={{ borderRadius: '8px', padding: '8px 16px', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                        <i className="fa fa-print"></i> Print Report
                    </button>
                </div>
            </div>

            <DailyEntryList
                data={filteredData}
                loading={loading}
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={setFromDate}
                onToDateChange={setToDate}
                onEdit={null}
                onDelete={null}
                onAdd={null}
                can={can}
                defaultViewMode="list"
                isReport={true}
            />
        </div>
    );
};

export default DailyEntryReport;
