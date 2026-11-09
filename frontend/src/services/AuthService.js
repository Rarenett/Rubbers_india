import swal from "sweetalert";
import axiosInstance from './AxiosInstance';
import {
    loginConfirmedAction,
    Logout,
} from '../store/actions/AuthActions';

// Backend API auth base path
const AUTH_URL = '/api/auth';

export function signUp(email, password, name, password2) {
    const postData = {
        email,
        password,
        password2,
        name,
    };
    return axiosInstance.post(`${AUTH_URL}/register/`, postData);
}

export function login(email, password, forceLogout = false) {
    const postData = {
        email,
        password,
        force_logout: forceLogout,
    };
    return axiosInstance.post(`${AUTH_URL}/login/`, postData);
}

export function formatError(errorResponse) {
    if (errorResponse && (errorResponse.error === 'already_logged_in' || errorResponse.active_session)) {
        return errorResponse.message || 'User is already logged in on another system.';
    }
    // Handle Django REST framework error responses
    if (errorResponse && errorResponse.error) {
        // Single error message from backend
        swal("Oops", errorResponse.error, "error", { button: "Try Again!" });
        return errorResponse.error;
    } else if (errorResponse && typeof errorResponse === 'object' && Object.keys(errorResponse).length > 0) {
        // Multiple validation errors — only show if there are actual keys
        const errorMessages = [];
        for (const [field, messages] of Object.entries(errorResponse)) {
            if (Array.isArray(messages)) {
                errorMessages.push(`${field}: ${messages.join(', ')}`);
            } else {
                errorMessages.push(`${field}: ${messages}`);
            }
        }
        const errorText = errorMessages.join('\n');
        swal("Oops", errorText, "error", { button: "Try Again!" });
        return errorText;
    } else if (typeof errorResponse === 'string' && errorResponse) {
        // If web server returned an HTML error page (e.g. 404/502/503 from LiteSpeed/Apache/Nginx)
        if (errorResponse.trim().startsWith('<') || errorResponse.includes('<!DOCTYPE html>')) {
            const titleMatch = errorResponse.match(/<title>(.*?)<\/title>/i);
            const statusTitle = titleMatch ? titleMatch[1].trim() : 'Server Error';
            const friendlyMsg = `Server Error: ${statusTitle}. The API endpoint (${AUTH_URL}/login/) could not be reached. Please check the backend deployment.`;
            swal("Connection Error", friendlyMsg, "error", { button: "OK" });
            return friendlyMsg;
        }
        // Plain string error — show it directly without a modal
        // (these are usually network/axios errors, not user-facing auth errors)
        return errorResponse;
    }

    // Fallback for unknown/empty error format — show the modal
    swal("Oops", "An error occurred. Please try again.", "error");
    return 'An error occurred';
}

export function saveTokenInLocalStorage(tokenDetails) {
    if (!tokenDetails || typeof tokenDetails !== 'object') {
        throw new Error('Invalid server response format.');
    }
    const access = tokenDetails.tokens?.access || tokenDetails.access || '';
    const refresh = tokenDetails.tokens?.refresh || tokenDetails.refresh || '';
    const user = tokenDetails.user || {};
    if (!access) {
        throw new Error(tokenDetails.error || tokenDetails.message || 'Login failed: access token missing from response.');
    }
    // Save JWT tokens and user data
    const userDetails = {
        access,
        refresh,
        user,
        expireDate: new Date(new Date().getTime() + 24 * 60 * 60 * 1000), // 24 hours
    };
    localStorage.setItem('userDetails', JSON.stringify(userDetails));
}

export function runLogoutTimer(dispatch, timer, navigate) {
    setTimeout(() => {
        dispatch(Logout(navigate));
    }, timer);
}

export function checkAutoLogin(dispatch, navigate) {
    const tokenDetailsString = localStorage.getItem('userDetails');
    let tokenDetails = '';
    if (!tokenDetailsString) {
        return;
    }

    tokenDetails = JSON.parse(tokenDetailsString);
    let expireDate = new Date(tokenDetails.expireDate);
    let todaysDate = new Date();

    if (todaysDate > expireDate) {
        dispatch(Logout(navigate));
        return;
    }

    dispatch(loginConfirmedAction(tokenDetails));

    const timer = expireDate.getTime() - todaysDate.getTime();
    runLogoutTimer(dispatch, timer, navigate);
}

export function isLogin() {
    const tokenDetailsString = localStorage.getItem('userDetails');

    if (tokenDetailsString) {
        return true;
    } else {
        return false;
    }
}

export function logoutService() {
    try {
        const userDetailsStr = localStorage.getItem('userDetails');
        let refresh = '';
        if (userDetailsStr) {
            const userDetails = JSON.parse(userDetailsStr);
            refresh = userDetails?.refresh || '';
        }
        return axiosInstance.post(`${AUTH_URL}/logout/`, { refresh_token: refresh });
    } catch (e) {
        return Promise.resolve();
    }
}