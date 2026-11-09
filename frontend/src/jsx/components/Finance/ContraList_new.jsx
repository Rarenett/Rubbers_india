import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card, Button, Modal, Form, Row, Col, Table, Dropdown } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';
import ContraForm from './ContraForm';

import { ThemeContext } from '../../../context/ThemeContext';
import { getLedgers, getContras, createContra, updateContra, deleteContra } from '../../../services/FinanceService';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import InventoryService from '../../../services/InventoryService';

const ContraList = () => {
    const location = useLocation();
    const [contras, setContras] = useState([]);
    const [ledgers, setLedgers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [expandedNarrations, setExpandedNarrations] = useState({});
    const [maintainNarration, setMaintainNarration] = useState(false);

    const defaultDetail = {
        entry_type: 'Dr',
        ledger: '',
        debit_amount: 0.00,
        credit_amount: 0.00,
        narration: ''
    };

    const defaultContra = {
        id: null,
        voucher_no: '',
        voucher_date: new Date().toISOString().split('T')[0],
        narration: '',
        details: [
            { ...defaultDetail, entry_type: 'Cr' },
            { ...defaultDetail, entry_type: 'Dr' }
        ]
    };

    const [currentContra, setCurrentContra] = useState(defaultContra);

    const { background } = useContext(ThemeContext);
    const isDark = background?.value === 'dark';

    useEffect(() => {
        fetchData();
        fetchLedgers();
        fetchConfiguration();
    }, []);



    const fetchConfiguration = async () => {
        try {
            const res = await InventoryService.getProductConfigurations();
            const configs = Array.isArray(res.data) ? res.data : [];
            const myConfig = configs.find(c => 
                (c.voucher_type_name && c.voucher_type_name.toLowerCase() === 'contra') ||
                (c.voucher_type_code && c.voucher_type_code.toLowerCase() === 'cn')
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
            const data = await getContras();
            setContras(data);
        } catch (error) {
            Swal.fire('Error', 'Failed to fetch contra vouchers', 'error');
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
        if (!contras || contras.length === 0) return 'CN-0001';
        
        let maxNum = 0;
        contras.forEach(r => {
            const match = r.voucher_no.match(/\d+$/);
            if (match) {
                const num = parseInt(match[0], 10);
                if (num > maxNum) {
                    maxNum = num;
                }
            }
        });
        
        return `CN-${String(maxNum + 1).padStart(4, '0')}`;
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

    const handleShowModal = (contra = null) => {
        if (contra) {
            const initialExpanded = {};
            if (contra.details) {
                contra.details.forEach((d, idx) => {
                    if (d.narration) {
                        initialExpanded[idx] = true;
                    }
                });
            }
            setExpandedNarrations(initialExpanded);
            setCurrentContra({
                ...contra,
                narration: contra.narration || '',
                details: contra.details?.length ? contra.details.map(d => ({
                    ...d,
                    debit_amount: parseFloat(d.debit_amount) || 0,
                    credit_amount: parseFloat(d.credit_amount) || 0
                })) : [
                    { ...defaultDetail, entry_type: 'Cr' },
                    { ...defaultDetail, entry_type: 'Dr' }
                ]
            });
            setEditMode(true);
        } else {
            setExpandedNarrations({});
            setCurrentContra({
                ...defaultContra,
                voucher_no: generateVoucherNo()
            });
            setEditMode(false);
        }
        setShowModal(true);
    };

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const editId = searchParams.get('edit');
        if (!editId) return;

        const openTarget = async () => {
            let list = contras;
            if (!list || list.length === 0) {
                try {
                    list = await getContras();
                    setContras(list);
                } catch (e) {
                    console.error('Error fetching contras for edit modal:', e);
                }
            }
            if (list && list.length > 0) {
                const cleanTarget = String(editId).toLowerCase().replace(/[^a-z0-9]/g, '');
                const itemToEdit = list.find(c => {
                    const cId = String(c.id);
                    const cVNo = String(c.voucher_no || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    return cId === String(editId) || cVNo === cleanTarget || (cleanTarget && cVNo.endsWith(cleanTarget));
                });
                if (itemToEdit) {
                    handleShowModal(itemToEdit);
                }
            }
        };
        openTarget();
    }, [location.search]);

    const handleDelete = async (id, no) => {
        const result = await Swal.fire({
            title: 'Delete Contra Voucher?',
            text: `Are you sure you want to delete contra voucher "${no}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteContra(id);
                Swal.fire('Deleted', 'Voucher deleted successfully', 'success');
                fetchData();
            } catch (error) {
                Swal.fire('Error', 'Failed to delete contra voucher', 'error');
            }
        }
    };

    const handleInputChange = (field, value) => {
        setCurrentContra({ ...currentContra, [field]: value });
    };

    const handleDetailChange = (index, field, value) => {
        const details = [...currentContra.details];
        let updatedRow = { ...details[index], [field]: value };

        // Auto validation details
        if (field === 'entry_type') {
            if (value === 'Dr') {
                updatedRow.credit_amount = 0;
            } else {
                updatedRow.debit_amount = 0;
            }
        } else if (field === 'debit_amount') {
            updatedRow.credit_amount = 0;
        } else if (field === 'credit_amount') {
            updatedRow.debit_amount = 0;
        }

        details[index] = updatedRow;
        setCurrentContra({ ...currentContra, details });
    };

    const handleFocusAmount = (index, field) => {
        const details = [...currentContra.details];
        const row = details[index];
        
        // Only autofill if the current field value is 0 or empty/falsy
        const currentVal = parseFloat(row[field]) || 0;
        if (currentVal === 0) {
            const otherDebits = details.reduce((sum, d, idx) => sum + (idx !== index ? (parseFloat(d.debit_amount) || 0) : 0), 0);
            const otherCredits = details.reduce((sum, d, idx) => sum + (idx !== index ? (parseFloat(d.credit_amount) || 0) : 0), 0);
            
            if (field === 'debit_amount' && row.entry_type === 'Dr') {
                if (otherCredits > otherDebits) {
                    row.debit_amount = otherCredits - otherDebits;
                    setCurrentContra({ ...currentContra, details });
                }
            } else if (field === 'credit_amount' && row.entry_type === 'Cr') {
                if (otherDebits > otherCredits) {
                    row.credit_amount = otherDebits - otherCredits;
                    setCurrentContra({ ...currentContra, details });
                }
            }
        }
    };

    const addDetailRow = () => {
        const details = currentContra.details;
        const totalDebit = details.reduce((sum, d) => sum + (parseFloat(d.debit_amount) || 0), 0);
        const totalCredit = details.reduce((sum, d) => sum + (parseFloat(d.credit_amount) || 0), 0);
        
        let newEntryType = 'Dr';
        let newDebit = 0;
        let newCredit = 0;
        
        if (totalDebit > totalCredit) {
            newEntryType = 'Cr';
            newCredit = totalDebit - totalCredit;
        } else if (totalCredit > totalDebit) {
            newEntryType = 'Dr';
            newDebit = totalCredit - totalDebit;
        }
        
        const newRow = {
            ...defaultDetail,
            entry_type: newEntryType,
            debit_amount: newDebit,
            credit_amount: newCredit
        };

        setCurrentContra({
            ...currentContra,
            details: [...currentContra.details, newRow]
        });
    };

    const removeDetailRow = (index) => {
        if (currentContra.details.length <= 2) {
            Swal.fire('Validation Warning', 'A contra voucher must have at least 2 entries.', 'warning');
            return;
        }
        const details = [...currentContra.details];
        details.splice(index, 1);
        setCurrentContra({ ...currentContra, details });
    };

    const toggleNarration = (idx) => {
        setExpandedNarrations(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }));
    };

    // Live calculations
    const totalDebit = currentContra.details.reduce((sum, d) => sum + (parseFloat(d.debit_amount) || 0), 0);
    const totalCredit = currentContra.details.reduce((sum, d) => sum + (parseFloat(d.credit_amount) || 0), 0);
    const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.01;

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!currentContra.voucher_no) {
            Swal.fire('Validation Error', 'Voucher Number is required', 'warning');
            return;
        }

        if (!isBalanced) {
            Swal.fire('Validation Error', 'Total Debit must equal Total Credit and be greater than zero.', 'warning');
            return;
        }

        for (let i = 0; i < currentContra.details.length; i++) {
            const row = currentContra.details[i];
            if (!row.ledger) {
                Swal.fire('Validation Error', `Please select a Ledger Account for entry row #${i + 1}`, 'warning');
                return;
            }
            const dr = parseFloat(row.debit_amount) || 0;
            const cr = parseFloat(row.credit_amount) || 0;
            if (row.entry_type === 'Dr' && dr <= 0) {
                Swal.fire('Validation Error', `Debit amount must be greater than zero for row #${i + 1}`, 'warning');
                return;
            }
            if (row.entry_type === 'Cr' && cr <= 0) {
                Swal.fire('Validation Error', `Credit amount must be greater than zero for row #${i + 1}`, 'warning');
                return;
            }
        }

        try {
            const savedVoucher = { ...currentContra };
            if (editMode) {
                await updateContra(currentContra.id, currentContra);
            } else {
                await createContra(currentContra);
            }
            setShowModal(false);
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
                    printVoucher(savedVoucher, 'Contra');
                }
            });
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Failed to save voucher. Ensure Voucher Number is unique.', 'error');
        }
    };

    // Spreadsheet keyboard navigation
    const focusCell = (rowIndex, colName) => {
        const cols = ['entry_type', 'ledger', 'debit_amount', 'credit_amount', 'narration'];
        let curColIdx = cols.indexOf(colName);
        let curRowIdx = rowIndex;

        while (curRowIdx < 100) {
            const id = `cell-${curRowIdx}-${cols[curColIdx]}`;
            const element = document.getElementById(id);
            if (element) {
                if (!element.disabled && element.offsetParent !== null) {
                    setTimeout(() => {
                        element.focus();
                        if (element.select) {
                            element.select();
                        }
                    }, 0);
                    return;
                }
            } else {
                if (curRowIdx > rowIndex) {
                    break;
                }
            }
            curColIdx++;
            if (curColIdx >= cols.length) {
                curColIdx = 0;
                curRowIdx++;
            }
        }
    };

    const handleCellKeyDown = (e, rowIndex, colName) => {
        const target = e.target;
        const isReactSelectOpen = target.getAttribute('aria-expanded') === 'true';

        if (isReactSelectOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')) {
            return; // Let react-select handle dropdown navigation and selection
        }

        if (e.key === 'Enter') {
            const row = currentContra.details[rowIndex];

            if (rowIndex >= 2 && (!row || !row.ledger)) {
                e.preventDefault();
                removeDetailRow(rowIndex);
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
            const cols = ['entry_type', 'ledger', 'debit_amount', 'credit_amount', 'narration'];
            const currentColIdx = cols.indexOf(colName);

            if (colName === 'debit_amount' || colName === 'credit_amount') {
                const isActiveField = (colName === 'debit_amount' && row.entry_type === 'Dr') || 
                                       (colName === 'credit_amount' && row.entry_type === 'Cr');
                if (isActiveField) {
                    e.preventDefault();
                    if (rowIndex < currentContra.details.length - 1) {
                        focusCell(rowIndex + 1, 'entry_type');
                    } else {
                        // We are on the last row. Always spawn the next row.
                        addDetailRow();
                        setTimeout(() => {
                            focusCell(rowIndex + 1, 'entry_type');
                        }, 80);
                    }
                    return;
                }
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
                if (rowIndex < currentContra.details.length - 1) {
                    focusCell(rowIndex + 1, 'entry_type');
                } else {
                    // We are on the last row. Always spawn the next row.
                    addDetailRow();
                    setTimeout(() => {
                        focusCell(rowIndex + 1, 'entry_type');
                    }, 80);
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
            } else if (rowIndex < currentContra.details.length - 1) {
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

    const filteredContras = contras.filter(r =>
        (r.voucher_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.narration || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredContras.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentContras = filteredContras.slice(startIndex, startIndex + itemsPerPage);

    return (
        <div className="container-fluid">
            <div className="row">
            <div className="col-lg-12">
                <Card>
                    <Card.Header className="d-flex justify-content-between align-items-center">
                        <Card.Title className="mb-0">Contra Vouchers</Card.Title>
                        <div className="d-flex align-items-center gap-2">
                            <div style={{ width: '300px', position: 'relative' }}>
                                <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                <Form.Control
                                    type="text"
                                    placeholder="Search Contra..."
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
                                    module="contra new" 
                                    onClick={() => handleShowModal()} 
                                    style={{ height: '34px', display: 'flex', alignItems: 'center', fontSize: '13px' }}
                                >
                                    Contra
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
                                        {currentContras.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="text-center py-4 text-muted">No vouchers found</td>
                                            </tr>
                                        ) : (
                                            currentContras.map((r, idx) => {
                                                const dTotal = r.details?.reduce((s, row) => s + (parseFloat(row.debit_amount) || 0), 0) || 0;
                                                const cTotal = r.details?.reduce((s, row) => s + (parseFloat(row.credit_amount) || 0), 0) || 0;
                                                return (
                                                    <tr key={r.id}>
                                                        <td>{startIndex + idx + 1}</td>
                                                        <td>{r.voucher_no}</td>
                                                        <td>{r.voucher_date}</td>
                                                        <td className="text-truncate" style={{ maxWidth: '300px' }}>{r.narration || '-'}</td>
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
                                                                    onClick={() => printVoucher(r, 'Contra')} 
                                                                    title="Print Voucher"
                                                                >
                                                                    <i className="fa fa-print"></i>
                                                                </Button>
                                                                <EditButton module="contra new" onClick={() => handleShowModal(r)} className="me-1" />
                                                                <DeleteButton module="contra new" onClick={() => handleDelete(r.id, r.voucher_no)} />
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
                                            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredContras.length)} of {filteredContras.length} entries
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

            <ContraForm
                showModal={showModal}
                setShowModal={setShowModal}
                editMode={editMode}
                currentContra={currentContra}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                ledgers={ledgers}
                maintainNarration={maintainNarration}
                expandedNarrations={expandedNarrations}
                toggleNarration={toggleNarration}
                handleDetailChange={handleDetailChange}
                handleCellKeyDown={handleCellKeyDown}
                handleFocusAmount={handleFocusAmount}
                focusCell={focusCell}
                totalDebit={totalDebit}
                totalCredit={totalCredit}
                isBalanced={isBalanced}
                addDetailRow={addDetailRow}
                removeDetailRow={removeDetailRow}
            />
        </div>
    );
};

export default ContraList;
