import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { usePermission } from '../../../hooks/usePermission';
import SalesService from '../../../services/SalesService';
import DailyEntryList from './DailyEntryList';
import DailyEntryForm from './DailyEntryForm';

const DailyEntryManagement = () => {
    const { can } = usePermission();
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState(null);

    const getFirstDayOfMonth = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}-01`;
    };
    const getLastDayOfMonth = () => {
        const d = new Date();
        const lastDayObj = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const year = lastDayObj.getFullYear();
        const month = String(lastDayObj.getMonth() + 1).padStart(2, '0');
        const day = String(lastDayObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [fromDate, setFromDate] = useState(getFirstDayOfMonth());
    const [toDate, setToDate] = useState(getLastDayOfMonth());


    const fetchEntries = useCallback(async () => {
        setLoading(true);
        try {
            const res = await SalesService.getDailyEntries();
            setEntries(Array.isArray(res.data) ? res.data : res.data?.results || []);
        } catch (err) {
            console.error('Failed to fetch daily entries:', err);
            Swal.fire({
                icon: 'error',
                title: 'Fetch Error',
                text: 'Could not load daily entries from the server.'
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);

    // Handle date range filter (client-side filtering)
    const filteredData = entries.filter((item) => {
        const dateStr = item.entry_date;
        if (!dateStr) return true;
        if (fromDate && dateStr < fromDate) return false;
        if (toDate && dateStr > toDate) return false;
        return true;
    });

    const handleAddClick = () => {
        setIsEditing(false);
        setFormData({
            entry_date: new Date().toISOString().split('T')[0],
            total_sales: '0.00',
            total_outstanding: '0.00',
            production_items: [{ product: '', quantity: '' }]
        });
        setShowForm(true);
    };

    const handleEditClick = (item) => {
        setIsEditing(true);
        setFormData(item);
        setShowForm(true);
    };

    const handleDeleteClick = async (id) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: 'This daily entry summary will be permanently deleted!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (!result.isConfirmed) return;

        try {
            await SalesService.deleteDailyEntry(id);
            Swal.fire({
                icon: 'success',
                title: 'Deleted',
                text: 'Daily entry summary deleted successfully.',
                timer: 1500,
                showConfirmButton: false
            });
            fetchEntries();
        } catch (err) {
            console.error('Failed to delete daily entry:', err);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to delete daily entry.'
            });
        }
    };

    const handleSave = async (submissionData) => {
        try {
            if (isEditing) {
                await SalesService.updateDailyEntry(formData.id, submissionData);
                Swal.fire({
                    icon: 'success',
                    title: 'Updated',
                    text: 'Daily entry summary updated successfully.',
                    timer: 1500,
                    showConfirmButton: false
                });
            } else {
                await SalesService.createDailyEntry(submissionData);
                Swal.fire({
                    icon: 'success',
                    title: 'Created',
                    text: 'Daily entry summary saved successfully.',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
            setShowForm(false);
            fetchEntries();
        } catch (err) {
            console.error('Failed to save daily entry:', err);
            const errorMsg = err.response?.data?.entry_date
                ? 'An entry for this date already exists.'
                : 'Failed to save daily entry. Please verify details.';
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errorMsg
            });
        }
    };

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-lg-12">
                    {showForm ? (
                        <DailyEntryForm
                            entryData={formData}
                            isEditing={isEditing}
                            onSave={handleSave}
                            onCancel={() => setShowForm(false)}
                        />
                    ) : (
                        <DailyEntryList
                            data={filteredData}
                            loading={loading}
                            fromDate={fromDate}
                            toDate={toDate}
                            onFromDateChange={setFromDate}
                            onToDateChange={setToDate}
                            onEdit={handleEditClick}
                            onDelete={handleDeleteClick}
                            onAdd={handleAddClick}
                            can={can}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default DailyEntryManagement;
