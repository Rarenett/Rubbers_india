const fs = require('fs');

let s = fs.readFileSync('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'utf8');

// 1. Update imports
s = s.replace(
  'import { Card, Form, Modal, Button, Row } from "react-bootstrap";',
  'import { Card, Form, Modal, Button, Row, Tab, Nav, Badge } from "react-bootstrap";\r\nimport Swal from "sweetalert2";'
);

// 2. Add state inside DigiLockerMapping component
const stateInjectionPoint = '  // Pagination\r\n  const [currentPage, setCurrentPage] = useState(1);\r\n  const itemsPerPage = 10;';
const newStates = `  // Tab State: 'mapping' | 'ownership_transfer'
  const [activeTab, setActiveTab] = useState('mapping');

  // Ownership Transfer Tab State
  const [transferSearchTerm, setTransferSearchTerm] = useState('');
  const [transferCurrentPage, setTransferCurrentPage] = useState(1);
  const transferItemsPerPage = 10;

  // Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedFolderToTransfer, setSelectedFolderToTransfer] = useState(null);
  const [newOwnerEmployeeId, setNewOwnerEmployeeId] = useState('');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  // Transfer History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedFolderForHistory, setSelectedFolderForHistory] = useState(null);
  const [folderHistoryList, setFolderHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);`;

s = s.replace(stateInjectionPoint, stateInjectionPoint + '\r\n\r\n' + newStates);

// 3. Add helper methods before return
const helpersInjectionPoint = '  return (\r\n    <div className="container-fluid park-area-page">';
const newHelpers = `  // Open Transfer Modal
  const handleOpenTransferModal = (folder) => {
    setSelectedFolderToTransfer(folder);
    setNewOwnerEmployeeId('');
    setNewOwnerEmail('');
    setTransferReason('');
    setShowTransferModal(true);
  };

  const handleCloseTransferModal = () => {
    setShowTransferModal(false);
    setSelectedFolderToTransfer(null);
    setNewOwnerEmployeeId('');
    setNewOwnerEmail('');
    setTransferReason('');
    setTransferSubmitting(false);
  };

  // Handle New Owner Selection in Modal
  const handleNewOwnerChange = (e) => {
    const empId = e.target.value;
    setNewOwnerEmployeeId(empId);
    if (!empId) {
      setNewOwnerEmail('');
      return;
    }
    const emp = employees.find((empItem) => String(empItem.id) === String(empId));
    const email = emp?.email || emp?.user_email || emp?.work_email || emp?.candidate?.email || '';
    setNewOwnerEmail(email);
  };

  // Submit Ownership Transfer
  const handleSubmitTransfer = async (e) => {
    e.preventDefault();
    if (!selectedFolderToTransfer) return;

    if (!newOwnerEmployeeId) {
      Swal.fire('Validation Error', 'Please select a new owner for this folder.', 'warning');
      return;
    }

    const selectedEmp = employees.find((empItem) => String(empItem.id) === String(newOwnerEmployeeId));
    const newOwnerName = selectedEmp?.full_name || selectedEmp?.employee_name || selectedEmp?.candidate?.full_name || ('Employee #' + newOwnerEmployeeId);

    const confirmRes = await Swal.fire({
      title: 'Confirm Ownership Transfer',
      html: '<p class="text-start mb-2">Are you sure you want to transfer ownership of folder <strong>"' + (selectedFolderToTransfer.name || '') + '"</strong>?</p>' +
             '<div class="alert alert-warning text-start py-2 small mb-0">' +
               '<div><strong>Current Owner:</strong> ' + (selectedFolderToTransfer.owner_name || selectedFolderToTransfer.current_owner_name || '-') + ' (' + (selectedFolderToTransfer.owner_email || selectedFolderToTransfer.current_owner_email || '-') + ')</div>' +
               '<div><strong>New Owner:</strong> ' + newOwnerName + ' (' + (newOwnerEmail || 'No email') + ')</div>' +
               '<div class="mt-1 text-muted">All future OTP access verification requests for documents in this folder will be routed to the new owner. Existing documents, uploaders, and permissions will remain intact.</div>' +
             '</div>',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3d3577',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, Transfer Ownership',
      cancelButtonText: 'Cancel'
    });

    if (!confirmRes.isConfirmed) return;

    setTransferSubmitting(true);
    try {
      await DigiLockerService.transferFolderOwnership(selectedFolderToTransfer.id, {
        new_owner_employee_id: newOwnerEmployeeId,
        transfer_reason: transferReason.trim()
      });

      Swal.fire('Success', 'Ownership of folder "' + selectedFolderToTransfer.name + '" transferred successfully to ' + newOwnerName + '.', 'success');
      handleCloseTransferModal();
      fetchFolders();
    } catch (err) {
      console.error('Error transferring folder ownership:', err);
      const msg = err.response?.data?.error || 'Failed to transfer folder ownership.';
      Swal.fire('Error', msg, 'error');
    } finally {
      setTransferSubmitting(false);
    }
  };

  // Open Transfer History Modal
  const handleOpenHistoryModal = async (folder) => {
    setSelectedFolderForHistory(folder);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const res = await DigiLockerService.getFolderOwnershipHistory(folder.id);
      setFolderHistoryList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching folder ownership history:', err);
      Swal.fire('Error', 'Failed to load folder ownership history.', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Filter & Pagination for Ownership Transfer Tab
  const activeEmployees = useMemo(() => {
    return employees.filter((emp) => emp.is_active !== false);
  }, [employees]);

  const filteredTransferFolders = useMemo(() => {
    return folders.filter((folder) => {
      const search = transferSearchTerm.toLowerCase();
      const folderName = (folder.name || '').toLowerCase();
      const ownerName = (folder.owner_name || folder.current_owner_name || '').toLowerCase();
      const ownerEmail = (folder.owner_email || folder.current_owner_email || '').toLowerCase();
      const latestNewOwner = (folder.latest_transfer?.new_owner_name || '').toLowerCase();
      return (
        !search ||
        folderName.includes(search) ||
        ownerName.includes(search) ||
        ownerEmail.includes(search) ||
        latestNewOwner.includes(search)
      );
    });
  }, [folders, transferSearchTerm]);

  const transferTotalPages = Math.ceil(filteredTransferFolders.length / transferItemsPerPage) || 1;
  const transferIndexOfLast = transferCurrentPage * transferItemsPerPage;
  const transferIndexOfFirst = transferIndexOfLast - transferItemsPerPage;
  const currentTransferFolders = filteredTransferFolders.slice(transferIndexOfFirst, transferIndexOfLast);`;

s = s.replace(helpersInjectionPoint, newHelpers + '\r\n\r\n  return (\r\n    <div className="container-fluid park-area-page">');

fs.writeFileSync('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', s, 'utf8');
console.log('Successfully injected states and helper methods');

