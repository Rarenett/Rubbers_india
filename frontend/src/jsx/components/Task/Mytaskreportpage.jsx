import React, { Fragment, useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Form, Modal } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { getMyTaskReport } from '../../../services/TaskService';
import { fetchCompanyFinancialYears } from '../../../services/CompanyService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return isNaN(date.getTime()) ? d : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Table row for recursive task assignments and split delegation breakdown
const AssignmentTableRow = ({ node, level = 0, index = '' }) => {
    const isMe = node.is_me;
    const hasChildren = node.children && node.children.length > 0;
    const progress = Math.round(node.completed_percentage || 0);
    const weight = node.percentage !== undefined ? node.percentage : 100;

    let statusBadge = (
        <span className="badge badge-primary light" style={{ fontSize: '11px' }}>
            In Progress
        </span>
    );
    if (progress >= 100) {
        statusBadge = (
            <span className="badge badge-success light" style={{ fontSize: '11px' }}>
                Completed
            </span>
        );
    } else if (node.is_delegated || hasChildren) {
        statusBadge = (
            <span className="badge badge-secondary light" style={{ fontSize: '11px' }}>
                Delegated
            </span>
        );
    }

    return (
        <React.Fragment>
            <tr
                style={{
                    backgroundColor: isMe ? '#f0f9ff' : level > 0 ? '#f8fafc' : '#ffffff',
                    borderLeft: isMe ? '3px solid #0284c7' : 'none'
                }}
            >
                <td style={{ width: '45px', color: '#64748b', fontWeight: 600 }}>
                    {index}
                </td>
                <td>
                    <div style={{ paddingLeft: level > 0 ? `${level * 20}px` : '0px' }} className="d-flex align-items-center gap-2">
                        {level > 0 && <span style={{ color: '#94a3b8' }}>↳</span>}
                        <div>
                            <span className="fw-bold text-dark d-block" style={{ fontSize: '13px' }}>
                                {node.subtask_name || 'Assignment'}
                            </span>
                            {node.subtask_type && (
                                <span
                                    className={`badge badge-${node.subtask_type.toLowerCase() === 'group' ? 'info' : 'primary'} light`}
                                    style={{ fontSize: '10px', textTransform: 'capitalize' }}
                                >
                                    {node.subtask_type}
                                </span>
                            )}
                        </div>
                    </div>
                </td>
                <td>
                    <div className="d-flex flex-column">
                        <div className="d-flex align-items-center gap-2">
                            <span className="fw-bold text-dark" style={{ fontSize: '13px' }}>
                                {node.employee_name || 'Unassigned'}
                            </span>
                            {isMe && (
                                <span className="badge badge-primary" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                    You
                                </span>
                            )}
                        </div>
                        {node.assigned_by_name && (
                            <small className="text-muted" style={{ fontSize: '11px' }}>
                                Assigned by: {node.assigned_by_name}
                            </small>
                        )}
                    </div>
                </td>
                <td className="text-center">
                    <span className="fw-bold text-dark" style={{ fontSize: '13px' }}>
                        {weight}%
                    </span>
                </td>
                <td>
                    <div style={{ minWidth: '120px' }}>
                        <div className="d-flex justify-content-between mb-1" style={{ fontSize: '11px' }}>
                            <span className="text-muted">Progress</span>
                            <span className="fw-semibold">{progress}%</span>
                        </div>
                        <div style={{ height: '5px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                                style={{
                                    width: `${progress}%`,
                                    height: '100%',
                                    backgroundColor: progress >= 100 ? '#10b981' : '#2772db',
                                    borderRadius: '3px'
                                }}
                            />
                        </div>
                    </div>
                </td>
                <td className="text-center">
                    {statusBadge}
                </td>
            </tr>
            {hasChildren && node.children.map((child, cIdx) => (
                <AssignmentTableRow
                    key={child.assignment_id || `child-${cIdx}`}
                    node={child}
                    level={level + 1}
                    index={`${index}.${cIdx + 1}`}
                />
            ))}
        </React.Fragment>
    );
};


const MyTaskReportPage = () => {
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState({
        summary: {},
        tasks: [],
    });
    const [statusFilter, setStatusFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [fromDate, setFromDate] = useState(
        localStorage.getItem('active_fy_start') || ''
    );
    const [toDate, setToDate] = useState(
        localStorage.getItem('active_fy_end') || ''
    );
    const [selectedTaskItem, setSelectedTaskItem] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Load active financial year from company settings
    useEffect(() => {
        const fetchFy = async () => {
            try {
                const companyId = localStorage.getItem('companyId') || 1;
                const res = await fetchCompanyFinancialYears(companyId);
                const fyList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
                const activeFy = fyList.find((fy) => fy.is_active);
                if (activeFy) {
                    setFromDate(activeFy.start_date);
                    setToDate(activeFy.end_date);
                    localStorage.setItem('active_fy_start', activeFy.start_date);
                    localStorage.setItem('active_fy_end', activeFy.end_date);
                }
            } catch (err) {
                console.error('Failed to fetch active financial year:', err);
            }
        };

        const currentFyStart = localStorage.getItem('active_fy_start');
        const currentFyEnd = localStorage.getItem('active_fy_end');
        if (currentFyStart && currentFyEnd) {
            setFromDate(currentFyStart);
            setToDate(currentFyEnd);
        }
        fetchFy();

        const handleFyUpdate = () => {
            const fyStart = localStorage.getItem('active_fy_start');
            const fyEnd = localStorage.getItem('active_fy_end');
            if (fyStart && fyEnd) {
                setFromDate(fyStart);
                setToDate(fyEnd);
            }
        };
        window.addEventListener('financialYearUpdate', handleFyUpdate);
        return () => window.removeEventListener('financialYearUpdate', handleFyUpdate);
    }, []);

    const fetchReport = useCallback(async (status = '') => {
        setLoading(true);
        try {
            const data = await getMyTaskReport(status || null);
            setReportData(data || { summary: {}, tasks: [] });
        } catch (err) {
            console.error('Failed to load my task report:', err);
            Swal.fire({
                icon: 'error',
                title: 'Error Loading Report',
                text: err?.response?.data?.detail || 'Could not fetch your task report. Please try again.',
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReport(statusFilter);
    }, [statusFilter, fetchReport]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, fromDate, toDate, statusFilter]);

    // Client-side search and date filtering
    const filteredTasks = useMemo(() => {
        let result = reportData.tasks || [];

        if (fromDate) {
            result = result.filter(item => {
                const sDate = item.task.start_date;
                const dDate = item.task.due_date;
                return (sDate && sDate >= fromDate) || (dDate && dDate >= fromDate);
            });
        }

        if (toDate) {
            result = result.filter(item => {
                const sDate = item.task.start_date;
                const dDate = item.task.due_date;
                return (dDate && dDate <= toDate) || (sDate && sDate <= toDate);
            });
        }

        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase().trim();
            result = result.filter(item => {
                const t = item.task;
                const matchTask = (
                    t.task_name?.toLowerCase().includes(q) ||
                    t.category_name?.toLowerCase().includes(q) ||
                    t.subcategory_name?.toLowerCase().includes(q) ||
                    t.description?.toLowerCase().includes(q) ||
                    t.task_type?.toLowerCase().includes(q)
                );
                const matchMyWork = (item.my_assignments || []).some(a =>
                    a.subtask_name?.toLowerCase().includes(q) ||
                    a.assigned_by_name?.toLowerCase().includes(q)
                );
                return matchTask || matchMyWork;
            });
        }

        return result;
    }, [reportData.tasks, searchTerm, fromDate, toDate]);

    // Pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredTasks.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);

    // Export handler for PDF, Excel, and Print with crystal-clear hierarchical grouping
    const handleExport = (type) => {
        const flattenSplits = (nodes, parentIndex = '', level = 0) => {
            let res = [];
            (nodes || []).forEach((node, idx) => {
                const currentIndex = parentIndex ? `${parentIndex}.${idx + 1}` : `${idx + 1}`;
                res.push({ node, level, index: currentIndex });
                if (node.children && node.children.length > 0) {
                    res = res.concat(flattenSplits(node.children, currentIndex, level + 1));
                }
            });
            return res;
        };

        const rows = [];
        let taskCounter = 0;

        filteredTasks.forEach(item => {
            taskCounter += 1;
            const task = item.task || {};
            const categoryStr = `${task.category_name || ''}${task.subcategory_name ? ' › ' + task.subcategory_name : ''}` || '—';
            const taskProgress = `${Math.round(task.completed_percentage || 0)}%`;
            const taskStatus = task.is_overdue
                ? 'Overdue'
                : (task.completed_percentage >= 100 ? 'Completed' : 'In Progress');

            const splits = (item.split_tree && item.split_tree.length > 0)
                ? item.split_tree
                : (item.my_assignments && item.my_assignments.length > 0)
                    ? item.my_assignments
                    : [];

            const flatSplits = flattenSplits(splits, `${taskCounter}`, 0);

            const hasSubtasks = flatSplits.length > 1 || (
                flatSplits.length === 1 &&
                flatSplits[0].node.subtask_name &&
                flatSplits[0].node.subtask_name !== task.task_name &&
                flatSplits[0].node.subtask_id
            );

            if (!hasSubtasks) {
                const assigneeNode = flatSplits.length === 1 ? flatSplits[0].node : null;
                const assigneeName = assigneeNode
                    ? `${assigneeNode.employee_name || 'Unassigned'}${assigneeNode.is_me ? ' (You)' : ''}`
                    : '—';

                rows.push({
                    _is_main_task: true,
                    index: `${taskCounter}`,
                    task_name: task.task_name || '—',
                    subtask_name: '— (No Subtasks)',
                    assigned_to: assigneeName,
                    category: categoryStr,
                    task_type: task.task_type || 'individual',
                    start_date: formatDate(task.start_date),
                    due_date: formatDate(task.due_date),
                    weight: '100%',
                    progress: taskProgress,
                    status: taskStatus,
                });
            } else {
                // Main task overview row (highlighted, bold)
                rows.push({
                    _is_main_task: true,
                    index: `${taskCounter}`,
                    task_name: task.task_name || '—',
                    subtask_name: `[All ${flatSplits.length} Subtasks Overview]`,
                    assigned_to: 'Team / Multiple Assignees',
                    category: categoryStr,
                    task_type: task.task_type || 'group',
                    start_date: formatDate(task.start_date),
                    due_date: formatDate(task.due_date),
                    weight: '100%',
                    progress: taskProgress,
                    status: taskStatus,
                });

                // Followed by clearly indented subtask rows with hierarchical numbering (1.1, 1.1.1, etc.)
                flatSplits.forEach(({ node, level, index: subIndex }) => {
                    const prefix = '   '.repeat(level + 1) + '-- ';
                    const isMe = node.is_me;
                    const assignee = `${node.employee_name || 'Unassigned'}${isMe ? ' (You)' : ''}`;
                    const subProgress = Math.round(node.completed_percentage || 0);
                    const subStatus = subProgress >= 100
                        ? 'Completed'
                        : (node.is_delegated ? 'Delegated' : 'In Progress');

                    rows.push({
                        _is_main_task: false,
                        index: subIndex,
                        task_name: task.task_name || '—',
                        subtask_name: `${prefix}${node.subtask_name || 'Subtask'}`,
                        assigned_to: assignee,
                        category: categoryStr,
                        task_type: node.subtask_type || task.task_type || 'individual',
                        start_date: formatDate(task.start_date),
                        due_date: formatDate(task.due_date),
                        weight: `${node.percentage !== undefined ? node.percentage : 100}%`,
                        progress: `${subProgress}%`,
                        status: subStatus,
                    });
                });
            }
        });

        if (type === 'pdf') {
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'pt',
                format: 'a4'
            });

            doc.setFontSize(16);
            doc.setTextColor(30, 41, 59);
            doc.text('Task & Subtask Report', 30, 32);

            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 30, 46);

            const tableColumns = [
                { header: '#', dataKey: 'index' },
                { header: 'Task Name', dataKey: 'task_name_pdf' },
                { header: 'Subtask / Split', dataKey: 'subtask_name' },
                { header: 'Assigned To', dataKey: 'assigned_to' },
                { header: 'Category', dataKey: 'category' },
                { header: 'Type', dataKey: 'task_type' },
                { header: 'Start Date', dataKey: 'start_date' },
                { header: 'Due Date', dataKey: 'due_date' },
                { header: 'Weight', dataKey: 'weight' },
                { header: 'Progress', dataKey: 'progress' },
                { header: 'Status', dataKey: 'status' },
            ];

            const tableRows = rows.map(r => ({
                ...r,
                task_name_pdf: r._is_main_task ? r.task_name : '', // Blank on subtasks so they visually nest under parent task
            }));

            autoTable(doc, {
                startY: 58,
                columns: tableColumns,
                body: tableRows,
                theme: 'grid',
                headStyles: {
                    fillColor: [39, 114, 219],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 8.5,
                },
                styles: {
                    fontSize: 8,
                    cellPadding: 3.5,
                    textColor: [51, 65, 85],
                    lineColor: [203, 213, 225],
                    lineWidth: 0.5,
                    overflow: 'linebreak',
                },
                columnStyles: {
                    index: { cellWidth: 38, halign: 'center', fontStyle: 'bold' },
                    task_name_pdf: { cellWidth: 124, fontStyle: 'bold' },
                    subtask_name: { cellWidth: 140 },
                    assigned_to: { cellWidth: 95 },
                    category: { cellWidth: 95 },
                    task_type: { cellWidth: 50, halign: 'center' },
                    start_date: { cellWidth: 55, halign: 'center' },
                    due_date: { cellWidth: 55, halign: 'center' },
                    weight: { cellWidth: 42, halign: 'center' },
                    progress: { cellWidth: 46, halign: 'center' },
                    status: { cellWidth: 52, halign: 'center' },
                },
                didParseCell: function (data) {
                    const rawRow = rows[data.row.index];
                    if (rawRow && rawRow._is_main_task) {
                        data.cell.styles.fillColor = [241, 245, 249]; // Soft slate background for parent task
                        data.cell.styles.textColor = [15, 23, 42];
                        data.cell.styles.fontStyle = 'bold';
                    } else {
                        data.cell.styles.fillColor = [255, 255, 255];
                    }
                },
                margin: { top: 58, left: 30, right: 30, bottom: 30 }
            });

            doc.save('Task_Report.pdf');
        } else if (type === 'excel') {
            const formattedData = rows.map(r => ({
                '#': r.index,
                'Task Name': r.task_name,
                'Subtask / Split': r.subtask_name,
                'Assigned To': r.assigned_to,
                'Category': r.category,
                'Type': r.task_type,
                'Start Date': r.start_date,
                'Due Date': r.due_date,
                'Weight': r.weight,
                'Progress': r.progress,
                'Status': r.status,
            }));

            const worksheet = XLSX.utils.json_to_sheet(formattedData);
            worksheet['!cols'] = [
                { wch: 8 },
                { wch: 28 },
                { wch: 28 },
                { wch: 22 },
                { wch: 22 },
                { wch: 12 },
                { wch: 14 },
                { wch: 14 },
                { wch: 10 },
                { wch: 10 },
                { wch: 14 },
            ];

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasks and Subtasks');
            XLSX.writeFile(workbook, 'Task_Report.xlsx');
        } else if (type === 'print') {
            const printWindow = window.open('', '_blank');
            const html = `
                <html>
                    <head>
                        <title>Task & Subtask Report</title>
                        <style>
                            @page { size: landscape; margin: 12mm; }
                            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 15px; font-size: 12px; color: #1e293b; }
                            h2 { margin: 0 0 4px 0; color: #0f172a; font-size: 18px; }
                            .timestamp { color: #64748b; font-size: 11px; margin-bottom: 16px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
                            th { background-color: #2772db; color: #ffffff; font-weight: 600; font-size: 11px; }
                            .main-task-row { background-color: #f1f5f9; font-weight: bold; color: #0f172a; }
                            .subtask-row { background-color: #ffffff; color: #334155; }
                            @media print {
                                body { padding: 0; }
                            }
                        </style>
                    </head>
                    <body>
                        <h2>Task & Subtask Report</h2>
                        <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
                        <table>
                            <thead>
                                <tr>
                                    <th style="min-width: 45px; text-align: center;">#</th>
                                    <th>Task Name</th>
                                    <th>Subtask / Split</th>
                                    <th>Assigned To</th>
                                    <th>Category</th>
                                    <th style="text-align: center;">Type</th>
                                    <th style="text-align: center;">Start Date</th>
                                    <th style="text-align: center;">Due Date</th>
                                    <th style="text-align: center;">Weight</th>
                                    <th style="text-align: center;">Progress</th>
                                    <th style="text-align: center;">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows.map(r => `
                                    <tr class="${r._is_main_task ? 'main-task-row' : 'subtask-row'}">
                                        <td style="text-align: center; font-weight: ${r._is_main_task ? 'bold' : 'normal'};">${r.index}</td>
                                        <td>${r._is_main_task ? `<strong>${r.task_name}</strong>` : ''}</td>
                                        <td>${r.subtask_name}</td>
                                        <td>${r.assigned_to}</td>
                                        <td>${r.category}</td>
                                        <td style="text-align: center; text-transform: capitalize;">${r.task_type}</td>
                                        <td style="text-align: center;">${r.start_date}</td>
                                        <td style="text-align: center;">${r.due_date}</td>
                                        <td style="text-align: center;">${r.weight}</td>
                                        <td style="text-align: center;">${r.progress}</td>
                                        <td style="text-align: center;">${r.status}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <script>
                            window.onload = () => {
                                window.print();
                                window.onafterprint = () => window.close();
                            };
                        </script>
                    </body>
                </html>
            `;
            printWindow.document.write(html);
            printWindow.document.close();
        }
    };

    return (
        <Fragment>
            <style dangerouslySetInnerHTML={{__html: `
                .allocation-header-container {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    flex-wrap: wrap !important;
                    gap: 15px !important;
                }
                .allocation-controls-wrapper {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    flex-wrap: wrap !important;
                }
                .allocation-tabs-wrapper {
                    display: flex !important;
                    align-items: center !important;
                    gap: 4px !important;
                }
                .allocation-tab-btn {
                    border: none !important;
                    outline: none !important;
                    cursor: pointer !important;
                    white-space: nowrap !important;
                }
                .allocation-actions-group {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                }
                .allocation-search-bar {
                    width: 300px !important;
                }
                .allocation-date-filters {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                }
                .allocation-date-item {
                    display: flex !important;
                    align-items: center !important;
                    gap: 6px !important;
                }
                .allocation-table {
                    margin-bottom: 0 !important;
                }
                .allocation-table th {
                    white-space: nowrap !important;
                    vertical-align: middle !important;
                    font-size: 13px !important;
                }
                .allocation-table td {
                    vertical-align: middle !important;
                }
                .allocation-search-export-row {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                }
                @media (max-width: 767px) {
                    .allocation-header-container {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 12px !important;
                    }
                    .allocation-table {
                        min-width: 650px !important;
                    }
                    .allocation-title-group {
                        width: 100% !important;
                    }
                    .allocation-tabs-wrapper {
                        width: 100% !important;
                        display: flex !important;
                        justify-content: space-between !important;
                        padding: 3px !important;
                    }
                    .allocation-tab-btn {
                        flex: 1 1 0% !important;
                        justify-content: center !important;
                        padding: 7px 8px !important;
                        font-size: 12px !important;
                        white-space: nowrap !important;
                    }
                    .allocation-controls-wrapper {
                        width: 100% !important;
                        justify-content: flex-start !important;
                        gap: 8px !important;
                    }
                    .allocation-date-filters {
                        width: 100% !important;
                        margin-bottom: 6px !important;
                        order: 0 !important;
                        display: flex !important;
                        flex-direction: row !important;
                        align-items: center !important;
                        gap: 6px !important;
                    }
                    .allocation-date-item {
                        flex: 1 1 0% !important;
                        min-width: 0 !important;
                        display: flex !important;
                        align-items: center !important;
                        gap: 4px !important;
                    }
                    .allocation-date-item .date-label {
                        font-size: 11px !important;
                        font-weight: 600 !important;
                        flex-shrink: 0 !important;
                        margin-right: 2px !important;
                        color: #64748b !important;
                    }
                    .allocation-date-item input {
                        flex: 1 1 0% !important;
                        min-width: 0 !important;
                        width: 100% !important;
                        font-size: 11.5px !important;
                        padding: 4px 4px 4px 6px !important;
                        height: 34px !important;
                        border-radius: 6px !important;
                    }
                    .allocation-export-btn {
                        width: 38px !important;
                        height: 38px !important;
                        flex-shrink: 0 !important;
                    }
                    .allocation-search-bar {
                        width: 100% !important;
                        order: 2 !important;
                        margin-top: 4px !important;
                    }
                    .allocation-search-export-row {
                        width: 100% !important;
                        order: 1 !important;
                        display: flex !important;
                        align-items: center !important;
                        gap: 8px !important;
                    }
                    .allocation-search-export-row .allocation-search-bar {
                        flex: 1 1 auto !important;
                        width: auto !important;
                        margin-top: 0 !important;
                        min-width: 0 !important;
                    }
                }
                @media (max-width: 480px) {
                    .allocation-date-filters {
                        flex-direction: row !important;
                        align-items: center !important;
                        gap: 6px !important;
                    }
                    .allocation-date-item {
                        flex: 1 1 0% !important;
                        min-width: 0 !important;
                    }
                    .allocation-date-item .date-label {
                        font-size: 11px !important;
                        margin-right: 2px !important;
                    }
                    .allocation-date-item input {
                        flex: 1 1 0% !important;
                        min-width: 0 !important;
                        width: 100% !important;
                        font-size: 11px !important;
                        padding: 4px 2px 4px 5px !important;
                    }
                    .allocation-tab-btn {
                        padding: 6px 4px !important;
                        font-size: 11.5px !important;
                        gap: 4px !important;
                    }
                }
                @media (max-width: 400px) {
                    .allocation-table {
                        min-width: 600px !important;
                    }
                    .allocation-search-export-row {
                        gap: 6px !important;
                    }
                }
                @media (max-width: 360px) {
                    .allocation-date-filters {
                        gap: 4px !important;
                    }
                    .allocation-date-item .date-label {
                        font-size: 10px !important;
                    }
                    .allocation-date-item input {
                        font-size: 10px !important;
                        padding: 2px 2px 2px 3px !important;
                    }
                    .allocation-tab-btn {
                        font-size: 10px !important;
                        padding: 5px 2px !important;
                    }
                    .allocation-export-btn {
                        width: 32px !important;
                        height: 32px !important;
                    }
                }
                @media (min-width: 768px) and (max-width: 850px) {
                    .allocation-search-bar {
                        width: 200px !important;
                    }
                }
                @media (min-width: 540px) and (max-width: 540px) {
                    .allocation-header-container {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 10px !important;
                    }
                    .allocation-controls-wrapper {
                        width: 100% !important;
                        flex-direction: row !important;
                        align-items: center !important;
                        gap: 6px !important;
                    }
                    .allocation-search-bar {
                        width: 100% !important;
                    }
                }
                @media (min-width: 344px) and (max-width: 344px) {
                    .allocation-header-container {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 8px !important;
                    }
                    .allocation-tabs-wrapper {
                        width: 100% !important;
                    }
                    .allocation-tab-btn {
                        font-size: 10px !important;
                        padding: 4px 4px !important;
                    }
                    .allocation-controls-wrapper {
                        width: 100% !important;
                        gap: 4px !important;
                    }
                    .allocation-search-bar {
                        width: 100% !important;
                    }
                    .allocation-export-btn {
                        width: 28px !important;
                        height: 28px !important;
                    }
                }
            `}} />

            <div className="container-fluid">
                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex justify-content-between align-items-center allocation-header-container">
                                <div className="d-flex flex-column gap-2 allocation-title-group">
                                    <Card.Title className="mb-0">Task Report</Card.Title>
                                    <div className="d-inline-flex p-1 mt-2 allocation-tabs-wrapper" style={{ backgroundColor: '#f1f5f9', borderRadius: '30px' }}>
                                        {[
                                            { label: 'All Tasks', value: '' },
                                            { label: 'In Progress', value: 'active' },
                                            { label: 'Completed', value: 'completed' },
                                            { label: 'Overdue', value: 'overdue' },
                                        ].map(tab => (
                                            <button
                                                key={tab.value}
                                                type="button"
                                                className="btn btn-sm border-0 d-flex align-items-center gap-2 allocation-tab-btn"
                                                onClick={() => setStatusFilter(tab.value)}
                                                style={{
                                                    borderRadius: '30px',
                                                    padding: '6px 20px',
                                                    fontWeight: '600',
                                                    backgroundColor: statusFilter === tab.value ? '#fff' : 'transparent',
                                                    color: statusFilter === tab.value ? '#1d4ed8' : '#64748b',
                                                    boxShadow: statusFilter === tab.value ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
                                                    transition: 'all 0.2s ease-in-out'
                                                }}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="d-flex align-items-center gap-2 allocation-controls-wrapper">
                                    <div className="d-flex align-items-center gap-2 allocation-date-filters">
                                        <div className="d-flex align-items-center allocation-date-item">
                                            <span className="text-muted date-label" style={{ fontSize: '12px', fontWeight: '500' }}>From:</span>
                                            <Form.Control
                                                type="date"
                                                size="sm"
                                                value={fromDate}
                                                onChange={e => setFromDate(e.target.value)}
                                                style={{ height: '34px', borderRadius: '6px', fontSize: '13px' }}
                                            />
                                        </div>
                                        <div className="d-flex align-items-center allocation-date-item">
                                            <span className="text-muted date-label" style={{ fontSize: '12px', fontWeight: '500' }}>To:</span>
                                            <Form.Control
                                                type="date"
                                                size="sm"
                                                value={toDate}
                                                onChange={e => setToDate(e.target.value)}
                                                style={{ height: '34px', borderRadius: '6px', fontSize: '13px' }}
                                            />
                                        </div>
                                    </div>

                                    <div className="allocation-search-export-row">
                                        <div className="allocation-search-bar" style={{ position: 'relative' }}>
                                            <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                            <Form.Control
                                                type="text"
                                                placeholder="Search tasks..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                            />
                                        </div>
                                        <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                            <button
                                                className="btn btn-sm btn-light border allocation-export-btn"
                                                style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }}
                                                onClick={() => handleExport('pdf')}
                                                title="Export PDF"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                            </button>
                                            <button
                                                className="btn btn-sm btn-light border allocation-export-btn"
                                                style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }}
                                                onClick={() => handleExport('excel')}
                                                title="Export Excel"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                            </button>
                                            <button
                                                className="btn btn-sm btn-light border allocation-export-btn"
                                                style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }}
                                                onClick={() => handleExport('print')}
                                                title="Print"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </Card.Header>

                            <Card.Body>
                                {loading ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-primary" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-responsive-md allocation-table">
                                            <thead>
                                                <tr>
                                                    <th><strong>SL.NO</strong></th>
                                                    <th><strong>TASK NAME</strong></th>
                                                    <th><strong>CATEGORY</strong></th>
                                                    <th><strong>TYPE</strong></th>
                                                    <th><strong>START DATE</strong></th>
                                                    <th><strong>DUE DATE</strong></th>
                                                    <th><strong>PROGRESS</strong></th>
                                                    <th className="text-center"><strong>STATUS</strong></th>
                                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredTasks.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="9" className="text-center py-4 text-muted">
                                                            No tasks found.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    currentItems.map((item, idx) => {
                                                        const task = item.task || {};
                                                        const progress = task.completed_percentage || 0;
                                                        const isOverdue = task.is_overdue;

                                                        let displayStatus = 'In Progress';
                                                        let statusVariant = 'primary';
                                                        if (progress >= 100) {
                                                            displayStatus = 'Completed';
                                                            statusVariant = 'success';
                                                        } else if (isOverdue) {
                                                            displayStatus = 'Overdue';
                                                            statusVariant = 'danger';
                                                        }

                                                        return (
                                                            <tr key={task.id || idx}>
                                                                <td>{indexOfFirstItem + idx + 1}</td>
                                                                <td>
                                                                    <strong>{task.task_name}</strong>
                                                                </td>
                                                                <td>
                                                                    <div className="d-flex flex-column gap-1">
                                                                        <small>{task.category_name || '—'}</small>
                                                                        {task.subcategory_name && (
                                                                            <small className="text-muted">› {task.subcategory_name}</small>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <span
                                                                        className={`badge badge-${(task.task_type || 'individual').toLowerCase() === 'group' ? 'info' : 'primary'} light`}
                                                                        style={{ textTransform: 'capitalize' }}
                                                                    >
                                                                        {task.task_type || 'individual'}
                                                                    </span>
                                                                </td>
                                                                <td>{formatDate(task.start_date)}</td>
                                                                <td>{formatDate(task.due_date)}</td>
                                                                <td>
                                                                    <div style={{ minWidth: '100px' }}>
                                                                        <div className="d-flex justify-content-between mb-1" style={{ fontSize: '11px' }}>
                                                                            <span>{progress}%</span>
                                                                        </div>
                                                                        <div style={{ height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                                                                            <div
                                                                                style={{
                                                                                    width: `${progress}%`,
                                                                                    height: '100%',
                                                                                    backgroundColor: progress >= 100 ? '#10b981' : isOverdue ? '#dc2626' : '#2772db',
                                                                                    borderRadius: '2px'
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="text-center">
                                                                    <span className={`badge badge-${statusVariant} light`}>
                                                                        {displayStatus}
                                                                    </span>
                                                                </td>
                                                                <td className="text-end">
                                                                    <div className="d-flex justify-content-end gap-1">
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-outline-primary shadow-sm"
                                                                            style={{
                                                                                width: '28px',
                                                                                height: '28px',
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                padding: '0',
                                                                                fontSize: '12px',
                                                                                borderRadius: '6px'
                                                                            }}
                                                                            onClick={() => setSelectedTaskItem(item)}
                                                                            title="View Task Details"
                                                                        >
                                                                            <i className="fa fa-eye"></i>
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="d-flex justify-content-between align-items-center mt-3 p-3 border-top">
                                        <span className="text-muted" style={{ fontSize: '13px' }}>
                                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredTasks.length)} of {filteredTasks.length} entries
                                        </span>
                                        <div className="d-flex gap-1">
                                            <button
                                                className="btn btn-sm btn-light border"
                                                disabled={currentPage === 1}
                                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            >
                                                Previous
                                            </button>
                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                                <button
                                                    key={page}
                                                    className={`btn btn-sm ${currentPage === page ? 'btn-primary' : 'btn-light border'}`}
                                                    onClick={() => setCurrentPage(page)}
                                                >
                                                    {page}
                                                </button>
                                            ))}
                                            <button
                                                className="btn btn-sm btn-light border"
                                                disabled={currentPage === totalPages}
                                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Task Details Popup Modal */}
            <Modal
                show={!!selectedTaskItem}
                onHide={() => setSelectedTaskItem(null)}
                size="lg"
                centered
            >
                {selectedTaskItem && (() => {
                    const task = selectedTaskItem.task || {};
                    const my_assignments = selectedTaskItem.my_assignments || [];
                    const split_tree = selectedTaskItem.split_tree || [];
                    const displaySplits = (split_tree && split_tree.length > 0)
                        ? split_tree
                        : (my_assignments && my_assignments.length > 0)
                            ? my_assignments
                            : [];
                    const progress = Math.round(task.completed_percentage || 0);
                    const isOverdue = task.is_overdue;

                    let displayStatus = 'In Progress';
                    let statusVariant = 'primary';
                    if (progress >= 100) {
                        displayStatus = 'Completed';
                        statusVariant = 'success';
                    } else if (isOverdue) {
                        displayStatus = 'Overdue';
                        statusVariant = 'danger';
                    }

                    return (
                        <>
                            <Modal.Header closeButton className="border-bottom pb-3">
                                <div className="d-flex flex-column">
                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                        <Modal.Title className="h5 mb-0 fw-bold text-dark">
                                            {task.task_name}
                                        </Modal.Title>
                                        <span
                                            className={`badge badge-${(task.task_type || 'individual').toLowerCase() === 'group' ? 'info' : 'primary'} light`}
                                            style={{ fontSize: '11px', textTransform: 'capitalize' }}
                                        >
                                            {task.task_type || 'individual'} Task
                                        </span>
                                    </div>
                                    <div className="text-muted mt-1" style={{ fontSize: '12px' }}>
                                        <span>{task.category_name || 'General'}</span>
                                        {task.subcategory_name && <span> › {task.subcategory_name}</span>}
                                    </div>
                                </div>
                            </Modal.Header>
                            <Modal.Body className="p-4" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                                {/* Task Overview Card */}
                                <div className="p-3 mb-4 rounded border bg-light">
                                    <div className="row g-3 align-items-center">
                                        <div className="col-6 col-md-3">
                                            <span className="text-muted d-block" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                Status
                                            </span>
                                            <span className={`badge badge-${statusVariant} light mt-1`}>
                                                {displayStatus}
                                            </span>
                                        </div>
                                        <div className="col-6 col-md-3">
                                            <span className="text-muted d-block" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                Start Date
                                            </span>
                                            <span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                                                {formatDate(task.start_date)}
                                            </span>
                                        </div>
                                        <div className="col-6 col-md-3">
                                            <span className="text-muted d-block" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                Due Date
                                            </span>
                                            <span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                                                {formatDate(task.due_date)}
                                            </span>
                                        </div>
                                        <div className="col-6 col-md-3">
                                            <div className="d-flex justify-content-between mb-1" style={{ fontSize: '11px' }}>
                                                <span className="text-muted text-uppercase" style={{ letterSpacing: '0.5px' }}>Overall Progress</span>
                                                <span className="fw-bold text-dark">{progress}%</span>
                                            </div>
                                            <div style={{ height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                                <div
                                                    style={{
                                                        width: `${progress}%`,
                                                        height: '100%',
                                                        backgroundColor: progress >= 100 ? '#10b981' : isOverdue ? '#dc2626' : '#2772db',
                                                        borderRadius: '3px'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Task Description */}
                                    <div className="mt-3 pt-3 border-top" style={{ borderColor: '#e2e8f0' }}>
                                        <span className="text-muted d-block mb-1" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Description
                                        </span>
                                        <div className="text-dark" style={{ fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                                            {task.description || (
                                                <span className="text-muted fst-italic">No description provided for this task.</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Task Split & Assigned Members Section */}
                                <div>
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <div>
                                            <h6 className="fw-bold text-dark mb-0">Task Split & Assignee Details</h6>
                                            <small className="text-muted" style={{ fontSize: '12px' }}>
                                                Subtasks divided and assigned among team members
                                            </small>
                                        </div>
                                        <span className="badge badge-light border text-muted" style={{ fontSize: '11px' }}>
                                            {displaySplits.length} {displaySplits.length === 1 ? 'Assignment' : 'Assignments'}
                                        </span>
                                    </div>

                                    {displaySplits.length === 0 ? (
                                        <div className="p-3 bg-white rounded border text-muted text-center" style={{ fontSize: '12px' }}>
                                            No split subtasks or assignments recorded for this task.
                                        </div>
                                    ) : (
                                        <div className="table-responsive bg-white rounded border" style={{ borderColor: '#e2e8f0' }}>
                                            <table className="table table-hover align-middle mb-0" style={{ fontSize: '12px' }}>
                                                <thead style={{ backgroundColor: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                                                    <tr>
                                                        <th style={{ width: '45px' }}>SL.NO</th>
                                                        <th>Subtask / Split</th>
                                                        <th>Assigned Person</th>
                                                        <th className="text-center">Weight (%)</th>
                                                        <th style={{ minWidth: '130px' }}>Completion Progress</th>
                                                        <th className="text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {displaySplits.map((node, nIdx) => (
                                                        <AssignmentTableRow
                                                            key={node.assignment_id || `split-${nIdx}`}
                                                            node={node}
                                                            level={0}
                                                            index={`${nIdx + 1}`}
                                                        />
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </Modal.Body>
                            <Modal.Footer className="border-top pt-2 pb-2">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => setSelectedTaskItem(null)}
                                >
                                    Close
                                </button>
                            </Modal.Footer>
                        </>
                    );
                })()}
            </Modal>
        </Fragment>
    );
};

export default MyTaskReportPage;
