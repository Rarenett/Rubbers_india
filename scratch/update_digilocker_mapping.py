with open('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update sharedFolders to mappableFolders (including both shared and personal folders)
old_memo = """  // Build tree index of folders
  const sharedFolders = useMemo(() => {
    return folders.filter((f) => f.folder_type === "shared" && f.is_active);
  }, [folders]);

  const folderMap = useMemo(() => {
    const map = new Map();
    sharedFolders.forEach((f) => map.set(f.id, f));
    return map;
  }, [sharedFolders]);

  const childrenMap = useMemo(() => {
    const map = new Map();
    sharedFolders.forEach((f) => {
      const pId = f.parent_folder || null;
      if (!map.has(pId)) map.set(pId, []);
      map.get(pId).push(f.id);
    });
    return map;
  }, [sharedFolders]);"""

new_memo = """  // Build tree index of folders (including both shared and personal folders for mapping)
  const mappableFolders = useMemo(() => {
    return folders.filter((f) => f.is_active);
  }, [folders]);

  const folderMap = useMemo(() => {
    const map = new Map();
    mappableFolders.forEach((f) => map.set(f.id, f));
    return map;
  }, [mappableFolders]);

  const childrenMap = useMemo(() => {
    const map = new Map();
    mappableFolders.forEach((f) => {
      const pId = f.parent_folder || null;
      if (!map.has(pId)) map.set(pId, []);
      map.get(pId).push(f.id);
    });
    return map;
  }, [mappableFolders]);"""

assert old_memo in text, "old_memo not found"
text = text.replace(old_memo, new_memo, 1)

# 2. Update renderFolderTreeNode to show a distinctive badge if folder is personal
old_node_label = """            <div className="text-truncate">
              <span className="fw-semibold text-dark" style={{ fontSize: "13px" }}>
                {folder.name}
              </span>
              <span className="text-muted ms-2" style={{ fontSize: "11px" }}>
                ({folder.documents_count} file{folder.documents_count === 1 ? "" : "s"})
              </span>
              {isAlreadyMapped && (
                <span className="badge badge-xs bg-light text-muted ms-2 border" style={{ fontSize: "10px" }}>
                  Mapped
                </span>
              )}
            </div>"""

new_node_label = """            <div className="text-truncate">
              <span className="fw-semibold text-dark" style={{ fontSize: "13px" }}>
                {folder.name}
              </span>
              {folder.folder_type === "personal" ? (
                <span className="badge badge-xs bg-info-subtle text-info ms-2 border border-info-subtle" style={{ fontSize: "10px" }}>
                  <i className="fa fa-user me-1"></i>Personal{folder.owner_name && folder.owner_name !== '-' ? ` (${folder.owner_name})` : ''}
                </span>
              ) : null}
              <span className="text-muted ms-2" style={{ fontSize: "11px" }}>
                ({folder.documents_count} file{folder.documents_count === 1 ? "" : "s"})
              </span>
              {isAlreadyMapped && (
                <span className="badge badge-xs bg-light text-muted ms-2 border" style={{ fontSize: "10px" }}>
                  Mapped
                </span>
              )}
            </div>"""

assert old_node_label in text, "old_node_label not found"
text = text.replace(old_node_label, new_node_label, 1)

# 3. Update the modal container where sharedFolders was referenced
old_modal_list = """                  {sharedFolders.length === 0 ? (
                    <div className="text-muted text-center py-3">
                      No shared folders available. Please create shared folders first.
                    </div>
                  ) : (
                    (childrenMap.get(null) || []).map((rootId) =>
                      renderFolderTreeNode(rootId, 0)
                    )
                  )}"""

new_modal_list = """                  {mappableFolders.length === 0 ? (
                    <div className="text-muted text-center py-3">
                      No folders available for mapping. Please create folders first.
                    </div>
                  ) : (
                    (childrenMap.get(null) || []).map((rootId) =>
                      renderFolderTreeNode(rootId, 0)
                    )
                  )}"""

assert old_modal_list in text, "old_modal_list not found"
text = text.replace(old_modal_list, new_modal_list, 1)

with open('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("DigiLockerMapping.jsx updated successfully.")

