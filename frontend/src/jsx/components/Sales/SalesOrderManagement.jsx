import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import swal from 'sweetalert';
import { usePermission } from '../../../hooks/usePermission';
import SalesService from '../../../services/SalesService';
import { exportToPDF, exportToExcel, printData, exportIndividualOrderPDF, exportIndividualOrderExcel, printIndividualOrder } from '../Assets/exportUtils';
import ItemMovementModal from '../Inventory/ItemMovementModal.jsx';
import SalesOrderList from './SalesOrderList';
import SalesOrderForm from './SalesOrderForm';
import CreateButton from '../../../components/permissions/CreateButton';
import { formatDateTime } from '../../../utils/dateUtils';
import { usePageTitle } from '../../../context/TitleContext';


const SalesOrderManagement = ({ currentUser }) => {
    const navigate = useNavigate();
    const { can } = usePermission();

    // ── State ──────────────────────────────────────────────────────────────
    const [managementData, setManagementData] = useState([]);
    const [loading, setLoading]               = useState(false);
    const [showForm, setShowForm]             = useState(false);
    const [showItemMovement, setShowItemMovement] = useState(false);
    const [isEditing, setIsEditing]           = useState(false);
    const [formData, setFormData]             = useState({});
    const [searchTerm, setSearchTerm]         = useState('');

    // ── Fetch ──────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await SalesService.getSalesOrders();
            setManagementData(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching sales orders:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ── Set title ──────────────────────────────────────────────────────────
    usePageTitle("Sales Order List");

    // ── Filtered list (client-side search) ─────────────────────────────────
    const filteredData = managementData.filter((item) => {
        const term = searchTerm.toLowerCase();
        
        return (
            (item.so_no || '').toLowerCase().includes(term) ||
            (item.entry_date || '').toLowerCase().includes(term) ||
            (item.customer_ledger_name || '').toLowerCase().includes(term) ||
            (item.order_type || '').toLowerCase().includes(term) ||
            (item.driver_name || '').toLowerCase().includes(term) ||
            String(item.total_amount || '').toLowerCase().includes(term) ||
            (item.preferred_delivery_date || '').toLowerCase().includes(term) ||
            formatDateTime(item.preferred_delivery_date).toLowerCase().includes(term) ||
            (item.status || '').toLowerCase().includes(term)
        );
    });

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleAddClick = () => {
        setIsEditing(false);
        setFormData({
            so_no: '',
            order_type: 'STATE',
            entry_date: new Date().toISOString().split('T')[0],
            gst_ledger_1: '',
            gst_ledger_2: '',
            gst_amount_1: '0.00',
            gst_amount_2: '0.00',
            total_amount: '0.00',
            is_posted: false,
            priority: 'Standard',
            status: 'Pending',
            driver: '',
            preferred_delivery_date: '',
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
                amount: '0.00',
                batch_number: '',
                manufacture_date: '',
                expiry_date: ''
            }]
        });
        setShowForm(true);
    };

    const handleEdit = (item) => {
        setIsEditing(true);

        const cleanZeroValue = (val) => {
            if (val === undefined || val === null || val === '') return '';
            const num = parseFloat(val);
            if (isNaN(num) || num === 0) return '';
            return val;
        };

        const groupedMap = {};
        (item.items || []).forEach(row => {
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
            let totalGrossAmt = 0;
            let totalCGST = 0;
            let totalSGST = 0;
            let totalIGST = 0;

            rows.forEach(r => {
                const qty = parseFloat(r.quantity) || 0;
                const rate = parseFloat(r.rate) || 0;
                totalQty += qty;
                totalAmt += parseFloat(r.amount) || 0;
                totalDiscountAmt += parseFloat(r.discount_amount) || 0;
                totalGrossAmt += qty * rate;
                totalCGST += parseFloat(r.cgst_amount) || 0;
                totalSGST += parseFloat(r.sgst_amount) || 0;
                totalIGST += parseFloat(r.igst_amount) || 0;
            });

            const avgRate = totalQty > 0 ? (totalGrossAmt / totalQty) : 0;

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

        setFormData({
            id: item.id,
            so_no: item.so_no || '',
            entry_date: item.entry_date || '',
            order_type: item.order_type || 'STATE',
            customer_ledger: item.customer_ledger || '',
            gst_ledger_1: item.gst_ledger_1 || '',
            gst_amount_1: item.gst_amount_1 || '0.00',
            gst_ledger_2: item.gst_ledger_2 || '',
            gst_amount_2: item.gst_amount_2 || '0.00',
            total_amount: item.total_amount || '0.00',
            narration: item.narration || '',
            is_posted: item.is_posted || false,
            other_reference: item.other_reference || '',
            terms_of_delivery: item.terms_of_delivery || '',
            dispatch_through: item.dispatch_through || '',
            document_no: item.document_no || '',
            document_date: item.document_date || '',
            delivery_location: item.delivery_location || '',
            priority: item.priority || 'Standard',
            status: item.status || 'Pending',
            driver: item.driver || '',
            preferred_delivery_date: item.preferred_delivery_date ? item.preferred_delivery_date.slice(0, 16) : '',
            extra_charges: (item.extra_charges || []).map(ec => ({
                id: ec.id,
                ledger: ec.ledger ? (typeof ec.ledger === 'object' ? String(ec.ledger.id) : String(ec.ledger)) : '',
                ledger_name: ec.ledger_name || (typeof ec.ledger === 'object' ? ec.ledger?.name : '') || '',
                ledgerName: ec.ledger_name || (typeof ec.ledger === 'object' ? ec.ledger?.name : '') || '',
                amount: ec.amount !== undefined && ec.amount !== null ? String(ec.amount) : ''
            })),
            items: consolidatedItems
        });
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const showErrorAndFocus = (msg, selector) => {
            swal('Validation Error', msg, 'warning').then(() => {
                setTimeout(() => {
                    if (selector) {
                        const el = document.querySelector(selector);
                        if (el) {
                            const trigger = el.querySelector('[data-ss-trigger]') || el;
                            trigger.focus();
                            if (trigger && trigger.hasAttribute('data-ss-trigger')) {
                                setTimeout(() => trigger.click(), 50);
                            }
                        }
                    }
                }, 100); // Wait for SweetAlert to finish its focus restoration
            });
        };

        // Date Validation Helpers
        const validateDateValue = (val, label, isRequired) => {
            if (!val) {
                if (isRequired) {
                    return `Please fill the ${label} properly in the format dd/mm/yyyy.`;
                }
                return null;
            }

            const normalizedVal = val.includes(' ') ? val.replace(' ', 'T') : val;
            const datePart = normalizedVal.split('T')[0];
            const regex = /^\d{4}-\d{2}-\d{2}$/;
            if (!regex.test(datePart)) {
                return `Please fill the ${label} properly in the format dd/mm/yyyy.`;
            }

            const [yearStr, monthStr, dayStr] = datePart.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            const day = parseInt(dayStr, 10);

            if (isNaN(year) || isNaN(month) || isNaN(day)) {
                return `Please fill the ${label} properly in the format dd/mm/yyyy.`;
            }

            if (year < 1900 || year > 2100) {
                return `Please fill the ${label} properly in the format dd/mm/yyyy.`;
            }

            const tempDate = new Date(year, month - 1, day);
            if (
                tempDate.getFullYear() !== year ||
                tempDate.getMonth() !== month - 1 ||
                tempDate.getDate() !== day
            ) {
                return `Please fill the ${label} properly in the format dd/mm/yyyy.`;
            }

            if (normalizedVal.includes('T')) {
                const timePart = normalizedVal.split('T')[1];
                const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
                if (!timePart || !timeRegex.test(timePart)) {
                    return `Please fill the ${label} properly including a valid time.`;
                }
            }

            return null;
        };

        const checkDOMIncomplete = (name, label) => {
            const el = document.querySelector(`input[name="${name}"]`);
            if (el && el.validity && el.validity.badInput) {
                return `Please fill the ${label} properly in the format dd/mm/yyyy.`;
            }
            if (name === 'preferred_delivery_date') {
                const dateEl = document.querySelector('input[name="preferred_delivery_date_date"]');
                const timeEl = document.querySelector('input[name="preferred_delivery_date_time"]');
                if ((dateEl && dateEl.validity && dateEl.validity.badInput) || 
                    (timeEl && timeEl.validity && timeEl.validity.badInput)) {
                    return `Please fill the ${label} properly in the format dd/mm/yyyy.`;
                }
            }
            return null;
        };

        // 1. Order Date
        let dateErr = validateDateValue(formData.entry_date, 'Order Date', true) || checkDOMIncomplete('entry_date', 'Order Date');
        if (dateErr) {
            showErrorAndFocus(dateErr, '[name="entry_date"]');
            return;
        }

        // 2. Customer
        if (!formData.customer_ledger) {
            showErrorAndFocus('Please select a customer.', '[name="customer_ledger"]');
            return;
        }

        // 3. Vehicle No./ Dispatch Through
        if (!formData.dispatch_through || !String(formData.dispatch_through).trim()) {
            showErrorAndFocus('Please enter Vehicle No./ Dispatch Through.', '[name="dispatch_through"]');
            return;
        }

        // 4. Document Date
        dateErr = validateDateValue(formData.document_date, 'Document Date', false) || checkDOMIncomplete('document_date', 'Document Date');
        if (dateErr) {
            showErrorAndFocus(dateErr, '[name="document_date"]');
            return;
        }

        // 5. Delivery Location
        if (!formData.delivery_location) {
            showErrorAndFocus('Please select a delivery location.', '[name="delivery_location"]');
            return;
        }

        // 6. Driver
        if (!formData.driver) {
            showErrorAndFocus('Please select a driver.', '[name="driver"]');
            return;
        }

        // 7. Delivery Date & Time
        dateErr = validateDateValue(formData.preferred_delivery_date, 'Delivery Date & Time', true) || checkDOMIncomplete('preferred_delivery_date', 'Delivery Date & Time');
        if (dateErr) {
            showErrorAndFocus(dateErr, '[name="preferred_delivery_date_date"]');
            return;
        }

        // Clean empty rows before submission
        const cleanedItems = (formData.items || []).filter(item => item.product);

        // Validate manufacture and expiry dates on each cleaned item / split
        for (let idx = 0; idx < cleanedItems.length; idx++) {
            const item = cleanedItems[idx];
            const splits = item.splits || [];
            const rowSelector = `[data-row="${idx}"][data-col="0"]`;
            if (splits.length > 0) {
                for (let sIdx = 0; sIdx < splits.length; sIdx++) {
                    const split = splits[sIdx];
                    if (split.manufacture_date) {
                        const err = validateDateValue(split.manufacture_date, `Item #${idx + 1} Mfg. Date`, false);
                        if (err) {
                            showErrorAndFocus(err, rowSelector);
                            return;
                        }
                    }
                    if (split.expiry_date) {
                        const err = validateDateValue(split.expiry_date, `Item #${idx + 1} Expiry Date`, false);
                        if (err) {
                            showErrorAndFocus(err, rowSelector);
                            return;
                        }
                    }
                }
            } else {
                if (item.manufacture_date) {
                    const err = validateDateValue(item.manufacture_date, `Item #${idx + 1} Mfg. Date`, false);
                    if (err) {
                        showErrorAndFocus(err, rowSelector);
                        return;
                    }
                }
                if (item.expiry_date) {
                    const err = validateDateValue(item.expiry_date, `Item #${idx + 1} Expiry Date`, false);
                    if (err) {
                        showErrorAndFocus(err, rowSelector);
                        return;
                    }
                }
            }
        }



        if (cleanedItems.length === 0) {
            swal('Validation Error', 'Please select atleast one item to place the order.', 'warning').then(() => {
                const container = document.querySelector('[data-row="0"][data-col="0"]');
                if (container) {
                    const trigger = container.querySelector('[data-ss-trigger]') || container;
                    if (trigger) {
                        trigger.focus();
                        if (trigger.hasAttribute('data-ss-trigger')) {
                            setTimeout(() => trigger.click(), 50);
                        }
                    }
                }
            });
            return;
        }
        
        // Validation check for quantities and rates in splits or consolidated rows
        let invalidItemIdx = -1;
        const hasInvalidItem = cleanedItems.some((item, idx) => {
            const splits = item.splits || [];
            let invalid = false;
            if (splits.length > 0) {
                invalid = splits.some(s => parseFloat(s.quantity) <= 0 || parseFloat(s.rate) <= 0);
            } else {
                invalid = parseFloat(item.quantity) <= 0 || parseFloat(item.rate) <= 0;
            }
            if (invalid && invalidItemIdx === -1) invalidItemIdx = idx;
            return invalid;
        });
        if (hasInvalidItem) {
            showErrorAndFocus('Please ensure all items have a positive quantity and rate.', `[data-row="${invalidItemIdx}"][data-col="1"]`); // focuses quantity cell roughly
            return;
        }

        const flattenedItems = [];
        const isInterState = formData.order_type === 'INTER_STATE';

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
                        quantity: split.quantity,
                        rate: split.rate,
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
                    quantity: item.quantity,
                    rate: item.rate,
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
            'customer_ledger', 'sales_ledger', 'gst_ledger_1', 'gst_ledger_2', 
            'delivery_location', 'driver', 'preferred_delivery_date', 'document_date'
        ];
        nullableFields.forEach(field => {
            if (payload[field] === '') {
                payload[field] = null;
            }
        });

        try {
            let res;
            if (isEditing && formData.id) {
                res = await SalesService.updateSalesOrder(formData.id, payload);
            } else {
                res = await SalesService.createSalesOrder(payload);
            }
            setShowForm(false);
            setFormData({});
            await fetchData();
            
            if (res && res.data && res.data.approval_status === 'Not Approved') {
                swal(
                    'Order Placed but Not Approved',
                    `This order exceeds the allowed credit limit difference. You need to pay ${res.data.rest_amount_to_pay || 0} to make this order approved.`,
                    'warning'
                );
            } else {
                swal(
                    'Success!',
                    `Sales order ${isEditing ? 'updated' : 'created'} successfully!`,
                    'success'
                );
            }
        } catch (err) {
            console.error('Error saving sales order:', err);
            const errData = err.response?.data;
            let errorMsg = 'Error saving sales order.';
            if (errData) {
                if (typeof errData === 'string') {
                    errorMsg = errData;
                } else if (errData.detail) {
                    errorMsg = errData.detail;
                } else if (errData.so_no) {
                    errorMsg = `Sales Order No: ${errData.so_no[0]}`;
                } else {
                    const messages = [];
                    for (const [key, value] of Object.entries(errData)) {
                        let formattedKey = key;
                        if (key.startsWith('item_') && key.includes('_')) {
                            const parts = key.split('_');
                            if (parts.length >= 3 && !isNaN(parts[1])) {
                                const index = parseInt(parts[1]) + 1;
                                const field = parts.slice(2).join(' ').replace(/\b\w/g, l => l.toUpperCase());
                                formattedKey = `Row ${index} ${field}`;
                            }
                        } else {
                            formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        }
                        const msgList = Array.isArray(value) ? value.join(', ') : value;
                        messages.push(`${formattedKey}: ${msgList}`);
                    }
                    errorMsg = messages.length > 0 ? messages.join('\n') : JSON.stringify(errData);
                }
            }
            swal('Error', errorMsg, 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await swal({
            title: 'Delete Sales Order?',
            text: 'This action cannot be undone and will delete the sales order and all its items.',
            icon: 'warning',
            buttons: ['Cancel', 'Delete'],
            dangerMode: true,
        });
        if (!confirmed) return;
        try {
            await SalesService.deleteSalesOrder(id);
            await fetchData();
            swal('Deleted!', 'Sales order has been deleted successfully.', 'success');
        } catch (err) {
            console.error('Error deleting sales order:', err);
            const msg = err.response?.data?.detail || 'Could not delete sales order.';
            swal('Error', msg, 'error');
        }
    };

    const handleExport = (format) => {
        const columns = [
            { header: '#',             dataKey: 'index' },
            { header: 'Order No',      dataKey: 'so_no' },
            { header: 'Order Date',    dataKey: 'entry_date' },
            { header: 'Customer',      dataKey: 'customer_ledger_name', formatter: (v) => v || '—' },
            { header: 'Order Type',    dataKey: 'order_type' },
            { header: 'Driver',        dataKey: 'driver_name', formatter: (v) => v || '—' },
            { header: 'Total Amount',  dataKey: 'total_amount' },
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
            { header: 'Status',        dataKey: 'status' }
        ];
        const dataWithIndex = filteredData.map((d, i) => ({ ...d, index: i + 1 }));
        const title = 'Sales Orders List';

        if (format === 'pdf')   exportToPDF(dataWithIndex, columns, 'sales_orders.pdf', title);
        else if (format === 'excel') exportToExcel(dataWithIndex, columns, 'sales_orders.xlsx');
        else if (format === 'print') printData(dataWithIndex, columns, title);
    };

    const handleExportIndividual = async (order, format) => {
        let fullOrder = order;
        try {
            if (!fullOrder.items || !Array.isArray(fullOrder.items) || fullOrder.items.length === 0) {
                const res = await SalesService.getSalesOrder(order.id);
                if (res && res.data) fullOrder = res.data;
            }
        } catch (err) {
            console.error('Error fetching order details for export:', err);
        }

        if (format === 'pdf') {
            exportIndividualOrderPDF(fullOrder);
        } else if (format === 'excel') {
            exportIndividualOrderExcel(fullOrder);
        } else if (format === 'print') {
            printIndividualOrder(fullOrder);
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
                        <SalesOrderForm
                            formData={formData}
                            setFormData={setFormData}
                            onSave={handleSubmit}
                            onCancel={() => setShowForm(false)}
                            isEditing={isEditing}
                        />
                    </div>
                ) : (
                    <SalesOrderList
                        data={filteredData}
                        loading={loading}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onExport={handleExport}
                        onExportIndividual={handleExportIndividual}
                        onAdd={handleAddClick}
                        onOpenItemMovement={() => setShowItemMovement(true)}
                        can={can}
                    />
                )}
                </div>
            </div>
        </div>
    );
};

export default SalesOrderManagement;