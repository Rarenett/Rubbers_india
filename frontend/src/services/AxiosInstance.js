import axios from 'axios';
import Swal from 'sweetalert2';

const getBaseURL = () => {
    const envUrl = import.meta.env.VITE_BACKEND_URL;
    if (envUrl && envUrl.includes(':8001')) {
        return envUrl.replace(':8001', ':8000');
    }
    return envUrl || 'http://127.0.0.1:8000';
};

const axiosInstance = axios.create({
    baseURL: getBaseURL(),
});

axiosInstance.interceptors.request.use((config) => {
    const userDetails = localStorage.getItem('userDetails');
    if (userDetails) {
        try {
            const parsed = JSON.parse(userDetails);
            const access = parsed.access;
            if (access) {
                config.headers['Authorization'] = `Bearer ${access}`;
            }
        } catch (error) {
            // ignore parse errors silently
        }
    }
    return config;
});

// Response interceptor - handle 401 expired token and trigger task mutation events
axiosInstance.interceptors.response.use(
    response => {
        // Dispatch event when tasks are mutated so the reminder engine can instantly resync
        const url = response.config?.url || '';
        const method = response.config?.method?.toLowerCase() || '';
        if (url.includes('/api/task-management/tasks/') && ['post', 'put', 'patch', 'delete'].includes(method)) {
            window.dispatchEvent(new Event('taskMutated'));
        }
        return response;
    },
    error => {
        if (error.response && error.response.status === 401) {
            const currentPath = window.location.pathname;

            // Only redirect if user had a token (was previously logged in)
            // and is NOT already on the login page
            const hadToken = !!localStorage.getItem('userDetails');
            const onLoginPage = currentPath === '/login' || currentPath === '/login/';

            if (!onLoginPage && hadToken) {
                const rawDetail = error.response.data?.detail || error.response.data?.error || error.response.data?.message || error.response.data;
                const detailStr = typeof rawDetail === 'object' ? JSON.stringify(rawDetail) : String(rawDetail || '');

                const isTerminated = detailStr.toLowerCase().includes('terminated') || 
                                     detailStr.toLowerCase().includes('another system') ||
                                     detailStr.toLowerCase().includes('another device');

                const fullPath = currentPath + window.location.search + window.location.hash;
                localStorage.setItem('redirect_after_login', fullPath);
                try {
                    const userDetailsStr = localStorage.getItem('userDetails');
                    if (userDetailsStr) {
                        const parsed = JSON.parse(userDetailsStr);
                        const userEmail = parsed?.user?.email || parsed?.email;
                        if (userEmail) {
                            localStorage.setItem('redirect_user_email', userEmail.trim().toLowerCase());
                        }
                    }
                } catch (e) {}

                if (isTerminated) {
                    if (!window.__isSessionTerminatedAlertShowing) {
                        window.__isSessionTerminatedAlertShowing = true;
                        Swal.fire({
                            icon: 'warning',
                            title: 'Session Terminated',
                            text: 'Your session has been terminated because this account logged in from another system.',
                            confirmButtonText: 'Back to Login',
                            allowOutsideClick: false,
                            allowEscapeKey: false,
                            customClass: {
                                confirmButton: 'btn btn-primary'
                            }
                        }).then(() => {
                            window.__isSessionTerminatedAlertShowing = false;
                            localStorage.removeItem('userDetails');
                            window.location.href = '/login';
                        });
                    }
                } else {
                    localStorage.removeItem('userDetails');
                    window.location.href = '/login';
                }
            }
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
