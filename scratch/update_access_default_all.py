with open('frontend/src/jsx/components/DigiLocker/DigiLockerAccess.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

old_load = """  const loadInitialData = async () => {
    // First, load access data for the logged-in user
    const data = await fetchAccessData();

    // Check if user is an administrator (superuser or admin role, strictly excluding HOD, staff, employees)
    const userDetails = JSON.parse(localStorage.getItem("userDetails") || "{}");
    const user = userDetails.user || {};
    const roleName = (user.role?.name || user.role_name || user.role || "").toLowerCase().trim();
    const isClientAdmin = Boolean(
      user.is_superuser ||
      ["admin", "super admin", "superadmin", "administrator"].includes(roleName)
    );

    const userIsAdmin = Boolean(data ? (data.is_admin && isClientAdmin) : isClientAdmin);
    setIsAdmin(userIsAdmin);

    // Only administrators fetch and see other employees
    if (userIsAdmin) {
      fetchEmployees(data?.employee_id);
    } else {
      setEmployees([]);
    }
  };

  const fetchEmployees = async (currentEmpId = null) => {
    try {
      const res = await DigiLockerService.getEmployees();
      const data = res.data;
      const empList = Array.isArray(data) ? data : data.results || [];
      setEmployees(empList);
      if (currentEmpId) {
        setSelectedEmployeeId(String(currentEmpId));
      }
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  };"""

new_load = """  const loadInitialData = async () => {
    // Check if user is an administrator (superuser or admin role, strictly excluding HOD, staff, employees)
    const userDetails = JSON.parse(localStorage.getItem("userDetails") || "{}");
    const user = userDetails.user || {};
    const roleName = (user.role?.name || user.role_name || user.role || "").toLowerCase().trim();
    const isClientAdmin = Boolean(
      user.is_superuser ||
      ["admin", "super admin", "superadmin", "administrator"].includes(roleName)
    );

    setIsAdmin(isClientAdmin);

    if (isClientAdmin) {
      // Default to "all" employees for administrators when opening the page
      setSelectedEmployeeId("all");
      await fetchAccessData("all");
      fetchEmployees("all");
    } else {
      setEmployees([]);
      await fetchAccessData();
    }
  };

  const fetchEmployees = async (currentEmpId = "all") => {
    try {
      const res = await DigiLockerService.getEmployees();
      const data = res.data;
      const empList = Array.isArray(data) ? data : data.results || [];
      setEmployees(empList);
      if (currentEmpId) {
        setSelectedEmployeeId(String(currentEmpId));
      }
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  };"""

if '\r\n' in text:
    old_load = old_load.replace('\n', '\r\n')
    new_load = new_load.replace('\n', '\r\n')

assert old_load in text, "old_load not found"
text = text.replace(old_load, new_load, 1)

with open('frontend/src/jsx/components/DigiLocker/DigiLockerAccess.jsx', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Updated DigiLockerAccess.jsx to default to All Employees on load.")

