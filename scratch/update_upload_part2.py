import os

file_path = r"frontend/src/jsx/components/DigiLocker/UploadFiles.jsx"
with open(file_path, "r", encoding="utf-8") as f:
    code = f.read()

# Replace the Selected Files section and File Preview section
# Starting from lines ~1430 to 1810

target_block = """                {/* Selected Files / Existing File Item */}
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <Form.Label className="fw-semibold mb-0" style={{ fontSize: "13px" }}>
                      Selected Files ({editNewFiles.length > 0 ? editNewFiles.length : (isExistingRemoved ? 0 : 1)}):
                    </Form.Label>
                    {(editNewFiles.length > 0 || isExistingRemoved) && (
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-primary p-0 text-decoration-none"
                        style={{ fontSize: "12px" }}
                        onClick={() => {
                          editNewFiles.forEach((f) => {
                            if (f._previewUrl) URL.revokeObjectURL(f._previewUrl);
                          });
                          setEditNewFiles([]);
                          setIsExistingRemoved(false);
                          setEditActivePreviewIndex(0);
                        }}
                      >
                        <i className="fa fa-undo me-1"></i>Reset to Original
                      </button>
                    )}
                  </div>

                  <div
                    className="border rounded p-2"
                    style={{ maxHeight: "190px", overflowY: "auto", backgroundColor: "#f8fafc" }}
                  >
                    <div className="d-flex flex-column gap-1">
                      {editNewFiles.length > 0 ? (
                        editNewFiles.map((f, idx) => {
                          const ext = f.name.split(".").pop().toLowerCase();
                          const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
                          const isSelected = editActivePreviewIndex === idx;
                          return (
                            <div
                              key={idx}
                              onClick={() => setEditActivePreviewIndex(idx)}
                              className={`d-flex align-items-center justify-content-between p-2 rounded border cursor-pointer ${
                                isSelected ? "border-primary bg-white shadow-sm" : "bg-white"
                              }`}
                              style={{
                                cursor: "pointer",
                                borderLeftWidth: isSelected ? "4px" : "1px",
                                borderLeftColor: isSelected ? "rgb(61, 53, 119)" : undefined,
                              }}
                            >
                              <div className="d-flex align-items-center text-truncate me-2" style={{ minWidth: 0 }}>
                                {isImage && f._previewUrl ? (
                                  <img
                                    src={f._previewUrl}
                                    alt={f.name}
                                    style={{
                                      width: "28px",
                                      height: "28px",
                                      objectFit: "cover",
                                      borderRadius: "4px",
                                      flexShrink: 0,
                                    }}
                                    className="me-2 border"
                                  />
                                ) : (
                                  <div
                                    className="d-flex align-items-center justify-content-center me-2 bg-light rounded"
                                    style={{ width: "28px", height: "28px", flexShrink: 0 }}
                                  >
                                    {getFileIcon(ext)}
                                  </div>
                                )}
                                <div className="text-truncate">
                                  <div
                                    className={`text-truncate ${isSelected ? "fw-bold text-primary" : "fw-semibold text-dark"}`}
                                    style={{ fontSize: "12px" }}
                                    title={f.name}
                                  >
                                    {f.name}
                                  </div>
                                  <div className="text-muted" style={{ fontSize: "11px" }}>
                                    {f.size > 1024 * 1024
                                      ? `${(f.size / (1024 * 1024)).toFixed(2)} MB`
                                      : `${(f.size / 1024).toFixed(1)} KB`}
                                  </div>
                                </div>
                              </div>
                              <div className="d-flex align-items-center gap-1 flex-shrink-0">
                                {isSelected && (
                                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle" style={{ fontSize: "10px" }}>
                                    Viewing
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger shadow-sm ms-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveEditFile(idx);
                                  }}
                                  style={{ width: "22px", height: "22px", padding: 0, borderRadius: "50%" }}
                                  title="Remove file"
                                >
                                  <i className="fa fa-times" style={{ fontSize: "10px" }}></i>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : !isExistingRemoved ? (
                        /* Current Existing Document Item */
                        <div
                          className="d-flex align-items-center justify-content-between p-2 rounded border bg-white shadow-sm border-primary"
                          style={{
                            borderLeftWidth: "4px",
                            borderLeftColor: "rgb(61, 53, 119)",
                          }}
                        >
                          <div className="d-flex align-items-center text-truncate me-2" style={{ minWidth: 0 }}>
                            {["jpg", "jpeg", "png", "gif", "webp"].includes(
                              (editDocData.extension || "").toLowerCase()
                            ) && editDocData.existingPreviewUrl ? (
                              <img
                                src={editDocData.existingPreviewUrl}
                                alt={editDocData.original_filename}
                                style={{
                                  width: "28px",
                                  height: "28px",
                                  objectFit: "cover",
                                  borderRadius: "4px",
                                  flexShrink: 0,
                                }}
                                className="me-2 border"
                              />
                            ) : (
                              <div
                                className="d-flex align-items-center justify-content-center me-2 bg-light rounded"
                                style={{ width: "28px", height: "28px", flexShrink: 0 }}
                              >
                                {getFileIcon(editDocData.extension)}
                              </div>
                            )}
                            <div className="text-truncate">
                              <div
                                className="text-truncate fw-bold text-primary"
                                style={{ fontSize: "12px" }}
                                title={editDocData.original_filename}
                              >
                                {editDocData.original_filename}
                              </div>
                              <div className="text-muted" style={{ fontSize: "11px" }}>
                                {editDocData.file_size_display || `.${editDocData.extension?.toUpperCase()}`}
                              </div>
                            </div>
                          </div>
                          <div className="d-flex align-items-center gap-1 flex-shrink-0">
                            <span
                              className="badge bg-primary-subtle text-primary border border-primary-subtle"
                              style={{ fontSize: "10px" }}
                            >
                              Current
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger shadow-sm ms-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsExistingRemoved(true);
                              }}
                              style={{ width: "22px", height: "22px", padding: 0, borderRadius: "50%" }}
                              title="Remove file"
                            >
                              <i className="fa fa-times" style={{ fontSize: "10px" }}></i>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 px-2 text-muted bg-white rounded border border-dashed">
                          <i className="fa fa-file-text-o fa-2x text-muted mb-2 d-block opacity-50"></i>
                          <div className="small fw-semibold text-danger mb-1">Current file removed</div>
                          <div className="small text-muted" style={{ fontSize: "11px" }}>
                            Click the box above to choose a replacement file.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: File Preview */}
              <div className="col-12 col-lg-6 d-flex flex-column">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="fw-semibold text-dark" style={{ fontSize: "14px" }}>
                    <i className="fa fa-eye text-primary me-2"></i>File Preview
                  </span>
                  <span className="badge bg-light text-dark border">
                    {editNewFiles.length > 0
                      ? `${editActivePreviewIndex + 1} of ${editNewFiles.length}`
                      : (isExistingRemoved ? "0 of 0" : "1 of 1")}
                  </span>
                </div>

                <div
                  className="card border rounded flex-grow-1 d-flex flex-column m-0 p-0 overflow-hidden"
                  style={{
                    backgroundColor: "#f8fafc",
                    minHeight: "380px",
                    maxHeight: "480px",
                  }}
                >
                  {(() => {
                    if (editNewFiles.length > 0) {
                      const activeFile = editNewFiles[editActivePreviewIndex] || editNewFiles[0];
                      if (!activeFile) return null;
                      const activeExt = activeFile.name.split(".").pop().toLowerCase();
                      const isImg = ["jpg", "jpeg", "png", "gif", "webp"].includes(activeExt);
                      const isPdf = activeExt === "pdf";

                      return (
                        <div className="d-flex flex-column h-100">
                          <div className="bg-white border-bottom px-3 py-2 d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center text-truncate me-2">
                              <span className="me-2">{getFileIcon(activeExt)}</span>
                              <div className="text-truncate">
                                <div
                                  className="fw-bold text-dark text-truncate"
                                  style={{ fontSize: "13px" }}
                                  title={activeFile.name}
                                >
                                  {activeFile.name}
                                </div>
                                <div className="text-muted" style={{ fontSize: "11px" }}>
                                  {activeFile.size > 1024 * 1024
                                    ? `${(activeFile.size / (1024 * 1024)).toFixed(2)} MB`
                                    : `${(activeFile.size / 1024).toFixed(1)} KB`}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div
                            className="flex-grow-1 d-flex flex-column justify-content-start overflow-auto p-2"
                            style={{
                              backgroundColor: isImg ? "#1e293b" : "#f1f5f9",
                              minHeight: "330px",
                              maxHeight: "410px",
                            }}
                          >
                            {isImg && activeFile._previewUrl ? (
                              <div className="d-flex align-items-center justify-content-center h-100 m-auto">
                                <img
                                  src={activeFile._previewUrl}
                                  alt={activeFile.name}
                                  style={{
                                    maxWidth: "100%",
                                    maxHeight: "380px",
                                    objectFit: "contain",
                                    borderRadius: "4px",
                                  }}
                                />
                              </div>
                            ) : isPdf && activeFile._previewUrl ? (
                              <iframe
                                src={`${activeFile._previewUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                                title={activeFile.name}
                                style={{
                                  width: "100%",
                                  height: "390px",
                                  border: "none",
                                  borderRadius: "4px",
                                  backgroundColor: "#ffffff",
                                }}
                              />
                            ) : (
                              <div
                                className="text-center p-4 bg-white rounded shadow-sm m-auto"
                                style={{ maxWidth: "320px" }}
                              >
                                <div className="mb-2">{getFileIcon(activeExt)}</div>
                                <h6 className="fw-bold text-dark mb-1">{activeFile.name}</h6>
                                <p className="text-muted small mb-0">
                                  File ready to upload (.{activeExt.toUpperCase()}).
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (isExistingRemoved) {
                      return (
                        <div className="h-100 d-flex flex-column align-items-center justify-content-center p-4 text-center m-auto">
                          <div
                            className="rounded-circle bg-white d-flex align-items-center justify-content-center shadow-sm mb-3"
                            style={{ width: "64px", height: "64px" }}
                          >
                            <i className="fa fa-file-text-o fa-2x text-muted"></i>
                          </div>
                          <h6 className="fw-bold text-dark mb-1">No File Selected</h6>
                          <p className="text-muted small mb-0" style={{ maxWidth: "260px" }}>
                            The file was removed. Please choose a new file on the left to preview it here before saving.
                          </p>
                        </div>
                      );
                    }

                    // Existing Document Preview
                    const existingExt = (editDocData.extension || "").toLowerCase();
                    const isImg = ["jpg", "jpeg", "png", "gif", "webp"].includes(existingExt);
                    const isPdf = existingExt === "pdf";

                    return (
                      <div className="d-flex flex-column h-100">
                        <div className="bg-white border-bottom px-3 py-2 d-flex align-items-center justify-content-between">
                          <div className="d-flex align-items-center text-truncate me-2">
                            <span className="me-2">{getFileIcon(existingExt)}</span>
                            <div className="text-truncate">
                              <div
                                className="fw-bold text-dark text-truncate"
                                style={{ fontSize: "13px" }}
                                title={editDocData.original_filename}
                              >
                                {editDocData.original_filename}
                              </div>
                              <div className="text-muted" style={{ fontSize: "11px" }}>
                                {editDocData.file_size_display || `.${existingExt.toUpperCase()}`}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div
                          className="flex-grow-1 d-flex flex-column justify-content-start overflow-auto p-2"
                          style={{
                            backgroundColor: isImg ? "#1e293b" : "#f1f5f9",
                            minHeight: "330px",
                            maxHeight: "410px",
                          }}
                        >
                          {isImg && editDocData.existingPreviewUrl ? (
                            <div className="d-flex align-items-center justify-content-center h-100 m-auto">
                              <img
                                src={editDocData.existingPreviewUrl}
                                alt={editDocData.original_filename}
                                style={{
                                  maxWidth: "100%",
                                  maxHeight: "380px",
                                  objectFit: "contain",
                                  borderRadius: "4px",
                                }}
                              />
                            </div>
                          ) : isPdf && editDocData.existingPreviewUrl ? (
                            <iframe
                              src={`${editDocData.existingPreviewUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                              title={editDocData.original_filename}
                              style={{
                                width: "100%",
                                height: "390px",
                                border: "none",
                                borderRadius: "4px",
                                backgroundColor: "#ffffff",
                              }}
                            />
                          ) : (
                            <div
                              className="text-center p-4 bg-white rounded shadow-sm m-auto"
                              style={{ maxWidth: "320px" }}
                            >
                              <div className="mb-2">{getFileIcon(existingExt)}</div>
                              <h6 className="fw-bold text-dark mb-1">{editDocData.original_filename}</h6>
                              <p className="text-muted small mb-0">
                                Current file attached to this document.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>"""

replacement_block = """                {/* Selected Files / Existing File Item */}
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <Form.Label className="fw-semibold mb-0" style={{ fontSize: "13px" }}>
                      Selected Files ({(isExistingRemoved ? 0 : 1) + editNewFiles.length}):
                    </Form.Label>
                    {(editNewFiles.length > 0 || isExistingRemoved) && (
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-primary p-0 text-decoration-none"
                        style={{ fontSize: "12px" }}
                        onClick={() => {
                          editNewFiles.forEach((f) => {
                            if (f._previewUrl) URL.revokeObjectURL(f._previewUrl);
                          });
                          setEditNewFiles([]);
                          setIsExistingRemoved(false);
                          setEditPreviewSelection({ type: "existing", index: 0 });
                        }}
                      >
                        <i className="fa fa-undo me-1"></i>Reset to Original
                      </button>
                    )}
                  </div>

                  <div
                    className="border rounded p-2"
                    style={{ maxHeight: "200px", overflowY: "auto", backgroundColor: "#f8fafc" }}
                  >
                    <div className="d-flex flex-column gap-2">
                      {/* 1. Existing Document (unless removed) */}
                      {!isExistingRemoved && (
                        <div
                          onClick={() => setEditPreviewSelection({ type: "existing", index: 0 })}
                          className={`d-flex align-items-center justify-content-between p-2 rounded border cursor-pointer ${
                            editPreviewSelection.type === "existing" ? "border-primary bg-white shadow-sm" : "bg-white"
                          }`}
                          style={{
                            cursor: "pointer",
                            borderLeftWidth: editPreviewSelection.type === "existing" ? "4px" : "1px",
                            borderLeftColor: editPreviewSelection.type === "existing" ? "rgb(61, 53, 119)" : undefined,
                          }}
                        >
                          <div className="d-flex align-items-center text-truncate me-2" style={{ minWidth: 0 }}>
                            {["jpg", "jpeg", "png", "gif", "webp"].includes(
                              (editDocData.extension || "").toLowerCase()
                            ) && editDocData.existingPreviewUrl ? (
                              <img
                                src={editDocData.existingPreviewUrl}
                                alt={editDocData.original_filename}
                                style={{
                                  width: "28px",
                                  height: "28px",
                                  objectFit: "cover",
                                  borderRadius: "4px",
                                  flexShrink: 0,
                                }}
                                className="me-2 border"
                              />
                            ) : (
                              <div
                                className="d-flex align-items-center justify-content-center me-2 bg-light rounded"
                                style={{ width: "28px", height: "28px", flexShrink: 0 }}
                              >
                                {getFileIcon(editDocData.extension)}
                              </div>
                            )}
                            <div className="text-truncate">
                              <div
                                className={`text-truncate ${
                                  editPreviewSelection.type === "existing"
                                    ? "fw-bold text-primary"
                                    : "fw-semibold text-dark"
                                }`}
                                style={{ fontSize: "12px" }}
                                title={editDocData.original_filename}
                              >
                                {editDocData.original_filename}
                              </div>
                              <div className="text-muted" style={{ fontSize: "11px" }}>
                                {editDocData.file_size_display || `.${editDocData.extension?.toUpperCase()}`}
                              </div>
                            </div>
                          </div>
                          <div className="d-flex align-items-center gap-1 flex-shrink-0">
                            <span
                              className="badge bg-primary-subtle text-primary border border-primary-subtle"
                              style={{ fontSize: "10px" }}
                            >
                              Current
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger shadow-sm ms-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsExistingRemoved(true);
                                if (editPreviewSelection.type === "existing") {
                                  if (editNewFiles.length > 0) {
                                    setEditPreviewSelection({ type: "new", index: 0 });
                                  } else {
                                    setEditPreviewSelection({ type: "none", index: 0 });
                                  }
                                }
                              }}
                              style={{ width: "22px", height: "22px", padding: 0, borderRadius: "50%" }}
                              title="Remove existing file"
                            >
                              <i className="fa fa-times" style={{ fontSize: "10px" }}></i>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 2. Newly added files */}
                      {editNewFiles.map((f, idx) => {
                        const ext = f.name.split(".").pop().toLowerCase();
                        const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
                        const isSelected = editPreviewSelection.type === "new" && editPreviewSelection.index === idx;
                        return (
                          <div
                            key={idx}
                            onClick={() => setEditPreviewSelection({ type: "new", index: idx })}
                            className={`d-flex align-items-center justify-content-between p-2 rounded border cursor-pointer ${
                              isSelected ? "border-primary bg-white shadow-sm" : "bg-white"
                            }`}
                            style={{
                              cursor: "pointer",
                              borderLeftWidth: isSelected ? "4px" : "1px",
                              borderLeftColor: isSelected ? "rgb(61, 53, 119)" : undefined,
                            }}
                          >
                            <div className="d-flex align-items-center text-truncate me-2" style={{ minWidth: 0 }}>
                              {isImage && f._previewUrl ? (
                                <img
                                  src={f._previewUrl}
                                  alt={f.name}
                                  style={{
                                    width: "28px",
                                    height: "28px",
                                    objectFit: "cover",
                                    borderRadius: "4px",
                                    flexShrink: 0,
                                  }}
                                  className="me-2 border"
                                />
                              ) : (
                                <div
                                  className="d-flex align-items-center justify-content-center me-2 bg-light rounded"
                                  style={{ width: "28px", height: "28px", flexShrink: 0 }}
                                >
                                  {getFileIcon(ext)}
                                </div>
                              )}
                              <div className="text-truncate">
                                <div
                                  className={`text-truncate ${isSelected ? "fw-bold text-primary" : "fw-semibold text-dark"}`}
                                  style={{ fontSize: "12px" }}
                                  title={f.name}
                                >
                                  {f.name}
                                </div>
                                <div className="text-muted" style={{ fontSize: "11px" }}>
                                  {f.size > 1024 * 1024
                                    ? `${(f.size / (1024 * 1024)).toFixed(2)} MB`
                                    : `${(f.size / 1024).toFixed(1)} KB`}
                                </div>
                              </div>
                            </div>
                            <div className="d-flex align-items-center gap-1 flex-shrink-0">
                              <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: "10px" }}>
                                New
                              </span>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger shadow-sm ms-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveEditFile(idx);
                                }}
                                style={{ width: "22px", height: "22px", padding: 0, borderRadius: "50%" }}
                                title="Remove file"
                              >
                                <i className="fa fa-times" style={{ fontSize: "10px" }}></i>
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* 3. Empty state if current file was removed and no new files */}
                      {isExistingRemoved && editNewFiles.length === 0 && (
                        <div className="text-center py-4 px-2 text-muted bg-white rounded border border-dashed">
                          <i className="fa fa-file-text-o fa-2x text-muted mb-2 d-block opacity-50"></i>
                          <div className="small fw-semibold text-danger mb-1">Current file removed</div>
                          <div className="small text-muted" style={{ fontSize: "11px" }}>
                            Click the box above to choose a replacement file or click "Reset to Original".
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: File Preview */}
              <div className="col-12 col-lg-6 d-flex flex-column">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="fw-semibold text-dark" style={{ fontSize: "14px" }}>
                    <i className="fa fa-eye text-primary me-2"></i>File Preview
                  </span>
                  <span className="badge bg-light text-dark border">
                    {(() => {
                      const totalCount = (isExistingRemoved ? 0 : 1) + editNewFiles.length;
                      if (totalCount === 0) return "0 of 0";
                      let currentIndex = 1;
                      if (editPreviewSelection.type === "new") {
                        currentIndex = (isExistingRemoved ? 1 : 2) + editPreviewSelection.index;
                      } else {
                        currentIndex = 1;
                      }
                      return `${Math.min(currentIndex, totalCount)} of ${totalCount}`;
                    })()}
                  </span>
                </div>

                <div
                  className="card border rounded flex-grow-1 d-flex flex-column m-0 p-0 overflow-hidden"
                  style={{
                    backgroundColor: "#f8fafc",
                    minHeight: "380px",
                    maxHeight: "480px",
                  }}
                >
                  {(() => {
                    // Preview active new file
                    if (editPreviewSelection.type === "new") {
                      const activeFile = editNewFiles[editPreviewSelection.index] || editNewFiles[0];
                      if (!activeFile) return null;
                      const activeExt = activeFile.name.split(".").pop().toLowerCase();
                      const isImg = ["jpg", "jpeg", "png", "gif", "webp"].includes(activeExt);
                      const isPdf = activeExt === "pdf";

                      return (
                        <div className="d-flex flex-column h-100">
                          <div className="bg-white border-bottom px-3 py-2 d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center text-truncate me-2">
                              <span className="me-2">{getFileIcon(activeExt)}</span>
                              <div className="text-truncate">
                                <div
                                  className="fw-bold text-dark text-truncate"
                                  style={{ fontSize: "13px" }}
                                  title={activeFile.name}
                                >
                                  {activeFile.name}
                                </div>
                                <div className="text-muted" style={{ fontSize: "11px" }}>
                                  {activeFile.size > 1024 * 1024
                                    ? `${(activeFile.size / (1024 * 1024)).toFixed(2)} MB`
                                    : `${(activeFile.size / 1024).toFixed(1)} KB`}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div
                            className="flex-grow-1 d-flex flex-column justify-content-start overflow-auto p-2"
                            style={{
                              backgroundColor: isImg ? "#1e293b" : "#f1f5f9",
                              minHeight: "330px",
                              maxHeight: "410px",
                            }}
                          >
                            {isImg && activeFile._previewUrl ? (
                              <div className="d-flex align-items-center justify-content-center h-100 m-auto">
                                <img
                                  src={activeFile._previewUrl}
                                  alt={activeFile.name}
                                  style={{
                                    maxWidth: "100%",
                                    maxHeight: "380px",
                                    objectFit: "contain",
                                    borderRadius: "4px",
                                  }}
                                />
                              </div>
                            ) : isPdf && activeFile._previewUrl ? (
                              <iframe
                                src={`${activeFile._previewUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                                title={activeFile.name}
                                style={{
                                  width: "100%",
                                  height: "390px",
                                  border: "none",
                                  borderRadius: "4px",
                                  backgroundColor: "#ffffff",
                                }}
                              />
                            ) : (
                              <div
                                className="text-center p-4 bg-white rounded shadow-sm m-auto"
                                style={{ maxWidth: "320px" }}
                              >
                                <div className="mb-2">{getFileIcon(activeExt)}</div>
                                <h6 className="fw-bold text-dark mb-1">{activeFile.name}</h6>
                                <p className="text-muted small mb-0">
                                  File ready to upload (.{activeExt.toUpperCase()}).
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // If existing document is previewed and not removed
                    if (editPreviewSelection.type === "existing" && !isExistingRemoved) {
                      const existingExt = (editDocData.extension || "").toLowerCase();
                      const isImg = ["jpg", "jpeg", "png", "gif", "webp"].includes(existingExt);
                      const isPdf = existingExt === "pdf";

                      return (
                        <div className="d-flex flex-column h-100">
                          <div className="bg-white border-bottom px-3 py-2 d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center text-truncate me-2">
                              <span className="me-2">{getFileIcon(existingExt)}</span>
                              <div className="text-truncate">
                                <div
                                  className="fw-bold text-dark text-truncate"
                                  style={{ fontSize: "13px" }}
                                  title={editDocData.original_filename}
                                >
                                  {editDocData.original_filename}
                                </div>
                                <div className="text-muted" style={{ fontSize: "11px" }}>
                                  {editDocData.file_size_display || `.${existingExt.toUpperCase()}`}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div
                            className="flex-grow-1 d-flex flex-column justify-content-start overflow-auto p-2"
                            style={{
                              backgroundColor: isImg ? "#1e293b" : "#f1f5f9",
                              minHeight: "330px",
                              maxHeight: "410px",
                            }}
                          >
                            {isImg && editDocData.existingPreviewUrl ? (
                              <div className="d-flex align-items-center justify-content-center h-100 m-auto">
                                <img
                                  src={editDocData.existingPreviewUrl}
                                  alt={editDocData.original_filename}
                                  style={{
                                    maxWidth: "100%",
                                    maxHeight: "380px",
                                    objectFit: "contain",
                                    borderRadius: "4px",
                                  }}
                                />
                              </div>
                            ) : isPdf && editDocData.existingPreviewUrl ? (
                              <iframe
                                src={`${editDocData.existingPreviewUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                                title={editDocData.original_filename}
                                style={{
                                  width: "100%",
                                  height: "390px",
                                  border: "none",
                                  borderRadius: "4px",
                                  backgroundColor: "#ffffff",
                                }}
                              />
                            ) : (
                              <div
                                className="text-center p-4 bg-white rounded shadow-sm m-auto"
                                style={{ maxWidth: "320px" }}
                              >
                                <div className="mb-2">{getFileIcon(existingExt)}</div>
                                <h6 className="fw-bold text-dark mb-1">{editDocData.original_filename}</h6>
                                <p className="text-muted small mb-0">
                                  Current file attached to this document.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // Otherwise empty / removed preview
                    return (
                      <div className="h-100 d-flex flex-column align-items-center justify-content-center p-4 text-center m-auto">
                        <div
                          className="rounded-circle bg-white d-flex align-items-center justify-content-center shadow-sm mb-3"
                          style={{ width: "64px", height: "64px" }}
                        >
                          <i className="fa fa-file-text-o fa-2x text-muted"></i>
                        </div>
                        <h6 className="fw-bold text-dark mb-1">No File Selected</h6>
                        <p className="text-muted small mb-0" style={{ maxWidth: "260px" }}>
                          Select a file from the list on the left to preview it here before saving.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>"""

# Normalize newlines
target_block_norm = target_block.replace("\r\n", "\n")
replacement_block_norm = replacement_block.replace("\r\n", "\n")
code_norm = code.replace("\r\n", "\n")

assert target_block_norm in code_norm, "target_block_norm not found!"
code_norm = code_norm.replace(target_block_norm, replacement_block_norm, 1)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(code_norm)

print("Part 2 updated successfully.")

