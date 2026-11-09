import React, { useState, useEffect } from 'react';
import { Card, Table, Form, InputGroup } from 'react-bootstrap';
import { getUsers } from '../../../../services/HRManagementService';

const StaffList = () => {
 const [staff, setStaff] = useState([]);
 const [filteredStaff, setFilteredStaff] = useState([]);
 const [searchTerm, setSearchTerm] = useState('');
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 fetchStaff();
 }, []);

 const fetchStaff = async () => {
 try {
 setLoading(true);
 const data = await getUsers();
 setStaff(data || []);
 setFilteredStaff(data || []);
 } catch (error) {
 console.error('Error fetching staff:', error);
 } finally {
 setLoading(false);
 }
 };

 const handleSearch = (e) => {
 const value = e.target.value.toLowerCase();
 setSearchTerm(value);

 const filtered = staff.filter(
 (employee) =>
 employee.first_name?.toLowerCase().includes(value) ||
 employee.last_name?.toLowerCase().includes(value) ||
 employee.email?.toLowerCase().includes(value) ||
 employee.phone?.includes(value) ||
 employee.department?.name?.toLowerCase().includes(value) ||
 employee.designation?.title?.toLowerCase().includes(value)
 );
 setFilteredStaff(filtered);
 };

 if (loading) {
 return (
 <div className="text-center py-5">
 <div className="spinner-border text-primary" role="status">
 <span className="visually-hidden">Loading...</span>
 </div>
 </div>
 );
 }

 return (
 <div>
 <div className="page-titles">
                <button 
                    onClick={() => window.history.back()} 
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>

 <Card>
 <Card.Header>
 <Card.Title>Staff List</Card.Title>
 </Card.Header>
 <Card.Body>
 {/* Search Bar */}
 <div className="mb-4">
 <InputGroup style={{ maxWidth: '300px' }}>
 <Form.Control
 type="text"
 placeholder="Search Staff..."
 value={searchTerm}
 onChange={handleSearch}
 />
 <InputGroup.Text>
 <i className="fa fa-search"></i>
 </InputGroup.Text>
 </InputGroup>
 </div>

 {/* Staff Table */}
 <div className="table-responsive">
 <Table bordered hover>
 <thead className="table-light">
 <tr>
 <th>SL No</th>
 <th>Name</th>
 <th>Email</th>
 <th>Phone</th>
 <th>Department</th>
 <th>Designation</th>
 <th>Profile Picture</th>
 </tr>
 </thead>
 <tbody>
 {filteredStaff.length > 0 ? (
 filteredStaff.map((employee, index) => (
 <tr key={employee.id}>
 <td>{index + 1}</td>
 <td>{employee.first_name} {employee.last_name}</td>
 <td>{employee.email}</td>
 <td>{employee.phone || '-'}</td>
 <td>{employee.department?.name || '-'}</td>
 <td>{employee.designation?.title || '-'}</td>
 <td className="text-center">
 {employee.profile_picture ? (
 <img
 src={`${import.meta.env.VITE_BACKEND_URL}${employee.profile_picture}`}
 alt={`${employee.first_name} ${employee.last_name}`}
 style={{
 width: '40px',
 height: '40px',
 borderRadius: '50%',
 objectFit: 'cover'
 }}
 />
 ) : (
 <div
 style={{
 width: '40px',
 height: '40px',
 borderRadius: '50%',
 backgroundColor: '#6c757d',
 display: 'inline-flex',
 alignItems: 'center',
 justifyContent: 'center',
 color: 'white',
 fontWeight: 'bold'
 }}
 >
 {employee.first_name?.charAt(0)}{employee.last_name?.charAt(0)}
 </div>
 )}
 </td>
 </tr>
 ))
 ) : (
 <tr>
 <td colSpan="7" className="text-center">
 No staff members found
 </td>
 </tr>
 )}
 </tbody>
 </Table>
 </div>

 {/* Staff Count */}
 <div className="mt-3">
 <p className="text-muted">
 Showing {filteredStaff.length} of {staff.length} staff members
 </p>
 </div>
 </Card.Body>
 </Card>
 </div>
 );
};

export default StaffList;
