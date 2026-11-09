/**
 * Convert number to Indian Rupee Words
 * e.g. 2500 -> "Two Thousand Five Hundred Rupees Only"
 */
export function numberToWordsINR(amount) {
    const num = Math.round(parseFloat(amount) * 100) / 100;
    if (isNaN(num) || num <= 0) return 'Zero Rupees Only';

    const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convertTwoDigits(n) {
        if (n === 0) return '';
        if (n < 10) return singleDigits[n];
        if (n < 20) return teens[n - 10];
        const t = tens[Math.floor(n / 10)];
        const rem = singleDigits[n % 10];
        return rem ? `${t} ${rem}` : t;
    }

    function convertThreeDigits(n) {
        const h = Math.floor(n / 100);
        const rem = n % 100;
        const hStr = h ? `${singleDigits[h]} Hundred` : '';
        const remStr = convertTwoDigits(rem);
        if (hStr && remStr) return `${hStr} and ${remStr}`;
        return hStr || remStr;
    }

    const wholePart = Math.floor(num);
    const paise = Math.round((num - wholePart) * 100);

    const crore = Math.floor(wholePart / 10000000);
    const lakh = Math.floor((wholePart % 10000000) / 100000);
    const thousand = Math.floor((wholePart % 100000) / 1000);
    const hundred = wholePart % 1000;

    const parts = [];
    if (crore) parts.push(`${convertTwoDigits(crore)} Crore`);
    if (lakh) parts.push(`${convertTwoDigits(lakh)} Lakh`);
    if (thousand) parts.push(`${convertTwoDigits(thousand)} Thousand`);
    if (hundred) parts.push(convertThreeDigits(hundred));

    const rupeesText = parts.join(' ').trim() || 'Zero';
    let result = `${rupeesText} Rupees`;
    if (paise > 0) {
        result += ` and ${convertTwoDigits(paise)} Paise`;
    }
    return `${result} Only`;
}

/**
 * Generate a clean, customer-friendly voucher print window
 * @param {Object} options
 */
export function printFriendlyVoucher({
    voucher,
    type = 'Payment',
    ledgers = [],
    companyInfo = null,
    companyAddress = null,
    companyContact = null
}) {
    const printWindow = window.open('', '_blank', 'width=850,height=750');
    if (!printWindow) {
        alert('Failed to open print window. Please allow popups.');
        return;
    }

    const getLedgerName = (id) => {
        const ledger = ledgers.find(l => String(l.id) === String(id));
        return ledger ? ledger.name : (id?.name || 'Unknown Account');
    };

    const companyName = companyInfo?.display_name || companyInfo?.name || 'Company Name';
    const companySubHeader = companyInfo?.description || '';

    const formatAddr = () => {
        if (!companyAddress) return '';
        return [
            companyAddress.address_line_1,
            companyAddress.address_line_2,
            companyAddress.city,
            companyAddress.state,
            companyAddress.pincode
        ].filter(Boolean).join(', ');
    };

    const formatContact = () => {
        if (!companyContact) return '';
        const parts = [];
        if (companyContact.phone) parts.push(`Tel: ${companyContact.phone}`);
        if (companyContact.mobile) parts.push(`Mob: ${companyContact.mobile}`);
        if (companyContact.email) parts.push(`Email: ${companyContact.email}`);
        return parts.join(' | ');
    };

    const fullContactLine = [formatAddr(), formatContact()].filter(Boolean).join(' | ');

    // Categorize rows
    const details = voucher.details || [];
    const isPayment = type.toLowerCase() === 'payment';
    const isReceipt = type.toLowerCase() === 'receipt';
    const isContra = type.toLowerCase() === 'contra';
    const isJournal = type.toLowerCase() === 'journal';

    // In Payment: Debit (Dr) = Party/Expense Paid To, Credit (Cr) = Bank/Cash Mode
    // In Receipt: Credit (Cr) = Customer/Income Received From, Debit (Dr) = Bank/Cash Mode
    // In Contra: Debit = Deposited Into, Credit = Withdrawn From
    const parties = [];
    const modes = [];
    let totalVoucherAmount = 0;

    details.forEach(d => {
        const debit = parseFloat(d.debit_amount) || 0;
        const credit = parseFloat(d.credit_amount) || 0;
        const amt = debit > 0 ? debit : credit;
        const ledgerName = getLedgerName(d.ledger);

        if (isPayment) {
            if (d.entry_type === 'Dr' || debit > 0) {
                parties.push({ name: ledgerName, amount: amt, narration: d.narration, allocations: d.bill_allocations || [] });
                totalVoucherAmount += amt;
            } else {
                modes.push({ name: ledgerName, amount: amt, narration: d.narration });
            }
        } else if (isReceipt) {
            if (d.entry_type === 'Cr' || credit > 0) {
                parties.push({ name: ledgerName, amount: amt, narration: d.narration, allocations: d.bill_allocations || [] });
                totalVoucherAmount += amt;
            } else {
                modes.push({ name: ledgerName, amount: amt, narration: d.narration });
            }
        } else if (isContra) {
            if (d.entry_type === 'Dr' || debit > 0) {
                parties.push({ name: ledgerName, amount: amt, typeLabel: 'Deposited To (Destination)', narration: d.narration });
                totalVoucherAmount += amt;
            } else {
                modes.push({ name: ledgerName, amount: amt, typeLabel: 'Transferred From (Source)', narration: d.narration });
            }
        } else {
            // Journal
            parties.push({
                name: ledgerName,
                entryType: d.entry_type || (debit > 0 ? 'Dr' : 'Cr'),
                amount: amt,
                narration: d.narration
            });
            if (debit > 0) totalVoucherAmount += debit;
        }
    });

    if (totalVoucherAmount === 0) {
        totalVoucherAmount = details.reduce((sum, d) => sum + (parseFloat(d.debit_amount) || parseFloat(d.credit_amount) || 0), 0);
    }

    const primaryPartyName = parties.length > 0 ? parties.map(p => p.name).join(', ') : 'N/A';
    const primaryModeName = modes.length > 0 ? modes.map(m => m.name).join(', ') : 'Cash/Bank';
    const amountInWords = numberToWordsINR(totalVoucherAmount);

    // Collect all bill allocations if any
    const allAllocations = [];
    details.forEach(d => {
        if (d.bill_allocations && Array.isArray(d.bill_allocations)) {
            d.bill_allocations.forEach(a => {
                if (parseFloat(a.amount || 0) > 0) {
                    allAllocations.push({
                        ledgerName: getLedgerName(d.ledger),
                        refType: a.bill_type || a.ref_type || 'Agst Ref',
                        refNo: a.bill_number || a.ref_number || a.refName || 'Invoice',
                        amount: parseFloat(a.amount || 0)
                    });
                }
            });
        }
    });

    const displayTitle = isPayment ? 'Payment Voucher' : (isReceipt ? 'Receipt Voucher' : (isContra ? 'Contra Voucher' : `${type} Voucher`));

    const html = `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="utf-8">
                <title>${displayTitle} - ${voucher.voucher_no}</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                <style>
                    * { box-sizing: border-box; }
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        margin: 0;
                        padding: 20px;
                        background-color: #f1f5f9;
                        color: #1e293b;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .page-container {
                        max-width: 820px;
                        margin: 0 auto;
                        background: #ffffff;
                        padding: 36px 40px;
                        border-radius: 12px;
                        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
                        border: 1px solid #e2e8f0;
                    }
                    .header-section {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        border-bottom: 2px solid #0f2a59;
                        padding-bottom: 16px;
                        margin-bottom: 24px;
                    }
                    .company-info h1 {
                        font-size: 24px;
                        font-weight: 800;
                        margin: 0;
                        color: #0f2a59;
                        letter-spacing: -0.02em;
                    }
                    .company-info p {
                        margin: 4px 0 0 0;
                        font-size: 12px;
                        color: #64748b;
                        line-height: 1.4;
                    }
                    .voucher-title-badge {
                        background: #0f2a59;
                        color: #ffffff;
                        border-radius: 8px;
                        padding: 10px 18px;
                        text-align: right;
                        min-width: 180px;
                    }
                    .voucher-title-badge h2 {
                        margin: 0;
                        font-size: 15px;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.04em;
                    }
                    .voucher-title-badge p {
                        margin: 4px 0 0 0;
                        font-size: 13px;
                        font-weight: 600;
                        color: #93c5fd;
                    }
                    .summary-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 16px;
                        background-color: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        padding: 16px 20px;
                        margin-bottom: 24px;
                    }
                    .summary-item {
                        display: flex;
                        flex-direction: column;
                    }
                    .summary-label {
                        font-size: 11px;
                        font-weight: 600;
                        text-transform: uppercase;
                        color: #64748b;
                        letter-spacing: 0.04em;
                        margin-bottom: 4px;
                    }
                    .summary-value {
                        font-size: 14px;
                        font-weight: 700;
                        color: #0f2a59;
                    }
                    .table-container {
                        margin-bottom: 20px;
                    }
                    .voucher-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 13px;
                    }
                    .voucher-table th {
                        background-color: #0f2a59;
                        color: #ffffff;
                        font-weight: 600;
                        font-size: 12px;
                        letter-spacing: 0.03em;
                        padding: 10px 12px;
                        text-align: left;
                        border: 1px solid #0f2a59;
                    }
                    .voucher-table th.text-right, .voucher-table td.text-right {
                        text-align: right;
                    }
                    .voucher-table th.text-center, .voucher-table td.text-center {
                        text-align: center;
                    }
                    .voucher-table td {
                        padding: 11px 12px;
                        border: 1px solid #e2e8f0;
                        color: #334155;
                        vertical-align: middle;
                    }
                    .voucher-table tbody tr:nth-child(even) {
                        background-color: #f8fafc;
                    }
                    .amount-in-words-card {
                        background-color: #f8fafc;
                        border-left: 4px solid #0f2a59;
                        border-top: 1px solid #e2e8f0;
                        border-right: 1px solid #e2e8f0;
                        border-bottom: 1px solid #e2e8f0;
                        border-radius: 6px;
                        padding: 12px 16px;
                        margin-bottom: 20px;
                        font-size: 13px;
                    }
                    .amount-in-words-card strong {
                        color: #0f2a59;
                        font-weight: 700;
                    }
                    .amount-in-words-card span {
                        color: #334155;
                        font-style: italic;
                    }
                    .narration-box {
                        background-color: #ffffff;
                        border: 1px dashed #cbd5e1;
                        border-radius: 6px;
                        padding: 10px 14px;
                        margin-bottom: 24px;
                        font-size: 12px;
                    }
                    .narration-box strong {
                        color: #64748b;
                        display: block;
                        font-size: 10px;
                        text-transform: uppercase;
                        letter-spacing: 0.04em;
                        margin-bottom: 2px;
                    }
                    .narration-box p {
                        margin: 0;
                        color: #334155;
                        font-weight: 500;
                    }
                    .signature-section {
                        margin-top: 60px;
                        display: grid;
                        grid-template-columns: 1fr 1fr 1fr;
                        gap: 30px;
                        text-align: center;
                    }
                    .signature-box {
                        border-top: 1px solid #94a3b8;
                        padding-top: 8px;
                        font-size: 11px;
                        font-weight: 600;
                        text-transform: uppercase;
                        color: #64748b;
                        letter-spacing: 0.04em;
                    }
                    @media print {
                        body {
                            background-color: #ffffff;
                            padding: 0;
                        }
                        .page-container {
                            border: none;
                            box-shadow: none;
                            padding: 20px 24px;
                            max-width: 100%;
                        }
                        .signature-section {
                            page-break-inside: avoid;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="page-container">
                    <!-- Header -->
                    <div class="header-section">
                        <div class="company-info">
                            <h1>${companyName}</h1>
                            ${companySubHeader ? `<p>${companySubHeader}</p>` : ''}
                            ${fullContactLine ? `<p>${fullContactLine}</p>` : ''}
                        </div>
                        <div class="voucher-title-badge">
                            <h2>${displayTitle}</h2>
                            <p>${voucher.voucher_no}</p>
                        </div>
                    </div>

                    <!-- Clean Summary Cards for Non-Accountants / Customers -->
                    <div class="summary-grid">
                        <div class="summary-item">
                            <span class="summary-label">Voucher No</span>
                            <span class="summary-value">${voucher.voucher_no}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Date</span>
                            <span class="summary-value">${voucher.voucher_date}</span>
                        </div>
                        ${isPayment ? `
                            <div class="summary-item">
                                <span class="summary-label">Paid To (Beneficiary)</span>
                                <span class="summary-value">${primaryPartyName}</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Payment Mode</span>
                                <span class="summary-value">${primaryModeName}</span>
                            </div>
                        ` : ''}
                        ${isReceipt ? `
                            <div class="summary-item">
                                <span class="summary-label">Received From (Customer / Payer)</span>
                                <span class="summary-value">${primaryPartyName}</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Received In (Payment Mode)</span>
                                <span class="summary-value">${primaryModeName}</span>
                            </div>
                        ` : ''}
                        ${isContra ? `
                            <div class="summary-item">
                                <span class="summary-label">Transfer From</span>
                                <span class="summary-value">${primaryModeName}</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Transfer To</span>
                                <span class="summary-value">${primaryPartyName}</span>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Simple & Understandable Particulars Table -->
                    <div class="table-container">
                        <table class="voucher-table">
                            <thead>
                                <tr>
                                    <th style="width: 8%;" class="text-center">Sl No</th>
                                    <th style="width: 42%;">Particulars / Account</th>
                                    <th style="width: 25%;">Details / Mode</th>
                                    <th style="width: 25%;" class="text-right">Amount (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${details.map((row, idx) => {
                                    const debit = parseFloat(row.debit_amount) || 0;
                                    const credit = parseFloat(row.credit_amount) || 0;
                                    const rowAmt = debit > 0 ? debit : credit;
                                    const ledgerName = getLedgerName(row.ledger);

                                    let roleLabel = '';
                                    if (isPayment) {
                                        roleLabel = row.entry_type === 'Dr' || debit > 0 ? 'Paid Towards Account' : 'Payment Mode (Outflow)';
                                    } else if (isReceipt) {
                                        roleLabel = row.entry_type === 'Cr' || credit > 0 ? 'Received From Customer' : 'Received Into (Inflow)';
                                    } else if (isContra) {
                                        roleLabel = row.entry_type === 'Dr' || debit > 0 ? 'Deposited To' : 'Withdrawn From';
                                    } else {
                                        roleLabel = row.entry_type === 'Dr' ? 'Debit (Dr)' : 'Credit (Cr)';
                                    }

                                    return `
                                        <tr>
                                            <td class="text-center" style="font-weight: 600; color: #64748b;">${idx + 1}</td>
                                            <td>
                                                <div style="font-weight: 700; color: #0f2a59;">${ledgerName}</div>
                                                ${row.narration ? `<div style="font-size: 11px; color: #64748b; margin-top: 3px;">Note: ${row.narration}</div>` : ''}
                                            </td>
                                            <td style="color: #475569; font-weight: 500;">${roleLabel}</td>
                                            <td class="text-right" style="font-weight: 700; color: #0f2a59; font-size: 13px;">
                                                ₹ ${rowAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                                <tr style="background-color: #f1f5f9; font-weight: 700; border-top: 2px solid #0f2a59;">
                                    <td colspan="3" class="text-right" style="color: #0f2a59; font-size: 13px; text-transform: uppercase;">
                                        Total Amount:
                                    </td>
                                    <td class="text-right" style="color: #0f2a59; font-size: 15px; font-weight: 800;">
                                        ₹ ${totalVoucherAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Amount in words -->
                    <div class="amount-in-words-card">
                        <strong>Amount in Words: </strong>
                        <span>${amountInWords}</span>
                    </div>

                    <!-- Master Narration -->
                    ${voucher.narration ? `
                        <div class="narration-box">
                            <strong>Master Narration:</strong>
                            <p>${voucher.narration}</p>
                        </div>
                    ` : ''}

                    <!-- Signatures -->
                    <div class="signature-section">
                        <div class="signature-box">Prepared By</div>
                        <div class="signature-box">Verified By</div>
                        <div class="signature-box">Authorised / Receiver Signature</div>
                    </div>
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(() => {
                            window.print();
                        }, 400);
                    };
                </script>
            </body>
        </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
}
