import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card, Button, Modal, Form, Row, Col, Table, Dropdown } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';
import { ThemeContext } from '../../../context/ThemeContext';
import { getLedgers, getContras, createContra, updateContra, deleteContra } from '../../../services/FinanceService';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import InventoryService from '../../../services/InventoryService';
import { fetchCompany, fetchCompanyAddresses, fetchCompanyContacts, fetchBranches } from '../../../services/CompanyService';
import { fetchPrefixConfigurations, generateNextVoucherNumber } from '../../../services/PrefixService';
import { printFriendlyVoucher } from '../../../services/VoucherPrintService';

const ContraList = () => {
    const location = useLocation();
    const [contras, setContras] = useState([]);
    const [ledgers, setLedgers] = useState([]);
    const [loading, setLoading] = useState(true);
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const firstDayOfMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const lastDayObj = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const lastDayOfMonth = `${lastDayObj.getFullYear()}-${pad(lastDayObj.getMonth() + 1)}-${pad(lastDayObj.getDate())}`;

    const [searchTerm, setSearchTerm] = useState('');
    const [fromDate, setFromDate] = useState(firstDayOfMonth);
    const [toDate, setToDate] = useState(lastDayOfMonth);
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

    const [companyInfo, setCompanyInfo] = useState(null);
    const [companyAddress, setCompanyAddress] = useState(null);
    const [companyContact, setCompanyContact] = useState(null);
    const [prefixConfigs, setPrefixConfigs] = useState([]);
    const [branches, setBranches] = useState([]);

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

    const fetchPrefixConfigs = async () => {
        try {
            const [pRes, bRes] = await Promise.all([
                fetchPrefixConfigurations(),
                fetchBranches()
            ]);
            const configs = Array.isArray(pRes.data) ? pRes.data : (pRes.data?.results || []);
            const bData = Array.isArray(bRes.data) ? bRes.data : (bRes.data?.results || []);
            setPrefixConfigs(configs);
            setBranches(bData);
            return { configs, branches: bData };
        } catch (err) {
            console.error('Failed to fetch prefix configurations:', err);
            return { configs: [], branches: [] };
        }
    };

    useEffect(() => {
        fetchData();
        fetchLedgers();
        fetchConfiguration();
        loadCompanyDetails();
        fetchPrefixConfigs();
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

    const generateVoucherNo = (customList = null, customConfigs = null, customBranches = null) => {
        const configs = customConfigs || prefixConfigs || [];
        const branchList = customBranches || branches || [];
        const contraConfig = configs.find(c => {
            const vName = (c.voucher_type_name || '').toLowerCase().trim();
            return vName === 'contra' || c.prefix === 'CV' || c.prefix === 'CN';
        });
        return generateNextVoucherNumber(contraConfig, customList || contras, 'CV', branchList);
    };

    const printVoucher = (voucher, type = 'Contra') => {
        printFriendlyVoucher({
            voucher,
            type,
            ledgers,
            companyInfo,
            companyAddress,
            companyContact
        });
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
            const initialNo = generateVoucherNo();
            setCurrentContra({
                ...defaultContra,
                voucher_no: initialNo
            });
            setEditMode(false);
            fetchPrefixConfigs().then(({ configs, branches: bData }) => {
                const latestNo = generateVoucherNo(null, configs, bData);
                setCurrentContra(prev => ({
                    ...prev,
                    voucher_no: latestNo
                }));
            });
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

            if (colName === 'ledger') {
                if (!row || !row.ledger) {
                    e.preventDefault();
                    if (rowIndex >= 2) {
                        removeDetailRow(rowIndex);
                    }
                    setTimeout(() => {
                        const masterNarrationEl = document.getElementById('master-narration');
                        if (masterNarrationEl) {
                            masterNarrationEl.focus();
                        }
                    }, 50);
                    return;
                }
            }

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

            e.preventDefault();
            const cols = ['entry_type', 'ledger', 'debit_amount', 'credit_amount', 'narration'];
            const currentColIdx = cols.indexOf(colName);

            if (colName === 'debit_amount' || colName === 'credit_amount') {
                const isActiveField = (colName === 'debit_amount' && row.entry_type === 'Dr') || 
                                       (colName === 'credit_amount' && row.entry_type === 'Cr');
                if (isActiveField) {
                    e.preventDefault();
                    if (rowIndex < currentContra.details.length - 1) {
                        focusCell(rowIndex + 1, 'ledger');
                    } else {
                        const curDebit = currentContra.details.reduce((s, d) => s + (parseFloat(d.debit_amount) || 0), 0);
                        const curCredit = currentContra.details.reduce((s, d) => s + (parseFloat(d.credit_amount) || 0), 0);
                        const balanced = curDebit > 0 && Math.abs(curDebit - curCredit) < 0.01;

                        if (balanced) {
                            setTimeout(() => {
                                const masterNarrationEl = document.getElementById('master-narration');
                                if (masterNarrationEl) {
                                    masterNarrationEl.focus();
                                }
                            }, 50);
                        } else {
                            addDetailRow();
                            setTimeout(() => {
                                focusCell(rowIndex + 1, 'ledger');
                            }, 80);
                        }
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
            borderColor: state.isFocused ? '#2ece8a' : (isDark ? '#475569' : '#cbd5e1'),
            color: isDark ? '#ffffff' : '#2f3f50',
            minHeight: '36px',
            borderRadius: '8px',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(46,206,138,0.15)' : 'none',
            '&:hover': { borderColor: '#2ece8a' },
            fontSize: '13px',
        }),
        valueContainer: (provided) => ({
            ...provided,
            padding: '2px 10px',
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
        }),
        dropdownIndicator: (provided) => ({
            ...provided,
            padding: '4px 8px',
            color: isDark ? '#94a3b8' : '#64748b',
            '&:hover': { color: '#2ece8a' }
        }),
        clearIndicator: (provided) => ({
            ...provided,
            padding: '4px 8px',
            color: isDark ? '#94a3b8' : '#64748b',
            '&:hover': { color: '#ef4444' }
        }),
        menu: (provided) => ({
            ...provided,
            zIndex: 99999,
            backgroundColor: isDark ? '#2F363E' : '#ffffff',
            borderRadius: '10px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            border: isDark ? '1px solid #475569' : '1px solid #e2e8f0',
            overflow: 'hidden',
            fontSize: '13px',
        }),
        menuPortal: base => ({ ...base, zIndex: 99999 }),
        singleValue: (provided) => ({ ...provided, color: isDark ? '#ffffff' : '#2f3f50' }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isSelected ? (isDark ? '#334155' : '#f1f5f9') : state.isFocused ? (isDark ? '#383F47' : '#f8fafc') : 'transparent',
            color: state.isSelected ? '#2ece8a' : (isDark ? '#ffffff' : '#334155'),
            cursor: 'pointer',
            fontWeight: state.isSelected ? '600' : 'normal',
            padding: '8px 12px',
            ':active': {
                backgroundColor: isDark ? '#475569' : '#e2e8f0'
            }
        })
    };

    const filteredContras = contras.filter(r => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = (
            (r.voucher_no || '').toLowerCase().includes(term) ||
            (r.narration || '').toLowerCase().includes(term) ||
            (r.voucher_date || '').toLowerCase().includes(term)
        );

        let matchesDate = true;
        if (fromDate) {
            const vDate = r.voucher_date ? r.voucher_date.split('T')[0] : '';
            if (!vDate || vDate < fromDate) matchesDate = false;
        }
        if (toDate) {
            const vDate = r.voucher_date ? r.voucher_date.split('T')[0] : '';
            if (!vDate || vDate > toDate) matchesDate = false;
        }

        return matchesSearch && matchesDate;
    });

    const totalPages = Math.ceil(filteredContras.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentContras = filteredContras.slice(startIndex, startIndex + itemsPerPage);

    return (
        <div className="container-fluid">
            <div className="row">
            <div className="col-lg-12">
                <Card>
                    <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <Card.Title className="mb-0">Contra Vouchers</Card.Title>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                            <div className="d-flex align-items-center gap-1">
                                <span className="text-muted" style={{ fontSize: '12px', fontWeight: '500' }}>From:</span>
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={fromDate}
                                    onChange={(e) => {
                                        setFromDate(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    style={{ width: '135px', height: '34px', fontSize: '12px', borderRadius: '6px' }}
                                />
                            </div>
                            <div className="d-flex align-items-center gap-1">
                                <span className="text-muted" style={{ fontSize: '12px', fontWeight: '500' }}>To:</span>
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={toDate}
                                    onChange={(e) => {
                                        setToDate(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    style={{ width: '135px', height: '34px', fontSize: '12px', borderRadius: '6px' }}
                                />
                            </div>
                            <div style={{ width: '250px', position: 'relative' }}>
                                <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                <Form.Control
                                    type="text"
                                    placeholder="Search Contra..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    style={{ height: '34px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                />
                            </div>
                            <div className="d-flex gap-2 ms-auto">
                                <CreateButton 
                                    module="contra" 
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
                                            <th>SL NO</th>
                                            <th>VOUCHER NO</th>
                                            <th>DATE</th>
                                            <th>NARRATION</th>
                                            <th>TOTAL DEBIT (₹)</th>
                                            <th>TOTAL CREDIT (₹)</th>
                                            <th className="text-end">ACTIONS</th>
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
                                                            <span className="fw-semibold text-success" style={{ fontSize: '11px' }}>Dr</span>
                                                        </td>
                                                        <td>
                                                            {cTotal.toFixed(2)}{' '}
                                                            <span className="fw-semibold text-danger" style={{ fontSize: '11px' }}>Cr</span>
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
                                                                <EditButton module="contra" onClick={() => handleShowModal(r)} className="me-1" />
                                                                <DeleteButton module="contra" onClick={() => handleDelete(r.id, r.voucher_no)} />
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

            <Modal
                show={showModal}
                onHide={() => setShowModal(false)}
                size="xl"
                centered
                className="journal-voucher-modal"
                onEntered={() => {
                    document.getElementById('voucher-no-input')?.focus();
                }}
            >
                <Modal.Header closeButton>
                    <Modal.Title className="w-100">
                        <div className="d-flex align-items-center">
                            <div
                                className="d-flex align-items-center justify-content-center rounded-circle me-3 form-icon-circle"
                                style={{ width: '48px', height: '48px' }}
                            >
                                <i className="fa fa-sync-alt text-white fs-4"></i>
                            </div>
                            <div>
                                <h4 className="mb-1">{editMode ? 'Edit Contra Voucher' : 'New Contra Voucher'}</h4>
                                <p className="mb-0 text-muted" style={{ fontSize: '13px', fontWeight: 'normal' }}>
                                    {editMode
                                        ? 'Modify entries and narration for this contra voucher'
                                        : 'Double-entry record for Cash/Bank transfers. Debit and Credit totals must balance.'}
                                </p>
                            </div>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleSubmit}>
                    <Modal.Body className="py-2">
                        <Row className="mb-2">
                            <Col lg={4} md={6} sm={12} className="mb-2">
                                <Form.Group>
                                    <Form.Label className="fw-semibold text-muted small mb-1">VOUCHER TYPE</Form.Label>
                                    <Form.Control size="sm" type="text" value="Contra" disabled className="bg-light border-0 fw-semibold rounded-3 text-secondary" />
                                </Form.Group>
                            </Col>
                            <Col lg={4} md={6} sm={12} className="mb-2">
                                <Form.Group>
                                    <Form.Label className="fw-semibold text-muted small mb-1">VOUCHER NO *</Form.Label>
                                    <Form.Control
                                        size="sm"
                                        id="voucher-no-input"
                                        type="text"
                                        value={currentContra.voucher_no}
                                        onChange={e => handleInputChange('voucher_no', e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                document.getElementById('voucher-date-input')?.focus();
                                            }
                                        }}
                                        required
                                        className="border-secondary border-opacity-25"
                                    />
                                </Form.Group>
                            </Col>
                            <Col lg={4} md={6} sm={12} className="mb-2">
                                <Form.Group>
                                    <Form.Label className="fw-semibold text-muted small mb-1">DATE *</Form.Label>
                                    <Form.Control
                                        size="sm"
                                        id="voucher-date-input"
                                        type="date"
                                        value={currentContra.voucher_date}
                                        onChange={e => handleInputChange('voucher_date', e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                focusCell(0, 'entry_type');
                                            }
                                        }}
                                        required
                                        className="border-secondary border-opacity-25"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <div className="table-responsive">
                            <Table bordered className="align-middle journal-entry-table border-secondary border-opacity-10">
                                <thead>
                                    <tr className="table-light">
                                        <th style={{ width: '10%' }}>By/To</th>
                                        <th style={{ width: maintainNarration ? '52%' : '60%' }}>Ledger Account *</th>
                                        <th style={{ width: '15%', textAlign: 'right' }} className="text-end">Debit ()</th>
                                        <th style={{ width: '15%', textAlign: 'right' }} className="text-end">Credit ()</th>
                                        {maintainNarration && <th style={{ width: '8%', textAlign: 'center' }}>Narration</th>}
                                        <th style={{ width: '5%', textAlign: 'center' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentContra.details.map((row, idx) => (
                                        <React.Fragment key={idx}>
                                            <tr>
                                                <td>
                                                    <Form.Select
                                                        size="sm"
                                                        id={`cell-${idx}-entry_type`}
                                                        value={row.entry_type}
                                                        onChange={e => handleDetailChange(idx, 'entry_type', e.target.value)}
                                                        onKeyDown={e => handleCellKeyDown(e, idx, 'entry_type')}
                                                        className="rounded-3 border-0 py-1 fw-semibold text-center"
                                                        style={{
                                                            height: '30px',
                                                            color: row.entry_type === 'Dr' ? '#2dce89' : '#f5365c',
                                                            backgroundColor: row.entry_type === 'Dr' ? '#e2f7ed' : '#fdebeb'
                                                        }}
                                                    >
                                                        <option value="Dr" className="text-success fw-bold">(Dr)</option>
                                                        <option value="Cr" className="text-danger fw-bold">(Cr)</option>
                                                    </Form.Select>
                                                </td>
                                                <td>
                                                    <Select
                                                        options={[
                                                            { value: '', label: '-- Select Ledger --' },
                                                            ...ledgers
                                                                .filter(l => {
                                                                    if (row.ledger && String(l.id) === String(row.ledger)) return true;
                                                                    const g = (l.account_group_name || l.account_group_details?.name || l.parent_name || '').toLowerCase();
                                                                    const n = (l.name || '').toLowerCase();
                                                                    return (
                                                                        g.includes('cash') || 
                                                                        g.includes('bank') || 
                                                                        g.includes('hand') || 
                                                                        g.includes('od') || 
                                                                        g.includes('occ') || 
                                                                        g.includes('deposit') ||
                                                                        n.includes('cash') || 
                                                                        n.includes('bank')
                                                                    );
                                                                })
                                                                .map(l => ({ value: l.id, label: l.name }))
                                                        ]}
                                                        value={row.ledger ? { value: row.ledger, label: ledgers.find(l => String(l.id) === String(row.ledger))?.name || '' } : { value: '', label: '-- Select Ledger --' }}
                                                        onChange={sel => {
                                                            const val = sel ? sel.value : '';
                                                            handleDetailChange(idx, 'ledger', val);
                                                            if (!val) {
                                                                if (currentContra.details.length > 2) {
                                                                    removeDetailRow(idx);
                                                                }
                                                                setTimeout(() => {
                                                                    const masterNarrationEl = document.getElementById('master-narration');
                                                                    if (masterNarrationEl) {
                                                                        masterNarrationEl.focus();
                                                                    }
                                                                }, 50);
                                                            } else {
                                                                setTimeout(() => {
                                                                    const activeCol = row.entry_type === 'Dr' ? 'debit_amount' : 'credit_amount';
                                                                    const el = document.getElementById(`cell-${idx}-${activeCol}`);
                                                                    if (el) {
                                                                        el.focus();
                                                                        if (el.select) el.select();
                                                                    }
                                                                }, 100);
                                                            }
                                                        }}
                                                        styles={customSelectStyles}
                                                        menuPortalTarget={document.body}
                                                        menuPosition="fixed"
                                                        isSearchable
                                                        isClearable={true}
                                                        openMenuOnFocus={true}
                                                        blurInputOnSelect={true}
                                                        placeholder="-- Select Ledger --"
                                                        inputId={`cell-${idx}-ledger`}
                                                        onKeyDown={e => handleCellKeyDown(e, idx, 'ledger')}
                                                    />
                                                </td>
                                                <td style={{ textAlign: 'right', padding: '4px 8px', verticalAlign: 'middle' }}>
                                                    {row.entry_type === 'Dr' && (
                                                        <Form.Control
                                                            size="sm"
                                                            id={`cell-${idx}-debit_amount`}
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={row.debit_amount || ''}
                                                            onChange={e => handleDetailChange(idx, 'debit_amount', parseFloat(e.target.value) || 0)}
                                                            onKeyDown={e => handleCellKeyDown(e, idx, 'debit_amount')}
                                                            onFocus={e => handleFocusAmount(idx, 'debit_amount')}
                                                            placeholder="0.00"
                                                            className="text-end font-monospace border-secondary border-opacity-25"
                                                            style={{ height: '30px' }}
                                                        />
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right', padding: '4px 8px', verticalAlign: 'middle' }}>
                                                    {row.entry_type === 'Cr' && (
                                                        <Form.Control
                                                            size="sm"
                                                            id={`cell-${idx}-credit_amount`}
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={row.credit_amount || ''}
                                                            onChange={e => handleDetailChange(idx, 'credit_amount', parseFloat(e.target.value) || 0)}
                                                            onKeyDown={e => handleCellKeyDown(e, idx, 'credit_amount')}
                                                            onFocus={e => handleFocusAmount(idx, 'credit_amount')}
                                                            placeholder="0.00"
                                                            className="text-end font-monospace border-secondary border-opacity-25"
                                                            style={{ height: '30px' }}
                                                        />
                                                    )}
                                                </td>
                                                {maintainNarration && (
                                                    <td className="text-center">
                                                        <Button
                                                            id={`cell-${idx}-narration`}
                                                            type="button"
                                                            onClick={() => toggleNarration(idx)}
                                                            onKeyDown={e => handleCellKeyDown(e, idx, 'narration')}
                                                            style={{
                                                                width: '30px',
                                                                height: '30px',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                borderRadius: '8px',
                                                                backgroundColor: (row.narration || expandedNarrations[idx]) ? '#f3b73e' : '#e4e7ed',
                                                                color: (row.narration || expandedNarrations[idx]) ? '#ffffff' : '#a0aec0',
                                                                borderColor: (row.narration || expandedNarrations[idx]) ? '#f3b73e' : '#e4e7ed',
                                                                boxShadow: 'none'
                                                            }}
                                                            className="p-0 border-0"
                                                        >
                                                            <i className="fa fa-file-alt"></i>
                                                        </Button>
                                                    </td>
                                                )}
                                                <td className="text-center" style={{ whiteSpace: 'nowrap' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                        {/* + button slot — always 30px wide */}
                                                        <div style={{ width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {idx === currentContra.details.length - 1 && (
                                                                <Button
                                                                    variant="primary"
                                                                    className="rounded d-inline-flex align-items-center justify-content-center"
                                                                    style={{ width: '30px', height: '30px' }}
                                                                    onClick={addDetailRow}
                                                                    title="Add New Row"
                                                                >
                                                                    <i className="fa fa-plus"></i>
                                                                </Button>
                                                            )}
                                                        </div>
                                                        {/* delete button slot — always 30px wide, always same position */}
                                                        <div style={{ width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {currentContra.details.length > 1 && (
                                                                <Button
                                                                    variant="light"
                                                                    className="text-danger border-0 rounded-circle btn-icon p-2"
                                                                    onClick={() => removeDetailRow(idx)}
                                                                    style={{ width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                                                    title="Remove Row"
                                                                >
                                                                    <i className="fa fa-trash-alt"></i>
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                            {maintainNarration && expandedNarrations[idx] && (
                                                <tr className="bg-light border-0">
                                                    <td colSpan="6" className="p-2 bg-light border-0">
                                                        <Form.Control
                                                            size="sm"
                                                            as="textarea"
                                                            id={`cell-${idx}-narration-text`}
                                                            rows={1}
                                                            placeholder="Enter narration for this line..."
                                                            value={row.narration || ''}
                                                            onChange={e => handleDetailChange(idx, 'narration', e.target.value)}
                                                            onKeyDown={e => handleCellKeyDown(e, idx, 'narration-text')}
                                                            className="border-secondary border-opacity-25"
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                    {/* Summary Row */}
                                    <tr className="table-light fw-semibold">
                                        <td colSpan="2" className="text-end text-muted">Total:</td>
                                        <td className="text-end font-monospace text-success" style={{ padding: '4px 17px' }}>{totalDebit.toFixed(2)}</td>
                                        <td className="text-end font-monospace text-danger" style={{ padding: '4px 17px' }}>{totalCredit.toFixed(2)}</td>
                                        {maintainNarration && <td></td>}
                                        <td></td>
                                    </tr>
                                </tbody>
                            </Table>
                        </div>

                        {/* Master Narration */}
                        <div className="mt-2">
                            <Form.Group>
                                <Form.Label className="fw-semibold text-muted small mb-1">MASTER NARRATION</Form.Label>
                                <Form.Control
                                    size="sm"
                                    id="master-narration"
                                    as="textarea"
                                    rows={2}
                                    value={currentContra.narration}
                                    onChange={e => handleInputChange('narration', e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            const saveBtn = document.querySelector('.btn-universal-save');
                                            if (saveBtn) saveBtn.focus();
                                        }
                                    }}
                                    placeholder="Optional master narration for this transaction voucher"
                                    className="border-secondary border-opacity-25"
                                />
                            </Form.Group>
                        </div>
                    </Modal.Body>
                    <Modal.Footer className="border-0 px-4 py-2 bg-light rounded-bottom-4 justify-content-between align-items-center">
                        <div>
                            {!isBalanced && totalDebit > 0 && (
                                <div className="text-danger small fw-semibold">
                                    <i className="fa fa-exclamation-triangle me-1"></i>
                                    Total Debit must equal Total Credit. Difference: {Math.abs(totalDebit - totalCredit).toFixed(2)}
                                </div>
                            )}
                            {isBalanced && (
                                <div className="text-success small fw-semibold">
                                    <i className="fa fa-check-circle me-1"></i>
                                    Voucher balanced successfully.
                                </div>
                            )}
                        </div>
                        <div className="d-flex gap-2">
                            <Button 
                                className="btn-universal-close" 
                                onClick={() => setShowModal(false)}
                            >
                                Close
                            </Button>
                            <Button
                                type="submit"
                                className="btn-universal-save"
                                disabled={!isBalanced}
                            >
                                <i className="fa fa-save me-2"></i>
                                {editMode ? 'Update' : 'Save'}
                            </Button>
                        </div>
                    </Modal.Footer>
                </Form>
            </Modal>
        </div>
    );
};

export default ContraList;
