import os

file_path = 'c:/Paul@Rarenett/glenda_vite1/frontend/src/jsx/components/MarketingConnect/marketing-cute.css'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = """    .btn-danger {
        background: linear-gradient(135deg, #f87171 0%, #ef4444 100%) !important;
        color: white !important;
    }"""

replacement = """    .btn-danger {
        background: linear-gradient(135deg, #f87171 0%, #ef4444 100%) !important;
        color: white !important;
    }

    /* Fix for small icon buttons like edit/delete in tables */
    .btn.btn-sm, .btn.btn-xs, .btn.sharp {
        padding: 6px 12px !important;
        border-radius: 12px !important;
        font-size: 0.85rem !important;
    }
    
    .btn.btn-xs.sharp, .btn.btn-sm.sharp {
        padding: 0 !important;
        width: 36px !important;
        height: 36px !important;
        border-radius: 50% !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
    }"""

content = content.replace(target, replacement)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Added mobile CSS fix for tiny buttons")
