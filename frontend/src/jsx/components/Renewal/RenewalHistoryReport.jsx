import React, { useState, useEffect, useCallback } from 'react';
import { Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { getRenewalHistory, getBranches, getRenewalSubjects } from '../../../services/RenewalService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import { formatDate } from '../../../utils/dateUtils';
import { usePageTitle } from '../../../context/TitleContext';

const RenewalHistoryReport = () => {
    usePageTitle("Renewal History Report");
    // Data & Dropdown states
    const [historyList, setHistoryList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [branches, setBranches] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [nameOptions, setNameOptions] = useState([]);

    // Filter states
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedName, setSelectedName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Load initial dropdowns
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [branchesRes, subjectsRes] = await Promise.all([
                    getBranches(),
                    getRenewalSubjects()
                ]);

                if (Array.isArray(branchesRes)) {
                    setBranches(branchesRes);
                } else if (branchesRes && Array.isArray(branchesRes.results)) {
                    setBranches(branchesRes.results);
                }

                if (Array.isArray(subjectsRes)) {
                    setSubjects(subjectsRes);
                } else if (subjectsRes && Array.isArray(subjectsRes.results)) {
                    setSubjects(subjectsRes.results);
                }
            } catch (err) {
                console.error('Error loading dropdown data:', err);
            }
        };

        loadInitialData();
    }, []);

    // Load dynamic renewal names whenever Branch or Subject changes
    useEffect(() => {
        const fetchAvailableNames = async () => {
            try {
                const params = { get_names: 'true' };
                if (selectedBranch) params.branch = selectedBranch;
                if (selectedSubject) params.renewal_subject = selectedSubject;

                const res = await getRenewalHistory(params);
                if (res && Array.isArray(res.names)) {
                    const uniqueNames = Array.from(new Set(res.names.filter(Boolean).map(n => n.trim())));
                    setNameOptions(uniqueNames);
                } else {
                    setNameOptions([]);
                }
            } catch (err) {
                console.error('Error fetching available names:', err);
                setNameOptions([]);
            }
        };

        fetchAvailableNames();
    }, [selectedBranch, selectedSubject]);

    // Fetch History report records whenever filters change
    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (selectedBranch) params.branch = selectedBranch;
            if (selectedSubject) params.renewal_subject = selectedSubject;
            if (selectedName) params.name = selectedName;

            const res = await getRenewalHistory(params);
            if (Array.isArray(res)) {
                setHistoryList(res);
            } else if (res && Array.isArray(res.results)) {
                setHistoryList(res.results);
            } else {
                setHistoryList([]);
            }
        } catch (err) {
            console.error('Error fetching renewal history report:', err);
            setHistoryList([]);
        } finally {
            setLoading(false);
        }
    }, [selectedBranch, selectedSubject, selectedName]);

    useEffect(() => {
        fetchHistory();
        setCurrentPage(1);
    }, [fetchHistory]);

    // Reset all filters
    const handleReset = () => {
        setSelectedBranch('');
        setSelectedSubject('');
        setSelectedName('');
        setSearchTerm('');
        setCurrentPage(1);
    };

    // Filter by text search
    const filteredHistory = historyList.filter((item) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        const branchName = item.branch_name || '';
        const subjectName = item.renewal_subject_name || '';
        const name = item.name || '';
        const deptName = item.department_name || '';
        const remarks = item.remarks || '';
        const statusText = item.status === 1 ? 'active current' : 'historical renewed';
        const allocatedText = Array.isArray(item.allocated_to_details)
            ? item.allocated_to_details.map(emp => emp.name).join(' ')
            : '';

        return (
            branchName.toLowerCase().includes(term) ||
            subjectName.toLowerCase().includes(term) ||
            name.toLowerCase().includes(term) ||
            deptName.toLowerCase().includes(term) ||
            remarks.toLowerCase().includes(term) ||
            statusText.toLowerCase().includes(term) ||
            allocatedText.toLowerCase().includes(term)
        );
    });

    // Pagination slice
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredHistory.slice(indexOfFirstItem, indexOfLastItem);

    // Export Handler
    const handleExport = (format) => {
        const columns = [
            { header: 'SL NO', dataKey: 'slNo' },
            { header: 'BRANCH', dataKey: 'branch_name' },
            { header: 'SUBJECT', dataKey: 'renewal_subject_name' },
            { header: 'NAME', dataKey: 'name' },
            { header: 'DEPARTMENT', dataKey: 'department_name' },
            { header: 'ALLOCATED TO', dataKey: 'allocated_to_text' },
            { header: 'RENEWAL DATE', dataKey: 'renewal_date_text' },
            { header: 'REMINDER DAYS', dataKey: 'reminder_days' },
            { header: 'STATUS', dataKey: 'status_text' },
            { header: 'REMARKS', dataKey: 'remarks' },
        ];

        const dataToExport = filteredHistory.map((item, index) => ({
            ...item,
            slNo: index + 1,
            branch_name: item.branch_name || '—',
            renewal_subject_name: item.renewal_subject_name || '—',
            name: item.name || '—',
            department_name: item.department_name || '—',
            allocated_to_text: Array.isArray(item.allocated_to_details) && item.allocated_to_details.length > 0
                ? item.allocated_to_details.map(e => e.name).join(', ')
                : '—',
            renewal_date_text: formatDate(item.renewal_date),
            reminder_days: item.reminder_days ? `${item.reminder_days} days` : '—',
            status_text: item.status === 1 ? 'Active / Current' : 'Renewed / Historical',
            remarks: item.remarks || '—',
        }));

        const title = 'Renewal History Report';
        const fileName = 'renewal_history_report.pdf';

        if (format === 'pdf') {
            exportToPDF(columns, dataToExport, fileName, title);
        } else if (format === 'excel') {
            exportToExcel(dataToExport, columns, 'renewal_history_report.xlsx');
        } else if (format === 'print') {
            printData(dataToExport, columns, title);
        }
    };

    return (
        <div className="container-fluid">
            <div className="page-titles">
                <button
                    onClick={() => window.history.back()}
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>
            
            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-start flex-wrap">
                            {/* <Card.Title className="mb-0 mt-2">Renewal History Report</Card.Title> */}
                            
                            <div className="d-flex align-items-center gap-3 flex-wrap mt-2 mt-sm-0 justify-content-end flex-grow-1">
                                <div className="d-flex gap-2 flex-wrap">
                                    <div style={{ minWidth: '150px' }}>
                                    <select
                                        className="form-select form-select-sm"
                                        value={selectedBranch}
                                        onChange={(e) => {
                                            setSelectedBranch(e.target.value);
                                            setSelectedName('');
                                        }}
                                    >
                                        <option value="">All Branches</option>
                                        {branches.map((b) => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ minWidth: '150px' }}>
                                    <select
                                        className="form-select form-select-sm"
                                        value={selectedSubject}
                                        onChange={(e) => {
                                            setSelectedSubject(e.target.value);
                                            setSelectedName('');
                                        }}
                                    >
                                        <option value="">All Subjects</option>
                                        {subjects.map((sub) => (
                                            <option key={sub.id} value={sub.id}>{sub.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ minWidth: '150px' }}>
                                    <select
                                        className="form-select form-select-sm"
                                        value={selectedName}
                                        onChange={(e) => setSelectedName(e.target.value)}
                                    >
                                        <option value="">All Names</option>
                                        {nameOptions.map((name, index) => (
                                            <option key={index} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <button
                                        type="button"
                                        className="btn btn-sm d-flex align-items-center justify-content-center"
                                        onClick={handleReset}
                                        title="Reset Filters"
                                        style={{ height: '33px', width: '38px', minWidth: '38px', padding: 0, backgroundColor: '#eef2ff', border: '1px solid #c7d2fe', color: '#4f46e5', borderRadius: '6px' }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                                    </button>
                                </div>
                                </div>

                                <div className="d-flex gap-3 flex-wrap align-items-center justify-content-end">
                                    <div className="search-bar-container m-0" style={{ maxWidth: '250px', flex: 1, minWidth: '150px' }}>
                                    <span className="search-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    </span>
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="Search history..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                
                                <div className="d-flex gap-2">
                                    <button className="btn btn-sm btn-light border" onClick={() => handleExport('pdf')} title="Export PDF">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                    </button>
                                    <button className="btn btn-sm btn-light border" onClick={() => handleExport('excel')} title="Export Excel">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                    </button>
                                    <button className="btn btn-sm btn-light border" onClick={() => handleExport('print')} title="Print">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                    </button>
                                </div>
                                </div>
                            </div>
                        </Card.Header>

                        <Card.Body className="p-0">
                            <div className="table-responsive">
                                <table className="table table-responsive-md">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '60px' }}>SL NO</th>
                                        <th>BRANCH</th>
                                        <th>SUBJECT</th>
                                        <th>NAME</th>
                                        <th>DEPARTMENT</th>
                                        <th>ALLOCATED TO</th>
                                        <th>RENEWAL DATE</th>
                                        <th>REMINDER DAYS</th>
                                        <th>STATUS</th>
                                        <th>REMARKS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="10" className="text-center py-4">Loading renewal history...</td></tr>
                                    ) : filteredHistory.length === 0 ? (
                                        <tr><td colSpan="10" className="text-center py-4 text-muted">No renewal history records found for the selected criteria.</td></tr>
                                    ) : currentItems.map((item, idx) => (
                                        <tr key={item.id || idx}>
                                            <td>{indexOfFirstItem + idx + 1}</td>
                                            <td>{item.branch_name || '—'}</td>
                                            <td><strong>{item.renewal_subject_name || '—'}</strong></td>
                                            <td>{item.name || '—'}</td>
                                            <td>{item.department_name || '—'}</td>
                                            <td>
                                                {Array.isArray(item.allocated_to_details) && item.allocated_to_details.length > 0 ? (
                                                    <div className="d-flex flex-wrap gap-1">
                                                        {item.allocated_to_details.map((emp, i) => (
                                                            <span key={i} className="badge badge-info light">
                                                                {emp.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : '—'}
                                            </td>
                                            <td>{formatDate(item.renewal_date)}</td>
                                            <td>{item.reminder_days ? `${item.reminder_days} days` : '—'}</td>
                                            <td>
                                                {item.status === 1 ? (
                                                    <span className="badge badge-success light">
                                                        Current / Active
                                                    </span>
                                                ) : (
                                                    <span className="badge badge-danger light">
                                                        Renewed / Historical
                                                    </span>
                                                )}
                                            </td>
                                            <td>{item.remarks || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {!loading && filteredHistory.length > 0 && (
                            <div className="d-flex justify-content-between align-items-center mt-3">
                                <div className="dataTables_info">
                                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredHistory.length)} of {filteredHistory.length} entries
                                </div>
                                <div className="dataTables_paginate paging_simple_numbers">
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
                            </div>
                        )}
                        </Card.Body>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default RenewalHistoryReport;
