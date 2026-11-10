import React, { useState, useContext } from "react";
import {Nav,Tab} from 'react-bootstrap';
import PerfectScrollbar from "react-perfect-scrollbar";
import { Link } from "react-router-dom";
import Select from "react-select";
import { ThemeContext } from "../../context/ThemeContext";
import demo1 from '../../images/demo/pic1.jpg';
import demo2 from '../../images/demo/pic2.jpg';
import demo3 from '../../images/demo/pic3.jpg';
import demo4 from '../../images/demo/pic4.jpg';
import demo5 from '../../images/demo/pic5.jpg';

const Setting = () => {
  const [settingToggle, setSettingToggle] = useState(false);
  const [demoToggle, setDemoToggle] = useState(false);
  const {
    body,
    sideBarOption,
    layoutOption,
    backgroundOption,
    sidebarposition,
    headerPositions,
    containerPosition,
 
    fontFamily,
    primaryColor,
    changePrimaryColor,
    navigationHader,
    changeNavigationHader,
    sideBarStyle,
    changeSideBarStyle,
    changeSideBarPostion,
    sidebarpositions,
    changeHeaderPostion,
    headerposition,
    changeSideBarLayout,
    sidebarLayout,
    
    
    colors,
    haderColor,
    chnageHaderColor,
    sidebarColor,
    chnageSidebarColor,
    changeBackground,
    background,
    changeContainerPosition,
    containerPosition_,
	setDemoTheme,
    bodyFont,
    changeBodyFont,
    customPrimaryColor,
    changeCustomPrimaryColor,
    customBgColor,
    changeCustomBgColor,
    customFontColor,
    changeCustomFontColor,
    customNavHeaderColor,
    changeCustomNavHeaderColor,
    customHeaderColor,
    changeCustomHeaderColor,
    customSidebarColor,
    changeCustomSidebarColor,
    customSidebarFontColor,
    changeCustomSidebarFontColor,
    resetToDefault
  } = useContext(ThemeContext);
  return (
	<>
		<div className={`sidebar-right ${settingToggle ? "show" : ""}`}>
			<div className="bg-overlay" onClick={() => setSettingToggle(!settingToggle)}></div>
			<Link to="#" className="sidebar-right-trigger wave-effect wave-effect-x" onClick={() => setSettingToggle(!settingToggle)} >
				<span><i className="fa fa-cog fa-spin" /></span>
			</Link>
			<Link to="#" className="sidebar-close-trigger" onClick={() => setSettingToggle(!settingToggle)} >
				<span><i className="la-times las"></i></span>
			</Link>
			<div className="sidebar-right-inner">
				<div className="tab-content tab-content-default tabcontent-border">
					<div className="tab-pane fade active show" id="home8" role="tabpanel">
						<div className="admin-settings">
							<h4>Pick your style</h4>
							<Tab.Container defaultActiveKey="Theme">
								<div className="card-action card-tabs mt-3 mt-sm-0">
									<Nav as="ul" className="nav nav-tabs" role="tablist">
										<Nav.Item as="li" className="nav-item">
											<Nav.Link as="a" className="nav-link c-pointer" data-toggle="tab" eventKey="Theme" role="tab"> Theme </Nav.Link>
										</Nav.Item>
										<Nav.Item as="li" className="nav-item">
											<Nav.Link as="a" className="nav-link c-pointer" data-toggle="tab" eventKey="Header" role="tab"> Header </Nav.Link>
										</Nav.Item>
										<Nav.Item as="li" className="nav-item">
											<Nav.Link as="a" className="nav-link c-pointer"  data-toggle="tab" eventKey="Content"  role="tab">Content</Nav.Link>
										</Nav.Item>
									</Nav>
								</div>
								<Tab.Content className="">
									<Tab.Pane className="tab-pane fade " eventKey="Theme">
										<div className="admin-settings">
											<div className="row">
												<div className="col-sm-12">
													<p>Background</p>{" "}
													<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
														<div style={{ flex: 1 }}>
															<Select defaultValue={background} value={background} onChange={(e) => changeBackground(e)}
																options={backgroundOption}
																style={{
																	lineHeight: "40px",
																	color: "#7e7e7e",
																	paddingLeft: " 15px",
																}}
															/>
														</div>
														<span style={{ display: 'inline-block', position: 'relative' }}>
															<input
																type="color"
																value={customBgColor || (background?.value === 'dark' ? '#24292D' : '#F9F9F9')}
																onChange={(e) => changeCustomBgColor(e.target.value)}
																style={{
																	width: '38px',
																	height: '38px',
																	borderRadius: '8px',
																	border: customBgColor ? '3px solid #3b82f6' : '1px solid rgba(0,0,0,0.15)',
																	cursor: 'pointer',
																	padding: 0,
																	backgroundColor: customBgColor || (background?.value === 'dark' ? '#24292D' : '#F9F9F9')
																}}
																title="Choose Custom Theme Background Color"
															/>
														</span>
													</div>
												</div>
												<div className="col-sm-6">
													<p>Navigation Header</p>
													<div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
													  {colors.map((color, i) => (
														<span key={i}>
														  <input
															type="radio"
															name="navigation_header"
															defaultValue={color}
															className="filled-in chk-col-primary"
															id={`nav_header_${color}`}
															onClick={() => changeNavigationHader(color)}
														  />
														  <label htmlFor={`nav_header_${color}`} />
														</span>
													  ))}
													  <span style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '5px', position: 'relative', top: '-3px' }}>
														<input
															type="color"
															value={customNavHeaderColor}
															onChange={(e) => changeCustomNavHeaderColor(e.target.value)}
															style={{
																width: '24px',
																height: '24px',
																borderRadius: '50%',
																border: navigationHader === 'color_custom' ? '3px solid #3b82f6' : '1px solid rgba(0,0,0,0.15)',
																cursor: 'pointer',
																padding: 0,
																backgroundColor: customNavHeaderColor
															}}
															title="Choose Custom Navigation Header Background Color"
														/>
													  </span>
													</div>
												</div>
												<div className="col-sm-6">
													<p>Header</p>
													<div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
														{colors.map((color, i) => (
															<span key={i}>
																<input type="radio" name="header_bg" defaultValue={color} className="filled-in chk-col-primary"
																	id={`header_${color}`}
																	onClick={() => chnageHaderColor(color)}
																/>
																<label htmlFor={`header_${color}`} />
															</span>
														))}
														<span style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '5px', position: 'relative', top: '-3px' }}>
															<input
																type="color"
																value={customHeaderColor}
																onChange={(e) => changeCustomHeaderColor(e.target.value)}
																style={{
																	width: '24px',
																	height: '24px',
																	borderRadius: '50%',
																	border: haderColor === 'color_custom' ? '3px solid #3b82f6' : '1px solid rgba(0,0,0,0.15)',
																	cursor: 'pointer',
																	padding: 0,
																	backgroundColor: customHeaderColor
																}}
																title="Choose Custom Header Background Color"
															/>
														</span>
													</div>
												</div>
												<div className="col-sm-6">
													<p>Sidebar</p>
													<div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
														{colors.map((color, i) => (
															<span key={i}>
																<input type="radio" name="navigation_header" defaultValue={color} className="filled-in chk-col-primary"
																	id={`sidebar_${color}`}
																	onClick={() => chnageSidebarColor(color)}
																/>
																<label htmlFor={`sidebar_${color}`} />
															</span>
														))}
														<span style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '5px', position: 'relative', top: '-3px' }}>
															<input
																type="color"
																value={customSidebarColor}
																onChange={(e) => changeCustomSidebarColor(e.target.value)}
																style={{
																	width: '24px',
																	height: '24px',
																	borderRadius: '50%',
																	border: sidebarColor === 'color_custom' ? '3px solid #3b82f6' : '1px solid rgba(0,0,0,0.15)',
																	cursor: 'pointer',
																	padding: 0,
																	backgroundColor: customSidebarColor
																}}
																title="Choose Custom Sidebar Background Color"
															/>
														</span>
													</div>
												</div>
												<div className="col-sm-6">
													<p>Sidebar Font</p>
													<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
														<input
															type="color"
															value={customSidebarFontColor || (background?.value === 'dark' ? '#FFFFFF' : '#7e7e7e')}
															onChange={(e) => changeCustomSidebarFontColor(e.target.value)}
															style={{
																width: '24px',
																height: '24px',
																borderRadius: '50%',
																border: customSidebarFontColor ? '3px solid #3b82f6' : '1px solid rgba(0,0,0,0.15)',
																cursor: 'pointer',
																padding: 0,
																backgroundColor: customSidebarFontColor || (background?.value === 'dark' ? '#FFFFFF' : '#7e7e7e')
															}}
															title="Choose Custom Sidebar Font Color"
														/>
														<span style={{ fontSize: '12px', fontWeight: 600 }}>
															{customSidebarFontColor || (background?.value === 'dark' ? '#FFFFFF' : '#7e7e7e')}
														</span>
													</div>
												</div>
											</div>
										</div>
										{/* Reset Buttons */}
								<div style={{ display: 'flex', gap: '6px', marginTop: '12px', padding: '8px 0' }}>
									<button
										type="button"
										onClick={() => resetToDefault('light')}
										style={{
											flex: 1,
											padding: '6px 4px',
											borderRadius: '6px',
											border: '1px solid #0a500f',
											background: background?.value === 'light' ? '#0a500f' : 'transparent',
											color: background?.value === 'light' ? '#fff' : '#0a500f',
											fontSize: '11px',
											cursor: 'pointer',
											fontWeight: 600
										}}
									>
										☀️ Light Default
									</button>
									<button
										type="button"
										onClick={() => resetToDefault('dark')}
										style={{
											flex: 1,
											padding: '6px 4px',
											borderRadius: '6px',
											border: '1px solid #0a500f',
											background: background?.value === 'dark' ? '#0a500f' : 'transparent',
											color: background?.value === 'dark' ? '#fff' : '#0a500f',
											fontSize: '11px',
											cursor: 'pointer',
											fontWeight: 600
										}}
									>
										🌙 Dark Default
									</button>
								</div>
									</Tab.Pane>
								   <Tab.Pane className="tab-pane fade" eventKey="Header">
										<div className="admin-settings">
											<div className="row">
												<div className="col-sm-6">
													<p>Layout</p>{" "}
													<Select
													  defaultValue={sidebarLayout}
													  onChange={(e) => changeSideBarLayout(e)}
													  options={layoutOption}
													  style={{
														lineHeight: "40px",
														color: "#7e7e7e",
														paddingLeft: " 15px",
													  }}
													/>
												</div>
												<div className="col-sm-6">
													<p>Header position</p>{" "}
													<Select
													  defaultValue={headerposition}
													  onChange={(e) => changeHeaderPostion(e)}
													  options={headerPositions}
													  style={{
														lineHeight: "40px",
														color: "#7e7e7e",
														paddingLeft: " 15px",
													  }}
													/>
												</div>
												<div className="col-sm-6">
													<p>Sidebar</p>{" "}
													<Select
													  defaultValue={sideBarStyle}
													  onChange={(e) => changeSideBarStyle(e)}
													  options={sideBarOption}
													  style={{
														lineHeight: "40px",
														color: "#7e7e7e",
														paddingLeft: " 15px",
													  }}
													/>
												</div>
												<div className="col-sm-6">
													<p>Sidebar position</p>{" "}
													<Select
													  defaultValue={sidebarposition}
													  onChange={(e) => changeSideBarPostion(e)}
													  options={sidebarpositions}
													  style={{
														lineHeight: "40px",
														color: "#7e7e7e",
														paddingLeft: " 15px",
													  }}
													/>
												</div>
											</div>
										</div>
									</Tab.Pane>
									<Tab.Pane className="tab-pane fade" eventKey="Content">
										<div className="admin-settings">
											<div className="row">
												<div className="col-sm-6">
													<p>Container</p>{" "}
													<Select defaultValue={containerPosition_} onChange={(e) => changeContainerPosition(e)} options={containerPosition}
														style={{ lineHeight: "40px",color: "#7e7e7e",paddingLeft: " 15px",}}
													/>
												</div>
												
												<div className="col-sm-6">
													<p>Body Font</p>{" "}
													<Select 
														defaultValue={fontFamily.find(f => f.value === bodyFont) || fontFamily[1]} 
														onChange={(e) => changeBodyFont(e.value)}
														options={fontFamily}
														style={{ lineHeight: "40px", color: "#7e7e7e", paddingLeft: " 15px", }}
													/>
												</div>

												<div className="col-sm-6">
													<p>Font Color</p>{" "}
													<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
														<input
															type="color"
															value={customFontColor || (background?.value === 'dark' ? '#FFFFFF' : '#333333')}
															onChange={(e) => changeCustomFontColor(e.target.value)}
															style={{
																width: '38px',
																height: '38px',
																borderRadius: '8px',
																border: customFontColor ? '3px solid #3b82f6' : '1px solid rgba(0,0,0,0.15)',
																cursor: 'pointer',
																padding: 0,
																backgroundColor: customFontColor || (background?.value === 'dark' ? '#FFFFFF' : '#333333')
															}}
															title="Choose Custom Font Color"
														/>
														<span style={{ fontSize: '13px', fontWeight: 600 }}>
															{customFontColor || (background?.value === 'dark' ? '#FFFFFF' : '#333333')}
														</span>
														{customFontColor && (
															<button
																type="button"
																className="btn btn-link btn-xs p-0 text-muted"
																style={{ fontSize: '11px', textDecoration: 'underline' }}
																onClick={() => changeCustomFontColor('')}
																title="Reset font color to default"
															>
																Reset
															</button>
														)}
													</div>
												</div>
											</div>	
										</div>
									</Tab.Pane>
								</Tab.Content>
							</Tab.Container>
						</div>
					</div>
				</div>
			</div>
		</div>
	
		<div className={`dz-demo-panel ${demoToggle ? "show" : ""}`}>
			<div className="bg-overlay" onClick={() => setDemoToggle(!demoToggle)}></div>
				<div className="bg-close"  onClick={() => setDemoToggle(!demoToggle)} ></div>
				<Link to="#" className="dz-demo-trigger" onClick={() => setDemoToggle(!demoToggle)}>
					<span><i className="las la-tint"></i></span>
				</Link>
			<div className="dz-demo-inner">
				<div className="dz-demo-header">
					<h3 className="text-white">Select Preset Demo</h3>
					<Link to={"#"} className="dz-demo-close" onClick={() => setDemoToggle(!demoToggle)} ><span><i className="las la-times"></i></span></Link>
				</div>
				<PerfectScrollbar  className="dz-demo-content ps ps--active-y">
					<div className="dz-wrapper ">
							
							<div className="overlay-bx rounded-lg dz-demo-bx demo-active">
								<div className="overlay-wrapper rounded-lg">
									<img src={demo1} alt="" className="w-100" />
								</div>
								<div className="overlay-layer">
									<Link to={"#"}  onClick={() => setDemoTheme(1,'ltr')} data-theme="1" className="btn dz_theme_demo btn-secondary btn-sm me-2">Default</Link>
								</div>
							</div>
							<h5 className="text-black">Demo 1</h5>
							<div className="overlay-bx rounded-lg dz-demo-bx">
								<div className="overlay-wrapper rounded-lg"><img src={demo2} alt="" className="w-100" /></div>
									<div className="overlay-layer">
										<Link to={"#"}  onClick={() => setDemoTheme(2,'ltr')} data-theme="2" className="btn dz_theme_demo btn-secondary btn-sm me-2">Default</Link>
									</div>
								</div>
							<h5 className="text-black">Demo 2</h5>
							<div className="overlay-bx rounded-lg dz-demo-bx">
								<div className="overlay-wrapper rounded-lg"><img src={demo3} alt="" className="w-100" /></div>
									<div className="overlay-layer">
										<Link to={"#"}  onClick={() => setDemoTheme(3,'ltr')} data-theme="3" className="btn dz_theme_demo btn-secondary btn-sm me-2">Default</Link>
									</div>
								</div>
							<h5 className="text-black">Demo 3</h5>
							<div className="overlay-bx rounded-lg dz-demo-bx">
								<div className="overlay-wrapper rounded-lg"><img src={demo4} alt="" className="w-100" /></div>
								<div className="overlay-layer">
									<Link to={"#"}  onClick={() => setDemoTheme(4,'ltr')} data-theme="4" className="btn dz_theme_demo btn-secondary btn-sm me-2">Default</Link>
								</div>
							</div>
							<h5 className="text-black">Demo 4</h5>				
							<div className="overlay-bx rounded-lg dz-demo-bx">
								<div className="overlay-wrapper rounded-lg"><img src={demo5} alt="" className="w-100" /></div>
								<div className="overlay-layer">
									<Link to={"#"}  onClick={() => setDemoTheme(5,'ltr')} data-theme="5" className="btn dz_theme_demo btn-secondary btn-sm me-2">Default</Link>
								</div>
							</div>
							<h5 className="text-black">Demo 5</h5>						
					
					</div>
				</PerfectScrollbar>	
				<div className="fs-12 pt-3">
					<span className="text-danger">*Note :</span>
					This theme switcher is not part of product. It is only for demo. you will get all guideline in documentation. please check 
					<Link to={"https://fasto.dexignzone.com/react/doc/"} className="fw-bold text-danger"> documentation.</Link>
				</div>
			</div>
		</div>
	</>
  );
};

export default Setting;


