with open('frontend/src/jsx/components/DigiLocker/FileApproval.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add handleSetPendingFile handler right after handleApproveFile
target_approve = '''  // Handle Approve File
  const handleApproveFile = async (doc) => {
    const result = await Swal.fire({
      title: 'Approve File?',
      text: `Are you sure you want to approve "${doc.original_filename}"? Once approved, the document is locked for the employee.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Approve',
      confirmButtonColor: '#28a745',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    setActionInProgressId(doc.id);
    try {
      await DigiLockerService.approveFile(doc.id);
      Swal.fire('Approved!', `"${doc.original_filename}" has been approved successfully.`, 'success');
      fetchFileApprovals();
    } catch (err) {
      console.error('Error approving document:', err);
      const msg = err.response?.data?.error || 'Failed to approve document.';
      Swal.fire('Error', msg, 'error');
    } finally {
      setActionInProgressId(null);
    }
  };'''

replacement_approve = '''  // Handle Approve File
  const handleApproveFile = async (doc) => {
    const result = await Swal.fire({
      title: 'Approve File?',
      text: `Are you sure you want to approve "${doc.original_filename}"? Once approved, the document is locked for the employee.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Approve',
      confirmButtonColor: '#28a745',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    setActionInProgressId(doc.id);
    try {
      await DigiLockerService.approveFile(doc.id);
      Swal.fire('Approved!', `"${doc.original_filename}" has been approved successfully.`, 'success');
      fetchFileApprovals();
    } catch (err) {
      console.error('Error approving document:', err);
      const msg = err.response?.data?.error || 'Failed to approve document.';
      Swal.fire('Error', msg, 'error');
    } finally {
      setActionInProgressId(null);
    }
  };

  // Handle Changing Approved Document back to Pending
  const handleSetPendingFile = async (doc) => {
    const result = await Swal.fire({
      title: 'Change to Pending?',
      text: `Do you want to change "${doc.original_filename}" back to Pending status? This will allow the document to be edited or re-reviewed.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Change to Pending',
      confirmButtonColor: '#ffc107',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    setActionInProgressId(doc.id);
    try {
      await DigiLockerService.setFilePending(doc.id, { remarks: 'Status changed to Pending by administrator for editing or re-evaluation.' });
      Swal.fire('Changed to Pending!', `"${doc.original_filename}" is now in Pending status.`, 'success');
      fetchFileApprovals();
    } catch (err) {
      console.error('Error reverting document to pending:', err);
      const msg = err.response?.data?.error || 'Failed to change status to Pending.';
      Swal.fire('Error', msg, 'error');
    } finally {
      setActionInProgressId(null);
    }
  };'''

assert target_approve in content, "target_approve not found in FileApproval.jsx"
content = content.replace(target_approve, replacement_approve, 1)

# 2. Update the Action buttons inside table row
old_action_buttons = '''                                  {/* Approve Button (Enabled if pending or rejected) */}
                                  {isPending && (
                                    <>
                                      <Button
                                        variant="outline-success"
                                        size="sm"
                                        className="p-1 px-2"
                                        title="Approve Document"
                                        disabled={actionInProgressId === doc.id}
                                        onClick={() => handleApproveFile(doc)}
                                      >
                                        <i className="fa fa-check"></i>
                                      </Button>
                                      <Button
                                        variant="outline-danger"
                                        size="sm"
                                        className="p-1 px-2"
                                        title="Reject Document"
                                        disabled={actionInProgressId === doc.id}
                                        onClick={() => handleOpenRejectModal('file', doc)}
                                      >
                                        <i className="fa fa-times"></i>
                                      </Button>
                                    </>
                                  )}'''

new_action_buttons = '''                                  {/* Approve / Set Pending Button */}
                                  {isPending ? (
                                    <>
                                      <Button
                                        variant="outline-success"
                                        size="sm"
                                        className="p-1 px-2"
                                        title="Approve Document"
                                        disabled={actionInProgressId === doc.id}
                                        onClick={() => handleApproveFile(doc)}
                                      >
                                        <i className="fa fa-check"></i>
                                      </Button>
                                      <Button
                                        variant="outline-danger"
                                        size="sm"
                                        className="p-1 px-2"
                                        title="Reject Document"
                                        disabled={actionInProgressId === doc.id}
                                        onClick={() => handleOpenRejectModal('file', doc)}
                                      >
                                        <i className="fa fa-times"></i>
                                      </Button>
                                    </>
                                  ) : doc.approval_status === 'approved' ? (
                                    <Button
                                      variant="success"
                                      size="sm"
                                      className="p-1 px-2"
                                      title="Approved - Click to change to Pending"
                                      disabled={actionInProgressId === doc.id}
                                      onClick={() => handleSetPendingFile(doc)}
                                      style={{ backgroundColor: '#28a745', borderColor: '#28a745', color: '#fff' }}
                                    >
                                      <i className="fa fa-check"></i>
                                    </Button>
                                  ) : (
                                    /* Rejected: Allow re-approving */
                                    <Button
                                      variant="outline-success"
                                      size="sm"
                                      className="p-1 px-2"
                                      title="Re-approve Document"
                                      disabled={actionInProgressId === doc.id}
                                      onClick={() => handleApproveFile(doc)}
                                    >
                                      <i className="fa fa-check"></i>
                                    </Button>
                                  )}'''

assert old_action_buttons in content, "old_action_buttons not found in FileApproval.jsx"
content = content.replace(old_action_buttons, new_action_buttons, 1)

with open('frontend/src/jsx/components/DigiLocker/FileApproval.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated FileApproval.jsx with tick button for approved documents!")

