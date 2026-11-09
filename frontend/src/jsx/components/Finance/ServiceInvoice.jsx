import React, { useState, useEffect, useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Modal, Form, Row, Col, Table } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';
import { ThemeContext } from '../../../context/ThemeContext';
import { getLedgers, getAccountGroups } from '../../../services/FinanceService';
import { getServiceInvoices, createServiceInvoice, updateServiceInvoice, deleteServiceInvoice } from '../../../services/FinanceService';
import { fetchPrefixConfigurations, generateNextVoucherNumber } from '../../../services/PrefixService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

const ServiceInvoice = () => {
    const [invoices, setInvoices] = useState([]);
    const [ledgers, setLedgers] = useState([]);
    const [accountGroups, setAccountGroups] = useState([]);
    const [prefixConfigs, setPrefixConfigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const { can } = usePermission();

    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    
    const defaultDetail = {
        service_ledger: '',
        rate: 0,
        hsn: '',
        gst_percent: 0,
        gross: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        amount: 0
    };

    const defaultInvoice = {
        id: null,
        invoice_no: '',
        invoice_date: new Date().toISOString().split('T')[0],
        customer: '',
        bill_type: 'b2b',
        prefix_config_id: '',
        cgst: 0,
        sgst: 0,
        igst: 0,
        gst_ledger_1: '',
        gst_ledger_2: '',
        other_charges: 0,
        round_off: 0,
        net_amount: 0,
        narration: '',
        details: [ { ...defaultDetail } ]
    };

    const [currentInvoice, setCurrentInvoice] = useState(defaultInvoice);

    const { background } = useContext(ThemeContext);
    const isDark = background?.value === 'dark';

    const getDebtorCreditorGroupIds = (groups) => {
        if (!groups || !Array.isArray(groups)) return new Set();
        const targetNames = ['sundry debtors', 'sundry creditors', 'sundry debtor', 'sundry creditor', 'debtors', 'creditors', 'debtor', 'creditor'];
        const validIds = new Set();
        const rootGroups = groups.filter(g => {
            const name = (g.name || '').toLowerCase().trim();
            return targetNames.some(t => name === t || name.includes(t));
        });
        rootGroups.forEach(rg => {
            validIds.add(rg.id);
            validIds.add(String(rg.id));
            validIds.add(Number(rg.id));
        });
        let added;
        do {
            added = false;
            groups.forEach(g => {
                const parentId = g.parent || g.parent_id;
                if (parentId && (validIds.has(parentId) || validIds.has(String(parentId)) || validIds.has(Number(parentId)))) {
                    if (!validIds.has(g.id)) {
                        validIds.add(g.id);
                        validIds.add(String(g.id));
                        validIds.add(Number(g.id));
                        added = true;
                    }
                }
            });
        } while (added);
        return validIds;
    };

    const isDebtorOrCreditor = (l, validGroupIds = null) => {
        if (!l) return false;
        const groupVal = l.accountGroup ?? l.account_group;
        if (validGroupIds && groupVal && (validGroupIds.has(groupVal) || validGroupIds.has(String(groupVal)) || validGroupIds.has(Number(groupVal)))) {
            return true;
        }
        const groupName = (
            l.account_group_name ||
            l.accountGroup?.name ||
            l.account_group?.name ||
            (typeof l.account_group === 'string' ? l.account_group : '') ||
            l.group_name ||
            (typeof l.group === 'string' ? l.group : '') ||
            l.account_group_label ||
            ''
        ).toLowerCase().trim();
        return groupName.includes('debtor') || groupName.includes('creditor');
    };

    const customerOptions = useMemo(() => {
        const validGroupIds = getDebtorCreditorGroupIds(accountGroups);
        return (ledgers || [])
            .filter(l => isDebtorOrCreditor(l, validGroupIds))
            .map(l => ({ value: l.id, label: l.name }));
    }, [ledgers, accountGroups]);

    const serviceLedgerOptions = useMemo(() => {
        const validGroupIds = getDebtorCreditorGroupIds(accountGroups);
        return (ledgers || [])
            .filter(l => !isDebtorOrCreditor(l, validGroupIds))
            .map(l => ({ value: l.id, label: l.name }));
    }, [ledgers, accountGroups]);

    useEffect(() => {
        fetchData();
        fetchLedgers();
        fetchAccountGroups();
        fetchPrefixes();
    }, []);

    const fetchAccountGroups = async () => {
        try {
            const data = await getAccountGroups();
            setAccountGroups(Array.isArray(data) ? data : (data?.data || []));
        } catch (error) {
            console.error('Failed to fetch account groups', error);
        }
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getServiceInvoices();
            setInvoices(data);
        } catch (error) {
            Swal.fire('Error', 'Failed to fetch invoices', 'error');
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

    const fetchPrefixes = async () => {
        try {
            const data = await fetchPrefixConfigurations();
            setPrefixConfigs(Array.isArray(data) ? data : (data?.data || []));
        } catch (error) {
            console.error('Failed to fetch prefix configurations', error);
        }
    };

    const getServiceVoucherOptions = () => {
        const salesConfigs = (prefixConfigs || []).filter(c => {
            const vName = (c.voucher_type_name || '').toLowerCase();
            const sub = (c.subvoucher_type_name || c.sub_type || '').toLowerCase();
            return vName.includes('sales') || vName.includes('service') || sub.includes('service');
        });

        const serviceConfigs = salesConfigs.filter(c => {
            const sub = (c.subvoucher_type_name || c.sub_type || '').toLowerCase();
            const vName = (c.voucher_type_name || '').toLowerCase();
            return sub.includes('service') || vName.includes('service');
        });

        const targetConfigs = serviceConfigs.length > 0 ? serviceConfigs : salesConfigs;

        if (targetConfigs.length > 0) {
            const mapped = targetConfigs.map(c => {
                const label = c.subvoucher_type_name || c.sub_type || '';
                const lower = label.toLowerCase();
                let bType = 'b2b';
                if (lower.includes('igst') || lower.includes('inter')) {
                    bType = 'igst';
                } else if (lower.includes('b2c')) {
                    bType = 'b2c';
                } else if (lower.includes('b2b')) {
                    bType = 'b2b';
                }
                return {
                    id: c.id,
                    billType: bType,
                    label: label || (bType === 'igst' ? 'IGST Services' : (bType === 'b2c' ? 'B2C Service' : 'B2B Service')),
                    config: c
                };
            });

            const sortOrder = { 'b2b': 1, 'b2c': 2, 'igst': 3 };
            mapped.sort((a, b) => (sortOrder[a.billType] || 99) - (sortOrder[b.billType] || 99));
            return mapped;
        }

        return [
            { id: 'b2b', billType: 'b2b', label: 'B2B Service', config: null },
            { id: 'b2c', billType: 'b2c', label: 'B2C Service', config: null },
            { id: 'igst', billType: 'igst', label: 'IGST Services', config: null }
        ];
    };

    const getBillTypeDisplay = (billType, invoiceNo) => {
        if (invoiceNo && Array.isArray(prefixConfigs)) {
            const matched = prefixConfigs.find(c => {
                if (!c.prefix) return false;
                return invoiceNo.startsWith(c.prefix) || invoiceNo.includes(c.prefix);
            });
            if (matched) {
                return matched.subvoucher_type_name || matched.sub_type || matched.prefix;
            }
        }
        
        const options = getServiceVoucherOptions();
        const found = options.find(opt => opt.billType === billType);
        if (found) return found.label;

        const b = (billType || '').toLowerCase();
        if (b === 'b2b') return 'B2B Service';
        if (b === 'b2c') return 'B2C Service';
        if (b === 'igst') return 'IGST Services';
        return billType || '';
    };

    const getPrefixConfigForBillType = (billType, configs = prefixConfigs, specificConfigId = null) => {
        if (!Array.isArray(configs) || configs.length === 0) return null;
        if (specificConfigId) {
            const foundById = configs.find(c => String(c.id) === String(specificConfigId));
            if (foundById) return foundById;
        }

        const bType = (billType || '').toLowerCase();
        
        let match = configs.find(c => {
            const sub = (c.subvoucher_type_name || c.sub_type || '').toLowerCase();
            const vName = (c.voucher_type_name || '').toLowerCase();
            if (bType === 'b2b') {
                return sub.includes('b2b') && (sub.includes('service') || vName.includes('service'));
            } else if (bType === 'b2c') {
                return sub.includes('b2c') && (sub.includes('service') || vName.includes('service'));
            } else if (bType === 'igst') {
                return (sub.includes('igst') || sub.includes('inter')) && (sub.includes('service') || vName.includes('service'));
            }
            return false;
        });

        if (!match) {
            match = configs.find(c => {
                const sub = (c.subvoucher_type_name || c.sub_type || '').toLowerCase();
                if (bType === 'b2b') return sub === 'b2b' || sub.includes('b2b');
                if (bType === 'b2c') return sub === 'b2c' || sub.includes('b2c');
                if (bType === 'igst') return sub === 'igst' || sub.includes('igst') || sub.includes('inter');
                return false;
            });
        }

        if (!match) {
            match = configs.find(c => {
                const sub = (c.subvoucher_type_name || c.sub_type || '').toLowerCase();
                const vName = (c.voucher_type_name || '').toLowerCase();
                return sub.includes('service') || vName.includes('service');
            });
        }

        return match || null;
    };

    const generateInvoiceNo = (billType = 'b2b', configs = prefixConfigs, specificConfig = null) => {
        const config = specificConfig || getPrefixConfigForBillType(billType, configs);
        if (config) {
            const formattedVouchers = (invoices || []).map(inv => ({ voucher_no: inv.invoice_no }));
            return generateNextVoucherNumber(config, formattedVouchers, 'SI');
        }

        if (!invoices || invoices.length === 0) return 'SI-0001';
        
        let maxNum = 0;
        invoices.forEach(inv => {
            const match = inv.invoice_no?.match(/\d+$/);
            if (match) {
                const num = parseInt(match[0], 10);
                if (num > maxNum) {
                    maxNum = num;
                }
            }
        });
        
        return `SI-${String(maxNum + 1).padStart(4, '0')}`;
    };

    const getApplicableGstDetail = (ledger, invoiceDate) => {
        if (!ledger || !Array.isArray(ledger.gst_details) || ledger.gst_details.length === 0) return null;
        const targetDate = invoiceDate ? invoiceDate.split('T')[0] : '';
        
        const datedRows = ledger.gst_details.filter(row => {
            if (!row.applicable_date) return false;
            return !targetDate || row.applicable_date.split('T')[0] <= targetDate;
        });

        if (datedRows.length > 0) {
            datedRows.sort((a, b) => new Date(b.applicable_date) - new Date(a.applicable_date));
            const positiveMatch = datedRows.find(r => parseFloat(r.gst_percentage) > 0);
            return positiveMatch || datedRows[0];
        }

        const positiveAny = ledger.gst_details.find(r => parseFloat(r.gst_percentage) > 0);
        if (positiveAny) return positiveAny;

        return ledger.gst_details[0];
    };

    const getOutputTaxLedgers = (ledgersList) => {
        if (!Array.isArray(ledgersList)) return { outputCgst: null, outputSgst: null, outputIgst: null };
        const findTax = (type) => {
            const t = type.toLowerCase();
            return ledgersList.find(l => (l.name || '').trim().toLowerCase() === `output ${t}`)
                || ledgersList.find(l => (l.name || '').toLowerCase().includes('output') && (l.name || '').toLowerCase().includes(t))
                || ledgersList.find(l => (l.name || '').toLowerCase().includes(t));
        };
        return {
            outputCgst: findTax('cgst'),
            outputSgst: findTax('sgst'),
            outputIgst: findTax('igst')
        };
    };

    const handleShowModal = (invoice = null) => {
        const { outputCgst, outputSgst, outputIgst } = getOutputTaxLedgers(ledgers);
        if (invoice) {
            const isIgst = invoice.bill_type === 'igst';
            const fallbackGst1 = isIgst ? (outputIgst?.id || '') : (outputCgst?.id || '');
            const fallbackGst2 = isIgst ? '' : (outputSgst?.id || '');

            let matchedConfigId = '';
            if (invoice.invoice_no && Array.isArray(prefixConfigs)) {
                const match = prefixConfigs.find(c => c.prefix && (invoice.invoice_no.startsWith(c.prefix) || invoice.invoice_no.includes(c.prefix)));
                if (match) matchedConfigId = match.id;
            }
            if (!matchedConfigId) {
                const match = getPrefixConfigForBillType(invoice.bill_type, prefixConfigs);
                if (match) matchedConfigId = match.id;
            }

            setCurrentInvoice({
                ...invoice,
                prefix_config_id: matchedConfigId,
                gst_ledger_1: invoice.gst_ledger_1 || fallbackGst1,
                gst_ledger_2: invoice.gst_ledger_2 || fallbackGst2,
                narration: invoice.narration || '',
                details: invoice.details?.length ? invoice.details : [{ ...defaultDetail }]
            });
            setEditMode(true);
        } else {
            const voucherOpts = getServiceVoucherOptions();
            const firstOpt = voucherOpts[0];
            const billType = firstOpt?.billType || 'b2b';
            const config = (firstOpt?.id && String(firstOpt.id) !== 'b2b' && String(firstOpt.id) !== 'b2c' && String(firstOpt.id) !== 'igst')
                ? (prefixConfigs.find(c => String(c.id) === String(firstOpt.id)) || getPrefixConfigForBillType(billType, prefixConfigs))
                : getPrefixConfigForBillType(billType, prefixConfigs);
            const nextInvNo = generateInvoiceNo(billType, prefixConfigs, config);

            const gstArr = Array.isArray(config?.gst_ledger) 
                ? config.gst_ledger 
                : (config?.gst_ledger ? [config.gst_ledger] : []);

            let initialGst1 = '';
            let initialGst2 = '';
            if (billType === 'igst') {
                initialGst1 = gstArr[0] || outputIgst?.id || '';
                initialGst2 = '';
            } else {
                if (gstArr.length > 0) {
                    initialGst1 = gstArr[0];
                    initialGst2 = gstArr[1] || '';
                } else {
                    initialGst1 = outputCgst?.id || '';
                    initialGst2 = outputSgst?.id || '';
                }
            }

            const initialDetails = [{ ...defaultDetail }];
            if (config?.ledger) {
                const selectedLedger = ledgers.find(l => String(l.id) === String(config.ledger));
                const gstDetail = getApplicableGstDetail(selectedLedger, defaultInvoice.invoice_date);
                initialDetails[0] = {
                    ...initialDetails[0],
                    service_ledger: config.ledger,
                    hsn: gstDetail?.hsn_code !== undefined && gstDetail?.hsn_code !== null ? gstDetail.hsn_code : '',
                    gst_percent: gstDetail?.gst_percentage !== undefined && gstDetail?.gst_percentage !== null ? (parseFloat(gstDetail.gst_percentage) || 0) : 0
                };
            }

            const newInv = calculateTotals({
                ...defaultInvoice,
                invoice_no: nextInvNo,
                bill_type: billType,
                prefix_config_id: config?.id || firstOpt?.id || '',
                gst_ledger_1: initialGst1,
                gst_ledger_2: initialGst2,
                details: initialDetails
            });

            setCurrentInvoice(newInv);
            setEditMode(false);
        }
        setShowModal(true);
    };

    useEffect(() => {
        if (showModal && !editMode && (prefixConfigs.length > 0 || ledgers.length > 0)) {
            setCurrentInvoice(prev => {
                const config = (prev.prefix_config_id && String(prev.prefix_config_id) !== 'b2b' && String(prev.prefix_config_id) !== 'b2c' && String(prev.prefix_config_id) !== 'igst')
                    ? (prefixConfigs.find(c => String(c.id) === String(prev.prefix_config_id)) || getPrefixConfigForBillType(prev.bill_type, prefixConfigs))
                    : getPrefixConfigForBillType(prev.bill_type, prefixConfigs);
                const { outputCgst, outputSgst, outputIgst } = getOutputTaxLedgers(ledgers);
                const isIgst = prev.bill_type === 'igst';

                const gstArr = Array.isArray(config?.gst_ledger) 
                    ? config.gst_ledger 
                    : (config?.gst_ledger ? [config.gst_ledger] : []);

                let nextGst1 = prev.gst_ledger_1;
                let nextGst2 = prev.gst_ledger_2;
                if (!nextGst1 && !nextGst2) {
                    if (isIgst) {
                        nextGst1 = gstArr[0] || outputIgst?.id || '';
                        nextGst2 = '';
                    } else {
                        if (gstArr.length > 0) {
                            nextGst1 = gstArr[0];
                            nextGst2 = gstArr[1] || '';
                        } else {
                            nextGst1 = outputCgst?.id || '';
                            nextGst2 = outputSgst?.id || '';
                        }
                    }
                }

                let nextInvNo = prev.invoice_no;
                if (!nextInvNo || nextInvNo.startsWith('SI-')) {
                    nextInvNo = generateInvoiceNo(prev.bill_type, prefixConfigs, config);
                }

                let nextDetails = [...(prev.details || [{ ...defaultDetail }])];
                if (config?.ledger && (!nextDetails[0]?.service_ledger || nextDetails[0].service_ledger === '')) {
                    const selectedLedger = ledgers.find(l => String(l.id) === String(config.ledger));
                    const gstDetail = getApplicableGstDetail(selectedLedger, prev.invoice_date);
                    nextDetails[0] = {
                        ...nextDetails[0],
                        service_ledger: config.ledger,
                        hsn: gstDetail?.hsn_code !== undefined && gstDetail?.hsn_code !== null ? gstDetail.hsn_code : nextDetails[0].hsn,
                        gst_percent: gstDetail?.gst_percentage !== undefined && gstDetail?.gst_percentage !== null ? (parseFloat(gstDetail.gst_percentage) || 0) : nextDetails[0].gst_percent
                    };
                }

                return calculateTotals({
                    ...prev,
                    invoice_no: nextInvNo,
                    prefix_config_id: config?.id || prev.prefix_config_id || '',
                    gst_ledger_1: nextGst1,
                    gst_ledger_2: nextGst2,
                    details: nextDetails
                });
            });
        }
    }, [prefixConfigs, ledgers, showModal, editMode]);

    const handleDelete = async (id, no) => {
        const result = await Swal.fire({
            title: 'Delete Invoice?',
            text: `Are you sure you want to delete invoice "${no}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteServiceInvoice(id);
                Swal.fire('Deleted', 'Invoice deleted successfully', 'success');
                fetchData();
            } catch (error) {
                Swal.fire('Error', 'Failed to delete invoice', 'error');
            }
        }
    };

    const calculateTotals = (invoiceState) => {
        let total_cgst = 0;
        let total_sgst = 0;
        let total_igst = 0;
        let total_gross = 0;

        const updatedDetails = invoiceState.details.map(detail => {
            const rate = parseFloat(detail.rate) || 0;
            const gst_percent = parseFloat(detail.gst_percent) || 0;
            const gross = rate; // Assuming qty = 1 for service or rate is total
            const tax = (gross * gst_percent) / 100;
            
            let cgst = 0, sgst = 0, igst = 0;
            if (invoiceState.bill_type === 'igst') {
                igst = tax;
            } else {
                cgst = tax / 2;
                sgst = tax / 2;
            }
            const amount = gross + tax;

            total_cgst += cgst;
            total_sgst += sgst;
            total_igst += igst;
            total_gross += gross;

            return { ...detail, gross, cgst, sgst, igst, amount };
        });

        const auto_round = invoiceState.auto_round_off !== false;
        const other_charges = parseFloat(invoiceState.other_charges) || 0;
        let rawNet = total_gross + total_cgst + total_sgst + total_igst + other_charges;
        let round_off = 0;
        let net = rawNet;

        if (auto_round) {
            round_off = Math.round(rawNet) - rawNet;
            net = Math.round(rawNet);
        }

        return {
            ...invoiceState,
            details: updatedDetails,
            cgst: total_cgst,
            sgst: total_sgst,
            igst: total_igst,
            round_off: round_off,
            net_amount: net
        };
    };

    const handleBillTypeOrConfigChange = (newBillType, configId = null) => {
        const config = (configId && String(configId) !== 'b2b' && String(configId) !== 'b2c' && String(configId) !== 'igst')
            ? (prefixConfigs.find(c => String(c.id) === String(configId)) || getPrefixConfigForBillType(newBillType, prefixConfigs))
            : getPrefixConfigForBillType(newBillType, prefixConfigs);

        const { outputCgst, outputSgst, outputIgst } = getOutputTaxLedgers(ledgers);
        const isIgst = newBillType === 'igst';

        const gstArr = Array.isArray(config?.gst_ledger) 
            ? config.gst_ledger 
            : (config?.gst_ledger ? [config.gst_ledger] : []);

        let nextGst1 = '';
        let nextGst2 = '';
        if (isIgst) {
            nextGst1 = gstArr[0] || outputIgst?.id || '';
            nextGst2 = '';
        } else {
            if (gstArr.length > 0) {
                nextGst1 = gstArr[0];
                nextGst2 = gstArr[1] || '';
            } else {
                nextGst1 = outputCgst?.id || '';
                nextGst2 = outputSgst?.id || '';
            }
        }

        let updatedInvoice = {
            ...currentInvoice,
            bill_type: newBillType,
            prefix_config_id: config?.id || configId || '',
            gst_ledger_1: nextGst1,
            gst_ledger_2: nextGst2
        };

        if (!editMode) {
            updatedInvoice.invoice_no = generateInvoiceNo(newBillType, prefixConfigs, config);
        }

        if (config?.ledger && (!editMode || !updatedInvoice.details?.[0]?.service_ledger)) {
            const details = [...(updatedInvoice.details || [{ ...defaultDetail }])];
            const selectedLedger = ledgers.find(l => String(l.id) === String(config.ledger));
            const gstDetail = getApplicableGstDetail(selectedLedger, updatedInvoice.invoice_date);
            details[0] = {
                ...details[0],
                service_ledger: config.ledger,
                hsn: gstDetail?.hsn_code !== undefined && gstDetail?.hsn_code !== null ? gstDetail.hsn_code : details[0].hsn,
                gst_percent: gstDetail?.gst_percentage !== undefined && gstDetail?.gst_percentage !== null ? (parseFloat(gstDetail.gst_percentage) || 0) : details[0].gst_percent
            };
            updatedInvoice.details = details;
        }

        updatedInvoice = calculateTotals(updatedInvoice);
        setCurrentInvoice(updatedInvoice);
    };

    const handleInputChange = (field, value) => {
        let updatedInvoice = { ...currentInvoice, [field]: value };

        if (field === 'bill_type') {
            const opt = getServiceVoucherOptions().find(o => String(o.id) === String(value) || o.billType === value);
            handleBillTypeOrConfigChange(opt ? opt.billType : value, opt ? opt.id : null);
            return;
        }

        if (field === 'invoice_date') {
            const details = (updatedInvoice.details || []).map(det => {
                if (det.service_ledger) {
                    const selectedLedger = ledgers.find(l => String(l.id) === String(det.service_ledger));
                    const gstDetail = getApplicableGstDetail(selectedLedger, value);
                    if (gstDetail) {
                        return {
                            ...det,
                            hsn: gstDetail.hsn_code !== undefined && gstDetail.hsn_code !== null ? gstDetail.hsn_code : det.hsn,
                            gst_percent: gstDetail.gst_percentage !== undefined && gstDetail.gst_percentage !== null ? (parseFloat(gstDetail.gst_percentage) || 0) : det.gst_percent
                        };
                    }
                }
                return det;
            });
            updatedInvoice.details = details;
        }

        if (field === 'other_charges' || field === 'auto_round_off' || field === 'bill_type' || field === 'invoice_date') {
            updatedInvoice = calculateTotals(updatedInvoice);
        }
        setCurrentInvoice(updatedInvoice);
    };

    const handleDetailChange = (index, field, value) => {
        const details = [...currentInvoice.details];
        details[index] = { ...details[index], [field]: value };
        const updatedInvoice = calculateTotals({ ...currentInvoice, details });
        setCurrentInvoice(updatedInvoice);
    };

    const handleServiceLedgerChange = (index, ledgerId) => {
        const details = [...currentInvoice.details];
        details[index] = { ...details[index], service_ledger: ledgerId };
        
        if (ledgerId) {
            const selectedLedger = ledgers.find(l => String(l.id) === String(ledgerId));
            if (selectedLedger && selectedLedger.gst_details && selectedLedger.gst_details.length > 0) {
                const gstDetail = getApplicableGstDetail(selectedLedger, currentInvoice.invoice_date);
                if (gstDetail) {
                    if (gstDetail.hsn_code !== undefined && gstDetail.hsn_code !== null) {
                        details[index].hsn = gstDetail.hsn_code;
                    }
                    if (gstDetail.gst_percentage !== undefined && gstDetail.gst_percentage !== null) {
                        details[index].gst_percent = parseFloat(gstDetail.gst_percentage) || 0;
                    }
                }
            }
        }
        
        const updatedInvoice = calculateTotals({ ...currentInvoice, details });
        setCurrentInvoice(updatedInvoice);
    };

    const addDetailRow = () => {
        setCurrentInvoice({
            ...currentInvoice,
            details: [...currentInvoice.details, { ...defaultDetail }]
        });
    };

    const removeDetailRow = (index) => {
        const details = [...currentInvoice.details];
        details.splice(index, 1);
        const updatedInvoice = calculateTotals({ ...currentInvoice, details });
        setCurrentInvoice(updatedInvoice);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentInvoice.invoice_no || !currentInvoice.customer) {
            Swal.fire('Validation Error', 'Invoice No and Customer are required', 'warning');
            return;
        }

        try {
            const payload = { ...currentInvoice };
            delete payload.prefix_config_id;
            delete payload.customer_name;
            delete payload.gst_ledger_1_name;
            delete payload.gst_ledger_2_name;

            if (editMode) {
                await updateServiceInvoice(currentInvoice.id, payload);
                Swal.fire('Updated', 'Invoice updated successfully', 'success');
            } else {
                await createServiceInvoice(payload);
                Swal.fire('Created', 'Invoice created successfully', 'success');
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error(error);
            Swal.fire('Error', `Failed to save invoice. Ensure Invoice No is unique.`, 'error');
        }
    };

    const handleKeyDown = (e) => {
        const target = e.target;
        const tagName = target.tagName.toLowerCase();
        const type = target.type ? target.type.toLowerCase() : '';

        // If not Enter key, just handle native select picker flag
        if (e.key !== 'Enter') {
            if (tagName === 'select') {
                delete target.dataset.pickerOpen;
            }
            return;
        }

        // Allow default behavior for textareas and submit buttons
        if (tagName === 'textarea' || type === 'submit') {
            return;
        }

        // Check if the current element is a native select dropdown and is NOT marked as open
        if (tagName === 'select' && target.dataset.pickerOpen !== 'true') {
            if (typeof target.showPicker === 'function') {
                target.showPicker();
                target.dataset.pickerOpen = 'true';
                return;
            }
        }
        
        // If it was open, or it's a regular input, delete flag
        if (tagName === 'select') {
            delete target.dataset.pickerOpen;
        }

        // If react-select menu is open, let it handle the selection
        const isReactSelectOpen = target.getAttribute('aria-expanded') === 'true';
        if (isReactSelectOpen) {
            return;
        }

        e.preventDefault();

        const form = e.currentTarget;
        
        // Find all focusable elements (excluding readOnly inputs)
        const focusableElements = Array.from(
            form.querySelectorAll('input, select, textarea, button')
        ).filter(el => {
            return !el.disabled && 
                   !el.readOnly &&
                   el.tabIndex !== -1 && 
                   el.offsetParent !== null && 
                   !(el.tagName.toLowerCase() === 'button' && el.classList.contains('btn-secondary'));
        });

        const index = focusableElements.indexOf(target);
        if (index > -1 && index < focusableElements.length - 1) {
            focusableElements[index + 1].focus();
        }
    };

    const customSelectStyles = {
        control: (provided, state) => ({
            ...provided,
            backgroundColor: isDark ? '#24292D' : '#ffffff',
            borderColor: state.isFocused ? 'var(--cc-primary)' : (isDark ? '#636363' : '#ececec'),
            color: isDark ? '#ffffff' : '#2f3f50',
            minHeight: '38px',
            borderRadius: '0.375rem',
            boxShadow: 'none',
        }),
        menu: (provided) => ({ ...provided, zIndex: 9999, backgroundColor: isDark ? '#2F363E' : '#ffffff' }),
        menuPortal: base => ({ ...base, zIndex: 9999 }),
        singleValue: (provided) => ({ ...provided, color: isDark ? '#ffffff' : '#2f3f50' }),
        input: (provided) => ({ ...provided, color: isDark ? '#ffffff' : '#2f3f50' }),
    };

    const actionButtonStyle = {
        width: '28px',
        height: '28px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0',
        fontSize: '12px',
        borderRadius: '6px',
    };

    const filteredInvoices = invoices.filter(inv =>
        (inv.invoice_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentInvoices = filteredInvoices.slice(startIndex, startIndex + itemsPerPage);

    return (
        <div className="container-fluid">
            <div className="page-titles">
                <ol className="breadcrumb">
                    <li className="breadcrumb-item active"><Link to="/finance/service-invoices">Finance</Link></li>
                    <li className="breadcrumb-item">Service Invoices</li>
                </ol>
            </div>
            <Row>
                <Col lg={12}>
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <Card.Title className="mb-0">Service Invoices</Card.Title>
                            <div className="d-flex gap-2 flex-wrap align-items-center service-header-actions">
                                <Form.Control
                                    type="text"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                    className="service-search-input"
                                />
                                <CreateButton module="finance" onClick={() => handleShowModal()}>New Invoice</CreateButton>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading ? <div className="text-center py-5">Loading...</div> : (
                                <Table responsive hover className="service-main-table align-middle" style={{ minWidth: '700px' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '70px', minWidth: '60px' }}>Sl No</th>
                                            <th style={{ minWidth: '130px' }}>Invoice No</th>
                                            <th style={{ minWidth: '105px' }}>Date</th>
                                            <th style={{ minWidth: '160px' }}>Customer</th>
                                            <th style={{ minWidth: '130px' }}>Voucher Type</th>
                                            <th style={{ minWidth: '110px' }}>Net Amount</th>
                                            <th className="text-end" style={{ width: '90px', minWidth: '90px' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentInvoices.length === 0 ? (
                                            <tr><td colSpan="7" className="text-center">No invoices found</td></tr>
                                        ) : (
                                            currentInvoices.map((inv, index) => (
                                                <tr key={inv.id}>
                                                    <td>{startIndex + index + 1}</td>
                                                    <td>{inv.invoice_no}</td>
                                                    <td>{inv.invoice_date}</td>
                                                    <td>{inv.customer_name}</td>
                                                    <td>{getBillTypeDisplay(inv.bill_type, inv.invoice_no)}</td>
                                                    <td>{parseFloat(inv.net_amount).toFixed(2)}</td>
                                                    <td className="text-end">
                                                        <EditButton module="finance" onClick={() => handleShowModal(inv)} className="me-2" />
                                                        <DeleteButton module="finance" onClick={() => handleDelete(inv.id, inv.invoice_no)} />
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </Table>
                            )}

                            {totalPages > 1 && (
                                <div className="service-pagination-wrapper d-flex flex-wrap justify-content-between align-items-center gap-3 mt-3 pt-3 border-top">
                                    <small className="text-muted">
                                        Showing {filteredInvoices.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredInvoices.length)} of {filteredInvoices.length} entries
                                    </small>
                                    <nav className="ms-auto ms-sm-0">
                                        <ul className="pagination pagination-gutter pagination-primary mb-0 flex-wrap">
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
                                                        <li
                                                            key={pageNumber}
                                                            className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}
                                                        >
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
                                                    (pageNumber === 2 && currentPage > 3) ||
                                                    (pageNumber === totalPages - 1 && currentPage < totalPages - 2)
                                                ) {
                                                    return (
                                                        <li key={pageNumber} className="page-item disabled">
                                                            <span className="page-link" style={{ border: 'none' }}>...</span>
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
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Modal show={showModal} onHide={() => setShowModal(false)} size="xl" className="service-invoice-modal">
                <Modal.Header closeButton>
                    <Modal.Title className="w-100">
                        <div className="d-flex align-items-center">
                            <div
                                className="d-flex align-items-center justify-content-center rounded-circle me-3 modal-icon-circle form-icon-circle flex-shrink-0"
                                style={{ width: '44px', height: '44px' }}
                            >
                                <i className="fa fa-file-invoice text-white fs-4"></i>
                            </div>
                            <div>
                                <h4 className="mb-1">{editMode ? 'Edit Service Invoice' : 'New Service Invoice'}</h4>
                                <p className="mb-0 text-muted" style={{ fontSize: '13px', fontWeight: 'normal' }}>
                                    {editMode
                                        ? 'Update details and services for your existing invoice'
                                        : 'Enter details and select services to create a new invoice'}
                                </p>
                            </div>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                    <Modal.Body className="pb-1" style={{ paddingBottom: '6px' }}>
                        <Row className="mb-3 g-2">
                            <Col lg={3} md={6} sm={6} xs={12} className="mb-2">
                                <Form.Group>
                                    <Form.Label>Voucher Type</Form.Label>
                                    <Form.Select 
                                        value={
                                            currentInvoice.prefix_config_id 
                                                ? String(currentInvoice.prefix_config_id) 
                                                : (getServiceVoucherOptions().find(opt => opt.billType === currentInvoice.bill_type)?.id || currentInvoice.bill_type)
                                        } 
                                        onChange={e => {
                                            const val = e.target.value;
                                            const opt = getServiceVoucherOptions().find(o => String(o.id) === String(val) || o.billType === val);
                                            if (opt) {
                                                handleBillTypeOrConfigChange(opt.billType, opt.id);
                                            } else {
                                                handleInputChange('bill_type', val);
                                            }
                                        }}
                                    >
                                        {getServiceVoucherOptions().map((opt, idx) => (
                                            <option key={opt.id || idx} value={opt.id}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col lg={3} md={6} sm={6} xs={12} className="mb-2">
                                <Form.Group>
                                    <Form.Label>Invoice No *</Form.Label>
                                    <Form.Control type="text" value={currentInvoice.invoice_no} onChange={e => handleInputChange('invoice_no', e.target.value)} required />
                                </Form.Group>
                            </Col>
                            <Col lg={3} md={6} sm={6} xs={12} className="mb-2">
                                <Form.Group>
                                    <Form.Label>Invoice Date *</Form.Label>
                                    <Form.Control type="date" value={currentInvoice.invoice_date} onChange={e => handleInputChange('invoice_date', e.target.value)} required />
                                </Form.Group>
                            </Col>
                            <Col lg={3} md={6} sm={6} xs={12} className="mb-2">
                                <Form.Group>
                                    <Form.Label>Customer *</Form.Label>
                                    <Select
                                        options={customerOptions}
                                        value={currentInvoice.customer ? { value: currentInvoice.customer, label: ledgers.find(l => String(l.id) === String(currentInvoice.customer))?.name } : null}
                                        onChange={sel => handleInputChange('customer', sel ? sel.value : '')}
                                        styles={customSelectStyles}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        isSearchable
                                        openMenuOnFocus={true}
                                        placeholder="Select Customer..."
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <div className="table-responsive mt-3" style={{ WebkitOverflowScrolling: 'touch' }}>
                            <Table bordered size="sm" className="service-table" style={{ minWidth: '850px' }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: '45px', minWidth: '45px' }} className="text-center">#</th>
                                        <th style={{ minWidth: '240px' }}>Service Ledger</th>
                                        <th style={{ width: '130px', minWidth: '105px' }}>Rate</th>
                                        <th style={{ width: '90px', minWidth: '80px' }}>GST %</th>
                                        <th style={{ width: '110px', minWidth: '95px' }}>Gross</th>
                                        {currentInvoice.bill_type === 'igst' ? (
                                            <th style={{ width: '115px', minWidth: '95px' }}>IGST</th>
                                        ) : (
                                            <>
                                                <th style={{ width: '105px', minWidth: '90px' }}>CGST</th>
                                                <th style={{ width: '105px', minWidth: '90px' }}>SGST</th>
                                            </>
                                        )}
                                        <th style={{ width: '120px', minWidth: '100px' }}>Amount</th>
                                        <th style={{ width: '85px', minWidth: '85px' }} className="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentInvoice.details.map((detail, idx) => (
                                        <tr key={idx}>
                                            <td className="text-center" style={{ verticalAlign: 'middle', fontWeight: '600', color: '#64748b' }}>
                                                {idx + 1}
                                            </td>
                                            <td>
                                                <Select
                                                    options={serviceLedgerOptions}
                                                    value={detail.service_ledger ? { value: detail.service_ledger, label: ledgers.find(l => String(l.id) === String(detail.service_ledger))?.name } : null}
                                                    onChange={sel => handleServiceLedgerChange(idx, sel ? sel.value : '')}
                                                    styles={customSelectStyles}
                                                    menuPortalTarget={document.body}
                                                    menuPosition="fixed"
                                                    isSearchable
                                                    openMenuOnFocus={true}
                                                />
                                            </td>
                                            <td><Form.Control type="number" step="0.01" value={detail.rate} onChange={e => handleDetailChange(idx, 'rate', e.target.value)} /></td>
                                            <td>
                                                <Form.Control type="text" value={detail.gst_percent ? `${detail.gst_percent} %` : '0 %'} readOnly />
                                            </td>
                                            <td><Form.Control type="text" value={parseFloat(detail.gross).toFixed(2)} readOnly /></td>
                                            {currentInvoice.bill_type === 'igst' ? (
                                                <td><Form.Control type="text" value={parseFloat(detail.igst).toFixed(2)} readOnly /></td>
                                            ) : (
                                                <>
                                                    <td><Form.Control type="text" value={parseFloat(detail.cgst).toFixed(2)} readOnly /></td>
                                                    <td><Form.Control type="text" value={parseFloat(detail.sgst).toFixed(2)} readOnly /></td>
                                                </>
                                            )}
                                            <td><Form.Control type="text" value={parseFloat(detail.amount).toFixed(2)} readOnly /></td>
                                            <td className="text-center" style={{ verticalAlign: 'middle' }}>
                                                <div className="d-flex justify-content-center align-items-center gap-1">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center"
                                                        style={{ width: '28px', height: '28px', padding: '0', borderRadius: '4px', border: '1.5px solid #3b82f6', color: '#3b82f6', background: 'none' }}
                                                        title="Add new row"
                                                        onClick={addDetailRow}
                                                    >
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                                                            <line x1="12" y1="5" x2="12" y2="19"></line>
                                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                                        </svg>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center"
                                                        style={{ width: '28px', height: '28px', padding: '0', borderRadius: '4px' }}
                                                        title="Remove row"
                                                        onClick={() => removeDetailRow(idx)}
                                                        disabled={currentInvoice.details.length === 1}
                                                    >
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>

                        <Row className="mt-3 mb-1">
                            {/* Narration & Notes */}
                            <Col lg={7} md={12} className="mb-3 mb-lg-0">
                                <div className="service-section h-100 mb-0 d-flex flex-column">
                                    <div className="service-section-head">
                                        <div className="service-section-icon">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                            </svg>
                                        </div>
                                        <span>Narration & Notes</span>
                                        <div className="service-section-line"></div>
                                    </div>
                                    <textarea
                                        className="form-control"
                                        rows={3}
                                        style={{ flex: 1, resize: 'none' }}
                                        placeholder="Enter invoice notes, narration, or special instructions..."
                                        value={currentInvoice.narration || ''}
                                        onChange={e => handleInputChange('narration', e.target.value)}
                                    />
                                </div>
                            </Col>

                            {/* Invoice Summary */}
                            <Col lg={5} md={12} className="mb-0">
                                <div className="service-receipt">
                                    <div className="service-receipt-header">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                                            <line x1="6" y1="5" x2="18" y2="5"></line>
                                            <line x1="6" y1="9" x2="16" y2="9"></line>
                                            <path d="M9 5C15 5 15 13 9 13"></path>
                                            <line x1="9" y1="13" x2="17" y2="20"></line>
                                        </svg>
                                        Invoice Summary
                                    </div>

                                    <div className="service-receipt-body">
                                        {/* Subtotal */}
                                        <div className="service-receipt-row">
                                            <span className="service-receipt-key">Subtotal (excl. tax)</span>
                                            <span className="service-receipt-val">
                                                {currentInvoice.details.reduce((sum, det) => sum + (parseFloat(det.gross) || 0), 0).toFixed(2)}
                                            </span>
                                        </div>

                                        {/* CGST / IGST Ledger */}
                                        <div className="service-gst-row">
                                            <div className="service-gst-label">
                                                {currentInvoice.bill_type === 'igst' ? 'IGST' : 'CGST'} Ledger
                                            </div>
                                            <div className="service-gst-fields">
                                                <div className="service-gst-select">
                                                    <Select
                                                        options={ledgers.filter(l => (l.account_group_name && (l.account_group_name.toLowerCase().includes('tax') || l.account_group_name.toLowerCase().includes('duty') || l.account_group_name.toLowerCase().includes('duties'))) || (l.name && (l.name.toLowerCase().includes('cgst') || l.name.toLowerCase().includes('sgst') || l.name.toLowerCase().includes('igst') || l.name.toLowerCase().includes('tax')))).map(l => ({ value: l.id, label: l.name }))}
                                                        value={currentInvoice.gst_ledger_1 ? { value: currentInvoice.gst_ledger_1, label: ledgers.find(l => String(l.id) === String(currentInvoice.gst_ledger_1))?.name } : null}
                                                        onChange={sel => handleInputChange('gst_ledger_1', sel ? sel.value : '')}
                                                        styles={customSelectStyles}
                                                        menuPortalTarget={document.body}
                                                        menuPosition="fixed"
                                                        isSearchable
                                                        openMenuOnFocus={true}
                                                        placeholder="Select Ledger"
                                                    />
                                                </div>
                                                <span className="service-gst-amount">
                                                    {currentInvoice.bill_type === 'igst' ? parseFloat(currentInvoice.igst).toFixed(2) : parseFloat(currentInvoice.cgst).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* SGST Ledger */}
                                        {currentInvoice.bill_type !== 'igst' && (
                                            <div className="service-gst-row">
                                                <div className="service-gst-label">SGST Ledger</div>
                                                <div className="service-gst-fields">
                                                    <div className="service-gst-select">
                                                        <Select
                                                            options={ledgers.filter(l => (l.account_group_name && (l.account_group_name.toLowerCase().includes('tax') || l.account_group_name.toLowerCase().includes('duty') || l.account_group_name.toLowerCase().includes('duties'))) || (l.name && (l.name.toLowerCase().includes('cgst') || l.name.toLowerCase().includes('sgst') || l.name.toLowerCase().includes('igst') || l.name.toLowerCase().includes('tax')))).map(l => ({ value: l.id, label: l.name }))}
                                                            value={currentInvoice.gst_ledger_2 ? { value: currentInvoice.gst_ledger_2, label: ledgers.find(l => String(l.id) === String(currentInvoice.gst_ledger_2))?.name } : null}
                                                            onChange={sel => handleInputChange('gst_ledger_2', sel ? sel.value : '')}
                                                            styles={customSelectStyles}
                                                            menuPortalTarget={document.body}
                                                            menuPosition="fixed"
                                                            isSearchable
                                                            openMenuOnFocus={true}
                                                            placeholder="Select Ledger"
                                                        />
                                                    </div>
                                                    <span className="service-gst-amount">
                                                        {parseFloat(currentInvoice.sgst).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Other Charges */}
                                        <div className="service-receipt-row">
                                            <span className="service-receipt-key">Other Charges</span>
                                            <span className="service-receipt-val" style={{ width: '120px' }}>
                                                <Form.Control
                                                    type="number"
                                                    step="0.01"
                                                    size="sm"
                                                    className="text-end"
                                                    value={currentInvoice.other_charges}
                                                    onChange={e => handleInputChange('other_charges', e.target.value)}
                                                />
                                            </span>
                                        </div>

                                        {/* Round Off */}
                                        <div className="service-receipt-row align-items-center">
                                            <div className="d-flex align-items-center gap-2">
                                                <span className="service-receipt-key">Round Off</span>
                                                <Form.Check
                                                    type="switch"
                                                    id="auto-round-off-switch"
                                                    label={currentInvoice.auto_round_off === false ? "Off" : "Auto"}
                                                    checked={currentInvoice.auto_round_off !== false}
                                                    onChange={e => handleInputChange('auto_round_off', e.target.checked)}
                                                    style={{ fontSize: '11px', color: currentInvoice.auto_round_off === false ? '#ef4444' : '#10b981', fontWeight: '600' }}
                                                />
                                            </div>
                                            <div className="d-flex align-items-center gap-2">
                                                <span className="service-receipt-val">{parseFloat(currentInvoice.round_off || 0).toFixed(2)}</span>
                                                {currentInvoice.auto_round_off !== false && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm text-danger p-0 border-0 ms-1"
                                                        style={{ fontSize: '11px', textDecoration: 'underline' }}
                                                        onClick={() => handleInputChange('auto_round_off', false)}
                                                        title="Clear round off"
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="service-receipt-total">
                                        <span className="service-total-label">Grand Total</span>
                                        <span className="service-total-value">{parseFloat(currentInvoice.net_amount).toFixed(2)}</span>
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </Modal.Body>
                    <Modal.Footer className="py-2" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
                        <Button 
                            className="btn-universal-close" 
                            onClick={() => setShowModal(false)}
                        >
                            Close
                        </Button>
                        <Button 
                            className="btn-universal-save" 
                            type="submit"
                        >
                            {editMode ? 'Update' : 'Save'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
            
            <style dangerouslySetInnerHTML={{ __html: `
                .service-main-table th, .service-main-table td {
                    white-space: nowrap;
                    vertical-align: middle !important;
                }
                .service-table thead tr {
                    background: linear-gradient(to right, #312e81, #4f46e5);
                }
                .service-table th {
                    color: rgba(255,255,255,0.9) !important;
                    font-size: 0.72rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    padding: 10px 8px !important;
                    border: none !important;
                    white-space: nowrap;
                }
                .service-table td {
                    vertical-align: middle !important;
                }
                .service-invoice-modal .modal-dialog {
                    max-width: 95vw;
                }
                .service-search-input {
                    width: 220px;
                    min-width: 160px;
                }
                .service-table td .form-control {
                    min-width: 65px;
                }
                @media (min-width: 1200px) {
                    .service-invoice-modal .modal-dialog {
                        max-width: 1140px;
                    }
                }
                @media (max-width: 991px) {
                    .service-section {
                        min-height: 120px;
                        padding: 12px 16px;
                    }
                }
                @media (max-width: 768px) {
                    .service-main-table th, .service-main-table td {
                        padding: 8px 10px !important;
                        font-size: 0.82rem;
                    }
                    .service-table th, .service-table td {
                        padding: 6px 6px !important;
                        font-size: 0.78rem;
                    }
                    .service-receipt-header {
                        font-size: 0.8rem;
                        padding: 6px 10px;
                    }
                    .service-receipt-body {
                        padding: 6px 10px;
                    }
                    .service-receipt-total {
                        padding: 10px 14px;
                    }
                    .service-total-value {
                        font-size: 1.25rem;
                    }
                }
                @media (max-width: 576px) {
                    .service-header-actions {
                        width: 100%;
                        display: flex;
                        gap: 8px;
                    }
                    .service-search-input {
                        flex: 1;
                        min-width: 0 !important;
                        width: 100% !important;
                    }
                    .service-pagination-wrapper {
                        flex-direction: column;
                        align-items: center !important;
                        text-align: center;
                        gap: 10px !important;
                    }
                    .service-pagination-wrapper nav {
                        margin: 0 auto !important;
                    }
                    .service-invoice-modal .modal-dialog {
                        max-width: calc(100% - 12px);
                        margin: 6px auto;
                    }
                    .service-invoice-modal .modal-content {
                        border-radius: 10px;
                    }
                    .service-invoice-modal .modal-body {
                        padding: 10px 10px 6px !important;
                    }
                    .service-invoice-modal .modal-header {
                        padding: 10px 12px;
                    }
                    .service-invoice-modal .modal-header h4 {
                        font-size: 1.05rem;
                    }
                    .service-invoice-modal .modal-header p {
                        font-size: 11px !important;
                    }
                    .service-invoice-modal .modal-icon-circle {
                        width: 36px !important;
                        height: 36px !important;
                        margin-right: 8px !important;
                    }
                    .service-invoice-modal .modal-icon-circle i {
                        font-size: 1rem !important;
                    }
                    .service-invoice-modal .modal-footer {
                        padding: 8px 12px !important;
                        flex-direction: column-reverse;
                        gap: 6px;
                    }
                    .service-invoice-modal .modal-footer button {
                        width: 100%;
                        margin: 0 !important;
                    }
                    .service-gst-fields {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 4px;
                    }
                    .service-gst-amount {
                        align-self: flex-end;
                    }
                }
                .service-receipt {
                    background: #fff;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 14px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
                }
                .service-receipt-header {
                    background: linear-gradient(to right, #312e81, #4f46e5);
                    color: #fff;
                    padding: 8px 12px;
                    font-size: 0.85rem;
                    font-weight: 800;
                    letter-spacing: 0.04em;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    text-transform: uppercase;
                }
                .service-receipt-body {
                    padding: 8px 12px;
                }
                .service-receipt-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 4px 0;
                    border-bottom: 1px dashed #f1f5f9;
                    font-size: 0.83rem;
                }
                .service-receipt-row:last-child {
                    border-bottom: none;
                }
                .service-receipt-key {
                    color: #64748b;
                    font-weight: 500;
                }
                .service-receipt-val {
                    font-weight: 700;
                    color: #1e293b;
                }
                .service-gst-row {
                    margin-bottom: 6px;
                    background: #f8fafc;
                    border-radius: 8px;
                    padding: 6px 8px;
                }
                .service-gst-label {
                    font-size: 0.65rem;
                    font-weight: 700;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    margin-bottom: 5px;
                }
                .service-gst-fields {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .service-gst-select {
                    flex: 1;
                }
                .service-gst-amount {
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: #1e40af;
                    white-space: nowrap;
                    background: #dbeafe;
                    padding: 4px 8px;
                    border-radius: 6px;
                    min-width: 65px;
                    text-align: right;
                }
                .service-receipt-total {
                    background: linear-gradient(135deg, #312e81, #4338ca);
                    padding: 14px 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .service-total-label {
                    color: rgba(255,255,255,0.8);
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                }
                .service-total-value {
                    color: #fff;
                    font-size: 1.4rem;
                    font-weight: 800;
                }
                .service-section {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 14px;
                    padding: 16px 20px;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
                }
                .service-section-head {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 12px;
                }
                .service-section-icon {
                    width: 28px;
                    height: 28px;
                    background: linear-gradient(135deg, #f59e0b, #d97706);
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                }
                .service-section-icon svg {
                    width: 14px;
                    height: 14px;
                }
                .service-section-head > span {
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #1e293b;
                }
                .service-section-line {
                    flex: 1;
                    height: 1px;
                    background: linear-gradient(to right, #e2e8f0, transparent);
                }
                .service-invoice-modal .modal-body {
                    padding-bottom: 6px !important;
                }
                .service-invoice-modal .modal-footer {
                    padding-top: 8px !important;
                    padding-bottom: 8px !important;
                }
            ` }} />
        </div>
    );
};

export default ServiceInvoice;
