import { lazy, Suspense, useEffect } from 'react';
import { connect, useDispatch } from 'react-redux';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
// action
import Index from "./jsx";
import { checkAutoLogin } from './services/AuthService';
import { fetchCompany } from './services/CompanyService';
import { isAuthenticated } from './store/selectors/AuthSelectors';
/// Style
// import "./vendor/bootstrap-select/dist/css/bootstrap-select.min.css"; // vendor folder not present
import "./css/style.css";
import "./index.css";


import Swal from 'sweetalert2';
import { Logout } from './store/actions/AuthActions';
import axiosInstance from './services/AxiosInstance';
import { setupGlobalFormValidation } from './utils/formValidation';
import { setupGlobalModalEsc } from './utils/modalUtils';

import Login from './jsx/pages/Login';
const SignUp = lazy(() => import('./jsx/pages/Registration'));
function withRouter(Component) {
    function ComponentWithRouterProp(props) {
        let location = useLocation();
        let navigate = useNavigate();
        let params = useParams();

        return (
            <Component
                {...props}
                router={{ location, navigate, params }}
            />
        );
    }
    return ComponentWithRouterProp;
}



function App(props) {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    useEffect(() => {
        checkAutoLogin(dispatch, navigate);
        
        // Dynamically apply company title from Company table
        const applyCompanyTitle = (name) => {
            if (name) {
                document.title = name.endsWith('ERP') ? name : `${name} - ERP`;
            }
        };

        // 1. Immediately apply from cached company settings
        const cachedSettings = JSON.parse(localStorage.getItem('companySettings') || '{}');
        if (cachedSettings.displayName) {
            applyCompanyTitle(cachedSettings.displayName);
        }

        // 2. Fetch public branding from backend without requiring authentication
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
        fetch(`${backendUrl}/api/settings/company/branding/`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data && data.display_name) {
                    applyCompanyTitle(data.display_name);
                    if (data.title_logo) {
                        const link = document.querySelector("link[rel='icon']") || document.createElement('link');
                        link.rel = 'icon';
                        link.href = data.title_logo;
                        document.head.appendChild(link);
                    }
                }
            })
            .catch(() => {});

        // 3. Update title dynamically when company settings are modified
        const handleBrandingUpdate = () => {
            const updated = JSON.parse(localStorage.getItem('companySettings') || '{}');
            if (updated.displayName) {
                applyCompanyTitle(updated.displayName);
            }
        };
        window.addEventListener('companySettingsUpdate', handleBrandingUpdate);

        // Global fix: restrict year to 4 digits in all date inputs natively
        const handleFocusIn = (e) => {
            if (e.target && e.target.type === 'date') {
                if (!e.target.getAttribute('max')) {
                    e.target.setAttribute('max', '9999-12-31');
                }
            }
        };

        // Global Title Case auto-capitalization of first letter of each word in text values
        // (Strictly excludes password, email, username, and login page fields)
        const handleInputCapitalize = (e) => {
            if (!e.isTrusted) return;
            const target = e.target;
            if (!target || target._isCapitalizing) return;
            if (
                (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
                target.type !== 'password' &&
                target.type !== 'email' &&
                target.type !== 'search' &&
                target.type !== 'url' &&
                target.type !== 'hidden' &&
                target.type !== 'checkbox' &&
                target.type !== 'radio' &&
                target.type !== 'range' &&
                target.type !== 'color' &&
                target.name !== 'username' &&
                target.name !== 'password' &&
                target.type !== 'number' &&
                target.type !== 'date' &&
                target.type !== 'datetime-local' &&
                target.type !== 'time' &&
                target.type !== 'file' &&
                !target.classList?.contains('no-capitalize') &&
                !target.closest?.('.login-wrapper') &&
                !target.closest?.('.authincation-content')
            ) {
                if (typeof target.value === 'string' && target.value.length > 0) {
                    const val = target.value;
                    const titleCased = val.replace(/\b[a-z]/g, (l) => l.toUpperCase());
                    if (titleCased !== val) {
                        try {
                            target._isCapitalizing = true;
                            const start = target.selectionStart;
                            const end = target.selectionEnd;
                            const nativeSetter = Object.getOwnPropertyDescriptor(
                                target.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype,
                                "value"
                            )?.set;
                            if (nativeSetter) {
                                nativeSetter.call(target, titleCased);
                            } else {
                                target.value = titleCased;
                            }
                            target.dispatchEvent(new Event('input', { bubbles: true }));
                            if (target.setSelectionRange && start !== null && end !== null) {
                                try { target.setSelectionRange(start, end); } catch (err) {}
                            }
                        } finally {
                            target._isCapitalizing = false;
                        }
                    }
                }
            }
        };

        document.addEventListener('focusin', handleFocusIn);
        document.addEventListener('input', handleInputCapitalize);
        document.addEventListener('blur', handleInputCapitalize, true);
        
        // Global form validation listener: intercepts invalid events and displays SweetAlert warning popup
        const cleanupFormValidation = setupGlobalFormValidation();

        // Global modal Escape key handler: closes active foremost modal when Escape is pressed
        const cleanupModalEsc = setupGlobalModalEsc();

        return () => {
            window.removeEventListener('companySettingsUpdate', handleBrandingUpdate);
            document.removeEventListener('focusin', handleFocusIn);
            document.removeEventListener('input', handleInputCapitalize);
            document.removeEventListener('blur', handleInputCapitalize, true);
            if (cleanupFormValidation) cleanupFormValidation();
            if (cleanupModalEsc) cleanupModalEsc();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Dynamic Inactivity Auto-Logout Handler per User
    useEffect(() => {
        if (!props.isAuthenticated) return;

        let activeTimeoutMinutes = 10;
        let lastActivityTime = Date.now();
        let isLoggedOut = false;

        // Reads timeout setting from localStorage
        const readLocalTimeout = () => {
            try {
                const userDetailsStr = localStorage.getItem('userDetails');
                if (userDetailsStr) {
                    const userDetails = JSON.parse(userDetailsStr);
                    const user = userDetails?.user || userDetails;
                    if (user?.inactivity_timeout_minutes) {
                        return parseInt(user.inactivity_timeout_minutes, 10) || 10;
                    }
                }
            } catch (e) {}
            return 10;
        };

        activeTimeoutMinutes = readLocalTimeout();

        // Sync latest inactivity timeout from backend API live
        axiosInstance.get('/api/auth/inactivity-timeout/').then((res) => {
            if (res.data?.inactivity_timeout_minutes) {
                const freshMinutes = parseInt(res.data.inactivity_timeout_minutes, 10);
                if (freshMinutes && freshMinutes > 0) {
                    activeTimeoutMinutes = freshMinutes;
                    // Update userDetails in localStorage
                    try {
                        const userDetailsStr = localStorage.getItem('userDetails');
                        if (userDetailsStr) {
                            const userDetails = JSON.parse(userDetailsStr);
                            if (userDetails.user) {
                                userDetails.user.inactivity_timeout_minutes = freshMinutes;
                                localStorage.setItem('userDetails', JSON.stringify(userDetails));
                            }
                        }
                    } catch (e) {}
                }
            }
        }).catch(() => {});

        const logoutUserDueToInactivity = () => {
            if (isLoggedOut) return;
            isLoggedOut = true;

            const currentPath = window.location.pathname + window.location.search + window.location.hash;
            if (currentPath && currentPath !== '/login' && currentPath !== '/page-register') {
                localStorage.setItem('redirect_after_login', currentPath);
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
            }
            dispatch(Logout(navigate));
            Swal.fire({
                icon: 'warning',
                title: 'Session Expired',
                text: `You have been automatically logged out due to ${activeTimeoutMinutes} minute(s) of inactivity.`,
                confirmButtonText: 'Login Again'
            }).then(() => {
                window.location.href = '/login';
            });
        };

        const updateActivity = () => {
            lastActivityTime = Date.now();
        };

        const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
        activityEvents.forEach((evt) => {
            window.addEventListener(evt, updateActivity, { passive: true });
        });

        // Interval loop checking elapsed idle time every 1 second
        const checkInterval = setInterval(() => {
            const elapsedMs = Date.now() - lastActivityTime;
            const allowedMs = activeTimeoutMinutes * 60 * 1000;
            if (elapsedMs >= allowedMs) {
                clearInterval(checkInterval);
                logoutUserDueToInactivity();
            }
        }, 1000);

        // Background session token validation heartbeat every 10 seconds
        const sessionCheckInterval = setInterval(() => {
            if (localStorage.getItem('userDetails') && !window.__isSessionTerminatedAlertShowing) {
                axiosInstance.get('/api/auth/inactivity-timeout/').catch(() => {
                    // Axios 401 interceptor automatically catches session termination and triggers Swal modal
                });
            }
        }, 10000);

        return () => {
            clearInterval(checkInterval);
            clearInterval(sessionCheckInterval);
            activityEvents.forEach((evt) => {
                window.removeEventListener(evt, updateActivity);
            });
        };
    }, [props.isAuthenticated, dispatch, navigate]);

    if (!props.isAuthenticated) {
        const path = window.location.pathname + window.location.search;
        if (path && path !== '/login' && path !== '/login/' && path !== '/page-register' && path !== '/dashboard' && path !== '/dashboard/' && path !== '/') {
            localStorage.setItem('redirect_after_login', path);
        }
    }

    let routeblog = (
        <Routes>
            <Route path='/login' element={<Login />} />
            <Route path='/page-register' element={<SignUp />} />
            <Route path='*' element={<Navigate to="/login" replace />} />
        </Routes>
    );

    if (props.isAuthenticated) {
        const currentPath = props.router?.location?.pathname || window.location.pathname;
        if (currentPath === '/login' || currentPath === '/login/') {
            const redirectPath = localStorage.getItem('redirect_after_login');
            if (redirectPath && redirectPath !== '/login' && redirectPath !== '/login/' && redirectPath !== '/dashboard' && redirectPath !== '/dashboard/' && redirectPath !== '/') {
                localStorage.removeItem('redirect_after_login');
                return <Navigate to={redirectPath} replace />;
            }
            try {
                const userDetailsStr = localStorage.getItem('userDetails');
                if (userDetailsStr) {
                    const parsed = JSON.parse(userDetailsStr);
                    const user = parsed?.user;
                    const defaultDash = user?.role?.assigned_dashboards?.find(d => d.is_default) || user?.role?.assigned_dashboards?.[0];
                    if (defaultDash && defaultDash.route) {
                        const route = defaultDash.route.startsWith('/') ? defaultDash.route : '/' + defaultDash.route;
                        return <Navigate to={route} replace />;
                    }
                }
            } catch (e) {}
            return <Navigate to="/" replace />;
        }

        return (
            <>
                <Suspense fallback={
                    <div id="preloader">
                        <div className="sk-three-bounce">
                            <div className="sk-child sk-bounce1"></div>
                            <div className="sk-child sk-bounce2"></div>
                            <div className="sk-child sk-bounce3"></div>
                        </div>
                    </div>
                }
                >
                    <Index />
                </Suspense>
            </>
        );
    } else if (localStorage.getItem('userDetails')) {
        // Show loader while checkAutoLogin runs to prevent premature redirect to /login
        return (
            <div id="preloader">
                <div className="sk-three-bounce">
                    <div className="sk-child sk-bounce1"></div>
                    <div className="sk-child sk-bounce2"></div>
                    <div className="sk-child sk-bounce3"></div>
                </div>
            </div>
        );
    } else {
        return (
            <div className="vh-100">
                <Suspense fallback={null}>
                    {routeblog}
                </Suspense>
            </div>
        );
    }
};

const mapStateToProps = (state) => {
    return {
        isAuthenticated: isAuthenticated(state),
    };
};


export default withRouter(connect(mapStateToProps)(App)); 
