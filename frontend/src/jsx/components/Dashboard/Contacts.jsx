import React,{Fragment, useState} from 'react';
import {Link} from 'react-router-dom';
import {Dropdown, Modal, Nav, Tab} from 'react-bootstrap';
import swal from "sweetalert";
import PerfectScrollbar from "react-perfect-scrollbar";

import {addTodo, deleteTodo} from '../../../store/actions/index';
import {useSelector, useDispatch} from 'react-redux';
//import ImageBlog from '../Fasto/Contacts/ImageBlog';
import ContactsData from '../Fasto/Contacts/ContactsData';

//Images
import user from './../../../images/contacts/user.jpg';

import contact7 from './../../../images/contacts/Untitled-7.jpg';
import contact6 from './../../../images/contacts/Untitled-6.jpg';
import contact5 from './../../../images/contacts/Untitled-5.jpg';
import contact4 from './../../../images/contacts/Untitled-4.jpg';
import contact3 from './../../../images/contacts/Untitled-3.jpg';
import contact2 from './../../../images/contacts/Untitled-2.jpg';
import contact1 from './../../../images/contacts/Untitled-1.jpg';

const initialList =[	
	{ id:6,  image: contact7 , username: 'Engeline O’conner.', occupation: 'Beep Beep Inc'  },
	{ id:7,  image: contact6, username: 'Nindy Leeacovic', occupation: 'Zero Two Studios'  },
	{ id:8,  image: contact5, username: 'Ivankov Shee', occupation: 'Beep Beep Inc'  },
	{ id:9,  image: contact4, username: 'Henry Charlotte', occupation: 'UI Designer'  },
	{ id:10,  image: contact3 , username: 'Geovanny', occupation: 'UI Designer'  },
	{ id:11,  image: contact2 , username: 'Franklin Jr.', occupation: 'Zero Two Studios'  },
	{ id:12,  image: contact1 , username: 'Engeline O’conner.', occupation: 'Beep Beep Inc'  },
];

const Contacts = () =>{	
	// This is Model function
	const [addContact, setAddContact] = useState(false);
	
	//Remove and delete List from Blog 'function'
	const [data, setData] = useState(initialList);
	function handleRemove(id){
		const newList = data.filter((item) => item.id !== id);
		setData(newList); 
	}
    
	
	// This is load more function 
	const [refresh, setRefresh] = useState(false);
	const onClick = () => {
		setRefresh(true);
		setTimeout(() => {
		  setData([
			...data,
			data[Math.floor(Math.random() * Math.floor(data.length - 1))],
		  ]);
		  setRefresh(false);
		}, 1000);
	};
	

	//Add and delete data from list
	const dispatch = useDispatch();	
    let list = useSelector((state) => state.todoReducers.list);
	const [list_name, setInputData] = useState('');
	const [list_occupation, setInputData1] = useState('');
	
	const dataArr = [];
		 
	//Error message 
	function onAddData(e){
		e.preventDefault();
		var error = false;
		var errorMsg = '';
		if(list_name === ''){
			error = true;
			errorMsg = 'Please fill name.';
		}else if(list_occupation === ''){
			error = true;
			errorMsg = 'Please fill occupation.';
		}
	  
		if(!error){
			//fetch data from Form
			dataArr.list_name =  list_name;
			dataArr.list_occupation =  list_occupation;
			dataArr.file =  file;
		  
			dispatch(addTodo(dataArr));
            setInputData('');
            setInputData1('');
			setAddContact(false);
			swal('Good job!', 'Successfully Added', "success");
		}else{
			swal('Oops', errorMsg, "error");
		}
    }
	
	//For Image upload in ListBlog
	const [file, setFile] = React.useState(null)
    const fileHandler = (e) => {
        setFile(e.target.files[0])
    }
	
	
	return(
		<Fragment>
			<Tab.Container defaultActiveKey="All">	
				<div className="project-nav">
					<div className="card-action card-tabs  me-auto">
						<Nav as="ul" className="nav nav-tabs style-2">
							<Nav.Item as="li"  className="nav-item">
								<Nav.Link to ={"#"} eventKey="All" >All Contacts
									<span className="ms-1 badge badge-primary shadow-primary">154</span>
								</Nav.Link>
							</Nav.Item>
							<Nav.Item as="li" className="nav-item">
								<Nav.Link to ={"#"} eventKey="Pending">Pending Invitation
									<span className="ms-1 badge shadow-warning  badge-warning">6</span>
								</Nav.Link>
							</Nav.Item>	
						</Nav>
					</div>
					<div className="d-flex align-items-center">
						<Link to={"#"} id="btn-add-contact" onClick={()=> setAddContact(true)} className="btn btn-primary rounded text-white">+ New Contacts</Link>
						<div className="switch">
						</div>
					</div>
					{/* <!-- Modal --> */}
					<Modal className="modal fade" id="addContactModal"  show={addContact} onHide={setAddContact} centered>
						<div className="" role="document">
							<div className="">
								<form id="addContactModalTitle" onSubmit={onAddData}>
									<div className="modal-header">
										<h4 className="modal-title fs-20">Add Contact</h4>
										<button type="button" className="btn-close" onClick={()=> setAddContact(false)}>
											{/* <span>&times;</span> */}
										</button>
									</div>
									<div className="modal-body">
										<i className="flaticon-cancel-12 close"></i>
										<div className="add-contact-box">
											<div className="add-contact-content">
												<div className="image-placeholder">	
													<div className="avatar-edit">
														<input type="file" onChange={fileHandler} id="imageUpload"
															onClick={(event) => setFile(event.target.value)}
														/> 					
														<label htmlFor="imageUpload" name=''  ></label>
													</div>
													<div className="avatar-preview">
														<div id="imagePreview">
															<img src={file? URL.createObjectURL(file) : user} alt={file? file.name : null}/>
														</div>
													</div>
													{/*<ImageBlog></ImageBlog>*/}
												</div>
												<div className="form-group">
													<label className="text-black font-w500">Name</label>
													<div className="contact-name">
														<input type="text" id="c-name" className="form-control"  autocomplete="off"
															value={list_name}
															onChange={(event) => setInputData(event.target.value)}
															placeholder="Name"
														/>
														<span className="validation-text"></span>
													</div>
												</div>
												<div className="form-group">
													<label className="text-black font-w500">Occupation</label>
													<div className="contact-occupation">
														<input type="text"  id="c-occupation" autocomplete="off"
															value={list_occupation} 
															onChange={(event) => setInputData1(event.target.value)}
															className="form-control" placeholder="Occupation" 
														/>
													</div>
												</div>
												
											</div>
										</div>
									</div>
									<div className="modal-footer">
										{/*<button type="submit" id="btn-edit" className="float-left btn btn-primary">Save</button>*/}
										<button type="button"  className="btn btn-danger" onClick={()=> setAddContact(false)}> <i className="flaticon-delete-1"></i> Discard</button>
										<button id="btn-add" className="btn btn-primary">Add</button> 
									</div>
								</form>
							</div>
						</div>
					</Modal>				
				</div>	
				<div className="tab-content">
					<div className="tab-pane fade show active" id="navpills-1" >
						<Tab.Content>
							<Tab.Pane eventKey="All">
								<PerfectScrollbar className="row dz-scroll  loadmore-content searchable-items list" id="allContactListContent">
									<div className="items items-header-section">
									</div>
									
									{data.map((item)=>(	
										<div className="col-xl-3 col-xxl-4 col-lg-4 col-md-6 col-sm-6 items" key={item.id}>
											<div className="card contact-bx item-content">
												<div className="card-header border-0">
													<div className="action-dropdown">
														<Dropdown className="">
															<Dropdown.Toggle variant="" as="div" className="i-false">
																<Link to={"#"} data-toggle="dropdown" aria-expanded="false">
																	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
																		<path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z" stroke="#575757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
																		<path d="M12 6C12.5523 6 13 5.55228 13 5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44772 11 5C11 5.55228 11.4477 6 12 6Z" stroke="#575757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
																		<path d="M12 20C12.5523 20 13 19.5523 13 19C13 18.4477 12.5523 18 12 18C11.4477 18 11 18.4477 11 19C11 19.5523 11.4477 20 12 20Z" stroke="#575757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
																	</svg>
																</Link>
															</Dropdown.Toggle>	
															<Dropdown.Menu className="dropdown-menu-right" alignRight={true}>
																<Dropdown.Item className="delete text-danger"  onClick={() => handleRemove(item.id)}>Delete</Dropdown.Item>
															</Dropdown.Menu>
														</Dropdown>
													</div>
												</div>
												<div className="card-body user-profile">
													<div className="image-bx">
														<img src={item.image}  alt="" className="rounded-circle" />
														<span className="active"></span>
													</div>
													<div className="media-body user-meta-info">
														<h6 className="fs-20 font-w500 my-1"><Link to={"./app-profile"} className="text-black user-name" data-name="Engeline O’conner">{item.username}</Link></h6>
														<p className="fs-14 mb-3 user-work" data-occupation="UI Designer">{item.occupation}</p>
														<ul>
															<li><Link to={"#"}><i className="fa fa-phone" aria-hidden="true"></i></Link></li>
															<li><Link to={"./messages"}><i className="las la-sms"></i></Link></li>
															<li><Link to={"#"}><i className="fas fa-video" aria-hidden="true"></i></Link></li>
														</ul>
													</div>
												</div>
											</div>
										</div>
									))}
									
									{ list.map((elem) =>{return(
										<div className="col-xl-3 col-xxl-4 col-lg-4 col-md-6 col-sm-6 items" key={elem.id}>
											<div className="card contact-bx item-content">
												<div className="card-header border-0">
													<div className="action-dropdown">
														<Dropdown className="">
															<Dropdown.Toggle variant="" as="div" className="i-false">
																<Link to={"#"} data-toggle="dropdown" aria-expanded="false">
																	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
																		<path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z" stroke="#575757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
																		<path d="M12 6C12.5523 6 13 5.55228 13 5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44772 11 5C11 5.55228 11.4477 6 12 6Z" stroke="#575757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
																		<path d="M12 20C12.5523 20 13 19.5523 13 19C13 18.4477 12.5523 18 12 18C11.4477 18 11 18.4477 11 19C11 19.5523 11.4477 20 12 20Z" stroke="#575757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
																	</svg>
																</Link>
															</Dropdown.Toggle>	
															<Dropdown.Menu className="dropdown-menu-right" alignRight={true}>
																<Dropdown.Item className="delete text-danger" onClick={() => dispatch(deleteTodo(elem.id))}>Delete</Dropdown.Item>
															</Dropdown.Menu>
														</Dropdown>
													</div>
												</div>
												<div className="card-body user-profile">
													<div className="image-bx">
														<img src={(elem.data.file)? URL.createObjectURL(elem.data.file) : user}  alt="" className="rounded-circle" />
														<span className="active"></span>
													</div>
													<div className="media-body user-meta-info">
														<h6 className="fs-20 font-w500 my-1"><Link to={"./app-profile"} className="text-black user-name" data-name="Alan Green">{elem.data.list_name}</Link></h6>
														<p className="fs-14 mb-3 user-work" data-occupation="UI Designer">{elem.data.list_occupation}</p>
														<ul>
															<li><Link to={"#"} ><i className="fa fa-phone" aria-hidden="true"></i></Link></li>
															<li><Link to={"./messages"}><i className="las la-sms"></i></Link></li>
															<li><Link to={"#"}><i className="fa fa-video-camera" aria-hidden="true"></i></Link></li>
														</ul>
													</div>
												</div>
											</div>
										</div>
									)})}
								</PerfectScrollbar>
								<div className="row">
									<div className="col-xl-12 d-flex justify-content-center">
										<Link to={"#"} className="btn btn-outline-primary dz-load-more"  onClick={() => onClick()}>
											Load More<span>&#187;</span>{" "}
											{refresh && <i className="fa fa-refresh"></i>}
										</Link>
									</div>
								</div>
							</Tab.Pane>	
							<Tab.Pane eventKey="Pending">
								<ContactsData />
							</Tab.Pane>
						</Tab.Content> 	
					</div>
				</div>		
			</Tab.Container>	
		</Fragment>
	)
}
export default Contacts;