import os

file_path = r"frontend/src/jsx/components/DigiLocker/UploadFiles.jsx"
with open(file_path, "r", encoding="utf-8") as f:
    code = f.read()

# 1. State definition
old_state = """  const [editNewFiles, setEditNewFiles] = useState([]);
  const [editActivePreviewIndex, setEditActivePreviewIndex] = useState(0);
  const [editErrors, setEditErrors] = useState({});
  const [isExistingRemoved, setIsExistingRemoved] = useState(false);"""

new_state = """  const [editNewFiles, setEditNewFiles] = useState([]);
  const [editPreviewSelection, setEditPreviewSelection] = useState({ type: "existing", index: 0 });
  const [editErrors, setEditErrors] = useState({});
  const [isExistingRemoved, setIsExistingRemoved] = useState(false);"""

assert old_state in code, "old_state not found"
code = code.replace(old_state, new_state, 1)

# 2. handleOpenEditModal
old_open_modal = """    setEditDocData({
      id: doc.id,
      folder: doc.folder ? String(doc.folder) : "",
      original_filename: doc.original_filename || "",
      description: doc.description || "",
      extension: doc.file_extension || "",
      file_size_display: doc.file_size_display || "",
      existingPreviewUrl: existingUrl,
    });
    setEditNewFiles([]);
    setEditActivePreviewIndex(0);
    setIsExistingRemoved(false);
    setEditErrors({});
    setShowEditModal(true);"""

new_open_modal = """    setEditDocData({
      id: doc.id,
      folder: doc.folder ? String(doc.folder) : "",
      original_filename: doc.original_filename || "",
      description: doc.description || "",
      extension: doc.file_extension || "",
      file_size_display: doc.file_size_display || "",
      existingPreviewUrl: existingUrl,
    });
    setEditNewFiles([]);
    setEditPreviewSelection({ type: "existing", index: 0 });
    setIsExistingRemoved(false);
    setEditErrors({});
    setShowEditModal(true);"""

assert old_open_modal in code, "old_open_modal not found"
code = code.replace(old_open_modal, new_open_modal, 1)

# 3. handleCloseEditModal, handleEditFileChange, handleRemoveEditFile, handleEditSubmit
old_handlers = """  const handleCloseEditModal = () => {
    if (editDocData.existingPreviewUrl) {
      URL.revokeObjectURL(editDocData.existingPreviewUrl);
    }
    editNewFiles.forEach((f) => {
      if (f._previewUrl) URL.revokeObjectURL(f._previewUrl);
    });
    setEditNewFiles([]);
    setIsExistingRemoved(false);
    setShowEditModal(false);
    setEditDocData({
      id: null,
      folder: "",
      original_filename: "",
      description: "",
      extension: "",
      file_size_display: "",
      existingPreviewUrl: null,
    });
    setEditErrors({});
  };

  const handleEditFileChange = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = [];
    const errors = [];

    files.forEach((f) => {
      const ext = f.name.split(".").pop().toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) {
        errors.push(`'${f.name}': Disallowed file extension (.${ext}).`);
      } else if (f.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`'${f.name}': Exceeds 25 MB size limit.`);
      } else {
        if (["jpg", "jpeg", "png", "gif", "webp", "pdf"].includes(ext)) {
          f._previewUrl = URL.createObjectURL(f);
        }
        validFiles.push(f);
      }
    });

    if (errors.length > 0) {
      swal("File Validation Warning", errors.join("\\n"), "warning");
    }

    if (validFiles.length > 0) {
      setIsExistingRemoved(false);
    }
    setEditNewFiles((prev) => {
      const next = [...prev, ...validFiles];
      if (prev.length === 0 && next.length > 0) {
        setEditActivePreviewIndex(0);
      }
      return next;
    });
    e.target.value = null;
  };

  const handleRemoveEditFile = (index) => {
    setEditNewFiles((prev) => {
      const removed = prev[index];
      if (removed?._previewUrl) {
        URL.revokeObjectURL(removed._previewUrl);
      }
      const updated = prev.filter((_, i) => i !== index);
      if (editActivePreviewIndex >= updated.length) {
        setEditActivePreviewIndex(Math.max(0, updated.length - 1));
      }
      return updated;
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!editDocData.folder) {
      errors.folder = "Destination folder is required.";
    }
    if (isExistingRemoved && editNewFiles.length === 0) {
      errors.files = "Please select a file to replace the removed document.";
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setUpdating(true);
    setEditErrors({});

    try {
      if (editNewFiles.length > 0) {
        // Upload newly chosen files into the selected destination folder
        const formData = new FormData();
        formData.append("folder", editDocData.folder);
        formData.append("description", editDocData.description?.trim() || "");
        editNewFiles.forEach((file) => {
          formData.append("files", file);
        });
        await DigiLockerService.uploadDocuments(formData);
      } else {
        // Update existing document destination folder and details
        await DigiLockerService.updateDocument(editDocData.id, {
          folder: editDocData.folder,
          original_filename: editDocData.original_filename?.trim() || undefined,
          description: editDocData.description?.trim() || "",
        });
      }

      swal("Success", "Document details updated successfully.", "success");
      handleCloseEditModal();
      fetchDocuments();
      fetchFolders();
    } catch (err) {
      console.error("Error updating document:", err);
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.details?.[0] ||
        err.response?.data?.original_filename?.[0] ||
        "Failed to update document.";
      swal("Error", errMsg, "error");
    } finally {
      setUpdating(false);
    }
  };"""

new_handlers = """  const handleCloseEditModal = () => {
    if (editDocData.existingPreviewUrl) {
      URL.revokeObjectURL(editDocData.existingPreviewUrl);
    }
    editNewFiles.forEach((f) => {
      if (f._previewUrl) URL.revokeObjectURL(f._previewUrl);
    });
    setEditNewFiles([]);
    setIsExistingRemoved(false);
    setEditPreviewSelection({ type: "existing", index: 0 });
    setShowEditModal(false);
    setEditDocData({
      id: null,
      folder: "",
      original_filename: "",
      description: "",
      extension: "",
      file_size_display: "",
      existingPreviewUrl: null,
    });
    setEditErrors({});
  };

  const handleEditFileChange = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = [];
    const errors = [];

    files.forEach((f) => {
      const ext = f.name.split(".").pop().toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) {
        errors.push(`'${f.name}': Disallowed file extension (.${ext}).`);
      } else if (f.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`'${f.name}': Exceeds 25 MB size limit.`);
      } else {
        if (["jpg", "jpeg", "png", "gif", "webp", "pdf"].includes(ext)) {
          f._previewUrl = URL.createObjectURL(f);
        }
        validFiles.push(f);
      }
    });

    if (errors.length > 0) {
      swal("File Validation Warning", errors.join("\\n"), "warning");
    }

    if (validFiles.length > 0) {
      setEditNewFiles((prev) => {
        const next = [...prev, ...validFiles];
        // Automatically switch preview to the newly added file
        setEditPreviewSelection({ type: "new", index: prev.length });
        return next;
      });
    }
    e.target.value = null;
  };

  const handleRemoveEditFile = (index) => {
    setEditNewFiles((prev) => {
      const removed = prev[index];
      if (removed?._previewUrl) {
        URL.revokeObjectURL(removed._previewUrl);
      }
      const updated = prev.filter((_, i) => i !== index);

      // Adjust preview selection if needed
      setEditPreviewSelection((current) => {
        if (current.type === "new") {
          if (current.index === index) {
            if (updated.length > 0) {
              return { type: "new", index: Math.min(index, updated.length - 1) };
            } else if (!isExistingRemoved) {
              return { type: "existing", index: 0 };
            } else {
              return { type: "none", index: 0 };
            }
          } else if (current.index > index) {
            return { type: "new", index: current.index - 1 };
          }
        }
        return current;
      });

      return updated;
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!editDocData.folder) {
      errors.folder = "Destination folder is required.";
    }
    if (isExistingRemoved && editNewFiles.length === 0) {
      errors.files = "Please select at least one file or keep the current file.";
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setUpdating(true);
    setEditErrors({});

    try {
      // 1. If existing file is kept (!isExistingRemoved), update its destination folder and details
      if (!isExistingRemoved) {
        await DigiLockerService.updateDocument(editDocData.id, {
          folder: editDocData.folder,
          original_filename: editDocData.original_filename?.trim() || undefined,
          description: editDocData.description?.trim() || "",
        });
      } else if (isExistingRemoved && editNewFiles.length > 0) {
        // If user explicitly removed the existing document and added replacement file(s),
        // delete the old document
        try {
          await DigiLockerService.deleteDocument(editDocData.id);
        } catch (delErr) {
          console.warn("Could not delete previous document during replacement:", delErr);
        }
      }

      // 2. If new files were added to the folder, upload them as additional documents in this folder
      if (editNewFiles.length > 0) {
        const formData = new FormData();
        formData.append("folder", editDocData.folder);
        formData.append("description", editDocData.description?.trim() || "");
        editNewFiles.forEach((file) => {
          formData.append("files", file);
        });
        await DigiLockerService.uploadDocuments(formData);
      }

      swal("Success", "Document changes saved successfully.", "success");
      handleCloseEditModal();
      fetchDocuments();
      fetchFolders();
    } catch (err) {
      console.error("Error updating document:", err);
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.details?.[0] ||
        err.response?.data?.original_filename?.[0] ||
        "Failed to update document.";
      swal("Error", errMsg, "error");
    } finally {
      setUpdating(false);
    }
  };"""

assert old_handlers in code, "old_handlers not found"
code = code.replace(old_handlers, new_handlers, 1)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(code)

print("Part 1 updated successfully.")

