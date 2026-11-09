import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Card, Button, Modal, Form, Row, Col, Table } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';
import PaymentForm from './PaymentForm';
import { ThemeContext } from '../../../context/ThemeContext';
import { getLedgers, getPayments, createPayment, updatePayment, deletePayment } from '../../../services/FinanceService';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import InventoryService from '../../../services/InventoryService';
import PurchaseService from '../../../services/PurchaseService';
import SalesService from '../../../services/SalesService';

const PaymentList = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [payments, setPayments] = useState([]);
    const [ledgers, setLedgers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [expandedNarrations, setExpandedNarrations] = useState({});
    const [maintainNarration, setMaintainNarration] = useState(false);

    // Bill-wise settlement states
    const [billAllocations, setBillAllocations] = useState({});
    const [billSettlementModal, setBillSettlementModal] = useState({ show: false, drIdx: null });
    const [ledgerInvoices, setLedgerInvoices] = useState({});

    const fetchInvoicesForLedger = async (ledgerIdInput, forceRefresh = false) => {
        if (!ledgerIdInput) return;
        const ledgerId = String(ledgerIdInput?.id || ledgerIdInput);
        if (!forceRefresh && ledgerInvoices[ledgerId]) return;
        
        try {
            const res = await PurchaseService.getPurchaseInvoicesBySupplier(ledgerId);
            const invoicesList = Array.isArray(res.data) ? res.data : [];
            setLedgerInvoices(prev => ({
                ...prev,
                [ledgerId]: invoicesList
            }));
        } catch (error) {
            console.error('Failed to fetch purchase invoices for ledger:', error);
        }
    };

    const openBillSettlement = (drIdx) => {
        const drRowsLocal = currentPayment.details.filter(d => d.entry_type === 'Dr');
        const row = drRowsLocal[drIdx];
        if (!row || !row.ledger) {
            Swal.fire('Select Ledger First', 'Please select a Supplier / Party ledger before opening bill-wise settlement.', 'warning');
            return;
        }
        const ledgerId = String(row.ledger?.id || row.ledger);
        fetchInvoicesForLedger(ledgerId);
        setBillSettlementModal({ show: true, drIdx });
    };

    const applyBillSettlement = (drIdx, allocations) => {
        setBillAllocations(prev => ({ ...prev, [drIdx]: allocations }));
        if (allocations.length > 0) {
            const totalSettled = allocations.reduce((s, a) => s + (parseFloat(a.settleAmount) || 0), 0);
            handleDrRowChange(drIdx, 'debit_amount', totalSettled);
        }
        setBillSettlementModal({ show: false, drIdx: null });
    };

    const defaultDetail = {
        entry_type: 'Dr',
        ledger: '',
        debit_amount: 0.00,
        credit_amount: 0.00,
        narration: ''
    };

    const defaultPayment = {
        id: null,
        voucher_no: '',
        voucher_date: new Date().toISOString().split('T')[0],
        narration: '',
        details: [
            { ...defaultDetail, entry_type: 'Cr' },
            { ...defaultDetail, entry_type: 'Dr' }
        ]
    };

    const [currentPayment, setCurrentPayment] = useState(defaultPayment);
    const [cellToFocus, setCellToFocus] = useState(null);

    const { background } = useContext(ThemeContext);
    const isDark = background?.value === 'dark';

    useEffect(() => {
        const initData = async () => {
            setLoading(true);
            try {
                const [paymentsData, ledgersData] = await Promise.all([getPayments(), getLedgers()]);
                setPayments(paymentsData || []);
                setLedgers(ledgersData || []);

                const searchParams = new URLSearchParams(location.search);
                const editId = searchParams.get('edit');
                if (editId && paymentsData && paymentsData.length > 0) {
                    const cleanTarget = String(editId).toLowerCase().replace(/[^a-z0-9]/g, '');
                    const itemToEdit = paymentsData.find(p => {
                        const pId = String(p.id);
                        const pVNo = String(p.voucher_no || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                        return pId === String(editId) || pVNo === cleanTarget || (cleanTarget && pVNo.endsWith(cleanTarget));
                    });
                    if (itemToEdit) {
                        await handleShowModal(itemToEdit, ledgersData);
                    }
                }
            } catch (err) {
                console.error('Error initializing payments data:', err);
            } finally {
                setLoading(false);
            }
            fetchConfiguration();
        };
        initData();
    }, [location.search]);

    useEffect(() => {
        if (!cellToFocus) return;

        let mounted = true;
        const tryFocus = (attempts = 0) => {
            if (!mounted) return;
            const id = `cell-${cellToFocus.rowIndex}-${cellToFocus.colName}`;
            const element = document.getElementById(id);
            if (element && !element.disabled && element.offsetParent !== null) {
                element.focus();
                if (element.select) {
                    element.select();
                }
                setCellToFocus(null);
            } else if (attempts < 15) {
                setTimeout(() => tryFocus(attempts + 1), 20);
            } else {
                const masterNarrationEl = document.getElementById('master-narration');
                if (masterNarrationEl) {
                    masterNarrationEl.focus();
                }
                setCellToFocus(null);
            }
        };

        tryFocus();

        return () => {
            mounted = false;
        };
    }, [currentPayment.details, cellToFocus]);

    const fetchConfiguration = async () => {
        try {
            const res = await InventoryService.getProductConfigurations();
            const configs = Array.isArray(res.data) ? res.data : [];
            const myConfig = configs.find(c => 
                (c.voucher_type_name && c.voucher_type_name.toLowerCase() === 'payment') ||
                (c.voucher_type_code && c.voucher_type_code.toLowerCase() === 'pv')
            );
            if (myConfig) {
                setMaintainNarration(!!myConfig.maintain_narration);
            } else {
                setMaintainNarration(false);
            }
        } catch (error) {
            console.error('Failed to fetch product configuration:', error);
        }
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getPayments();
            setPayments(data);
        } catch (error) {
            Swal.fire('Error', 'Failed to fetch payment vouchers', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchLedgers = async () => {
        try {
            const data = await getLedgers();
            setLedgers(data);
        } catch (error) {
            console.error('Failed to fetch ledgers', error);
        }
    };

    const generateVoucherNo = () => {
        if (!payments || payments.length === 0) return 'PV-0001';
        
        let maxNum = 0;
        payments.forEach(p => {
            const match = p.voucher_no.match(/\d+$/);
            if (match) {
                const num = parseInt(match[0], 10);
                if (num > maxNum) {
                    maxNum = num;
                }
            }
        });
        
        return `PV-${String(maxNum + 1).padStart(4, '0')}`;
    };

    const printVoucher = (voucher, type) => {
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) {
            Swal.fire('Error', 'Failed to open print window. Please allow popups.', 'error');
            return;
        }

        const getLedgerName = (id) => {
            const ledger = ledgers.find(l => String(l.id) === String(id));
            return ledger ? ledger.name : 'Unknown Ledger';
        };

        const totalDr = voucher.details?.reduce((sum, d) => sum + (parseFloat(d.debit_amount) || 0), 0) || 0;
        const totalCr = voucher.details?.reduce((sum, d) => sum + (parseFloat(d.credit_amount) || 0), 0) || 0;

        const html = `
            <html>
                <head>
                    <title>${type} Voucher - ${voucher.voucher_no}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
                    <style>
                        body {
                            font-family: 'Inter', sans-serif;
                            margin: 0;
                            padding: 0;
                            background-color: #f8f9fc;
                            color: #2e3d52;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        .page-container {
                            max-width: 800px;
                            margin: 30px auto;
                            background: #ffffff;
                            padding: 40px;
                            border-radius: 8px;
                            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                        }
                        .header-section {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            border-bottom: 2px solid #e3e6f0;
                            padding-bottom: 20px;
                            margin-bottom: 30px;
                        }
                        .company-info h1 {
                            font-size: 26px;
                            font-weight: 700;
                            margin: 0;
                            color: #2f3f50;
                            letter-spacing: 0.5px;
                        }
                        .company-info p {
                            margin: 4px 0 0 0;
                            font-size: 12px;
                            color: #858796;
                        }
                        .voucher-title {
                            background-color: #f8f9fc;
                            border: 1px solid #e3e6f0;
                            border-radius: 6px;
                            padding: 10px 20px;
                            text-align: right;
                        }
                        .voucher-title h2 {
                            margin: 0;
                            font-size: 16px;
                            font-weight: 700;
                            text-transform: uppercase;
                            color: #2e3d52;
                        }
                        .voucher-title p {
                            margin: 2px 0 0 0;
                            font-size: 13px;
                            font-weight: 600;
                            color: #2f3f50;
                        }
                        .meta-grid {
                            display: grid;
                            grid-template-columns: repeat(2, 1fr);
                            gap: 20px;
                            margin-bottom: 30px;
                            font-size: 13px;
                        }
                        .meta-item {
                            display: flex;
                            margin-bottom: 6px;
                        }
                        .meta-label {
                            font-weight: 600;
                            color: #858796;
                            width: 120px;
                        }
                        .meta-value {
                            color: #2e3d52;
                            font-weight: 500;
                        }
                        .table-container {
                            margin-bottom: 30px;
                        }
                        .voucher-table {
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 13px;
                        }
                        .voucher-table th {
                            background-color: #2e3d52;
                            color: #ffffff;
                            font-weight: 600;
                            text-transform: uppercase;
                            font-size: 11px;
                            letter-spacing: 0.5px;
                            padding: 12px 10px;
                            border: 1px solid #2e3d52;
                        }
                        .voucher-table td {
                            padding: 12px 10px;
                            border: 1px solid #e3e6f0;
                            vertical-align: top;
                        }
                        .badge-type {
                            display: inline-block;
                            padding: 3px 8px;
                            font-weight: 700;
                            font-size: 11px;
                            border-radius: 4px;
                            text-transform: uppercase;
                        }
                        .badge-dr {
                            background-color: #e2f7ed;
                            color: #2dce89;
                        }
                        .badge-cr {
                            background-color: #fdebeb;
                            color: #f5365c;
                        }
                        .amount-col {
                            text-align: right;
                            font-family: 'Courier New', Courier, monospace;
                            font-weight: 600;
                            font-size: 14px;
                        }
                        .total-row {
                            background-color: #f8f9fc;
                            font-weight: 700;
                        }
                        .total-row td {
                            border-top: 2px solid #d1d3e2;
                            border-bottom: 2px double #d1d3e2;
                        }
                        .narration-box {
                            background-color: #f8f9fc;
                            border-left: 4px solid #2e3d52;
                            padding: 15px;
                            border-radius: 0 6px 6px 0;
                            margin-bottom: 40px;
                            font-size: 13px;
                        }
                        .narration-box strong {
                            display: block;
                            margin-bottom: 6px;
                            color: #858796;
                            font-size: 11px;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        }
                        .narration-text {
                            color: #2e3d52;
                            line-height: 1.5;
                            white-space: pre-wrap;
                        }
                        .signature-section {
                            margin-top: 80px;
                            display: grid;
                            grid-template-columns: repeat(3, 1fr);
                            gap: 30px;
                        }
                        .signature-block {
                            text-align: center;
                        }
                        .signature-line {
                            border-top: 1px solid #d1d3e2;
                            padding-top: 8px;
                            font-size: 11px;
                            font-weight: 600;
                            color: #858796;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        }
                        @media print {
                            body {
                                background-color: #ffffff;
                            }
                            .page-container {
                                margin: 0;
                                padding: 0;
                                box-shadow: none;
                                max-width: 100%;
                            }
                            .signature-section {
                                page-break-inside: avoid;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="page-container">
                        <div class="header-section">
                            <div class="company-info">
                                <h1>TRUETONE ERP</h1>
                                <p>Digital Financial Management Solutions</p>
                                <p style="color:#a3a6b5;">Thrissur, Kerala, India | Tel: +91 487 000 0000</p>
                            </div>
                            <div class="voucher-title">
                                <h2>${type} Voucher</h2>
                                <p>${voucher.voucher_no}</p>
                            </div>
                        </div>

                        <div class="meta-grid">
                            <div>
                                <div class="meta-item">
                                    <span class="meta-label">Voucher Type:</span>
                                    <span class="meta-value">${type}</span>
                                </div>
                                <div class="meta-item">
                                    <span class="meta-label">Voucher No:</span>
                                    <span class="meta-value" style="font-weight: 700; color: #2e3d52;">${voucher.voucher_no}</span>
                                </div>
                            </div>
                            <div style="text-align: right; justify-self: end;">
                                <div class="meta-item" style="justify-content: flex-end;">
                                    <span class="meta-label" style="text-align: right; padding-right: 10px;">Date:</span>
                                    <span class="meta-value">${voucher.voucher_date}</span>
                                </div>
                            </div>
                        </div>

                        <div class="table-container">
                            <table class="voucher-table">
                                <thead>
                                    <tr>
                                        <th style="width: 12%; text-align: center;">By/To</th>
                                        <th style="width: 48%;">Particulars</th>
                                        <th style="width: 20%; text-align: right;">Debit ()</th>
                                        <th style="width: 20%; text-align: right;">Credit ()</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${voucher.details?.map(row => `
                                        <tr>
                                            <td style="text-align: center; vertical-align: middle;">
                                                <span class="badge-type ${row.entry_type === 'Dr' ? 'badge-dr' : 'badge-cr'}">
                                                    ${row.entry_type}
                                                </span>
                                            </td>
                                            <td>
                                                <div style="font-weight: 600; color: #2e3d52; font-size: 13px;">${getLedgerName(row.ledger)}</div>
                                                ${row.narration ? `<div style="font-size: 11px; color: #858796; margin-top: 6px; font-style: italic;">Narration: ${row.narration}</div>` : ''}
                                            </td>
                                            <td class="amount-col" style="color: ${row.entry_type === 'Dr' ? '#2e3d52' : '#b7b9cc'}; font-family: monospace;">
                                                ${parseFloat(row.debit_amount) > 0 ? parseFloat(row.debit_amount).toFixed(2) : '0.00'}
                                            </td>
                                            <td class="amount-col" style="color: ${row.entry_type === 'Cr' ? '#2e3d52' : '#b7b9cc'}; font-family: monospace;">
                                                ${parseFloat(row.credit_amount) > 0 ? parseFloat(row.credit_amount).toFixed(2) : '0.00'}
                                            </td>
                                        </tr>
                                    `).join('')}
                                    <tr class="total-row">
                                        <td colspan="2" style="text-align: right; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Grand Total:</td>
                                        <td class="amount-col" style="color: #2e3d52; font-size: 15px; font-family: monospace;">${totalDr.toFixed(2)}</td>
                                        <td class="amount-col" style="color: #2e3d52; font-size: 15px; font-family: monospace;">${totalCr.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        ${voucher.narration ? `
                            <div class="narration-box">
                                <strong>Master Narration</strong>
                                <div class="narration-text">${voucher.narration}</div>
                            </div>
                        ` : ''}

                        <div class="signature-section">
                            <div class="signature-block">
                                <div style="height: 50px;"></div>
                                <div class="signature-line">Prepared By</div>
                            </div>
                            <div class="signature-block">
                                <div style="height: 50px;"></div>
                                <div class="signature-line">Checked By</div>
                            </div>
                            <div class="signature-block">
                                <div style="height: 50px;"></div>
                                <div class="signature-line">Authorized Signatory</div>
                            </div>
                        </div>
                    </div>

                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(function() {
                                window.close();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handleShowModal = async (payment = null, customLedgers = null) => {
        try {
            let data = customLedgers || ledgers;
            if (!data || data.length === 0) {
                data = await getLedgers();
                setLedgers(data);
            }
            
            const cashBankOptions = data.filter(l => {
                const group = (l.account_group_name || '').toLowerCase();
                return group.includes('cash') || group.includes('bank');
            });

            setLedgerInvoices({}); // always reset invoice cache when opening modal
            setBillAllocations({}); // always reset allocations when opening

            if (payment) {
                const initialExpanded = {};
                const loadedAllocations = {};
                const rawDetails = payment.details || [];
                const collapsedDetails = [];
                let drVIdx = 0;

                rawDetails.forEach((d) => {
                    const ledgerId = String(d.ledger?.id || d.ledger);
                    collapsedDetails.push({
                        ...d,
                        ledger: d.ledger?.id || d.ledger,
                        debit_amount: parseFloat(d.debit_amount) || 0,
                        credit_amount: parseFloat(d.credit_amount) || 0
                    });

                    if (d.entry_type === 'Dr') {
                        const allocations = d.bill_allocations || [];
                        const mappedAllocs = allocations.map(a => ({
                            refType: a.allocation_type === 'Agst Ref' ? 'against_ref' : a.allocation_type === 'New Ref' ? 'new_ref' : a.allocation_type === 'Advance' ? 'advance' : 'on_account',
                            invoiceId: a.against_purchase_invoice || '',
                            refName: a.name || '',
                            settleAmount: parseFloat(a.amount) || 0
                        }));
                        if (mappedAllocs.length > 0) {
                            loadedAllocations[drVIdx] = mappedAllocs;
                            fetchInvoicesForLedger(ledgerId);
                        }
                        drVIdx++;
                    }
                });

                if (collapsedDetails.length > 0) {
                    collapsedDetails.forEach((d, idx) => { if (d.narration) initialExpanded[idx] = true; });
                }
                setBillAllocations(loadedAllocations);
                setExpandedNarrations(initialExpanded);
                setCurrentPayment({
                    ...payment,
                    narration: payment.narration || '',
                    details: collapsedDetails.length > 0 ? collapsedDetails : [
                        { ...defaultDetail, entry_type: 'Cr', ledger: '' },
                        { ...defaultDetail, entry_type: 'Dr', ledger: '', debit_amount: 0 }
                    ]
                });
                setEditMode(true);
            } else {
                setExpandedNarrations({});
                const defaultCashLedger = cashBankOptions.find(l => l.name.toLowerCase() === 'cash') || cashBankOptions[0];
                setCurrentPayment({
                    ...defaultPayment,
                    voucher_no: generateVoucherNo(),
                    details: [
                        { ...defaultDetail, entry_type: 'Cr', ledger: defaultCashLedger ? defaultCashLedger.id : '' },
                        { ...defaultDetail, entry_type: 'Dr', ledger: '', debit_amount: 0 }
                    ]
                });
                setEditMode(false);
            }
            setShowModal(true);
        } catch (error) {
            console.error('Failed to prepare payment modal', error);
            Swal.fire('Error', 'Failed to fetch ledgers. Please try again.', 'error');
        }
    };



    const handleDelete = async (id, no) => {
        const result = await Swal.fire({
            title: 'Delete Payment Voucher?',
            text: `Are you sure you want to delete payment voucher "${no}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deletePayment(id);
                Swal.fire('Deleted', 'Voucher deleted successfully', 'success');
                fetchData();
            } catch (error) {
                Swal.fire('Error', 'Failed to delete payment voucher', 'error');
            }
        }
    };

    const handleInputChange = (field, value) => {
        setCurrentPayment({ ...currentPayment, [field]: value });
    };

    const handleCrLedgerChange = (ledgerId) => {
        const details = [...currentPayment.details];
        let crIdx = details.findIndex(d => d.entry_type === 'Cr');
        if (crIdx === -1) {
            details.push({ ...defaultDetail, entry_type: 'Cr', ledger: ledgerId });
            crIdx = details.length - 1;
        } else {
            details[crIdx] = { ...details[crIdx], ledger: ledgerId };
        }
        
        // Recalculate credit amount to match sum of debits
        const totalDebit = details.filter(d => d.entry_type === 'Dr').reduce((sum, d) => sum + (parseFloat(d.debit_amount) || 0), 0);
        details[crIdx].credit_amount = totalDebit;
        details[crIdx].debit_amount = 0;
        
        setCurrentPayment({ ...currentPayment, details });
    };

    const handleDrRowChange = (drIdx, field, value) => {
        const details = [...currentPayment.details];
        
        let drCount = 0;
        let targetIdx = -1;
        for (let i = 0; i < details.length; i++) {
            if (details[i].entry_type === 'Dr') {
                if (drCount === drIdx) {
                    targetIdx = i;
                    break;
                }
                drCount++;
            }
        }
        
        if (targetIdx > -1) {
            const oldLedger = details[targetIdx].ledger;
            details[targetIdx] = { ...details[targetIdx], [field]: value };
            if (field === 'debit_amount') {
                details[targetIdx].credit_amount = 0;
            }
            if (field === 'ledger' && String(oldLedger) !== String(value)) {
                // reset bill allocations for this row
                setBillAllocations(prev => {
                    const next = { ...prev };
                    delete next[drIdx];
                    return next;
                });
                if (value) {
                    fetchInvoicesForLedger(value);
                }
            }
        }
        
        // Update credit amount of Cr row to match sum of debits
        const totalDebit = details.filter(d => d.entry_type === 'Dr').reduce((sum, d) => sum + (parseFloat(d.debit_amount) || 0), 0);
        const crIdx = details.findIndex(d => d.entry_type === 'Cr');
        if (crIdx > -1) {
            details[crIdx].credit_amount = totalDebit;
            details[crIdx].debit_amount = 0;
        }
        
        setCurrentPayment({ ...currentPayment, details });
    };

    const addDrRow = () => {
        const details = [...currentPayment.details];
        details.push({
            ...defaultDetail,
            entry_type: 'Dr',
            debit_amount: 0,
            credit_amount: 0,
            narration: ''
        });
        setCurrentPayment({ ...currentPayment, details });
    };

    const removeDrRow = (drIdx) => {
        const drRowsCount = currentPayment.details.filter(d => d.entry_type === 'Dr').length;
        if (drRowsCount <= 1) {
            Swal.fire('Validation Warning', 'At least one debit entry is required.', 'warning');
            return;
        }
        
        const details = [...currentPayment.details];
        let drCount = 0;
        let targetIdx = -1;
        for (let i = 0; i < details.length; i++) {
            if (details[i].entry_type === 'Dr') {
                if (drCount === drIdx) {
                    targetIdx = i;
                    break;
                }
                drCount++;
            }
        }
        
        if (targetIdx > -1) {
            details.splice(targetIdx, 1);
        }
        
        // Shift allocations
        setBillAllocations(prev => {
            const next = {};
            Object.keys(prev).forEach(keyStr => {
                const key = parseInt(keyStr);
                if (key < drIdx) {
                    next[key] = prev[key];
                } else if (key > drIdx) {
                    next[key - 1] = prev[key];
                }
            });
            return next;
        });

        // Recalculate credit amount of Cr row
        const totalDebit = details.filter(d => d.entry_type === 'Dr').reduce((sum, d) => sum + (parseFloat(d.debit_amount) || 0), 0);
        const crIdx = details.findIndex(d => d.entry_type === 'Cr');
        if (crIdx > -1) {
            details[crIdx].credit_amount = totalDebit;
            details[crIdx].debit_amount = 0;
        }
        
        setCurrentPayment({ ...currentPayment, details });
    };

    const toggleNarration = (idx) => {
        setExpandedNarrations(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }));
    };

    // Live calculations
    const crRow = currentPayment.details.find(d => d.entry_type === 'Cr') || { ...defaultDetail, entry_type: 'Cr' };
    const drRows = currentPayment.details.filter(d => d.entry_type === 'Dr');
    const totalCredit = crRow.credit_amount || 0;
    const totalDebit = drRows.reduce((sum, d) => sum + (parseFloat(d.debit_amount) || 0), 0);
    const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.01;

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!currentPayment.voucher_no) {
            Swal.fire('Validation Error', 'Voucher Number is required', 'warning');
            return;
        }

        // Clean details by removing any empty debit rows at the end of the table
        const cleanedDetails = currentPayment.details.filter(d => d.entry_type === 'Cr' || (d.ledger && d.ledger !== ''));

        // Recalculate total debit of cleaned rows
        const cleanedTotalDebit = cleanedDetails.filter(d => d.entry_type === 'Dr').reduce((sum, d) => sum + (parseFloat(d.debit_amount) || 0), 0);
        
        // Update Cr row's credit amount
        const crRowIdx = cleanedDetails.findIndex(d => d.entry_type === 'Cr');
        if (crRowIdx > -1) {
            cleanedDetails[crRowIdx].credit_amount = cleanedTotalDebit;
            cleanedDetails[crRowIdx].debit_amount = 0;
        }

        const cleanedTotalCredit = crRowIdx > -1 ? (cleanedDetails[crRowIdx].credit_amount || 0) : 0;
        const cleanedIsBalanced = cleanedTotalDebit > 0 && Math.abs(cleanedTotalDebit - cleanedTotalCredit) < 0.01;

        if (!cleanedIsBalanced) {
            Swal.fire('Validation Error', 'Total Debit must be greater than zero. Please select at least one Debit Ledger Account.', 'warning');
            return;
        }

        const crRowCheck = cleanedDetails.find(d => d.entry_type === 'Cr');
        if (!crRowCheck || !crRowCheck.ledger) {
            Swal.fire('Validation Error', 'Please select a Cash / Bank Account (Credit Account)', 'warning');
            return;
        }
        if ((parseFloat(crRowCheck.credit_amount) || 0) <= 0) {
            Swal.fire('Validation Error', 'Total Payment Amount must be greater than zero', 'warning');
            return;
        }

        const drRowsCheck = cleanedDetails.filter(d => d.entry_type === 'Dr');
        for (let i = 0; i < drRowsCheck.length; i++) {
            const row = drRowsCheck[i];
            if (!row.ledger) {
                Swal.fire('Validation Error', `Please select a Ledger Account for debit row #${i + 1}`, 'warning');
                return;
            }
            if ((parseFloat(row.debit_amount) || 0) <= 0) {
                Swal.fire('Validation Error', `Amount must be greater than zero for debit row #${i + 1}`, 'warning');
                return;
            }
        }

        // Reconstruct bill allocations for nested field
        const expandedDetails = [];
        cleanedDetails.forEach(detail => {
            if (detail.entry_type === 'Cr') {
                expandedDetails.push({
                    ledger: detail.ledger?.id || detail.ledger,
                    entry_type: 'Cr',
                    debit_amount: 0,
                    credit_amount: parseFloat(detail.credit_amount) || 0,
                    narration: detail.narration || ''
                });
                return;
            }
            if (!detail.ledger || detail.ledger === '') return; // skip empty rows
            
            // Find the index of this detail among all 'Dr' rows in cleanedDetails
            let drIdx = -1;
            let drCount = 0;
            for (let i = 0; i < cleanedDetails.length; i++) {
                if (cleanedDetails[i].entry_type === 'Dr') {
                    if (cleanedDetails[i] === detail) {
                        drIdx = drCount;
                        break;
                    }
                    drCount++;
                }
            }
            
            const allocs = drIdx > -1 ? (billAllocations[drIdx] || []) : [];
            const serializedAllocs = allocs.map(alloc => ({
                allocation_type: alloc.refType === 'against_ref' ? 'Agst Ref' : alloc.refType === 'new_ref' ? 'New Ref' : alloc.refType === 'advance' ? 'Advance' : 'On Account',
                against_purchase_invoice: alloc.invoiceId || null,
                name: alloc.refName || (alloc.refType === 'on_account' ? 'On Account' : ''),
                amount: parseFloat(alloc.settleAmount) || 0
            }));
            
            expandedDetails.push({
                ledger: detail.ledger?.id || detail.ledger,
                entry_type: 'Dr',
                debit_amount: parseFloat(detail.debit_amount) || 0,
                credit_amount: 0,
                narration: detail.narration || '',
                bill_allocations: serializedAllocs
            });
        });

        // Recalculate total debit of expanded rows
        const expandedTotalDebit = expandedDetails.filter(d => d.entry_type === 'Dr').reduce((sum, d) => sum + (parseFloat(d.debit_amount) || 0), 0);
        
        // Update Cr row's credit amount
        const expandedCrRowIdx = expandedDetails.findIndex(d => d.entry_type === 'Cr');
        if (expandedCrRowIdx > -1) {
            expandedDetails[expandedCrRowIdx].credit_amount = expandedTotalDebit;
            expandedDetails[expandedCrRowIdx].debit_amount = 0;
        }

        try {
            const savedVoucher = { ...currentPayment, details: expandedDetails };
            if (editMode) {
                await updatePayment(currentPayment.id, savedVoucher);
            } else {
                await createPayment(savedVoucher);
            }
            setShowModal(false);
            setLedgerInvoices({}); // Clear invoice cache so next payment sees fresh outstanding balances
            fetchData();

            Swal.fire({
                title: editMode ? 'Voucher Updated' : 'Voucher Created',
                text: 'Voucher saved successfully. Do you want to print it?',
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: 'Yes, Print',
                cancelButtonText: 'No, Thanks',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33'
            }).then((result) => {
                if (result.isConfirmed) {
                    printVoucher(savedVoucher, 'Payment');
                }
                const searchParams = new URLSearchParams(location.search);
                if (searchParams.get('edit')) {
                    navigate('/finance/ledger-book');
                }
            });
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Failed to save voucher. Ensure Voucher Number is unique.', 'error');
        }
    };

    // Helper to format option object for react-select value
    const getLedgerOption = (ledgerId) => {
        if (!ledgerId) return null;
        const ledger = ledgers.find(l => String(l.id) === String(ledgerId));
        if (!ledger) return null;
        return {
            value: ledger.id,
            label: ledger.name
        };
    };

    // Spreadsheet keyboard navigation
    const focusCell = (rowIndex, colName) => {
        const cols = ['ledger', 'debit_amount', 'narration'];
        let curColIdx = cols.indexOf(colName);
        let curRowIdx = rowIndex;

        let found = false;
        // Search forward up to 5 cells to find a focusable one
        for (let i = 0; i < 5; i++) {
            const id = `cell-${curRowIdx}-${cols[curColIdx]}`;
            const element = document.getElementById(id);
            if (element && !element.disabled && element.offsetParent !== null) {
                setTimeout(() => {
                    element.focus();
                    if (element.select) {
                        element.select();
                    }
                }, 0);
                found = true;
                break;
            }
            curColIdx++;
            if (curColIdx >= cols.length) {
                curColIdx = 0;
                curRowIdx++;
            }
        }

        if (!found) {
            const masterNarrationEl = document.getElementById('master-narration');
            if (masterNarrationEl) {
                setTimeout(() => masterNarrationEl.focus(), 0);
            }
        }
    };

    const handleCellKeyDown = (e, rowIndex, colName) => {
        const target = e.target;
        const isReactSelectOpen = target.getAttribute('aria-expanded') === 'true';

        if (isReactSelectOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')) {
            return; // Let react-select handle dropdown navigation and selection
        }

        const drRowsLocal = currentPayment.details.filter(d => d.entry_type === 'Dr');
        const row = drRowsLocal[rowIndex];

        const drRowsCount = drRowsLocal.length;

        if (e.key === 'Enter') {
            if (!row || !row.ledger) {
                e.preventDefault();
                if (rowIndex >= 1) {
                    removeDrRow(rowIndex);
                }
                setTimeout(() => {
                    const masterNarrationEl = document.getElementById('master-narration');
                    if (masterNarrationEl) {
                        masterNarrationEl.focus();
                    }
                }, 50);
                return;
            }

            if (colName === 'ledger') {
                if (!row || !row.ledger) {
                    return; // Let react-select open the menu
                }
            }

            e.preventDefault();
            const cols = ['ledger', 'debit_amount', 'narration'];
            const currentColIdx = cols.indexOf(colName);

            if (colName === 'debit_amount') {
                e.preventDefault();
                if (!row || !row.ledger) {
                    focusCell(rowIndex, 'ledger');
                    return;
                }
                if (rowIndex < drRowsCount - 1) {
                    focusCell(rowIndex + 1, 'ledger');
                } else {
                    const masterNarrationEl = document.getElementById('master-narration');
                    if (masterNarrationEl) {
                        masterNarrationEl.focus();
                    }
                }
                return;
            }

            if (colName === 'narration') {
                setExpandedNarrations(prev => {
                    const next = { ...prev, [rowIndex]: true };
                    setTimeout(() => {
                        const txtEl = document.getElementById(`cell-${rowIndex}-narration-text`);
                        if (txtEl) {
                            txtEl.focus();
                            if (txtEl.select) txtEl.select();
                        }
                    }, 50);
                    return next;
                });
                return;
            }

            if (colName === 'narration-text') {
                e.preventDefault();
                if (!row || !row.ledger) {
                    focusCell(rowIndex, 'ledger');
                    return;
                }
                if (rowIndex < drRowsCount - 1) {
                    focusCell(rowIndex + 1, 'ledger');
                } else {
                    const masterNarrationEl = document.getElementById('master-narration');
                    if (masterNarrationEl) {
                        masterNarrationEl.focus();
                    }
                }
                return;
            }

            if (currentColIdx < cols.length - 1) {
                focusCell(rowIndex, cols[currentColIdx + 1]);
            }
        } else if (e.key === 'ArrowUp') {
            if (colName === 'narration-text') {
                e.preventDefault();
                focusCell(rowIndex, 'narration');
            } else if (rowIndex > 0) {
                e.preventDefault();
                focusCell(rowIndex - 1, colName);
            }
        } else if (e.key === 'ArrowDown') {
            if (colName === 'narration' && expandedNarrations[rowIndex]) {
                e.preventDefault();
                const txtEl = document.getElementById(`cell-${rowIndex}-narration-text`);
                if (txtEl) txtEl.focus();
            } else if (rowIndex < drRowsCount - 1) {
                e.preventDefault();
                focusCell(rowIndex + 1, colName);
            }
        }
    };

    const customSelectStyles = {
        control: (provided, state) => ({
            ...provided,
            backgroundColor: isDark ? '#24292D' : '#ffffff',
            borderColor: state.isFocused ? 'var(--cc-primary)' : (isDark ? '#636363' : '#ececec'),
            color: isDark ? '#ffffff' : '#2f3f50',
            height: '30px',
            minHeight: '30px',
            borderRadius: '4px',
            boxShadow: 'none',
        }),
        valueContainer: (provided) => ({
            ...provided,
            height: '30px',
            padding: '0 8px',
            display: 'flex',
            alignItems: 'center',
        }),
        input: (provided) => ({
            ...provided,
            margin: '0px',
            padding: '0px',
            color: isDark ? '#ffffff' : '#2f3f50'
        }),
        indicatorsContainer: (provided) => ({
            ...provided,
            height: '30px',
        }),
        dropdownIndicator: (provided) => ({
            ...provided,
            padding: '2px 8px',
        }),
        clearIndicator: (provided) => ({
            ...provided,
            padding: '2px 8px',
        }),
        menu: (provided) => ({ ...provided, zIndex: 9999, backgroundColor: isDark ? '#2F363E' : '#ffffff' }),
        menuPortal: base => ({ ...base, zIndex: 9999 }),
        singleValue: (provided) => ({ ...provided, color: isDark ? '#ffffff' : '#2f3f50' }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isFocused ? (isDark ? '#383F47' : '#f8f9fa') : 'transparent',
            color: isDark ? '#ffffff' : '#2f3f50',
            cursor: 'pointer',
            fontWeight: 'normal',
            ':active': {
                backgroundColor: isDark ? '#383F47' : '#f1f5f9'
            }
        })
    };

    const filteredPayments = payments.filter(p =>
        (p.voucher_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.narration || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentPayments = filteredPayments.slice(startIndex, startIndex + itemsPerPage);

    const creditAccountOptions = ledgers.filter(l => {
        const group = (l.account_group_name || '').toLowerCase();
        return group.includes('cash') || group.includes('bank');
    });

    return (
        <div className="container-fluid">
            <div className="row">
            <div className="col-lg-12">
                <Card>
                    <Card.Header className="d-flex justify-content-between align-items-center">
                        <Card.Title className="mb-0">Payment Vouchers</Card.Title>
                        <div className="d-flex align-items-center gap-2">
                            <div style={{ width: '300px', position: 'relative' }}>
                                <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                <Form.Control
                                    type="text"
                                    placeholder="Search Payment..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                />
                            </div>
                            <div className="d-flex gap-2 ms-auto">
                                <CreateButton 
                                    module="payments new" 
                                    onClick={() => handleShowModal()} 
                                    style={{ height: '34px', display: 'flex', alignItems: 'center', fontSize: '13px' }}
                                >
                                    Payment
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
                                <table className="table table-responsive-md">
                                    <thead>
                                        <tr>
                                            <th><strong>SL NO</strong></th>
                                            <th><strong>VOUCHER NO</strong></th>
                                            <th><strong>DATE</strong></th>
                                            <th><strong>NARRATION</strong></th>
                                            <th><strong>TOTAL DEBIT (₹)</strong></th>
                                            <th><strong>TOTAL CREDIT (₹)</strong></th>
                                            <th className="text-end"><strong>ACTIONS</strong></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentPayments.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="text-center py-4 text-muted">No vouchers found</td>
                                            </tr>
                                        ) : (
                                            currentPayments.map((p, idx) => {
                                                const dTotal = p.details?.reduce((s, row) => s + (parseFloat(row.debit_amount) || 0), 0) || 0;
                                                const cTotal = p.details?.reduce((s, row) => s + (parseFloat(row.credit_amount) || 0), 0) || 0;
                                                return (
                                                    <tr key={p.id}>
                                                        <td>{startIndex + idx + 1}</td>
                                                        <td>{p.voucher_no}</td>
                                                        <td>{p.voucher_date}</td>
                                                        <td className="text-truncate" style={{ maxWidth: '300px' }}>{p.narration || '-'}</td>
                                                        <td>
                                                            {dTotal.toFixed(2)}{' '}
                                                            <span className="fw-bold text-success" style={{ fontSize: '11px' }}>Dr</span>
                                                        </td>
                                                        <td>
                                                            {cTotal.toFixed(2)}{' '}
                                                            <span className="fw-bold text-danger" style={{ fontSize: '11px' }}>Cr</span>
                                                        </td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end align-items-center">
                                                                <Button 
                                                                    variant="outline-info" 
                                                                    size="sm" 
                                                                    className="me-1 py-1 px-2" 
                                                                    onClick={() => printVoucher(p, 'Payment')} 
                                                                    title="Print Voucher"
                                                                >
                                                                    <i className="fa fa-print"></i>
                                                                </Button>
                                                                <EditButton module="payments new" onClick={() => handleShowModal(p)} className="me-1" />
                                                                <DeleteButton module="payments new" onClick={() => handleDelete(p.id, p.voucher_no)} />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>

                                {totalPages > 1 && (
                                    <div className="d-flex justify-content-between align-items-center mt-3">
                                        <div className="text-muted" style={{ fontSize: '13px' }}>
                                            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredPayments.length)} of {filteredPayments.length} entries
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


            <PaymentForm
                showModal={showModal}
                setShowModal={setShowModal}
                editMode={editMode}
                currentPayment={currentPayment}
                handleInputChange={handleInputChange}
                handleCrLedgerChange={handleCrLedgerChange}
                handleDrRowChange={handleDrRowChange}
                addDrRow={addDrRow}
                removeDrRow={removeDrRow}
                handleSubmit={handleSubmit}
                getLedgerOption={getLedgerOption}
                handleCellKeyDown={handleCellKeyDown}
                creditAccountOptions={creditAccountOptions}
                ledgers={ledgers}
                maintainNarration={maintainNarration}
                expandedNarrations={expandedNarrations}
                toggleNarration={toggleNarration}
                billAllocations={billAllocations}
                openBillSettlement={openBillSettlement}
                isBalanced={isBalanced}
                totalDebit={totalDebit}
                totalCredit={totalCredit}
                setCellToFocus={setCellToFocus}
                drRows={drRows}
                crRow={crRow}
                isDark={isDark}
                billSettlementModal={billSettlementModal}
                setBillSettlementModal={setBillSettlementModal}
                ledgerInvoices={ledgerInvoices}
                applyBillSettlement={applyBillSettlement}
                focusCell={focusCell}
            />

        </div>
    );
};

export default PaymentList;
