import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import swal from 'sweetalert';
import { usePermission } from '../../hooks/usePermission';
import { PermissionContext } from '../../context/PermissionContext';

/**
 * ProtectedRoute component for superuser-only pages
 * Redirects to dashboard if user is not a superuser
 */
const ProtectedRoute = ({ children, requireSuperuser = false, module, action }) => {
    const auth = useSelector(state => state.auth.auth);

    // Use permissionsLoading directly from context (not the combined loading that
    // also includes menusLoading, which can hang indefinitely and cause blank screens)
    const context = useContext(PermissionContext);
    const permissionsLoading = context ? context.loading : false;

    const { can } = usePermission();

    // Check if user is authenticated
    if (!auth || !auth.user) {
        swal('Access Denied', 'You must be logged in to access this page.', 'error');
        return <Navigate to="/login" replace />;
    }

    // If user is a superuser or staff, grant full access to everything (no permission check needed)
    if (auth.user.is_superuser || auth.user.is_staff) {
        return children;
    }

    // Check if superuser access is required
    if (requireSuperuser && !auth.user.is_superuser) {
        swal('Access Denied', 'Only administrators can access this page.', 'error');
        return <Navigate to="/page-error-404" replace />;
    }

    // Check specific module and action permissions if provided
    if (module && action) {
        // Only block on permissionsLoading (not menusLoading) to avoid permanent blank screens
        if (permissionsLoading) {
            return (
                <div className="d-flex justify-content-center align-items-center" style={{ height: '70vh' }}>
                    <div className="spinner-border text-primary" role="status" style={{ width: '2.5rem', height: '2.5rem' }}>
                        <span className="sr-only">Loading...</span>
                    </div>
                </div>
            );
        }

        if (!can(module, action)) {
            swal('Access Denied', `You do not have permission to ${action} ${module}.`, 'error');
            return <Navigate to="/page-error-404" replace />;
        }
    }

    return children;
};

export default ProtectedRoute;