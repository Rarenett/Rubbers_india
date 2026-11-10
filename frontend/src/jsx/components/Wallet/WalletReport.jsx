import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import WalletService from '../../../services/WalletService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils.jsx';
import ReactApexChart from 'react-apexcharts';
import DatePicker from 'react-datepicker';
import { formatDate, getDatePickerFormat } from '../../../utils/dateUtils';
import { Modal, Button, Card } from 'react-bootstrap';
import { usePageTitle } from '../../../context/TitleContext';
import Swal from 'sweetalert2';
import '../Assets/FileDashboard.css';

const formatCurrency = (val) => (
    <><span style={{ fontFamily: 'Arial, sans-serif' }}>₹</span> {parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
);

const CustomDateInput = React.forwardRef(({ value, onClick, onChange, placeholder }, ref) => (
    <input
        value={value}
        onClick={onClick}
        onChange={onChange}
        placeholder={placeholder}
        ref={ref}
        className="form-control"
        style={{ height: '49px', borderRadius: '8px' }}
    />
));

const printLedgerData = (wallet, summary, ledger, fromDate, toDate) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const dateRangeStr = (fromDate || toDate) ? ` (${fromDate || 'Start'} to ${toDate || 'Present'})` : '';
    const title = `Wallet Ledger — ${wallet.wallet_name} (${wallet.wallet_code})${dateRangeStr}`;
    const html = `
        <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 24px; color: #1e293b; }
                    .header { margin-bottom: 20px; border-bottom: 2px solid #0a500f; padding-bottom: 12px; }
                    h1 { margin: 0 0 6px 0; font-size: 20px; color: #0f172a; }
                    .meta { color: #64748b; font-size: 13px; margin-bottom: 16px; }
                    .summary-grid { display: flex; gap: 12px; margin-bottom: 20px; }
                    .summary-box { flex: 1; padding: 10px 14px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; text-align: center; }
                    .summary-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
                    .summary-value { font-size: 15px; font-weight: 700; margin-top: 4px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
                    th { background-color: #f8fafc; color: #475569; font-weight: 600; text-transform: uppercase; font-size: 11px; }
                    tr:nth-child(even) { background-color: #fafbfc; }
                    .text-end { text-align: right; }
                    .text-center { text-align: center; }
                    .text-success { color: #16a34a; font-weight: 600; }
                    .text-danger { color: #dc2626; font-weight: 600; }
                    .fw-bold { font-weight: 700; }
                    tfoot td { font-weight: 700; background: #f8fafc; }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${title}</h1>
                    <div class="meta">
                        Owner Type: <strong>${wallet.owner_type || '—'}</strong> | 
                        Owner ID: <strong>${wallet.owner_id || '—'}</strong> | 
                        Generated on: ${new Date().toLocaleString()}
                    </div>
                </div>
                <div class="summary-grid">
                    <div class="summary-box" style="background:#eef2ff; border-color:#c7d2fe;">
                        <div class="summary-label">Opening Balance</div>
                        <div class="summary-value" style="color:#4f46e5;">₹ ${Number(summary?.opening_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div class="summary-box" style="background:#f0fdf4; border-color:#bbf7d0;">
                        <div class="summary-label">Total Credit</div>
                        <div class="summary-value text-success">₹ ${Number(summary?.total_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div class="summary-box" style="background:#fff1f2; border-color:#fecdd3;">
                        <div class="summary-label">Total Debit</div>
                        <div class="summary-value text-danger">₹ ${Number(summary?.total_debit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div class="summary-box" style="background:#fffbeb; border-color:#fde68a;">
                        <div class="summary-label">Closing Balance</div>
                        <div class="summary-value" style="color:#d97706;">₹ ${Number(summary?.closing_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 35px;" class="text-center">#</th>
                            <th>Date</th>
                            <th>Txn No.</th>
                            <th>Ref No.</th>
                            <th>Description</th>
                            <th class="text-center">Type</th>
                            <th class="text-end">Credit</th>
                            <th class="text-end">Debit</th>
                            <th class="text-end">Running Balance</th>
                            <th class="text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ledger.map((tx, idx) => `
                            <tr>
                                <td class="text-center">${idx + 1}</td>
                                <td>${tx.date ? tx.date.split('T')[0] : '—'}</td>
                                <td class="fw-bold">${tx.transaction_number || '—'}</td>
                                <td>${tx.reference_number || '—'}</td>
                                <td>${tx.description || '—'}</td>
                                <td class="text-center">${tx.transaction_type || '—'}</td>
                                <td class="text-end text-success">${parseFloat(tx.credit) > 0 ? '₹ ' + Number(tx.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
                                <td class="text-end text-danger">${parseFloat(tx.debit) > 0 ? '₹ ' + Number(tx.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
                                <td class="text-end fw-bold">₹ ${Number(tx.running_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                <td class="text-center">${tx.status || '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="6" class="text-end">Period Totals:</td>
                            <td class="text-end text-success">₹ ${Number(summary?.total_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td class="text-end text-danger">₹ ${Number(summary?.total_debit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td colspan="2"></td>
                        </tr>
                        <tr style="background: #f0fdf4;">
                            <td colspan="8" class="text-end" style="color: #16a34a;">Closing Balance:</td>
                            <td colspan="2" class="text-end" style="color: #16a34a; font-size: 13px;">₹ ${Number(summary?.closing_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                    </tfoot>
                </table>
                <script>
                    window.onload = () => {
                        window.print();
                        window.onafterprint = () => window.close();
                    };
                </script>
            </body>
        </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
};

const printReportData = (wallets, summary, fromDate, toDate) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const dateRangeStr = (fromDate || toDate) ? `(${fromDate || 'Start'} to ${toDate || 'Present'})` : '(All Periods)';
    const title = `Wallet Report ${dateRangeStr}`;
    const html = `
        <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 24px; color: #1e293b; }
                    .header { margin-bottom: 20px; border-bottom: 2px solid #0a500f; padding-bottom: 12px; }
                    h1 { margin: 0 0 6px 0; font-size: 20px; color: #0f172a; }
                    .meta { color: #64748b; font-size: 13px; margin-bottom: 16px; }
                    .summary-grid { display: flex; gap: 12px; margin-bottom: 20px; }
                    .summary-box { flex: 1; padding: 10px 14px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; text-align: center; }
                    .summary-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
                    .summary-value { font-size: 15px; font-weight: 700; margin-top: 4px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
                    th { background-color: #f8fafc; color: #475569; font-weight: 600; text-transform: uppercase; font-size: 11px; }
                    tr:nth-child(even) { background-color: #fafbfc; }
                    .text-end { text-align: right; }
                    .text-center { text-align: center; }
                    .text-success { color: #16a34a; font-weight: 600; }
                    .text-danger { color: #dc2626; font-weight: 600; }
                    .fw-bold { font-weight: 700; }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${title}</h1>
                    <div class="meta">
                        Generated on: ${new Date().toLocaleString()} | Total Wallets: ${wallets.length}
                    </div>
                </div>
                <div class="summary-grid">
                    <div class="summary-box" style="background:#eef2ff; border-color:#c7d2fe;">
                        <div class="summary-label">Total Wallets</div>
                        <div class="summary-value" style="color:#4f46e5;">${summary?.total_wallets || wallets.length}</div>
                    </div>
                    <div class="summary-box" style="background:#f0fdf4; border-color:#bbf7d0;">
                        <div class="summary-label">Total Credit</div>
                        <div class="summary-value text-success">₹ ${Number(summary?.total_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div class="summary-box" style="background:#fff1f2; border-color:#fecdd3;">
                        <div class="summary-label">Total Debit</div>
                        <div class="summary-value text-danger">₹ ${Number(summary?.total_debit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div class="summary-box" style="background:#fffbeb; border-color:#fde68a;">
                        <div class="summary-label">Net Balance</div>
                        <div class="summary-value" style="color:#d97706;">₹ ${Number(summary?.net_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 40px;" class="text-center">#</th>
                            <th>Wallet Code</th>
                            <th>Wallet Name</th>
                            <th>Owner Type</th>
                            <th>Owner ID</th>
                            <th class="text-end">Total Credit</th>
                            <th class="text-end">Total Debit</th>
                            <th class="text-end">Current Balance</th>
                            <th class="text-center">Txns</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${wallets.map((w, idx) => `
                            <tr>
                                <td class="text-center">${idx + 1}</td>
                                <td class="fw-bold">${w.wallet_code || '—'}</td>
                                <td>${w.wallet_name || '—'}</td>
                                <td>${w.owner_type || '—'}</td>
                                <td>${w.owner_id || '—'}</td>
                                <td class="text-end text-success">₹ ${Number(w.total_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                <td class="text-end text-danger">₹ ${Number(w.total_debit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                <td class="text-end fw-bold">₹ ${Number(w.current_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                <td class="text-center">${w.transaction_count || 0}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <script>
                    window.onload = () => {
                        window.print();
                        window.onafterprint = () => window.close();
                    };
                </script>
            </body>
        </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
};

const WalletLedgerModal = ({ wallet, ledgerData: initialLedgerData, loading: initialLoading, show, onHide, fromDate: initialFromDate, toDate: initialToDate }) => {
    if (!wallet) return null;

    // Internal modal date filter state
    const [modalFromDate, setModalFromDate] = useState(initialFromDate || '');
    const [modalToDate, setModalToDate] = useState(initialToDate || '');
    const [appliedFromDate, setAppliedFromDate] = useState(initialFromDate || '');
    const [appliedToDate, setAppliedToDate] = useState(initialToDate || '');
    const [customLedgerData, setCustomLedgerData] = useState(null);
    const [modalLoading, setModalLoading] = useState(false);

    // Request sequence tracker to prevent stale responses from overwriting newer ones
    const requestSeqRef = useRef(0);

    // Sync initial dates and data when opening modal or when parent props change
    useEffect(() => {
        if (show) {
            setModalFromDate(initialFromDate || '');
            setModalToDate(initialToDate || '');
            setAppliedFromDate(initialFromDate || '');
            setAppliedToDate(initialToDate || '');
            setCustomLedgerData(null);
            requestSeqRef.current += 1;
        }
    }, [show, initialFromDate, initialToDate, wallet?.id]);

    const activeData = customLedgerData || initialLedgerData;
    const { summary, ledger = [] } = activeData || {};
    const isLoading = modalLoading || initialLoading;

    // Fetch ledger with date range from backend safely
    const fetchFilteredLedger = async (fromVal, toVal) => {
        const currentSeq = ++requestSeqRef.current;
        setModalLoading(true);
        try {
            const params = {};
            if (fromVal) params.from_date = fromVal;
            if (toVal) params.to_date = toVal;

            const res = await WalletService.getWalletLedger(wallet.id, params);
            if (currentSeq === requestSeqRef.current && res) {
                setCustomLedgerData(res);
                setAppliedFromDate(fromVal);
                setAppliedToDate(toVal);
            }
        } catch (error) {
            if (currentSeq === requestSeqRef.current) {
                console.error('Error filtering wallet ledger:', error);
                const err = error.response?.data?.error || 'Failed to load wallet ledger for the selected date range.';
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: typeof err === 'object' ? JSON.stringify(err) : err,
                });
            }
        } finally {
            if (currentSeq === requestSeqRef.current) {
                setModalLoading(false);
            }
        }
    };

    const handleResetFilter = () => {
        setModalFromDate('');
        setModalToDate('');
        fetchFilteredLedger('', '');
    };

    const handleModalFromDateChange = (date) => {
        if (!date) {
            setModalFromDate('');
            fetchFilteredLedger('', modalToDate);
            return;
        }
        const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (modalToDate && formatted > modalToDate) {
            Swal.fire({
                icon: 'warning',
                title: 'Invalid Date Range',
                text: 'From Date cannot be later than To Date.',
            });
            return;
        }
        setModalFromDate(formatted);
        fetchFilteredLedger(formatted, modalToDate);
    };

    const handleModalToDateChange = (date) => {
        if (!date) {
            setModalToDate('');
            fetchFilteredLedger(modalFromDate, '');
            return;
        }
        const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (modalFromDate && formatted < modalFromDate) {
            Swal.fire({
                icon: 'warning',
                title: 'Invalid Date Range',
                text: 'To Date cannot be earlier than From Date.',
            });
            return;
        }
        setModalToDate(formatted);
        fetchFilteredLedger(modalFromDate, formatted);
    };

    const handleExportLedger = (format) => {
        if (!wallet) return;
        const columns = [
            { header: 'Sl. No.', dataKey: 'index' },
            { header: 'Date', dataKey: 'date', formatter: (v) => formatDate(v) },
            { header: 'Txn No.', dataKey: 'transaction_number' },
            { header: 'Ref No.', dataKey: 'reference_number', formatter: (v) => v || '—' },
            { header: 'Description', dataKey: 'description' },
            { header: 'Type', dataKey: 'transaction_type' },
            { header: 'Credit', dataKey: 'credit', formatter: (v) => parseFloat(v) > 0 ? parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—' },
            { header: 'Debit', dataKey: 'debit', formatter: (v) => parseFloat(v) > 0 ? parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—' },
            { header: 'Running Balance', dataKey: 'running_balance', formatter: (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
            { header: 'Status', dataKey: 'status' }
        ];
        const dataWithIndex = ledger.map((d, i) => ({ ...d, index: i + 1 }));
        const dateRangeStr = (appliedFromDate || appliedToDate) ? ` (${appliedFromDate || 'Start'} to ${appliedToDate || 'Present'})` : '';
        const title = `Wallet Ledger — ${wallet.wallet_name} (${wallet.wallet_code})${dateRangeStr}`;

        if (format === 'pdf') {
            exportToPDF(dataWithIndex, columns, `wallet_ledger_${wallet.wallet_code}.pdf`, title, false);
        } else if (format === 'excel') {
            exportToExcel(dataWithIndex, columns, `wallet_ledger_${wallet.wallet_code}.xlsx`, false);
        } else if (format === 'print') {
            printLedgerData(wallet, summary, ledger, appliedFromDate, appliedToDate);
        }
    };

    return (
        <>
            <style>{`
                .wallet-ledger-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .wallet-ledger-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 20px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                    background: #ffffff;
                }
                .wallet-ledger-modal .modal-icon-circle {
                    width: 44px;
                    height: 44px;
                    background-color: #0a500f;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                    flex-shrink: 0;
                }
                .wallet-ledger-modal .modal-close-x {
                    border: none;
                    background: transparent;
                    font-size: 24px;
                    color: #94a3b8;
                    cursor: pointer;
                    transition: color 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                    line-height: 1;
                }
                .wallet-ledger-modal .modal-close-x:hover {
                    color: #334155;
                }
                .wallet-ledger-modal .modal-body-custom {
                    padding: 24px 28px;
                    max-height: calc(85vh - 140px);
                    overflow-y: auto;
                }
                .wallet-ledger-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 16px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                }
                .wallet-ledger-modal .btn-close-custom {
                    background-color: #dc3545 !important;
                    color: #ffffff !important;
                    border: none !important;
                    border-radius: 8px !important;
                    padding: 9px 24px !important;
                    font-size: 13.5px !important;
                    font-weight: 500 !important;
                    cursor: pointer !important;
                    transition: all 0.2s !important;
                    box-shadow: 0 2px 4px rgba(122, 112, 186, 0.2) !important;
                }
                .wallet-ledger-modal .btn-close-custom:hover {
                    background-color: #6a60a8 !important;
                    transform: translateY(-1px);
                }
                .wallet-ledger-modal .summary-card {
                    border-radius: 10px;
                    padding: 14px 16px;
                    text-align: center;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                .wallet-ledger-modal .summary-card-label {
                    font-size: 11px;
                    text-transform: uppercase;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    color: #64748b;
                    margin-bottom: 6px;
                }
                .wallet-ledger-modal .summary-card-value {
                    font-size: 1.15rem;
                    font-weight: 700;
                    line-height: 1.2;
                }
                .wallet-ledger-modal .ledger-table-container {
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    overflow: auto;
                    max-height: 420px;
                }
                .wallet-ledger-modal .ledger-table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                    font-size: 13px;
                }
                .wallet-ledger-modal .ledger-table thead th {
                    background-color: #f8fafc;
                    color: #64748b;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    padding: 10px 12px;
                    border-bottom: 1px solid #e2e8f0;
                    position: sticky;
                    top: 0;
                    z-index: 2;
                    white-space: nowrap;
                }
                .wallet-ledger-modal .ledger-table tbody td {
                    padding: 10px 12px;
                    vertical-align: middle;
                    border-bottom: 1px solid #f1f5f9;
                    color: #334155;
                }
                .wallet-ledger-modal .ledger-table tbody tr:hover td {
                    background-color: #f8fafc;
                }
                .wallet-ledger-modal .ledger-table tfoot td {
                    padding: 10px 12px;
                    vertical-align: middle;
                    font-weight: 700;
                }
                [data-theme-version="dark"] .wallet-ledger-modal .modal-content {
                    background-color: #1e1e2d !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
                }
                [data-theme-version="dark"] .wallet-ledger-modal .modal-header-custom {
                    background: #1e1e2d;
                    border-bottom-color: rgba(255, 255, 255, 0.1);
                }
                [data-theme-version="dark"] .wallet-ledger-modal .modal-header-custom .modal-title {
                    color: #ffffff !important;
                }
                [data-theme-version="dark"] .wallet-ledger-modal .modal-body-custom {
                    background: #151521;
                }
                [data-theme-version="dark"] .wallet-ledger-modal .modal-footer-custom {
                    background-color: #1e1e2d;
                    border-top-color: rgba(255, 255, 255, 0.1);
                }
                [data-theme-version="dark"] .wallet-ledger-modal .ledger-table-container {
                    border-color: rgba(255, 255, 255, 0.1);
                }
                [data-theme-version="dark"] .wallet-ledger-modal .ledger-table thead th {
                    background-color: #1e1e2d;
                    border-bottom-color: rgba(255, 255, 255, 0.1);
                    color: #94a3b8;
                }
                [data-theme-version="dark"] .wallet-ledger-modal .ledger-table tbody td {
                    border-bottom-color: rgba(255, 255, 255, 0.05);
                    color: #cbd5e1;
                }
                [data-theme-version="dark"] .wallet-ledger-modal .ledger-table tbody tr:hover td {
                    background-color: rgba(255, 255, 255, 0.03);
                }
            `}</style>

            <Modal 
                show={show} 
                onHide={onHide} 
                centered 
                size="xl" 
                dialogClassName="wallet-ledger-modal"
                backdrop="static"
                keyboard={false}
            >
                {/* 1. Header: Wallet Icon, Owner Name, Wallet Code, and Identifier in One Horizontal Row */}
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3 flex-wrap">
                        <div className="modal-icon-circle">
                            <i className="fa fa-wallet text-white" style={{ fontSize: '18px' }}></i>
                        </div>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '17px', color: '#1e293b' }}>
                                {wallet.wallet_name}
                            </h4>
                            <span className="badge bg-light text-primary border" style={{ fontSize: '12px', fontWeight: 600 }}>
                                {wallet.wallet_code}
                            </span>
                            <span className={`badge ${wallet.owner_type === 'Employee' ? 'badge-info light' : (wallet.owner_type === 'Vendor' ? 'badge-warning light' : 'badge-secondary light')}`} style={{ fontSize: '11px' }}>
                                {wallet.owner_type}
                            </span>
                            {wallet.owner_id && wallet.owner_id !== '-' && (
                                <span className="text-muted ms-1" style={{ fontSize: '12.5px' }}>
                                    ID: <strong className="text-dark">{wallet.owner_id}</strong>
                                </span>
                            )}
                            {wallet.mobile && wallet.mobile !== '-' && (
                                <span className="text-muted ms-2" style={{ fontSize: '12px' }}>
                                    <i className="fa fa-phone me-1 text-muted"></i>{wallet.mobile}
                                </span>
                            )}
                            {wallet.email && wallet.email !== '-' && (
                                <span className="text-muted ms-2" style={{ fontSize: '12px' }}>
                                    <i className="fa fa-envelope me-1 text-muted"></i>{wallet.email}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        {/* Ledger Export Options: 1. PDF, 2. Excel, 3. Print */}
                        <div className="d-flex gap-2 me-1">
                            <button 
                                type="button"
                                className="btn btn-sm btn-light border p-0 d-flex align-items-center justify-content-center" 
                                onClick={() => handleExportLedger('pdf')} 
                                title="Export Ledger PDF" 
                                style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: '#f8fafc', borderColor: '#eaebf0' }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                </svg>
                            </button>
                            <button 
                                type="button"
                                className="btn btn-sm btn-light border p-0 d-flex align-items-center justify-content-center" 
                                onClick={() => handleExportLedger('excel')} 
                                title="Export Ledger Excel" 
                                style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: '#f8fafc', borderColor: '#eaebf0' }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <path d="M8 13h2"></path>
                                    <path d="M8 17h2"></path>
                                    <path d="M10 9H8"></path>
                                    <path d="m13 13 3 4"></path>
                                    <path d="m16 13-3 4"></path>
                                </svg>
                            </button>
                            <button 
                                type="button"
                                className="btn btn-sm btn-light border p-0 d-flex align-items-center justify-content-center" 
                                onClick={() => handleExportLedger('print')} 
                                title="Print Ledger" 
                                style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: '#f8fafc', borderColor: '#eaebf0' }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
                                    <polyline points="6 9 6 2 18 2 18 9"></polyline>
                                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                                    <rect x="6" y="14" width="12" height="8"></rect>
                                </svg>
                            </button>
                        </div>
                        <button type="button" className="modal-close-x" onClick={onHide} aria-label="Close">
                            &times;
                        </button>
                    </div>
                </div>

                <div className="modal-body-custom">
                    {/* Date Filters Row: From Date, To Date, Reset in One Horizontal Row */}
                    <div className="p-3 mb-4 rounded-3 border" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                        <div className="row g-2 align-items-center">
                            <div className="col-12 col-md-5">
                                <div className="d-flex align-items-center gap-2">
                                    <label className="form-label mb-0 fw-bold flex-shrink-0 text-nowrap" style={{ fontSize: '13px', color: '#475569' }}>
                                        From:
                                    </label>
                                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                        <DatePicker
                                            customInput={<CustomDateInput />}
                                            selected={modalFromDate ? new Date(modalFromDate.split('-')[0], modalFromDate.split('-')[1] - 1, modalFromDate.split('-')[2]) : null}
                                            onChange={handleModalFromDateChange}
                                            dateFormat={getDatePickerFormat()}
                                            placeholderText={getDatePickerFormat().toLowerCase()}
                                            wrapperClassName="w-100"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="col-12 col-md-5">
                                <div className="d-flex align-items-center gap-2">
                                    <label className="form-label mb-0 fw-bold flex-shrink-0 text-nowrap" style={{ fontSize: '13px', color: '#475569' }}>
                                        To:
                                    </label>
                                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                        <DatePicker
                                            customInput={<CustomDateInput />}
                                            selected={modalToDate ? new Date(modalToDate.split('-')[0], modalToDate.split('-')[1] - 1, modalToDate.split('-')[2]) : null}
                                            onChange={handleModalToDateChange}
                                            dateFormat={getDatePickerFormat()}
                                            placeholderText={getDatePickerFormat().toLowerCase()}
                                            wrapperClassName="w-100"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="col-12 col-md-2 d-flex align-items-center">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary w-100 d-inline-flex align-items-center justify-content-center gap-1"
                                    onClick={handleResetFilter}
                                    disabled={isLoading}
                                    style={{ height: '49px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 500, backgroundColor: '#ffffff' }}
                                >
                                    <i className="fa fa-refresh me-1"></i>
                                    Reset
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 2. Summary Cards: 4 Equal Height & Width Responsive Cards in a Single Row on Desktop */}
                    <div className="row g-3 mb-4">
                        <div className="col-12 col-sm-6 col-lg-3">
                            <div className="summary-card" style={{ background: '#eef2ff', border: '1px solid #c7d2fe' }}>
                                <div className="summary-card-label">Opening Balance</div>
                                <div className="summary-card-value" style={{ color: '#4f46e5' }}>
                                    {formatCurrency(summary?.opening_balance || 0)}
                                </div>
                            </div>
                        </div>
                        <div className="col-12 col-sm-6 col-lg-3">
                            <div className="summary-card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                <div className="summary-card-label">Total Credit</div>
                                <div className="summary-card-value text-success">
                                    {formatCurrency(summary?.total_credit || 0)}
                                </div>
                            </div>
                        </div>
                        <div className="col-12 col-sm-6 col-lg-3">
                            <div className="summary-card" style={{ background: '#fff1f2', border: '1px solid #fecdd3' }}>
                                <div className="summary-card-label">Total Debit</div>
                                <div className="summary-card-value text-danger">
                                    {formatCurrency(summary?.total_debit || 0)}
                                </div>
                            </div>
                        </div>
                        <div className="col-12 col-sm-6 col-lg-3">
                            <div className="summary-card" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                                <div className="summary-card-label">Closing Balance</div>
                                <div className="summary-card-value" style={{ color: '#d97706' }}>
                                    {formatCurrency(summary?.closing_balance || 0)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Ledger Breakdown Heading */}
                    <div className="d-flex align-items-center gap-2 mb-3" style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                            <polyline points="3.29 7 12 12 20.71 7"></polyline>
                            <line x1="12" y1="22" x2="12" y2="12"></line>
                        </svg>
                        LEDGER BREAKDOWN ({ledger.length} ENTRIES)
                    </div>

                    {/* 4. Ledger Table with Exact 10 Columns */}
                    <div className="ledger-table-container">
                        <table className="ledger-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '45px', textAlign: 'center' }}>#</th>
                                    <th>Date</th>
                                    <th>Txn No.</th>
                                    <th>Ref No.</th>
                                    <th style={{ minWidth: '180px' }}>Description</th>
                                    <th style={{ textAlign: 'center' }}>Type</th>
                                    <th style={{ textAlign: 'right' }}>Credit</th>
                                    <th style={{ textAlign: 'right' }}>Debit</th>
                                    <th style={{ textAlign: 'right' }}>Running Balance</th>
                                    <th style={{ textAlign: 'center' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan="10" className="text-center py-5 text-muted">
                                            <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                                            Loading ledger entries...
                                        </td>
                                    </tr>
                                ) : ledger.length === 0 ? (
                                    <tr>
                                        <td colSpan="10" className="text-center py-5 text-muted">
                                            <div className="d-flex flex-column align-items-center justify-content-center py-3">
                                                <i className="fa fa-calendar-times-o text-muted mb-2" style={{ fontSize: '28px' }}></i>
                                                <span className="fw-semibold text-secondary">
                                                    {(appliedFromDate || appliedToDate) 
                                                        ? 'No transactions found for the selected date range.' 
                                                        : 'No transactions recorded for this wallet.'}
                                                </span>
                                                {(appliedFromDate || appliedToDate) && (
                                                    <small className="text-muted mt-1">
                                                        Period: {appliedFromDate || 'Start'} to {appliedToDate || 'Present'}
                                                    </small>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ) : ledger.map((tx, idx) => (
                                    <tr key={tx.id || idx}>
                                        <td style={{ textAlign: 'center', color: '#94a3b8' }}>{idx + 1}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(tx.date)}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            <span className="fw-bold text-primary">{tx.transaction_number}</span>
                                        </td>
                                        <td style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{tx.reference_number || '—'}</td>
                                        <td>{tx.description}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`badge ${tx.transaction_type === 'Credit' ? 'badge-success light' : 'badge-danger light'}`} style={{ fontSize: '11px' }}>
                                                {tx.transaction_type}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} className="fw-semibold text-success">
                                            {parseFloat(tx.credit) > 0 ? formatCurrency(tx.credit) : '—'}
                                        </td>
                                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} className="fw-semibold text-danger">
                                            {parseFloat(tx.debit) > 0 ? formatCurrency(tx.debit) : '—'}
                                        </td>
                                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} className="fw-bold text-dark">
                                            {formatCurrency(tx.running_balance)}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`badge ${tx.status === 'Posted' ? 'badge-success light' : (tx.status === 'Pending' ? 'badge-warning light' : 'badge-secondary light')}`} style={{ fontSize: '11px' }}>
                                                {tx.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>

                            {/* 5. Period Totals and Closing Balance Summary Rows */}
                            <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 1 }}>
                                <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                                    <td colSpan="6" style={{ textAlign: 'right', color: '#475569', fontSize: '12.5px' }}>
                                        Period Totals:
                                    </td>
                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} className="text-success">
                                        {formatCurrency(summary?.total_credit || 0)}
                                    </td>
                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} className="text-danger">
                                        {formatCurrency(summary?.total_debit || 0)}
                                    </td>
                                    <td colSpan="2"></td>
                                </tr>
                                <tr style={{ background: '#f0fdf4', borderTop: '1px solid #bbf7d0' }}>
                                    <td colSpan="8" style={{ textAlign: 'right', color: '#16a34a', fontSize: '13.5px' }}>
                                        Closing Balance:
                                    </td>
                                    <td colSpan="2" style={{ textAlign: 'right', color: '#16a34a', fontSize: '14px', whiteSpace: 'nowrap' }}>
                                        {formatCurrency(summary?.closing_balance || 0)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* 6. Footer and Close Button */}
                <div className="modal-footer-custom">
                    <button 
                        type="button" 
                        className="btn-close-custom" 
                        onClick={onHide}
                    >
                        Close
                    </button>
                </div>
            </Modal>
        </>
    );
};

const WalletReport = () => {
    usePageTitle("Wallet Report");

    // ── State ──────────────────────────────────────────────────────────────
    const [wallets, setWallets] = useState([]);
    const [summary, setSummary] = useState({
        total_wallets: 0,
        total_credit: '0.00',
        total_debit: '0.00',
        net_balance: '0.00',
        total_transactions: 0,
    });
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [activeTab, setActiveTab] = useState('list'); // 'list' | 'graph'

    // Selected Wallet for Ledger Modal
    const [selectedWallet, setSelectedWallet] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [ledgerLoading, setLedgerLoading] = useState(false);
    const [ledgerData, setLedgerData] = useState(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // ── Fetch Main Report Data ─────────────────────────────────────────────
    const fetchWalletReport = useCallback(async () => {
        if (fromDate && toDate && fromDate > toDate) {
            Swal.fire({
                icon: 'warning',
                title: 'Invalid Date Range',
                text: 'From Date cannot be later than To Date.',
            });
            return;
        }

        setLoading(true);
        try {
            const params = {};
            if (fromDate) params.from_date = fromDate;
            if (toDate) params.to_date = toDate;

            const res = await WalletService.getWalletReport(params);
            if (res) {
                setWallets(res.wallets || []);
                if (res.summary) {
                    setSummary(res.summary);
                }
            }
        } catch (error) {
            console.error('Error fetching wallet report:', error);
            const err = error.response?.data?.error || 'Failed to load wallet report data.';
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: typeof err === 'object' ? JSON.stringify(err) : err,
            });
        } finally {
            setLoading(false);
        }
    }, [fromDate, toDate]);

    useEffect(() => {
        fetchWalletReport();
    }, [fetchWalletReport]);

    // ── Open Ledger Modal ──────────────────────────────────────────────────
    const handleOpenLedger = async (wallet) => {
        setSelectedWallet(wallet);
        setShowModal(true);
        setLedgerLoading(true);
        setLedgerData(null);

        try {
            const params = {};
            if (fromDate) params.from_date = fromDate;
            if (toDate) params.to_date = toDate;

            const res = await WalletService.getWalletLedger(wallet.id, params);
            if (res) {
                setLedgerData(res);
            }
        } catch (error) {
            console.error('Error fetching wallet ledger:', error);
            const err = error.response?.data?.error || 'Failed to load wallet ledger.';
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: typeof err === 'object' ? JSON.stringify(err) : err,
            });
        } finally {
            setLedgerLoading(false);
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedWallet(null);
        setLedgerData(null);
    };

    // ── Filtered Data & Pagination ─────────────────────────────────────────
    const filteredWallets = useMemo(() => {
        return wallets.filter(wallet => {
            if (!searchTerm.trim()) return true;
            const term = searchTerm.toLowerCase();
            return (
                (wallet.wallet_code && wallet.wallet_code.toLowerCase().includes(term)) ||
                (wallet.wallet_name && wallet.wallet_name.toLowerCase().includes(term)) ||
                (wallet.owner_type && wallet.owner_type.toLowerCase().includes(term)) ||
                (wallet.owner_id && String(wallet.owner_id).toLowerCase().includes(term))
            );
        });
    }, [wallets, searchTerm]);

    const totalPages = Math.ceil(filteredWallets.length / itemsPerPage) || 1;
    const indexOfFirstItem = (currentPage - 1) * itemsPerPage;
    const indexOfLastItem = indexOfFirstItem + itemsPerPage;
    const currentItems = filteredWallets.slice(indexOfFirstItem, indexOfLastItem);

    // Reset pagination on search change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, fromDate, toDate]);

    // ── Date Filters Handler with Range Guard ───────────────────────────────
    const handleFromDateChange = (date) => {
        if (!date) {
            setFromDate('');
            return;
        }
        const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (toDate && formatted > toDate) {
            Swal.fire({
                icon: 'warning',
                title: 'Invalid Date Range',
                text: 'From Date cannot be later than To Date.',
            });
            return;
        }
        setFromDate(formatted);
    };

    const handleToDateChange = (date) => {
        if (!date) {
            setToDate('');
            return;
        }
        const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (fromDate && formatted < fromDate) {
            Swal.fire({
                icon: 'warning',
                title: 'Invalid Date Range',
                text: 'To Date cannot be earlier than From Date.',
            });
            return;
        }
        setToDate(formatted);
    };

    // ── Export Handler (matching SalesReportList) ───────────────────────────
    const handleExport = (format) => {
        const columns = [
            { header: 'Sl. No.', dataKey: 'index' },
            { header: 'Wallet Code', dataKey: 'wallet_code' },
            { header: 'Wallet Name', dataKey: 'wallet_name' },
            { header: 'Owner Type', dataKey: 'owner_type' },
            { header: 'Owner ID', dataKey: 'owner_id', formatter: (v) => v || '—' },
            { header: 'Total Credit', dataKey: 'total_credit', formatter: (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
            { header: 'Total Debit', dataKey: 'total_debit', formatter: (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
            { header: 'Current Balance', dataKey: 'current_balance', formatter: (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
            { header: 'Txns', dataKey: 'transaction_count' }
        ];
        const dataWithIndex = filteredWallets.map((d, i) => ({ ...d, index: i + 1 }));
        const dateRangeStr = (fromDate || toDate) ? `(${fromDate || 'Start'} to ${toDate || 'Present'})` : '';
        const title = `Wallet Report ${dateRangeStr}`.trim();

        if (format === 'pdf') {
            exportToPDF(dataWithIndex, columns, 'wallet_report.pdf', title, false);
        } else if (format === 'excel') {
            exportToExcel(dataWithIndex, columns, 'wallet_report.xlsx', false);
        } else if (format === 'print') {
            printReportData(filteredWallets, summary, fromDate, toDate);
        }
    };

    // ── Graphical View Data & Chart Options (Matching SalesReportList) ─────
    const topWallets = useMemo(() => {
        return [...filteredWallets]
            .sort((a, b) => (parseFloat(b.current_balance) || 0) - (parseFloat(a.current_balance) || 0))
            .slice(0, 8);
    }, [filteredWallets]);

    const barChartCategories = useMemo(() => {
        return topWallets.map(w => (w.wallet_name && w.wallet_name.length > 15 ? w.wallet_name.substring(0, 15) + '...' : (w.wallet_name || w.wallet_code)));
    }, [topWallets]);

    const barChartSeries = useMemo(() => {
        return [{
            name: 'Current Balance',
            data: topWallets.map(w => parseFloat(w.current_balance) || 0)
        }];
    }, [topWallets]);

    const barChartOptions = useMemo(() => ({
        chart: {
            type: 'bar',
            height: 380,
            toolbar: { show: false },
            fontFamily: 'Inter, sans-serif'
        },
        plotOptions: {
            bar: {
                borderRadius: 6,
                columnWidth: '40%',
                distributed: false
            }
        },
        dataLabels: { enabled: false },
        xaxis: {
            categories: barChartCategories,
            labels: {
                style: { colors: '#64748b', fontSize: '12px', fontWeight: 600 }
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                formatter: (val) => val.toLocaleString('en-IN'),
                style: { colors: '#64748b', fontSize: '12px', fontWeight: 500 }
            }
        },
        grid: {
            borderColor: '#f1f5f9',
            strokeDashArray: 4,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } }
        },
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'light',
                type: 'vertical',
                shadeIntensity: 0.25,
                gradientToColors: ['#3b82f6'],
                inverseColors: false,
                opacityFrom: 1,
                opacityTo: 0.85,
                stops: [0, 100]
            }
        },
        colors: ['#1e40af'],
        tooltip: {
            theme: 'light',
            custom: function ({ series, seriesIndex, dataPointIndex }) {
                const walletItem = topWallets[dataPointIndex];
                if (!walletItem) return '';
                const val = series[seriesIndex][dataPointIndex];
                const formattedVal = '₹ ' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return `
                    <div style="font-family: Inter, sans-serif; font-size: 13px; min-width: 180px; background: #fff;">
                        <div style="font-weight: 600; padding: 8px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #1e293b;">
                            ${walletItem.wallet_name} (${walletItem.wallet_code})
                        </div>
                        <div style="padding: 10px 12px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                                <span style="color: #64748b;">Owner Type:</span>
                                <span style="font-weight: 600; color: #1e293b;">${walletItem.owner_type}</span>
                            </div>
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <span style="color: #64748b;">Balance:</span>
                                <span style="font-weight: 700; color: #1e40af;">${formattedVal}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
    }), [barChartCategories, topWallets]);

    // Donut Chart: Wallets by Owner Type
    const ownerTypeMap = useMemo(() => {
        const map = {};
        filteredWallets.forEach(w => {
            const type = w.owner_type || 'Other';
            map[type] = (map[type] || 0) + 1;
        });
        return map;
    }, [filteredWallets]);

    const ownerTypeLabels = useMemo(() => Object.keys(ownerTypeMap), [ownerTypeMap]);
    const ownerTypeSeries = useMemo(() => ownerTypeLabels.map(k => ownerTypeMap[k]), [ownerTypeLabels, ownerTypeMap]);

    const donutOptions = useMemo(() => ({
        chart: {
            type: 'donut',
            fontFamily: 'Inter, sans-serif'
        },
        labels: ownerTypeLabels,
        dataLabels: { enabled: false },
        plotOptions: {
            pie: {
                donut: {
                    size: '75%',
                    labels: {
                        show: true,
                        name: { show: true, fontSize: '14px', color: '#64748b' },
                        value: {
                            show: true,
                            fontSize: '16px',
                            fontWeight: 'bold',
                            color: '#1e293b',
                            formatter: function (val) {
                                return `${val} Wallets`;
                            }
                        },
                        total: {
                            show: true,
                            label: 'Total Wallets',
                            fontSize: '12px',
                            color: '#64748b',
                            formatter: function () {
                                return `${filteredWallets.length}`;
                            }
                        }
                    }
                }
            }
        },
        legend: {
            position: 'bottom',
            fontSize: '13px',
            markers: { radius: 12 }
        },
        tooltip: {
            theme: 'light',
            fillSeriesColor: false,
            y: {
                formatter: function (val) {
                    return `${val} Wallets`;
                }
            }
        },
        stroke: { show: true, colors: ['#fff'], width: 2 },
        colors: ['#1e40af', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']
    }), [ownerTypeLabels, filteredWallets.length]);

    // Credit vs Debit Overview Chart (Grouped Column)
    const topCreditDebitWallets = useMemo(() => {
        return [...filteredWallets]
            .sort((a, b) => (parseFloat(b.total_credit || 0) + parseFloat(b.total_debit || 0)) - (parseFloat(a.total_credit || 0) + parseFloat(a.total_debit || 0)))
            .slice(0, 6);
    }, [filteredWallets]);

    const creditDebitCategories = useMemo(() => {
        return topCreditDebitWallets.map(w => (w.wallet_name && w.wallet_name.length > 15 ? w.wallet_name.substring(0, 15) + '...' : (w.wallet_name || w.wallet_code)));
    }, [topCreditDebitWallets]);

    const creditDebitSeries = useMemo(() => [
        {
            name: 'Total Credit',
            data: topCreditDebitWallets.map(w => parseFloat(w.total_credit) || 0)
        },
        {
            name: 'Total Debit',
            data: topCreditDebitWallets.map(w => parseFloat(w.total_debit) || 0)
        }
    ], [topCreditDebitWallets]);

    const creditDebitChartOptions = useMemo(() => ({
        chart: {
            type: 'bar',
            height: 350,
            toolbar: { show: false },
            fontFamily: 'Inter, sans-serif'
        },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '50%',
                borderRadius: 4
            }
        },
        dataLabels: { enabled: false },
        stroke: { show: true, width: 2, colors: ['transparent'] },
        xaxis: {
            categories: creditDebitCategories,
            labels: { style: { colors: '#64748b', fontSize: '12px', fontWeight: 600 } },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                formatter: (val) => val.toLocaleString('en-IN'),
                style: { colors: '#64748b', fontSize: '12px', fontWeight: 500 }
            }
        },
        grid: {
            borderColor: '#f1f5f9',
            strokeDashArray: 4
        },
        colors: ['#16a34a', '#dc2626'],
        tooltip: {
            theme: 'light',
            y: {
                formatter: function (val) {
                    return '₹ ' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }
            }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'right',
            fontSize: '13px'
        }
    }), [creditDebitCategories]);

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Body>
                            <div className="d-flex flex-column gap-3 w-100 mb-2">

                                {/* Top Row: Tabs + Export Buttons (Matching SalesReportList) */}
                                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                                    {/* Left Column: Tabs */}
                                    <div className="d-flex align-items-start">
                                        <div className="d-flex p-1 bg-light rounded-pill" style={{ maxWidth: 'fit-content', border: '1px solid #eaebf0' }}>
                                            <button 
                                                className={`btn btn-sm rounded-pill px-4 py-2 fw-semibold d-flex align-items-center ${activeTab === 'list' ? 'bg-white shadow-sm' : 'text-muted bg-transparent border-0'}`} 
                                                onClick={() => setActiveTab('list')} 
                                                style={{ border: activeTab === 'list' ? '1px solid #eaebf0' : 'none', color: activeTab === 'list' ? '#1e40af' : '', transition: 'all 0.2s ease-in-out' }}
                                            >
                                                <i className="fa fa-list me-2"></i> List View
                                            </button>
                                            <button 
                                                className={`btn btn-sm rounded-pill px-4 py-2 fw-semibold d-flex align-items-center ${activeTab === 'graph' ? 'bg-white shadow-sm' : 'text-muted bg-transparent border-0'}`} 
                                                onClick={() => setActiveTab('graph')} 
                                                style={{ border: activeTab === 'graph' ? '1px solid #eaebf0' : 'none', color: activeTab === 'graph' ? '#1e40af' : '', transition: 'all 0.2s ease-in-out' }}
                                            >
                                                <i className="fa fa-chart-bar me-2"></i> Graphical View
                                            </button>
                                        </div>
                                    </div>

                                    {/* Export Buttons: 1. PDF Export, 2. Excel Export, 3. Print */}
                                    <div className="d-flex gap-2">
                                        <button 
                                            type="button"
                                            className="btn btn-sm btn-light border p-0 d-flex align-items-center justify-content-center" 
                                            onClick={() => handleExport('pdf')} 
                                            title="Export PDF" 
                                            style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: '#f8fafc', borderColor: '#eaebf0', transition: 'all 0.2s' }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                        </button>
                                        <button 
                                            type="button"
                                            className="btn btn-sm btn-light border p-0 d-flex align-items-center justify-content-center" 
                                            onClick={() => handleExport('excel')} 
                                            title="Export Excel" 
                                            style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: '#f8fafc', borderColor: '#eaebf0', transition: 'all 0.2s' }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                        </button>
                                        <button 
                                            type="button"
                                            className="btn btn-sm btn-light border p-0 d-flex align-items-center justify-content-center" 
                                            onClick={() => handleExport('print')} 
                                            title="Print" 
                                            style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: '#f8fafc', borderColor: '#eaebf0', transition: 'all 0.2s' }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Bottom Row: Date Filters + Search (Matching SalesReportList) */}
                                <div className="row flex-wrap flex-md-nowrap w-100 m-0">
                                    <div className="col-12 col-md-4 px-1 mb-2 mb-md-0">
                                        <div className="d-flex align-items-center gap-2 w-100">
                                            <label className="form-label mb-0 fw-bold flex-shrink-0 text-nowrap">From:</label>
                                            <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                                <DatePicker
                                                    customInput={<CustomDateInput />}
                                                    selected={fromDate ? new Date(fromDate.split('-')[0], fromDate.split('-')[1] - 1, fromDate.split('-')[2]) : null}
                                                    onChange={handleFromDateChange}
                                                    dateFormat={getDatePickerFormat()}
                                                    placeholderText={getDatePickerFormat().toLowerCase()}
                                                    wrapperClassName="w-100"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-12 col-md-4 px-1 mb-2 mb-md-0">
                                        <div className="d-flex align-items-center gap-2 w-100">
                                            <label className="form-label mb-0 fw-bold flex-shrink-0 text-nowrap">To:</label>
                                            <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                                <DatePicker
                                                    customInput={<CustomDateInput />}
                                                    selected={toDate ? new Date(toDate.split('-')[0], toDate.split('-')[1] - 1, toDate.split('-')[2]) : null}
                                                    onChange={handleToDateChange}
                                                    dateFormat={getDatePickerFormat()}
                                                    placeholderText={getDatePickerFormat().toLowerCase()}
                                                    wrapperClassName="w-100"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-12 col-md-4 px-1 mb-2 mb-md-0">
                                        <div className="search-bar-container w-100">
                                            <span className="search-icon">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                            </span>
                                            <input
                                                type="text"
                                                className="search-input w-100"
                                                style={{ height: '49px' }}
                                                placeholder="Search report..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Main Content Tabs */}
                                <div className="tab-content mt-1 px-4 pb-4">
                                    {activeTab === 'list' && (
                                        <>
                                            <div className="table-responsive">
                                                <table className="fd-table">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: '80px' }}>SL.NO</th>
                                                            <th>WALLET NAME</th>
                                                            <th style={{ width: '180px' }}>OWNER TYPE</th>
                                                            <th className="text-end" style={{ width: '220px' }}>CURRENT BALANCE</th>
                                                            <th className="text-center" style={{ width: '100px' }}>ACTIONS</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {loading ? (
                                                            <tr><td colSpan="5" className="text-center py-4 text-muted">Loading report...</td></tr>
                                                        ) : filteredWallets.length === 0 ? (
                                                            <tr><td colSpan="5" className="text-center py-4 text-muted">No wallets found matching your filter criteria.</td></tr>
                                                        ) : currentItems.map((wallet, idx) => (
                                                            <tr key={wallet.id || idx} style={{ cursor: 'pointer' }} onClick={() => handleOpenLedger(wallet)}>
                                                                <td className="text-muted">{indexOfFirstItem + idx + 1}</td>
                                                                <td className="fw-semibold">
                                                                    <span className="text-dark">{wallet.wallet_name}</span>
                                                                </td>
                                                                <td>
                                                                    <span className={`badge ${wallet.owner_type === 'Employee' ? 'badge-info light' : (wallet.owner_type === 'Vendor' ? 'badge-warning light' : 'badge-secondary light')}`}>
                                                                        {wallet.owner_type}
                                                                    </span>
                                                                </td>
                                                                <td className="text-end fw-bold" style={{ color: parseFloat(wallet.current_balance || 0) < 0 ? '#dc2626' : '#16a34a' }}>
                                                                    {formatCurrency(wallet.current_balance)}
                                                                </td>
                                                                <td className="text-center" onClick={(e) => { e.stopPropagation(); handleOpenLedger(wallet); }}>
                                                                    <button 
                                                                        type="button" 
                                                                        className="btn btn-outline-info shadow"
                                                                        style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                        title="View Wallet Ledger"
                                                                    >
                                                                        <i className="fa fa-eye"></i>
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Pagination (Matching SalesReportList) */}
                                            {filteredWallets.length > 0 && (
                                                <div className="d-flex justify-content-between align-items-center mt-3">
                                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredWallets.length)} of {filteredWallets.length} entries
                                                    </div>
                                                    {totalPages > 1 && (
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
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {activeTab === 'graph' && (
                                        <>
                                            {/* Summary Tiles (Matching SalesReportList) */}
                                            <div className="row mt-3">
                                                <div className="col-xl-3 col-md-6 mb-4">
                                                    <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                                        <div className="card-body p-4 d-flex align-items-center">
                                                            <div className="rounded-circle d-flex justify-content-center align-items-center" style={{ width: '60px', height: '60px', backgroundColor: 'rgba(30, 64, 175, 0.1)' }}>
                                                                <i className="fa fa-wallet" style={{ fontSize: '1.5rem', color: '#1e40af' }}></i>
                                                            </div>
                                                            <div className="ms-4">
                                                                <p className="text-muted mb-1 fw-bold text-uppercase tracking-wider" style={{ fontSize: '12px', letterSpacing: '0.5px' }}>Total Wallets</p>
                                                                <h3 className="mb-0 fw-bold text-dark">{summary.total_wallets}</h3>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-xl-3 col-md-6 mb-4">
                                                    <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                                        <div className="card-body p-4 d-flex align-items-center">
                                                            <div className="rounded-circle d-flex justify-content-center align-items-center" style={{ width: '60px', height: '60px', backgroundColor: 'rgba(22, 163, 74, 0.1)' }}>
                                                                <i className="fa fa-arrow-down" style={{ fontSize: '1.5rem', color: '#16a34a' }}></i>
                                                            </div>
                                                            <div className="ms-4">
                                                                <p className="text-muted mb-1 fw-bold text-uppercase tracking-wider" style={{ fontSize: '12px', letterSpacing: '0.5px' }}>Total Credit</p>
                                                                <h3 className="mb-0 fw-bold text-success">{formatCurrency(summary.total_credit)}</h3>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-xl-3 col-md-6 mb-4">
                                                    <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                                        <div className="card-body p-4 d-flex align-items-center">
                                                            <div className="rounded-circle d-flex justify-content-center align-items-center" style={{ width: '60px', height: '60px', backgroundColor: 'rgba(220, 38, 38, 0.1)' }}>
                                                                <i className="fa fa-arrow-up" style={{ fontSize: '1.5rem', color: '#dc2626' }}></i>
                                                            </div>
                                                            <div className="ms-4">
                                                                <p className="text-muted mb-1 fw-bold text-uppercase tracking-wider" style={{ fontSize: '12px', letterSpacing: '0.5px' }}>Total Debit</p>
                                                                <h3 className="mb-0 fw-bold text-danger">{formatCurrency(summary.total_debit)}</h3>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-xl-3 col-md-6 mb-4">
                                                    <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                                        <div className="card-body p-4 d-flex align-items-center">
                                                            <div className="rounded-circle d-flex justify-content-center align-items-center" style={{ width: '60px', height: '60px', backgroundColor: 'rgba(147, 51, 234, 0.1)' }}>
                                                                <i className="fa fa-coins" style={{ fontSize: '1.5rem', color: '#9333ea' }}></i>
                                                            </div>
                                                            <div className="ms-4">
                                                                <p className="text-muted mb-1 fw-bold text-uppercase tracking-wider" style={{ fontSize: '12px', letterSpacing: '0.5px' }}>Net Balance</p>
                                                                <h3 className="mb-0 fw-bold text-primary">{formatCurrency(summary.net_balance)}</h3>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Charts Row 1: Top Wallets Bar Chart & Donut Chart */}
                                            <div className="row mt-1">
                                                <div className="col-xl-8 col-lg-12 mb-4">
                                                    <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                                        <div className="card-body p-4 p-md-5">
                                                            <div className="d-flex flex-wrap justify-content-between align-items-start align-items-md-center mb-4 gap-3">
                                                                <div>
                                                                    <h4 className="mb-1 fw-bold text-dark">Top Wallets by Balance</h4>
                                                                    <p className="text-muted mb-0" style={{ fontSize: '14px' }}>Overview of highest balance holding wallets</p>
                                                                </div>
                                                            </div>
                                                            {topWallets.length > 0 ? (
                                                                <ReactApexChart options={barChartOptions} series={barChartSeries} type="bar" height={380} />
                                                            ) : (
                                                                <div className="text-center py-5">
                                                                    <div className="mb-3">
                                                                        <i className="fa fa-chart-bar" style={{ fontSize: '3rem', color: '#cbd5e1' }}></i>
                                                                    </div>
                                                                    <h5 className="text-muted fw-semibold">No data available</h5>
                                                                    <p className="text-muted" style={{ fontSize: '14px' }}>Adjust filters to see wallet balances.</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="col-xl-4 col-lg-12 mb-4">
                                                    <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                                        <div className="card-body p-4 p-md-5">
                                                            <div className="mb-4">
                                                                <h4 className="mb-1 fw-bold text-dark">Wallets by Owner Type</h4>
                                                                <p className="text-muted mb-0" style={{ fontSize: '14px' }}>Distribution of wallets among owner categories</p>
                                                            </div>
                                                            {ownerTypeLabels.length > 0 ? (
                                                                <div className="d-flex justify-content-center align-items-center h-100" style={{ minHeight: '300px' }}>
                                                                    <ReactApexChart options={donutOptions} series={ownerTypeSeries} type="donut" width="100%" />
                                                                </div>
                                                            ) : (
                                                                <div className="text-center py-5">
                                                                    <div className="mb-3">
                                                                        <i className="fa fa-chart-pie" style={{ fontSize: '3rem', color: '#cbd5e1' }}></i>
                                                                    </div>
                                                                    <h5 className="text-muted fw-semibold">No data available</h5>
                                                                    <p className="text-muted" style={{ fontSize: '14px' }}>Adjust filters to see distribution.</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Charts Row 2: Credit vs Debit Comparison Chart */}
                                            <div className="row mt-1">
                                                <div className="col-12 mb-4">
                                                    <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                                        <div className="card-body p-4 p-md-5">
                                                            <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
                                                                <div>
                                                                    <h4 className="mb-1 fw-bold text-dark">Credit vs Debit Comparison</h4>
                                                                    <p className="text-muted mb-0" style={{ fontSize: '14px' }}>Comparison of credit and debit flow across top active wallets</p>
                                                                </div>
                                                                <div className="d-flex align-items-center">
                                                                    <span className="badge bg-light text-dark px-3 py-2" style={{ border: '1px solid #eaebf0', borderRadius: '8px' }}>
                                                                        <i className="fa fa-exchange-alt text-muted me-2"></i> Activity Comparison
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {topCreditDebitWallets.length > 0 ? (
                                                                <ReactApexChart options={creditDebitChartOptions} series={creditDebitSeries} type="bar" height={350} />
                                                            ) : (
                                                                <div className="text-center py-5">
                                                                    <div className="mb-3">
                                                                        <i className="fa fa-chart-area" style={{ fontSize: '3rem', color: '#cbd5e1' }}></i>
                                                                    </div>
                                                                    <h5 className="text-muted fw-semibold">No data available</h5>
                                                                    <p className="text-muted" style={{ fontSize: '14px' }}>Adjust filters to view comparisons.</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Wallet Ledger Modal */}
            <WalletLedgerModal
                wallet={selectedWallet}
                ledgerData={ledgerData}
                loading={ledgerLoading}
                show={showModal}
                onHide={handleCloseModal}
                fromDate={fromDate}
                toDate={toDate}
            />
        </div>
    );
};

export default WalletReport;
