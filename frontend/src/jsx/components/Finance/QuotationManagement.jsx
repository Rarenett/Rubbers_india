import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import swal from 'sweetalert';
import { usePermission } from '../../../hooks/usePermission';
import * as FinanceService from '../../../services/FinanceService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import QuotationList from './QuotationList';
import QuotationForm from './QuotationForm';
import CreateButton from '../../../components/permissions/CreateButton';
import { usePageTitle } from '../../../context/TitleContext';

const QuotationManagement = ({ currentUser }) => {
    const navigate = useNavigate();
    const { can } = usePermission();

    // ── State ──────────────────────────────────────────────────────────────
    const [managementData, setManagementData] = useState([]);
    const [loading, setLoading]               = useState(false);
    const [showForm, setShowForm]             = useState(false);
    const [isEditing, setIsEditing]           = useState(false);
    const [formData, setFormData]             = useState({});
    const [searchTerm, setSearchTerm]         = useState('');

    // ── Fetch ──────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await FinanceService.getQuotations();
            const data = res?.results ? res.results : res;
            setManagementData(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error fetching sales orders:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ── Filtered list (client-side search) ─────────────────────────────────
    const filteredData = managementData.filter((item) => {
        const term = searchTerm.toLowerCase();

        return (
            (item.quotation_no || '').toLowerCase().includes(term) ||
            (item.entry_date || '').toLowerCase().includes(term) ||
            (item.customer_ledger_name || '').toLowerCase().includes(term) ||
            (item.order_type || '').toLowerCase().includes(term) ||
            String(item.total_amount || '').toLowerCase().includes(term)
        );
    });

    // ── Set title ──────────────────────────────────────────────────────────
    usePageTitle("Quotation List");

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleAddClick = () => {
        setIsEditing(false);
        setFormData({
            quotation_no: '',
            order_type: '',
            entry_date: new Date().toISOString().split('T')[0],
            gst_ledger_1: '',
            gst_ledger_2: '',
            gst_amount_1: '0.00',
            gst_amount_2: '0.00',
            total_amount: '0.00',
            is_posted: false,
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
            quotation_no: item.quotation_no || '',
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
            extra_charges: item.extra_charges || [],
            items: consolidatedItems
        });
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Date Validation Helpers
        const validateDateValue = (val, label, isRequired, disallowPast = false) => {
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

            if (disallowPast && !isEditing) {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                const todayStr = `${yyyy}-${mm}-${dd}`;
                if (datePart < todayStr) {
                    return `${label} cannot be a backdate (past date).`;
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

        // 1. Entry Date
        let dateErr = validateDateValue(formData.entry_date, 'Entry Date', true, true) || checkDOMIncomplete('entry_date', 'Entry Date');
        if (dateErr) {
            swal('Validation Error', dateErr, 'warning').then(() => {
                const el = document.querySelector('[name="entry_date"]');
                if (el) el.focus();
            });
            return;
        }

        // 1b. Order Type
        if (!formData.order_type) {
            swal('Validation Error', 'Order Type is mandatory. Please fill this column before continuing.', 'warning').then(() => {
                const trigger = document.querySelector('button[name="order_type"][data-ss-trigger], [name="order_type"]');
                if (trigger) {
                    trigger.focus();
                    if (trigger.hasAttribute('data-ss-trigger')) {
                        setTimeout(() => trigger.click(), 50);
                    }
                }
            });
            return;
        }

        // 2. Customer
        if (!formData.customer_ledger) {
            swal('Validation Error', 'Supplier Name is mandatory. Please fill this column before continuing.', 'warning').then(() => {
                const trigger = document.querySelector('button[name="customer_ledger"][data-ss-trigger], [name="customer_ledger"]');
                if (trigger) {
                    trigger.focus();
                    if (trigger.hasAttribute('data-ss-trigger')) {
                        setTimeout(() => trigger.click(), 50);
                    }
                }
            });
            return;
        }

        // 3. Vehicle No./ Dispatch Through
        if (!formData.dispatch_through || !String(formData.dispatch_through).trim()) {
            swal('Validation Error', 'Vehicle No./ Dispatch Through is mandatory. Please fill this column before continuing.', 'warning').then(() => {
                const trigger = document.querySelector('button[name="dispatch_through"][data-ss-trigger], [name="dispatch_through"]');
                if (trigger) {
                    trigger.focus();
                    if (trigger.hasAttribute('data-ss-trigger')) {
                        setTimeout(() => trigger.click(), 50);
                    }
                }
            });
            return;
        }

        // 4. Document Date
        dateErr = validateDateValue(formData.document_date, 'Document Date', false, true) || checkDOMIncomplete('document_date', 'Document Date');
        if (dateErr) {
            swal('Validation Error', dateErr, 'warning').then(() => {
                const el = document.querySelector('[name="document_date"]');
                if (el) el.focus();
            });
            return;
        }

        // Clean empty rows before submission
        const cleanedItems = (formData.items || []).filter(item => item.product);

        // Validate manufacture and expiry dates on each cleaned item / split
        for (let idx = 0; idx < cleanedItems.length; idx++) {
            const item = cleanedItems[idx];
            const splits = item.splits || [];
            if (splits.length > 0) {
                for (let sIdx = 0; sIdx < splits.length; sIdx++) {
                    const split = splits[sIdx];
                    if (split.manufacture_date) {
                        const err = validateDateValue(split.manufacture_date, `Item #${idx + 1} Mfg. Date`, false);
                        if (err) {
                            swal('Validation Error', err, 'warning');
                            return;
                        }
                    }
                    if (split.expiry_date) {
                        const err = validateDateValue(split.expiry_date, `Item #${idx + 1} Expiry Date`, false);
                        if (err) {
                            swal('Validation Error', err, 'warning');
                            return;
                        }
                    }
                }
            } else {
                if (item.manufacture_date) {
                    const err = validateDateValue(item.manufacture_date, `Item #${idx + 1} Mfg. Date`, false);
                    if (err) {
                        swal('Validation Error', err, 'warning');
                        return;
                    }
                }
                if (item.expiry_date) {
                    const err = validateDateValue(item.expiry_date, `Item #${idx + 1} Expiry Date`, false);
                    if (err) {
                        swal('Validation Error', err, 'warning');
                        return;
                    }
                }
            }
        }



        if (cleanedItems.length === 0) {
            swal('Validation Error', 'Please add at least one item.', 'warning').then(() => {
                const trigger = document.querySelector('[data-row="0"][data-col="0"] [data-ss-trigger], button[data-ss-trigger].sof-table-input');
                if (trigger) {
                    trigger.focus();
                    setTimeout(() => trigger.click(), 50);
                }
            });
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
            swal('Validation Error', 'Please ensure all items have a positive quantity and rate.', 'warning').then(() => {
                const invalidIdx = cleanedItems.findIndex(item => {
                    const splits = item.splits || [];
                    if (splits.length > 0) {
                        return splits.some(s => parseFloat(s.quantity) <= 0 || parseFloat(s.rate) <= 0);
                    }
                    return parseFloat(item.quantity) <= 0 || parseFloat(item.rate) <= 0;
                });
                if (invalidIdx !== -1) {
                    const el = document.querySelector(`[data-row="${invalidIdx}"][data-col="1"]`) ||
                               document.querySelector(`[data-row="${invalidIdx}"][data-col="2"]`);
                    if (el) el.focus();
                }
            });
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

        const payload = {
            ...formData,
            items: flattenedItems
        };

        const nullableFields = [
            'customer_ledger', 'gst_ledger_1', 'gst_ledger_2', 
            'document_date', 'entry_date'
        ];
        nullableFields.forEach(field => {
            if (payload[field] === '') {
                payload[field] = null;
            }
        });

        try {
            if (isEditing && formData.id) {
                await FinanceService.updateQuotation(formData.id, payload);
            } else {
                await FinanceService.createQuotation(payload);
            }
            setShowForm(false);
            setFormData({});
            await fetchData();
            swal(
                'Success!',
                `Quotation ${isEditing ? 'updated' : 'created'} successfully!`,
                'success'
            );
        } catch (err) {
            console.error('Error saving quotation:', err);
            const errData = err.response?.data;
            let errorMsg = 'Error saving quotation.';
            if (errData) {
                if (typeof errData === 'string') errorMsg = errData;
                else if (errData.detail) errorMsg = errData.detail;
                else if (errData.quotation_no) errorMsg = `Quotation No: ${errData.quotation_no[0]}`;
                else errorMsg = JSON.stringify(errData);
            }
            swal('Error', errorMsg, 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await swal({
            title: 'Delete Quotation?',
            text: 'This action cannot be undone and will delete the quotation and all its items.',
            icon: 'warning',
            buttons: ['Cancel', 'Delete'],
            dangerMode: true,
        });
        if (!confirmed) return;
        try {
            await FinanceService.deleteQuotation(id);
            await fetchData();
            swal('Deleted!', 'Quotation has been deleted successfully.', 'success');
        } catch (err) {
            console.error('Error deleting quotation:', err);
            const msg = err.response?.data?.detail || 'Could not delete quotation.';
            swal('Error', msg, 'error');
        }
    };

    const handleExport = (format) => {
        const columns = [
            { header: '#',             dataKey: 'index' },
            { header: 'Order No',      dataKey: 'quotation_no' },
            { header: 'Entry Date',    dataKey: 'entry_date' },
            { header: 'Customer',      dataKey: 'customer_ledger_name', formatter: (v) => v || '—' },
            { header: 'Order Type',    dataKey: 'order_type_name', formatter: (v, item) => v || item.order_type },
            { header: 'Total Amount',  dataKey: 'total_amount' }
        ];
        const dataWithIndex = filteredData.map((d, i) => ({ ...d, index: i + 1 }));
        const title = 'Quotations List';

        if (format === 'pdf')   exportToPDF(dataWithIndex, columns, 'sales_orders.pdf', title);
        else if (format === 'excel') exportToExcel(dataWithIndex, columns, 'sales_orders.xlsx');
        else if (format === 'print') printData(dataWithIndex, columns, title);
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="container-fluid">
            {/* Form vs List View Toggle */}
            <div className="row">
                <div className="col-lg-12">
                {showForm ? (
                    <div className="mt-1">
                        <QuotationForm
                            formData={formData}
                            setFormData={setFormData}
                            onSave={handleSubmit}
                            onCancel={() => setShowForm(false)}
                            isEditing={isEditing}
                        />
                    </div>
                ) : (
                    <QuotationList
                        data={filteredData}
                        loading={loading}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onExport={handleExport}
                        onAdd={handleAddClick}
                        can={can}
                    />
                )}
                </div>
            </div>
        </div>
    );
};

export default QuotationManagement;
