import os

components = [
    'MarketingConnectDashboard.jsx',
    'AttendanceModule.jsx',
    'TransportModule.jsx',
    'LeadsModule.jsx',
    'ShopVisitModule.jsx',
    'OrdersModule.jsx',
    'OrderModal.jsx'
]

base_dir = 'c:/Paul@Rarenett/glenda_vite1/frontend/src/jsx/components/MarketingConnect'

for comp in components:
    file_path = os.path.join(base_dir, comp)
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Only inject if not already injected
        if "import './marketing-cute.css';" not in content:
            content = "import './marketing-cute.css';\n" + content
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Injected CSS into {comp}")

print("Done injecting styles.")
