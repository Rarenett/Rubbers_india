import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';

// Create the Context
export const PermissionContext = createContext();

// Create the Provider
export const PermissionProvider = ({ children }) => {
    const [permissions, setPermissions] = useState({});
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);

    // Get auth state to check if user is logged in
    const auth = useSelector(state => state.auth.auth);
    const isAuthenticated = !!auth?.user;

    useEffect(() => {
        let isMounted = true;

        const fetchPermissions = async () => {
            if (!isAuthenticated) {
                if (isMounted) {
                    setPermissions({});
                    setRole(null);
                    setLoading(false);
                }
                return;
            }

            try {
                // Get token from localStorage
                const userDetailsString = localStorage.getItem('userDetails');
                let token = '';
                if (userDetailsString) {
                    const userDetails = JSON.parse(userDetailsString);
                    token = userDetails.access || '';
                }

                const config = {
                    headers: {
                        'Authorization': token ? `Bearer ${token}` : ''
                    }
                };

                const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'}/auth/permissions/`, config);

                if (isMounted) {
                    setPermissions(response.data.permissions || {});
                    setRole(response.data.role);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Failed to fetch user permissions", error);
                if (isMounted) {
                    setPermissions({});
                    setRole(null);
                    setLoading(false);
                }
            }
        };

        fetchPermissions();

        return () => {
            isMounted = false;
        };
    }, [isAuthenticated]); // Re-fetch only when auth status changes

    // The context value
    const value = {
        permissions,
        role,
        loading
    };

    return (
        <PermissionContext.Provider value={value}>
            {children}
        </PermissionContext.Provider>
    );
};
