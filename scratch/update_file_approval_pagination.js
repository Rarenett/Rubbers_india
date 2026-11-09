const fs = require('fs');

let s = fs.readFileSync('frontend/src/jsx/components/DigiLocker/FileApproval.jsx', 'utf8');

// 1. Change docRowsPerPage to 25 and state setter
s = s.replace('const [docRowsPerPage] = useState(10);', 'const [docRowsPerPage, setDocRowsPerPage] = useState(25);');

// 2. Adjust columns in the filter Row from Col md={4}, md={3}, md={3}, md={2} to md={3}, md={3}, md={3}, md={3}
const oldRowStart = `<Row className="g-2 mb-3">
                  <Col md={4} sm={12}>`;

const newRowStart = `<Row className="g-2 mb-3 align-items-center">
                  <Col md={3} sm={12}>`;

s = s.replace(oldRowStart, newRowStart);

const oldTotalCol = `                  <Col md={2} sm={12} className="text-end">
                    <span className="text-muted small">
                      Total: <strong>{filteredDocs.length}</strong>
                    </span>
                  </Col>`;

const newTotalCol = `                  <Col md={3} sm={12} className="d-flex justify-content-end align-items-center gap-2">
                    <Form.Select
                      size="sm"
                      style={{ width: '130px' }}
                      value={docRowsPerPage}
                      onChange={(e) => {
                        setDocRowsPerPage(Number(e.target.value));
                        setDocCurrentPage(1);
                      }}
                    >
                      <option value={10}>10 per page</option>
                      <option value={25}>25 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                      <option value={999999}>View All Files</option>
                    </Form.Select>
                    <span className="text-muted small text-nowrap">
                      Total: <strong>{filteredDocs.length}</strong>
                    </span>
                  </Col>`;

s = s.replace(oldTotalCol, newTotalCol);

fs.writeFileSync('frontend/src/jsx/components/DigiLocker/FileApproval.jsx', s, 'utf8');
console.log('Successfully updated FileApproval.jsx with page size control and View All option!');

