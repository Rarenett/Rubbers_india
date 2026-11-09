import React, { useState } from 'react';
import { Modal, Form } from 'react-bootstrap';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import swal from 'sweetalert';
import axiosInstance from '../../../services/AxiosInstance';
import { Logout } from '../../../store/actions/AuthActions';

const API_BASE = '/api';

const ChangePasswordModal = ({ show, onHide }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const validate = () => {
        const errs = {};
        if (!newPassword) {
            errs.newPassword = 'New password is required.';
        } else if (newPassword.length < 8) {
            errs.newPassword = 'Password must be at least 8 characters.';
        } else if (!/[a-zA-Z]/.test(newPassword)) {
            errs.newPassword = 'Password must include at least one letter.';
        } else if (!/[0-9]/.test(newPassword)) {
            errs.newPassword = 'Password must include at least one number.';
        } else if (!/[^A-Za-z0-9]/.test(newPassword)) {
            errs.newPassword = 'Password must include at least one special character.';
        }
        if (!confirmPassword) errs.confirmPassword = 'Please confirm your password.';
        else if (newPassword !== confirmPassword) errs.confirmPassword = 'Passwords do not match.';
        return errs;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }
        setErrors({});

        try {
            setLoading(true);
            await axiosInstance.post(
                `${API_BASE}/auth/change-password/`,
                { new_password: newPassword, confirm_password: confirmPassword }
            );

            await swal('Password Changed!', 'Your password has been updated. Please log in again.', 'success');

            // Reset form & close modal
            setNewPassword('');
            setConfirmPassword('');
            onHide();

            // Logout the user
            dispatch(Logout(navigate));
        } catch (err) {
            console.error('Change password failed:', err);

            let msg = 'Failed to change password. Please try again.';

            if (!err?.response) {
                // No response reached the browser at all (network/CORS/server down)
                msg = 'Could not reach the server. Please check your connection and try again.';
            } else {
                const data = err.response.data;
                const status = err.response.status;

                if (typeof data === 'string' && data.trim()) {
                    msg = data;
                } else if (data?.error) {
                    msg = data.error;
                } else if (data?.detail) {
                    // DRF's default shape for auth/permission failures
                    msg = data.detail;
                } else if (data?.message) {
                    msg = data.message;
                } else if (data?.non_field_errors?.length) {
                    msg = data.non_field_errors.join(' ');
                } else if (data && typeof data === 'object') {
                    // Field-level validation errors, e.g. { new_password: ["..."] }
                    const firstKey = Object.keys(data)[0];
                    const firstVal = data[firstKey];
                    if (firstVal) {
                        msg = Array.isArray(firstVal) ? firstVal[0] : String(firstVal);
                    }
                } else if (status === 401 || status === 403) {
                    msg = 'Your session has expired. Please log in again.';
                }
            }

            swal('Error', msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setNewPassword('');
        setConfirmPassword('');
        setErrors({});
        onHide();
    };

    // Simple password strength heuristic (0-4)
    const getStrength = (pw) => {
        if (!pw) return 0;
        let score = 0;
        if (pw.length >= 8) score++;
        if (pw.length >= 12) score++;
        if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
        if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
        return score;
    };
    const strength = getStrength(newPassword);
    const strengthMeta = [
        { label: '', color: '#e2e8f0' },
        { label: 'Weak', color: '#ef4444' },
        { label: 'Fair', color: '#f59e0b' },
        { label: 'Good', color: '#3b82f6' },
        { label: 'Strong', color: '#22c55e' },
    ][strength];

    return (
        <Modal show={show} onHide={handleClose} centered className="cp-modal" backdropClassName="cp-backdrop">
            <style>{`
                .cp-backdrop.show { opacity: 0.55; }

                .cp-modal .modal-dialog {
                    max-width: 480px;
                }

                .cp-modal .modal-content {
                    border-radius: 20px;
                    border: none;
                    overflow: hidden;
                    box-shadow: 0 20px 60px rgba(15, 23, 42, 0.25);
                    animation: cp-pop 0.22s ease-out;
                }
                @keyframes cp-pop {
                    from { opacity: 0; transform: translateY(8px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                .cp-header {
                    padding: 32px 36px 22px;
                    border-bottom: 1px solid #eef1f6;
                    position: relative;
                }
                .cp-header-row {
                    display: flex;
                    align-items: flex-start;
                    gap: 14px;
                }
                .cp-icon-badge {
                    flex-shrink: 0;
                    width: 44px; height: 44px;
                    border-radius: 12px;
                    background: linear-gradient(135deg, #6C5DD3 0%, #4A3FBF 100%);
                    display: flex; align-items: center; justify-content: center;
                    color: #fff;
                    box-shadow: 0 6px 16px rgba(108, 93, 211, 0.35);
                }
                .cp-header-text { padding-top: 2px; padding-right: 34px; }
                .cp-title {
                    font-size: 19px;
                    font-weight: 700;
                    color: #0f172a;
                    letter-spacing: -0.01em;
                    margin: 0 0 4px;
                }
                .cp-subtitle {
                    font-size: 13.5px;
                    color: #64748b;
                    margin: 0;
                    line-height: 1.5;
                }
                .cp-close {
                    position: absolute; top: 22px; right: 22px;
                    width: 30px; height: 30px;
                    border-radius: 8px;
                    border: none;
                    background: #f1f5f9;
                    color: #64748b;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 13px;
                    cursor: pointer;
                    transition: background-color 0.15s, color 0.15s;
                }
                .cp-close:hover { background: #e2e8f0; color: #334155; }

                .cp-body { padding: 24px 36px 6px; }

                .cp-modal .form-label {
                    font-weight: 600;
                    font-size: 12.5px;
                    color: #334155;
                    letter-spacing: 0.01em;
                    margin-bottom: 6px;
                }
                .cp-pass-wrapper { position: relative; }
                .cp-pass-wrapper .cp-lock-icon {
                    position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
                    color: #94a3b8; font-size: 13px; pointer-events: none;
                }
                .cp-input {
                    border-radius: 10px;
                    border: 1.5px solid #e2e8f0;
                    background: #f8fafc;
                    padding: 11px 40px 11px 36px;
                    font-size: 14px;
                    width: 100%;
                    outline: none;
                    transition: border-color 0.15s, background-color 0.15s, box-shadow 0.15s;
                    box-sizing: border-box;
                    color: #0f172a;
                }
                .cp-input::placeholder { color: #b0b9c6; }
                .cp-input:focus {
                    border-color: #6C5DD3;
                    background: #fff;
                    box-shadow: 0 0 0 3.5px rgba(108, 93, 211, 0.12);
                }
                .cp-input.is-invalid { border-color: #ef4444; background: #fff5f5; }
                .cp-input.is-invalid:focus { box-shadow: 0 0 0 3.5px rgba(239, 68, 68, 0.12); }

                .cp-pass-toggle {
                    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
                    cursor: pointer; color: #94a3b8; font-size: 14px;
                    background: none; border: none; padding: 2px;
                    display: flex; align-items: center;
                    transition: color 0.15s;
                }
                .cp-pass-toggle:hover { color: #475569; }

                .cp-error-msg {
                    font-size: 12px; color: #ef4444; margin-top: 6px;
                    display: flex; align-items: center; gap: 5px;
                }

                .cp-strength-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
                .cp-strength-track {
                    flex: 1; height: 4px; border-radius: 2px; background: #eef1f6; overflow: hidden;
                }
                .cp-strength-fill {
                    height: 100%; border-radius: 2px; transition: width 0.25s ease, background-color 0.25s ease;
                }
                .cp-strength-label { font-size: 11.5px; font-weight: 600; min-width: 40px; text-align: right; }

                .cp-hint {
                    font-size: 12px; color: #94a3b8; margin: 10px 0 2px;
                    display: flex; align-items: center; gap: 6px;
                }

                .cp-footer {
                    border: none;
                    padding: 22px 36px 30px;
                    display: flex; justify-content: flex-end; gap: 10px;
                }
                .cp-btn-cancel {
                    background-color: #fff; color: #475569; border-radius: 10px;
                    font-weight: 600; font-size: 13.5px; padding: 10px 20px;
                    border: 1.5px solid #e2e8f0; cursor: pointer; transition: all 0.15s;
                }
                .cp-btn-cancel:hover { background-color: #f8fafc; border-color: #cbd5e1; }
                .cp-btn-save {
                    background: linear-gradient(135deg, #6C5DD3 0%, #4A3FBF 100%);
                    color: white; border-radius: 10px;
                    font-weight: 600; font-size: 13.5px; padding: 10px 22px;
                    border: none; cursor: pointer; transition: filter 0.15s, transform 0.1s;
                    box-shadow: 0 6px 16px rgba(108, 93, 211, 0.3);
                }
                .cp-btn-save:hover:not(:disabled) { filter: brightness(1.08); }
                .cp-btn-save:active:not(:disabled) { transform: translateY(1px); }
                .cp-btn-save:disabled { opacity: 0.7; cursor: not-allowed; box-shadow: none; }
            `}</style>

            <div className="cp-header">
                <button type="button" className="cp-close" onClick={handleClose} aria-label="Close">
                    <i className="fa fa-times"></i>
                </button>
                <div className="cp-header-row">
                    <div className="cp-icon-badge">
                        <i className="fa fa-lock" style={{ fontSize: 18 }}></i>
                    </div>
                    <div className="cp-header-text">
                        <p className="cp-title">Change your password</p>
                        <p className="cp-subtitle">Choose a strong password you haven't used before. You'll be signed out after this change.</p>
                    </div>
                </div>
            </div>

            <Form onSubmit={handleSubmit}>
                <div className="cp-body">
                    {/* New Password */}
                    <Form.Group className="mb-3">
                        <Form.Label>New password</Form.Label>
                        <div className="cp-pass-wrapper">
                            <i className="fa fa-lock cp-lock-icon"></i>
                            <input
                                type={showNew ? 'text' : 'password'}
                                placeholder="Enter new password"
                                value={newPassword}
                                onChange={e => { setNewPassword(e.target.value); setErrors(p => ({ ...p, newPassword: '' })); }}
                                className={`cp-input${errors.newPassword ? ' is-invalid' : ''}`}
                                autoComplete="new-password"
                            />
                            <button type="button" className="cp-pass-toggle" onClick={() => setShowNew(p => !p)} tabIndex={-1}>
                                <i className={`fa ${showNew ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                        {newPassword && (
                            <div className="cp-strength-row">
                                <div className="cp-strength-track">
                                    <div
                                        className="cp-strength-fill"
                                        style={{ width: `${strength * 25}%`, backgroundColor: strengthMeta.color }}
                                    />
                                </div>
                                <span className="cp-strength-label" style={{ color: strengthMeta.color }}>
                                    {strengthMeta.label}
                                </span>
                            </div>
                        )}
                        {errors.newPassword && (
                            <div className="cp-error-msg"><i className="fa fa-exclamation-circle"></i>{errors.newPassword}</div>
                        )}
                    </Form.Group>

                    {/* Confirm Password */}
                    <Form.Group className="mb-2">
                        <Form.Label>Confirm password</Form.Label>
                        <div className="cp-pass-wrapper">
                            <i className="fa fa-lock cp-lock-icon"></i>
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                placeholder="Re-enter new password"
                                value={confirmPassword}
                                onChange={e => { setConfirmPassword(e.target.value); setErrors(p => ({ ...p, confirmPassword: '' })); }}
                                className={`cp-input${errors.confirmPassword ? ' is-invalid' : ''}`}
                                autoComplete="new-password"
                            />
                            <button type="button" className="cp-pass-toggle" onClick={() => setShowConfirm(p => !p)} tabIndex={-1}>
                                <i className={`fa ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                        {errors.confirmPassword && (
                            <div className="cp-error-msg"><i className="fa fa-exclamation-circle"></i>{errors.confirmPassword}</div>
                        )}
                    </Form.Group>

                    <p className="cp-hint"><i className="fa fa-info-circle"></i>Use at least 8 characters, including a letter, a number, and a special character.</p>
                </div>

                <div className="cp-footer">
                    <button type="button" className="cp-btn-cancel" onClick={handleClose}>Cancel</button>
                    <button type="submit" className="cp-btn-save" disabled={loading}>
                        {loading
                            ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                            : 'Save password'}
                    </button>
                </div>
            </Form>
        </Modal>
    );
};

export default ChangePasswordModal;