with open('frontend/src/jsx/components/Sales/SalesReportList.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

tabsStart = 876 - 1
tabsEnd = 899 - 1
dateStart = 901 - 1
dateEnd = 931 - 1
searchStart = 933 - 1
searchEnd = 1036 - 1

tabsStr = ''.join(lines[tabsStart:tabsEnd + 1]).replace('my-2 my-md-0', '')
dateStr = ''.join(lines[dateStart:dateEnd + 1]).replace('mx-auto', '')
searchStr = ''.join(lines[searchStart:searchEnd + 1])

newHeader = f'''                            <div className=" d-flex justify-content-between flex-wrap gap-3 w-100 mb-2\>
 {{/* Left Column: Tabs + Search/Export */}}
 <div className=\d-flex flex-column gap-3\>
{tabsStr}
{searchStr}
 </div>

 {{/* Right Column: Date Filters */}}
 <div className=\d-flex align-items-start\>
{dateStr}
 </div>
 </div>\n'''

newLines = lines[:874 - 1] + [newHeader] + lines[1037 - 1:]

with open('frontend/src/jsx/components/Sales/SalesReportList.jsx', 'w', encoding='utf-8') as f:
 f.writelines(newLines)
print('Layout updated successfully')
