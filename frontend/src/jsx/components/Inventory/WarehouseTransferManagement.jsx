import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card } from 'react-bootstrap';
import swal from 'sweetalert';
import { usePermission } from '../../../hooks/usePermission';
import { getWarehouseTransfers, createWarehouseTransfer, updateWarehouseTransfer, deleteWarehouseTransfer } from '../../../services/InventoryService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import '../Assets/FileDashboard.css';
import WarehouseTransferList from './WarehouseTransferList';
import ItemMovementModal from './ItemMovementModal';
import WarehouseTransferForm from './WarehouseTransferForm';
import CreateButton from '../../../components/permissions/CreateButton';
import { formatDate } from '../../../utils/dateUtils';

const WarehouseTransferManagement = ({ currentUser }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { can } = usePermission();

    const [managementData, setManagementData] = useState([]);
    const [loading, setLoading]               = useState(false);
    const [showForm, setShowForm]             = useState(false);
    const [showItemMovement, setShowItemMovement] = useState(false);
    const [isEditing, setIsEditing]           = useState(false);
    const [formData, setFormData]             = useState({});
    const [searchTerm, setSearchTerm]         = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getWarehouseTransfers();
            setManagementData(Array.isArray(res) ? res : []);
        } catch (err) {
            console.error('Error fetching warehouse transfers:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEdit = useCallback((item) => {
        setIsEditing(true);
        
        // Ensure data is structured correctly for the form
        const editData = {
            id: item.id,
            wt_no: item.wt_no,
            entry_date: item.entry_date,
            destination_warehouse: item.destination_warehouse,
            narration: item.narration,
            items: item.items.map(row => ({
                id: row.id,
                item: row.item,
                item_name: row.item_name,
                splits: row.splits && row.splits.length > 0 ? row.splits.map(split => ({
                    id: split.id,
                    source_warehouse: split.source_warehouse,
                    batch_number: split.batch_number || '',
                    manufacture_date: split.manufacture_date || '',
                    expiry_date: split.expiry_date || '',
                    quantity: split.quantity || '',
                    rate: split.rate || '',
                    amount: split.amount || '0.00'
                })) : [{
                    source_warehouse: '',
                    batch_number: '',
                    manufacture_date: '',
                    expiry_date: '',
                    quantity: '',
                    rate: '',
                    amount: '0.00'
                }]
            }))
        };

        if(editData.items.length === 0) {
            editData.items = [{
                item: '',
                item_name: '',
                splits: [{
                    source_warehouse: '',
                    batch_number: '',
                    manufacture_date: '',
                    expiry_date: '',
                    quantity: '',
                    rate: '',
                    amount: '0.00'
                }]
            }];
        }

        setFormData(editData);
        setShowForm(true);
    }, []);

    useEffect(() => {
        if (!loading && managementData.length > 0) {
            const searchParams = new URLSearchParams(location.search);
            const editId = searchParams.get('edit');
            if (editId) {
                const cleanTarget = String(editId).toLowerCase().replace(/[^a-z0-9]/g, '');
                const targetItem = managementData.find(r => {
                    const rId = String(r.id);
                    const rNo = String(r.wt_no || r.voucher_no || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    return rId === String(editId) || rNo === cleanTarget || (cleanTarget && rNo.endsWith(cleanTarget));
                });
                if (targetItem) {
                    handleEdit(targetItem);
                }
            }
        }
    }, [loading, managementData, location.search, handleEdit]);

    const filteredData = managementData.filter((item) => {
        const term = searchTerm.toLowerCase();
        return (
            (item.wt_no || '').toLowerCase().includes(term) ||
            (item.entry_date || '').toLowerCase().includes(term) ||
            (item.destination_warehouse_name || '').toLowerCase().includes(term) ||
            (item.narration || '').toLowerCase().includes(term)
        );
    });

    const handleAddClick = () => {
        setIsEditing(false);
        setFormData({
            wt_no: 'AUTO',
            entry_date: new Date().toISOString().split('T')[0],
            destination_warehouse: '',
            narration: '',
            items: [{
                item: '',
                item_name: '',
                splits: [{
                    source_warehouse: '',
                    batch_number: '',
                    manufacture_date: '',
                    expiry_date: '',
                    quantity: '',
                    rate: '',
                    amount: '0.00'
                }]
            }]
        });
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        swal({
            title: "Are you sure?",
            text: "Once deleted, you will not be able to recover this warehouse transfer!",
            icon: "warning",
            buttons: true,
            dangerMode: true,
        }).then(async (willDelete) => {
            if (willDelete) {
                try {
                    await deleteWarehouseTransfer(id);
                    swal("Deleted!", "Warehouse transfer has been deleted.", "success");
                    fetchData();
                } catch (error) {
                    swal("Error", "Could not delete warehouse transfer.", "error");
                }
            }
        });
    };

    const handleSubmit = async (dataToSubmit) => {
        try {
            if (isEditing) {
                await updateWarehouseTransfer(dataToSubmit.id, dataToSubmit);
                swal('Success', 'Warehouse transfer updated successfully', 'success').then(() => {
                    const searchParams = new URLSearchParams(location.search);
                    const returnUrl = searchParams.get('returnUrl') || location.state?.returnUrl;
                    if (returnUrl) {
                        navigate(decodeURIComponent(returnUrl));
                    }
                });
            } else {
                await createWarehouseTransfer(dataToSubmit);
                swal('Success', 'Warehouse transfer created successfully', 'success').then(() => {
                    const searchParams = new URLSearchParams(location.search);
                    const returnUrl = searchParams.get('returnUrl') || location.state?.returnUrl;
                    if (returnUrl) {
                        navigate(decodeURIComponent(returnUrl));
                    }
                });
            }
            setShowForm(false);
            fetchData();
        } catch (error) {
            swal('Error', error?.response?.data?.detail || 'An error occurred while saving the transfer', 'error');
        }
    };

    const handleExport = (type) => {
        const columns = [
            { header: 'WT No', dataKey: 'wt_no' },
            { header: 'Entry Date', dataKey: 'entry_date' },
            { header: 'Source Warehouse', dataKey: 'source_warehouse' },
            { header: 'Destination Warehouse', dataKey: 'destination_warehouse_name' },
            { header: 'Item Name', dataKey: 'item_name' },
            { header: 'Quantity', dataKey: 'quantity' },
            { header: 'Narration', dataKey: 'narration' }
        ];

        const flatData = [];
        filteredData.forEach((d) => {
            if (d.items && d.items.length > 0) {
                d.items.forEach(item => {
                    if (item.splits && item.splits.length > 0) {
                        item.splits.forEach(split => {
                            flatData.push({
                                ...d,
                                item_name: item.item_name,
                                quantity: parseFloat(split.quantity || 0),
                                source_warehouse: split.source_warehouse_name || 'Unknown',
                                narration: d.narration || '-'
                            });
                        });
                    } else {
                        flatData.push({
                            ...d,
                            item_name: item.item_name,
                            quantity: 0,
                            source_warehouse: 'Unknown',
                            narration: d.narration || '-'
                        });
                    }
                });
            } else {
                flatData.push({
                    ...d,
                    item_name: '-',
                    quantity: '-',
                    source_warehouse: '-',
                    narration: d.narration || '-'
                });
            }
        });

        const title = 'Warehouse Transfers - Detailed Report';

        const generateHTML = (data) => {
            let html = `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333;">
                    <h1 style="color: #333; margin-bottom: 5px; font-size: 24px;">${title}</h1>
                    <div style="color: #888; font-size: 0.9rem; margin-bottom: 30px; border-bottom: 2px solid #00d1ff; padding-bottom: 10px;">Generated on: ${formatDate(new Date())}</div>
            `;
            
            data.forEach(transfer => {
                html += `
                    <div style="margin-bottom: 25px; border: 1px solid #eee; padding: 15px; border-radius: 8px; break-inside: avoid; page-break-inside: avoid;">
                        <div style="font-size: 1.2rem; font-weight: bold; color: #00d1ff; margin-bottom: 10px;">Transfer No: ${transfer.wt_no}</div>
                        <div style="margin-bottom: 10px; color: #555;">
                            <strong>Date:</strong> ${formatDate(transfer.entry_date)} &nbsp;|&nbsp; 
                            <strong>Destination:</strong> ${transfer.destination_warehouse_name} &nbsp;|&nbsp;
                            <strong>Narration:</strong> ${transfer.narration || '-'}
                        </div>
                        <div style="font-weight: bold; margin-bottom: 5px;">Items Transferred:</div>
                        <ul style="margin-top: 0;">
                `;
                if (transfer.items && transfer.items.length > 0) {
                    transfer.items.forEach(item => {
                        if (item.splits && item.splits.length > 0) {
                            const totalQty = item.splits.reduce((sum, s) => sum + parseFloat(s.quantity || 0), 0);
                            const totalAmt = item.splits.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
                            html += `<li><strong>${item.item_name}</strong> (Total Qty: ${totalQty}, Total Value: &#8377;${totalAmt.toFixed(2)})<ul style="margin-top: 5px; margin-bottom: 10px;">`;
                            item.splits.forEach(split => {
                                const qty = parseFloat(split.quantity || 0);
                                const rate = parseFloat(split.rate || 0);
                                const amount = parseFloat(split.amount || 0);
                                const source = split.source_warehouse_name || 'Unknown';
                                html += `<li style="color: #444;">Source: ${source} &mdash; Qty: ${qty} @ &#8377;${rate.toFixed(2)} = &#8377;${amount.toFixed(2)}</li>`;
                            });
                            html += `</ul></li>`;
                        } else {
                            html += `<li><strong>${item.item_name}</strong> (Qty: 0)</li>`;
                        }
                    });
                } else {
                    html += `<li>No items</li>`;
                }
                html += `
                        </ul>
                    </div>
                `;
            });
            html += `</div>`;
            return html;
        };

        if (type === 'excel') {
            exportToExcel(flatData, columns, 'warehouse_transfers.xlsx');
        } else if (type === 'print') {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                    <head>
                        <title>${title}</title>
                        <style>
                            @media print {
                                @page { margin: 0; }
                                body { margin: 1.6cm; }
                            }
                        </style>
                    </head>
                    <body>
                        ${generateHTML(filteredData)}
                        <script>
                            window.onload = () => { window.print(); window.onafterprint = () => window.close(); };
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        } else if (type === 'pdf') {
            exportToPDF(
                filteredData,
                [
                    { header: 'Transfer No', dataKey: 'transfer_no' },
                    { header: 'From Warehouse', dataKey: 'from_warehouse_name' },
                    { header: 'To Warehouse', dataKey: 'to_warehouse_name' },
                    { header: 'Date', dataKey: 'transfer_date' },
                    { header: 'Status', dataKey: 'status' },
                ],
                'warehouse_transfers.pdf',
                'Warehouse Transfers Report'
            );
        }
    };

    return (
        <div className="container-fluid">
            <div className="page-titles">
                {showForm ? (
                    <button
                        className="btn btn-outline-primary btn-sm d-flex align-items-center"
                        style={{ gap: '6px', borderRadius: '6px' }}
                        onClick={() => setShowForm(false)}
                    >
                        <i className="fa fa-arrow-left"></i> Back to List
                    </button>
                ) : (
                    <button
                        className="btn btn-outline-primary btn-sm d-flex align-items-center"
                        style={{ gap: '6px', borderRadius: '6px' }}
                        onClick={() => navigate(-1)}
                    >
                        <i className="fa fa-arrow-left"></i> Back
                    </button>
                )}
            </div>

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        {!showForm && (
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title className="mb-0">Warehouse Transfers</Card.Title>
                        </Card.Header>
                        )}
                        <Card.Body className={showForm ? "p-0" : ""}>
                            {showForm ? (
                                <WarehouseTransferForm
                                    formData={formData}
                                    setFormData={setFormData}
                                    onSave={handleSubmit}
                                    onCancel={() => setShowForm(false)}
                                    isEditing={isEditing}
                                />
                            ) : (
                                <WarehouseTransferList
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
                        </Card.Body>
                    </Card>
                </div>
            </div>
            
            <ItemMovementModal 
                show={showItemMovement}
                onHide={() => setShowItemMovement(false)}
            />
        </div>
    );
};

export default WarehouseTransferManagement;
