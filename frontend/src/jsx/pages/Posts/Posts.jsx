import React, { useState} from 'react';
import { Link} from 'react-router-dom';
import { Modal} from 'react-bootstrap';
//import swal from "sweetalert";
import {nanoid} from 'nanoid';
import data from './tabledata.json';

const Posts = () => {	
	//Modal box
    const [addItem, setAddItem] = useState(false);
    // Add function default data loop
    const [contacts, setContacts] = useState(data);
    
    //Add data 
    const [addFormData, setAddFormData ] = useState({
        Cust_Id:'',
        Date_Join:'',
        Cust_Name:'',
        TickOrd:'',
        Location:'',
        Price:'',
    }); 
    
    // Add contact function
    const handleAddFormChange = (event) => {
        event.preventDefault();    
        
        const fieldName = event.target.getAttribute('name');
        const fieldValue = event.target.value;
        const newFormData = {...addFormData};
        newFormData[fieldName] = fieldValue;
        setAddFormData(newFormData);
    };
    
     //Add Submit data
    const handleAddFormSubmit = (event)=> {
        event.preventDefault(); 
        
        const newContact = {
            id: nanoid(),
            Cust_Id: addFormData.Cust_Id,
            Date_Join:  addFormData.Date_Join,
            Cust_Name:  addFormData.Cust_Name ,
            TickOrd: addFormData.TickOrd,
            Location:  addFormData.Location,
            Price:  addFormData.Price,
        };
        const newContacts = [...contacts, newContact];
        setContacts(newContacts);
        setAddItem(false);
    }; 
    
     // delet function to delete data
    const handleDeleteClick = (contactId) => {
        const newContacts = [...contacts];    
        const index = contacts.findIndex((contact)=> contact.id === contactId);
        newContacts.splice(index, 1);
        setContacts(newContacts);
    }
    
	 const [editModal, setEditModal] = useState(false);
    // edit form data submit
    const handleEditFormSubmit = (event) => {
        event.preventDefault();
        const editedContact = {
            id: editContactId,
            Cust_Id: editFormData.Cust_Id,
            Date_Join: editFormData.Date_Join,
            Cust_Name: editFormData.Cust_Name,
            TickOrd: editFormData.TickOrd,
            Location: editFormData.Location,
            Price: editFormData.Price,
        }
        const newContacts = [...contacts];
        const index = contacts.findIndex((contact)=> contact.id === editContactId);
        newContacts[index] = editedContact;
        setContacts(newContacts);
        setEditContactId(null);
        setEditModal(false);
    }
    
    
    // Edit function editable page loop
    const [editContactId, setEditContactId] = useState(null);
   
    // Edit function button click to edit
    const handleEditClick = ( event, contact) => {
        event.preventDefault();
        setEditContactId(contact.id);
        const formValues = {
            Cust_Id: contact.Cust_Id,
            Date_Join: contact.Date_Join,
            Cust_Name: contact.Cust_Name,
            TickOrd: contact.TickOrd,
            Location: contact.Location,
            Price: contact.Price,
        }
        setEditFormData(formValues);
        setEditModal(true);
    };
    
    // edit  data  
    const [editFormData, setEditFormData] = useState({
        Cust_Id:'',
        Date_Join:'',
        Cust_Name:'',
        TickOrd:'',
        Location:'',
        Price:'',   
    })
    
    //update data function
    const handleEditFormChange = (event) => {
        event.preventDefault();   
        const fieldName = event.target.getAttribute('name');
        const fieldValue = event.target.value;
        const newFormData = {...editFormData};
        newFormData[fieldName] = fieldValue;
        setEditFormData(newFormData);
       
    };
  
	return (
		<>
			<div className="project-nav align-items-end">
				<div className="me-auto  mb-lg-0 mb-3">
					<div className="mb-4">
						<h2 className="title-num text-black font-w700">Project Fasto </h2>
						<span className="fs-14">Created by on July 20, 2023</span>
					</div>
					<div className="d-sm-flex d-block align-items-center">
						<Link to={"#"} className="btn btn-light rounded mb-sm-0 mb-2 me-3"><i className="fa fa-lock me-3 scale5" aria-hidden="true"></i>Private</Link>
						<Link to={"#"} className="btn btn-secondary rounded  mb-sm-0 mb-2"><i className="fa fa-pencil-square me-3 scale5" aria-hidden="true"></i>Edit</Link>
					</div>
				</div>
				<div className="mt-3">
					<Link to={"#"} onClick={()=> setAddItem(true)} className="btn btn-primary  rounded me-3 mb-sm-0 mb-2 text-white">
						<i className="fa fa-user me-3 scale5" ></i>New Contact
					</Link>
					{/* <!-- Add Order --> */}
					<Modal className="modal fade" id="addContactModal" show={addItem} onHide={setAddItem}>
                        <div className="" role="document">
                            <div className="">
                                <form >
                                    <div className="modal-header">
                                        <h4 className="modal-title fs-20">Add Contact</h4>
                                        <button type="button" className="close" data-dismiss="modal" onClick={()=> setAddItem(false)}><span>&times;</span></button>
                                    </div>
                                    <div className="modal-body">
                                        <i className="flaticon-cancel-12 close" data-dismiss="modal"></i>
                                        <div className="add-contact-box">
                                            <div className="add-contact-content">
                                                <div className="form-group">
                                                    <label className="text-black font-w500">Cust_Id</label>
                                                    <div className="contact-name">
                                                        <input type="text" className="form-control" name="Cust_Id" required="required" placeholder="Enter a id" 
                                                            onChange={handleAddFormChange}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label className="text-black font-w500">Ticket Date</label>
                                                    <div className="contact-name">
                                                        <input type="text" className="form-control" name="Date_Join" required="required" placeholder="Enter a date" 
                                                            onChange={handleAddFormChange}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label className="text-black font-w500">Customer Name</label>
                                                    <div className="contact-name">
                                                        <input type="text" className="form-control" name="Cust_Name" required="required" placeholder="Enter a name" 
                                                            onChange={handleAddFormChange}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label className="text-black font-w500">Ticket Summary</label>
                                                    <div className="contact-name">
                                                        <input type="text" className="form-control" name="TickOrd" required="required" placeholder="Enter a Summary" 
                                                            onChange={handleAddFormChange}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label className="text-black font-w500">Location</label>
                                                    <div className="contact-name">
                                                        <input type="text" className="form-control" name="Location" required="required" placeholder="Enter a location" 
                                                            onChange={handleAddFormChange}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label className="text-black font-w500">Price</label>
                                                    <div className="contact-name">
                                                        <input type="text" className="form-control" name="Price" required="required" placeholder="Enter a price" 
                                                            onChange={handleAddFormChange}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="modal-footer">
                                        <button type="submit" onClick={handleAddFormSubmit} className="btn btn-primary">Add</button> 
                                        <button type="button"  className="btn btn-danger" onClick={()=> setAddItem(false)}> <i className="flaticon-delete-1"></i>Close</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </Modal>	
					<Modal className="modal fade"  show={editModal} onHide={setEditModal} >
						<div className="" role="document">
							<div className="">
								<form >
									<div className="modal-header">
										<h4 className="modal-title fs-20">Add Contact</h4>
										<button type="button" className="close" onClick={()=> setEditModal(false)} data-dismiss="modal"><span>&times;</span></button>
									</div>
									<div className="modal-body">
										<i className="flaticon-cancel-12 close" data-dismiss="modal"></i>
										<div className="add-contact-box">
											<div className="add-contact-content">
												<div className="form-group">
													<label className="text-black font-w500">Cust_Id</label>
													<div className="contact-name">
														<input type="text" className="form-control" name="Cust_Id" required="required" placeholder="Enter a id" 
															value={editFormData.Cust_Id}
															onChange={handleEditFormChange}
														/>
													</div>
												</div>
												<div className="form-group">
                                                    <label className="text-black font-w500">Ticket Date</label>
                                                    <div className="contact-name">
                                                        <input type="text" className="form-control" name="Date_Join" required="required" placeholder="Enter a date"
															value={editFormData.Date_Join}														
                                                            onChange={handleAddFormChange}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label className="text-black font-w500">Customer Name</label>
                                                    <div className="contact-name">
                                                        <input type="text" className="form-control" name="Cust_Name" required="required" placeholder="Enter a name" 
                                                            value={editFormData.Cust_Name}
															onChange={handleEditFormChange}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label className="text-black font-w500">Ticket Summary</label>
                                                    <div className="contact-name">
                                                        <input type="text" className="form-control" name="TickOrd" required="required" placeholder="Enter a Summary" 
                                                            value={editFormData.TickOrd}
															onChange={handleEditFormChange}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label className="text-black font-w500">Location</label>
                                                    <div className="contact-name">
                                                        <input type="text" className="form-control" name="Location" required="required" placeholder="Enter a location" 
                                                            value={editFormData.Location}
															onChange={handleEditFormChange}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label className="text-black font-w500">Price</label>
                                                    <div className="contact-name">
                                                        <input type="text" className="form-control" name="Price" required="required" placeholder="Enter a price" 
                                                            value={editFormData.Price}
															onChange={handleEditFormChange}
                                                        />
                                                    </div>
                                                </div>
											</div>
										</div>
									</div>
									<div className="modal-footer">
										<button type="submit" className="btn btn-primary" onClick={handleEditFormSubmit}>Save</button>  
										<button type="button" onClick={()=> setEditModal(false)} className="btn btn-danger"> 
											<i className="flaticon-delete-1"></i> Discard
										</button>      
									</div>
								</form>
							</div>
						</div>
					</Modal>					
				</div>
			</div>
			<div className="row">
				<div className="col-lg-12">
					<div className="card">
						<div className="card-header">
							<h4 className="card-title">Post Table</h4>
						</div>
						<div className="card-body">
							<div className="table-responsive dataTables_wrapper">
								<table	className='table table-responsive-md '>
									<thead>
										<tr role='row'>
											<th>Cust.Id</th>
											<th>Date Join</th>
											<th>Customer Name</th>
											<th>Ticket Ordered</th>
											<th>Location</th>
											<th>Total Spent</th>
											<th>Action</th>
										</tr>
									</thead>
									<tbody>
										{contacts.map((contact, index)=>(
											<tr role='row'>
												<td>{contact.Cust_Id}</td>
												<td>{contact.Date_Join}</td>
												<td>{contact.Cust_Name}</td>
												<td>{contact.TickOrd}</td>
												<td>{contact.Location}</td>
												<td className="text-primary font-w500">{contact.Price}</td>
												<td>
													<div className="d-flex">
														<Link to={"#"} className="btn btn-primary shadow btn-xs sharp me-1"
															onClick={(event) => handleEditClick(event, contact)}
														>
															<i className="fa fa-pencil"></i>
														</Link>
														<Link to={"#"} className="btn btn-danger shadow btn-xs sharp" onClick={()=>handleDeleteClick(contact.id)}>
															<i className="fa fa-trash"></i>
														</Link>
													</div>
												</td>
											</tr>
										))}							
									</tbody> 
								</table>	
							</div>
						</div>	
					</div>
				</div>	
			</div>
		</>	
	);
    
}


export default Posts;
