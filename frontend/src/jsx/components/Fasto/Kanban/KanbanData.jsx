import React, { useState } from "react";
import {Link} from 'react-router-dom';
import { DragDropContext } from "@hello-pangea/dnd";
import  KanbanCard  from "./KanbanCard";
import { Dropdown } from "react-bootstrap";

function DropdownBox(){
	return(
		<Dropdown>
			<Dropdown.Toggle variant="" as="div" className="i-false" >	
				<Link to={"#"} data-toggle="dropdown" aria-expanded="false">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
						<path d="M12 6C12.5523 6 13 5.55228 13 5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44772 11 5C11 5.55228 11.4477 6 12 6Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
						<path d="M12 20C12.5523 20 13 19.5523 13 19C13 18.4477 12.5523 18 12 18C11.4477 18 11 18.4477 11 19C11 19.5523 11.4477 20 12 20Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
					</svg>
				</Link>
			</Dropdown.Toggle>	
			<Dropdown.Menu  className="dropdown-menu-right"  align="end">
				<Dropdown.Item >Edit </Dropdown.Item>		
				<Dropdown.Item >Delete </Dropdown.Item>
			</Dropdown.Menu>	
		</Dropdown>
	)
}


function HeadOne({title, color}){   
    return(
        <>
          <div className={`sub-card align-items-center d-flex text-white ${color}`}>
            <div className="me-auto pe-2">
              <h4 className="fs-20 mb-0 font-w600 text-white">{title}</h4>
              <span className="fs-14 font-w200 op6">Lorem ipsum dolor sit amet</span>
            </div>
            <DropdownBox />
          </div>
        </>
    )
}


const reorderColumnList = (sourceCol, startIndex, endIndex) => {
  const newTaskIds = Array.from(sourceCol.taskIds);
  const [removed] = newTaskIds.splice(startIndex, 1);
  newTaskIds.splice(endIndex, 0, removed);

  const newColumn = {
    ...sourceCol,
    taskIds: newTaskIds,
  };

  return newColumn;
};


const initialData = {
    tasks: {
      1: { id: 1, dropid:'101', content: "Prepare proposal for client meeting",maintitle:'Graphic Deisgner',  select:'primary'},
      2: { id: 2, dropid:'102', content: "Annual Meeting With Marketing Team ",maintitle:'Public Relations',  select:'secondary' },
      3: { id: 3, dropid:'103', content: "Build Database Design for Fasto Admin v2",maintitle:'Software Engineer',  select:'info' },
      4: { id: 4, dropid:'104', content: "Make Promotional Ads for Instagram Fasto’s" ,maintitle:'Database Engineer',  select:'warning'},
      5: { id: 5, dropid:'105', content: "Visual Graphic for Presentation to Client",maintitle:'UX Writer',  select:'primary' },
      6: { id: 6, dropid:'106', content: "Create content for onboarding page Fasto Mobile App",maintitle:'Digital Marketing',  select:'secondary' },
      7: { id: 7, dropid:'107', content: "Visual Graphic for Presentation to Client",maintitle:'Public Relations',  select:'danger' },
      8: { id: 8, dropid:'108', content: "Create content for onboarding page Fasto Mobile App",maintitle:'UX Writer',  select:'info' },
      9: { id: 9, dropid:'109', content: "Build Database Design for Fasto Admin v2",maintitle:'Graphic Deisgner',  select:'warning' },
      10: { id: 10, dropid:'110', content: "Prepare proposal for client meeting",maintitle:'Software Engineer',  select:'secondary'},
      11: { id: 11, dropid:'111', content: "Annual Meeting With Marketing Team",maintitle:'Database Engineer',  select:'primary' },
      12: { id: 12, dropid:'112', content: "Make Promotional Ads for Instagram Fasto’s",maintitle:'Public Relations',  select:'warning' },
      // 13: { id: 13, dropid:'113', content: "Homepage Illustration",maintitle:'Design',  select:'secondary' },
      // 14: { id: 14, dropid:'114', content: " Doing Research",maintitle:'Illustration',  select:'danger' },
    },
    columns: {
      "column-1": {
        id: "column-1",
        title: <HeadOne title="To-Do List (2)" color="bg-secondary" />,
        taskIds: [1, 2],
      },
      "column-2": {
        id: "column-2",
        title: <HeadOne title="On Progress (3)" color="bg-warning"/>,
        taskIds: [3,4, 5],
      },
      "column-3": {
        id: "column-3",
        title:<HeadOne title="Done (2)" color="bg-info"/>,
        taskIds: [6,7],
      },
      "column-4": {
        id: "column-4",
        title:<HeadOne title="Revised (2)" color="bg-primary"/>,        
        taskIds: [8,9],
      },
      "column-5": {
        id: "column-5",
        title:<HeadOne title="On Progress" color="bg-secondary"/>,        
        taskIds: [10,11,12],
      },
   
    },  
    columnOrder: ["column-1", "column-2", "column-3","column-4", "column-5"],
  };
  


export default function TaskSummaryBlog() {
  const [state, setState] = useState(initialData);

  const onDragEnd = (result) => {
    const { destination, source } = result;

    
    if (!destination) return;   
      const sourceCol = state.columns[source.droppableId];
      const destinationCol = state.columns[destination.droppableId];

    if (sourceCol.id === destinationCol.id) {
      const newColumn = reorderColumnList(
        sourceCol,
        source.index,
        destination.index
      );
      const newState = {
        ...state,
        columns: {
          ...state.columns,
          [newColumn.id]: newColumn,
        },
      };
      setState(newState);
      return;
    }

    const startTaskIds = Array.from(sourceCol.taskIds);
    const [removed] = startTaskIds.splice(source.index, 1);
    const newStartCol = {
      ...sourceCol,
      taskIds: startTaskIds,
    };

    const endTaskIds = Array.from(destinationCol.taskIds);
    endTaskIds.splice(destination.index, 0, removed);
    const newEndCol = {
      ...destinationCol,
      taskIds: endTaskIds,
    };

    const newState = {
      ...state,
      columns: {
        ...state.columns,
        [newStartCol.id]: newStartCol,
        [newEndCol.id]: newEndCol,
      },
    };

    setState(newState);
  };

  return (
    <>
        <DragDropContext onDragEnd={onDragEnd}>        
            {state.columnOrder.map((columnId, index) => {
                const column = state.columns[columnId];
                const tasks = column.taskIds.map((taskId) => state.tasks[taskId]);
                return(
                    <KanbanCard key={column.id} column={column} tasks={tasks}/>  
                )
            })}    
        </DragDropContext>
    </>
  );
}