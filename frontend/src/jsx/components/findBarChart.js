const fs = require('fs');
const content = fs.readFileSync('Sales/SalesReportList.jsx', 'utf8');
const lines = content.split('\n');

const vars = ['formattedItemMonthCategories', 'itemBarOptions', 'totalQuantitySeries'];
vars.forEach(v => {
    const idx = lines.findIndex(l => l.includes(v) && l.includes('='));
    if (idx !== -1) {
        console.log('--- ' + v + ' ---');
        console.log(lines.slice(idx - 2, idx + 40).join('\n'));
    }
});
