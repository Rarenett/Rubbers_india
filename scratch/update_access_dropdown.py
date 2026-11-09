with open('frontend/src/jsx/components/DigiLocker/DigiLockerAccess.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = """                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.user_name || emp.full_name || `Emp #${emp.id}`}
                        </option>
                      ))}"""

replacement = """                      <option value="all">All Employees</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.user_name || emp.full_name || `Emp #${emp.id}`}
                        </option>
                      ))}"""

if '\r\n' in text:
    target = target.replace('\n', '\r\n')
    replacement = replacement.replace('\n', '\r\n')

assert target in text, "target not found"
text = text.replace(target, replacement, 1)

with open('frontend/src/jsx/components/DigiLocker/DigiLockerAccess.jsx', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Updated DigiLockerAccess.jsx dropdown with All Employees option.")

