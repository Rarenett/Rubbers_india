const fs = require('fs');
const content = fs.readFileSync('Sales/SalesReportList.jsx', 'utf8');

// Print out the render block for itemGraph to see the bar chart
const lines = content.split('\n');
const startIdx = lines.findIndex(l => l.includes("activeTab === 'itemGraph'"));

if (startIdx !== -1) {
    console.log(lines.slice(startIdx, startIdx + 150).join('\n'));
} else {
    console.log('Not found');
}
