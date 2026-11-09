import glob
import re

files = glob.glob(r'c:\Users\ADMIN\Documents\GitHub\glenda_vite\frontend\src\jsx\components\Sales\*ReportList.jsx')
files = [f for f in files if 'DistributorSalesInvoice' not in f and 'CustomerSalesInvoice' not in f and 'CustomerSalesReturn' not in f and 'SalesInvoiceReportList' not in f and 'SalesReturnReportList' not in f]

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to replace `</div></div>\n</div>` with `</div>\n</div>` if it's right after the desktop export buttons.
    # Actually, let's just find `</button>\n                                            </div></div>`
    
    # regex to match:
    # </button> \s* </div></div>
    # and replace with:
    # </button>\n                                            </div>
    
    pattern = r'(</button>\s*)</div></div>'
    if re.search(pattern, content):
        content = re.sub(pattern, r'\1</div>', content)
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'{file}: FIXED EXTRA DIV')
    else:
        print(f'{file}: EXTRA DIV NOT FOUND')
