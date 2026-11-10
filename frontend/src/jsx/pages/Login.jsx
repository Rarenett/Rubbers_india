import React, { useState, useEffect } from "react";
import { connect, useDispatch } from 'react-redux';
import { Link, useNavigate } from "react-router-dom";
import {
	loadingToggleAction,
	loginAction,
} from '../../store/actions/AuthActions';
// image
import login from "../../images/login-bg.jpg";

const getCachedCompanySettings = () => {
	try {
		return JSON.parse(localStorage.getItem('companySettings') || '{}');
	} catch {
		return {};
	}
};

function Login(props) {
	const [email, setEmail] = useState('');
	let errorsObj = { email: '', password: '' };
	const [errors, setErrors] = useState(errorsObj);
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);

	// Synchronously initialize from cached settings to eliminate any flash of unbranded / default content
	const cached = getCachedCompanySettings();
	const [companyLogo, setCompanyLogo] = useState(cached.logo || '');
	const [companyName, setCompanyName] = useState(cached.displayName || '');
	const [loginPanelColor, setLoginPanelColor] = useState(cached.loginPanelColor || '#0a500f');
	const [companyDescription, setCompanyDescription] = useState(cached.description || '');
	const [companyVision, setCompanyVision] = useState(cached.vision || '');
	const [companyMission, setCompanyMission] = useState(cached.mission || '');
	const [brandingLoaded, setBrandingLoaded] = useState(Boolean(cached.logo || cached.displayName));

	// Load company branding — fetch from public API so any browser gets the correct colour
	useEffect(() => {
		const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
		fetch(`${backendUrl}/api/settings/company/branding/`)
			.then(res => res.ok ? res.json() : null)
			.then(data => {
				if (data) {
					setCompanyLogo(data.logo || '');
					setCompanyName(data.display_name || '');
					setLoginPanelColor(data.login_panel_color || '#0a500f');
					setCompanyDescription(data.description || '');
					setCompanyVision(data.vision || '');
					setCompanyMission(data.mission || '');
					// Keep localStorage in sync for instant render on subsequent visits
					const prev = getCachedCompanySettings();
					localStorage.setItem('companySettings', JSON.stringify({
						...prev,
						logo: data.logo || '',
						displayName: data.display_name || '',
						loginPanelColor: data.login_panel_color || '#0a500f',
						description: data.description || '',
						vision: data.vision || '',
						mission: data.mission || '',
						dateFormat: data.date_format || prev.dateFormat || 'DD/MM/YYYY',
						date_format: data.date_format || prev.date_format || 'DD/MM/YYYY',
					}));
				} else {
					// Fallback to cached localStorage value
					const settings = getCachedCompanySettings();
					setCompanyLogo(settings.logo || '');
					setCompanyName(settings.displayName || '');
					setLoginPanelColor(settings.loginPanelColor || '#0a500f');
					setCompanyDescription(settings.description || '');
					setCompanyVision(settings.vision || '');
					setCompanyMission(settings.mission || '');
				}
			})
			.catch(() => {
				// API unreachable — use cached value
				const settings = getCachedCompanySettings();
				setCompanyLogo(settings.logo || '');
				setCompanyName(settings.displayName || '');
				setLoginPanelColor(settings.loginPanelColor || '#0a500f');
				setCompanyDescription(settings.description || '');
				setCompanyVision(settings.vision || '');
				setCompanyMission(settings.mission || '');
			})
			.finally(() => {
				setBrandingLoaded(true);
			});
	}, []);

	const dispatch = useDispatch();
	const nav = useNavigate();
	function onLogin(e) {
		if (e) e.preventDefault();

		// Fallback to DOM input values if browser autofilled without triggering React onChange
		const emailEl = document.querySelector('input[type="email"]');
		const passwordEl = document.querySelector('input[name="password"]') || document.querySelector('input[type="password"]') || document.querySelector('input[type="text"][data-password="true"]');
		const formEmail = (email || emailEl?.value || '').trim();
		const formPassword = password || passwordEl?.value || '';

		let error = false;
		const errorObj = { ...errorsObj };
		if (!formEmail) {
			errorObj.email = 'Email is Required';
			error = true;
		}
		if (!formPassword) {
			errorObj.password = 'Password is Required';
			error = true;
		}
		setErrors(errorObj);
		if (error) {
			return;
		}
		dispatch(loadingToggleAction(true));
		dispatch(loginAction(formEmail, formPassword, nav));
	}

	return (
		<div className="login-wrapper">
				{/* Dynamic colour for the left panel overlay */}
				<style>{`
					.login-wrapper .login-aside-left::after {
						background: linear-gradient(160deg,
							${loginPanelColor}f7 0%,
							${loginPanelColor} 50%,
							${loginPanelColor}e8 100%
						) !important;
					}
					.login-wrapper .login-aside-left {
						display: flex !important;
						flex-direction: column !important;
						justify-content: space-between !important;
						min-height: 100vh;
						box-sizing: border-box;
					}
					.login-wrapper .login-aside-left .login-logo {
						position: relative !important;
						top: auto !important;
						left: auto !important;
						display: inline-block !important;
						margin-bottom: 32px !important;
					}
					.login-wrapper .login-aside-left .login-description {
						display: block !important;
						padding-bottom: 0 !important;
					}
				`}</style>
			<div className="login-aside-left" style={{ backgroundImage: "url(" + login + ")" }}>
				<div>
					<Link
						to="/"
						className="login-logo"
						style={{
							position: 'relative',
							display: 'inline-block',
							marginBottom: '32px',
						}}
					>
						{companyLogo ? (
							/* Company has uploaded a logo */
							<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
								<img
									src={companyLogo}
									alt={companyName || 'Logo'}
									style={{
										maxHeight: '56px',
										maxWidth: '200px',
										width: 'auto',
										height: 'auto',
										objectFit: 'contain',
										filter: 'brightness(0) invert(1)', // make it white to contrast blue bg
									}}
								/>
							</div>
						) : companyName ? (
							/* Company name only — no logo uploaded */
							<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
								<div style={{
									width: 48, height: 48,
									borderRadius: 12,
									background: 'rgba(255,255,255,0.2)',
									display: 'flex', alignItems: 'center', justifyContent: 'center',
									fontSize: '1.4rem', fontWeight: 800, color: '#fff',
									flexShrink: 0,
								}}>
									{companyName.charAt(0).toUpperCase()}
								</div>
								<span style={{
									color: '#fff',
									fontSize: '1.4rem',
									fontWeight: 700,
									letterSpacing: '-0.01em',
								}}>
									{companyName}
								</span>
							</div>
						) : brandingLoaded ? (
							/* Neutral fallback when branding is loaded but neither logo nor company name is set */
							<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
								<span style={{
									color: '#fff',
									fontSize: '1.4rem',
									fontWeight: 700,
									letterSpacing: '0.05em',
								}}>
									ERP
								</span>
							</div>
						) : (
							/* Still loading branding — maintain layout height with no flash of template logo */
							<div style={{ minHeight: '56px' }} />
						)}
					</Link>

					{/* Vision & Mission section in empty space below company logo */}
					{(companyVision || companyMission) && (
						<div
							className="login-vision-mission"
							style={{
								marginTop: '8px',
								display: 'flex',
								flexDirection: 'column',
								gap: '16px',
							}}
						>
							{companyVision && (
								<div
									style={{
										background: 'rgba(255, 255, 255, 0.09)',
										backdropFilter: 'blur(10px)',
										WebkitBackdropFilter: 'blur(10px)',
										border: '1px solid rgba(255, 255, 255, 0.18)',
										borderRadius: '14px',
										padding: '16px 18px',
										boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
									}}
								>
									<div
										style={{
											display: 'flex',
											alignItems: 'center',
											gap: '8px',
											marginBottom: '8px',
										}}
									>
										<div
											style={{
												width: '26px',
												height: '26px',
												borderRadius: '7px',
												background: 'rgba(56, 189, 248, 0.22)',
												color: '#38bdf8',
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'center',
												fontSize: '0.78rem',
											}}
										>
											<i className="fa fa-eye" />
										</div>
										<span
											style={{
												fontSize: '0.74rem',
												fontWeight: 700,
												letterSpacing: '0.08em',
												textTransform: 'uppercase',
												color: '#bae6fd',
											}}
										>
											Our Vision
										</span>
									</div>
									<p
										style={{
											fontSize: '0.84rem',
											lineHeight: '1.55',
											color: 'rgba(255, 255, 255, 0.92)',
											margin: 0,
											whiteSpace: 'pre-line',
										}}
									>
										{companyVision}
									</p>
								</div>
							)}

							{companyMission && (
								<div
									style={{
										background: 'rgba(255, 255, 255, 0.09)',
										backdropFilter: 'blur(10px)',
										WebkitBackdropFilter: 'blur(10px)',
										border: '1px solid rgba(255, 255, 255, 0.18)',
										borderRadius: '14px',
										padding: '16px 18px',
										boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
									}}
								>
									<div
										style={{
											display: 'flex',
											alignItems: 'center',
											gap: '8px',
											marginBottom: '8px',
										}}
									>
										<div
											style={{
												width: '26px',
												height: '26px',
												borderRadius: '7px',
												background: 'rgba(52, 211, 153, 0.22)',
												color: '#34d399',
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'center',
												fontSize: '0.78rem',
											}}
										>
											<i className="fa fa-bullseye" />
										</div>
										<span
											style={{
												fontSize: '0.74rem',
												fontWeight: 700,
												letterSpacing: '0.08em',
												textTransform: 'uppercase',
												color: '#a7f3d0',
											}}
										>
											Our Mission
										</span>
									</div>
									<p
										style={{
											fontSize: '0.84rem',
											lineHeight: '1.55',
											color: 'rgba(255, 255, 255, 0.92)',
											margin: 0,
											whiteSpace: 'pre-line',
										}}
									>
										{companyMission}
									</p>
								</div>
							)}
						</div>
					)}
				</div>

				<div className="login-description" style={{ paddingTop: '24px' }}>
					<p className="fs-12" style={{ whiteSpace: 'pre-line' }}>{companyDescription}</p>
					<div className="mt-4">
						<Link to={"#"} className="text-white">Rarestorm 5.1 @ Rarenett Technologies</Link>
					</div>
				</div>
			</div>
			<div className="login-aside-right">
				<div className="row m-0 justify-content-center h-100 align-items-center">
					<div className="col-xl-6 col-xxl-8">
						<div className="authincation-content">
							<div className="row no-gutters">
								<div className="col-xl-12">
									<div className="auth-form">
										<div className="mb-3">
											<div style={{ color: '#596882', fontSize: '1.2rem', fontWeight: 500, marginBottom: '2px' }}>
												Welcome to
											</div>
											<h1 style={{ color: '#0a500f', fontWeight: 700, margin: 0 }}>
												{companyName || 'ERP'}
											</h1>
										</div>
										<h6 className="mb-4">Sign in by entering information below</h6>
										{props.errorMessage && (
											<div className='text-danger mb-3'>
												{props.errorMessage}
											</div>
										)}
										{props.successMessage && (
											<div className='bg-green-300 text-green-900 border border-green-900 p-1 my-2'>
												{props.successMessage}
											</div>
										)}
										<form onSubmit={onLogin}>
											<div className="form-group mb-3">
												<label className="mb-2">
													<strong>Email</strong>
												</label>
												<input
													type="email"
													name="email"
													className="form-control"
													value={email}
													onChange={(e) => setEmail(e.target.value)}
													onKeyDown={(e) => { if (e.key === 'Enter') onLogin(e); }}
												/>
												{errors.email && <div className="text-danger fs-12">{errors.email}</div>}
											</div>
											<div className="form-group mb-3">
												<label className="mb-2"><strong>Password</strong></label>
												<div className="position-relative">
													<input
														type={showPassword ? "text" : "password"}
														name="password"
														data-password="true"
														className="form-control"
														value={password}
														onChange={(e) => setPassword(e.target.value)}
														onKeyDown={(e) => { if (e.key === 'Enter') onLogin(e); }}
													/>
													<span
														className={`fa fa-eye${showPassword ? '-slash' : ''} position-absolute text-muted`}
														style={{ top: '50%', right: '15px', transform: 'translateY(-50%)', cursor: 'pointer' }}
														onClick={() => setShowPassword(!showPassword)}
													></span>
												</div>
												{errors.password && <div className="text-danger fs-12">{errors.password}</div>}
											</div>
											<div className="text-center mt-4">
												<button
													type="submit"
													onClick={onLogin}
													disabled={props.showLoading}
													className="btn btn-block"
													style={{
														background: 'linear-gradient(135deg, #073d0b 0%, #0a500f 60%, #126818 100%)',
														border: 'none',
														color: '#fff',
														fontWeight: 600,
														fontSize: '1.1rem',
														padding: '12px 24px',
														letterSpacing: '0.04em',
														boxShadow: '0 4px 15px rgba(10,80,15,0.4)',
														cursor: props.showLoading ? 'not-allowed' : 'pointer',
														opacity: props.showLoading ? 0.75 : 1
													}}
												>
													{props.showLoading ? 'Signing In...' : 'Sign In'}
												</button>
											</div>
										</form>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

const mapStateToProps = (state) => {
	return {
		errorMessage: state.auth.errorMessage,
		successMessage: state.auth.successMessage,
		showLoading: state.auth.showLoading,
	};
};
export default connect(mapStateToProps)(Login);
