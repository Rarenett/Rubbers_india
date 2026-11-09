import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import swal from 'sweetalert';
import { usePermission } from '../../../hooks/usePermission';

import SalesService from '../../../services/SalesService';
import { fetchPrefixConfigurations } from '../../../services/PrefixService';

import {
    exportToPDF,
    exportToExcel,
    printData
} from '../Assets/exportUtils';

import SalesReturnList from './Salesreturnlist';
import SalesReturnForm from './SalesReturnForm';

const SalesReturnManagement = () => {

    const navigate = useNavigate();
    const location = useLocation();
    const { can } = usePermission();

    const [managementData, setManagementData] = useState([]);
    const [loading, setLoading] = useState(false);

    const [showForm, setShowForm] = useState(false);
    const [showItemMovement, setShowItemMovement] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const [formData, setFormData] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [prefixConfigs, setPrefixConfigs] = useState([]);

    useEffect(() => {
        const loadPrefixConfigs = async () => {
            try {
                const configs = await fetchPrefixConfigurations();
                setPrefixConfigs(Array.isArray(configs) ? configs : []);
            } catch (err) {
                console.error('Error fetching prefix configs:', err);
            }
        };
        loadPrefixConfigs();
    }, []);

    const fetchData = useCallback(async () => {

        setLoading(true);

        try {

            const res = await SalesService.getSalesReturns();

            setManagementData(
                Array.isArray(res.data)
                    ? res.data
                    : []
            );

        } catch (error) {

            console.error(
                'Error fetching sales returns',
                error
            );

        } finally {

            setLoading(false);

        }

    }, []);

    useEffect(() => {

        fetchData();

    }, [fetchData]);

    const handleEdit = useCallback(async (item) => {
        setLoading(true);
        try {
            const res = await SalesService.getSalesReturn(item.id);
            const fullItem = res.data;
            setIsEditing(true);

            const cleanZeroValue = (val) => {
                if (val === undefined || val === null || val === '') return '';
                const num = parseFloat(val);
                if (isNaN(num) || num === 0) return '';
                return val;
            };

            const groupedMap = {};
            (fullItem.items || []).forEach(row => {
                const prodId = row.product;
                if (!prodId) return;
                if (!groupedMap[prodId]) {
                    groupedMap[prodId] = [];
                }
                groupedMap[prodId].push(row);
            });

            const consolidatedItems = Object.keys(groupedMap).map(prodId => {
                const rows = groupedMap[prodId];
                const firstRow = rows[0];

                const splits = rows.map(r => ({
                    id: r.id,
                    warehouse: r.warehouse || '',
                    warehouseName: r.warehouse_name || '',
                    batch_number: r.batch_number || '',
                    expiry_date: r.expiry_date || '',
                    manufacture_date: r.manufacture_date || '',
                    per: r.per || '',
                    perName: r.per_name || '',
                    quantity: cleanZeroValue(r.quantity),
                    rate: cleanZeroValue(r.rate),
                    discount_percent: cleanZeroValue(r.discount_percent),
                    discount_amount: r.discount_amount || '0.00',
                    amount: r.amount || '0.00'
                }));

                let totalQty = 0;
                let totalAmt = 0;
                let totalDiscountAmt = 0;
                let totalCGST = 0;
                let totalSGST = 0;
                let totalIGST = 0;

                rows.forEach(r => {
                    totalQty += parseFloat(r.quantity) || 0;
                    totalAmt += parseFloat(r.amount) || 0;
                    totalDiscountAmt += parseFloat(r.discount_amount) || 0;
                    totalCGST += parseFloat(r.cgst_amount) || 0;
                    totalSGST += parseFloat(r.sgst_amount) || 0;
                    totalIGST += parseFloat(r.igst_amount) || 0;
                });

                const avgRate = totalQty > 0 ? (totalAmt / totalQty) : 0;

                return {
                    product: prodId,
                    productName: firstRow.product_name || '',
                    per: firstRow.per || '',
                    perName: firstRow.per_name || '',
                    gst_percent: firstRow.gst_percent || '0.00',
                    quantity: totalQty.toFixed(2),
                    rate: avgRate.toFixed(2),
                    discount_percent: firstRow.discount_percent || '0.00',
                    discount_amount: totalDiscountAmt.toFixed(2),
                    cgst_amount: totalCGST.toFixed(2),
                    sgst_amount: totalSGST.toFixed(2),
                    igst_amount: totalIGST.toFixed(2),
                    amount: totalAmt.toFixed(2),
                    splits: splits
                };
            });

            const matchedPrefix = (prefixConfigs || []).find(p => 
                String(p.id) === String(fullItem.voucher_type) ||
                (p.subvoucher_type_name && p.subvoucher_type_name.toLowerCase() === String(fullItem.voucher_type || '').toLowerCase()) ||
                (p.sub_type && p.sub_type.toLowerCase() === String(fullItem.voucher_type || '').toLowerCase())
            );

            setFormData({
                id: fullItem.id,
                voucher_type: matchedPrefix ? String(matchedPrefix.id) : (fullItem.voucher_type || ''),
                return_no: fullItem.return_no || '',
                entry_date: fullItem.entry_date || '',
                return_type: fullItem.return_type || 'STATE',
                customer_ledger: fullItem.customer_ledger || '',
                sales_ledger: fullItem.sales_ledger || '',
                sales_invoice_no: fullItem.sales_invoice_no || '',
                sales_invoice_date: fullItem.sales_invoice_date || '',
                gst_ledger_1: fullItem.gst_ledger_1 || '',
                gst_amount_1: fullItem.gst_amount_1 || '0.00',
                gst_ledger_2: fullItem.gst_ledger_2 || '',
                gst_amount_2: fullItem.gst_amount_2 || '0.00',
                total_amount: fullItem.total_amount || '0.00',
                narration: fullItem.narration || '',
                is_posted: fullItem.is_posted || false,
                items: consolidatedItems,
                extra_charges: (fullItem.extra_charges || []).map(ec => ({
                    ledger: String(ec.ledger),
                    ledgerName: ec.ledger_name || '',
                    amount: ec.amount || ''
                }))
            });

            setShowForm(true);
        } catch (error) {
            console.error('Error fetching sales return details:', error);
            swal('Error', 'Unable to fetch sales return details.', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!loading && managementData.length > 0) {
            const searchParams = new URLSearchParams(location.search);
            const editId = searchParams.get('edit');
            if (editId) {
                const cleanTarget = String(editId).toLowerCase().replace(/[^a-z0-9]/g, '');
                const itemToEdit = managementData.find(r => {
                    const rId = String(r.id);
                    const rNo = String(r.return_no || r.voucher_no || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    return rId === String(editId) || rNo === cleanTarget || (cleanTarget && rNo.endsWith(cleanTarget));
                });
                if (itemToEdit) {
                    handleEdit(itemToEdit);
                }
            }
        }
    }, [loading, managementData, location.search, handleEdit]);

    const filteredData = managementData.filter((item) => {

        const term = searchTerm.toLowerCase().trim();
        const statusText = item.is_posted ? 'posted' : 'draft';
        const gstTypeText = (item.return_type || '').toLowerCase();

        const gstTypeDisplay = gstTypeText.replace(/_/g, ' ');
        const gstTypeMatches =
            gstTypeText === term ||
            gstTypeDisplay === term ||
            (term.includes('_') && gstTypeText.includes(term));

        return (
            (item.return_no || '').toLowerCase().includes(term) ||
            (item.customer_ledger_name || '').toLowerCase().includes(term) ||
            (item.sales_invoice_no || '').toLowerCase().includes(term) ||
            (item.entry_date || '').toLowerCase().includes(term) ||
            String(item.total_amount || '').toLowerCase().includes(term) ||
            statusText.includes(term) ||
            gstTypeMatches
        );

    });

    const handleAddClick = () => {

        setIsEditing(false);

        setFormData({

            return_no: '',

            entry_date:
                new Date()
                    .toISOString()
                    .split('T')[0],

            return_type: 'STATE',
            voucher_type: '',

            customer_ledger: '',
            sales_ledger: '',

            sales_invoice_no: '',
            sales_invoice_date: new Date().toISOString().split('T')[0],

            gst_ledger_1: '',
            gst_amount_1: '0.00',

            gst_ledger_2: '',
            gst_amount_2: '0.00',

            total_amount: '0.00',

            narration: '',

            is_posted: false,

            items: [
                {
                    product: '',
                    productName: '',

                    warehouse: '',
                    warehouseName: '',

                    quantity: '',
                    rate: '',

                    discount_percent: '',
                    discount_amount: '0.00',

                    gst_percent: '0.00',

                    cgst_amount: '0.00',
                    sgst_amount: '0.00',
                    igst_amount: '0.00',

                    amount: '0.00'
                }
            ],

            extra_charges: []
        });

        setShowForm(true);
    };

    // ── helper: scroll to and focus a form field (by data-field) after a validation popup is dismissed ──
    const focusFormField = (fieldName) => {
        setTimeout(() => {
            const wrapper = document.querySelector(`[data-field="${fieldName}"]`);
            if (!wrapper) return;
            wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const target = wrapper.querySelector('[data-ss-trigger]') || wrapper.querySelector('input, select, textarea');
            target?.focus();
        }, 100);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.customer_ledger) {
            swal(
                'Validation Error',
                'Please select customer.',
                'warning'
            ).then(() => focusFormField('customer_ledger'));
            return;
        }

        if (!formData.sales_ledger) {
            swal(
                'Validation Error',
                'Please select sales ledger.',
                'warning'
            ).then(() => focusFormField('sales_ledger'));
            return;
        }


        const isInterState = formData.return_type === 'INTER_STATE';
        if (!formData.gst_ledger_1) {
            swal(
                'Validation Error',
                `Please select ${isInterState ? 'IGST' : 'CGST'} ledger.`,
                'warning'
            ).then(() => focusFormField('gst_ledger_1'));
            return;
        }

        const cleanedItems = (formData.items || []).filter(item => item.product);

        if (cleanedItems.length === 0) {
            swal(
                'Validation Error',
                'Please add at least one item.',
                'warning'
            );
            return;
        }

        const flattenedItems = [];

        cleanedItems.forEach(item => {
            const splits = item.splits || [];
            if (splits.length > 0) {
                splits.forEach(split => {
                    const qty = parseFloat(split.quantity) || 0;
                    const rate = parseFloat(split.rate) || 0;
                    const disc = parseFloat(split.discount_percent) || 0;
                    const base = qty * rate;
                    const disAmt = (base * disc) / 100;
                    const net = base - disAmt;
                    const gstPct = parseFloat(item.gst_percent) || 0;
                    const totalGst = (net * gstPct) / 100;
                    const cgst = isInterState ? 0 : totalGst / 2;
                    const sgst = isInterState ? 0 : totalGst / 2;
                    const igst = isInterState ? totalGst : 0;

                    const flatItem = {
                        product: item.product,
                        warehouse: split.warehouse || null,
                        per: split.per || null,
                        quantity: split.quantity || '0.00',
                        rate: split.rate || '0.00',
                        discount_percent: split.discount_percent || '0.00',
                        discount_amount: disAmt.toFixed(2),
                        gst_percent: item.gst_percent || '0.00',
                        cgst_amount: cgst.toFixed(2),
                        sgst_amount: sgst.toFixed(2),
                        igst_amount: igst.toFixed(2),
                        amount: net.toFixed(2),
                        batch_number: split.batch_number || '',
                        manufacture_date: split.manufacture_date || null,
                        expiry_date: split.expiry_date || null
                    };
                    if (split.id) {
                        flatItem.id = split.id;
                    }
                    flattenedItems.push(flatItem);
                });
            } else {
                const qty = parseFloat(item.quantity) || 0;
                const rate = parseFloat(item.rate) || 0;
                const disc = parseFloat(item.discount_percent) || 0;
                const base = qty * rate;
                const disAmt = (base * disc) / 100;
                const net = base - disAmt;
                const gstPct = parseFloat(item.gst_percent) || 0;
                const totalGst = (net * gstPct) / 100;
                const cgst = isInterState ? 0 : totalGst / 2;
                const sgst = isInterState ? 0 : totalGst / 2;
                const igst = isInterState ? totalGst : 0;

                const flatItem = {
                    product: item.product,
                    warehouse: item.warehouse || null,
                    per: item.per || null,
                    quantity: item.quantity || '0.00',
                    rate: item.rate || '0.00',
                    discount_percent: item.discount_percent || '0.00',
                    discount_amount: disAmt.toFixed(2),
                    gst_percent: item.gst_percent || '0.00',
                    cgst_amount: cgst.toFixed(2),
                    sgst_amount: sgst.toFixed(2),
                    igst_amount: igst.toFixed(2),
                    amount: net.toFixed(2),
                    batch_number: item.batch_number || '',
                    manufacture_date: item.manufacture_date || null,
                    expiry_date: item.expiry_date || null
                };
                if (item.id) {
                    flatItem.id = item.id;
                }
                flattenedItems.push(flatItem);
            }
        });

        const toNullable = (val) => (val === '' || val === undefined ? null : val);
        const matchedConfig = (prefixConfigs || []).find(p => 
            String(p.id) === String(formData.voucher_type) || 
            (p.subvoucher_type_name && p.subvoucher_type_name.toLowerCase() === String(formData.voucher_type || '').toLowerCase()) ||
            (p.sub_type && p.sub_type.toLowerCase() === String(formData.voucher_type || '').toLowerCase())
        );
        const resolvedVoucherType = matchedConfig 
            ? (matchedConfig.subvoucher_type_name || matchedConfig.sub_type || matchedConfig.voucher_type_name || 'Sales Return B2B') 
            : (formData.voucher_type || 'Sales Return B2B');

        const payload = {
            voucher_type: resolvedVoucherType,
            prefix_config_id: matchedConfig ? matchedConfig.id : toNullable(formData.voucher_type),
            return_no: formData.return_no || '',
            entry_date: toNullable(formData.entry_date),
            return_type: formData.return_type || 'STATE',
            customer_ledger: toNullable(formData.customer_ledger),
            sales_ledger: toNullable(formData.sales_ledger),
            sales_invoice_no: formData.sales_invoice_no || '',
            sales_invoice_date: toNullable(formData.sales_invoice_date),
            gst_ledger_1: toNullable(formData.gst_ledger_1),
            gst_amount_1: formData.gst_amount_1 || '0.00',
            gst_ledger_2: toNullable(formData.gst_ledger_2),
            gst_amount_2: formData.gst_amount_2 || '0.00',
            total_amount: formData.total_amount || '0.00',
            narration: formData.narration || '',
            is_posted: !!formData.is_posted,
            items: flattenedItems,
            extra_charges: (formData.extra_charges || [])
                .filter(ec => ec.ledger && ec.amount)
                .map(ec => ({ ledger: ec.ledger, amount: ec.amount }))
        };

        if (isEditing && formData.id) {
            payload.id = formData.id;
        }

        try {
            if (isEditing && formData.id) {
                await SalesService.updateSalesReturn(
                    formData.id,
                    payload
                );
            } else {
                await SalesService.createSalesReturn(
                    payload
                );
            }

            await fetchData();
            setShowForm(false);

            swal(
                'Success',
                `Sales Return ${isEditing
                    ? 'updated'
                    : 'created'
                } successfully`,
                'success'
            ).then(() => {
                const searchParams = new URLSearchParams(location.search);
                const returnUrl = searchParams.get('returnUrl') || location.state?.returnUrl;
                if (returnUrl) {
                    navigate(decodeURIComponent(returnUrl));
                }
            });
        } catch (error) {
            console.error(
                'Error saving sales return:',
                error.response?.data || error.message
            );
            swal(
                'Error',
                'Unable to save sales return.',
                'error'
            );
        }
    };

    const handleDelete = async (id) => {

        const confirmed =
            await swal({

                title:
                    'Delete Sales Return?',

                text:
                    'This action cannot be undone.',

                icon:
                    'warning',

                buttons:
                    ['Cancel', 'Delete'],

                dangerMode:
                    true

            });

        if (!confirmed)
            return;

        try {

            await SalesService
                .deleteSalesReturn(id);

            await fetchData();

            swal(
                'Deleted',
                'Sales Return deleted successfully',
                'success'
            );

        } catch (error) {

            swal(
                'Error',
                'Unable to delete sales return.',
                'error'
            );

        }
    };

    const handleExport = (format) => {

        const columns = [

            {
                header: '#',
                dataKey: 'index'
            },

            {
                header: 'Return No',
                dataKey: 'return_no'
            },

            {
                header: 'Date',
                dataKey: 'entry_date'
            },

            {
                header: 'Customer',
                dataKey: 'customer_ledger_name'
            },

            {
                header: 'GST Type',
                dataKey: 'return_type'
            },

            {
                header: 'Total Amount',
                dataKey: 'total_amount'
            }

        ];

        const dataWithIndex =
            filteredData.map(
                (item, index) => ({
                    ...item,
                    index: index + 1
                })
            );

        if (format === 'pdf') {

            exportToPDF(
                dataWithIndex,
                columns,
                'sales_returns.pdf',
                'Sales Returns'
            );

        } else if (format === 'excel') {

            exportToExcel(
                dataWithIndex,
                columns,
                'sales_returns.xlsx'
            );

        } else if (format === 'print') {

            printData(
                dataWithIndex,
                columns,
                'Sales Returns'
            );

        }
    };

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-lg-12">
                    {showForm ? (
                        <div className="mt-1">
                            <SalesReturnForm
                                formData={formData}
                                setFormData={setFormData}
                                onSave={handleSubmit}
                                onCancel={() => setShowForm(false)}
                                isEditing={isEditing}
                            />
                        </div>
                    ) : (
                        <SalesReturnList
                            data={filteredData}
                            loading={loading}
                            searchTerm={searchTerm}
                            onSearchChange={setSearchTerm}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onExport={handleExport}
                            onOpenItemMovement={() => setShowItemMovement(true)}
                            onAdd={handleAddClick}
                            can={can}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default SalesReturnManagement;

