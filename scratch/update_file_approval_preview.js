const fs = require('fs');

let s = fs.readFileSync('frontend/src/jsx/components/DigiLocker/FileApproval.jsx', 'utf8');

// 1. Add mammoth, XLSX, and JSZip imports
const oldImport = "import Swal from 'sweetalert2';";
const newImports = `import Swal from 'sweetalert2';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';`;

s = s.replace(oldImport, newImports);

// 2. Add parsedPreviewContent state
const oldState = "  const [previewUrl, setPreviewUrl] = useState('');";
const newState = `  const [previewUrl, setPreviewUrl] = useState('');
  const [parsedPreviewContent, setParsedPreviewContent] = useState(null);`;

s = s.replace(oldState, newState);

// 3. Update handlePreviewDocument and handleClosePreviewModal
const oldHandlePreview = `  // Preview Document
  const handlePreviewDocument = async (docId, fileName, ext) => {
    setPreviewLoading(true);
    setShowPreviewModal(true);
    setPreviewDoc({ id: docId, name: fileName, extension: ext });
    setPreviewUrl('');

    try {
      const endpoint = \`/api/digilocker/access/documents/\${docId}/preview/\`;
      const res = await DigiLockerService.previewDocumentBlob(endpoint);
      const contentType = res.headers['content-type'] || 'application/pdf';
      const blob = new Blob([res.data], { type: contentType });
      const objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
    } catch (err) {
      console.error('Error previewing document:', err);
      Swal.fire('Preview Error', 'Failed to load document preview. Ensure you have administrator access.', 'error');
      setShowPreviewModal(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreviewModal = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setShowPreviewModal(false);
    setPreviewDoc(null);
    setPreviewUrl('');
  };`;

const newHandlePreview = `  // Preview Document
  const handlePreviewDocument = async (docId, fileName, ext) => {
    setPreviewLoading(true);
    setShowPreviewModal(true);
    setPreviewDoc({ id: docId, name: fileName, extension: ext });
    setPreviewUrl('');
    setParsedPreviewContent(null);

    const safeExt = (ext || (fileName ? fileName.split('.').pop() : '') || '').toLowerCase();

    try {
      const endpoint = \`/api/digilocker/access/documents/\${docId}/preview/\`;
      const res = await DigiLockerService.previewDocumentBlob(endpoint);
      const contentType = res.headers['content-type'] || 'application/octet-stream';
      const blob = new Blob([res.data], { type: contentType });

      // Standard object URL for iframe (PDF) and img (images)
      const objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);

      // Parse rich content for Word (.docx, .doc), Excel (.xlsx, .xls), CSV, Text (.txt), and ZIP (.zip)
      if (['docx', 'doc'].includes(safeExt)) {
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          setParsedPreviewContent({
            type: 'docx',
            html: result.value || '<p class=\"text-muted\">Document contains no readable text.</p>'
          });
        } catch (docxErr) {
          console.error('Error parsing docx:', docxErr);
          setParsedPreviewContent({
            type: 'fallback',
            message: 'Unable to render Word document inline.'
          });
        }
      } else if (['xlsx', 'xls', 'csv'].includes(safeExt)) {
        try {
          let workbook;
          if (safeExt === 'csv') {
            const text = await blob.text();
            workbook = XLSX.read(text, { type: 'string' });
          } else {
            const arrayBuffer = await blob.arrayBuffer();
            workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
          }
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          setParsedPreviewContent({
            type: 'xlsx',
            sheetName: sheetName || 'Sheet1',
            sheetNames: workbook.SheetNames || [],
            rows: jsonData.slice(0, 100),
            totalRows: jsonData.length
          });
        } catch (xlsxErr) {
          console.error('Error parsing spreadsheet:', xlsxErr);
          setParsedPreviewContent({
            type: 'fallback',
            message: 'Unable to render spreadsheet inline.'
          });
        }
      } else if (['txt', 'log', 'json', 'xml'].includes(safeExt)) {
        try {
          const text = await blob.text();
          setParsedPreviewContent({
            type: 'txt',
            text: text
          });
        } catch (txtErr) {
          console.error('Error reading text file:', txtErr);
        }
      } else if (['zip'].includes(safeExt)) {
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const zip = await JSZip.loadAsync(arrayBuffer);
          const fileList = [];
          zip.forEach((relativePath, zipEntry) => {
            fileList.push({
              name: relativePath,
              dir: zipEntry.dir,
              date: zipEntry.date
            });
          });
          setParsedPreviewContent({
            type: 'zip',
            entries: fileList
          });
        } catch (zipErr) {
          console.error('Error reading zip file:', zipErr);
          setParsedPreviewContent({
            type: 'fallback',
            message: 'Unable to inspect zip archive entries.'
          });
        }
      }
    } catch (err) {
      console.error('Error previewing document:', err);
      Swal.fire('Preview Error', 'Failed to load document preview. Ensure you have administrator access.', 'error');
      setShowPreviewModal(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreviewModal = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setShowPreviewModal(false);
    setPreviewDoc(null);
    setPreviewUrl('');
    setParsedPreviewContent(null);
  };`;

s = s.replace(oldHandlePreview, newHandlePreview);

// 4. Update the Modal.Body of the Preview Modal to render docx, xlsx, txt, zip, pdf, and images cleanly
const oldModalBody = `        <Modal.Body className="p-0 text-center" style={{ minHeight: '500px', backgroundColor: '#1e293b' }}>
          {previewLoading ? (
            <div className="d-flex align-items-center justify-content-center" style={{ height: '500px' }}>
              <div className="text-white">
                <i className="fa fa-spinner fa-spin fa-2x mb-2 d-block"></i>
                <span>Loading secure document preview...</span>
              </div>
            </div>
          ) : previewUrl ? (
            ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes((previewDoc?.extension || '').toLowerCase()) ? (
              <div className="p-3 d-flex align-items-center justify-content-center" style={{ minHeight: '500px' }}>
                <img
                  src={previewUrl}
                  alt={previewDoc?.name}
                  style={{ maxWidth: '100%', maxHeight: '650px', objectFit: 'contain', borderRadius: '4px' }}
                />
              </div>
            ) : (previewDoc?.extension || '').toLowerCase() === 'pdf' ? (
              <iframe
                src={\`\${previewUrl}#toolbar=0\`}
                title={previewDoc?.name}
                style={{ width: '100%', height: '650px', border: 'none' }}
              />
            ) : (
              <div className="p-5 text-white">
                <i className="fa fa-file-text-o fa-3x mb-3 text-warning"></i>
                <h5>Preview for .\${previewDoc?.extension?.toUpperCase()} format</h5>
                <p className="text-muted small">
                  Direct inline preview is optimized for PDF and image formats. Document integrity is preserved.
                </p>
              </div>
            )
          ) : (
            <div className="p-5 text-muted">No preview available.</div>
          )}
        </Modal.Body>`;

const newModalBody = `        <Modal.Body className="p-0 text-center" style={{ minHeight: '550px', backgroundColor: '#0f172a' }}>
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
                      {parsedPreviewContent.sheetNames.length > 1 && (
                        <span className="text-muted small">
                          ({parsedPreviewContent.sheetNames.length} sheets total)
                        </span>
                      )}
                    </div>
                    <span className="text-muted small">
                      Showing first {parsedPreviewContent.rows.length} of {parsedPreviewContent.totalRows} rows
                    </span>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered table-striped mb-0" style={{ fontSize: '12px' }}>
                      <tbody>
                        {parsedPreviewContent.rows.length > 0 ? (
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
                      <i className="fa fa-file-archive-o text-warning me-2"></i> Archive Contents ({parsedPreviewContent.entries.length} items)
                    </h6>
                  </div>
                  <div className="list-group list-group-flush" style={{ fontSize: '13px' }}>
                    {parsedPreviewContent.entries.map((entry, eIdx) => (
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
                  Document content was securely loaded from the server.
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

s = s.replace(oldModalBody, newModalBody);

fs.writeFileSync('frontend/src/jsx/components/DigiLocker/FileApproval.jsx', s, 'utf8');
console.log('Successfully updated FileApproval.jsx with universal file preview support!');

