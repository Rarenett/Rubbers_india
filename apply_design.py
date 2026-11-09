import re

files = [
    'frontend/src/jsx/components/Purchase/SupplierWisePOReport.jsx',
    'frontend/src/jsx/components/Purchase/SupplierWisePIReport.jsx',
    'frontend/src/jsx/components/Purchase/SupplierWisePRReport.jsx'
]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Change container
    content = content.replace('<div className="fd-dashboard-container">', '<div className="container-fluid">')

    # 2. Add DatePicker imports if not exists
    if "import DatePicker from 'react-datepicker';" not in content:
        content = content.replace(
            "import Select, { components } from 'react-select';",
            "import { getDatePickerFormat } from '../../../utils/dateUtils';\nimport DatePicker from 'react-datepicker';\nimport 'react-datepicker/dist/react-datepicker.css';\nimport Select, { components } from 'react-select';"
        )

    # 3. Change wrapper around controls
    old_wrapper_1 = '''<div className="fd-management-content">
                <div
                    className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 p-3 rounded-3"
                    style={{ background: '#fff', border: '1.5px solid #e9ecef' }}
                >'''
    old_wrapper_2 = '''<div className="fd-management-content">
                <div
                    className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 p-3 rounded-3"
                    style={{ background: '#fff', border: '1px solid #e9ecef' }}
                >'''
    new_wrapper = '''<div className="row">
                <div className="col-lg-12">
                <div className="card">
                    <div className="card-body">
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">'''
    if old_wrapper_1 in content:
        content = content.replace(old_wrapper_1, new_wrapper)
    elif old_wrapper_2 in content:
        content = content.replace(old_wrapper_2, new_wrapper)

    # 4. Replace input type="date" with DatePicker
    input_from_regex = re.compile(r'<input\s+type="date"\s+className="form-control form-control-sm"\s+value=\{fromDate\}\s+onChange=\{\(e\) => setFromDate\(e.target.value\)\}\s+style=\{\{ height: 36, borderRadius: 8, width: 150, fontSize: \'0\.85rem\' \}\}\s+/>')
    new_input_from = '''<div style={{ width: '125px' }}>
                            <DatePicker
                                className="form-control form-control-sm"
                                selected={fromDate ? new Date(fromDate.split('-')[0], fromDate.split('-')[1] - 1, fromDate.split('-')[2]) : null}
                                onChange={(date) => {
                                    if (!date) return;
                                    const formatted = ${date.getFullYear()}--;
                                    setFromDate(formatted);
                                }}
                                dateFormat={getDatePickerFormat()}
                                placeholderText={getDatePickerFormat().toLowerCase()}
                            />
                        </div>'''
    content = input_from_regex.sub(new_input_from, content)

    input_to_regex = re.compile(r'<input\s+type="date"\s+className="form-control form-control-sm"\s+value=\{toDate\}\s+onChange=\{\(e\) => setToDate\(e.target.value\)\}\s+style=\{\{ height: 36, borderRadius: 8, width: 140, fontSize: \'0\.85rem\' \}\}\s+/>')
    new_input_to = '''<div style={{ width: '125px' }}>
                            <DatePicker
                                className="form-control form-control-sm"
                                selected={toDate ? new Date(toDate.split('-')[0], toDate.split('-')[1] - 1, toDate.split('-')[2]) : null}
                                onChange={(date) => {
                                    if (!date) return;
                                    const formatted = ${date.getFullYear()}--;
                                    setToDate(formatted);
                                }}
                                dateFormat={getDatePickerFormat()}
                                placeholderText={getDatePickerFormat().toLowerCase()}
                            />
                        </div>'''
    content = input_to_regex.sub(new_input_to, content)

    # 5. Remove StatCards
    stat_cards_regex = re.compile(r'\{\/\*\s*──\s*Summary Stat Cards\s*──[^\}]+\*\/\}\s*<div className="d-flex flex-wrap gap-3 mb-4">.*?</div>\s*\{\/\*\s*──\s*Conditional View\s*──', re.DOTALL)
    content = stat_cards_regex.sub('{/* ── Conditional View ──', content)

    # 6. Replace fd-section-container and fd-table
    content = content.replace('<div className="fd-section-container">', '<div>')
    content = content.replace('<table className="fd-table">', '<table className="table table-responsive-md">')
    
    # 7. Replace itemGraph wrapper
    content = content.replace('<div className="fd-section-container mb-4">', '<div className="mb-4">')
    itemGraph_card_regex = re.compile(r'<div className="card border-0 h-100"[^>]*>\s*<div className="card-body p-4 p-md-5">')
    content = itemGraph_card_regex.sub('<div>\n                                    <div className="p-2">', content)

    # 8. Add closing divs before Detail Modal
    if "</div>\n\n            {/* ── Detail Modal ──────────────────────────────────────────────── */}" in content:
        content = content.replace(
            "</div>\n\n            {/* ── Detail Modal ──────────────────────────────────────────────── */}",
            "                    </div>\n                </div>\n                </div>\n            </div>\n\n            {/* ── Detail Modal ──────────────────────────────────────────────── */}"
        )

    # Fix typo in PIReport "Monthly breakdown of total purchase invoice amount" -> "Monthly breakdown of total purchase amount"
    content = content.replace("Monthly breakdown of total purchase invoice amount", "Monthly breakdown of total purchase amount")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Updated files successfully!")
