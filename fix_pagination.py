files = [
    'frontend/src/jsx/components/Purchase/SupplierWisePOReport.jsx',
    'frontend/src/jsx/components/Purchase/SupplierWisePIReport.jsx',
    'frontend/src/jsx/components/Purchase/SupplierWisePRReport.jsx'
]

old_text = '''                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="d-flex justify-content-between align-items-center mt-3">
                                <div className="text-muted" style={{ fontSize: '13px' }}>
                                    Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, aggregatedSuppliers.length)} of {aggregatedSuppliers.length} entries
                                </div>
                                <nav>'''

new_text = '''                        {/* Pagination */}
                        {searchedPOs.length > 0 && (
                            <div className="d-flex justify-content-between align-items-center mt-3">
                                <div className="text-muted" style={{ fontSize: '13px' }}>
                                    Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, searchedPOs.length)} of {searchedPOs.length} entries
                                </div>
                                {totalPages > 1 && (
                                <nav>'''

nav_end_old = '''                                </nav>
                            </div>
                        )}'''

nav_end_new = '''                                </nav>
                                )}
                            </div>
                        )}'''

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if old_text in content:
        content = content.replace(old_text, new_text)
        content = content.replace(nav_end_old, nav_end_new)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
    else:
        print(f"Could not find old text in {filepath}")

