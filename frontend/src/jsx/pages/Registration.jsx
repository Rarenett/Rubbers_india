import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { connect, useDispatch } from 'react-redux';

import {
	loadingToggleAction,
	signupAction,
} from '../../store/actions/AuthActions';

// image
import login from "../../images/reg-bg.jpg";

const getCachedCompanySettings = () => {
	try {
		return JSON.parse(localStorage.getItem('companySettings') || '{}');
	} catch {
		return {};
	}
};

function Register(props) {
	const [email, setEmail] = useState('');
	const [name, setName] = useState('');
	const [password, setPassword] = useState('');
	const [password2, setPassword2] = useState('');

	const cached = getCachedCompanySettings();
	const [companyLogo, setCompanyLogo] = useState(cached.logo || '');
	const [companyName, setCompanyName] = useState(cached.displayName || '');

	useEffect(() => {
		const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
		fetch(`${backendUrl}/api/settings/company/branding/`)
			.then(res => res.ok ? res.json() : null)
			.then(data => {
				if (data) {
					setCompanyLogo(data.logo || '');
					setCompanyName(data.display_name || '');
				}
			})
			.catch(() => {});
	}, []);

	let errorsObj = { email: '', name: '', password: '', password2: '' };
	const [errors, setErrors] = useState(errorsObj);

	const dispatch = useDispatch();
	const nav = useNavigate();

	function onSignUp(e) {
		e.preventDefault();
		let error = false;
		const errorObj = { ...errorsObj };

		if (name === '') {
			errorObj.name = 'Name is Required';
			error = true;
		}
		if (email === '') {
			errorObj.email = 'Email is Required';
			error = true;
		}
		if (password === '') {
			errorObj.password = 'Password is Required';
			error = true;
		}
		if (password2 === '') {
			errorObj.password2 = 'Password Confirmation is Required';
			error = true;
		}
		if (password !== password2) {
			errorObj.password2 = 'Passwords do not match';
			error = true;
		}

		setErrors(errorObj);

		if (error) return;
		dispatch(loadingToggleAction(true));

		dispatch(signupAction(email, password, name, password2, nav));
	}
	return (
		<div className="login-wrapper">

			<div className="login-aside-left" style={{ backgroundImage: "url(" + login + ")", }}>
				<Link to="/" className="login-logo" style={{ display: 'block' }}>
					{companyLogo ? (
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
									filter: 'brightness(0) invert(1)',
								}}
							/>
						</div>
					) : companyName ? (
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
					) : (
						<div style={{ minHeight: '56px' }} />
					)}
				</Link>
				<div className="login-description">
					<h2 className="text-white mb-4">Check the Status</h2>
					<p className="fs-12">It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters,</p>
					<ul className="social-icons mt-4">
						<li><Link to={"#"}><i className="fab fa-facebook-f"></i></Link></li>
						<li><Link to={"#"}><i className="fab fa-twitter"></i></Link></li>
						<li><Link to={"#"}><i className="fab fa-linkedin-in"></i></Link></li>
					</ul>
					<div className="mt-5">
						<Link to={"#"} className="text-white">Rarestorm 5.1 @ Rarenett Technologies</Link>
					</div>
				</div>
			</div>

			<div className="login-aside-right">
				<div className="row justify-content-center h-100 align-items-center">
					<div className="col-md-6">
						<div className="authincation-content">
							<div className="row no-gutters">

								<div className="col-xl-12">
									<div className="auth-form">
										<div className="mb-3">
											<h2 className=" text-center text-black">Sign up</h2>
										</div>
										<h4 className="text-center mb-5">Enter your details to create your account</h4>
										{props.errorMessage && (
											<div className='bg-red-300 text-red-900 border border-red-900 p-1 my-2'>
												{props.errorMessage}
											</div>
										)}
										{props.successMessage && (
											<div className='bg-green-300 text-green-900 border border-green-900 p-1 my-2'>
												{props.successMessage}
											</div>
										)}
										<form onSubmit={onSignUp}>
											<div className="form-group">
												<label className="mb-1 "><strong>Name</strong></label>
												<input
													type="text"
													className="form-control"
													placeholder="Full Name"
													value={name}
													onChange={(e) => setName(e.target.value)}
												/>
												{errors.name && <div className="text-danger fs-12">{errors.name}</div>}
											</div>
											<div className="form-group">
												<label className="mb-1 "> <strong>Email</strong></label>
												<input type="email" className="form-control"
													value={email}
													onChange={(e) => setEmail(e.target.value)}
												/>
												{errors.email && <div className="text-danger fs-12">{errors.email}</div>}
											</div>
											<div className="form-group">
												<label className="mb-1 "><strong>Password</strong></label>
												<input type="password" className="form-control"
													value={password}
													onChange={(e) =>
														setPassword(e.target.value)
													}
												/>
												{errors.password && <div className="text-danger fs-12">{errors.password}</div>}
											</div>
											<div className="form-group">
												<label className="mb-1 "><strong>Confirm Password</strong></label>
												<input type="password" className="form-control"
													value={password2}
													onChange={(e) =>
														setPassword2(e.target.value)
													}
												/>
												{errors.password2 && <div className="text-danger fs-12">{errors.password2}</div>}
											</div>
											<div className="text-center mt-4">
												<button type="submit" className="btn btn-primary btn-block">
													Sign up
												</button>
											</div>
										</form>
										<div className="new-account mt-3">
											<p className=""> Already have an account? <Link className="text-primary" to="/login">Sign in</Link></p>

										</div>
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

export default connect(mapStateToProps)(Register);

