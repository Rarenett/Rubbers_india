import React, { useState, useEffect, Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Button, Form, Modal } from 'react-bootstrap';
import Swal from 'sweetalert2';
import axiosInstance from '../../../services/AxiosInstance';
import {
    getLedgers,
    deleteLedger,
    getAccountGroups,
    importTallyLedgers,
    downloadLedgerTemplate,
    importLedgersExcel
} from '../../../services/FinanceService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import LedgerFormModal from './LedgerFormModal';

const LedgerList = () => {
    const [ledgers, setLedgers] = useState([]);
    const [accountGroups, setAccountGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const { can } = usePermission();
    const [importing, setImporting] = useState(false);

    const navigate = useNavigate();

    const [showModal, setShowModal] = useState(false);
    const [ledgerToEdit, setLedgerToEdit] = useState(null);

    useEffect(() => {
        fetchData();
        fetchAccountGroups();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const ledgersData = await getLedgers();
            setLedgers(ledgersData);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch ledgers' });
        } finally {
            setLoading(false);
        }
    };

    const fetchAccountGroups = async () => {
        try {
            const data = await getAccountGroups();
            setAccountGroups(data);
        } catch (error) {
            console.error('Failed to fetch account groups', error);
        }
    };

    const fileInputRef = React.useRef(null);

    const handleDownloadTemplate = async () => {
        try {
            const response = await downloadLedgerTemplate();
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'Ledger_Template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to download template' });
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            setLoading(true);
            const data = await importLedgersExcel(formData);
            if (data.errors && data.errors.length > 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Import Completed with Errors',
                    html: `Added: <strong>${data.added}</strong><br>Updated: <strong>${data.updated}</strong><br><br><div style="max-height: 150px; overflow-y: auto; text-align: left; font-size: 13px; color: #d33; background: #fff3f3; padding: 10px; border-radius: 5px; border: 1px solid #ffcaca;">${data.errors.join('<br>')}</div>`,
                });
            } else {
                Swal.fire({
                    icon: 'success',
                    title: 'Import Successful',
                    text: `Added: ${data.added}, Updated: ${data.updated}`,
                });
            }
            fetchData();
        } catch (error) {
            let errorMsg = 'Failed to import ledgers';
            if (error.response && error.response.data && error.response.data.detail) {
                errorMsg = error.response.data.detail;
            }
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            setLoading(false);
        }
    };

    const handleImportTally = async () => {
        setImporting(true);
        Swal.fire({
            title: 'Importing from Tally...',
            text: 'Communicating with Tally Agent and fetching ledgers. Please wait...',
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        try {
            const response = await importTallyLedgers((status) => {
                if (status.status === 'processing') {
                    Swal.update({
                        text: 'Tally Agent is fetching ledgers from Tally Prime...'
                    });
                }
            });
            Swal.fire({ icon: 'success', title: 'Success', text: response.message || 'Ledgers imported successfully' });
            fetchData();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.message || error.response?.data?.error || 'Failed to import ledgers from Tally' });
        } finally {
            setImporting(false);
        }
    };

    const handleShowModal = (ledger = null) => {
        setLedgerToEdit(ledger);
        setShowModal(true);
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Ledger?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteLedger(id);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Ledger deleted successfully', timer: 2000 });
                fetchData();
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete ledger' });
            }
        }
    };

    const handleInspectVouchers = (ledger) => {
        navigate(`/finance/ledger-details/${ledger.id}`);
    };

    const filteredLedgers = ledgers.filter(ledger =>
        (ledger.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ledger.account_group_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredLedgers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentLedgers = filteredLedgers.slice(startIndex, startIndex + itemsPerPage);

    return (
        <Fragment>
            <div className="container-fluid">
                <div className="page-titles" style={{ marginTop: '-30px', padding: '4px 0 6px 0' }}>
                    <button
                        onClick={() => window.history.back()}
                        className="btn btn-outline-primary btn-sm d-flex align-items-center"
                        style={{ gap: '6px', borderRadius: '6px' }}
                    >
                        <i className="fa fa-arrow-left"></i> Back
                    </button>
                </div>
                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex justify-content-between align-items-center">
                                <Card.Title className="mb-0">Ledgers Management</Card.Title>
                                <div className="d-flex align-items-center gap-2">
                                    <div style={{ width: '300px', position: 'relative' }}>
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search Ledger..."
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />
                                    </div>
                                    <div className="d-flex gap-2 ms-auto">
                                        <button 
                                            className="btn btn-secondary" 
                                            onClick={handleDownloadTemplate} 
                                            title="Download Template"
                                            style={{ height: '34px', display: 'flex', alignItems: 'center', fontSize: '13px' }}
                                        >
                                            <i className="fa fa-download me-1"></i> Template
                                        </button>
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls"
                                            ref={fileInputRef}
                                            style={{ display: 'none' }}
                                            onChange={handleFileUpload}
                                        />
                                        <button 
                                            className="btn btn-info" 
                                            onClick={() => fileInputRef.current.click()} 
                                            title="Import Excel"
                                            style={{ height: '34px', display: 'flex', alignItems: 'center', fontSize: '13px', color: 'white' }}
                                        >
                                            <i className="fa fa-upload me-1"></i> Import
                                        </button>
                                        <Button 
                                            variant="outline-info" 
                                            onClick={handleImportTally} 
                                            disabled={importing}
                                            style={{ height: '34px', display: 'flex', alignItems: 'center', fontSize: '13px' }}
                                        >
                                            {importing ? (
                                                <><i className="fa fa-spinner fa-spin me-2"></i>Importing...</>
                                            ) : (
                                                <><i className="fa fa-download me-2"></i>Import from Tally</>
                                            )}
                                        </Button>
                                        <CreateButton 
                                            module="finance" 
                                            onClick={() => handleShowModal()} 
                                            style={{ height: '34px', display: 'flex', alignItems: 'center', fontSize: '13px' }}
                                        >
                                            Ledger
                                        </CreateButton>
                                    </div>
                                </div>
                            </Card.Header>
                            <Card.Body>

                                {loading ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-primary" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-responsive-md align-middle mb-0">
                                            <thead>
                                                <tr>
                                                    <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>SL NO</strong></th>
                                                    <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>NAME</strong></th>
                                                    <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>GROUP</strong></th>
                                                    {/* <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>GST % / HSN</strong></th>
                                                    <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>EMAIL / PHONE</strong></th>
                                                    <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>BALANCE</strong></th> */}
                                                    <th className="text-end" style={{ padding: '12px 16px', fontSize: '13px' }}><strong>ACTIONS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredLedgers.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="7" className="text-center py-4 text-muted">No ledgers found</td>
                                                    </tr>
                                                ) : (
                                                    currentLedgers.map((ledger, index) => {
                                                        const activeGst = ledger.gst_details?.find(g => parseFloat(g.gst_percentage || 0) > 0 || g.hsn_code) || ledger.gst_details?.[0];
                                                        const emailPhone = [
                                                            ledger.contact_details?.[0]?.email || ledger.email,
                                                            ledger.contact_details?.[0]?.phone_no || ledger.phone
                                                        ].filter(Boolean).join(' | ');

                                                        return (
                                                            <tr key={ledger.id}>
                                                                <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>{startIndex + index + 1}</td>
                                                                <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>
                                                                    <span 
                                                                        className="text-dark cursor-pointer" 
                                                                        style={{ cursor: 'pointer' }} 
                                                                        onClick={() => handleInspectVouchers(ledger)}
                                                                        title="Click to view ledger voucher transactions & bills"
                                                                    >
                                                                        {ledger.name}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>{ledger.account_group_name || '-'}</td>
                                                                {/* <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>
                                                                    {activeGst && (activeGst.gst_percentage > 0 || activeGst.hsn_code) ? (
                                                                        <span className="badge bg-light text-dark border fw-bold">
                                                                            {parseFloat(activeGst.gst_percentage || 0).toFixed(2)}%
                                                                            {activeGst.hsn_code ? ` (HSN: ${activeGst.hsn_code})` : ''}
                                                                        </span>
                                                                    ) : '-'}
                                                                </td> */}
                                                                {/* <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>{emailPhone || '-'}</td> */}
                                                                {/* <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>
                                                                    {parseFloat(ledger.opening_balance).toFixed(2)}{' '}
                                                                    <span className={`fw-bold ${ledger.opening_balance_type === 'Cr' ? 'text-danger' : 'text-secondary'}`} style={{ fontSize: '11px' }}>
                                                                        {ledger.opening_balance_type || (ledger.accountGroup?.nature === 'Liability' || ledger.accountGroup?.nature === 'Income' ? 'Cr' : 'Dr')}
                                                                    </span>
                                                                </td> */}
                                                                <td className="text-end" style={{ padding: '10px 16px', verticalAlign: 'middle' }}>
                                                                    <div className="d-flex justify-content-end align-items-center">
                                                                        <Button 
                                                                            variant="outline-info" 
                                                                            size="sm" 
                                                                            className="shadow me-1" 
                                                                            style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '12px', borderRadius: '6px' }}
                                                                            onClick={() => handleInspectVouchers(ledger)} 
                                                                            title="View Vouchers & Bills"
                                                                        >
                                                                            <i className="fa fa-book"></i>
                                                                        </Button>
                                                                        {can('finance', 'edit') && (
                                                                            <EditButton module="finance" onClick={() => handleShowModal(ledger)} className="me-1" />
                                                                        )}
                                                                        {can('finance', 'delete') && (
                                                                            <DeleteButton module="finance" onClick={() => handleDelete(ledger.id, ledger.name)} />
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                        
                                         {totalPages > 1 && (
                                             <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                                 <div className="text-muted" style={{ fontSize: '13px' }}>
                                                     Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredLedgers.length)} of {filteredLedgers.length} entries
                                                 </div>
                                                 <nav>
                                                     <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                         <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                             <button 
                                                                 type="button" 
                                                                 className="page-link" 
                                                                 onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                                                                 disabled={currentPage === 1}
                                                                 style={{ border: 'none', background: 'none' }}
                                                             >
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
                                                                         <button 
                                                                             type="button" 
                                                                             className="page-link" 
                                                                             onClick={() => setCurrentPage(pageNumber)}
                                                                             style={{ border: 'none' }}
                                                                         >
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
                                                             <button 
                                                                 type="button" 
                                                                 className="page-link" 
                                                                 onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                                                                 disabled={currentPage === totalPages}
                                                                 style={{ border: 'none', background: 'none' }}
                                                             >
                                                                 <i className="la la-angle-right" />
                                                             </button>
                                                         </li>
                                                     </ul>
                                                 </nav>
                                             </div>
                                         )}
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    </div>
                </div>
            </div>

            <LedgerFormModal 
                show={showModal} 
                onHide={() => setShowModal(false)} 
                ledgerToEdit={ledgerToEdit} 
                accountGroups={accountGroups} 
                onSave={fetchData} 
            />
        </Fragment>
    );
};

export default LedgerList;
