import re

file_path = 'c:/Paul@Rarenett/glenda_vite1/backend/project_app/urls.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the import line
content = re.sub(r"from \.attendance_views import register_face, check_face_registered, mark_attendance\n", "", content)

# Remove the paths
content = re.sub(r"    path\('marketing/attendance/register-face/', register_face, name='register-face'\),\n", "", content)
content = re.sub(r"    path\('marketing/attendance/check-face/', check_face_registered, name='check-face'\),\n", "", content)
content = re.sub(r"    path\('marketing/attendance/mark/', mark_attendance, name='mark-attendance'\),\n", "", content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed missing attendance_views imports from urls.py")
