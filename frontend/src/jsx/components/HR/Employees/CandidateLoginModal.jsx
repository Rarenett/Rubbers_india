import React, { useState, useEffect } from 'react';
import { Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { createUser, updateUser, getRoles } from '../../../../services/HRManagementService';

const CandidateLoginModal = ({ show, onHide, candidate, onSaved }) => {
    const [loginRequired, setLoginRequired] = useState(false);
    const [isActive, setIsActive] = useState(true);
    const [changePassword, setChangePassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [roleId, setRoleId] = useState('');
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [emailCopied, setEmailCopied] = useState(false);
    const [passCopied, setPassCopied] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Fetch roles once on mount
    useEffect(() => {
        getRoles()
            .then(data => setRoles(Array.isArray(data) ? data : (data.results || [])))
            .catch(() => {});
    }, []);

    const copyToClipboard = (text, setFn) => {
        navigator.clipboard.writeText(text).then(() => {
            setFn(true);
            setTimeout(() => setFn(false), 2000);
        });
    };

    useEffect(() => {
        if (show && candidate) {
            if (candidate.has_login && candidate.user_email) {
                // Already has credentials — pre-fill email, lock it, and sync active state
                setLoginRequired(true);
                setEmail(candidate.user_email);
                setIsActive(candidate.user_is_active !== false);
            } else {
                setLoginRequired(false);
                setEmail('');
                setIsActive(true);
            }
            setChangePassword(false);
            setPassword('');
            setRoleId('');
        }
    }, [show, candidate]);

    const getCompanyEmailDomain = () => {
        try {
            const settings = JSON.parse(localStorage.getItem('companySettings') || '{}');
            const rawName = settings.displayName || settings.display_name || settings.name || '';
            const cleanName = rawName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanName ? `@${cleanName}.com` : '@glenda.com';
        } catch {
            return '@glenda.com';
        }
    };

    const generateEmail = () => {
        if (!candidate) return;
        const fn = candidate.full_name || '';
        const parts = fn.split(' ');
        const domainSuffix = getCompanyEmailDomain();
        let generated = '';
        if (parts.length > 1) {
            generated = `${parts[0].toLowerCase()}.${parts[parts.length - 1].charAt(0).toLowerCase()}${domainSuffix}`;
        } else {
            generated = `${fn.toLowerCase()}${domainSuffix}`;
        }
        const randomNum = Math.floor(Math.random() * 1000);
        generated = generated.replace('@', `${randomNum}@`);
        setEmail(generated);
    };

    const generatePassword = () => {
        const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const lowers = 'abcdefghijkmnopqrstuvwxyz';
        const numbers = '23456789';
        const specials = '!@#$%^&*';
        const all = uppers + lowers + numbers + specials;

        const chars = [
            uppers[Math.floor(Math.random() * uppers.length)],
            lowers[Math.floor(Math.random() * lowers.length)],
            numbers[Math.floor(Math.random() * numbers.length)],
            specials[Math.floor(Math.random() * specials.length)],
        ];

        for (let i = 0; i < 8; i++) {
            chars.push(all[Math.floor(Math.random() * all.length)]);
        }

        for (let i = chars.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [chars[i], chars[j]] = [chars[j], chars[i]];
        }

        setPassword(chars.join(''));
    };

    const validateComplexity = (pwd) => {
        if (!pwd || pwd.length < 8) {
            return 'Password must be at least 8 characters long.';
        }
        if (!/[A-Z]/.test(pwd)) {
            return 'Password must contain at least one uppercase letter.';
        }
        if (!/[a-z]/.test(pwd)) {
            return 'Password must contain at least one lowercase letter.';
        }
        if (!/[0-9]/.test(pwd)) {
            return 'Password must contain at least one number.';
        }
        if (!/[^A-Za-z0-9]/.test(pwd)) {
            return 'Password must contain at least one special character (!@#$%^&*).';
        }
        return null;
    };

    const handleSave = async () => {
        if (!candidate?.has_login && !loginRequired) {
            onHide();
            return;
        }
        if (!candidate?.has_login && (!email || !password)) {
            Swal.fire('Error', 'Email and password are required to setup login.', 'warning');
            return;
        }
        if (!candidate?.has_login && password) {
            const complexityError = validateComplexity(password);
            if (complexityError) {
                Swal.fire('Weak Password', complexityError, 'warning');
                return;
            }
        }
        setLoading(true);
        try {
            if (candidate.has_login) {
                // Update existing user (active/inactive status, optional password change)
                const payload = {
                    is_active: isActive,
                    candidate_id: candidate.id,
                };
                if (changePassword) {
                    if (!password) {
                        Swal.fire('Password Required', 'Please enter or generate a new password, or turn off "Reset Password".', 'warning');
                        setLoading(false);
                        return;
                    }
                    const complexityError = validateComplexity(password);
                    if (complexityError) {
                        Swal.fire('Weak Password', complexityError, 'warning');
                        setLoading(false);
                        return;
                    }
                    payload.password = password;
                    payload.send_credentials_email = true;
                }
                await updateUser(candidate.user_id, payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: changePassword
                        ? 'Login access updated and new password sent via email.'
                        : `Login access ${isActive ? 'activated' : 'deactivated and blocked'} successfully.`,
                    timer: 2000,
                    showConfirmButton: false,
                });
            } else {
                // Create new login
                const nameParts = candidate.full_name ? candidate.full_name.split(' ') : ['User'];
                const firstName = nameParts[0];
                const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
                await createUser({
                    email,
                    username: email,
                    password,
                    first_name: firstName,
                    last_name: lastName,
                    candidate_id: candidate.id,
                    is_active: true,
                    ...(roleId ? { role_id: roleId } : {}),
                });
                Swal.fire({ icon: 'success', title: 'Success', text: 'Login credentials created successfully and email sent.', timer: 2000, showConfirmButton: false });
            }
            if (onSaved) onSaved();
            onHide();
        } catch (error) {
            const msg = error.response?.data
                ? (typeof error.response.data === 'string'
                    ? error.response.data
                    : Object.values(error.response.data).flat().join(' '))
                : 'Failed to update login access';
            Swal.fire({ icon: 'error', title: 'Error', text: msg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            show={show}
            onHide={onHide}
            centered
            dialogClassName="cfm-modal item-custom-modal"
            backdrop="static"
            keyboard={false}
        >
            <style>{`
                .cfm-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .cfm-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .cfm-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                }
                .cfm-modal .modal-close-x {
                    border: none;
                    background: transparent;
                    font-size: 24px;
                    color: #aaa;
                    cursor: pointer;
                    transition: color 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                }
                .cfm-modal .modal-close-x:hover { color: #555; }
                .cfm-modal .modal-body-custom { padding: 24px 28px; }
                .cfm-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .cfm-modal .btn-close-custom {
                    background-color: #7A70BA !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .cfm-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .cfm-modal .btn-save-custom {
                    background-color: #2ece8a !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .cfm-modal .btn-save-custom:hover { background-color: #26b277 !important; }
                .cfm-modal .btn-save-custom:disabled { opacity: 0.65; cursor: not-allowed; }
            `}</style>

            {/* Custom Header */}
            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <i className="fa fa-key" style={{ fontSize: '20px', color: '#fff' }}></i>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            Setup Login Access
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Configure login credentials for this employee.
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide}>&times;</button>
            </div>

            {/* Modal Body */}
            <div className="modal-body-custom">
                {/* Employee info */}
                <div className="mb-4 p-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div className="d-flex align-items-center gap-2">
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className="fa fa-user" style={{ color: '#0284c7', fontSize: '14px' }}></i>
                        </div>
                        <div>
                            <div className="fw-bold" style={{ fontSize: '14px', color: '#1e293b' }}>{candidate?.full_name || '-'}</div>
                            <div className="text-muted" style={{ fontSize: '12px' }}>{candidate?.email || '-'}</div>
                        </div>
                    </div>
                </div>

                {/* Login Access Status & Switch */}
                {candidate?.has_login ? (
                    <div
                        className="p-3 mb-4 rounded-3 d-flex align-items-center justify-content-between"
                        style={{
                            background: isActive ? '#f0fdf4' : '#fef2f2',
                            border: `1px solid ${isActive ? '#bbf7d0' : '#fecaca'}`,
                            transition: 'all 0.25s ease',
                        }}
                    >
                        <div className="d-flex align-items-center gap-3">
                            <div
                                style={{
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '50%',
                                    background: isActive ? '#dcfce7' : '#fee2e2',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: isActive ? '#16a34a' : '#dc2626',
                                    fontSize: '18px',
                                    flexShrink: 0,
                                    transition: 'all 0.25s ease',
                                }}
                            >
                                <i className={`fa ${isActive ? 'fa-user-check' : 'fa-user-slash'}`}></i>
                            </div>
                            <div>
                                <div className="d-flex align-items-center gap-2">
                                    <span className="fw-bold" style={{ fontSize: '14px', color: '#1e293b' }}>
                                        Login Access Status:
                                    </span>
                                    <span
                                        className="badge"
                                        style={{
                                            backgroundColor: isActive ? '#22c55e' : '#ef4444',
                                            color: '#fff',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            padding: '4px 10px',
                                            borderRadius: '12px',
                                        }}
                                    >
                                        {isActive ? 'Active' : 'Inactive (Blocked)'}
                                    </span>
                                </div>
                                <p className="text-muted mb-0 mt-1" style={{ fontSize: '12px' }}>
                                    {isActive
                                        ? 'Employee login is active. Toggle off to block their access immediately.'
                                        : 'Employee login is blocked. Toggle on to restore their access.'}
                                </p>
                            </div>
                        </div>
                        <div className="form-check form-switch m-0" style={{ transform: 'scale(1.3)', transformOrigin: 'right center' }}>
                            <input
                                className="form-check-input"
                                type="checkbox"
                                role="switch"
                                id="employee-active-toggle"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                style={{
                                    cursor: 'pointer',
                                    backgroundColor: isActive ? '#2ece8a' : undefined,
                                    borderColor: isActive ? '#2ece8a' : undefined,
                                }}
                            />
                        </div>
                    </div>
                ) : (
                    <Form.Group className="mb-4">
                        <Form.Check
                            type="checkbox"
                            id="login-required-checkbox"
                            label="Login Required"
                            checked={loginRequired}
                            onChange={(e) => setLoginRequired(e.target.checked)}
                            className="font-w600"
                        />
                    </Form.Group>
                )}

                {/* Credentials fields — shown only when checked or existing login */}
                {loginRequired && (
                    <>
                        {/* Role dropdown */}
                        {!candidate?.has_login && (
                            <Form.Group className="mb-4">
                                <Form.Label className="form-label font-w600">Role</Form.Label>
                                <Form.Select
                                    value={roleId}
                                    onChange={(e) => setRoleId(e.target.value)}
                                    style={{ height: '42px', borderRadius: '6px', fontSize: '13px' }}
                                >
                                    <option value="">— Select a role (optional) —</option>
                                    {roles.map(role => (
                                        <option key={role.id} value={role.id}>{role.name}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        )}
                        
                        {/* Email field */}
                        <Form.Group className="mb-4">
                            <Form.Label className="form-label font-w600">
                                Email <span className="text-danger">*</span>
                                {candidate?.has_login && (
                                    <span className="ms-2 badge" style={{ background: '#e0f2fe', color: '#0284c7', fontSize: '11px', fontWeight: 500, borderRadius: '4px', padding: '2px 7px' }}>Existing</span>
                                )}
                            </Form.Label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => !candidate?.has_login && setEmail(e.target.value)}
                                    placeholder="Enter or generate email"
                                    className="form-control"
                                    disabled={!!candidate?.has_login}
                                    style={{
                                        paddingRight: candidate?.has_login ? '12px' : '80px',
                                        background: candidate?.has_login ? '#f8fafc' : undefined,
                                        color: candidate?.has_login ? '#64748b' : undefined,
                                        cursor: candidate?.has_login ? 'not-allowed' : undefined,
                                    }}
                                />
                                {!candidate?.has_login && (
                                    <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard(email, setEmailCopied)}
                                            disabled={!email}
                                            title={emailCopied ? 'Copied!' : 'Copy'}
                                            style={{ border: 'none', background: 'none', padding: '0', lineHeight: 1, cursor: email ? 'pointer' : 'default', color: emailCopied ? '#22c55e' : '#b0b8c5', fontSize: '15px', transition: 'color 0.2s', opacity: email ? 1 : 0.35 }}
                                        >
                                            <i className={`fa ${emailCopied ? 'fa-check' : 'fa-copy'}`}></i>
                                        </button>
                                        <div style={{ width: '1px', height: '16px', background: '#e2e8f0' }}></div>
                                        <button
                                            type="button"
                                            onClick={generateEmail}
                                            title="Generate"
                                            style={{ border: 'none', background: 'none', padding: '0', lineHeight: 1, cursor: 'pointer', color: '#b0b8c5', fontSize: '14px', transition: 'color 0.2s' }}
                                            onMouseEnter={e => e.currentTarget.style.color = '#2ece8a'}
                                            onMouseLeave={e => e.currentTarget.style.color = '#b0b8c5'}
                                        >
                                            <i className="fa fa-magic"></i>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </Form.Group>

                        {/* Password handling: For existing users, show a toggleable Reset Password card to prevent accidental autofill or errors */}
                        {candidate?.has_login ? (
                            <div className="mb-4 p-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <div className="d-flex align-items-center justify-content-between">
                                    <div>
                                        <div className="fw-bold" style={{ fontSize: '13px', color: '#1e293b' }}>
                                            <i className="fa fa-key me-2 text-primary" style={{ fontSize: '12px' }}></i>Reset Password
                                        </div>
                                        <div className="text-muted" style={{ fontSize: '12px' }}>
                                            {changePassword
                                                ? 'Enter or generate a new temporary password for this employee.'
                                                : 'Existing password will remain unchanged.'}
                                        </div>
                                    </div>
                                    <div className="form-check form-switch m-0" style={{ transform: 'scale(1.2)', transformOrigin: 'right center' }}>
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            role="switch"
                                            id="change-password-toggle"
                                            checked={changePassword}
                                            onChange={(e) => {
                                                setChangePassword(e.target.checked);
                                                if (!e.target.checked) setPassword('');
                                            }}
                                            style={{
                                                cursor: 'pointer',
                                                backgroundColor: changePassword ? '#2ece8a' : undefined,
                                                borderColor: changePassword ? '#2ece8a' : undefined,
                                            }}
                                        />
                                    </div>
                                </div>

                                {changePassword && (
                                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid #e2e8f0' }}>
                                        <Form.Group className="mb-2">
                                            <Form.Label className="form-label font-w600" style={{ fontSize: '13px' }}>
                                                New Password <span className="text-danger">*</span>
                                            </Form.Label>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    placeholder="Enter or generate new password"
                                                    className="form-control"
                                                    autoComplete="new-password"
                                                    style={{ paddingRight: '110px' }}
                                                />
                                                <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        title={showPassword ? 'Hide password' : 'Show password'}
                                                        style={{ border: 'none', background: 'none', padding: '0', lineHeight: 1, cursor: 'pointer', color: '#b0b8c5', fontSize: '15px', transition: 'color 0.2s' }}
                                                    >
                                                        <i className={`fa ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                                    </button>
                                                    <div style={{ width: '1px', height: '16px', background: '#e2e8f0' }}></div>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyToClipboard(password, setPassCopied)}
                                                        disabled={!password}
                                                        title={passCopied ? 'Copied!' : 'Copy'}
                                                        style={{ border: 'none', background: 'none', padding: '0', lineHeight: 1, cursor: password ? 'pointer' : 'default', color: passCopied ? '#22c55e' : '#b0b8c5', fontSize: '15px', transition: 'color 0.2s', opacity: password ? 1 : 0.35 }}
                                                    >
                                                        <i className={`fa ${passCopied ? 'fa-check' : 'fa-copy'}`}></i>
                                                    </button>
                                                    <div style={{ width: '1px', height: '16px', background: '#e2e8f0' }}></div>
                                                    <button
                                                        type="button"
                                                        onClick={generatePassword}
                                                        title="Generate strong password"
                                                        style={{ border: 'none', background: 'none', padding: '0', lineHeight: 1, cursor: 'pointer', color: '#b0b8c5', fontSize: '14px', transition: 'color 0.2s' }}
                                                        onMouseEnter={e => e.currentTarget.style.color = '#2ece8a'}
                                                        onMouseLeave={e => e.currentTarget.style.color = '#b0b8c5'}
                                                    >
                                                        <i className="fa fa-magic"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        </Form.Group>
                                        <small className="text-muted" style={{ fontSize: '11px' }}>
                                            Must be at least 8 characters with uppercase, lowercase, number, and special character.
                                        </small>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Form.Group className="mb-4">
                                <Form.Label className="form-label font-w600">
                                    Password <span className="text-danger">*</span>
                                </Form.Label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter or generate password"
                                        className="form-control"
                                        autoComplete="new-password"
                                        style={{ paddingRight: '110px' }}
                                    />
                                    <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            title={showPassword ? 'Hide password' : 'Show password'}
                                            style={{ border: 'none', background: 'none', padding: '0', lineHeight: 1, cursor: 'pointer', color: '#b0b8c5', fontSize: '15px', transition: 'color 0.2s' }}
                                        >
                                            <i className={`fa ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                        </button>
                                        <div style={{ width: '1px', height: '16px', background: '#e2e8f0' }}></div>
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard(password, setPassCopied)}
                                            disabled={!password}
                                            title={passCopied ? 'Copied!' : 'Copy'}
                                            style={{ border: 'none', background: 'none', padding: '0', lineHeight: 1, cursor: password ? 'pointer' : 'default', color: passCopied ? '#22c55e' : '#b0b8c5', fontSize: '15px', transition: 'color 0.2s', opacity: password ? 1 : 0.35 }}
                                        >
                                            <i className={`fa ${passCopied ? 'fa-check' : 'fa-copy'}`}></i>
                                        </button>
                                        <div style={{ width: '1px', height: '16px', background: '#e2e8f0' }}></div>
                                        <button
                                            type="button"
                                            onClick={generatePassword}
                                            title="Generate strong password"
                                            style={{ border: 'none', background: 'none', padding: '0', lineHeight: 1, cursor: 'pointer', color: '#b0b8c5', fontSize: '14px', transition: 'color 0.2s' }}
                                            onMouseEnter={e => e.currentTarget.style.color = '#2ece8a'}
                                            onMouseLeave={e => e.currentTarget.style.color = '#b0b8c5'}
                                        >
                                            <i className="fa fa-magic"></i>
                                        </button>
                                    </div>
                                </div>
                                <small className="text-muted mt-1 d-block" style={{ fontSize: '11px' }}>
                                    Must be at least 8 characters with uppercase, lowercase, number, and special character.
                                </small>
                            </Form.Group>
                        )}
                    </>
                )}


            </div>

            {/* Custom Footer */}
            <div className="modal-footer-custom">
                <button type="button" className="btn-close-custom" onClick={onHide}>
                    Cancel
                </button>
                <button
                    type="button"
                    className="btn-save-custom"
                    onClick={handleSave}
                    disabled={loading}
                >
                    {loading ? (
                        <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                    ) : (
                        candidate?.has_login ? 'Save Changes' : 'Save'
                    )}
                </button>
            </div>
        </Modal>
    );
};

export default CandidateLoginModal;
