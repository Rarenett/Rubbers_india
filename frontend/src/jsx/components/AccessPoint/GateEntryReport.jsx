import React, { useState, useEffect, useCallback, useContext, Fragment } from 'react';
import { Card, Form, Button, Row, Col, Badge, Spinner, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '../../../context/TitleContext';
import { ThemeContext } from '../../../context/ThemeContext';
import GateManagementService from '../../../services/GateManagementService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const GateEntryReport = ({ embedded = false }) => {
    usePageTitle("Gate Entry Reports");
    const navigate = useNavigate();
    const { background } = useContext(ThemeContext);
    const isDark = background.value === "dark";

    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [allRecords, setAllRecords] = useState([]);
    const [dateQuickFilter, setDateQuickFilter] = useState('all'); // 'all', 'today', 'week', 'month', 'custom'
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Fetch report data
    const fetchReportData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await GateManagementService.getLiveGateStatusReport();
            if (data) {
                if (data.all_results) {
                    setAllRecords(data.all_results);
                } else if (data.results) {
                    setAllRecords(data.results);
                }
            }
        } catch (err) {
            console.error("Error fetching live gate status report:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    // Reset pagination when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, dateQuickFilter, startDate, endDate]);

    // Format date string
    const formatDateTime = (isoStr) => {
        if (!isoStr) return '—';
        try {
            const d = new Date(isoStr);
            if (isNaN(d.getTime())) return isoStr;
            return d.toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch {
            return isoStr;
        }
    };

    // Render Date and Time in 2 lines for table display
    const renderDateTime2Lines = (isoStr) => {
        if (!isoStr) return <span className="text-muted">—</span>;
        try {
            const d = new Date(isoStr);
            if (isNaN(d.getTime())) return isoStr;
            const datePart = d.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
            const timePart = d.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            return (
                <div className="d-flex flex-column" style={{ lineHeight: '1.3' }}>
                    <span className="fw-semibold text-nowrap" style={{ color: isDark ? '#f8fafc' : '#1e293b' }}>{datePart}</span>
                    <small className="text-muted text-nowrap" style={{ fontSize: '11px' }}>{timePart}</small>
                </div>
            );
        } catch {
            return isoStr;
        }
    };

    // Render Vehicle Number: displays first vehicle number + '+N' badge with tooltip if multiple
    const renderVehicleNumber = (vehicleStr, itemId) => {
        if (!vehicleStr || vehicleStr.trim() === '' || vehicleStr === '—') {
            return <span className="text-muted">—</span>;
        }
        const list = vehicleStr.split(/[,;\n]+/).map(v => v.trim()).filter(Boolean);
        if (list.length === 0) return <span className="text-muted">—</span>;
        if (list.length === 1) {
            return <span className="fw-semibold text-nowrap">{list[0]}</span>;
        }
        const first = list[0];
        const remaining = list.slice(1);
        return (
            <div className="d-flex align-items-center gap-1 text-nowrap">
                <span className="fw-semibold">{first}</span>
                <OverlayTrigger
                    placement="top"
                    overlay={
                        <Tooltip id={`veh-tip-${itemId}`}>
                            <div className="text-start p-1" style={{ fontSize: '11px' }}>
                                <div className="fw-bold mb-1 border-bottom pb-1" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
                                    Vehicles ({list.length}):
                                </div>
                                {list.map((v, i) => (
                                    <div key={i}>
                                        • {v} {i === 0 ? '(Primary)' : ''}
                                    </div>
                                ))}
                            </div>
                        </Tooltip>
                    }
                >
                    <span 
                        className="badge rounded-pill fw-bold"
                        style={{ 
                            fontSize: '11px', 
                            cursor: 'pointer', 
                            padding: '2px 7px',
                            lineHeight: '1.2',
                            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
                            color: isDark ? '#93c5fd' : '#2563eb',
                            border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.4)' : '#bfdbfe'}`
                        }}
                    >
                        +{remaining.length}
                    </span>
                </OverlayTrigger>
            </div>
        );
    };

    // Date preset helper
    const handleQuickDate = (preset) => {
        setDateQuickFilter(preset);
        const today = new Date();
        const formatDateStr = (d) => d.toISOString().split('T')[0];

        if (preset === 'all') {
            setStartDate('');
            setEndDate('');
        } else if (preset === 'today') {
            const todayStr = formatDateStr(today);
            setStartDate(todayStr);
            setEndDate(todayStr);
        } else if (preset === 'week') {
            const firstDay = new Date(today);
            firstDay.setDate(today.getDate() - 7);
            setStartDate(formatDateStr(firstDay));
            setEndDate(formatDateStr(today));
        } else if (preset === 'month') {
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            setStartDate(formatDateStr(firstDay));
            setEndDate(formatDateStr(today));
        }
    };

    // Client-side filtering across search and date range
    const filteredRecords = allRecords.filter((item) => {
        // Date filter
        if (startDate || endDate) {
            if (item.entry_time) {
                try {
                    const itemDateStr = item.entry_time.split('T')[0];
                    if (startDate && itemDateStr < startDate) return false;
                    if (endDate && itemDateStr > endDate) return false;
                } catch {
                    // Ignore date parse issues
                }
            }
        }

        // Search filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            const passNo = (item.pass_number || '').toLowerCase();
            const name = (item.name || '').toLowerCase();
            const mobile = (item.mobile || '').toLowerCase();
            const category = (item.category || '').toLowerCase();
            const company = (item.company || '').toLowerCase();
            const host = (item.host_employee || '').toLowerCase();
            const dept = (item.department || '').toLowerCase();
            const vehicle = (item.vehicle_number || '').toLowerCase();
            const purpose = (item.purpose || '').toLowerCase();

            const matchesRealloc = (item.reallocations || []).some(r => 
                (r.to_employee || '').toLowerCase().includes(term) ||
                (r.to_department || '').toLowerCase().includes(term) ||
                (r.from_employee || '').toLowerCase().includes(term) ||
                (r.reason || '').toLowerCase().includes(term)
            );

            return (
                passNo.includes(term) ||
                name.includes(term) ||
                mobile.includes(term) ||
                category.includes(term) ||
                company.includes(term) ||
                host.includes(term) ||
                dept.includes(term) ||
                vehicle.includes(term) ||
                purpose.includes(term) ||
                matchesRealloc
            );
        }

        return true;
    });

    // Pagination calculations
    const totalItems = filteredRecords.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentData = filteredRecords.slice(indexOfFirstItem, indexOfLastItem);

    // Export handler (Print, PDF, Excel)
    const handleExport = (format) => {
        const reportTitle = 'Gate Entry Report';
        const fileName = `gate_entry_report_${new Date().toISOString().split('T')[0]}`;

        // Format active filter summary
        let filterInfo = 'Filter: All Dates';
        if (dateQuickFilter && dateQuickFilter !== 'all' && dateQuickFilter !== 'custom') {
            const filterLabels = { today: 'Today', week: 'Last 7 Days', month: 'This Month' };
            filterInfo = `Filter: ${filterLabels[dateQuickFilter] || dateQuickFilter.toUpperCase()}`;
        } else if (startDate || endDate) {
            filterInfo = `Filter: ${startDate || 'Start'} to ${endDate || 'Present'}`;
        }
        if (searchTerm.trim()) {
            filterInfo += ` | Search: "${searchTerm.trim()}"`;
        }

        // Format vehicle helper for export (displays one vehicle number per line in Print, PDF, Excel)
        const formatVehicleForExport = (vehStr) => {
            if (!vehStr || vehStr.trim() === '' || vehStr === '—') {
                return { text: '—', html: '<span style="color:#94a3b8;">—</span>' };
            }
            const list = vehStr.split(/[,;\n]+/).map(v => v.trim()).filter(Boolean);
            if (list.length === 0) return { text: '—', html: '<span style="color:#94a3b8;">—</span>' };
            const textPerLine = list.join('\n');
            const htmlPerLine = `<div style="line-height: 1.35;">${list.map(v => `<div style="font-weight: 500; font-size: 10px; white-space: nowrap;">${v}</div>`).join('')}</div>`;
            return {
                text: textPerLine,
                html: htmlPerLine
            };
        };

        // Helper to split ISO datetime into 2 separate lines (date & time)
        const splitDateTime = (isoStr) => {
            if (!isoStr || isoStr === '—') return { date: '—', time: '' };
            try {
                const d = new Date(isoStr);
                if (isNaN(d.getTime())) return { date: isoStr, time: '' };
                const datePart = d.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                });
                const timePart = d.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
                return { date: datePart, time: timePart };
            } catch {
                return { date: isoStr, time: '' };
            }
        };

        // 2-line In-Time HTML for Print
        const formatInTimeHtml = (isoStr) => {
            const { date, time } = splitDateTime(isoStr);
            if (!time) return `<div>${date}</div>`;
            return `
                <div style="line-height: 1.3;">
                    <div style="font-weight: 600; color: #1e293b; font-size: 10px;">${date}</div>
                    <div style="font-size: 9px; color: #64748b;">${time}</div>
                </div>
            `;
        };

        // 2-line Out-Time HTML for Print
        const formatOutTimeHtml = (isoStr, statusText = '') => {
            if (!isoStr || isoStr === '—') {
                if (statusText) {
                    const isSched = statusText === 'Scheduled';
                    return `
                        <span style="display: inline-block; padding: 2px 7px; border-radius: 4px; font-weight: 600; font-size: 9.5px; background: ${isSched ? '#e0f2fe' : '#dcfce7'}; color: ${isSched ? '#0369a1' : '#15803d'};">
                            ${statusText}
                        </span>
                    `;
                }
                return '<span style="color:#94a3b8;">—</span>';
            }
            const { date, time } = splitDateTime(isoStr);
            return `
                <div style="line-height: 1.3;">
                    <div style="font-weight: 600; color: #1e293b; font-size: 10px;">${date}</div>
                    ${time ? `<div style="font-size: 9px; color: #64748b;">${time}</div>` : ''}
                    ${statusText ? `<div style="font-size: 8.5px; font-weight: 600; color: ${statusText.includes('Campus Exit') ? '#16a34a' : statusText.includes('Handover') ? '#d97706' : '#2563eb'}; margin-top: 1px;">${statusText}</div>` : ''}
                </div>
            `;
        };

        // 2-line plain text with newline for PDF and Excel
        const format2LineText = (isoStr, statusText = '') => {
            if (!isoStr || isoStr === '—') {
                return statusText || '—';
            }
            const { date, time } = splitDateTime(isoStr);
            let res = date;
            if (time) res += `\n${time}`;
            if (statusText) res += `\n${statusText}`;
            return res;
        };

        const exportData = [];
        let sl = 1;
        filteredRecords.forEach((item) => {
            const hasRealloc = Boolean(item.reallocations && item.reallocations.length > 0);
            const currentHost = hasRealloc 
                ? (item.reallocations[item.reallocations.length - 1].to_employee || item.host_employee) 
                : (item.host_employee || '—');
            const currentDept = hasRealloc 
                ? (item.reallocations[item.reallocations.length - 1].to_department || item.department) 
                : (item.department || '—');

            const veh = formatVehicleForExport(item.vehicle_number);
            const outStatus = item.exit_time ? '' : (item.entry_type === 'appointment' ? 'Scheduled' : 'Inside');

            // Primary Row
            exportData.push({
                index: sl,
                name: item.name + (item.mobile && item.mobile !== '—' ? ` (${item.mobile})` : ''),
                category: item.category || '—',
                company: item.company || '—',
                vehicle_number: veh.text,
                vehicle_html: veh.html,
                persons_display: item.number_of_persons || 1,
                host_display: `${currentHost} (${currentDept})${hasRealloc ? ' [Current]' : ''}`,
                in_time_html: formatInTimeHtml(item.entry_time),
                in_time_text: format2LineText(item.entry_time),
                out_time_html: formatOutTimeHtml(item.exit_time, outStatus),
                out_time_text: item.exit_time ? format2LineText(item.exit_time) : outStatus,
                purpose: item.purpose || '—',
                is_substage: false,
            });

            // If entry was reallocated, append each stage indented
            if (hasRealloc) {
                // Initial stage
                exportData.push({
                    index: '',
                    name: '↳ Stage 1 (Initial Host)',
                    category: '',
                    company: '',
                    vehicle_number: '',
                    vehicle_html: '',
                    persons_display: '',
                    host_display: `${item.host_employee || '—'} (${item.department || '—'})`,
                    in_time_html: formatInTimeHtml(item.entry_time),
                    in_time_text: format2LineText(item.entry_time),
                    out_time_html: formatOutTimeHtml(item.initial_out_time, item.initial_out_time ? '(Handover)' : ''),
                    out_time_text: item.initial_out_time ? format2LineText(item.initial_out_time, '(Handover)') : '—',
                    purpose: item.purpose || 'Initial Visit',
                    is_substage: true,
                });
                // Handover stages
                item.reallocations.forEach((r, rIdx) => {
                    const isLast = rIdx === item.reallocations.length - 1;
                    const isCampusExit = Boolean(isLast && item.exit_time && r.out_time === item.exit_time);
                    const stageOutStatus = r.out_time 
                        ? (isCampusExit ? '(Campus Exit)' : '(Handover)') 
                        : 'Currently with Host';

                    exportData.push({
                        index: '',
                        name: `↳ Stage ${rIdx + 2} (Handover)`,
                        category: '',
                        company: '',
                        vehicle_number: '',
                        vehicle_html: '',
                        persons_display: '',
                        host_display: `${r.to_employee || r.host_employee || '—'} (${r.to_department || r.department || '—'})${r.from_employee ? ` [From: ${r.from_employee}]` : ''}`,
                        in_time_html: formatInTimeHtml(r.in_time),
                        in_time_text: format2LineText(r.in_time),
                        out_time_html: formatOutTimeHtml(r.out_time, stageOutStatus),
                        out_time_text: r.out_time ? format2LineText(r.out_time, stageOutStatus) : stageOutStatus,
                        purpose: r.reason || r.response_notes || 'Handover',
                        is_substage: true,
                    });
                });
            }
            sl++;
        });

        // 1. PRINT FORMAT (Clean Landscape, auto-adjusting, single # column)
        if (format === 'print') {
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                alert('Please allow popups to print the report.');
                return;
            }

            const rowsHtml = exportData.map((item) => {
                const isSub = Boolean(item.is_substage);
                return `
                    <tr style="${isSub ? 'background-color: #f8fafc;' : 'background-color: #ffffff;'}">
                        <td style="text-align: center; font-weight: ${isSub ? 'normal' : '700'}; color: ${isSub ? '#94a3b8' : '#334155'};">${item.index || ''}</td>
                        <td style="font-weight: ${isSub ? '500' : '600'}; padding-left: ${isSub ? '18px' : '8px'}; color: ${isSub ? '#64748b' : '#0f172a'}; font-style: ${isSub ? 'italic' : 'normal'};">
                            ${item.name || ''}
                        </td>
                        <td>${item.category ? `<span class="badge-cat">${item.category}</span>` : ''}</td>
                        <td>${item.company || ''}</td>
                        <td style="white-space: normal; word-break: break-word; font-size: 10px;">${item.vehicle_html || ''}</td>
                        <td style="text-align: center;">${item.persons_display ? `<span class="badge-count">${item.persons_display}</span>` : ''}</td>
                        <td>${item.host_display || ''}</td>
                        <td style="white-space: nowrap; vertical-align: middle;">${item.in_time_html || ''}</td>
                        <td style="white-space: nowrap; vertical-align: middle;">${item.out_time_html || ''}</td>
                        <td style="word-break: break-word; white-space: pre-wrap; font-size: 10.5px;">${item.purpose || ''}</td>
                    </tr>
                `;
            }).join('');

            const html = `
                <!DOCTYPE html>
                <html>
                    <head>
                        <title>${reportTitle}</title>
                        <style>
                            @page {
                                size: landscape;
                                margin: 10mm 10mm;
                            }
                            * { box-sizing: border-box; }
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                                color: #1e293b;
                                margin: 0;
                                padding: 12px;
                                font-size: 11px;
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            .report-header {
                                display: flex;
                                justify-content: space-between;
                                align-items: flex-end;
                                margin-bottom: 12px;
                                border-bottom: 2px solid #0a500f;
                                padding-bottom: 8px;
                            }
                            .report-title {
                                font-size: 18px;
                                font-weight: 700;
                                color: #0f172a;
                                margin: 0 0 4px 0;
                            }
                            .report-meta {
                                font-size: 10.5px;
                                color: #64748b;
                            }
                            table {
                                width: 100%;
                                border-collapse: collapse;
                                font-size: 11px;
                            }
                            th {
                                background-color: #f1f5f9 !important;
                                color: #334155;
                                font-weight: 700;
                                font-size: 10px;
                                text-transform: uppercase;
                                letter-spacing: 0.5px;
                                border: 1px solid #cbd5e1;
                                padding: 6px 8px;
                                text-align: left;
                            }
                            td {
                                border: 1px solid #e2e8f0;
                                padding: 6px 8px;
                                vertical-align: middle;
                            }
                            .badge-cat {
                                display: inline-block;
                                padding: 2px 7px;
                                border-radius: 4px;
                                background: #ecfdf5 !important;
                                color: #059669;
                                border: 1px solid #a7f3d0;
                                font-weight: 600;
                                font-size: 10px;
                            }
                            .badge-count {
                                display: inline-block;
                                padding: 2px 6px;
                                border-radius: 12px;
                                background: #f1f5f9 !important;
                                color: #475569;
                                border: 1px solid #cbd5e1;
                                font-weight: 600;
                                font-size: 10.5px;
                            }
                            .veh-badge {
                                display: inline-block;
                                padding: 1px 6px;
                                border-radius: 10px;
                                background: #eff6ff !important;
                                color: #2563eb;
                                border: 1px solid #bfdbfe;
                                font-size: 9.5px;
                                font-weight: 700;
                                margin-left: 4px;
                            }
                            .report-footer {
                                margin-top: 14px;
                                display: flex;
                                justify-content: space-between;
                                font-size: 9.5px;
                                color: #94a3b8;
                                border-top: 1px solid #e2e8f0;
                                padding-top: 6px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="report-header">
                            <div>
                                <h1 class="report-title">Gate Entry Report</h1>
                                <div class="report-meta">${filterInfo}</div>
                            </div>
                            <div style="text-align: right;" class="report-meta">
                                <div><strong>${filteredRecords.length}</strong> Entries Recorded</div>
                                <div>Generated on: ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                            </div>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 35px; text-align: center;">#</th>
                                    <th style="width: 140px;">Visitor / Driver</th>
                                    <th style="width: 75px;">Category</th>
                                    <th style="width: 110px;">Company</th>
                                    <th style="width: 115px;">Vehicle No.</th>
                                    <th style="width: 55px; text-align: center;">Persons</th>
                                    <th style="width: 100px;">Host / Dept</th>
                                    <th style="width: 85px;">In Time</th>
                                    <th style="width: 88px;">Out Time</th>
                                    <th>Purpose / Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                            </tbody>
                        </table>
                        <div class="report-footer">
                            <div>Glenda &bull; Gate Entry Reports</div>
                            <div>Printed from System</div>
                        </div>
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
            return;
        }

        // 2. PDF FORMAT (High-resolution Landscape A4)
        if (format === 'pdf') {
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

            doc.setFontSize(16);
            doc.setTextColor(15, 23, 42);
            doc.text(reportTitle, 14, 15);

            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139);
            doc.text(filterInfo, 14, 21);
            doc.text(
                `Generated on: ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} | Total: ${filteredRecords.length} Entries`,
                doc.internal.pageSize.width - 14,
                21,
                { align: 'right' }
            );

            const headers = [
                ['#', 'Visitor / Driver', 'Category', 'Company', 'Vehicle No.', 'Persons', 'Host / Dept', 'In Time', 'Out Time', 'Purpose / Remarks']
            ];

            const body = exportData.map(item => [
                item.index || '',
                item.name || '',
                item.category || '',
                item.company || '',
                item.vehicle_number || '',
                item.persons_display ? String(item.persons_display) : '',
                item.host_display || '',
                item.in_time_text || '',
                item.out_time_text || '',
                item.purpose || ''
            ]);

            autoTable(doc, {
                head: headers,
                body: body,
                startY: 25,
                theme: 'grid',
                headStyles: {
                    fillColor: [46, 206, 138],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 8,
                    halign: 'left',
                },
                bodyStyles: {
                    fontSize: 7.5,
                    textColor: [30, 41, 59],
                    cellPadding: 2,
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 252],
                },
                columnStyles: {
                    0: { cellWidth: 10, halign: 'center' },
                    1: { cellWidth: 34 },
                    2: { cellWidth: 18 },
                    3: { cellWidth: 26 },
                    4: { cellWidth: 26 },
                    5: { cellWidth: 14, halign: 'center' },
                    6: { cellWidth: 32 },
                    7: { cellWidth: 22, fontSize: 7 },
                    8: { cellWidth: 24, fontSize: 7 },
                    9: { cellWidth: 'auto', overflow: 'linebreak' },
                },
                didParseCell: (dataCell) => {
                    const rowItem = exportData[dataCell.row.index];
                    if (rowItem && rowItem.is_substage && dataCell.section === 'body') {
                        dataCell.cell.styles.fillColor = [241, 245, 249];
                        dataCell.cell.styles.textColor = [100, 116, 139];
                        if (dataCell.column.index === 1) {
                            dataCell.cell.styles.fontStyle = 'italic';
                        }
                    }
                },
                margin: { top: 25, left: 14, right: 14, bottom: 15 },
                didDrawPage: (dataPage) => {
                    const str = `Page ${dataPage.pageNumber} of ${doc.internal.getNumberOfPages()}`;
                    doc.setFontSize(8);
                    doc.setTextColor(148, 163, 184);
                    doc.text('Glenda • Gate Entry Reports', 14, doc.internal.pageSize.height - 8);
                    doc.text(str, doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 8, { align: 'right' });
                }
            });

            doc.save(`${fileName}.pdf`);
            return;
        }

        // 3. EXCEL FORMAT (.xlsx with explicit column widths)
        if (format === 'excel') {
            const formattedData = exportData.map((item) => ({
                '#': item.index || '',
                'Visitor / Driver': item.name || '',
                'Category': item.category || '',
                'Company': item.company || '',
                'Vehicle No.': item.vehicle_number || '',
                'Persons': item.persons_display || '',
                'Host / Dept': item.host_display || '',
                'In Time': item.in_time_text || '',
                'Out Time': item.out_time_text || '',
                'Purpose / Remarks': item.purpose || '',
            }));

            const worksheet = XLSX.utils.json_to_sheet(formattedData);
            worksheet['!cols'] = [
                { wch: 6 },
                { wch: 28 },
                { wch: 14 },
                { wch: 22 },
                { wch: 20 },
                { wch: 10 },
                { wch: 28 },
                { wch: 22 },
                { wch: 22 },
                { wch: 40 },
            ];

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Gate Entries');
            XLSX.writeFile(workbook, `${fileName}.xlsx`);
            return;
        }
    };

    return (
        <Fragment>
            <style>
                {`
                    @media (max-width: 991px) {
                        .ger-main-wrapper {
                            flex-direction: column !important;
                            align-items: flex-start !important;
                            gap: 15px !important;
                        }
                        .ger-controls-wrapper {
                            flex-direction: column !important;
                            width: 100% !important;
                            align-items: stretch !important;
                            gap: 10px !important;
                        }
                        .ger-search-bar {
                            width: 100% !important;
                        }
                    }
                    .ger-table {
                        min-width: 1100px !important;
                    }
                    .ger-table th, .ger-table td {
                        white-space: nowrap !important;
                        vertical-align: middle;
                    }
                    .ger-table th.ger-purpose-col,
                    .ger-table td.ger-purpose-cell {
                        white-space: normal !important;
                        min-width: 180px;
                        max-width: 280px;
                    }
                    @media (min-width: 1400px) {
                        .ger-table th.ger-purpose-col,
                        .ger-table td.ger-purpose-cell {
                            max-width: 350px;
                        }
                    }
                    @media (min-width: 1600px) {
                        .ger-table th.ger-purpose-col,
                        .ger-table td.ger-purpose-cell {
                            max-width: 420px;
                        }
                    }
                    .ger-purpose-text {
                        white-space: pre-wrap !important;
                        word-break: break-word !important;
                        overflow-wrap: anywhere !important;
                        line-height: 1.4;
                    }
                    .ger-tab-pill {
                        border: none;
                        border-radius: 6px;
                        padding: 6px 14px;
                        font-size: 12.5px;
                        font-weight: 500;
                        transition: all 0.2s ease;
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        white-space: nowrap;
                    }
                    .ger-tab-pill.active {
                        background: #0a500f !important;
                        color: #ffffff !important;
                        font-weight: 600;
                        box-shadow: 0 2px 6px rgba(10, 80, 15, 0.35);
                    }
                    .ger-tab-pill.inactive {
                        background: transparent;
                    }
                    .ger-date-field {
                        height: 33px !important;
                        width: 135px !important;
                        font-size: 12px !important;
                        font-weight: 500 !important;
                        border-radius: 6px !important;
                        padding: 4px 10px !important;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    }
                    .ger-date-field::-webkit-calendar-picker-indicator {
                        opacity: 0.65;
                        cursor: pointer;
                        filter: ${isDark ? 'invert(1)' : 'none'};
                        font-size: 13px;
                        padding: 2px;
                    }
                    .ger-date-field::-webkit-calendar-picker-indicator:hover {
                        opacity: 1;
                    }
                `}
            </style>

            <div className={`container-fluid p-0 ${isDark ? 'theme-dark' : 'theme-light'}`}>
                {/* MAIN REPORT CARD (Image 2 style) */}
                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            {/* Card Header matching Vehicle History Logs layout */}
                            <Card.Header className="d-flex justify-content-between align-items-center ger-main-wrapper py-3">
                                <div>
                                    <Card.Title className="mb-0 fs-18">Gate Entry Reports</Card.Title>
                                    {/* <small className="text-muted" style={{ fontSize: '12px' }}>
                                        Real-time visitor, vehicle, and campus movement tracking
                                    </small> */}
                                </div>
                                <div className="d-flex align-items-center gap-2 ger-controls-wrapper">
                                    {/* Search input with search icon */}
                                    <div className="ger-search-bar" style={{ width: '280px', position: 'relative' }}>
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search Gate Entries..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            style={{ height: '37px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />
                                    </div>

                                    {/* Export Buttons matching Image 2 */}
                                    <div className="d-flex gap-2">
                                        <button 
                                            className="btn btn-sm btn-light border" 
                                            style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }} 
                                            onClick={() => handleExport('pdf')} 
                                            title="Export PDF"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                <polyline points="14 2 14 8 20 8"></polyline>
                                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                                <polyline points="10 9 9 9 8 9"></polyline>
                                            </svg>
                                        </button>
                                        <button 
                                            className="btn btn-sm btn-light border" 
                                            style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }} 
                                            onClick={() => handleExport('excel')} 
                                            title="Export Excel"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                <polyline points="14 2 14 8 20 8"></polyline>
                                                <path d="M8 13h2"></path>
                                                <path d="M8 17h2"></path>
                                                <path d="M10 9H8"></path>
                                                <path d="m13 13 3 4"></path>
                                                <path d="m16 13-3 4"></path>
                                            </svg>
                                        </button>
                                        <button 
                                            className="btn btn-sm btn-light border" 
                                            style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }} 
                                            onClick={() => handleExport('print')} 
                                            title="Print"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                                                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                                                <rect x="6" y="14" width="12" height="8"></rect>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </Card.Header>

                            {/* Filter Bar (Date range & presets) */}
                            <div className="px-4 py-2.5 border-bottom">
                                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                                    {/* Quick Date Filters on the left */}
                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                        <div 
                                            className="d-flex align-items-center p-1 rounded-3" 
                                            style={{ 
                                                background: isDark ? '#1e293b' : '#f1f5f9', 
                                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` 
                                            }}
                                        >
                                            {[
                                                { id: 'all', label: 'All Dates' },
                                                { id: 'today', label: 'Today' },
                                                { id: 'week', label: '7 Days' },
                                                { id: 'month', label: 'This Month' },
                                            ].map((df) => (
                                                <button
                                                    key={df.id}
                                                    type="button"
                                                    className="btn btn-sm"
                                                    onClick={() => handleQuickDate(df.id)}
                                                    style={{
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        padding: '4px 12px',
                                                        fontSize: '12px',
                                                        fontWeight: dateQuickFilter === df.id ? '600' : '500',
                                                        background: dateQuickFilter === df.id ? '#0a500f' : 'transparent',
                                                        color: dateQuickFilter === df.id ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
                                                        transition: 'all 0.2s ease',
                                                    }}
                                                >
                                                    {df.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Clean Date Range Inputs */}
                                        <div className="d-flex align-items-center gap-2 ms-2">
                                            <input
                                                type="date"
                                                className="form-control form-control-sm ger-date-field"
                                                value={startDate}
                                                onChange={(e) => {
                                                    setStartDate(e.target.value);
                                                    setDateQuickFilter('custom');
                                                }}
                                                title="Start Date"
                                                style={{
                                                    border: `1px solid ${startDate ? '#0a500f' : (isDark ? '#334155' : '#e2e8f0')}`,
                                                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                                    color: isDark ? '#e2e8f0' : '#1e293b',
                                                    boxShadow: startDate ? '0 0 0 2px rgba(10, 80, 15, 0.15)' : 'none',
                                                }}
                                            />
                                            <span className="text-muted" style={{ fontSize: '12px', fontWeight: '500' }}>to</span>
                                            <input
                                                type="date"
                                                className="form-control form-control-sm ger-date-field"
                                                value={endDate}
                                                onChange={(e) => {
                                                    setEndDate(e.target.value);
                                                    setDateQuickFilter('custom');
                                                }}
                                                title="End Date"
                                                style={{
                                                    border: `1px solid ${endDate ? '#0a500f' : (isDark ? '#334155' : '#e2e8f0')}`,
                                                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                                    color: isDark ? '#e2e8f0' : '#1e293b',
                                                    boxShadow: endDate ? '0 0 0 2px rgba(10, 80, 15, 0.15)' : 'none',
                                                }}
                                            />
                                            {(startDate || endDate) && (
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-link p-0 text-muted text-decoration-none"
                                                    onClick={() => handleQuickDate('all')}
                                                    title="Reset dates"
                                                    style={{ lineHeight: 1 }}
                                                >
                                                    <i className="fa fa-times-circle" style={{ fontSize: '16px', color: isDark ? '#94a3b8' : '#64748b' }}></i>
                                                </button>
                                            )}
                                        </div>

                                        {(searchTerm || startDate || endDate) && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-danger ms-1"
                                                style={{ borderRadius: '6px', fontSize: '11.5px', padding: '4px 10px' }}
                                                onClick={() => {
                                                    setSearchTerm('');
                                                    handleQuickDate('all');
                                                }}
                                                title="Reset all filters"
                                            >
                                                <i className="fa fa-times me-1"></i>Reset
                                            </button>
                                        )}
                                    </div>

                                    {/* Total Count */}
                                    <div className="text-muted small">
                                        <span className="fw-semibold text-dark" style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}>
                                            {filteredRecords.length}
                                        </span> Entries Recorded
                                    </div>
                                </div>
                            </div>

                            {/* Card Body & Table */}
                            <Card.Body>
                                <div className="table-responsive">
                                    <table className="table table-responsive-md ger-table table-hover">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '50px' }}><strong>SL NO.</strong></th>
                                                <th><strong>VISITOR / DRIVER</strong></th>
                                                <th><strong>CATEGORY</strong></th>
                                                <th><strong>COMPANY</strong></th>
                                                <th><strong>VEHICLE NO.</strong></th>
                                                <th className="text-center"><strong>NO. OF PERSONS</strong></th>
                                                <th><strong>HOST OFFICIAL</strong></th>
                                                <th><strong>IN TIME</strong></th>
                                                <th><strong>OUT TIME</strong></th>
                                                <th className="ger-purpose-col"><strong>PURPOSE / REMARKS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loading ? (
                                                <tr>
                                                    <td colSpan="10" className="text-center py-5">
                                                        <div className="spinner-border text-primary" role="status">
                                                            <span className="visually-hidden">Loading...</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : currentData.length === 0 ? (
                                                <tr>
                                                    <td colSpan="10" className="text-center py-5 text-muted">
                                                        <div className="my-2">
                                                            <i className="fa fa-clipboard-list fs-1 opacity-25 d-block mb-2"></i>
                                                            No Gate Entries Found
                                                        </div>
                                                        {(searchTerm || startDate || endDate) && (
                                                            <button 
                                                                className="btn btn-sm btn-outline-primary mt-2" 
                                                                onClick={() => {
                                                                    setSearchTerm('');
                                                                    handleQuickDate('all');
                                                                }}
                                                            >
                                                                Reset Filters
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentData.map((item, index) => {
                                                    // Prepare movement steps for this visitor/entry
                                                    const steps = [];
                                                    if (item.reallocations && item.reallocations.length > 0) {
                                                        // Step 0: Initial visit to original host
                                                        steps.push({
                                                            host_employee: item.host_employee || '—',
                                                            department: item.department || '—',
                                                            from_employee: null,
                                                            in_time: item.entry_time,
                                                            out_time: item.initial_out_time || item.exit_time,
                                                            is_handover: true,
                                                            is_campus_exit: false,
                                                            purpose: item.purpose || '—',
                                                        });

                                                        // Step 1..n: Reallocated departments & hosts
                                                        item.reallocations.forEach((r, rIdx) => {
                                                            const isLast = rIdx === item.reallocations.length - 1;
                                                            const isCampusExit = Boolean(isLast && item.exit_time && r.out_time === item.exit_time);
                                                            steps.push({
                                                                host_employee: r.to_employee || r.host_employee || '—',
                                                                department: r.to_department || r.department || '—',
                                                                from_employee: r.from_employee && r.from_employee !== '—' ? r.from_employee : null,
                                                                in_time: r.in_time,
                                                                out_time: r.out_time,
                                                                is_handover: !isLast,
                                                                is_campus_exit: isCampusExit,
                                                                purpose: r.reason || 'Reallocated',
                                                            });
                                                        });
                                                    } else {
                                                        // Single Step: Direct entry without reallocations
                                                        steps.push({
                                                            host_employee: item.host_employee || '—',
                                                            department: item.department || '—',
                                                            from_employee: null,
                                                            in_time: item.entry_time,
                                                            out_time: item.exit_time,
                                                            is_handover: false,
                                                            is_campus_exit: Boolean(item.exit_time),
                                                            purpose: item.purpose || '—',
                                                        });
                                                    }

                                                    const isEvenGroup = index % 2 === 1;
                                                    const groupBg = isEvenGroup ? (isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.018)') : 'transparent';

                                                    return steps.map((step, sIdx) => {
                                                        const isFirstStep = sIdx === 0;
                                                        const isLastStep = sIdx === steps.length - 1;

                                                        return (
                                                            <tr
                                                                key={`${item.id}_step_${sIdx}`}
                                                                style={{
                                                                    backgroundColor: groupBg,
                                                                    borderBottom: isLastStep 
                                                                        ? `2px solid ${isDark ? '#334155' : '#e2e8f0'}` 
                                                                        : `1px dashed ${isDark ? '#1e293b' : '#f1f5f9'}`,
                                                                }}
                                                            >
                                                                {isFirstStep && (
                                                                    <>
                                                                        <td rowSpan={steps.length} className="align-middle">
                                                                            <strong>{indexOfFirstItem + index + 1}</strong>
                                                                        </td>
                                                                        <td rowSpan={steps.length} className="align-middle">
                                                                            <div className="d-flex flex-column">
                                                                                <span className="fw-semibold text-primary">{item.name}</span>
                                                                                {item.mobile && item.mobile !== '—' && (
                                                                                    <small className="text-muted" style={{ fontSize: '11px' }}>
                                                                                        <i className="fa fa-phone me-1 opacity-50"></i>{item.mobile}
                                                                                    </small>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td rowSpan={steps.length} className="align-middle">
                                                                            <span 
                                                                                className="badge light"
                                                                                style={{ 
                                                                                    backgroundColor: `${item.category_color}18`, 
                                                                                    color: item.category_color || '#0a500f',
                                                                                    border: `1px solid ${item.category_color}40`,
                                                                                    fontSize: '11.5px'
                                                                                }}
                                                                            >
                                                                                {item.category}
                                                                            </span>
                                                                        </td>
                                                                        <td rowSpan={steps.length} className="align-middle">{item.company}</td>
                                                                        <td rowSpan={steps.length} className="align-middle">{renderVehicleNumber(item.vehicle_number, item.id)}</td>
                                                                        <td rowSpan={steps.length} className="align-middle text-center">
                                                                            <span 
                                                                                className="badge rounded-pill fw-semibold"
                                                                                style={{ 
                                                                                    background: isDark ? '#334155' : '#f1f5f9',
                                                                                    color: isDark ? '#e2e8f0' : '#475569',
                                                                                    fontSize: '12px',
                                                                                    padding: '4px 10px',
                                                                                    border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`
                                                                                }}
                                                                            >
                                                                                {item.number_of_persons || 1}
                                                                            </span>
                                                                        </td>
                                                                    </>
                                                                )}

                                                                {/* Step / Movement Columns */}
                                                                <td className="align-middle">
                                                                    <div className="d-flex flex-column">
                                                                        <span className="fw-semibold">{step.host_employee}</span>
                                                                        {step.department && step.department !== '—' && (
                                                                            <small className="text-muted" style={{ fontSize: '11px' }}>
                                                                                {step.department}
                                                                            </small>
                                                                        )}
                                                                        {step.from_employee && (
                                                                            <small className="text-muted" style={{ fontSize: '10px' }}>
                                                                                (Handover from: {step.from_employee})
                                                                            </small>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="align-middle" style={{ fontSize: '12px' }}>
                                                                    {renderDateTime2Lines(step.in_time)}
                                                                </td>
                                                                <td className="align-middle" style={{ fontSize: '12px' }}>
                                                                    {step.out_time ? (
                                                                        <div className="d-flex flex-column" style={{ lineHeight: '1.3' }}>
                                                                            {renderDateTime2Lines(step.out_time)}
                                                                            {step.is_handover && (
                                                                                <small className="text-warning fw-medium" style={{ fontSize: '10px' }}>
                                                                                    <i className="fa fa-share me-1"></i>Handover
                                                                                </small>
                                                                            )}
                                                                            {step.is_campus_exit && (
                                                                                <small className="text-success fw-medium" style={{ fontSize: '10px' }}>
                                                                                    <i className="fa fa-sign-out-alt me-1"></i>Campus Exit
                                                                                </small>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="badge badge-success light">
                                                                            {item.entry_type === 'appointment' ? 'Scheduled' : 'Inside'}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td 
                                                                    className="align-middle ger-purpose-cell"
                                                                    style={{ fontSize: '12px' }}
                                                                    title={step.purpose}
                                                                >
                                                                    <div className="ger-purpose-text">
                                                                        {step.purpose}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    });
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination matching Image 2 */}
                                {totalItems > 0 && (
                                    <div className="d-flex justify-content-between align-items-center mt-3 mb-2 flex-wrap gap-2">
                                        <div className="text-muted" style={{ fontSize: '13px' }}>
                                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, totalItems)} of {totalItems} entries
                                        </div>
                                        {totalPages > 1 && (
                                            <nav>
                                                <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                    <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                        <button 
                                                            type="button" 
                                                            className="page-link" 
                                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                                                            disabled={currentPage === 1} 
                                                            style={{ border: 'none', background: 'none' }}
                                                        >
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
                                                                    <button 
                                                                        type="button" 
                                                                        className="page-link" 
                                                                        onClick={() => setCurrentPage(pageNumber)} 
                                                                        style={{ border: 'none' }}
                                                                    >
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
                                                        <button 
                                                            type="button" 
                                                            className="page-link" 
                                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                                                            disabled={currentPage === totalPages} 
                                                            style={{ border: 'none', background: 'none' }}
                                                        >
                                                            <i className="la la-angle-right" />
                                                        </button>
                                                    </li>
                                                </ul>
                                            </nav>
                                        )}
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    </div>
                </div>
            </div>
        </Fragment>
    );
};

export default GateEntryReport;
