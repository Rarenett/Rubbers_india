import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';

/**
 * Custom hook to get permissions for the current route
 * @returns {Object} { can_create, can_edit, can_delete, is_superuser }
 */
const usePermissions = () => {
    const location = useLocation();
    const currentPath = location.pathname;

    const auth = useSelector(state => state.auth.auth);
    const menus = useSelector(state => state.menu.menus);
    const isSuperuser = auth?.user?.is_superuser || false;

    // Default permissions for superuser
    if (isSuperuser) {
        return {
            can_create: true,
            can_edit: true,
            can_delete: true,
            is_superuser: true
        };
    }

    // Find permissions for current path
    let permissions = {
        can_create: false,
        can_edit: false,
        can_delete: false,
        is_superuser: false
    };

    // Helper to normalize paths for comparison
    const normalizePath = (path) => {
        if (!path) return '';
        return path.replace(/\/$/, ""); // Remove trailing slash
    };

    const currentNormalizedPath = normalizePath(currentPath);

    // Helper to search in menu tree
    const findPermissions = (menuList) => {
        if (!menuList || !Array.isArray(menuList)) return null;
        for (const menu of menuList) {
            const menuPath = normalizePath(menu.url || menu.to);
            const submenus = menu.submenus || menu.content;

            // Check top level
            if (menuPath === currentNormalizedPath && menuPath !== '') {
                return menu.permissions || {
                    can_create: menu.can_create,
                    can_edit: menu.can_edit,
                    can_delete: menu.can_delete
                };
            }

            // Check submenus
            if (submenus) {
                for (const item of submenus) {
                    const itemPath = normalizePath(item.url || item.to);
                    const subSubMenus = item.subsubmenus || item.content;

                    if (itemPath === currentNormalizedPath && itemPath !== '') {
                        return item.permissions || {
                            can_create: item.can_create,
                            can_edit: item.can_edit,
                            can_delete: item.can_delete
                        };
                    }

                    // Check sub-submenus
                    if (subSubMenus) {
                        for (const subitem of subSubMenus) {
                            const subitemPath = normalizePath(subitem.url || subitem.to);

                            if (subitemPath === currentNormalizedPath && subitemPath !== '') {
                                return subitem.permissions || {
                                    can_create: subitem.can_create,
                                    can_edit: subitem.can_edit,
                                    can_delete: subitem.can_delete
                                };
                            }
                        }
                    }
                }
            }
        }
        return null;
    };

    const foundPerms = findPermissions(menus);
    if (foundPerms) {
        permissions = {
            ...permissions,
            ...foundPerms
        };
    }
    return permissions;
};

export default usePermissions;
