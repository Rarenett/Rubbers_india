import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import { getDatePickerFormat } from '../../../../utils/dateUtils';
import { getGodownReport } from '../../../../services/InventoryService';
import { exportToPDF, exportToExcel, printData } from '../../Assets/exportUtils';
import { Card } from 'react-bootstrap';

const GodownReport = () => {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Default to current month
    const currentDate = new Date();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    const [fromDate, setFromDate] = useState(
        `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`
    );
    const [toDate, setToDate] = useState(
        `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
    );
    
    const [searchTerm, setSearchTerm] = useState('');
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const fetchReport = async () => {
        setLoading(true);
        try {
            const data = await getGodownReport(fromDate, toDate);
            setReportData(data);
        } catch (error) {
            console.error('Failed to fetch godown report:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [fromDate, toDate]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, fromDate, toDate]);

    const filteredData = reportData.filter((godown) => {
        const term = searchTerm.toLowerCase();
        if (godown.godown_name && godown.godown_name.toLowerCase().includes(term)) return true;
        if (godown.items) {
            return godown.items.some(i => {
                if (i.item_name && i.item_name.toLowerCase().includes(term)) return true;
                if (i.batches) {
                    return i.batches.some(b => b.batch_number && b.batch_number.toLowerCase().includes(term));
                }
                return false;
            });
        }
        return false;
    });

    const handleExport = (format) => {
        const flattenedData = [];
        let slNo = 1;
        filteredData.forEach((godown) => {
            const godownItems = godown.items && godown.items.length > 0 ? godown.items : [ { item_name: '', total_quantity: '', batches: [] } ];
            godownItems.forEach((item, itemIdx) => {
                const itemBatches = item.batches && item.batches.length > 0 ? item.batches : [ { batch_number: '', quantity: '' } ];
                itemBatches.forEach((batch, batchIdx) => {
                    const isFirstOfGodown = itemIdx === 0 && batchIdx === 0;
                    const isFirstOfItem = batchIdx === 0;

                    flattenedData.push({
                        index: isFirstOfGodown ? slNo++ : '',
                        godown_name: isFirstOfGodown ? godown.godown_name : '',
                        godown_total: isFirstOfGodown ? godown.total_quantity : '',
                        item_name: isFirstOfItem ? item.item_name : '',
                        batch_number: batch.batch_number,
                        quantity: batch.quantity,
                    });
                });
            });
        });

        const columns = [
            { header: 'SL.NO', dataKey: 'index' },
            { header: 'GODOWN NAME', dataKey: 'godown_name', formatter: (v) => v || '-' },
            { header: 'TOTAL QUANTITY', dataKey: 'godown_total' },
            { header: 'ITEM NAME', dataKey: 'item_name', formatter: (v) => v || '-' },
            { header: 'BATCH', dataKey: 'batch_number', formatter: (v) => v || '-' },
            { header: 'QUANTITY', dataKey: 'quantity' }
        ];
        
        const title = `Godown Report (${fromDate || 'All'} to ${toDate || 'All'})`;

        if (format === 'pdf') exportToPDF(flattenedData, columns, 'godown_report.pdf', title, false);
        else if (format === 'excel') exportToExcel(flattenedData, columns, 'godown_report.xlsx', false);
        else if (format === 'print') printData(flattenedData, columns, title, false);
    };

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;

    const renderTableBody = () => {
        if (filteredData.length === 0) {
            return (
                <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">
                        No data available
                    </td>
                </tr>
            );
        }

        const rows = [];
        currentItems.forEach((godown, godownIdx) => {
            const godownItems = godown.items && godown.items.length > 0 ? godown.items : [ { item_name: '', total_quantity: '', batches: [] } ];
            
            // Calculate total rows for this godown
            let godownRowsCount = 0;
            godownItems.forEach(i => {
                const bCount = i.batches && i.batches.length > 0 ? i.batches.length : 1;
                godownRowsCount += bCount;
            });

            godownItems.forEach((item, iIdx) => {
                const itemBatches = item.batches && item.batches.length > 0 ? item.batches : [ { batch_number: '', quantity: '' } ];
                const itemRowsCount = itemBatches.length;

                itemBatches.forEach((batch, bIdx) => {
                    rows.push(
                        <tr key={"row-" + godownIdx + "-" + iIdx + "-" + bIdx}>
                            {iIdx === 0 && bIdx === 0 && (
                                <>
                                    <td rowSpan={godownRowsCount} className="align-top"><strong>{indexOfFirstItem + godownIdx + 1}</strong></td>
                                    <td rowSpan={godownRowsCount} className="align-top fw-bold">
                                        {godown.godown_name || '-'}
                                    </td>
                                    <td rowSpan={godownRowsCount} className="align-top fw-bold text-end">
                                        {godown.total_quantity}
                                    </td>
                                </>
                            )}
                            {bIdx === 0 && (
                                <td rowSpan={itemRowsCount} className="align-top fw-semibold">
                                    {item.item_name || '-'}
                                </td>
                            )}
                            <td className="fw-semibold">{batch.batch_number || '-'}</td>
                            <td className="text-end fw-bold">{batch.quantity}</td>
                        </tr>
                    );
                });
            });
        });

        return rows;
    };

    return (
        <div className="container-fluid">
            <div className="page-titles">
                <ol className="breadcrumb">
                    <li className="breadcrumb-item active"><a href="#">Inventory</a></li>
                    <li className="breadcrumb-item"><a href="#">Godown Report</a></li>
                </ol>
            </div>
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Body>
                            <div className="w-100 mb-2 px-4 pt-4">
                                <div className="d-flex flex-column flex-xl-row justify-content-xl-end align-items-stretch align-items-xl-center gap-3 w-100">
                                    
                                    {/* Dates and Search container (Row 1 on small, Inline on large) */}
                                    <div className="d-flex flex-column flex-md-row justify-content-md-end align-items-stretch align-items-md-center gap-3 flex-grow-1 order-1">
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
                                                        setFromDate(formatted);
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
                                                        setToDate(formatted);
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

                                    {/* Exports (Row 2 on small, Inline on large) */}
                                    <div className="d-flex justify-content-end order-2">
                                        <div className="d-flex gap-2 align-items-center flex-shrink-0">
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
                                    </div>

                                </div>
                            </div>

                            <div className="tab-content mt-1 px-4 pb-4">
                                <div className="mb-3">
                                    <h4 className="mb-0">Godown wise Stock Item Report</h4>
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
                                                    <th>GODOWN NAME</th>
                                                    <th className="text-end">TOTAL QUANTITY</th>
                                                    <th>ITEM NAME</th>
                                                    <th>BATCH</th>
                                                    <th className="text-end">QUANTITY</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {renderTableBody()}
                                            </tbody>
                                        </table>
                                    )}
                                </div>

                                {/* Pagination */}
                                {!loading && currentItems.length > 0 && totalPages > 1 && (
                                    <div className="d-flex justify-content-between align-items-center mt-3">
                                        <div className="text-muted" style={{ fontSize: '13px' }}>
                                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredData.length)} of {filteredData.length} entries
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

export default GodownReport;
