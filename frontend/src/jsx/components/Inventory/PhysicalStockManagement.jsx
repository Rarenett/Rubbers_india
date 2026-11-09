import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import swal from 'sweetalert';
import InventoryService from '../../../services/InventoryService';
import { exportToPDF, exportToExcel } from '../Assets/exportUtils';
import PhysicalStockList from './PhysicalStockList';
import PhysicalStockForm from './PhysicalStockForm';

const PhysicalStockManagement = ({ currentUser }) => {
    const location = useLocation();

    const [stocks, setStocks] = useState([]);
    const [loading, setLoading] = useState(false);

    // View state: 'list' or 'form'
    const [view, setView] = useState('list');
    const [editData, setEditData] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchStocks = useCallback(async () => {
        setLoading(true);
        try {
            const res = await InventoryService.getPhysicalStocks();
            setStocks(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching physical stocks:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (view === 'list') {
            fetchStocks();
        }
    }, [view, fetchStocks]);

    const handleEdit = useCallback((stock) => {
        setEditData(stock);
        setView('form');
    }, []);

    useEffect(() => {
        if (!loading && stocks.length > 0) {
            const searchParams = new URLSearchParams(location.search);
            const editId = searchParams.get('edit');
            if (editId) {
                const cleanTarget = String(editId).toLowerCase().replace(/[^a-z0-9]/g, '');
                const targetStock = stocks.find(s => {
                    const sId = String(s.id);
                    const sNo = String(s.voucher_no || s.ps_no || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    return sId === String(editId) || sNo === cleanTarget || (cleanTarget && sNo.endsWith(cleanTarget));
                });
                if (targetStock) {
                    handleEdit(targetStock);
                }
            }
        }
    }, [loading, stocks, location.search, handleEdit]);

    const filteredStocks = stocks.filter((s) => {
        const term = searchTerm.toLowerCase();
        return (
            (s.voucher_no || '').toLowerCase().includes(term) ||
            (s.date || '').toLowerCase().includes(term)
        );
    });

    const handleAddClick = () => {
        setEditData(null);
        setView('form');
    };

    const handleCloseForm = () => {
        setView('list');
        setEditData(null);
    };

    const handleSaveForm = () => {
        setView('list');
        setEditData(null);
        const searchParams = new URLSearchParams(location.search);
        const returnUrl = searchParams.get('returnUrl') || location.state?.returnUrl;
        if (returnUrl) {
            navigate(decodeURIComponent(returnUrl));
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await swal({
            title: 'Delete Physical Stock?',
            text: 'This will remove the physical stock voucher and reverse the stock adjustments.',
            icon: 'warning',
            buttons: ['Cancel', 'Delete'],
            dangerMode: true,
        });
        if (!confirmed) return;

        try {
            await InventoryService.deletePhysicalStock(id);
            await fetchStocks();
            swal('Deleted!', 'Physical stock deleted successfully.', 'success');
        } catch (err) {
            const msg = err.response?.data?.detail || 'Could not delete physical stock.';
            swal('Error', msg, 'error');
        }
    };

    const handleExport = (format) => {
        const columns = [
            { header: '#', dataKey: 'index' },
            { header: 'Voucher No', dataKey: 'voucher_no' },
            { header: 'Date', dataKey: 'date' },
            { header: 'Created By', dataKey: 'created_by_name', formatter: (v) => v || '—' }
        ];

        const dataWithIndex = filteredStocks.map((d, i) => ({ ...d, index: i + 1 }));
        const title = 'Physical Stock List';

        if (format === 'pdf') {
            exportToPDF(dataWithIndex, columns, 'physical_stock.pdf', title);
        } else if (format === 'excel') {
            exportToExcel(dataWithIndex, columns, 'physical_stock.xlsx');
        }
    };

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-lg-12">
                    {view === 'list' ? (
                        <PhysicalStockList
                            data={filteredStocks}
                            loading={loading}
                            searchTerm={searchTerm}
                            onSearchChange={setSearchTerm}
                            onAdd={handleAddClick}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onExport={handleExport}
                        />
                    ) : (
                        <PhysicalStockForm
                            initialData={editData}
                            onClose={handleCloseForm}
                            onSave={handleSaveForm}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default PhysicalStockManagement;
