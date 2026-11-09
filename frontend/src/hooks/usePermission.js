import { useContext } from 'react';
import { useSelector } from 'react-redux';
import { PermissionContext } from '../context/PermissionContext';

/**
 * Custom hook to consume the PermissionContext.
 * 
 * Provides `can(module, action)` and direct access to `permissions` and `loading`.
 */
export const usePermission = () => {
    const context = useContext(PermissionContext);
    const { menus: dynamicMenus, loading: menusLoading } = useSelector(state => state.menu);
    const auth = useSelector(state => state.auth.auth);

    if (context === undefined) {
        throw new Error('usePermission must be used within a PermissionProvider');
    }

    const { permissions, role, loading: permissionsLoading } = context;
    const loading = permissionsLoading || menusLoading;

    /**
     * Checks if the user has a specific permission for a module.
     * 
     * @param {string} module - The module code (e.g. 'leads', 'rfq')
     * @param {string} action - The action ('view', 'create', 'edit', 'delete', 'approve')
     * @returns {boolean} True if permitted, false otherwise.
     */
    const can = (module, action) => {
        // If user is a superuser in Redux, grant full access immediately
        if (auth?.user?.is_superuser) {
            return true;
        }

        // If no permissions loaded yet, default to false
        if (!permissions || Object.keys(permissions).length === 0) {
            return false;
        }

        // If user is a superuser (from permissions structure), grant full access
        if (permissions['_is_superuser']) {
            return true;
        }

        const MODULE_ALIASES = {
            'leave-types': 'leavetype',
            'leave_types': 'leavetype',
            'leave-type': 'leavetype',
            'leave_type': 'leavetype',
            'leavetypes': 'leavetype',
            'leave-requests': 'reqs',
            'leave_requests': 'reqs',
            'leave-request': 'reqs',
            'leave_request': 'reqs',
            'leaverequests': 'reqs',
            'leavetype': 'leave-types',
            'reqs': 'leave-requests',
        };
        const targetAlias = MODULE_ALIASES[module];

        // If the module exists in permissions, check the specific action
        if (permissions[module]) {
            return !!permissions[module][action];
        }
        if (targetAlias && permissions[targetAlias]) {
            return !!permissions[targetAlias][action];
        }

        // Module code variations & aliases (e.g. kebab-case vs snake_case, singular vs plural)
        const aliasMap = {
            'gate-entry': 'gate_entries',
            'gate_entry': 'gate_entries',
            'gate-entries': 'gate_entries',
            'gate_entries': 'gate_entries'
        };
        const resolved = aliasMap[module];
        if (resolved && permissions[resolved]) {
            return !!permissions[resolved][action];
        }

        const underscored = module?.replace?.(/-/g, '_');
        if (underscored && permissions[underscored]) {
            return !!permissions[underscored][action];
        }

        const hyphenated = module?.replace?.(/_/g, '-');
        if (hyphenated && permissions[hyphenated]) {
            return !!permissions[hyphenated][action];
        }

        // 2. Secondary check: Bridge Code to ID fallback
        // If the module code is not in the permission dictionary, we find which item it belongs to
        // and check the permission by its component ID (menu_X, submenu_X, etc.)
        if (Array.isArray(dynamicMenus) && dynamicMenus.length > 0) {
            let foundItem = null;
            let itemType = null;

            const matchesItem = (item) => {
                if (!item) return false;
                if (item.code === module) return true;
                if (targetAlias && item.code === targetAlias) return true;
                if (item.url) {
                    const cleanUrl = item.url.replace(/^\/+|\/+$/g, '');
                    if (cleanUrl === module || cleanUrl.includes(module) || (targetAlias && cleanUrl.includes(targetAlias))) {
                        return true;
                    }
                }
                return false;
            };

            // Simple recursive search through the menu tree
            for (const menu of dynamicMenus) {
                if (matchesItem(menu)) { foundItem = menu; itemType = 'menu'; break; }
                if (menu.submenus) {
                    for (const sm of menu.submenus) {
                        if (matchesItem(sm)) { foundItem = sm; itemType = 'submenu'; break; }
                        if (sm.subsubmenus) {
                            for (const ssm of sm.subsubmenus) {
                                if (matchesItem(ssm)) { foundItem = ssm; itemType = 'subsubmenu'; break; }
                            }
                        }
                        if (foundItem) break;
                    }
                }
                if (foundItem) break;
            }

            if (foundItem) {
                const idKey = `${itemType}_${foundItem.id}`;
                if (permissions[idKey]) {
                    return !!permissions[idKey][action];
                }
            }
        }

        return false;
    };

    return {
        can,
        permissions,
        role,
        loading
    };
};

export default usePermission;
