import React,{Fragment, useState} from 'react';
import {Link} from 'react-router-dom';
import {Modal} from 'react-bootstrap';

import KanbanData from './../Fasto/Kanban/KanbanData';


//Images
import kanban1 from './../../../images/kanban/Untitled-1.jpg';
import kanban2 from './../../../images/kanban/Untitled-2.jpg';
import kanban3 from './../../../images/kanban/Untitled-3.jpg';
import kanban4 from './../../../images/kanban/Untitled-4.jpg';
import kanban5 from './../../../images/kanban/Untitled-5.jpg';
import kanban6 from './../../../images/kanban/Untitled-6.jpg';
import kanban7 from './../../../images/kanban/Untitled-7.jpg';

const Kanban = (props) => {
	const[newProject, setNewProject] = useState(false);
	return(
		<Fragment>
			<div className="project-nav align-items-end">
				<div className="me-auto  mb-lg-0 mb-3">
					<div className="mb-4">
						<h2 className="title-num text-black font-w700">Project Fasto v2.2 </h2>
						<span className="fs-14">Created by Lidya Chan on July 21, 2023</span>
					</div>
					<div className="d-sm-flex d-block align-items-center">
						<Link to={"#"} className="btn btn-light rounded me-3 mb-sm-0 mb-2"><i className="fa fa-pencil-square me-3 scale5"></i>Edit</Link>
						<Link to={"#"} className="btn btn-light rounded mb-sm-0 mb-2"><i className="fa fa-lock me-3 scale5"></i>Private</Link>
						<ul className="users-lg ms-sm-5 ms-0">
							<li><img src={kanban1} alt="" /></li>
							<li><img src={kanban2} alt="" /></li>
							<li><img src={kanban3} alt="" /></li>
							<li><img src={kanban4} alt="" /></li>
							<li><img src={kanban5} alt="" /></li>
							<li><img src={kanban6} alt="" /></li>
							<li><img src={kanban7} alt="" /></li>
						</ul>
					</div>
				</div>
				<div className="mt-3">
					<Link to={"#"} onClick={ () => setNewProject(true)} className="btn btn-primary  rounded me-3 mb-sm-0 mb-2 text-white"><i className="fa fa-user me-3 scale5"></i>New Task</Link>
					<Modal className="modal fade" show={newProject} onHide={setNewProject} centered>
						<div className="" role="document">
							<div className="modal-content">
								<div className="modal-header">
									<h5 className="modal-title">Add Task</h5>
									<button type="button" className="btn-close" onClick={ () => setNewProject(false)}>										
									</button>
								</div>
								<div className="modal-body">
									<form>
										<div className="form-group">
											<label className="text-black font-w500">First Name</label>
											<input type="text" className="form-control" />
										</div>
										<div className="form-group">
											<label className="text-black font-w500">Last Name</label>
											<input type="text" className="form-control" />
										</div>
										<div className="form-group">
											<label className="text-black font-w500">Address</label>
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
				</div>
			</div>			
			<div className="row kanban-bx">				
				<KanbanData />
			</div>
			
		</Fragment>
	)
}
export default Kanban;