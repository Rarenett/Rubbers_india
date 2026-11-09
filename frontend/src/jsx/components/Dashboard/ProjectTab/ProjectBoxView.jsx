import React,{Fragment, } from 'react';
import {Link} from 'react-router-dom';
import {Tab, Nav} from 'react-bootstrap';

import { projectInfo5, projectInfo6, projectInfo7, projectInfo8,
DropdownBlog} from '../../Fasto/Project/TabData';

const ProjectBoxView = () => {
	return(
		<Fragment>
			<Tab.Container defaultActiveKey="All">
				<div className="project-nav">
					<div className="card-action card-tabs  me-auto">
						<Nav as="ul" className="nav nav-tabs style-2">
							<Nav.Item as="li">
								<Nav.Link to ={"#"} eventKey="All">All Projects
									<span className="ms-1 badge badge-pill shadow-primary badge-primary">8</span>
								</Nav.Link>
							</Nav.Item>
							<Nav.Item as="li">
								<Nav.Link to ={"#"} eventKey="Progress">On Progress
									<span className="ms-1 badge badge-pill badge-info shadow-info">4</span>
								</Nav.Link>
							</Nav.Item>
							<Nav.Item as="li">
								<Nav.Link to ={"#"} eventKey="Pending">Pending 
									<span className="ms-1 badge badge-pill badge-warning shadow-warning">2</span>
								</Nav.Link>
							</Nav.Item>
							<Nav.Item as="li">
								<Nav.Link to ={"#"} eventKey="Closed">Closed 
									<span className="ms-1 badge badge-pill badge-danger shadow-danger">2</span>
								</Nav.Link>
							</Nav.Item>
						</Nav>						
					</div>
				</div>
				<Tab.Content className="project-list-group">
					<Tab.Pane eventKey="All">
						<div className="row">
							{projectInfo5.map((item,index)=>(
								<div className="col-xl-3 col-xxl-4 col-lg-4 col-md-6 col-sm-6" key={index}>
									<div className="card project-boxed">
										<div className="img-bx">
											<img src={item.imageblog} alt="" className="w-100" />
											{item.result}
										</div>
										<div className="card-header align-items-start">
											<div>
												<p className="fs-14 mb-2 text-primary">{item.id}</p>
												<h6 className="fs-18 font-w500 mb-3"><Link to={"#"} className="text-black user-name">{item.title}</Link></h6>
												<div className="text-dark fs-14 text-nowrap"><i className="fa fa-calendar-o me-3" aria-hidden="true"></i>Created on Sep 8th, 2020</div>
											</div>
											<DropdownBlog />
										</div>
										<div className="card-body p-0 pb-3">
											<ul className="list-group list-group-flush">
												<li className="list-group-item">
													<span className="mb-0 title">Deadline</span> :
													<span className="text-black ms-2">Monday, Sep 26th 2020</span>
												</li>
												<li className="list-group-item">
													<span className="mb-0 title">Client</span> :
													<span className="text-black ms-2">Kevin Sigh</span>
												</li>
												<li className="list-group-item">
													<span className="mb-0 title">Person in charge</span> :
													<span className="text-black desc-text ms-2">Yuri Hanako</span>
												</li>
											</ul>
										</div>
										
									</div>
								</div>
							))}
						</div>	
					</Tab.Pane>
					<Tab.Pane eventKey="Progress">
						<div className="row">
							{projectInfo6.map((item,index)=>(
								<div className="col-xl-3 col-xxl-4 col-lg-4 col-md-6 col-sm-6" key={index}>
									<div className="card project-boxed">
										<div className="img-bx">
											<img src={item.imageblog} alt="" className="w-100" />
											{item.result}
										</div>
										<div className="card-header align-items-start">
											<div>
												<p className="fs-14 mb-2 text-primary">{item.id}</p>
												<h6 className="fs-18 font-w500 mb-3"><Link to={"#"} className="text-black user-name">{item.title}</Link></h6>
												<div className="text-dark fs-14 text-nowrap"><i className="fa fa-calendar-o me-3" aria-hidden="true"></i>Created on Sep 8th, 2020</div>
											</div>
											<DropdownBlog />
										</div>	
										<div className="card-body p-0 pb-3">
											<ul className="list-group list-group-flush">
												<li className="list-group-item">
													<span className="mb-0 title">Deadline</span> :
													<span className="text-black ms-2">Monday, Sep 26th 2020</span>
												</li>
												<li className="list-group-item">
													<span className="mb-0 title">Client</span> :
													<span className="text-black ms-2">Kevin Sigh</span>
												</li>
												<li className="list-group-item">
													<span className="mb-0 title">Person in charge</span> :
													<span className="text-black desc-text ms-2">Yuri Hanako</span>
												</li>
											</ul>
										</div>
										
									</div>
								</div>
							))}
						</div>
					</Tab.Pane>
					<Tab.Pane eventKey="Pending">	
						<div className="row">
							{projectInfo7.map((item,index)=>(
								<div className="col-xl-3 col-xxl-4 col-lg-4 col-md-6 col-sm-6" key={index}>
									<div className="card project-boxed">
										<div className="img-bx">
											<img src={item.imageblog} alt="" className="w-100" />
											{item.result}
										</div>
										<div className="card-header align-items-start">
											<div>
												<p className="fs-14 mb-2 text-primary">{item.id}</p>
												<h6 className="fs-18 font-w500 mb-3"><Link to={"#"} className="text-black user-name">{item.title}</Link></h6>
												<div className="text-dark fs-14 text-nowrap"><i className="fa fa-calendar-o me-3" aria-hidden="true"></i>Created on Sep 8th, 2020</div>
											</div>
											<DropdownBlog />
										</div>
										<div className="card-body p-0 pb-3">
											<ul className="list-group list-group-flush">
												<li className="list-group-item">
													<span className="mb-0 title">Deadline</span> :
													<span className="text-black ms-2">Monday, Sep 26th 2020</span>
												</li>
												<li className="list-group-item">
													<span className="mb-0 title">Client</span> :
													<span className="text-black ms-2">Kevin Sigh</span>
												</li>
												<li className="list-group-item">
													<span className="mb-0 title">Person in charge</span> :
													<span className="text-black desc-text ms-2">Yuri Hanako</span>
												</li>
											</ul>
										</div>
										
									</div>
								</div>
							))}
						</div>
					</Tab.Pane>
					<Tab.Pane eventKey="Closed">
						<div className="row">
							{projectInfo8.map((item,index)=>(
								<div className="col-xl-3 col-xxl-4 col-lg-4 col-md-6 col-sm-6" key={index}>
									<div className="card project-boxed">
										<div className="img-bx">
											<img src={item.imageblog} alt="" className="w-100" />
											{item.result}
										</div>
										<div className="card-header align-items-start">
											<div>
												<p className="fs-14 mb-2 text-primary">{item.id}</p>
												<h6 className="fs-18 font-w500 mb-3"><Link to={"#"} className="text-black user-name">{item.title}</Link></h6>
												<div className="text-dark fs-14 text-nowrap"><i className="fa fa-calendar-o me-3" aria-hidden="true"></i>Created on Sep 8th, 2020</div>
											</div>
											<DropdownBlog />
										</div>
										<div className="card-body p-0 pb-3">
											<ul className="list-group list-group-flush">
												<li className="list-group-item">
													<span className="mb-0 title">Deadline</span> :
													<span className="text-black ms-2">Monday, Sep 26th 2020</span>
												</li>
												<li className="list-group-item">
													<span className="mb-0 title">Client</span> :
													<span className="text-black ms-2">Kevin Sigh</span>
												</li>
												<li className="list-group-item">
													<span className="mb-0 title">Person in charge</span> :
													<span className="text-black desc-text ms-2">Yuri Hanako</span>
												</li>
											</ul>
										</div>
										
									</div>
								</div>
							))}
						</div>
					</Tab.Pane>
				</Tab.Content>
						
			</Tab.Container>	
		</Fragment>
	)
}
export default ProjectBoxView;