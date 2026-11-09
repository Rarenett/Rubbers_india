import React, { useState, useEffect } from 'react';
import { Card, Button, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';
import { getCustomerTypes, createHrCustomer } from '../../../../services/HRManagementService';

const CustomerForm = () => {
    const [customerTypes, setCustomerTypes] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    const initialFormState = {
        name: '',
        address: '',
        pincode: '',
        city: '',
        district: '',
        state: '',
        country: 'India',
        contact_person: '',
        contact_number: '',
        email: '',
        customer_type: null,
        remarks: ''
    };

    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        const fetchTypes = async () => {
            try {
                const data = await getCustomerTypes();
                const typesArray = Array.isArray(data) ? data : (data.results || []);
                const options = typesArray.map(type => ({
                    value: type.id,
                    label: type.name,
                    details_needed: type.details_needed,
                    name: type.name
                }));
                setCustomerTypes(options);
            } catch (error) {
                console.error("Failed to load associate types", error);
            }
        };
        fetchTypes();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (selectedOption) => {
        setFormData(prev => ({ ...prev, customer_type: selectedOption }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.customer_type) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please select a Associate Type' });
            return;
        }

        setSubmitting(true);
        try {
            const typeName = formData.customer_type.name.toLowerCase();
            let endpoint = 'hr-other-customers';
            
            if (typeName === 'distributor') {
                endpoint = 'hr-distributors';
            } else if (typeName === 'vendor') {
                endpoint = 'hr-vendors';
            }

            const payload = {
                ...formData,
                customer_type: formData.customer_type.value
            };

            await createHrCustomer(endpoint, payload);
            
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'Associate successfully created!',
                confirmButtonColor: 'var(--primary)'
            });
            
            setFormData(initialFormState);
        } catch (error) {
            console.error("Error creating associate", error);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to create associate' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="container-fluid">
            <div className="page-titles">
                <button
                    onClick={() => window.history.back()}
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>

            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Header>
                            <Card.Title className="mb-0">Associate Creation</Card.Title>
                        </Card.Header>
                        <Card.Body>
                            <Form onSubmit={handleSubmit}>
                                <div className="row">
                                    <div className="col-md-6 mb-3">
                                        <Form.Label>Associate Name <span className="text-danger">*</span></Form.Label>
                                        <Form.Control type="text" name="name" value={formData.name} onChange={handleChange} required />
                                    </div>
                                    <div className="col-md-6 mb-3">
                                        <Form.Label>Associate Type <span className="text-danger">*</span></Form.Label>
                                        <Select 
                                            options={customerTypes}
                                            value={formData.customer_type}
                                            onChange={handleSelectChange}
                                            placeholder="Select Type..."
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="row">
                                    <div className="col-md-4 mb-3">
                                        <Form.Label>Contact Person</Form.Label>
                                        <Form.Control type="text" name="contact_person" value={formData.contact_person} onChange={handleChange} />
                                    </div>
                                    <div className="col-md-4 mb-3">
                                        <Form.Label>Contact Number</Form.Label>
                                        <Form.Control type="text" name="contact_number" value={formData.contact_number} onChange={handleChange} />
                                    </div>
                                    <div className="col-md-4 mb-3">
                                        <Form.Label>Email</Form.Label>
                                        <Form.Control type="email" name="email" value={formData.email} onChange={handleChange} />
                                    </div>
                                </div>

                                <div className="row">
                                    <div className="col-md-12 mb-3">
                                        <Form.Label>Address</Form.Label>
                                        <Form.Control as="textarea" rows={2} name="address" value={formData.address} onChange={handleChange} />
                                    </div>
                                </div>

                                <div className="row">
                                    <div className="col-md-3 mb-3">
                                        <Form.Label>Pin Code</Form.Label>
                                        <Form.Control type="text" name="pincode" value={formData.pincode} onChange={handleChange} />
                                    </div>
                                    <div className="col-md-3 mb-3">
                                        <Form.Label>City</Form.Label>
                                        <Form.Control type="text" name="city" value={formData.city} onChange={handleChange} />
                                    </div>
                                    <div className="col-md-3 mb-3">
                                        <Form.Label>District</Form.Label>
                                        <Form.Control type="text" name="district" value={formData.district} onChange={handleChange} />
                                    </div>
                                    <div className="col-md-3 mb-3">
                                        <Form.Label>State</Form.Label>
                                        <Form.Control type="text" name="state" value={formData.state} onChange={handleChange} />
                                    </div>
                                </div>

                                <div className="row">
                                    <div className="col-md-6 mb-3">
                                        <Form.Label>Country</Form.Label>
                                        <Form.Control type="text" name="country" value={formData.country} onChange={handleChange} />
                                    </div>
                                    <div className="col-md-6 mb-3">
                                        <Form.Label>Remarks</Form.Label>
                                        <Form.Control type="text" name="remarks" value={formData.remarks} onChange={handleChange} />
                                    </div>
                                </div>

                                <div className="text-end mt-4 pt-3 border-top">
                                    <Button type="button" variant="danger light" className="me-2" onClick={() => window.history.back()}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" variant="primary" disabled={submitting}>
                                        {submitting ? 'Submitting...' : 'Submit'}
                                    </Button>
                                </div>
                            </Form>
                        </Card.Body>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default CustomerForm;
