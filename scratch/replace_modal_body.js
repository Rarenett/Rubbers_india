const fs = require('fs');

let s = fs.readFileSync('frontend/src/jsx/components/DigiLocker/FileApproval.jsx', 'utf8');

const startMarker = '<Modal.Body className="p-0 text-center" style={{ minHeight: \'500px\', backgroundColor: \'#1e293b\' }}>';
const endMarker = '</Modal.Body>';

const startIdx = s.indexOf(startMarker);
if (startIdx === -1) {
  console.error('startMarker not found');
  process.exit(1);
}

const endIdx = s.indexOf(endMarker, startIdx) + endMarker.length;
const oldModalBody = s.substring(startIdx, endIdx);

const newModalBody = `<Modal.Body className="p-0 text-center" style={{ minHeight: '550px', backgroundColor: '#0f172a' }}>
          {previewLoading ? (
            <div className="d-flex align-items-center justify-content-center" style={{ height: '550px' }}>
              <div className="text-white">
                <i className="fa fa-spinner fa-spin fa-2x mb-2 d-block text-primary"></i>
                <span className="fw-semibold">Loading document preview...</span>
              </div>
            </div>
          ) : previewUrl ? (
            ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes((previewDoc?.extension || '').toLowerCase()) ? (
              <div className="p-3 d-flex align-items-center justify-content-center" style={{ minHeight: '550px' }}>
                <img
                  src={previewUrl}
                  alt={previewDoc?.name}
                  style={{ maxWidth: '100%', maxHeight: '700px', objectFit: 'contain', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
                />
              </div>
            ) : (previewDoc?.extension || '').toLowerCase() === 'pdf' ? (
              <iframe
                src={\`\${previewUrl}#toolbar=0\`}
                title={previewDoc?.name}
                style={{ width: '100%', height: '700px', border: 'none' }}
              />
            ) : parsedPreviewContent?.type === 'docx' ? (
              <div className="p-4 text-start bg-light overflow-auto" style={{ minHeight: '550px', maxHeight: '720px' }}>
                <div
                  className="bg-white rounded p-4 shadow-sm mx-auto"
                  style={{
                    maxWidth: '850px',
                    color: '#1e293b',
                    fontSize: '14px',
                    lineHeight: '1.7',
                    minHeight: '500px'
                  }}
                  dangerouslySetInnerHTML={{ __html: parsedPreviewContent.html }}
                />
              </div>
            ) : parsedPreviewContent?.type === 'xlsx' ? (
              <div className="p-3 text-start bg-light overflow-auto" style={{ minHeight: '550px', maxHeight: '720px' }}>
                <div className="bg-white rounded p-3 shadow-sm mx-auto" style={{ maxWidth: '1050px' }}>
                  <div className="mb-3 pb-2 border-bottom d-flex align-items-center justify-content-between">
                    <div>
                      <span className="badge bg-success-subtle text-success border border-success-subtle me-2">
                        <i className="fa fa-table me-1"></i> {parsedPreviewContent.sheetName}
                      </span>
                      {parsedPreviewContent.sheetNames?.length > 1 && (
                        <span className="text-muted small">
                          ({parsedPreviewContent.sheetNames.length} sheets total)
                        </span>
                      )}
                    </div>
                    <span className="text-muted small">
                      Showing first {parsedPreviewContent.rows?.length || 0} of {parsedPreviewContent.totalRows || 0} rows
                    </span>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered table-striped mb-0" style={{ fontSize: '12px' }}>
                      <tbody>
                        {parsedPreviewContent.rows && parsedPreviewContent.rows.length > 0 ? (
                          parsedPreviewContent.rows.map((row, rIdx) => (
                            <tr key={rIdx} className={rIdx === 0 ? "table-light fw-bold" : ""}>
                              <td className="text-muted text-center" style={{ width: '40px' }}>{rIdx + 1}</td>
                              {Array.isArray(row) && row.length > 0 ? (
                                row.map((cell, cIdx) => (
                                  <td key={cIdx} className="text-nowrap">{cell !== undefined && cell !== null ? String(cell) : ""}</td>
                                ))
                              ) : (
                                <td className="text-muted fst-italic">Empty row</td>
                              )}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="text-center text-muted p-4">Empty spreadsheet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : parsedPreviewContent?.type === 'txt' ? (
              <div className="p-4 text-start bg-light overflow-auto" style={{ minHeight: '550px', maxHeight: '720px' }}>
                <pre
                  className="bg-white rounded p-4 shadow-sm mx-auto font-monospace"
                  style={{
                    maxWidth: '850px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    color: '#334155',
                    minHeight: '500px'
                  }}
                >
                  {parsedPreviewContent.text || 'Empty text document.'}
                </pre>
              </div>
            ) : parsedPreviewContent?.type === 'zip' ? (
              <div className="p-4 text-start bg-light overflow-auto" style={{ minHeight: '550px', maxHeight: '720px' }}>
                <div className="bg-white rounded p-4 shadow-sm mx-auto" style={{ maxWidth: '850px' }}>
                  <div className="mb-3 pb-2 border-bottom d-flex align-items-center justify-content-between">
                    <h6 className="fw-bold mb-0 text-dark">
                      <i className="fa fa-file-archive-o text-warning me-2"></i> Archive Contents ({parsedPreviewContent.entries?.length || 0} items)
                    </h6>
                  </div>
                  <div className="list-group list-group-flush" style={{ fontSize: '13px' }}>
                    {parsedPreviewContent.entries?.map((entry, eIdx) => (
                      <div key={eIdx} className="list-group-item d-flex align-items-center justify-content-between px-2 py-2">
                        <div className="text-truncate">
                          <i className={\`fa \${entry.dir ? 'fa-folder text-warning' : 'fa-file-text-o text-secondary'} me-2\`}></i>
                          <span className="fw-semibold">{entry.name}</span>
                        </div>
                        {entry.date && (
                          <span className="text-muted small">
                            {new Date(entry.date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 text-white">
                <i className="fa fa-file-text-o fa-3x mb-3 text-warning"></i>
                <h5>.{previewDoc?.extension?.toUpperCase()} Document File</h5>
                <p className="text-muted small mb-3">
                  Direct inline preview is not supported for this file format. You can download the file directly to view it.
                </p>
                {previewUrl && (
                  <a
                    href={previewUrl}
                    download={previewDoc?.name}
                    className="btn btn-primary btn-sm px-3"
                  >
                    <i className="fa fa-download me-1"></i> Download File to View
                  </a>
                )}
              </div>
            )
          ) : (
            <div className="p-5 text-muted">No preview available.</div>
          )}
        </Modal.Body>`;

s = s.substring(0, startIdx) + newModalBody + s.substring(endIdx);
fs.writeFileSync('frontend/src/jsx/components/DigiLocker/FileApproval.jsx', s, 'utf8');
console.log('Successfully replaced Modal.Body with universal preview renderer!');

