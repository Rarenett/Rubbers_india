import React,{Fragment} from 'react';
import {Link} from 'react-router-dom';
/// Scroll
import PerfectScrollbar from "react-perfect-scrollbar";
import { Dropdown, Tab, Nav} from 'react-bootstrap';

import ChatRoom from '../Fasto/Chatbox/ChatRoom';
import {chatlistBlog, chatlistBlog2, chatlistBlog3} from './../Fasto/Message/MessagesTabData';
import profile1 from './../../../images/profile/Untitled-1.jpg';

const Messages = () =>{
	return(
		<Fragment>
			<div className="row">
				<div className="col-xl-5">
					<div className="row">
						<div className="col-xl-12">
							<div className="card">
								<div className="card-body d-flex align-items-center">
									<div className="d-flex me-auto mb-sm-0 mb-2 align-items-center">
										<img src={profile1} alt="" width="60" className="rounded-circle me-3" />
										<div>
											<h5 className="fs-18 text-black font-w600">Peter Parkur</h5>
											<Dropdown className="dropdown">
												<Dropdown.Toggle variant="" as="div" className="i-false">
													<Link to={"#"} className="text-primary" data-toggle="dropdown" aria-expanded="false">
														<svg className="me-1" width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
															<circle cx="4" cy="4" r="4" fill="#0a500f"/>
														</svg>
														Available
														<i className="las la-angle-down text-dark ms-2"></i>
													</Link>
												</Dropdown.Toggle>	
												<Dropdown.Menu className="dropdown-menu-right" alignRight={true}>
													<Dropdown.Item>Available</Dropdown.Item>
													<Dropdown.Item>Unavailable</Dropdown.Item>
												</Dropdown.Menu>
											</Dropdown>
										</div>
									</div>
									<Link to={"/contacts"} className="btn btn-primary btn-rounded text-white shadow-primary"><i className="las la-comment-dots me-2 scale5"></i>+ New</Link>
								</div>
							</div>
						</div>
						<div className="col-xl-12">
							<Tab.Container defaultActiveKey="All">
								<div className="card">
									<div className="card-header align-items-center">
										<div className="card-action card-tabs">
											<Nav as="ul" className="nav nav-tabs style-1" role="tablist">
												<Nav.Item as="li" className="nav-item">
													<Nav.Link to ={"#"} eventKey="All">
														All Message
													</Nav.Link>
												</Nav.Item>
												<Nav.Item as="li" className="nav-item">
													<Nav.Link to={"#"} eventKey="Unread">
														Unread
													</Nav.Link>
												</Nav.Item>
												<Nav.Item as="li" className="nav-item">
													<Nav.Link to={"#"} eventKey="Archived">
														Archived
													</Nav.Link>
												</Nav.Item>
											</Nav>
										</div>
									</div>
									<div className="card-body message-bx px-0 pt-3" >
										<div className="input-group message-search-area">
											<input type="text" className="form-control" placeholder="Search from people and grup" />
											<div className="input-group-append">
												<button className="input-group-text"><i className="flaticon-381-search-2"></i></button>
											</div>
										</div>
										<PerfectScrollbar className=" dz-scroll height520">
											<div className="tab-content" id="message-bx">
												<div className="tab-pane fade show active" id="AllMessage" role="tabpanel">
													<Tab.Content>
														<Tab.Pane eventKey="All">
															{chatlistBlog.map((item,index)=>(
																<div className="media chat-list-area " key={index}>
																	{item.image1}
																	{item.image2}
																	<div className="media-body">
																		<div className="d-flex mb-sm-2 mb-0">
																			<h6 className="text-black mb-0 font-w600 fs-16">{item.title}</h6>
																			<span className="ms-auto fs-14">{item.time}</span>
																		</div>
																		<p className="text-black">Nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
																	</div>
																</div>
															))}
														</Tab.Pane>	
														<Tab.Pane eventKey="Unread">	
															{chatlistBlog2.map((item,index)=>(
																<div className="media chat-list-area " key={index}>
																	{item.image1}
																	{item.image2}
																	<div className="media-body">
																		<div className="d-flex mb-sm-2 mb-0">
																			<h6 className="text-black mb-0 font-w600 fs-16">{item.title}</h6>
																			<span className="ms-auto fs-14">{item.time}</span>
																		</div>
																		<p className="text-black">Nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
																	</div>
																</div>
															))}
														</Tab.Pane>	
														<Tab.Pane eventKey="Archived">	
															{chatlistBlog3.map((item,index)=>(
																<div className="media chat-list-area " key={index}>
																	{item.image1}
																	{item.image2}
																	<div className="media-body">
																		<div className="d-flex mb-sm-2 mb-0">
																			<h6 className="text-black mb-0 font-w600 fs-16">{item.title}</h6>
																			<span className="ms-auto fs-14">{item.time}</span>
																		</div>
																		<p className="text-black">Nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
																	</div>
																</div>
															))}
														</Tab.Pane>	
													</Tab.Content>
												</div>
											</div>
										</PerfectScrollbar>	
									</div>
								</div>
							</Tab.Container>	
						</div>
					</div>
				</div>
				<div className="col-xl-7">
					<div className="row">
						<ChatRoom />						
					</div>
				</div>
			</div>		
		</Fragment>	
	)
}

export default Messages;