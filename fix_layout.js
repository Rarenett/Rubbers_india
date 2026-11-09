const fs = require('fs');

const path = 'c:\\Users\\ADMIN\\Documents\\GitHub\\glenda_vite\\frontend\\src\\jsx\\components\\Sales\\SalesReportList.jsx';
const lines = fs.readFileSync(path, 'utf8').split('\n');

const tabsStart = 876 - 1;
const tabsEnd = 899 - 1;
const dateStart = 901 - 1;
const dateEnd = 931 - 1;
const searchStart = 933 - 1;
const searchEnd = 1036 - 1;

const tabsStr = lines.slice(tabsStart, tabsEnd + 1).join('\n');
const dateStr = lines.slice(dateStart, dateEnd + 1).join('\n').replace('mx-auto', '');
const searchStr = lines.slice(searchStart, searchEnd + 1).join('\n');

const newHeader =                             <div className=" d-flex justify-content-between flex-wrap gap-3 w-100 mb-2\>
 {/* Left Column: Tabs + Search/Export */}
 <div className=\d-flex flex-column gap-3\>


 </div>

 {/* Right Column: Date Filters */}
 <div className=\d-flex align-items-start\>

 </div>
 </div>;

const newLines = [
 ...lines.slice(0, 874 - 1),
 newHeader,
 ...lines.slice(1037 - 1)
];

fs.writeFileSync(path, newLines.join('\n'));
console.log('Layout updated successfully');
