import jsPDF from 'jspdf';

/**
 * Format ISO datetime string to Indian locale standard display: DD/MM/YYYY, hh:mm A
 */
export const formatCardDateTime = (dateStr) => {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return String(dateStr);
        return d.toLocaleString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }).replace(',', '');
    } catch {
        return String(dateStr);
    }
};

/**
 * Calculate human-readable duration between entry and exit times
 */
export const formatCardDuration = (entryTime, exitTime, durationOverride = null) => {
    if (durationOverride) return durationOverride;
    if (!entryTime || !exitTime) return '—';
    try {
        const start = new Date(entryTime);
        const end = new Date(exitTime);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return '—';
        const diffMs = Math.max(0, end - start);
        const totalMinutes = Math.floor(diffMs / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        if (hours > 0) {
            return `${hours} hr${hours > 1 ? 's' : ''} ${mins} min${mins !== 1 ? 's' : ''}`;
        }
        return `${mins} min${mins !== 1 ? 's' : ''}`;
    } catch {
        return '—';
    }
};

/**
 * Sanitize string for PDF filename
 */
const cleanForFilename = (str) => {
    if (!str) return 'Card';
    return String(str).trim().replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
};

/* =========================================================================
   DIRECT PRINTER ENGINE (Physical Connected Printer / Thermal / Card Printer)
   Uses in-DOM hidden iframe with native CSS @page { size: 50mm 80mm; margin: 0; }
   bypassing popup blockers and printing directly to the default connected printer.
   ========================================================================= */

/**
 * Sends one or multiple 50mm x 80mm HTML cards directly to the system's connected printer.
 * @param {string|string[]} cardHtmls - One or an array of card HTML fragments
 * @param {string} [title] - Print job title
 */
export const printCardHtml = (cardHtmls, title = 'Gate Card') => {
    if (typeof window === 'undefined') return false;

    const cardsArray = Array.isArray(cardHtmls) ? cardHtmls : [cardHtmls];
    if (cardsArray.length === 0) return false;

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
        @page {
            size: 50mm 80mm;
            margin: 0;
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        html, body {
            width: 50mm;
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #000000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            overflow: hidden;
        }
        @media print {
            body {
                width: 50mm !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
            }
            .card-page {
                page-break-after: always !important;
                break-after: page !important;
            }
            .card-page:last-child {
                page-break-after: avoid !important;
                break-after: avoid !important;
            }
        }
    </style>
</head>
<body>
    ${cardsArray.join('')}
</body>
</html>`;

    let iframe = document.getElementById('gate-card-print-iframe');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'gate-card-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.zIndex = '-9999';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);
    }

    try {
        const frameDoc = iframe.contentWindow.document;
        frameDoc.open();
        frameDoc.write(fullHtml);
        frameDoc.close();

        setTimeout(() => {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (err) {
                console.error('Direct iframe print error, falling back to window.open:', err);
                const win = window.open('', '_blank', 'width=450,height=650');
                if (win) {
                    win.document.open();
                    win.document.write(fullHtml);
                    win.document.close();
                    win.focus();
                    win.print();
                }
            }
        }, 150);
        return true;
    } catch (e) {
        console.error('Failed to trigger card print via iframe:', e);
        return false;
    }
};

/**
 * Generates structured 50mm x 80mm HTML fragment for an Entry Card
 */
export const generateEntryCardHtml = (data) => {
    if (!data) return '';

    const vehicleNumber = (
        data.vehicle_number ||
        data.vehicle?.vehicle_number ||
        data.vehicles?.[0]?.vehicle_number ||
        data.visitor_name ||
        data.visitor?.visitor_name ||
        data.employee_name ||
        'VISITOR'
    ).trim().toUpperCase();

    const entryTime = data.entry_time || data.created_at || new Date().toISOString();
    const formattedEntryTime = formatCardDateTime(entryTime);

    const parkAreaName = (
        data.park_area_name ||
        data.park_area?.name ||
        (typeof data.park_area === 'string' ? data.park_area : '') ||
        ''
    ).trim();

    const parkingSlotNum = (
        data.parking_slot_number ||
        data.parking_slot?.slot_number ||
        data.slot_number ||
        ''
    );

    const parkingLocation = parkAreaName
        ? `${parkAreaName}${parkingSlotNum ? ` (Slot ${parkingSlotNum})` : ''}`
        : (data.parking_location_display || data.parking_location || '');

    const tagNumber = (
        data.tag_code ||
        data.tag_number ||
        data.pass_number ||
        data.generated_tag?.tag_number ||
        data.generated_tag ||
        ''
    );
    const visitorName = (
        data.visitor_name ||
        data.visitor?.visitor_name ||
        data.employee_name ||
        ''
    );
    const departmentName = (
        data.department_name ||
        data.department?.name ||
        ''
    );

    let extraDetails = '';
    if (tagNumber && tagNumber !== 'N/A') extraDetails += `Pass #${tagNumber} `;
    if (visitorName && visitorName.toUpperCase() !== vehicleNumber) {
        extraDetails += `• ${visitorName} `;
    }
    if (departmentName) extraDetails += `(${departmentName})`;

    const signatureMediaHtml = data.signature 
        ? `<img src="${data.signature}" alt="Signature" style="max-height: 22px; max-width: 100%; object-fit: contain; margin-bottom: 2px;" />`
        : '';

    return `
    <div class="card-page" style="width: 50mm; height: 80mm; box-sizing: border-box; margin: 0 auto; padding: 2.8mm 3mm; background: #ffffff; color: #000000; display: flex; flex-direction: column; position: relative; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; overflow: hidden;">
        <!-- Top Emerald Stripe -->
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 2.8mm; background: #2ece8a;"></div>
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 1.2mm; margin-bottom: 0.8mm;">
            <span style="font-weight: 800; font-size: 11px; letter-spacing: 0.5px; color: #1f2937;">GLENDA</span>
            <span style="font-weight: 700; font-size: 9.5px; letter-spacing: 0.5px; color: #111827;">ENTRY CARD</span>
        </div>
        <div style="width: 100%; border-bottom: 1px solid #e2e8f0; margin-bottom: 1.5mm;"></div>

        <!-- Body -->
        <div style="display: flex; flex-direction: column; gap: 1.4mm;">
            <div>
                <div style="font-size: 6.8px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 0.3mm;">VEHICLE NUMBER</div>
                <div style="font-size: 12px; font-weight: 800; color: #0f172a; word-break: break-all; line-height: 1.1;">${vehicleNumber}</div>
            </div>

            <div>
                <div style="font-size: 6.8px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 0.3mm;">ENTRY TIME</div>
                <div style="font-size: 9px; font-weight: 700; color: #1e293b; line-height: 1.1;">${formattedEntryTime}</div>
            </div>

            ${parkingLocation ? `
            <div>
                <div style="font-size: 6.8px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 0.3mm;">PARKING LOCATION</div>
                <div style="font-size: 8.8px; font-weight: 700; color: #1e293b; word-break: break-all; line-height: 1.1;">${parkingLocation}</div>
            </div>` : ''}

            ${extraDetails.trim() ? `
            <div>
                <div style="font-size: 6.8px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 0.3mm;">VISITOR / PASS</div>
                <div style="font-size: 8px; font-weight: 600; color: #334155; word-break: break-all; line-height: 1.1;">${extraDetails.trim()}</div>
            </div>` : ''}
        </div>

        <!-- Footer & Signature -->
        <div style="margin-top: auto; display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: flex-end; margin-bottom: 1.8mm;">
                <div style="width: 24mm; text-align: center;">
                    ${signatureMediaHtml}
                    <div style="border-top: 1px solid #cbd5e1; padding-top: 0.5mm; font-size: 6.2px; font-weight: 700; color: #64748b;">SIGNATURE</div>
                </div>
            </div>
            <div style="border-top: 1px solid #1f2937; padding-top: 0.8mm; text-align: center; font-size: 8.8px; font-weight: 800; color: #333;">
                Thank You
            </div>
        </div>
    </div>`;
};

/**
 * Generates structured 50mm x 80mm HTML fragment for an Exit Card
 */
export const generateExitCardHtml = (data) => {
    if (!data) return '';

    const vehicleNumber = (
        data.vehicle_number ||
        data.entry_card?.vehicle_number ||
        data.vehicle?.vehicle_number ||
        data.vehicles?.[0]?.vehicle_number ||
        data.visitor_name ||
        data.visitor?.visitor_name ||
        data.employee_name ||
        'VISITOR'
    ).trim().toUpperCase();

    const entryTime = data.entry_time || data.entry_card?.entry_time || data.created_at;
    const exitTime = data.exit_time || new Date().toISOString();

    const formattedEntryTime = formatCardDateTime(entryTime);
    const formattedExitTime = formatCardDateTime(exitTime);

    const parkAreaName = (
        data.park_area_name ||
        data.entry_card?.park_area_name ||
        data.park_area?.name ||
        (typeof data.park_area === 'string' ? data.park_area : '') ||
        ''
    ).trim();

    const parkingSlotNum = (
        data.parking_slot_number ||
        data.entry_card?.parking_slot_number ||
        data.parking_slot?.slot_number ||
        data.slot_number ||
        ''
    );

    const parkingLocation = parkAreaName
        ? `${parkAreaName}${parkingSlotNum ? ` (Slot ${parkingSlotNum})` : ''}`
        : (data.parking_location_display || data.parking_location || '');

    const durationFormatted = formatCardDuration(
        entryTime,
        exitTime,
        data.duration_formatted || data.stay_duration
    );

    let feeNumber = 0;
    if (data.parking_fee !== undefined && data.parking_fee !== null) {
        feeNumber = Number(data.parking_fee);
    } else if (data.entry_card?.parking_fee !== undefined) {
        feeNumber = Number(data.entry_card.parking_fee);
    }
    const feeStr = isNaN(feeNumber) ? '0.00' : feeNumber.toFixed(2);

    const signatureMediaHtml = data.signature 
        ? `<img src="${data.signature}" alt="Signature" style="max-height: 22px; max-width: 100%; object-fit: contain; margin-bottom: 2px;" />`
        : '';

    return `
    <div class="card-page" style="width: 50mm; height: 80mm; box-sizing: border-box; margin: 0 auto; padding: 2.8mm 3mm; background: #ffffff; color: #000000; display: flex; flex-direction: column; position: relative; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; overflow: hidden;">
        <!-- Top Blue Stripe -->
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 2.8mm; background: #2563eb;"></div>
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 1.2mm; margin-bottom: 0.8mm;">
            <span style="font-weight: 800; font-size: 11px; letter-spacing: 0.5px; color: #1f2937;">GLENDA</span>
            <span style="font-weight: 700; font-size: 9.5px; letter-spacing: 0.5px; color: #111827;">EXIT CARD</span>
        </div>
        <div style="width: 100%; border-bottom: 1px solid #e2e8f0; margin-bottom: 1.5mm;"></div>

        <!-- Body -->
        <div style="display: flex; flex-direction: column; gap: 1.2mm;">
            <div>
                <div style="font-size: 6.8px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 0.3mm;">VEHICLE NUMBER</div>
                <div style="font-size: 12px; font-weight: 800; color: #0f172a; word-break: break-all; line-height: 1.1;">${vehicleNumber}</div>
            </div>

            <div style="display: flex; gap: 2.5mm;">
                <div style="flex: 1;">
                    <div style="font-size: 6.5px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 0.2mm;">ENTRY TIME</div>
                    <div style="font-size: 8.2px; font-weight: 700; color: #1e293b; line-height: 1.1;">${formattedEntryTime}</div>
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 6.5px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 0.2mm;">EXIT TIME</div>
                    <div style="font-size: 8.2px; font-weight: 700; color: #1e293b; line-height: 1.1;">${formattedExitTime}</div>
                </div>
            </div>

            ${parkingLocation ? `
            <div>
                <div style="font-size: 6.5px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 0.2mm;">PARKING LOCATION</div>
                <div style="font-size: 8.2px; font-weight: 700; color: #1e293b; word-break: break-all; line-height: 1.1;">${parkingLocation}</div>
            </div>` : ''}

            <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 1mm 2mm; margin-top: 0.5mm;">
                <div>
                    <div style="font-size: 6.2px; font-weight: 700; color: #64748b; text-transform: uppercase;">DURATION</div>
                    <div style="font-size: 8.5px; font-weight: 800; color: #0f172a;">${durationFormatted}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 6.2px; font-weight: 700; color: #64748b; text-transform: uppercase;">PARKING FEE</div>
                    <div style="font-size: 9.5px; font-weight: 800; color: #059669;">Rs. ${feeStr}</div>
                </div>
            </div>
        </div>

        <!-- Footer & Signature -->
        <div style="margin-top: auto; display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: flex-end; margin-bottom: 1.8mm;">
                <div style="width: 24mm; text-align: center;">
                    ${signatureMediaHtml}
                    <div style="border-top: 1px solid #cbd5e1; padding-top: 0.5mm; font-size: 6.2px; font-weight: 700; color: #64748b;">SIGNATURE</div>
                </div>
            </div>
            <div style="border-top: 1px solid #1f2937; padding-top: 0.8mm; text-align: center; font-size: 8.8px; font-weight: 800; color: #333;">
                Thank You
            </div>
        </div>
    </div>`;
};

/**
 * Triggers direct printing of an Entry Card on the connected printing machine.
 * Supports single card data or an object containing an array of entry_cards.
 * @param {Object} data - Entry card data or gate entry payload
 */
export const printEntryCard = (data) => {
    if (!data) return false;

    if (Array.isArray(data.entry_cards) && data.entry_cards.length > 0) {
        const htmls = data.entry_cards.map(ec => generateEntryCardHtml(ec));
        return printCardHtml(htmls, 'Print Entry Cards');
    }

    const html = generateEntryCardHtml(data);
    return printCardHtml(html, 'Print Entry Card');
};

/**
 * Triggers direct printing of an Exit Card on the connected printing machine.
 * Supports single card data or an object containing an array of exit_cards.
 * @param {Object} data - Exit card data or checkout payload
 */
export const printExitCard = (data) => {
    if (!data) return false;

    if (Array.isArray(data.exit_cards) && data.exit_cards.length > 0) {
        const htmls = data.exit_cards.map(xc => generateExitCardHtml(xc));
        return printCardHtml(htmls, 'Print Exit Cards');
    }

    const html = generateExitCardHtml(data);
    return printCardHtml(html, 'Print Exit Card');
};

/* =========================================================================
   PDF GENERATOR ENGINE (On-Demand PDF Downloads)
   Retained for manual "Download PDF" user actions.
   ========================================================================= */

/**
 * Generates and triggers automatic download of an Entry Card PDF (50mm x 80mm).
 * @param {Object} data - Entry card data, gate entry object, or vehicle entry object
 * @param {string} [customFileName] - Optional explicit filename
 */
export const downloadEntryCardPDF = (data, customFileName = null) => {
    if (!data) return false;

    // Handle array of entries/cards
    if (Array.isArray(data.entry_cards) && data.entry_cards.length > 0) {
        data.entry_cards.forEach(ec => downloadEntryCardPDF(ec));
        return true;
    }

    try {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [50, 80]
        });

        const vehicleNumber = (
            data.vehicle_number ||
            data.vehicle?.vehicle_number ||
            data.vehicles?.[0]?.vehicle_number ||
            data.visitor_name ||
            data.visitor?.visitor_name ||
            data.employee_name ||
            'VISITOR'
        ).trim().toUpperCase();

        const entryTime = data.entry_time || data.created_at || new Date().toISOString();
        const formattedEntryTime = formatCardDateTime(entryTime);

        const parkAreaName = (
            data.park_area_name ||
            data.park_area?.name ||
            (typeof data.park_area === 'string' ? data.park_area : '') ||
            ''
        ).trim();

        const parkingSlotNum = (
            data.parking_slot_number ||
            data.parking_slot?.slot_number ||
            data.slot_number ||
            ''
        );

        const parkingLocation = parkAreaName
            ? `${parkAreaName}${parkingSlotNum ? ` (Slot ${parkingSlotNum})` : ''}`
            : (data.parking_location_display || data.parking_location || '');

        const tagNumber = (
            data.tag_code ||
            data.tag_number ||
            data.pass_number ||
            data.generated_tag?.tag_number ||
            data.generated_tag ||
            ''
        );
        const visitorName = (
            data.visitor_name ||
            data.visitor?.visitor_name ||
            data.employee_name ||
            ''
        );
        const departmentName = (
            data.department_name ||
            data.department?.name ||
            ''
        );

        // 1. Outer Border Frame
        doc.setDrawColor(220, 225, 230);
        doc.setLineWidth(0.3);
        doc.roundedRect(1.5, 1.5, 47, 77, 2, 2, 'S');

        // 2. Top Emerald Header Stripe
        doc.setFillColor(46, 206, 138); // #2ece8a
        doc.roundedRect(1.5, 1.5, 47, 2.5, 2, 2, 'F');
        doc.rect(1.5, 2.8, 47, 1.2, 'F');

        // 3. Branding
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(31, 41, 55);
        doc.text('GLENDA', 4.5, 8.2);

        // 4. Header Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(17, 24, 39);
        doc.text('ENTRY CARD', 25, 13.2, { align: 'center' });

        // 5. Divider Line
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.25);
        doc.line(4.5, 15.5, 45.5, 15.5);

        let currentY = 19.5;

        // 6. Vehicle Number / Identity
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text('VEHICLE NUMBER', 4.5, currentY);

        currentY += 4.2;
        doc.setFont('helvetica', 'bold');
        const vehFontSize = vehicleNumber.length > 15 ? 9 : (vehicleNumber.length > 12 ? 10 : 11.5);
        doc.setFontSize(vehFontSize);
        doc.setTextColor(15, 23, 42);
        doc.text(vehicleNumber, 4.5, currentY);

        // 7. Entry Time
        currentY += 5.5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text('ENTRY TIME', 4.5, currentY);

        currentY += 4.0;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.2);
        doc.setTextColor(30, 41, 59);
        doc.text(formattedEntryTime, 4.5, currentY);

        // 8. Parking Location (if present)
        if (parkingLocation) {
            currentY += 5.5;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(100, 116, 139);
            doc.text('PARKING LOCATION', 4.5, currentY);

            currentY += 4.0;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);
            const truncatedLoc = parkingLocation.length > 26 ? parkingLocation.substring(0, 24) + '...' : parkingLocation;
            doc.text(truncatedLoc, 4.5, currentY);
        }

        // 9. Extra Visitor / Pass Information
        if (tagNumber || (visitorName && visitorName.toUpperCase() !== vehicleNumber)) {
            currentY += 5.2;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(100, 116, 139);
            doc.text(tagNumber ? 'PASS / VISITOR' : 'VISITOR DETAILS', 4.5, currentY);

            currentY += 3.8;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(51, 65, 85);
            let extraStr = '';
            if (tagNumber && tagNumber !== 'N/A') extraStr += `Pass #${tagNumber} `;
            if (visitorName && visitorName.toUpperCase() !== vehicleNumber) {
                extraStr += `• ${visitorName}`;
            }
            if (departmentName && extraStr.length < 22) {
                extraStr += ` (${departmentName})`;
            }
            const cleanExtra = extraStr.length > 28 ? extraStr.substring(0, 26) + '...' : extraStr;
            doc.text(cleanExtra, 4.5, currentY);
        }

        // 10. Signature Area
        const sigLineY = 63.5;
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.25);
        doc.line(25, sigLineY, 45.5, sigLineY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.text('SIGNATURE', 35.25, sigLineY + 3.2, { align: 'center' });

        // 11. Footer
        doc.setDrawColor(31, 41, 55);
        doc.setLineWidth(0.3);
        doc.line(4.5, 71.5, 45.5, 71.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 51, 51);
        doc.text('Thank You', 25, 75.8, { align: 'center' });

        // 12. Save File
        const fileName = customFileName || `Entry_Card_${cleanForFilename(vehicleNumber)}.pdf`;
        doc.save(fileName);
        return true;
    } catch (err) {
        console.error('Failed to generate Entry Card PDF:', err);
        return false;
    }
};

/**
 * Generates and triggers automatic download of an Exit Card PDF (50mm x 80mm).
 * @param {Object} data - Exit card data, or gate/vehicle entry object with exit details
 * @param {string} [customFileName] - Optional explicit filename
 */
export const downloadExitCardPDF = (data, customFileName = null) => {
    if (!data) return false;

    // Handle array of exit cards
    if (Array.isArray(data.exit_cards) && data.exit_cards.length > 0) {
        data.exit_cards.forEach(xc => downloadExitCardPDF(xc));
        return true;
    }

    try {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [50, 80]
        });

        const vehicleNumber = (
            data.vehicle_number ||
            data.entry_card?.vehicle_number ||
            data.vehicle?.vehicle_number ||
            data.vehicles?.[0]?.vehicle_number ||
            data.visitor_name ||
            data.visitor?.visitor_name ||
            data.employee_name ||
            'VISITOR'
        ).trim().toUpperCase();

        const entryTime = data.entry_time || data.entry_card?.entry_time || data.created_at;
        const exitTime = data.exit_time || new Date().toISOString();

        const formattedEntryTime = formatCardDateTime(entryTime);
        const formattedExitTime = formatCardDateTime(exitTime);

        const parkAreaName = (
            data.park_area_name ||
            data.entry_card?.park_area_name ||
            data.park_area?.name ||
            (typeof data.park_area === 'string' ? data.park_area : '') ||
            ''
        ).trim();

        const parkingSlotNum = (
            data.parking_slot_number ||
            data.entry_card?.parking_slot_number ||
            data.parking_slot?.slot_number ||
            data.slot_number ||
            ''
        );

        const parkingLocation = parkAreaName
            ? `${parkAreaName}${parkingSlotNum ? ` (Slot ${parkingSlotNum})` : ''}`
            : (data.parking_location_display || data.parking_location || '');

        const durationFormatted = formatCardDuration(
            entryTime,
            exitTime,
            data.duration_formatted || data.stay_duration
        );

        let feeNumber = 0;
        if (data.parking_fee !== undefined && data.parking_fee !== null) {
            feeNumber = Number(data.parking_fee);
        } else if (data.entry_card?.parking_fee !== undefined) {
            feeNumber = Number(data.entry_card.parking_fee);
        }
        const feeStr = isNaN(feeNumber) ? '0.00' : feeNumber.toFixed(2);

        // 1. Outer Border Frame
        doc.setDrawColor(220, 225, 230);
        doc.setLineWidth(0.3);
        doc.roundedRect(1.5, 1.5, 47, 77, 2, 2, 'S');

        // 2. Top Dark/Blue Header Stripe
        doc.setFillColor(37, 99, 235); // #2563eb
        doc.roundedRect(1.5, 1.5, 47, 2.5, 2, 2, 'F');
        doc.rect(1.5, 2.8, 47, 1.2, 'F');

        // 3. Branding
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(31, 41, 55);
        doc.text('GLENDA', 4.5, 8.2);

        // 4. Header Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(17, 24, 39);
        doc.text('EXIT CARD', 25, 13.2, { align: 'center' });

        // 5. Divider Line
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.25);
        doc.line(4.5, 15.5, 45.5, 15.5);

        let currentY = 19.2;

        // 6. Vehicle Number / Identity
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text('VEHICLE NUMBER', 4.5, currentY);

        currentY += 4.0;
        doc.setFont('helvetica', 'bold');
        const vehFontSize = vehicleNumber.length > 15 ? 9 : (vehicleNumber.length > 12 ? 10 : 11);
        doc.setFontSize(vehFontSize);
        doc.setTextColor(15, 23, 42);
        doc.text(vehicleNumber, 4.5, currentY);

        // 7. Entry Time
        currentY += 5.0;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text('ENTRY TIME', 4.5, currentY);

        currentY += 3.7;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.setTextColor(30, 41, 59);
        doc.text(formattedEntryTime, 4.5, currentY);

        // 8. Exit Time
        currentY += 4.8;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text('EXIT TIME', 4.5, currentY);

        currentY += 3.7;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.setTextColor(30, 41, 59);
        doc.text(formattedExitTime, 4.5, currentY);

        // 9. Parking Location (if available)
        if (parkingLocation) {
            currentY += 4.8;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(100, 116, 139);
            doc.text('PARKING LOCATION', 4.5, currentY);

            currentY += 3.7;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(30, 41, 59);
            const truncatedLoc = parkingLocation.length > 26 ? parkingLocation.substring(0, 24) + '...' : parkingLocation;
            doc.text(truncatedLoc, 4.5, currentY);
        }

        // 10. Duration & Parking Fee
        currentY += 4.8;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text('DURATION', 4.5, currentY);
        doc.text('PARKING FEE', 28, currentY);

        currentY += 3.7;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.setTextColor(30, 41, 59);
        doc.text(durationFormatted, 4.5, currentY);

        doc.setFontSize(8.5);
        doc.setTextColor(4, 120, 87);
        doc.text(`Rs. ${feeStr}`, 28, currentY);

        // 11. Signature Area
        const sigLineY = 64.0;
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.25);
        doc.line(25, sigLineY, 45.5, sigLineY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.text('SIGNATURE', 35.25, sigLineY + 3.2, { align: 'center' });

        // 12. Footer
        doc.setDrawColor(31, 41, 55);
        doc.setLineWidth(0.3);
        doc.line(4.5, 71.5, 45.5, 71.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 51, 51);
        doc.text('Thank You', 25, 75.8, { align: 'center' });

        // 13. Save File
        const fileName = customFileName || `Exit_Card_${cleanForFilename(vehicleNumber)}.pdf`;
        doc.save(fileName);
        return true;
    } catch (err) {
        console.error('Failed to generate Exit Card PDF:', err);
        return false;
    }
};

export default {
    printEntryCard,
    printExitCard,
    printCardHtml,
    generateEntryCardHtml,
    generateExitCardHtml,
    downloadEntryCardPDF,
    downloadExitCardPDF,
    formatCardDateTime,
    formatCardDuration
};
