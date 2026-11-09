import os
import re

directories = [
    r'c:\Paul@Rarenett\glenda_vite\frontend\src\jsx\components\TaskManagement',
    r'c:\Paul@Rarenett\glenda_vite\frontend\src\jsx\components\Task',
]

replacement = '''<nav>
                                <ul className="pagination pagination-gutter pagination-success no-bg mb-0">
                                    <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                        <button className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>
                                            <i className="la la-angle-left"></i>
                                        </button>
                                    </li>
                                    {Array.from({ length: totalPages }, (_, i) => (
                                        <li key={i + 1} className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}>
                                            <button className="page-link" onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
                                        </li>
                                    ))}
                                    <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                        <button className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}>
                                            <i className="la la-angle-right"></i>
                                        </button>
                                    </li>
                                </ul>
                            </nav>'''

for d in directories:
    for root, dirs, files in os.walk(d):
        for file in files:
            if file.endswith('.jsx'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                new_content = content
                
                # Check if it uses Pagination
                if '<Pagination>' in new_content:
                    new_content = re.sub(r'<Pagination>.*?</Pagination>', replacement, new_content, flags=re.DOTALL)
                
                if '<ul className="pagination pagination-circle mb-0">' in new_content:
                    new_content = re.sub(r'<nav>\s*<ul className="pagination pagination-circle mb-0">.*?</nav>', replacement, new_content, flags=re.DOTALL)
                
                if '<ul className="pagination pagination-primary' in new_content:
                    new_content = re.sub(r'<ul className="pagination pagination-primary[^"]*"[^>]*>.*?</ul>', replacement, new_content, flags=re.DOTALL)

                if new_content != content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f'Updated {filepath}')
