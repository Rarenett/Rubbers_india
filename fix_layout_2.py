with open('frontend/src/jsx/components/Sales/SalesReportList.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Tabs: 877-900
tabs_lines = lines[877-1:900]

# Search/Select: 903-990
search_select = lines[903-1:990]

# Export Buttons: 992-1004
export_buttons = lines[992-1:1004]

# Date filters inner (1011 to 1041)
date_filters = lines[1011-1:1041]

newHeader = f'''                            <div className=" d-flex justify-content-between flex-wrap gap-3 w-100 mb-2\>
 {{/* Left Column: Tabs */}}
 <div className=\d-flex align-items-start\>
{''.join(tabs_lines)}
 </div>

 {{/* Right Column */}}
 <div className=\d-flex flex-column gap-3 align-items-md-end\>
 {{/* Top Row: Date Filters + Search */}}
 <div className=\d-flex align-items-center gap-3 flex-wrap\>
{''.join(date_filters)}
{''.join(search_select)}
 </div>
 
 {{/* Bottom Row: Export */}}
{''.join(export_buttons)}
 </div>
 </div>
'''

newLines = lines[:874 - 1] + [newHeader] + lines[1044:]

with open('frontend/src/jsx/components/Sales/SalesReportList.jsx', 'w', encoding='utf-8') as f:
 f.writelines(newLines)
print('Layout updated successfully')
