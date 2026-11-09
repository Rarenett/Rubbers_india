import Swal from 'sweetalert2';
import {
    formatError,
    login,
    logoutService,
    runLogoutTimer,
    saveTokenInLocalStorage,
    signUp,
} from '../../services/AuthService';


export const SIGNUP_CONFIRMED_ACTION = '[signup action] confirmed signup';
export const SIGNUP_FAILED_ACTION = '[signup action] failed signup';
export const LOGIN_CONFIRMED_ACTION = '[login action] confirmed login';
export const LOGIN_FAILED_ACTION = '[login action] failed login';
export const LOADING_TOGGLE_ACTION = '[Loading action] toggle loading';
export const LOGOUT_ACTION = '[Logout action] logout action';
export const NAVTOGGLE = 'NAVTOGGLE';


export function signupAction(email, password, name, password2, navigate) {

    return (dispatch) => {
        signUp(email, password, name, password2)
            .then((response) => {
                saveTokenInLocalStorage(response.data);
                runLogoutTimer(
                    dispatch,
                    24 * 60 * 60 * 1000, // 24 hours in milliseconds
                    navigate,
                );
                dispatch(confirmedSignupAction(response.data));

                // Force a full page reload to ensure auth state is properly loaded
                window.location.href = '/dashboard';
            })
            .catch((error) => {
                const errorMessage = formatError(error.response?.data || error.message);
                dispatch(signupFailedAction(errorMessage));
            });
    };
}

export function Logout(navigate) {
    return (dispatch) => {
        logoutService().finally(() => {
            localStorage.removeItem('userDetails');
            if (navigate) navigate('/login');
            dispatch({ type: LOGOUT_ACTION });
        });
    };
}

export function loginAction(email, password, navigate, forceLogout = false) {
    return (dispatch) => {
        dispatch(loadingToggleAction(true));
        return login(email, password, forceLogout)
            .then((response) => {
                // 1. Save token first — this is the critical step
                saveTokenInLocalStorage(response.data);

                // 2. Compute redirect target
                let targetUrl = '/dashboard';
                try {
                    const redirectPath = localStorage.getItem('redirect_after_login');
                    const redirectEmail = localStorage.getItem('redirect_user_email');
                    localStorage.removeItem('redirect_after_login');
                    localStorage.removeItem('redirect_user_email');

                    const loggedInEmail = response.data?.user?.email || email || '';
                    const userObj = response.data?.user || {};
                    const rawCustomerType = 
                        userObj.designation ||
                        userObj.customer_type ||
                        userObj.customer_info?.customer_type ||
                        userObj.role?.name ||
                        userObj.role_name ||
                        '';
                    
                    const customerType = String(rawCustomerType).toLowerCase().trim();

                    const isDriver = 
                        userObj.is_driver ||
                        (userObj.designation && String(userObj.designation).toLowerCase().includes('driver')) ||
                        (userObj.role?.name && String(userObj.role.name).toLowerCase().includes('driver')) ||
                        (userObj.role_name && String(userObj.role_name).toLowerCase().includes('driver')) ||
                        customerType === 'driver';

                    const defaultDashboard = userObj.role?.assigned_dashboards?.find(d => d.is_default);
                    const firstDashboard = userObj.role?.assigned_dashboards?.[0];
                    let roleTargetUrl = defaultDashboard ? defaultDashboard.route : (firstDashboard ? firstDashboard.route : null);
                    if (roleTargetUrl && !roleTargetUrl.startsWith('/')) {
                        roleTargetUrl = '/' + roleTargetUrl;
                    }

                    const isGenericRedirect = !redirectPath || redirectPath === '/' || redirectPath === '/dashboard' || redirectPath === '/dashboard/' || redirectPath === '/login' || redirectPath === '/login/';

                    if (roleTargetUrl && isGenericRedirect) {
                        targetUrl = roleTargetUrl;
                    } else if (
                        redirectPath &&
                        !isGenericRedirect &&
                        (!redirectEmail || (loggedInEmail && redirectEmail.trim().toLowerCase() === loggedInEmail.trim().toLowerCase()))
                    ) {
                        targetUrl = redirectPath;
                    } else if (roleTargetUrl) {
                        targetUrl = roleTargetUrl;
                    } else if (customerType === 'distributor') {
                        targetUrl = '/distributor-orders';
                    } else if (isDriver) {
                        targetUrl = '/driver-operations';
                    }

                    if (targetUrl && !targetUrl.startsWith('/')) {
                        targetUrl = '/' + targetUrl;
                    }

                    console.log("Login Redirect Debug ->", { userObj, customerType, isDriver, targetUrl });
                    localStorage.setItem('login_debug_info', JSON.stringify({ userObj, customerType, isDriver, targetUrl }));
                } catch (e) {
                    console.error("Login Redirect Error ->", e);
                    localStorage.setItem('login_debug_error', e.toString());
                    // Ignore — fall back to /dashboard
                }

                // 3. Optional setup — errors here must not block the redirect
                try {
                    runLogoutTimer(dispatch, 24 * 60 * 60 * 1000, navigate);
                    dispatch(loginConfirmedAction(response.data));
                } catch (e) {
                    // Ignore — token is saved, redirect will re-initialise the app
                }

                // 4. Always redirect — full page reload to flush stale state
                window.location.href = targetUrl;
            })
            .catch((error) => {
                dispatch(loadingToggleAction(false));

                // Handle active-session conflict (409)
                const resData = error.response?.data;
                if (error.response && error.response.status === 409 && resData?.active_session) {
                    Swal.fire({
                        title: 'Active Session Detected',
                        html: `<strong>${email}</strong> is already logged in on another system.<br/><br/>Would you like to logout the other system and log in here?`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#d33',
                        cancelButtonColor: '#3085d6',
                        confirmButtonText: 'Yes, Logout Other System & Login Here',
                        cancelButtonText: 'Cancel'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            dispatch(loginAction(email, password, navigate, true));
                        }
                    });
                    return;
                }

                // Show error for HTTP failures from server
                if (error.response) {
                    const errorMessage = formatError(resData || error.message);
                    dispatch(loginFailedAction(errorMessage));
                } else {
                    // Network / CORS / Mixed-content error
                    Swal.fire({
                        icon: 'error',
                        title: 'Connection Error',
                        text: error.message || 'Unable to connect to the backend server. Please verify network and CORS settings.',
                    });
                    dispatch(loginFailedAction(error.message || 'Unable to connect to server.'));
                }
            });
    };
}

export function loginFailedAction(data) {
    return {
        type: LOGIN_FAILED_ACTION,
        payload: data,
    };
}

export function loginConfirmedAction(data) {
    return {
        type: LOGIN_CONFIRMED_ACTION,
        payload: data,
    };
}

export function confirmedSignupAction(payload) {
    return {
        type: SIGNUP_CONFIRMED_ACTION,
        payload,
    };
}

export function signupFailedAction(message) {
    return {
        type: SIGNUP_FAILED_ACTION,
        payload: message,
    };
}

export function loadingToggleAction(status) {
    return {
        type: LOADING_TOGGLE_ACTION,
        payload: status,
    };
}
export const navtoggle = () => {
    return {
        type: 'NAVTOGGLE',
    };
};