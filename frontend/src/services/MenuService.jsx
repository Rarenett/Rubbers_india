import axios from 'axios';

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'}/auth`;

/**
 * Fetch user-specific menus from the backend
 * Requires JWT authentication
 */
export function fetchUserMenus() {
    const userDetails = localStorage.getItem('userDetails');

    if (!userDetails) {
        return Promise.reject(new Error('No authentication token found'));
    }

    const { access } = JSON.parse(userDetails);

    return axios.get(`${API_BASE_URL}/menus/user-menus/`, {
        headers: {
            'Authorization': `Bearer ${access}`,
            'Content-Type': 'application/json',
        }
    });
}

/**
 * Normalizes title strings to Title Case (First letter capitalized, rest lowercase),
 * preserving standard acronyms (HR, CRM, MIS, R & D).
 */
function formatTitleCase(str) {
    if (!str) return str;
    const trimmed = str.trim();
    const acronyms = ['HR', 'CRM', 'MIS', 'BOM', 'R & D'];
    if (acronyms.includes(trimmed)) {
        return trimmed;
    }
    const lower = trimmed.toLowerCase();
    if (lower === 'feed back' || lower === 'complaints') return 'Feedback';
    if (lower === 'meeting') return 'Meetings';
    if (lower === 'logistics core' || lower === 'logistics') return 'Logistics';
    if (lower === 'transactions') return 'Transaction';

    return str;
}

/**
 * Transform backend menu data to frontend menu format
 * @param {Array} backendMenus - Menus from backend API
 * @returns {Array} - Menus in frontend format
 */
export function transformMenusToFrontendFormat(backendMenus) {
    if (!Array.isArray(backendMenus)) {
        if (backendMenus && Array.isArray(backendMenus.results)) {
            backendMenus = backendMenus.results;
        } else if (backendMenus && Array.isArray(backendMenus.data)) {
            backendMenus = backendMenus.data;
        } else if (backendMenus && Array.isArray(backendMenus.menus)) {
            backendMenus = backendMenus.menus;
        } else {
            console.error('transformMenusToFrontendFormat: Expected an array of menus, but received:', backendMenus);
            return [];
        }
    }

    const rawTransformed = backendMenus
        .filter(menu => menu.is_active !== false)
        .map(menu => {
        const titleFormatted = formatTitleCase(menu.name);
        const transformed = {
            title: titleFormatted,
            classsChange: 'mm-collapse',
            iconStyle: typeof menu.icon === 'string' ? menu.icon.toLowerCase() : (menu.icon || null),
            can_view: menu.can_view,
            permissions: {
                can_view: menu.can_view,
                can_create: menu.can_create,
                can_edit: menu.can_edit,
                can_delete: menu.can_delete,
                can_history: menu.can_history
            },
            id: menu.id,
            code: menu.code
        };

        // If menu has submenus
        if (Array.isArray(menu.submenus) && menu.submenus.length > 0) {
            transformed.content = menu.submenus
                .filter(submenu => submenu.is_active !== false)
                .map(submenu => {
                const subTitle = submenu.code === 'wallet_transactions' ? 'Transactions' : formatTitleCase(submenu.name);
                const submenuData = {
                    title: subTitle,
                    code: submenu.code,
                    id: submenu.id,
                    can_view: submenu.can_view,
                    permissions: {
                        can_view: submenu.can_view,
                        can_create: submenu.can_create,
                        can_edit: submenu.can_edit,
                        can_delete: submenu.can_delete,
                        can_history: submenu.can_history
                    }
                };

                const normalizeMenuUrl = (url) => {
                    if (!url) return undefined;
                    return url.startsWith('/') ? url : '/' + url;
                };

                if (submenu.url) {
                    submenuData.to = normalizeMenuUrl(submenu.url);
                }

                if (Array.isArray(submenu.subsubmenus) && submenu.subsubmenus.length > 0) {
                    submenuData.hasMenu = true;
                    submenuData.content = submenu.subsubmenus
                        .filter(subsubmenu => subsubmenu.is_active !== false)
                        .map(subsubmenu => ({
                        title: subsubmenu.name,
                        to: normalizeMenuUrl(subsubmenu.url),
                        code: subsubmenu.code,
                        id: subsubmenu.id,
                        can_view: subsubmenu.can_view,
                        permissions: {
                            can_view: subsubmenu.can_view,
                            can_create: subsubmenu.can_create,
                            can_edit: subsubmenu.can_edit,
                            can_delete: subsubmenu.can_delete,
                            can_history: subsubmenu.can_history
                        }
                    }));
                }

                return submenuData;
            });
        } else if (menu.url) {
            transformed.to = menu.url.startsWith('/') ? menu.url : '/' + menu.url;
        }

        return transformed;
    });

    // Frontend Deduplication Guard: merge duplicate menu titles (e.g. Feedback & FEED BACK, Meetings & Meeting)
    const seenTitles = new Map();

    for (const item of rawTransformed) {
        const key = item.title ? item.title.toLowerCase().replace(/\s+/g, '') : '';
        if (!key) continue;

        if (!seenTitles.has(key)) {
            seenTitles.set(key, item);
        } else {
            const existing = seenTitles.get(key);
            // Merge submenus if duplicate exists
            if (Array.isArray(item.content) && item.content.length > 0) {
                if (!Array.isArray(existing.content)) {
                    existing.content = item.content;
                } else {
                    const existingSubKeys = new Set(existing.content.map(s => s.title.toLowerCase().replace(/\s+/g, '')));
                    for (const sub of item.content) {
                        const subKey = sub.title.toLowerCase().replace(/\s+/g, '');
                        if (!existingSubKeys.has(subKey)) {
                            existing.content.push(sub);
                            existingSubKeys.add(subKey);
                        }
                    }
                }
            }
        }
    }

    const finalMenus = Array.from(seenTitles.values());

    // --- Hardcoded Menu Moves ---
    // Move "Team Dashboard" from "Team Management" -> "Transaction" to "CRM" -> "Master"
    let teamDashboardItem = null;

    for (const menu of finalMenus) {
        if (menu.title === 'Team Management' && Array.isArray(menu.content)) {
            for (const submenu of menu.content) {
                if (submenu.title === 'Transaction' && Array.isArray(submenu.content)) {
                    const idx = submenu.content.findIndex(ssm => ssm.title === 'Team Dashboard');
                    if (idx !== -1) {
                        teamDashboardItem = submenu.content.splice(idx, 1)[0];
                        // If Transaction is now empty, we could remove hasMenu, but keeping it is harmless
                        if (submenu.content.length === 0) {
                            submenu.hasMenu = false;
                        }
                        break;
                    }
                }
            }
        }
    }

    if (teamDashboardItem) {
        for (const menu of finalMenus) {
            if (menu.title === 'CRM') {
                if (!Array.isArray(menu.content)) {
                    menu.content = [];
                }
                let masterSubmenu = menu.content.find(sub => sub.title === 'Master');
                if (!masterSubmenu) {
                    masterSubmenu = {
                        title: 'Master',
                        hasMenu: true,
                        content: [],
                        can_view: true,
                        permissions: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_history: false }
                    };
                    menu.content.push(masterSubmenu);
                }
                if (!Array.isArray(masterSubmenu.content)) {
                    masterSubmenu.content = [];
                    masterSubmenu.hasMenu = true;
                }
                masterSubmenu.content.push(teamDashboardItem);
                break;
            }
        }
    }

    return finalMenus;
}
