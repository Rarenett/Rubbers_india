import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import swal from 'sweetalert';
import { usePermission } from '../../../hooks/usePermission';

import PurchaseService from '../../../services/PurchaseService';

import {
    exportToPDF,
    exportToExcel,
    printData
} from '../Assets/exportUtils';

import PurchaseOrderList from './PurchaseOrderList';
import PurchaseOrderForm from './PurchaseOrderForm';
import CreateButton from '../../../components/permissions/CreateButton';

const PurchaseOrderManagement = () => {

    const navigate = useNavigate();
    const { can } = usePermission();

    const [managementData, setManagementData] = useState([]);
    const [loading, setLoading] = useState(false);

    const [showForm, setShowForm] = useState(false);
    const [showItemMovement, setShowItemMovement] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const [formData, setFormData] = useState({});
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = useCallback(async () => {

        setLoading(true);

        try {

            const res = await PurchaseService.getPurchaseOrders();

            setManagementData(
                Array.isArray(res.data)
                    ? res.data
                    : []
            );

        } catch (error) {

            console.error(
                'Error fetching purchase orders',
                error
            );

        } finally {

            setLoading(false);

        }

    }, []);

    useEffect(() => {

        fetchData();

    }, [fetchData]);

    const filteredData = managementData.filter((item) => {

        const term = searchTerm.toLowerCase().trim();
        // const statusText = item.is_posted ? 'posted' : 'draft';
        const orderTypeText = (item.order_type || '').toLowerCase();

        // Exact match for order_type so "state" does NOT match "inter_state".
        // Display form replaces underscores with spaces ("inter state" / "state").
        const orderTypeDisplay = orderTypeText.replace(/_/g, ' ');
        const orderTypeMatches =
            orderTypeText === term ||
            orderTypeDisplay === term ||
            // Allow underscore queries in full, e.g. typing "inter_state"
            (term.includes('_') && orderTypeText.includes(term));

        return (
            (item.po_no || '').toLowerCase().includes(term) ||
            (item.supplier_name || '').toLowerCase().includes(term) ||
            (item.other_reference || '').toLowerCase().includes(term) ||
            (item.entry_date || '').toLowerCase().includes(term) ||
            String(item.total_amount || '').toLowerCase().includes(term) ||
            statusText.includes(term) ||
            orderTypeMatches
        );

    });

    const handleAddClick = () => {

        setIsEditing(false);

        setFormData({

            po_no: '',

            entry_date:
                new Date()
                    .toISOString()
                    .split('T')[0],

            order_type: 'STATE',

            supplier_ledger: '',
            purchase_ledger: '',

            gst_ledger_1: '',
            gst_amount_1: '0.00',

            gst_ledger_2: '',
            gst_amount_2: '0.00',

            total_amount: '0.00',

            narration: '',

            other_reference: '',
            terms_of_delivery: '',
            dispatch_through: '',
            document_no: '',
            document_date: new Date().toISOString().split('T')[0],

            // is_posted: false,

            items: [
                {
                    product: '',
                    productName: '',

                    godown: '',
                    godownName: '',

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
            ]
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

        setFormData({
            id: item.id,
            po_no: item.po_no || '',
            entry_date: item.entry_date || '',
            order_type: item.order_type || 'STATE',
            supplier_ledger: item.supplier_ledger || '',
            purchase_ledger: item.purchase_ledger || '',
            gst_ledger_1: item.gst_ledger_1 || '',
            gst_amount_1: item.gst_amount_1 || '0.00',
            gst_ledger_2: item.gst_ledger_2 || '',
            gst_amount_2: item.gst_amount_2 || '0.00',
            total_amount: item.total_amount || '0.00',
            narration: item.narration || '',
            other_reference: item.other_reference || '',
            terms_of_delivery: item.terms_of_delivery || '',
            dispatch_through: item.dispatch_through || '',
            document_no: item.document_no || '',
            document_date: item.document_date || '',
            // is_posted: item.is_posted || false,
            items: consolidatedItems
        });

        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.supplier_ledger) {
            swal(
                'Validation Error',
                'Please select supplier.',
                'warning'
            );
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

        // Build payload explicitly instead of spreading formData verbatim.
        // Spreading formData leaks UI-only fields (e.g. productName, splits)
        // and sends '' for FK / date fields where the backend expects null,
        // which Django REST Framework rejects with a 400.
        const toNullable = (val) => (val === '' || val === undefined ? null : val);

        const payload = {
            po_no: formData.po_no || '',
            entry_date: toNullable(formData.entry_date),
            order_type: formData.prefix_config ? String(formData.prefix_config) : (formData.order_type || 'STATE'),
            supplier_ledger: toNullable(formData.supplier_ledger),
            purchase_ledger: toNullable(formData.purchase_ledger),
            gst_ledger_1: toNullable(formData.gst_ledger_1),
            gst_amount_1: formData.gst_amount_1 || '0.00',
            gst_ledger_2: toNullable(formData.gst_ledger_2),
            gst_amount_2: formData.gst_amount_2 || '0.00',
            total_amount: formData.total_amount || '0.00',
            narration: formData.narration || '',
            other_reference: formData.other_reference || '',
            terms_of_delivery: formData.terms_of_delivery || '',
            dispatch_through: formData.dispatch_through || '',
            document_no: formData.document_no || '',
            document_date: toNullable(formData.document_date),
            // is_posted: !!formData.is_posted,
            items: flattenedItems
        };

        if (isEditing && formData.id) {
            payload.id = formData.id;
        }

        try {
            if (isEditing && formData.id) {
                await PurchaseService.updatePurchaseOrder(
                    formData.id,
                    payload
                );
            } else {
                await PurchaseService.createPurchaseOrder(
                    payload
                );
            }

            await fetchData();
            setShowForm(false);

            swal(
                'Success',
                `Purchase Order ${isEditing
                    ? 'updated'
                    : 'created'
                } successfully`,
                'success'
            );
        } catch (error) {
            // error.response.data holds DRF's field-level validation errors,
            // e.g. {"document_date": ["This field may not be blank."]}.
            // Logging it (instead of just `error`) is what actually tells you
            // which field caused the 400.
            console.error(
                'Error saving purchase order:',
                error.response ? error.response.data : error
            );
            const errorMsg = error.response && error.response.data ? JSON.stringify(error.response.data) : 'Unable to save purchase order.';
            swal(
                'Backend Validation Error',
                errorMsg,
                'error'
            );
        }
    };

    const handleDelete = async (id) => {

        const confirmed =
            await swal({

                title:
                    'Delete Purchase Order?',

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

            await PurchaseService
                .deletePurchaseOrder(id);

            await fetchData();

            swal(
                'Deleted',
                'Purchase Order deleted successfully',
                'success'
            );

        } catch (error) {

            swal(
                'Error',
                'Unable to delete purchase order.',
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
                header: 'PO No',
                dataKey: 'po_no'
            },

            {
                header: 'Date',
                dataKey: 'entry_date'
            },

            {
                header: 'Supplier',
                dataKey: 'supplier_name'
            },

            {
                header: 'Order Type',
                dataKey: 'order_type'
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
                'purchase_orders.pdf',
                'Purchase Orders'
            );

        } else if (format === 'excel') {

            exportToExcel(
                dataWithIndex,
                columns,
                'purchase_orders.xlsx'
            );

        } else if (format === 'print') {

            printData(
                dataWithIndex,
                columns,
                'Purchase Orders'
            );

        }
    };

    return (
        <div className="container-fluid">

            {/* {!showForm && (
                <div
                    className="fd-hero-card"
                    style={{
                        padding:
                            '1.5rem 2.5rem'
                    }}
                >

                    <div className="fd-hero-content">

                        <div className="d-flex align-items-center mb-2">

                          

                            <h1>

                                Purchase Order

                                <span>

                                    {
                                        showForm
                                            ? (
                                                isEditing
                                                    ? ' Edit'
                                                    : ' Create'
                                            )
                                            : ' Management'
                                    }

                                </span>

                            </h1>

                        </div>

                    </div>

                    {

                        !showForm &&
                        can(
                            'purchase-order',
                            'create'
                        ) && (

                            <CreateButton
                                module="purchase-order"
                                onClick={handleAddClick}
                            >
                                Purchase Order
                            </CreateButton>

                        )

                    }

                </div>
            )} */}
            <div className="row">
                <div className="col-lg-12">

                {

                    showForm
                        ? (

                            <PurchaseOrderForm

                                formData={formData}

                                setFormData={setFormData}

                                onSave={handleSubmit}

                                onCancel={() =>
                                    setShowForm(false)
                                }

                                isEditing={isEditing}

                            />

                        )
                        : (

                            <PurchaseOrderList

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

                        )

                }
                </div>
            </div>
        </div>

    );
};

export default PurchaseOrderManagement;