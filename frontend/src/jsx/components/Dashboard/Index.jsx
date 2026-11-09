import React,{Fragment,useContext, useEffect} from 'react';
import {Link} from 'react-router-dom';
import {Dropdown} from 'react-bootstrap';
import loadable from "@loadable/component";
import pMinDelay from "p-min-delay";
import Donut from '../Fasto/Home/Donut';
import { ThemeContext } from "../../../context/ThemeContext";
import {ProjectBlog, titleBlog} from '../Fasto/Home/IndexData';

//Images
import untital1 from './../../../images/profile/Untitled-1.jpg';
import untital2 from './../../../images/profile/Untitled-2.jpg';
import untital3 from './../../../images/profile/Untitled-3.jpg';
import untital4 from './../../../images/profile/Untitled-4.jpg';
import untital5 from './../../../images/profile/Untitled-5.jpg';
import untital6 from './../../../images/profile/Untitled-6.jpg';
import untital7 from './../../../images/profile/Untitled-7.jpg';


const ChartTimeline = loadable(() =>
	pMinDelay(import("../Fasto/Home/ChartTimeline"), 1000)
);
const WidgetChart1 = loadable(() =>
	pMinDelay(import("../Fasto/Home/WidgetChart1"), 1000)
);
const RadialChart = loadable(() =>
	pMinDelay(import("../Fasto/Home/RadialChart"), 1000)
);
const WidgetChart2 = loadable(() =>
	pMinDelay(import("../Fasto/Home/WidgetChart2"), 1000)
);

const Index = () =>{
	const { changeBackground, background } = useContext(ThemeContext);
	useEffect(() => {
		changeBackground({ value: "light", label: "Light" });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	return(
		<Fragment>
			<div className="row">
				{titleBlog.map((item,index)=>(
					<div className="col-xl-3 col-xxl-6 col-lg-6 col-sm-6" key={index}>
						<div className="card card-bd">
							{item.border}
							<div className="card-body">
								<div className="media align-items-center">
									<div className="media-body me-3">
										<h2 className="num-text text-black font-w700">{item.title}</h2>
										<span className="fs-14">{item.subtitle}</span>
									</div>
									{item.icon}
								</div>
							</div>
						</div>
					</div>
				))}
			</div>	
			<div className="row">
				<div className="col-xl-6 col-xxl-12">
					<div className="card">
						<div className="card-header d-block border-0 pb-0">
							<div className="d-flex justify-content-between pb-3">
								<h4 className="mb-0 text-black fs-20">Project Created</h4>
                                <Dropdown>
                                    <Dropdown.Toggle className="i-false" as={Link} to={"#"}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z" stroke="#575757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                                            <path d="M12 6C12.5523 6 13 5.55228 13 5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44772 11 5C11 5.55228 11.4477 6 12 6Z" stroke="#575757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                                            <path d="M12 20C12.5523 20 13 19.5523 13 19C13 18.4477 12.5523 18 12 18C11.4477 18 11 18.4477 11 19C11 19.5523 11.4477 20 12 20Z" stroke="#575757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                                        </svg>
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu className="dropdown-menu-left">
                                        <Dropdown.Item>Edit</Dropdown.Item>
                                        <Dropdown.Item>Delete</Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown>
							</div>
							<div className="d-flex align-items-center">
								<span className="fs-36 text-black font-w600 me-4">25%</span>
								<div>
									<svg className="me-2" width="27" height="14" viewBox="0 0 27 14" fill="none" xmlns="http://www.w3.org/2000/svg">
										<path d="M0 13.435L13.435 0L26.8701 13.435H0Z" fill="#2FCA51"></path>
									</svg>
									<span>last month $563,443</span>
								</div>
							</div>
						</div>
						<div className="card-body pb-0 px-2 pt-2">
							<div id="chartTimeline" className="timeline-chart">
								<ChartTimeline />
							</div>
						</div>
					</div>		
				</div>
				<div className="col-xl-3 col-xxl-6 col-sm-6">
					<div className="card">	
						<div className="card-header border-0 pb-0">
							<h4 className="fs-20 mb-0 text-black">New Clients</h4>
                            <Dropdown>
                                <Dropdown.Toggle className="i-false" as={Link} to={"#"}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z" stroke="#575757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                                        <path d="M12 6C12.5523 6 13 5.55228 13 5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44772 11 5C11 5.55228 11.4477 6 12 6Z" stroke="#575757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                                        <path d="M12 20C12.5523 20 13 19.5523 13 19C13 18.4477 12.5523 18 12 18C11.4477 18 11 18.4477 11 19C11 19.5523 11.4477 20 12 20Z" stroke="#575757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                                    </svg>
                                </Dropdown.Toggle>
                                <Dropdown.Menu className="dropdown-menu-left">
                                    <Dropdown.Item>Edit</Dropdown.Item>
                                    <Dropdown.Item>Delete</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
						</div>
						<div className="card-body text-center pb-0 px-2 pt-2">
							<div className=" dashboard-chart">
								<WidgetChart1 />
							</div>
						</div>
					</div>
				</div>		
				<div className="col-xl-3 col-xxl-6 col-sm-6">
					<div className="card">	
						<div className="card-header border-0 pb-0">
							<h4 className="fs-20 mb-0 text-black">Monthly Target</h4>
							<Dropdown>
                                <Dropdown.Toggle className="i-false" as={Link} to={"#"}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z" stroke="#575757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                                        <path d="M12 6C12.5523 6 13 5.55228 13 5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44772 11 5C11 5.55228 11.4477 6 12 6Z" stroke="#575757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                                        <path d="M12 20C12.5523 20 13 19.5523 13 19C13 18.4477 12.5523 18 12 18C11.4477 18 11 18.4477 11 19C11 19.5523 11.4477 20 12 20Z" stroke="#575757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                                    </svg>
                                </Dropdown.Toggle>
                                <Dropdown.Menu className="dropdown-menu-left">
                                    <Dropdown.Item>Edit</Dropdown.Item>
                                    <Dropdown.Item>Delete</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
						</div>
						<div className="card-body text-center pt-0">
							<div id="radialChart" className="monthly-project-chart">
								<RadialChart />
							</div>
							<span className="fs-14 text-black d-block op5">100 Projects/ monthy</span>
						</div>
					</div>
				</div>
			</div>
			<div className="row">
				<div className="col-xl-6 col-xxl-12">
					<div className="row">
						<div className="col-sm-6">
							<div className="card">	
								<div className="card-header border-0">
									<h4 className="fs-16 text-black font-w500">Project Released</h4>
									<div className="d-flex align-items-center">
										<svg width="14" height="8" viewBox="0 0 14 8" fill="none" xmlns="http://www.w3.org/2000/svg">
											<path d="M1.90735e-06 0.499999L7 7.5L14 0.5" fill="#FF6746"/>
										</svg>
										<span className="fs-28 font-w600 ms-2 text-black">4%</span>
									</div>
								</div>
								<div className="card-body text-center pb-0 p-0">
									<div  className="dashboard-chart">
										<WidgetChart2 />
									</div>
								</div>
							</div>
						</div>
						<div className="col-sm-6">
							<div className="card">
								<div className="card-body text-center d-flex align-items-center justify-content-between">
									<div className="d-inline-block position-relative donut-chart-sale">
										{ background.value ==="dark" ? (
												<Donut value={29} backgroundColor="rgba(67, 220, 128, 1)"  backgroundColor2="#24292D"/>											
											): (
												<Donut value={29} backgroundColor="rgba(67, 220, 128, 1)"  backgroundColor2="rgba(241, 241, 241,1)"/>
										)}
										<small className="text-primary">29%</small>
									</div>
									<div>
										<h2 className="fs-28 font-w600 mb-0 text-end text-black">567</h2>
										<p className="mb-0 fs-14 font-w400 text-black">Contacts Added</p>
									</div>
								</div>
							</div>
						</div>
						<div className="col-xl-12">
							<div className="card message-bx">
								<div className="card-header border-0 d-sm-flex d-block pb-0">
									<div>
										<h4 className="fs-20 mb-0  text-black mb-sm-0 mb-2">Recent Messages</h4>
									</div>
									<Link to={"/contacts"} className="btn btn-primary shadow-primary btn-rounded text-white">+ New Message</Link>
								</div>
								<div className="card-body">
									<div className="media mb-3 pb-3 border-bottom">
										<div className="image-bx me-sm-4 me-2">
											<img src={untital1} alt="" className="rounded-circle img-1" />
											<span className="active"></span>
										</div>
										<div className="media-body d-sm-flex justify-content-between d-block align-items-center">
											<div className="me-sm-3 me-0">
												<h6 className="fs-16 font-w600 mb-sm-2 mb-0"><Link to={"/messages"} className="text-black">Laura Chyan</Link></h6>
												<p className="text-black mb-1">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut</p>
												<span className="fs-14">5m ago</span>
											</div>
										</div>
									</div>
									<div className="media mb-3 pb-3 border-bottom">
										<div className="image-bx me-sm-4 me-2">
											<img src={untital2} alt="" className="rounded-circle img-1" />
										</div>
										<div className="media-body d-sm-flex justify-content-between d-block align-items-center">
											<div className="me-sm-3 me-0">
												<h6 className="fs-16 font-w600 mb-sm-2 mb-0"><Link to={"/messages"} className="text-black">Olivia Rellaq</Link></h6>
												<p className="text-black mb-1">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut</p>
												<span className="fs-14">41m ago</span>
											</div>
										</div>
									</div>
									<div className="media">
										<div className="image-bx me-sm-4 me-2">
											<img src={untital3} alt="" className="rounded-circle img-1" />
											<span className="active"></span>
										</div>
										<div className="media-body d-sm-flex justify-content-between d-block align-items-center">
											<div className="me-sm-3 me-0">
												<h6 className="fs-16 font-w600 mb-sm-2 mb-0"><Link to={"/messages"} className="text-black">Keanu Tipes</Link></h6>
												<p className="text-black mb-1">Nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum...</p>
												<span className="fs-14">25m ago</span>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
				<div className="col-xl-6 col-xxl-12">
					<div className="row">
						<div className="col-md-6">
							<div className="card">
								<div className="card-header border-0 pb-0">
									<div className="me-2">
										<h4 className="fs-20 mb-0 font-w500 text-black">Upcoming Projects</h4>
									</div>
								</div>
								<div className="card-body">
									<div className="border-bottom up-project-bx pb-4 mb-4">
										<ProjectBlog titleMenu="Redesign Kripton Mobile App"  />
									</div>
									<div className="border-bottom up-project-bx pb-4 mb-4">
										<ProjectBlog titleMenu="Build Branding Persona for Etza.id"  />
									</div>
									<div className="up-project-bx">
										<ProjectBlog titleMenu="Manage SEO for Eclan Company Profile"  />
									</div>
								</div>
							</div>
						</div>
						<div className="col-md-6">
							<div className="card kanbanPreview-bx">
								<div className="card-body">
									<div className="sub-card bg-secondary d-flex text-white">
										<div className="me-auto pr-2">
											<h4 className="fs-20 mb-0 font-w600 text-white">Quick To-Do List</h4>
											<span className="fs-14 op6 font-w200">Lorem ipsum dolor sit amet</span>
										</div>
										<Link to={"/contacts"} className="plus-icon"><i className="fa fa-plus" aria-hidden="true"></i></Link>
									</div>
									<div className="sub-card">
										<span className="text-warning sub-title fs-14">Graphic Deisgner</span>
										<p className="font-w500"><Link to={"/post-details"} className="text-black">Visual Graphic for Presentation to Client</Link></p>
										<div className="row justify-content-between align-items-center">
											<div className="col-6">
												<span>Aug 4, 2023</span>
											</div>
											<ul className="users col-6">
												<li><img src={untital4} alt="" /></li>
												<li><img src={untital5} alt="" /></li>
												<li><img src={untital6} alt="" /></li>
												<li><img src={untital7} alt="" /></li>
											</ul>
											
										</div>
									</div>
									<div className="sub-card">
										<span className="text-primary sub-title fs-14">Database Engineer</span>
										<p className="font-w500"><Link to={"/post-details"} className="text-black">Build Database Design for Fasto Admin v2</Link></p>
										<div className="row justify-content-between align-items-center">
											<div className="col-6">
												<span>Aug 4, 2023</span>
											</div>
											<ul className="users col-6">
												<li><img src={untital4} alt="" /></li>
												<li><img src={untital5} alt="" /></li>
												<li><img src={untital6} alt="" /></li>
											</ul>
										</div>
									</div>
									<div className="sub-card">
										<span className="text-secondary sub-title fs-14">Digital Marketing</span>
										<p className="font-w500"><Link to={"/post-details"} className="text-black">Make Promotional Ads for Instagram Fasto’s</Link></p>
										<div className="row justify-content-between align-items-center mb-4">
											<div className="col-6">
												<span>Aug 4, 2023</span>
											</div>
											<ul className="users col-6">
												<li><img src={untital4} alt="" /></li>
												<li><img src={untital5} alt="" /></li>
												<li><img src={untital6} alt="" /></li>
											</ul>
										</div>
										<span><i className="far fa-comment me-2"></i>2 Comment</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>	
		</Fragment>
	)
}
export default Index;	