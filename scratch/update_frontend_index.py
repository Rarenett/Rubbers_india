with open('frontend/src/jsx/index.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add import
old_import = "import FileDownloadReport from './components/DigiLocker/FileDownloadReport.jsx';"
new_import = """import FileDownloadReport from './components/DigiLocker/FileDownloadReport.jsx';
import FileApproval from './components/DigiLocker/FileApproval.jsx';"""

assert old_import in text, "old_import not found in index.jsx"
text = text.replace(old_import, new_import, 1)

# 2. Add route
old_route = "    { url: 'digilocker/access/', component: <ProtectedRoute module=\"digilocker_access\" action=\"view\"><DigiLockerAccess /></ProtectedRoute> },"
new_route = """    { url: 'digilocker/access/', component: <ProtectedRoute module=\"digilocker_access\" action=\"view\"><DigiLockerAccess /></ProtectedRoute> },
    { url: 'digilocker/file-approval', component: <ProtectedRoute module=\"digilocker_approval\" action=\"view\"><FileApproval /></ProtectedRoute> },
    { url: 'digilocker/file-approval/', component: <ProtectedRoute module=\"digilocker_approval\" action=\"view\"><FileApproval /></ProtectedRoute> },"""

assert old_route in text, "old_route not found in index.jsx"
text = text.replace(old_route, new_route, 1)

with open('frontend/src/jsx/index.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("index.jsx updated successfully with FileApproval route.")

