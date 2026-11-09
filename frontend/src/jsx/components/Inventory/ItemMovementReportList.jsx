import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../../../services/AxiosInstance';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import { getDatePickerFormat } from '../../../utils/dateUtils';
import { Card } from 'react-bootstrap';
import { usePageTitle } from '../../../context/TitleContext';


const ItemMovementReportList = () => {
    usePageTitle("Item Movement Report");
    // ── State ──────────────────────────────────────────────────────────────
    const [stockItems, setStockItems] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedItem]);

    // Default to current month
    const currentDate = new Date();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    const [fromDate, setFromDate] = useState(
        `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`
    );
    const [toDate, setToDate] = useState(
        `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
    );

    const handleDateInputAndSyncMonths = (newFrom, newTo) => {
        setFromDate(newFrom);
        setToDate(newTo);
    };

    // ── Fetch Items ────────────────────────────────────────────────────────
    useEffect(() => {
        const fetchStockItems = async () => {
            try {
                const response = await axiosInstance.get('/api/inventory/stock-items/simple/');
                setStockItems(response.data);
            } catch (err) {
                console.error('Failed to fetch stock items', err);
            }
        };
        fetchStockItems();
    }, []);

    const itemOptions = stockItems.map(item => ({ value: item.id, label: item.name }));

    // ── Fetch Movements ────────────────────────────────────────────────────
    const fetchMovements = useCallback(async (itemId) => {
        if (!itemId) {
            setMovements([]);
            return;
        }
        setLoading(true);
        try {
            const response = await axiosInstance.get(`/api/inventory/item-movement/${itemId}/`);
            if (response.data.status) {
                setMovements(response.data.data);
            } else {
                console.error(response.data.message || 'Failed to fetch movements');
                setMovements([]);
            }
        } catch (err) {
            console.error('Error fetching movements:', err);
            setMovements([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedItem) {
            fetchMovements(selectedItem.value);
        } else {
            setMovements([]);
        }
    }, [selectedItem, fetchMovements]);

    // ── Filtered list (client-side search & date filter) ───────────────────
    const filteredData = movements.filter((item) => {
        const term = searchTerm.toLowerCase();
        
        let dateInRange = true;
        const itemDate = item.date ? item.date.split('T')[0] : null;
        if (fromDate && (!itemDate || itemDate < fromDate)) dateInRange = false;
        if (toDate && (!itemDate || itemDate > toDate)) dateInRange = false;

        return dateInRange && (
            (item.voucher_type_name || item.transaction_type || '').toLowerCase().includes(term) ||
            (item.date || '').toLowerCase().includes(term) ||
            (item.warehouse_name || '').toLowerCase().includes(term) ||
            (item.batch_number || '').toLowerCase().includes(term) ||
            String(item.reference_id || '').toLowerCase().includes(term)
        );
    });

    // Compute running balance based on all filtered data (before pagination)
    let runningBalance = 0;
    const dataWithBalance = filteredData.map(mov => {
        const qty = parseFloat(mov.quantity) || 0;
        if (mov.movement_type === 'IN') {
            runningBalance += qty;
        } else if (mov.movement_type === 'OUT') {
            runningBalance -= qty;
        }

        let formattedDate = mov.date ? mov.date.split('T')[0] : '—';
        if (formattedDate !== '—' && formattedDate.includes('-')) {
            const parts = formattedDate.split('-');
            if (parts.length === 3) formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }

        return {
            ...mov,
            display_date: formattedDate,
            calculated_balance: runningBalance
        };
    });

    // Group the data by transaction number
    const groupedData = [];
    let currentGroup = null;
    dataWithBalance.forEach(mov => {
        if (!currentGroup || currentGroup.reference_id !== mov.reference_id || !mov.reference_id) {
            currentGroup = {
                reference_id: mov.reference_id,
                display_date: mov.display_date,
                voucher_type_name: mov.voucher_type_name || mov.transaction_type,
                movements: []
            };
            groupedData.push(currentGroup);
        }
        currentGroup.movements.push(mov);
    });

    // ── Pagination Logic ───────────────────────────────────────────────────
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = groupedData.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(groupedData.length / itemsPerPage) || 1;

    // ── Helper ─────────────────────────────────────────────────────────────
    const handleExport = (format) => {
        const columns = [
            { header: 'SL.NO', dataKey: 'index' },
            { header: 'Date', dataKey: 'display_date' },
            { header: 'Voucher Type', dataKey: 'voucher_type_name' },
            { header: 'Transaction No', dataKey: 'reference_id' },
            { header: 'Godown', dataKey: 'warehouse_name', formatter: (v) => v || '-' },
            { header: 'Batch', dataKey: 'batch_number', formatter: (v) => v || '-' },
            { header: 'Qty In', dataKey: 'qty_in' },
            { header: 'Qty Out', dataKey: 'qty_out' },
            { header: 'Balance', dataKey: 'calculated_balance' }
        ];
        
        let slNo = 1;
        const dataWithIndex = groupedData.flatMap((group) => {
            return group.movements.map((d, i) => {
                const qty = parseFloat(d.quantity) || 0;
                const isFirstOfGroup = i === 0;
                return {
                    ...d,
                    index: isFirstOfGroup ? slNo++ : '',
                    display_date: isFirstOfGroup ? d.display_date : '',
                    voucher_type_name: isFirstOfGroup ? (d.voucher_type_name || d.transaction_type) : '',
                    reference_id: isFirstOfGroup ? d.reference_id : '',
                    qty_in: d.movement_type === 'IN' ? qty.toFixed(2) : '-',
                    qty_out: d.movement_type === 'OUT' ? qty.toFixed(2) : '-',
                    calculated_balance: d.calculated_balance.toFixed(2)
                };
            });
        });
        
        const itemName = selectedItem ? selectedItem.label : 'All Items';
        const title = `Item Movement Report - ${itemName} (${fromDate || 'All'} to ${toDate || 'All'})`;

        if (format === 'pdf') {
            exportToPDF(dataWithIndex, columns, 'item_movement.pdf', title, false);
        } else if (format === 'excel') {
            exportToExcel(dataWithIndex, columns, 'item_movement.xlsx', false);
        } else if (format === 'print') {
            printData(dataWithIndex, columns, title, false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="container-fluid">
            <div className="page-titles">
                <ol className="breadcrumb">
                    <li className="breadcrumb-item active"><a href="#">Inventory</a></li>
                    <li className="breadcrumb-item"><a href="#">Item Movement Report</a></li>
                </ol>
            </div>
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Body>
                            <div className="w-100 mb-2 px-4 pt-4">
                                <div className="d-flex flex-wrap justify-content-start justify-content-xl-end align-items-center gap-3 w-100">
                                    
                                    {/* Item Selection */}
                                    <div className="d-flex align-items-center order-1" style={{ flex: '1 1 auto', minWidth: '250px', maxWidth: '400px', zIndex: 999 }}>
                                        <div style={{ width: '100%' }}>
                                            <Select
                                                    options={itemOptions}
                                                    value={selectedItem}
                                                    onChange={setSelectedItem}
                                                    placeholder="Choose an item..."
                                                    classNamePrefix="select"
                                                    isClearable
                                                    styles={{
                                                        control: (base) => ({
                                                            ...base,
                                                            borderRadius: '8px',
                                                            borderColor: '#cbd5e1',
                                                            minHeight: '40px',
                                                            boxShadow: 'none',
                                                            '&:hover': { borderColor: '#94a3b8' },
                                                            cursor: 'pointer'
                                                        }),
                                                        menu: (base) => ({
                                                            ...base,
                                                            borderRadius: '8px',
                                                            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                                                            border: '1px solid #e2e8f0',
                                                            zIndex: 9999
                                                        }),
                                                        option: (base, state) => ({
                                                            ...base,
                                                            fontSize: '13px',
                                                            fontWeight: 500,
                                                            backgroundColor: state.isSelected ? '#eff6ff' : state.isFocused ? '#f8fafc' : 'white',
                                                            color: state.isSelected ? '#1d4ed8' : '#475569',
                                                            cursor: 'pointer',
                                                            '&:active': { backgroundColor: '#dbeafe' }
                                                        })
                                                    }}
                                                />
                                        </div>
                                    </div>


                                    {/* Exports */}
                                    <div className="d-flex gap-2 align-items-center flex-shrink-0 order-2 order-xl-4">
                                        <button className="btn btn-light border p-0" onClick={() => handleExport('pdf')} title="Export PDF" style={{ height: '40px', width: '40px', borderRadius: '8px' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                        </button>
                                        <button className="btn btn-light border p-0" onClick={() => handleExport('excel')} title="Export Excel" style={{ height: '40px', width: '40px', borderRadius: '8px' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                        </button>
                                        <button className="btn btn-light border p-0" onClick={() => handleExport('print')} title="Print" style={{ height: '40px', width: '40px', borderRadius: '8px' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                        </button>
                                    </div>

                                    {/* Dates and Search Group */}
                                    <div className="d-flex flex-column flex-md-row align-items-stretch align-items-md-center gap-3 flex-grow-1 order-3 order-xl-2">
                                        {/* Date Filters */}
                                        <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3">
                                            <div className="d-flex align-items-center gap-2 flex-grow-1">
                                                <label className="form-label mb-0 fw-bold text-nowrap" style={{ minWidth: '40px' }}>From:</label>
                                                <DatePicker
                                                    className="form-control form-control-sm w-100"
                                                    selected={fromDate ? new Date(fromDate.split('-')[0], fromDate.split('-')[1] - 1, fromDate.split('-')[2]) : null}
                                                    onChange={(date) => {
                                                        if (!date) return;
                                                        const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                                                        handleDateInputAndSyncMonths(formatted, toDate);
                                                    }}
                                                    dateFormat={getDatePickerFormat()}
                                                    placeholderText={getDatePickerFormat().toLowerCase()}
                                                />
                                            </div>
                                            <div className="d-flex align-items-center gap-2 flex-grow-1">
                                                <label className="form-label mb-0 fw-bold text-nowrap" style={{ minWidth: '40px' }}>To:</label>
                                                <DatePicker
                                                    className="form-control form-control-sm w-100"
                                                    selected={toDate ? new Date(toDate.split('-')[0], toDate.split('-')[1] - 1, toDate.split('-')[2]) : null}
                                                    onChange={(date) => {
                                                        if (!date) return;
                                                        const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                                                        handleDateInputAndSyncMonths(fromDate, formatted);
                                                    }}
                                                    dateFormat={getDatePickerFormat()}
                                                    placeholderText={getDatePickerFormat().toLowerCase()}
                                                />
                                            </div>
                                        </div>
                                        
                                        {/* Search */}
                                        <div className="search-bar-container" style={{ flex: '1 1 auto', margin: 0, minWidth: '200px', maxWidth: '400px' }}>
                                            <span className="search-icon">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                        </span>
                                        <input
                                                type="text"
                                                className="search-input w-100"
                                                style={{ height: '40px' }}
                                                placeholder="Search report..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                    
                                        </div>
                                    </div>

                                </div>
                            </div>

                            <div className="tab-content mt-1 px-4 pb-4">
                                <div className="mb-3">
                                    {/* <h4 className="mb-0">{selectedItem ? selectedItem.label : 'Item Movement'}</h4> */}
                                </div>

                                <div className="table-responsive">
                                    {loading ? (
                                        <div className="d-flex justify-content-center align-items-center" style={{ height: '300px' }}>
                                            <div className="spinner-border text-primary" role="status">
                                                <span className="visually-hidden">Loading...</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <table className="fd-table">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '60px' }}>SL.NO</th>
                                                    <th>TRANSACTION NO.</th>
                                                    <th>DATE</th>
                                                    <th>VOUCHER TYPE</th>
                                                    <th>GODOWN</th>
                                                    <th>BATCH</th>
                                                    <th className="text-end">QTY IN</th>
                                                    <th className="text-end">QTY OUT</th>
                                                    <th className="text-end">BALANCE</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {!selectedItem ? (
                                                    <tr><td colSpan="9" className="text-center py-4 text-muted">Please select a stock item from the dropdown above to view its movement history.</td></tr>
                                                ) : currentItems.length === 0 ? (
                                                    <tr><td colSpan="9" className="text-center py-4 text-muted">No movements found for the selected date range.</td></tr>
                                                ) : currentItems.map((group, groupIndex) => {
                                                    const slNo = indexOfFirstItem + groupIndex + 1;
                                                    return group.movements.map((mov, movIndex) => {
                                                        const qty = parseFloat(mov.quantity) || 0;
                                                        return (
                                                            <tr key={mov.id || `${groupIndex}-${movIndex}`}>
                                                                {movIndex === 0 && (
                                                                    <>
                                                                        <td rowSpan={group.movements.length}>{slNo}</td>
                                                                        <td rowSpan={group.movements.length}>
                                                                            <span className="fw-bold">{group.reference_id || '-'}</span>
                                                                        </td>
                                                                        <td rowSpan={group.movements.length}>{group.display_date}</td>
                                                                        <td rowSpan={group.movements.length} className="fw-semibold">
                                                                            {group.voucher_type_name || '-'}
                                                                        </td>
                                                                    </>
                                                                )}
                                                                <td className="fw-semibold">
                                                                    {mov.warehouse_name || '-'}
                                                                </td>
                                                                <td className="fw-semibold">
                                                                    {mov.batch_number || '-'}
                                                                </td>
                                                                <td className="text-end fw-bold">
                                                                    {mov.movement_type === 'IN' ? qty.toFixed(2) : '-'}
                                                                </td>
                                                                <td className="text-end fw-bold">
                                                                    {mov.movement_type === 'OUT' ? qty.toFixed(2) : '-'}
                                                                </td>
                                                                <td className="text-end fw-bold">
                                                                    {mov.calculated_balance.toFixed(2)}
                                                                </td>
                                                            </tr>
                                                        );
                                                    });
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>

                                {/* Pagination */}
                                {selectedItem && !loading && currentItems.length > 0 && totalPages > 1 && (
                                    <div className="d-flex justify-content-between align-items-center mt-3">
                                        <div className="text-muted" style={{ fontSize: '13px' }}>
                                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, groupedData.length)} of {groupedData.length} entries
                                        </div>
                                        <nav>
                                            <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                    <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
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
                                                            <li key={pageNumber} className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}>
                                                                <button type="button" className="page-link" onClick={() => setCurrentPage(pageNumber)} style={{ border: 'none' }}>
                                                                    {pageNumber}
                                                                </button>
                                                            </li>
                                                        );
                                                    } else if (
                                                        pageNumber === currentPage - 2 ||
                                                        pageNumber === currentPage + 2
                                                    ) {
                                                        return (
                                                            <li key={pageNumber} className="page-item disabled">
                                                                <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                            </li>
                                                        );
                                                    }
                                                    return null;
                                                })}
                                                <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                    <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none' }}>
                                                        <i className="la la-angle-right" />
                                                    </button>
                                                </li>
                                            </ul>
                                        </nav>
                                    </div>
                                )}
                            </div>
                        </Card.Body>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default ItemMovementReportList;
