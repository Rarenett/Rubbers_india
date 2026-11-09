import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/**
 * Export data to PDF
 * @param {Array} data - Filtered data to export
 * @param {Array} columns - Column definitions { header: string, dataKey: string }
 * @param {string} fileName - Name of the file
 * @param {string} title - Title of the document
 * @param {boolean} autoIndex - Whether to automatically add a row number column
 */
export const exportToPDF = (data, columns, fileName = 'export.pdf', title = 'Report', autoIndex = true) => {
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(18);
    doc.text(title, 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    // Prepare table data
    const tableRows = data.map((item, index) => {
        const row = autoIndex ? { index: index + 1 } : {};
        columns.forEach(col => {
            row[col.dataKey] = col.formatter ? col.formatter(item[col.dataKey], item) : item[col.dataKey];
        });
        return row;
    });

    const tableColumns = autoIndex
        ? [{ header: '#', dataKey: 'index' }, ...columns.map(col => ({ header: col.header, dataKey: col.dataKey }))]
        : columns.map(col => ({ header: col.header, dataKey: col.dataKey }));

    autoTable(doc, {
        startY: 40,
        columns: tableColumns,
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [0, 209, 255] }, // Match --fd-accent
        styles: { fontSize: 9 },
        margin: { top: 40 }
    });

    doc.save(fileName);
};

/**
 * Export data to Excel
 * @param {Array} data - Filtered data to export
 * @param {Array} columns - Column definitions { header: string, dataKey: string }
 * @param {string} fileName - Name of the file
 * @param {boolean} autoIndex - Whether to automatically add a row number column
 */
export const exportToExcel = (data, columns, fileName = 'export.xlsx', autoIndex = true) => {
    const formattedData = data.map((item, index) => {
        const row = autoIndex ? { '#': index + 1 } : {};
        columns.forEach(col => {
            row[col.header] = col.formatter ? col.formatter(item[col.dataKey], item) : item[col.dataKey];
        });
        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

    XLSX.writeFile(workbook, fileName);
};

/**
 * Print data
 * @param {Array} data - Filtered data to print
 * @param {Array} columns - Column definitions { header: string, dataKey: string }
 * @param {string} title - Title of the document
 * @param {boolean} autoIndex - Whether to automatically add a row number column
 */
export const printData = (data, columns, title = 'Report', autoIndex = true) => {
    const printWindow = window.open('', '_blank');
    const html = `
        <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; }
                    h1 { color: #333; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                    th { background-color: #f8f9fa; color: #333; font-weight: 600; }
                    tr:nth-child(even) { background-color: #fafafa; }
                    .header { margin-bottom: 30px; border-bottom: 2px solid #00d1ff; padding-bottom: 10px; }
                    .timestamp { color: #888; font-size: 0.9rem; }
                    @media print {
                        .no-print { display: none; }
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${title}</h1>
                    <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            ${autoIndex ? '<th>#</th>' : ''}
                            ${columns.map(col => `<th>${col.header}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map((item, index) => `
                            <tr>
                                ${autoIndex ? `<td>${index + 1}</td>` : ''}
                                ${columns.map(col => `<td>${col.formatter ? col.formatter(item[col.dataKey], item) : (item[col.dataKey] || '—')}</td>`).join('')}
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
};

const generateDetailedPDFDoc = (data, title) => {
    const doc = new jsPDF();

    const grouped = data.reduce((acc, item) => {
        const dept = item.employee_department || item.department_name_details || 'Unassigned Department';
        if (!acc[dept]) acc[dept] = {};

        const emp = item.employee_name || 'Unknown Employee';
        if (!acc[dept][emp]) acc[dept][emp] = [];

        acc[dept][emp].push(item);
        return acc;
    }, {});

    let yPos = 20;
    const pageHeight = doc.internal.pageSize.height;

    const checkPageBreak = (neededHeight) => {
        if (yPos + neededHeight > pageHeight - 20) {
            doc.addPage();
            yPos = 20;
        }
    };

    const pageWidth = doc.internal.pageSize.width;

    // Center title
    doc.setFontSize(24);
    doc.setTextColor(17, 24, 39);
    doc.setFont("helvetica", "bold");
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - titleWidth) / 2, yPos);
    yPos += 8;

    // Center timestamp
    doc.setFontSize(12);
    doc.setTextColor(107, 114, 128);
    doc.setFont("helvetica", "normal");
    const now = new Date();
    const formattedNow = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}, ${now.toLocaleTimeString()}`;
    const timestampText = `Generated on: ${formattedNow}`;
    const timestampWidth = doc.getTextWidth(timestampText);
    doc.text(timestampText, (pageWidth - timestampWidth) / 2, yPos);
    yPos += 8;

    // Draw horizontal line
    doc.setDrawColor(51, 51, 51);
    doc.setLineWidth(0.5);
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 15;

    for (const [dept, employees] of Object.entries(grouped)) {
        checkPageBreak(15);
        doc.setFontSize(14);
        doc.setTextColor(0, 102, 204);
        doc.setFont("helvetica", "bold");
        doc.text(dept, 14, yPos);
        yPos += 10;

        for (const [emp, assignments] of Object.entries(employees)) {
            checkPageBreak(12);
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "bold");
            doc.text(emp, 20, yPos);
            yPos += 8;

            assignments.forEach(assign => {
                checkPageBreak(10);
                doc.setFontSize(11);
                doc.setTextColor(50, 50, 50);

                // Bold "Duty:"
                doc.setFont("helvetica", "bold");
                doc.text("Duty: ", 25, yPos);
                const prefixWidth = doc.getTextWidth("Duty: ");

                doc.setFont("helvetica", "normal");

                let formattedStart = 'N/A';
                if (assign.start_date) {
                    const parts = assign.start_date.split('-');
                    if (parts.length === 3) {
                        formattedStart = `${parts[2]}/${parts[1]}/${parts[0]}`;
                    } else {
                        formattedStart = assign.start_date;
                    }
                }

                let dutyEndDate = null;
                if (assign.responsibility_details && assign.responsibility_details.length > 0) {
                    const allEnded = assign.responsibility_details.every(resp =>
                        assign.ended_statuses?.find(s => s.employee_id === assign.employee_id && s.responsibility_id === resp.id && s.end_date)
                    );

                    if (allEnded) {
                        const endDates = assign.responsibility_details.map(resp => {
                            const ended = assign.ended_statuses.find(s => s.employee_id === assign.employee_id && s.responsibility_id === resp.id);
                            return ended.end_date;
                        });
                        const maxDateStr = endDates.sort().reverse()[0];
                        const parts = maxDateStr.split('-');
                        if (parts.length === 3) {
                            dutyEndDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                        } else {
                            dutyEndDate = maxDateStr;
                        }
                    }
                }

                let restOfDutyText = `${assign.dutyname_name || 'N/A'}`;
                if (assign.dutyname_remarks) restOfDutyText += ` (Remark: ${assign.dutyname_remarks})`;
                if (dutyEndDate) {
                    restOfDutyText += `  [${formattedStart} - ${dutyEndDate}]`;
                } else {
                    restOfDutyText += `  [${formattedStart}]`;
                }

                const dutyLines = doc.splitTextToSize(restOfDutyText, 160 - prefixWidth);
                doc.text(dutyLines, 25 + prefixWidth, yPos);
                yPos += 6 * dutyLines.length + 1;

                if (assign.responsibility_details && assign.responsibility_details.length > 0) {
                    assign.responsibility_details.forEach(resp => {
                        checkPageBreak(7);
                        doc.setFontSize(10);
                        doc.setTextColor(80, 80, 80);
                        let respText = `- ${resp.name}`;
                        if (resp.remarks) respText += ` (Remark: ${resp.remarks})`;

                        const ended = assign.ended_statuses?.find(s => s.employee_id === assign.employee_id && s.responsibility_id === resp.id);
                        if (ended && ended.end_date) {
                            const p = ended.end_date.split('-');
                            const formattedEnd = p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ended.end_date;
                            respText += ` (Ended: ${formattedEnd})`;
                        }

                        const lines = doc.splitTextToSize(respText, 160);
                        doc.text(lines, 30, yPos);
                        yPos += 6 * lines.length;
                    });
                } else {
                    checkPageBreak(7);
                    doc.setFontSize(10);
                    doc.setTextColor(150, 150, 150);
                    doc.text("No responsibilities assigned.", 30, yPos);
                    yPos += 6;
                }
                yPos += 2;
            });
            yPos += 4;
        }
        yPos += 6;
    }

    return doc;
};

export const printDetailedData = (data, title = 'Detailed Report') => {
    const doc = generateDetailedPDFDoc(data, title);
    doc.autoPrint();
    const blobURL = doc.output('bloburl');
    window.open(blobURL, '_blank');
};

export const exportDetailedToPDF = (data, title = 'Detailed Report', fileName = 'detailed_duty_report.pdf') => {
    const doc = generateDetailedPDFDoc(data, title);
    doc.save(fileName);
};

const formatSafeDate = (d) => {
    if (!d) return 'N/A';
    try {
        const parsed = new Date(d);
        if (isNaN(parsed.getTime())) return String(d);
        return parsed.toLocaleDateString('en-IN');
    } catch {
        return String(d);
    }
};

const formatSafeDateTime = (d) => {
    if (!d) return 'N/A';
    try {
        const parsed = new Date(d);
        if (isNaN(parsed.getTime())) return String(d);
        return parsed.toLocaleString('en-IN');
    } catch {
        return String(d);
    }
};

/**
 * Export Individual Sales Order to PDF
 * @param {object} order - Single Sales Order object
 */
export const exportIndividualOrderPDF = (order = {}) => {
    const doc = new jsPDF();
    const orderNo = order.so_no || order.order_no || `SO-${order.id || 'Draft'}`;

    // Header Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 22, 36);
    doc.text("SALES ORDER", 14, 20);

    // Accent line below title
    doc.setDrawColor(59, 91, 219);
    doc.setLineWidth(1);
    doc.line(14, 24, doc.internal.pageSize.width - 14, 24);

    // Order Meta Header (2 columns)
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(107, 114, 128);
    doc.text("ORDER DETAILS:", 14, 32);
    doc.text("CUSTOMER DETAILS:", 110, 32);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);

    let leftY = 38;
    doc.setFont("helvetica", "bold"); doc.text("Order No:", 14, leftY);
    doc.setFont("helvetica", "normal"); doc.text(String(orderNo), 42, leftY); leftY += 6;

    doc.setFont("helvetica", "bold"); doc.text("Entry Date:", 14, leftY);
    doc.setFont("helvetica", "normal"); doc.text(formatSafeDate(order.entry_date), 42, leftY); leftY += 6;

    doc.setFont("helvetica", "bold"); doc.text("Delivery Date:", 14, leftY);
    doc.setFont("helvetica", "normal"); doc.text(formatSafeDateTime(order.preferred_delivery_date), 42, leftY); leftY += 6;

    doc.setFont("helvetica", "bold"); doc.text("Location:", 14, leftY);
    doc.setFont("helvetica", "normal"); doc.text(String(order.delivery_location || 'N/A'), 42, leftY); leftY += 6;

    let rightY = 38;
    doc.setFont("helvetica", "bold"); doc.text("Customer:", 110, rightY);
    doc.setFont("helvetica", "normal"); doc.text(String(order.customer_ledger_name || order.customer_name || 'N/A'), 138, rightY); rightY += 6;

    doc.setFont("helvetica", "bold"); doc.text("Driver:", 110, rightY);
    doc.setFont("helvetica", "normal"); doc.text(String(order.driver_name || '—'), 138, rightY); rightY += 6;

    doc.setFont("helvetica", "bold"); doc.text("Vehicle:", 110, rightY);
    doc.setFont("helvetica", "normal"); doc.text(String(order.dispatch_through || '—'), 138, rightY); rightY += 6;

    doc.setFont("helvetica", "bold"); doc.text("Status:", 110, rightY);
    doc.setFont("helvetica", "normal"); doc.text(String(`${order.status || 'Pending'} (${order.approval_status || 'Pending'})`), 138, rightY); rightY += 6;

    // Table of items
    const items = Array.isArray(order.items) ? order.items : [];
    const tableRows = items.map((item, idx) => [
        idx + 1,
        item.product_name || item.item_name || item.product || 'Product',
        item.hsn || '-',
        item.quantity || item.qty || 0,
        item.per_name || item.unit_name || item.unit || '',
        `${parseFloat(item.rate || 0).toFixed(2)}`,
        item.gst_percent ? `${item.gst_percent}%` : '0%',
        `${parseFloat(item.amount || item.total_amount || 0).toFixed(2)}`
    ]);

    autoTable(doc, {
        startY: Math.max(leftY, rightY) + 6,
        head: [['#', 'Product Name', 'HSN', 'Qty', 'Unit', 'Rate', 'GST %', 'Amount']],
        body: tableRows.length > 0 ? tableRows : [['—', 'No items listed', '—', '—', '—', '—', '—', '—']],
        theme: 'grid',
        headStyles: { fillColor: [59, 91, 219], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2.5 },
        columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 'auto' },
            5: { halign: 'right' },
            6: { halign: 'center' },
            7: { halign: 'right' }
        }
    });

    const finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 80) + 10;
    const rightMargin = doc.internal.pageSize.width - 14;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 22, 36);
    const totalStr = `Total Amount: ${parseFloat(order.total_amount || 0).toFixed(2)}`;
    const totalWidth = doc.getTextWidth(totalStr);
    doc.text(totalStr, rightMargin - totalWidth, finalY);

    if (order.approval_status === 'Not Approved' && order.rest_amount_to_pay > 0) {
        doc.setFontSize(9);
        doc.setTextColor(220, 38, 38);
        const restStr = `Rest Amount To Pay: ${parseFloat(order.rest_amount_to_pay).toFixed(2)}`;
        const restWidth = doc.getTextWidth(restStr);
        doc.text(restStr, rightMargin - restWidth, finalY + 6);
    }

    if (order.narration) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100);
        doc.text("Narration / Notes:", 14, finalY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50);
        doc.text(String(order.narration), 14, finalY + 6);
    }

    doc.save(`${orderNo}.pdf`);
};

/**
 * Export Individual Sales Order to Excel
 * @param {object} order - Single Sales Order object
 */
export const exportIndividualOrderExcel = (order = {}) => {
    const orderNo = order.so_no || order.order_no || `SO-${order.id || 'Draft'}`;
    const items = Array.isArray(order.items) ? order.items : [];

    const wsData = [
        ["SALES ORDER DETAIL REPORT"],
        [],
        ["Order No:", orderNo, "", "Customer:", order.customer_ledger_name || order.customer_name || 'N/A'],
        ["Entry Date:", formatSafeDate(order.entry_date), "", "Status:", `${order.status || 'Pending'} (${order.approval_status || 'Pending'})`],
        ["Delivery Date:", formatSafeDateTime(order.preferred_delivery_date), "", "Driver:", order.driver_name || '—'],
        ["Delivery Location:", order.delivery_location || 'N/A', "", "Vehicle:", order.dispatch_through || '—'],
        [],
        ["#", "Product Name", "HSN", "Qty", "Unit", "Rate (INR)", "GST %", "Amount (INR)"],
        ...items.map((item, idx) => [
            idx + 1,
            item.product_name || item.item_name || item.product || 'Product',
            item.hsn || '-',
            item.quantity || item.qty || 0,
            item.per_name || item.unit_name || item.unit || '',
            parseFloat(item.rate || 0).toFixed(2),
            item.gst_percent ? `${item.gst_percent}%` : '0%',
            parseFloat(item.amount || item.total_amount || 0).toFixed(2)
        ]),
        [],
        ["", "", "", "", "", "", "TOTAL AMOUNT (INR):", parseFloat(order.total_amount || 0).toFixed(2)]
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(wsData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Order');
    XLSX.writeFile(workbook, `${orderNo}.xlsx`);
};

/**
 * Print Individual Sales Order
 * @param {object} order - Single Sales Order object
 */
export const printIndividualOrder = (order = {}) => {
    const orderNo = order.so_no || order.order_no || `SO-${order.id || 'Draft'}`;
    const items = Array.isArray(order.items) ? order.items : [];
    const printWindow = window.open('', '_blank');

    const itemsHtml = items.length > 0 ? items.map((item, idx) => `
        <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td>${item.product_name || item.item_name || item.product || 'Product'}</td>
            <td style="text-align: center;">${item.hsn || '-'}</td>
            <td style="text-align: right;">${item.quantity || item.qty || 0}</td>
            <td style="text-align: center;">${item.per_name || item.unit_name || item.unit || ''}</td>
            <td style="text-align: right;">${parseFloat(item.rate || 0).toFixed(2)}</td>
            <td style="text-align: center;">${item.gst_percent ? `${item.gst_percent}%` : '0%'}</td>
            <td style="text-align: right; font-weight: bold;">${parseFloat(item.amount || item.total_amount || 0).toFixed(2)}</td>
        </tr>
    `).join('') : `<tr><td colspan="8" style="text-align: center; color: #888;">No items listed</td></tr>`;

    const html = `
        <html>
            <head>
                <title>SALES ORDER - ${orderNo}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1e293b; }
                    .header-top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #3b5bdb; padding-bottom: 15px; margin-bottom: 25px; }
                    .title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
                    .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
                    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; background: #f8fafc; padding: 18px; border-radius: 8px; border: 1px solid #e2e8f0; }
                    .meta-row { font-size: 13px; margin-bottom: 6px; }
                    .meta-label { font-weight: 700; color: #475569; display: inline-block; width: 130px; }
                    .meta-val { color: #0f172a; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #cbd5e1; padding: 10px 12px; font-size: 13px; }
                    th { background-color: #f1f5f9; color: #1e293b; font-weight: 700; text-align: left; }
                    tr:nth-child(even) { background-color: #f8fafc; }
                    .footer-summary { margin-top: 25px; display: flex; justify-content: flex-end; }
                    .total-box { background: #3b5bdb; color: #ffffff; padding: 12px 24px; border-radius: 8px; font-size: 16px; font-weight: 800; }
                    .narration { margin-top: 20px; font-size: 13px; color: #475569; }
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header-top">
                    <div>
                        <h1 class="title">SALES ORDER</h1>
                        <div class="subtitle">Order No: <strong>${orderNo}</strong></div>
                    </div>
                    <div style="text-align: right; font-size: 13px; color: #64748b;">
                        <div>Date: <strong>${formatSafeDate(order.entry_date)}</strong></div>
                        <div>Status: <strong>${order.status || 'Pending'} (${order.approval_status || 'Pending'})</strong></div>
                    </div>
                </div>

                <div class="meta-grid">
                    <div>
                        <div class="meta-row"><span class="meta-label">Customer Name:</span> <span class="meta-val">${order.customer_ledger_name || order.customer_name || 'N/A'}</span></div>
                        <div class="meta-row"><span class="meta-label">Delivery Date:</span> <span class="meta-val">${formatSafeDateTime(order.preferred_delivery_date)}</span></div>
                        <div class="meta-row"><span class="meta-label">Delivery Location:</span> <span class="meta-val">${order.delivery_location || 'N/A'}</span></div>
                    </div>
                    <div>
                        <div class="meta-row"><span class="meta-label">Driver:</span> <span class="meta-val">${order.driver_name || '—'}</span></div>
                        <div class="meta-row"><span class="meta-label">Vehicle / Dispatch:</span> <span class="meta-val">${order.dispatch_through || '—'}</span></div>
                        <div class="meta-row"><span class="meta-label">Approval Status:</span> <span class="meta-val">${order.approval_status || 'Pending'}</span></div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 40px; text-align: center;">#</th>
                            <th>Product Name</th>
                            <th style="width: 80px; text-align: center;">HSN</th>
                            <th style="width: 70px; text-align: right;">Qty</th>
                            <th style="width: 60px; text-align: center;">Unit</th>
                            <th style="width: 100px; text-align: right;">Rate</th>
                            <th style="width: 70px; text-align: center;">GST %</th>
                            <th style="width: 110px; text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div class="footer-summary">
                    <div class="total-box">
                        Total Amount: ${parseFloat(order.total_amount || 0).toFixed(2)}
                    </div>
                </div>

                ${order.narration ? `<div class="narration"><strong>Notes / Narration:</strong> ${order.narration}</div>` : ''}

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
};

export const exportIndividualInvoicePDF = (invoice) => exportIndividualOrderPDF({ ...invoice, isInvoice: true });
export const exportIndividualInvoiceExcel = (invoice) => exportIndividualOrderExcel({ ...invoice, isInvoice: true });
export const printIndividualInvoice = (invoice) => printIndividualOrder({ ...invoice, isInvoice: true });

