import React from "react";
import {Link} from 'react-router-dom';
import { Draggable } from "@hello-pangea/dnd";
import { Droppable } from "@hello-pangea/dnd";

import profile4 from './../../../../images/profile/Untitled-4.jpg';
import profile5 from './../../../../images/profile/Untitled-5.jpg';
import profile6 from './../../../../images/profile/Untitled-6.jpg';

const KanbanCard = ({ column, tasks }) => {
  // const [priority, setPriority] = useState(tasks); 
  //   const handleSelect = (id, value)	=> {
	// 	let temp = priority.map((data) => {
	// 		if (id === data.emplid) {
	// 			return { ...data, select: value };
	// 		}
	// 		return data;
	// 	});
	// 	setPriority(temp);
	// };
	// const handleAction = (id, value)	=> {
	// 	let temp = priority.map((data) => {
	// 		if (id === data.emplid) {
	// 			return { ...data, status: value };
	// 		}
	// 		return data;
	// 	});
	// 	setPriority(temp);
	// };
  return (
    <>
        <div className="col">
            <div className="card kanbanPreview-bx h-100">
               <div className="card-body draggable-zone dropzoneContainer ">  
                    {column.title}
                    <Droppable droppableId={column.id}>
                        {(droppableProvided, droppableSnapshot) => (
                          <div     
                            className="h-100"                    
                              ref={droppableProvided.innerRef}
                              {...droppableProvided.droppableProps}
                          >
                            {tasks.map((task, index) => (
                                <Draggable key={task.id} draggableId={`${task.id}`} index={index}>
                                  {(draggableProvided) => (
                                    <div                                         
                                        ref={draggableProvided.innerRef}
                                        {...draggableProvided.draggableProps}
                                        {...draggableProvided.dragHandleProps}
                                    >                                        
                                      <div className="sub-card draggable-handle draggable">
                                          <span className={`sub-title text-${task.select}`}>{task.maintitle}</span>
                                          <p className="font-w600"><Link to={"/post-details"} className="text-black">{task.content}</Link></p>
                                            <div className="row justify-content-between align-items-center mb-2">
                                              <div className="col-6">
                                                <span className="fs-14">Aug 4, 2023</span>
                                              </div>
                                              <ul className="users col-6">
                                                <li><img src={profile4} alt="" /></li>
                                                <li><img src={profile5} alt="" /></li>
                                                <li><img src={profile6} alt="" /></li>                                                
                                              </ul>
                                            </div>
                                            <span className="text-black font-w500 fs-14"><i className="fa fa-comment-o me-2"></i>2 Comment</span>
                                            {
                                              index === 1  ?  
                                                <span className="ms-2 text-black font-w500 fs-14"><i className="fa fa-paperclip me-2"></i>1 Attached file</span>
                                                : 
                                                ''
                                            }
                                        </div>
                                          
                                    </div>
                                  )}
                                </Draggable>
                            ))}
                          </div>
                        )}
                    </Droppable>
                </div>
            </div>
        </div>
          
    </>
  );
};
export default KanbanCard;