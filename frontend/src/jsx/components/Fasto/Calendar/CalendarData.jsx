import React, { Component } from "react";
import {Link} from 'react-router-dom';
import {Card } from "react-bootstrap";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { } from "@fullcalendar/interaction";
import Alert from "sweetalert2";

//Images
import profile4 from './../../../../images/profile/Untitled-4.jpg';
import profile5 from './../../../../images/profile/Untitled-5.jpg';
import profile6 from './../../../../images/profile/Untitled-6.jpg';
import profile7 from './../../../../images/profile/Untitled-7.jpg';

class CalendarData extends Component {
   state = {
      calendarEvents: [
         {
            title: "Atlanta Monster",
            start: new Date("2023-07-15 00:00"),
            id: "99999997",
         },
		 {
            title: "Birthday Party",
            start: new Date("2023-07-9 00:00"),
            id: "99999998",
         },
         {
            title: "My Favorite Murder",
            start: new Date("2023-07-21 00:00"),
            id: "99999999",
         },
		 
      ],
      events: [
         { title: "Event 1", id: "1" },
         { title: "Event 2", id: "2" },
         { title: "Event 3", id: "3" },
         { title: "Event 4", id: "4" },
         { title: "Event 5", id: "5" },
      ],
   };

  
   eventClick = (eventClick) => {
      Alert.fire({
         title: eventClick.event.title,
         html:
            `<div className="table-responsive">
      <table className="table">
      <tbody>
      <tr >
      <td>Title</td>
      <td><strong>` +
            eventClick.event.title +
            `</strong></td>
      </tr>
      <tr >
      <td>Start Time</td>
      <td><strong>
      ` +
            eventClick.event.start +
            `
      </strong></td>
      </tr>
      </tbody>
      </table>
      </div>`,

         showCancelButton: true,
         confirmButtonColor: "#d33",
         cancelButtonColor: "#3085d6",
         confirmButtonText: "Remove Event",
         cancelButtonText: "Close",
      }).then((result) => {
         if (result.value) {
            eventClick.event.remove(); // It will remove event from the calendar
            Alert.fire("Deleted!", "Your Event has been deleted.", "success");
         }
      });
   };

   render() {
      return (
			
            <div className="row">
				<div className="col-xl-3 col-xxl-4 ">
					<div className="card">
						<div className="card-header border-0">
							<div>
								<h4 className="font-w600 text-black fs-20 mb-1">Projects Details</h4>
								<span className="font-w500 fs-18 mb-3">September, 1st Week</span>
							</div>
						</div>
						<div className="card-body">
							<div className="mb-3 pb-3 border-bottom">
								<div className="d-flex">
									<div className="cal-ic bgl-primary text-primary rounded">
										<i className="fa fa-star" aria-hidden="true"></i>
									</div>
									<div>
										<p className="font-w600 mb-0 ms-sm-4 ms-3"><Link to={"/post-details"} className="text-black">Visual Graphic for Presentation to Client</Link></p>
									</div>
								</div>
								<div className="row justify-content-between align-items-center mt-sm-4 mt-3">
									<ul className="users col-6 d-flex justify-content-start">
										<li><img src={profile4} alt="" /></li>
										<li><img src={profile5} alt="" /></li>
										<li><img src={profile7} alt="" /></li>
									</ul>
									<div className="col-6 fs-14 text-end">
										<span>Aug 4, 2023</span>
									</div>
								</div>
							</div>
							<div className="mb-3 pb-3 border-bottom">
								<div className="d-flex">
									<div className="cal-ic bgl-warning text-warning rounded">
										<i className="fa fa-star" aria-hidden="true"></i>
									</div>
									<div>
										<p className="font-w600 mb-0 ms-sm-4 ms-3"><Link to={"/post-details"} className="text-black">Usability testing for Fasto Web App v2</Link></p>
									</div>
								</div>
								<div className="row justify-content-between align-items-center mt-sm-4 mt-3">
									<ul className="users col-6 d-flex justify-content-start">
										<li><img src={profile4} alt="" /></li>
										<li><img src={profile5} alt="" /></li>
										<li><img src={profile7} alt="" /></li>
									</ul>
									<div className="col-6 fs-14 text">
										<span>Aug 6, 2023</span>
									</div>
								</div>
							</div>
							<div className="mb-3 pb-3 border-bottom">
								<div className="d-flex">
									<div className="cal-ic bgl-secondary text-secondary rounded">
										<i className="fa fa-star" aria-hidden="true"></i>
									</div>
									<div>
										<p className="font-w600 mb-0 ms-sm-4 ms-3"><Link to={"/post-details"} className="text-black">Create A/B testing fro Fasto Mobile App</Link></p>
									</div>
								</div>
								<div className="row justify-content-between align-items-center mt-sm-4 mt-3">
									<ul className="users col-6 d-flex justify-content-start">
										<li><img src={profile4} alt="" /></li>
										<li><img src={profile5} alt="" /></li>
									</ul>
									<div className="col-6 fs-14 text-end">
										<span>Aug 7, 2023</span>
									</div>
								</div>
							</div>
							<div className="mb-3 pb-3  border-bottom">
								<div className="d-flex">
									<div className="cal-ic bgl-warning text-warning rounded">
										<i className="fa fa-star" aria-hidden="true"></i>
									</div>
									<div>
										<p className="font-w600 mb-0 ms-sm-4 ms-3"><Link to={"/post-details"} className="text-black">Rebuild Code web using Laravel</Link></p>
									</div>
								</div>
								<div className="row justify-content-between align-items-center mt-sm-4 mt-3">
									<ul className="users col-6 d-flex justify-content-start">
										<li><img src={profile4} alt="" /></li>
										<li><img src={profile5} alt="" /></li>
										<li><img src={profile7} alt="" /></li>
									</ul>
									<div className="col-6 fs-14 text-end">
										<span>Aug 8, 2023</span>
									</div>
								</div>
							</div>
							<div className=" ">
								<div className="d-flex">
									<div className="cal-ic bgl-primary text-primary rounded">
										<i className="fa fa-star" aria-hidden="true"></i>
									</div>
									<div>
										<p className="font-w600 mb-0 ms-sm-4 ms-3"><Link to={"/post-details"} className="text-black">Fixing Bugs</Link></p>
									</div>
								</div>
								<div className="row justify-content-between align-items-center mt-sm-4 mt-3">
									<ul className="users col-6 d-flex justify-content-start">
										<li><img src={profile4} alt="" /></li>
										<li><img src={profile5} alt="" /></li>
										<li><img src={profile6} alt="" /></li>
										<li><img src={profile7} alt="" /></li>
									</ul>
									<div className="col-6 fs-14 text-end">
										<span>Aug 9, 2023</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div className="col-xl-9 col-xxl-8 ">
					<div className="card dashboard-calendar">
						 <Card.Body>
							<div className="app-fullcalendar" id="calendar">
							   <FullCalendar
								  defaultView="dayGridMonth"
									headerToolbar={{
										start: "prev,next today",
										center: "title",
										end:"dayGridMonth,timeGridWeek,timeGridDay",
									}}
								  rerenderDelay={10}
								  eventDurationEditable={false}
								  editable={true}
								  droppable={true}
								  plugins={[
									 dayGridPlugin,
									 timeGridPlugin,
									 interactionPlugin,
								  ]}
								  ref={this.calendarComponentRef}
								  weekends={this.state.calendarWeekends}
								  events={this.state.calendarEvents}
								  eventDrop={this.drop}
								  // drop={this.drop}
								  eventReceive={this.eventReceive}
								  eventClick={this.eventClick}
								  // selectable={true}
							   />
							</div>
						 </Card.Body>
					</div>
               </div>
            </div>
        
      );
   }
}

export default CalendarData;
