with open('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update handleOpenModal to auto-expand all folders with children
old_open_expand = """      // Auto-expand all root folders in the tree modal by default
      const rootIds = childrenMap.get(null) || [];
      setModalExpandedFolders(new Set(rootIds));"""

new_open_expand = """      // Auto-expand all folders that have children so subfolders (including personal subfolders) are immediately visible
      const allParentIds = [];
      childrenMap.forEach((children, parentId) => {
        if (parentId && children.length > 0) allParentIds.push(parentId);
      });
      const rootIds = childrenMap.get(null) || [];
      setModalExpandedFolders(new Set([...rootIds, ...allParentIds]));"""

assert old_open_expand in text, "old_open_expand not found"
text = text.replace(old_open_expand, new_open_expand, 1)

# 2. Add Expand All / Collapse All controls right above the folder tree
old_tree_header = """                <div className="text-muted small mb-2">
                  Selecting a parent folder automatically selects all its subfolders. You can also select individual subfolders independently.
                </div>"""

new_tree_header = """                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="text-muted small">
                    Selecting a parent folder automatically selects all its subfolders. You can also select individual subfolders independently.
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-link btn-xs text-primary p-0 text-decoration-none"
                      style={{ fontSize: "12px" }}
                      onClick={() => {
                        const allParentIds = Array.from(folderMap.keys());
                        setModalExpandedFolders(new Set(allParentIds));
                      }}
                    >
                      <i className="fa fa-plus-square-o me-1"></i>Expand All
                    </button>
                    <span className="text-muted small">|</span>
                    <button
                      type="button"
                      className="btn btn-link btn-xs text-secondary p-0 text-decoration-none"
                      style={{ fontSize: "12px" }}
                      onClick={() => setModalExpandedFolders(new Set())}
                    >
                      <i className="fa fa-minus-square-o me-1"></i>Collapse All
                    </button>
                  </div>
                </div>"""

assert old_tree_header in text, "old_tree_header not found"
text = text.replace(old_tree_header, new_tree_header, 1)

with open('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("DigiLockerMapping.jsx auto-expand updated successfully.")

