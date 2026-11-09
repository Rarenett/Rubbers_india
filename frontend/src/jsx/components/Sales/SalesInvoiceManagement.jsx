import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import swal from 'sweetalert';
import { usePermission } from '../../../hooks/usePermission';
import SalesService from '../../../services/SalesService';
import { exportToPDF, exportToExcel, printData, exportIndividualInvoicePDF, exportIndividualInvoiceExcel, printIndividualInvoice } from '../Assets/exportUtils';
import ItemMovementModal from '../Inventory/ItemMovementModal.jsx';
import SalesInvoiceList from './SalesInvoiceList';
import SalesInvoiceForm from './SalesInvoiceForm';
import CreateButton from '../../../components/permissions/CreateButton';
import { usePageTitle } from '../../../context/TitleContext';

const SalesInvoiceManagement = ({ currentUser }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { can } = usePermission();
    usePageTitle("Sales Invoice List");

    // ── State ──────────────────────────────────────────────────────────────
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const firstDayOfMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const lastDayObj = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const lastDayOfMonth = `${lastDayObj.getFullYear()}-${pad(lastDayObj.getMonth() + 1)}-${pad(lastDayObj.getDate())}`;

    const [managementData, setManagementData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [showItemMovement, setShowItemMovement] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [fromDate, setFromDate] = useState(firstDayOfMonth);
    const [toDate, setToDate] = useState(lastDayOfMonth);

    // ── Fetch ──────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await SalesService.getSalesInvoices();
            setManagementData(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching sales invoices:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEdit = useCallback(async (item) => {
        if (!item || !item.id) return;
        setLoading(true);
        try {
            let fullItem = item;
            try {
                const res = await SalesService.getSalesInvoice(item.id);
                if (res && res.data) {
                    fullItem = res.data;
                }
            } catch (err) {
                console.error('Error fetching single invoice:', err);
                swal('Not Found', 'Sales invoice details could not be found.', 'error');
                setShowForm(false);
                return;
            }

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
                    sales_order: r.sales_order || null,
                    sales_order_item: r.sales_order_item || null,
                    warehouse: r.warehouse || '',
                    warehouseName: r.warehouse_name || '',
                    batch_number: r.batch_number || '',
                    manufacture_date: r.manufacture_date || '',
                    expiry_date: r.expiry_date || '',
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
                    sales_order: firstRow.sales_order || null,
                    sales_order_item: firstRow.sales_order_item || null,
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

            setFormData({
                id: fullItem.id,
                invoice_no: fullItem.invoice_no || '',
                entry_date: fullItem.entry_date || '',
                voucher_type: fullItem.voucher_type || '', sales_ledger: fullItem.sales_ledger || '', buyer_address: fullItem.buyer_address || '', buyer_gst_no: fullItem.buyer_gst_no || '', shipping_address: fullItem.shipping_address || '', is_stock_reserved: fullItem.is_stock_reserved || false, on_hold_reason: fullItem.on_hold_reason || '',
                customer_ledger: fullItem.customer_ledger || '',
                gst_ledger_1: fullItem.gst_ledger_1 || '',
                gst_amount_1: fullItem.gst_amount_1 || '0.00',
                gst_ledger_2: fullItem.gst_ledger_2 || '',
                gst_amount_2: fullItem.gst_amount_2 || '0.00',
                total_amount: fullItem.total_amount || '0.00',
                narration: fullItem.narration || '',
                is_posted: fullItem.is_posted || false,
                priority: fullItem.priority || 'Standard',
                status: fullItem.status || 'Pending',
                preferred_delivery_date: fullItem.preferred_delivery_date ? fullItem.preferred_delivery_date.slice(0, 16) : '',
                extra_charges: (fullItem.extra_charges || []).map(ec => ({
                    id: ec.id,
                    ledger: ec.ledger ? (typeof ec.ledger === 'object' ? String(ec.ledger.id) : String(ec.ledger)) : '',
                    ledger_name: ec.ledger_name || (typeof ec.ledger === 'object' ? ec.ledger?.name : '') || '',
                    ledgerName: ec.ledger_name || (typeof ec.ledger === 'object' ? ec.ledger?.name : '') || '',
                    amount: ec.amount !== undefined && ec.amount !== null ? String(ec.amount) : ''
                })),
                items: consolidatedItems,
                sales_orders: Array.isArray(fullItem.sales_orders) ? fullItem.sales_orders.map(id => String(id)) : []
            });
            setShowForm(true);
        } catch (err) {
            console.error('Error handling edit for sales invoice:', err);
            setShowForm(false);
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
                    const rNo = String(r.invoice_no || r.voucher_no || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    return rId === String(editId) || rNo === cleanTarget || (cleanTarget && rNo.endsWith(cleanTarget)) || (cleanTarget && cleanTarget.endsWith(rNo));
                }) || { id: editId };

                if (itemToEdit) {
                    handleEdit(itemToEdit);
                }
            }
        }
    }, [loading, managementData, location.search, handleEdit]);

    // ── Filtered list (client-side search & date filter) ───────────────────
    const filteredData = managementData.filter((item) => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = (
            (item.invoice_no || '').toLowerCase().includes(term) ||
            (item.customer_ledger_name || '').toLowerCase().includes(term) ||
            (item.preferred_delivery_date || '').toLowerCase().includes(term) ||
            (item.entry_date || '').toLowerCase().includes(term) ||
            String(item.total_amount || '').toLowerCase().includes(term) ||
            (item.status || '').toLowerCase().includes(term)
        );

        let matchesDate = true;
        if (fromDate) {
            const itemDate = item.entry_date ? item.entry_date.split('T')[0] : '';
            if (!itemDate || itemDate < fromDate) {
                matchesDate = false;
            }
        }
        if (toDate) {
            const itemDate = item.entry_date ? item.entry_date.split('T')[0] : '';
            if (!itemDate || itemDate > toDate) {
                matchesDate = false;
            }
        }

        return matchesSearch && matchesDate;
    });

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleAddClick = () => {
        setIsEditing(false);
        setFormData({
            invoice_no: '',
            voucher_type: '', sales_ledger: '', buyer_address: '', buyer_gst_no: '', shipping_address: '', is_stock_reserved: false, on_hold_reason: '',
            entry_date: new Date().toISOString().split('T')[0],
            gst_ledger_1: '',
            gst_ledger_2: '',
            gst_amount_1: '0.00',
            gst_amount_2: '0.00',
            total_amount: '0.00',
            is_posted: false,
            priority: 'Standard',
            status: 'Pending',

            preferred_delivery_date: '',
            extra_charges: [],
            items: [{
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
            }]
        });
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Basic validation
        if (!formData.customer_ledger) {
            swal('Validation Error', 'Please select a customer.', 'warning');
            return;
        }

        // Clean empty rows before submission
        const cleanedItems = (formData.items || []).filter(item => item.product);

        if (cleanedItems.length === 0) {
            swal('Validation Error', 'Please add at least one item.', 'warning');
            return;
        }

        // Validation check for quantities and rates in splits or consolidated rows
        const hasInvalidItem = cleanedItems.some(item => {
            const splits = item.splits || [];
            if (splits.length > 0) {
                return splits.some(s => parseFloat(s.quantity) <= 0 || parseFloat(s.rate) <= 0);
            }
            return parseFloat(item.quantity) <= 0 || parseFloat(item.rate) <= 0;
        });
        if (hasInvalidItem) {
            swal('Validation Error', 'Please ensure all items have a positive quantity and rate.', 'warning');
            return;
        }

        const flattenedItems = [];
        const isInterState = false; // Add logic for inter-state based on ledger if needed

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
                        sales_order: split.sales_order || item.sales_order || null,
                        sales_order_item: split.sales_order_item || split.sales_order_item_id || item.sales_order_item || item.sales_order_item_id || null,
                        warehouse: split.warehouse || null,
                        batch_number: split.batch_number || null,
                        manufacture_date: split.manufacture_date || split.mfg_date || null,
                        expiry_date: split.expiry_date || null,
                        per: split.per || null,

                        quantity: split.quantity,
                        rate: split.rate,
                        discount_percent: split.discount_percent || '0.00',
                        discount_amount: disAmt.toFixed(2),
                        gst_percent: item.gst_percent || '0.00',
                        cgst_amount: cgst.toFixed(2),
                        sgst_amount: sgst.toFixed(2),
                        igst_amount: igst.toFixed(2),
                        amount: net.toFixed(2)
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
                    sales_order: item.sales_order || null,
                    sales_order_item: item.sales_order_item || item.sales_order_item_id || null,
                    warehouse: item.warehouse || null,
                    batch_number: item.batch_number || null,
                    manufacture_date: item.manufacture_date || item.mfg_date || null,
                    expiry_date: item.expiry_date || null,
                    per: item.per || null,

                    quantity: item.quantity,
                    rate: item.rate,
                    discount_percent: item.discount_percent || '0.00',
                    discount_amount: disAmt.toFixed(2),
                    gst_percent: item.gst_percent || '0.00',
                    cgst_amount: cgst.toFixed(2),
                    sgst_amount: sgst.toFixed(2),
                    igst_amount: igst.toFixed(2),
                    amount: net.toFixed(2)
                };
                if (item.id) {
                    flatItem.id = item.id;
                }
                flattenedItems.push(flatItem);
            }
        });

        const cleanedExtraCharges = (formData.extra_charges || [])
            .filter(ec => {
                const lId = typeof ec.ledger === 'object' ? ec.ledger?.id : ec.ledger;
                return lId && !isNaN(parseFloat(ec.amount)) && Math.abs(parseFloat(ec.amount)) > 0;
            })
            .map(ec => ({
                ledger: typeof ec.ledger === 'object' ? ec.ledger.id : ec.ledger,
                amount: parseFloat(ec.amount).toFixed(2),
                ...(ec.id && typeof ec.id === 'number' && ec.id < 1000000000000 ? { id: ec.id } : {})
            }));

        const payload = {
            ...formData,
            items: flattenedItems,
            extra_charges: cleanedExtraCharges
        };

        const nullableFields = [
            'voucher_type', 'sales_ledger', 'customer_ledger',
            'gst_ledger_1', 'gst_ledger_2', 'preferred_delivery_date'
        ];
        nullableFields.forEach(field => {
            if (payload[field] === '') {
                payload[field] = null;
            }
        });

        try {
            if (isEditing && formData.id) {
                await SalesService.updateSalesInvoice(formData.id, payload);
            } else {
                await SalesService.createSalesInvoice(payload);
            }
            setShowForm(false);
            setFormData({});
            await fetchData();
            swal(
                'Success!',
                `Sales order ${isEditing ? 'updated' : 'created'} successfully!`,
                'success'
            ).then(() => {
                const searchParams = new URLSearchParams(location.search);
                const returnUrl = searchParams.get('returnUrl') || location.state?.returnUrl;
                if (returnUrl) {
                    navigate(decodeURIComponent(returnUrl));
                }
            });
        } catch (err) {
            console.error('Error saving sales invoice:', err);
            const errData = err.response?.data;
            let errorMsg = 'Error saving sales invoice.';
            if (errData) {
                if (typeof errData === 'string') errorMsg = errData;
                else if (errData.detail) errorMsg = errData.detail;
                else if (errData.invoice_no) errorMsg = `Sales Invoice No: ${errData.invoice_no[0]}`;
                else errorMsg = JSON.stringify(errData);
            }
            swal('Error', errorMsg, 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await swal({
            title: 'Delete Sales Invoice?',
            text: 'This action cannot be undone and will delete the sales invoice and all its items.',
            icon: 'warning',
            buttons: ['Cancel', 'Delete'],
            dangerMode: true
        });
        if (!confirmed) return;
        try {
            await SalesService.deleteSalesInvoice(id);
            await fetchData();
            swal('Deleted!', 'Sales order has been deleted successfully.', 'success');
        } catch (err) {
            console.error('Error deleting sales invoice:', err);
            const msg = err.response?.data?.detail || 'Could not delete sales invoice.';
            swal('Error', msg, 'error');
        }
    };

    const handleExport = (format) => {
        const columns = [
            { header: '#', dataKey: 'index' },
            { header: 'Order No', dataKey: 'invoice_no' },
            { header: 'Entry Date', dataKey: 'entry_date' },
            { header: 'Customer', dataKey: 'customer_ledger_name', formatter: (v) => v || '—' },


            { header: 'Total Amount', dataKey: 'total_amount' },
            {
                header: 'Delivery Date & Time',
                dataKey: 'preferred_delivery_date',
                formatter: (v) => {
                    if (!v) return '—';
                    try {
                        const date = new Date(v);
                        if (isNaN(date.getTime())) return v;
                        const yyyy = date.getFullYear();
                        const mm = String(date.getMonth() + 1).padStart(2, '0');
                        const dd = String(date.getDate()).padStart(2, '0');
                        let hours = date.getHours();
                        const minutes = String(date.getMinutes()).padStart(2, '0');
                        const ampm = hours >= 12 ? 'PM' : 'AM';
                        hours = hours % 12;
                        hours = hours ? hours : 12;
                        return `${yyyy}-${mm}-${dd} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
                    } catch (e) {
                        return v;
                    }
                }
            },
            { header: 'Status', dataKey: 'status' }
        ];
        const dataWithIndex = filteredData.map((d, i) => ({ ...d, index: i + 1 }));
        const title = 'Sales Invoices List';

        if (format === 'pdf') exportToPDF(dataWithIndex, columns, 'sales_invoices.pdf', title);
        else if (format === 'excel') exportToExcel(dataWithIndex, columns, 'sales_invoices.xlsx');
        else if (format === 'print') printData(dataWithIndex, columns, title);
    };

    const handleExportIndividual = async (invoice, format) => {
        let fullInvoice = invoice;
        try {
            if (!fullInvoice.items || !Array.isArray(fullInvoice.items) || fullInvoice.items.length === 0) {
                const res = await SalesService.getSalesInvoice(invoice.id);
                if (res && res.data) fullInvoice = res.data;
            }
        } catch (err) {
            console.error('Error fetching invoice details for export:', err);
        }

        if (format === 'pdf') {
            exportIndividualInvoicePDF(fullInvoice);
        } else if (format === 'excel') {
            exportIndividualInvoiceExcel(fullInvoice);
        } else if (format === 'print') {
            printIndividualInvoice(fullInvoice);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="container-fluid">
            {/* Form vs List View Toggle */}
            <div className="row">
                <div className="col-lg-12">
                {showForm ? (
                    <div className="mt-1">
                        <SalesInvoiceForm
                            formData={formData}
                            setFormData={setFormData}
                            onSave={handleSubmit}
                            onCancel={() => setShowForm(false)}
                            isEditing={isEditing}
                        />
                    </div>
                ) : (
                    <SalesInvoiceList
                        data={filteredData}
                        loading={loading}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onExport={handleExport}
                        onExportIndividual={handleExportIndividual}
                        onAdd={handleAddClick}
                        can={can}
                    />
                )}
                </div>
            </div>
        </div>
    );
};

export default SalesInvoiceManagement;
