import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import swal from 'sweetalert';
import { usePermission } from '../../../hooks/usePermission';

import PurchaseService from '../../../services/PurchaseService';

import {
    exportToPDF,
    exportToExcel,
    printData
} from '../Assets/exportUtils';

import PurchaseReturnList from './Purchasereturnlist';
import PurchaseReturnForm from './PurchaseReturnForm';
import CreateButton from '../../../components/permissions/CreateButton';

const PurchaseReturnManagement = () => {

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

    const fetchData = useCallback(async () => {

        setLoading(true);

        try {

            const res = await PurchaseService.getPurchaseReturns();

            setManagementData(
                Array.isArray(res.data)
                    ? res.data
                    : []
            );

        } catch (error) {

            console.error(
                'Error fetching purchase returns',
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
            const res = await PurchaseService.getPurchaseReturn(item.id);
            const fullItem = res.data;
            setIsEditing(true);

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

                const nonZeroRows = rows.filter(r => (parseFloat(r.quantity) || 0) > 0 || (parseFloat(r.amount) || 0) > 0);
                const activeRows = nonZeroRows.length > 0 ? nonZeroRows : [rows[0]];

                const splits = activeRows.map(r => ({
                    id: r.id,
                    godown: r.godown ? String(r.godown) : '',
                    godownName: r.godown_name || '',
                    batch_number: r.batch_number || '',
                    expiry_date: r.expiry_date || '',
                    manufacture_date: r.manufacture_date || '',
                    per: r.per ? String(r.per) : '',
                    perName: r.per_name || '',
                    quantity: r.quantity !== undefined && r.quantity !== null ? String(r.quantity) : '',
                    rate: r.rate !== undefined && r.rate !== null ? String(r.rate) : '',
                    discount_percent: r.discount_percent !== undefined && r.discount_percent !== null ? String(r.discount_percent) : '',
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
                    product: String(prodId),
                    productName: firstRow.product_name || '',
                    per: firstRow.per ? String(firstRow.per) : '',
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
                id: fullItem.id,
                voucher_type: fullItem.voucher_type ? String(fullItem.voucher_type) : '',
                return_no: fullItem.return_no || '',
                entry_date: fullItem.entry_date || '',
                gst_type: fullItem.gst_type || 'STATE',
                supplier_ledger: fullItem.supplier_ledger ? String(fullItem.supplier_ledger) : '',
                purchase_ledger: fullItem.purchase_ledger ? String(fullItem.purchase_ledger) : '',
                supplier_invoice_no: fullItem.supplier_invoice_no || '',
                supplier_invoice_date: fullItem.supplier_invoice_date || '',
                gst_ledger_1: fullItem.gst_ledger_1 ? String(fullItem.gst_ledger_1) : '',
                gst_amount_1: fullItem.gst_amount_1 || '0.00',
                gst_ledger_2: fullItem.gst_ledger_2 ? String(fullItem.gst_ledger_2) : '',
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
            console.error('Error fetching purchase return details:', error);
            swal('Error', 'Unable to fetch purchase return details.', 'error');
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
        // const statusText = item.is_posted ? 'posted' : 'draft';
        const gstTypeText = (item.gst_type || '').toLowerCase();

        // Exact match for gst_type so "state" does NOT match "inter_state".
        // Display form replaces underscores with spaces ("inter state" / "state").
        const gstTypeDisplay = gstTypeText.replace(/_/g, ' ');
        const gstTypeMatches =
            gstTypeText === term ||
            gstTypeDisplay === term ||
            // Allow underscore queries in full, e.g. typing "inter_state"
            (term.includes('_') && gstTypeText.includes(term));

        return (
            (item.return_no || '').toLowerCase().includes(term) ||
            (item.supplier_name || '').toLowerCase().includes(term) ||
            (item.supplier_invoice_no || '').toLowerCase().includes(term) ||
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

            gst_type: 'STATE',
            voucher_type: '',

            supplier_ledger: '',
            purchase_ledger: '',

            supplier_invoice_no: '',
            supplier_invoice_date: new Date().toISOString().split('T')[0],

            gst_ledger_1: '',
            gst_amount_1: '0.00',

            gst_ledger_2: '',
            gst_amount_2: '0.00',

            total_amount: '0.00',

            narration: '',

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
            ],

            extra_charges: []
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

        if (!formData.purchase_ledger) {
            swal(
                'Validation Error',
                'Please select purchase ledger.',
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
        
        const isInterState = formData.gst_type === 'INTER_STATE';

        cleanedItems.forEach(item => {
            const splits = item.splits || [];
            if (splits.length > 0) {
                splits.forEach(split => {
                    const qty = parseFloat(split.quantity) || 0;
                    if (qty <= 0) return; // Skip empty / zero-quantity split rows
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
                        godown: split.godown || null,
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
                    godown: item.godown || null,
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
            voucher_type: toNullable(formData.voucher_type),
            return_no: formData.return_no || '',
            entry_date: toNullable(formData.entry_date),
            gst_type: formData.gst_type || 'STATE',
            supplier_ledger: toNullable(formData.supplier_ledger),
            purchase_ledger: toNullable(formData.purchase_ledger),
            supplier_invoice_no: formData.supplier_invoice_no || '',
            supplier_invoice_date: toNullable(formData.supplier_invoice_date),
            gst_ledger_1: toNullable(formData.gst_ledger_1),
            gst_amount_1: formData.gst_amount_1 || '0.00',
            gst_ledger_2: toNullable(formData.gst_ledger_2),
            gst_amount_2: formData.gst_amount_2 || '0.00',
            total_amount: formData.total_amount || '0.00',
            narration: formData.narration || '',
            // is_posted: !!formData.is_posted,
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
                await PurchaseService.updatePurchaseReturn(
                    formData.id,
                    payload
                );
            } else {
                await PurchaseService.createPurchaseReturn(
                    payload
                );
            }

            await fetchData();
            setShowForm(false);

            swal(
                'Success',
                `Purchase Return ${isEditing
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
            const errData = error.response?.data;
            let errorMsg = 'Unable to save purchase return.';
            
            if (errData && typeof errData === 'object') {
                const messages = [];
                for (const key in errData) {
                    if (Array.isArray(errData[key])) {
                        messages.push(`${key}: ${errData[key][0]}`);
                    } else if (typeof errData[key] === 'string') {
                        messages.push(`${key}: ${errData[key]}`);
                    }
                }
                if (messages.length > 0) {
                    errorMsg = messages.join('\n');
                }
            }

            console.error(
                'Error saving purchase return:',
                errData || error.message
            );
            swal(
                'Error',
                errorMsg,
                'error'
            );
        }
    };

    const handleDelete = async (id) => {

        const confirmed =
            await swal({

                title:
                    'Delete Purchase Return?',

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
                .deletePurchaseReturn(id);

            await fetchData();

            swal(
                'Deleted',
                'Purchase Return deleted successfully',
                'success'
            );

        } catch (error) {

            swal(
                'Error',
                'Unable to delete purchase return.',
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
                header: 'Supplier',
                dataKey: 'supplier_name'
            },

            {
                header: 'GST Type',
                dataKey: 'gst_type'
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
                'purchase_returns.pdf',
                'Purchase Returns'
            );

        } else if (format === 'excel') {

            exportToExcel(
                dataWithIndex,
                columns,
                'purchase_returns.xlsx'
            );

        } else if (format === 'print') {

            printData(
                dataWithIndex,
                columns,
                'Purchase Returns'
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

                            Purchase Return

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
                        'purchase-return',
                        'create'
                    ) && (

                        <CreateButton
                            module="purchase-return"
                            onClick={handleAddClick}
                        >
                            Purchase Return
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

                            <PurchaseReturnForm

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

                            <PurchaseReturnList

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

export default PurchaseReturnManagement;