import React,{Fragment, useState} from 'react';
import {Link} from 'react-router-dom';
import {Tab, Nav, Modal} from 'react-bootstrap';


//Import Tab
import ProjectBoxView from './ProjectTab/ProjectBoxView';
import ProjectListTab from './ProjectTab/ProjectListTab';

const Project = () => {
	const[newProject, setNewProject] = useState(false);	
	return(
		<Fragment>
			
			<Tab.Container defaultActiveKey="ListView">
				<div className="d-flex align-items-center justify-content-between">
					<Link to={"#"}  onClick={()=> setNewProject(true)}  className="btn btn-primary rounded text-white">+ New Project</Link>
					<Nav as="div" className="grid-tabs nav nav-tabs">
						<Nav.Link id="ListViewTab" to={"#"} 
							className="tab-class nav-link"  							
							eventKey="ListView"
						>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M3.99976 7H19.9998C20.7954 7 21.5585 6.68393 22.1211 6.12132C22.6837 5.55871 22.9998 4.79565 22.9998 4C22.9998 3.20435 22.6837 2.44129 22.1211 1.87868C21.5585 1.31607 20.7954 1 19.9998 1H3.99976C3.20411 1 2.44104 1.31607 1.87844 1.87868C1.31583 2.44129 0.999756 3.20435 0.999756 4C0.999756 4.79565 1.31583 5.55871 1.87844 6.12132C2.44104 6.68393 3.20411 7 3.99976 7Z" fill="#43DC80"/>
								<path d="M19.9998 9H3.99976C3.20411 9 2.44104 9.31607 1.87844 9.87868C1.31583 10.4413 0.999756 11.2044 0.999756 12C0.999756 12.7956 1.31583 13.5587 1.87844 14.1213C2.44104 14.6839 3.20411 15 3.99976 15H19.9998C20.7954 15 21.5585 14.6839 22.1211 14.1213C22.6837 13.5587 22.9998 12.7956 22.9998 12C22.9998 11.2044 22.6837 10.4413 22.1211 9.87868C21.5585 9.31607 20.7954 9 19.9998 9Z" fill="#43DC80"/>
								<path d="M19.9998 17H3.99976C3.20411 17 2.44104 17.3161 1.87844 17.8787C1.31583 18.4413 0.999756 19.2044 0.999756 20C0.999756 20.7956 1.31583 21.5587 1.87844 22.1213C2.44104 22.6839 3.20411 23 3.99976 23H19.9998C20.7954 23 21.5585 22.6839 22.1211 22.1213C22.6837 21.5587 22.9998 20.7956 22.9998 20C22.9998 19.2044 22.6837 18.4413 22.1211 17.8787C21.5585 17.3161 20.7954 17 19.9998 17Z" fill="#43DC80"/>
							</svg>
						</Nav.Link>
						<Nav.Link id="BoxedTab" to={"#"} 
							className="tab-class nav-link"  							
							eventKey="BoxedView"
						>
							<svg className="primary-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M8 1H4C2.34315 1 1 2.34315 1 4V8C1 9.65685 2.34315 11 4 11H8C9.65685 11 11 9.65685 11 8V4C11 2.34315 9.65685 1 8 1Z" fill="#CBCBCB"/>
								<path d="M20 1H16C14.3431 1 13 2.34315 13 4V8C13 9.65685 14.3431 11 16 11H20C21.6569 11 23 9.65685 23 8V4C23 2.34315 21.6569 1 20 1Z" fill="#CBCBCB"/>
								<path d="M8 13H4C2.34315 13 1 14.3431 1 16V20C1 21.6569 2.34315 23 4 23H8C9.65685 23 11 21.6569 11 20V16C11 14.3431 9.65685 13 8 13Z" fill="#CBCBCB"/>
								<path d="M20 13H16C14.3431 13 13 14.3431 13 16V20C13 21.6569 14.3431 23 16 23H20C21.6569 23 23 21.6569 23 20V16C23 14.3431 21.6569 13 20 13Z" fill="#CBCBCB"/>
							</svg>
						</Nav.Link>
					</Nav>
				</div>
				{/* <!-- Add Order --> */}
				<Modal className="modal fade" show={newProject} onHide={setNewProject} centered>
					<div className="" role="document">
						<div className="modal-content">
							<div className="modal-header">
								<h5 className="modal-title">Add Project</h5>
								<button type="button" className="btn-close"  onClick={()=> setNewProject(false)}>
									{/* <span>&times;</span> */}
								</button>
							</div>
							<div className="modal-body">
								<form>
									<div className="form-group">
										<label className="text-black font-w500">Project Name</label>
										<input type="text" className="form-control" />
									</div>
									<div className="form-group">
										<label className="text-black font-w500">Dadeline</label>
										<input type="date" className="form-control" />
									</div>
									<div className="form-group">
										<label className="text-black font-w500">Client Name</label>
										<input type="text" className="form-control" />
									</div>
									<div className="form-group">
										<button type="button" className="btn btn-primary">SAVE</button>
									</div>
								</form>
							</div>
						</div>
					</div>
				</Modal>
				
				<Tab.Content className="project-list-group">
					<Tab.Pane eventKey="ListView">
						<ProjectListTab />
					</Tab.Pane>
					<Tab.Pane eventKey="BoxedView">
						<ProjectBoxView />
					</Tab.Pane>
				</Tab.Content>	
			</Tab.Container>	
		</Fragment>
	)
}
export default Project;