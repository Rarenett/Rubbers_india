import React, { useState, useEffect, Fragment, useContext, useRef, useCallback, useMemo } from 'react';
import { Link, matchPath, useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchUserMenusAction } from '../../store/actions/MenuActions';
import { ThemeContext } from "../../context/ThemeContext";
import { usePermission } from '../../hooks/usePermission';
import { fetchCompany } from '../../services/CompanyService';
import { Modal, Button, Form } from 'react-bootstrap';

const QuickAccessDashboard = ({ allroutes }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { menus: dynamicMenus, loading: menusLoading } = useSelector(state => state.menu);
    const { can, permissionsLoading } = usePermission();
    const { background } = useContext(ThemeContext);
    const isDark = background.value === "dark";

    const [activeSubMenuId, setActiveSubMenuId] = useState(null);
    const [activeSubSubMenuId, setActiveSubSubMenuId] = useState(null);
    const [activeComponent, setActiveComponent] = useState(null);
    const [currentPath, setCurrentPath] = useState([]);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [companyName, setCompanyName] = useState('Dashboard');

    // Quick Access Shortcuts States
    const [quickAccessItems, setQuickAccessItems] = useState([]);
    const [showCustomizeModal, setShowCustomizeModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [selectedPinnedIds, setSelectedPinnedIds] = useState([]);

    useEffect(() => {
        const loadSettings = async () => {
            const localSettings = JSON.parse(localStorage.getItem('companySettings') || '{}');
            if (localSettings.displayName || localSettings.name) {
                setCompanyName(localSettings.displayName || localSettings.name);
            } else {
                try {
                    const companyRes = await fetchCompany();
                    if (companyRes.data && companyRes.data.length > 0) {
                        const companyData = companyRes.data[0];
                        setCompanyName(companyData.display_name || companyData.name || 'Dashboard');
                        localStorage.setItem('companySettings', JSON.stringify({
                            dateFormat: companyData.date_format || 'DD/MM/YYYY',
                            displayName: companyData.display_name || '',
                            name: companyData.name || '',
                            logo: companyData.logo || '',
                            id: companyData.id
                        }));
                        window.dispatchEvent(new Event('companySettingsUpdate'));
                    }
                } catch (err) {
                    console.error("Failed to fetch company details:", err);
                }
            }
        };
        loadSettings();
    }, []);

    const [searchParams, setSearchParams] = useSearchParams();

    // Toggle states
    const [isSubMenuExpanded, setIsSubMenuExpanded] = useState(false);
    const [showSubMenuToggle, setShowSubMenuToggle] = useState(false);
    const [isSubSubMenuExpanded, setIsSubSubMenuExpanded] = useState(false);
    const [showSubSubMenuToggle, setShowSubSubMenuToggle] = useState(false);

    const subMenuContainerRef = useRef(null);
    const subSubMenuContainerRef = useRef(null);
    const ignoreNextUrlUpdate = useRef(false);

    const checkOverflow = () => {
        if (subMenuContainerRef.current) {
            setShowSubMenuToggle(subMenuContainerRef.current.scrollHeight > 60);
        }
        if (subSubMenuContainerRef.current) {
            setShowSubSubMenuToggle(subSubMenuContainerRef.current.scrollHeight > 60);
        }
    };

    // Check on updates or resize
    useEffect(() => {
        checkOverflow();
        window.addEventListener('resize', checkOverflow);
        return () => window.removeEventListener('resize', checkOverflow);
    });

    useEffect(() => {
        dispatch(fetchUserMenusAction());
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, [dispatch]);

    /**
     * Helper to check view permission for a menu item
     * Permissive for containers (no code/URL), strict for modules with codes.
     */
    const canView = (item, type) => {
        // Top-level menus are always visible if they have permitted children
        if (type === 'menu') return true;

        // If the item has a primary module code, we MUST check it strictly
        if (item.code) {
            if (can(item.code, 'view') || can(item.code, 'create') || can(item.code, 'edit') || can(item.code, 'details')) {
                return true;
            }
            // If it has a code but check failed, we still check the ID fallback
        }

        // Check fallback ID-based permission (this matches ManagePermissions key format)
        const fallbackKey = `${type}_${item.id}`;
        if (can(fallbackKey, 'view') || can(fallbackKey, 'create') || can(fallbackKey, 'edit') || can(fallbackKey, 'details')) {
            return true;
        }

        // If the item has NO code and NO ID-based permission found, 
        // we follow the sidebar's behavior: allow it if no code exists
        if (!item.code) {
            return true;
        }

        return false;
    };

    // Calculate items to display based on current depth, filtered by permissions
    const itemsToDisplay = useMemo(() => {
        return (dynamicMenus || [])
            .filter(menu => canView(menu, 'menu'))
            .map(menu => ({
                id: menu.id,
                title: menu.name,
                url: menu.url,
                rawSubmenuCount: (menu.submenus || []).length,
                description: menu.description || `Manage ${menu.name.toLowerCase()} related settings and operations.`,
                icon: menu.icon || 'flaticon-381-networking',
                color: menu.color || '#3b82f6',
                children: (menu.submenus || [])
                    .filter(sm => canView(sm, 'submenu'))
                    .map(sm => ({
                        id: sm.id,
                        name: sm.name,
                        icon: sm.icon || 'flaticon-381-layer',
                        url: sm.url,
                        code: sm.code,
                        subsubmenus: (sm.subsubmenus || [])
                            .filter(ssm => canView(ssm, 'subsubmenu'))
                            .map(ssm => ({
                                ...ssm,
                                id: ssm.id,
                                name: ssm.name,
                                url: ssm.url,
                                code: ssm.code
                            }))
                    }))
                    .filter(sm => {
                        // Keep submenu if it's a leaf node OR has permitted children
                        return sm.url || (sm.subsubmenus && sm.subsubmenus.length > 0);
                    })
            }))
            .filter(menu => menu.url || (menu.children && menu.children.length > 0) || menu.rawSubmenuCount === 0);
    }, [dynamicMenus, can]);

    // Helper to get all leaf items (submenus or subsubmenus with a valid URL)
    const getAllLeafItems = useCallback((menus) => {
        const leafs = [];
        (menus || []).forEach(menu => {
            if (menu.url) {
                leafs.push({
                    id: `menu_${menu.id}`,
                    title: menu.title,
                    url: menu.url,
                    icon: menu.icon || 'flaticon-381-networking',
                    color: menu.color || '#3b82f6',
                    description: menu.description || `Manage ${menu.title.toLowerCase()} related settings and operations.`,
                    breadcrumb: menu.title,
                    type: 'menu'
                });
            }
            if (menu.children) {
                menu.children.forEach(sm => {
                    if (sm.url) {
                        leafs.push({
                            id: `submenu_${sm.id}`,
                            title: sm.name,
                            url: sm.url,
                            icon: sm.icon || menu.icon || 'flaticon-381-layer',
                            color: menu.color || '#3b82f6',
                            description: `Manage ${sm.name.toLowerCase()} related settings and operations.`,
                            breadcrumb: `${menu.title}`,
                            type: 'submenu'
                        });
                    }
                    if (sm.subsubmenus) {
                        sm.subsubmenus.forEach(ssm => {
                            if (ssm.url) {
                                leafs.push({
                                    id: `subsubmenu_${ssm.id}`,
                                    title: ssm.name,
                                    url: ssm.url,
                                    icon: ssm.icon || sm.icon || menu.icon || 'flaticon-381-layer',
                                    color: menu.color || '#3b82f6',
                                    description: `Manage ${ssm.name.toLowerCase()} related settings and operations.`,
                                    breadcrumb: `${menu.title} > ${sm.name}`,
                                    type: 'subsubmenu'
                                });
                            }
                        });
                    }
                });
            }
        });
        return leafs;
    }, []);

    const loadQuickAccessItems = useCallback(() => {
        const allLeafs = getAllLeafItems(itemsToDisplay);
        if (allLeafs.length === 0) return;

        const visitCounts = JSON.parse(localStorage.getItem('quick_access_visit_counts') || '{}');
        const customOrder = JSON.parse(localStorage.getItem('quick_access_custom_order') || '[]');
        const pinnedIds = JSON.parse(localStorage.getItem('quick_access_pinned_ids') || 'null');

        let selectedItems = [];
        if (pinnedIds !== null) {
            selectedItems = allLeafs.filter(leaf => pinnedIds.includes(leaf.id));
        } else {
            // Default to top 6 most visited pages
            const sortedLeafs = [...allLeafs].sort((a, b) => {
                const countA = visitCounts[a.id] || 0;
                const countB = visitCounts[b.id] || 0;
                if (countB !== countA) return countB - countA;
                return allLeafs.indexOf(a) - allLeafs.indexOf(b);
            });
            selectedItems = sortedLeafs.slice(0, 6);
        }

        // Apply custom drag-and-drop order
        if (customOrder.length > 0) {
            selectedItems.sort((a, b) => {
                const indexA = customOrder.indexOf(a.id);
                const indexB = customOrder.indexOf(b.id);
                if (indexA === -1 && indexB === -1) return 0;
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });
        }

        setQuickAccessItems(selectedItems);
    }, [itemsToDisplay, getAllLeafItems]);

    useEffect(() => {
        loadQuickAccessItems();
        
        const handleUpdate = () => {
            loadQuickAccessItems();
        };
        
        window.addEventListener('quickAccessVisitUpdate', handleUpdate);
        return () => {
            window.removeEventListener('quickAccessVisitUpdate', handleUpdate);
        };
    }, [menusLoading, dynamicMenus, loadQuickAccessItems]);

    useEffect(() => {
        if (showCustomizeModal) {
            const pinnedIds = JSON.parse(localStorage.getItem('quick_access_pinned_ids') || 'null');
            if (pinnedIds !== null) {
                setSelectedPinnedIds(pinnedIds);
            } else {
                const allLeafs = getAllLeafItems(itemsToDisplay);
                const visitCounts = JSON.parse(localStorage.getItem('quick_access_visit_counts') || '{}');
                const sortedLeafs = [...allLeafs].sort((a, b) => (visitCounts[b.id] || 0) - (visitCounts[a.id] || 0));
                setSelectedPinnedIds(sortedLeafs.slice(0, 6).map(item => item.id));
            }
            setSearchTerm('');
        }
    }, [showCustomizeModal]);

    const handleSavePins = (newPinnedIds) => {
        localStorage.setItem('quick_access_pinned_ids', JSON.stringify(newPinnedIds));
        const customOrder = JSON.parse(localStorage.getItem('quick_access_custom_order') || '[]');
        const updatedOrder = customOrder.filter(id => newPinnedIds.includes(id));
        newPinnedIds.forEach(id => {
            if (!updatedOrder.includes(id)) {
                updatedOrder.push(id);
            }
        });
        localStorage.setItem('quick_access_custom_order', JSON.stringify(updatedOrder));
        
        setTimeout(() => {
            loadQuickAccessItems();
        }, 50);
        setShowCustomizeModal(false);
    };

    // Drag and Drop reordering handlers
    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.setData("text/plain", index.toString());
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.classList.add("dragging");
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
    };

    const handleDragEnd = (e) => {
        e.currentTarget.classList.remove("dragging");
        setDraggedIndex(null);
    };

    const handleDrop = (e, targetIndex) => {
        e.preventDefault();
        const sourceIndexStr = e.dataTransfer.getData("text/plain");
        if (sourceIndexStr === "") return;
        
        const sourceIndex = parseInt(sourceIndexStr, 10);
        if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

        const updatedItems = [...quickAccessItems];
        const draggedItem = updatedItems[sourceIndex];
        
        updatedItems.splice(sourceIndex, 1);
        updatedItems.splice(targetIndex, 0, draggedItem);
        
        setQuickAccessItems(updatedItems);
        
        const newOrder = updatedItems.map(item => item.id);
        localStorage.setItem('quick_access_custom_order', JSON.stringify(newOrder));
        setDraggedIndex(null);
    };

    const renderOrNavigate = (url, skipUrlUpdate = false) => {
        if (!url) return;

        // Robust URL cleaning
        let cleanUrl = url.replace(/^\/+/, '');
        
        // Extract query parameters
        let queryParams = {};
        if (cleanUrl.includes('?')) {
            const queryString = cleanUrl.substring(cleanUrl.indexOf('?'));
            const urlParams = new URLSearchParams(queryString);
            for (const [key, value] of urlParams.entries()) {
                if (key !== 'page') {
                    queryParams[key] = value;
                }
            }
        }

        // If the URL is already a dashboard link with a page param, extract the page param
        if (cleanUrl.includes('page=')) {
            try {
                const match = url.match(/[?&]page=([^&]+)/);
                if (match) {
                    cleanUrl = decodeURIComponent(match[1]).replace(/^\/+/, '');
                    // Merge any query params that might be in the page param itself
                    if (cleanUrl.includes('?')) {
                        const innerQuery = cleanUrl.substring(cleanUrl.indexOf('?'));
                        const innerParams = new URLSearchParams(innerQuery);
                        for (const [key, value] of innerParams.entries()) {
                            if (key !== 'page') {
                                queryParams[key] = value;
                            }
                        }
                    }
                }
            } catch (e) {
                console.error("Error parsing dashboard URL", e);
            }
        }
        
        // Strip any remaining query params for routing match
        cleanUrl = cleanUrl.split('?')[0];

        // Track page visit in localStorage
        try {
            const allLeafs = getAllLeafItems(itemsToDisplay);
            const matchedLeaf = allLeafs.find(leaf => leaf.url.replace(/^\/+/, '').split('?')[0] === cleanUrl);
            if (matchedLeaf) {
                const visitCounts = JSON.parse(localStorage.getItem('quick_access_visit_counts') || '{}');
                visitCounts[matchedLeaf.id] = (visitCounts[matchedLeaf.id] || 0) + 1;
                localStorage.setItem('quick_access_visit_counts', JSON.stringify(visitCounts));
                window.dispatchEvent(new Event('quickAccessVisitUpdate'));
            }
        } catch (err) {
            console.error("Error tracking page visit:", err);
        }

        const match = (allroutes || []).find(r => {
            const routeUrl = (r.url || '').replace(/^\/+/, '');
            if (routeUrl === cleanUrl) return true;
            try {
                const matchObj = matchPath({ path: r.url, end: true }, cleanUrl);
                return matchObj !== null;
            } catch (e) {
                return false;
            }
        });
        if (match) {
            setActiveComponent(match.component);
            if (!skipUrlUpdate) {
                setSearchParams({ page: cleanUrl, ...queryParams }, { replace: true });
            }
        } else {
            const finalRedirectUrl = cleanUrl + (url.includes('?') ? url.substring(url.indexOf('?')) : '');
            window.location.href = `/${finalRedirectUrl}`;
        }
    };

    // Intercept generic internal links to render them in the dashboard
    const handleEmbeddedClick = (e) => {
        const link = e.target.closest('a');
        // Let it process if the link doesn't have an href or isn't starting with '/'
        if (link && link.getAttribute('href') && link.getAttribute('href').startsWith('/')) {
            const href = link.getAttribute('href');
            // Don't intercept if it's explicitly targeting the dashboard itself
            if (!href.startsWith('/quick-access-dashboard')) {
                e.preventDefault();
                e.stopPropagation();
                renderOrNavigate(href);
            }
        }
    };

    // Auto-restore state on mount or when page param changes (from sidebar/browser navigation)
    const updateCurrentPath = (pageParam) => {
        if (!pageParam || !itemsToDisplay || itemsToDisplay.length === 0) return;
        
        const cleanParam = pageParam.replace(/^\/+/, '').split('?')[0];
        let foundMenu = null;
        let foundSubMenu = null;
        let foundSubSubMenu = null;

        for (const menu of itemsToDisplay) {
            if (menu.url && menu.url.replace(/^\/+/, '') === cleanParam) {
                foundMenu = menu;
                break;
            }
            if (menu.children) {
                for (const sub of menu.children) {
                    if (sub.url && sub.url.replace(/^\/+/, '') === cleanParam) {
                        foundMenu = menu;
                        foundSubMenu = sub;
                        break;
                    }
                    if (sub.subsubmenus) {
                        for (const ssm of sub.subsubmenus) {
                            if (ssm.url && ssm.url.replace(/^\/+/, '') === cleanParam) {
                                foundMenu = menu;
                                foundSubMenu = sub;
                                foundSubSubMenu = ssm;
                                break;
                            }
                        }
                    }
                    if (foundMenu) break;
                }
            }
            if (foundMenu) break;
        }

        if (foundMenu) {
            setCurrentPath([foundMenu]);
            if (foundSubMenu) {
                setActiveSubMenuId(foundSubMenu.id);
                if (foundSubSubMenu) {
                    setActiveSubSubMenuId(foundSubSubMenu.id);
                } else {
                    setActiveSubSubMenuId(null);
                }
            } else {
                setActiveSubMenuId(null);
                setActiveSubSubMenuId(null);
            }
        }
    };

    useEffect(() => {
        if (ignoreNextUrlUpdate.current) {
            ignoreNextUrlUpdate.current = false;
            return;
        }
        if (!menusLoading && itemsToDisplay && itemsToDisplay.length > 0) {
            const pageParam = searchParams.get('page');
            
            if (pageParam) {
                const activePathUrl = currentPath.length > 0 && currentPath[currentPath.length - 1].url 
                    ? currentPath[currentPath.length - 1].url.replace(/^\/+/, '') 
                    : null;
                
                // Always sync component if it's missing, even if path matches
                if (activePathUrl === pageParam && activeComponent) {
                    return;
                }

                updateCurrentPath(pageParam);
                renderOrNavigate(pageParam, true);
            } else if (currentPath.length > 0) {
                setCurrentPath([]);
                setActiveComponent(null);
                setActiveSubMenuId(null);
                setActiveSubSubMenuId(null);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [menusLoading, searchParams, activeComponent]);

    useEffect(() => {
        if (currentPath.length === 0) {
            setActiveComponent(null);
            setActiveSubMenuId(null);
            setActiveSubSubMenuId(null);
        }
    }, [currentPath]);

    const handleDrillDown = (card) => {
        setActiveComponent(null);
        setActiveSubMenuId(null);
        setActiveSubSubMenuId(null);
        setIsSubMenuExpanded(false);
        setIsSubSubMenuExpanded(false);
        setCurrentPath([...currentPath, card]);
        ignoreNextUrlUpdate.current = true;
        setSearchParams({}, { replace: true });
    };

    const handleNavigateUp = (levelIndex) => {
        setActiveComponent(null);
        setIsSubMenuExpanded(false);
        setIsSubSubMenuExpanded(false);
        if (levelIndex === -1) {
            setCurrentPath([]);
            setActiveSubMenuId(null);
            setActiveSubSubMenuId(null);
            ignoreNextUrlUpdate.current = true;
            setSearchParams({}, { replace: true });
        } else {
            setCurrentPath(currentPath.slice(0, levelIndex + 1));
            ignoreNextUrlUpdate.current = true;
            setSearchParams({}, { replace: true });
        }
    };

    const handleBack = () => {
        if (activeComponent) {
            setActiveComponent(null);
            ignoreNextUrlUpdate.current = true;
            setSearchParams({}, { replace: true });
        } else if (currentPath.length > 0) {
            setCurrentPath(currentPath.slice(0, currentPath.length - 1));
            setIsSubMenuExpanded(false);
            setIsSubSubMenuExpanded(false);
            ignoreNextUrlUpdate.current = true;
            setSearchParams({}, { replace: true });
        }
    };

    if (menusLoading || permissionsLoading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="sr-only">Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`dashboard-theme-parent ${isDark ? 'theme-dark' : 'theme-light'}`}>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
            
            <div className="z-index-1 position-relative">
                {/* Breadcrumb Section */}
                <div className="page-titles d-flex justify-content-between align-items-center mb-4">
                    <ol className="breadcrumb mb-0">
                        <li className="breadcrumb-item">
                            <Link to="#" onClick={(e) => { e.preventDefault(); handleNavigateUp(-1); }}>Dashboard</Link>
                        </li>
                        {currentPath.map((pathNode, index) => (
                            <li key={pathNode.id} className={`breadcrumb-item ${index === currentPath.length - 1 ? 'active' : ''}`}>
                                {index === currentPath.length - 1 ? (
                                    <span>{pathNode.title}</span>
                                ) : (
                                    <Link to="#" onClick={(e) => { e.preventDefault(); handleNavigateUp(index); }}>
                                        {pathNode.title}
                                    </Link>
                                )}
                            </li>
                        ))}
                    </ol>
                    {currentPath.length > 0 && (
                        <button 
                            onClick={() => {
                                if (activeComponent) {
                                    setActiveComponent(null);
                                    ignoreNextUrlUpdate.current = true;
                                    setSearchParams({}, { replace: true });
                                } else if (currentPath.length === 1) {
                                    setCurrentPath([]);
                                    ignoreNextUrlUpdate.current = true;
                                    setSearchParams({}, { replace: true });
                                } else {
                                    handleBack();
                                }
                            }}
                            className="btn-manage-pill py-2 px-3 border-0"
                            style={{ height: 'auto', minHeight: 'unset' }}
                        >
                            <i className="fa fa-arrow-left me-2"></i> Back
                        </button>
                    )}
                </div>

                {/* Navigation Tabs - Submenus */}
                            {currentPath.length === 1 && (
                                <div className="mt-4 pt-4 border-top border-light border-opacity-10 w-100 position-relative">
                                    <div 
                                        ref={subMenuContainerRef}
                                        style={{ 
                                            display: 'flex', 
                                            flexWrap: 'wrap', 
                                            gap: '10px',
                                            maxHeight: isSubMenuExpanded ? '1000px' : '45px',
                                            overflow: 'hidden',
                                            transition: 'max-height 0.3s ease-in-out',
                                            paddingRight: showSubMenuToggle ? '100px' : '0'
                                        }}
                                    >
                                        {currentPath[0].children.map((sm) => (
                                            <button
                                                key={sm.id}
                                                onClick={() => {
                                                    setActiveSubMenuId(sm.id);
                                                    setActiveSubSubMenuId(null);
                                                    setIsSubSubMenuExpanded(false);
                                                    const children = sm.subsubmenus || sm.content || sm.children || [];
                                                    if (children.length > 0) {
                                                        setActiveComponent(null);
                                                        ignoreNextUrlUpdate.current = true;
                                                        setSearchParams({}, { replace: true });
                                                    } else if (sm.url || sm.to) {
                                                        const url = sm.url || sm.to;
                                                        const targetUrl = url.startsWith('/') ? url : '/' + url;
                                                        navigate(targetUrl);
                                                    } else {
                                                        setActiveComponent(null);
                                                        ignoreNextUrlUpdate.current = true;
                                                        setSearchParams({}, { replace: true });
                                                    }
                                                }}
                                                className={`btn-manage-pill border-0 ${activeSubMenuId === sm.id ? 'active-neon' : ''}`}
                                                style={{
                                                    padding: '10px 24px',
                                                    flexShrink: 0,
                                                    background: activeSubMenuId === sm.id ? '#00d2ff' : (isDark ? 'rgba(255,255,255,0.08)' : '#f8fafd'),
                                                    color: activeSubMenuId === sm.id ? '#fff' : (isDark ? 'rgba(255,255,255,0.7)' : '#475569'),
                                                    boxShadow: activeSubMenuId === sm.id ? '0 5px 15px rgba(0, 210, 255, 0.4)' : 'none',
                                                }}
                                            >
                                                <i className="fa fa-layer-group me-2" style={{ fontSize: '13px', opacity: 0.8 }}></i>
                                                {sm.name}
                                            </button>
                                        ))}
                                    </div>
                                    {showSubMenuToggle && (
                                        <button 
                                            onClick={() => setIsSubMenuExpanded(!isSubMenuExpanded)}
                                            style={{
                                                position: 'absolute',
                                                right: 0,
                                                top: '24px',
                                                padding: '4px 12px',
                                                fontSize: '0.8rem',
                                                background: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
                                                color: isDark ? '#fff' : '#1e293b',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontWeight: 600,
                                                zIndex: 2,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {isSubMenuExpanded ? 'Show Less' : 'Show All'}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Navigation Tabs (Inside the Banner) - Sub-submenus */}
                            {currentPath.length === 1 && activeSubMenuId && (
                                (() => {
                                    const activeSm = currentPath[0].children.find(sm => sm.id === activeSubMenuId);
                                    if (activeSm && activeSm.subsubmenus && activeSm.subsubmenus.length > 0) {
                                        return (
                                            <div className="mt-3 pt-3 border-top border-light border-opacity-10 w-100 position-relative">
                                                <div 
                                                    ref={subSubMenuContainerRef}
                                                    style={{ 
                                                        display: 'flex', 
                                                        flexWrap: 'wrap', 
                                                        gap: '8px',
                                                        maxHeight: isSubSubMenuExpanded ? '1000px' : '38px',
                                                        overflow: 'hidden',
                                                        transition: 'max-height 0.3s ease-in-out',
                                                        paddingRight: showSubSubMenuToggle ? '100px' : '0' 
                                                    }}
                                                >
                                                    {activeSm.subsubmenus.map((ssm) => (
                                                        <button
                                                            key={ssm.id}
                                                            onClick={() => {
                                                                setActiveSubSubMenuId(ssm.id);
                                                                if (ssm.url) {
                                                                    const targetUrl = ssm.url.startsWith('/') ? ssm.url : '/' + ssm.url;
                                                                    navigate(targetUrl);
                                                                } else {
                                                                    setActiveComponent(null);
                                                                }
                                                            }}
                                                            className={`btn-manage-pill border-0 ${activeSubSubMenuId === ssm.id ? 'active-neon-green' : ''}`}
                                                            style={{
                                                                padding: '8px 20px',
                                                                fontSize: '0.85rem',
                                                                flexShrink: 0,
                                                                background: activeSubSubMenuId === ssm.id ? '#00e676' : (isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'),
                                                                color: activeSubSubMenuId === ssm.id ? '#fff' : (isDark ? 'rgba(255,255,255,0.7)' : '#334155'),
                                                                boxShadow: activeSubSubMenuId === ssm.id ? '0 4px 12px rgba(0, 230, 118, 0.3)' : 'none',
                                                            }}
                                                        >
                                                            <i className="fa fa-circle-notch me-2" style={{ fontSize: '11px', opacity: 0.8 }}></i>
                                                            {ssm.name}
                                                        </button>
                                                    ))}
                                                </div>
                                                {showSubSubMenuToggle && (
                                                    <button 
                                                        onClick={() => setIsSubSubMenuExpanded(!isSubSubMenuExpanded)}
                                                        style={{
                                                            position: 'absolute',
                                                            right: 0,
                                                            top: '16px',
                                                            padding: '4px 12px',
                                                            fontSize: '0.8rem',
                                                            background: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
                                                            color: isDark ? '#fff' : '#1e293b',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            fontWeight: 600,
                                                            zIndex: 2,
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {isSubSubMenuExpanded ? 'Show Less' : 'Show All'}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    }
                                    return null;
                                })()
                            )}

                {/* Content Area */}
                {!activeComponent ? (
                    <>
                        {/* Quick Access Section */}
                        {currentPath.length === 0 && quickAccessItems.length > 0 && (
                            <div className="mb-5">
                                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                                    <div>
                                        <h3 className="fw-bold welcome-text mb-1" style={{ fontSize: '1.6rem', letterSpacing: '-0.5px' }}>
                                            <i className="flaticon-043-menu me-2 text-info"></i> Quick Access Shortcuts
                                        </h3>
                                        <p className="banner-subtext mb-0 fs-13 opacity-70">
                                            Your most visited pages. Drag and drop cards to adjust their positions.
                                        </p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => setShowCustomizeModal(true)}
                                        className="btn btn-primary d-flex align-items-center gap-2"
                                        style={{ 
                                            backgroundColor: '#0a500f', 
                                            borderColor: '#0a500f', 
                                            color: '#ffffff',
                                            height: '34px',
                                            padding: '0 14px',
                                            fontSize: '13px',
                                            fontWeight: 500,
                                            borderRadius: '6px',
                                            boxShadow: '0 2px 6px rgba(61, 53, 119, 0.25)'
                                        }}
                                    >
                                        <i className="fa fa-cog"></i> Customize Shortcuts
                                    </button>
                                </div>
                                
                                <div className="row">
                                    {quickAccessItems.map((item, index) => (
                                        <div 
                                            key={item.id} 
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, index)}
                                            onDragOver={(e) => handleDragOver(e, index)}
                                            onDragEnd={handleDragEnd}
                                            onDrop={(e) => handleDrop(e, index)}
                                            className={`col-xl-3 col-lg-4 col-sm-6 mb-4 quick-access-card-wrapper ${draggedIndex === index ? 'is-dragging' : ''}`}
                                            style={{ 
                                                cursor: 'grab'
                                            }}
                                        >
                                            <div 
                                                className="glass-card quick-access-card h-100 border-0" 
                                                style={{ position: 'relative', cursor: 'pointer' }}
                                                onClick={() => {
                                                    // Track page visit in localStorage
                                                    try {
                                                        const visitCounts = JSON.parse(localStorage.getItem('quick_access_visit_counts') || '{}');
                                                        visitCounts[item.id] = (visitCounts[item.id] || 0) + 1;
                                                        localStorage.setItem('quick_access_visit_counts', JSON.stringify(visitCounts));
                                                        window.dispatchEvent(new Event('quickAccessVisitUpdate'));
                                                    } catch (err) {
                                                        console.error("Error tracking page visit:", err);
                                                    }
                                                    navigate(`/${item.url.replace(/^\/+/, '')}`);
                                                }}
                                            >
                                                <div className="card-body p-4 d-flex flex-column h-100 position-relative" style={{ zIndex: 1 }}>
                                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                                        <div className="quick-access-icon-box" style={{ background: isDark ? 'rgba(0, 210, 255, 0.15)' : '#e6f7ff', border: '1px solid rgba(0, 210, 255, 0.2)' }}>
                                                            <i className={item.icon || 'fa fa-link'} style={{ color: '#00b0ff', fontSize: '20px' }}></i>
                                                        </div>
                                                        <span className="text-uppercase fw-600 ls-1 opacity-50" style={{ fontSize: '0.7rem' }}>
                                                            Shortcut
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="flex-grow-1">
                                                        <div className="text-muted fw-bold mb-1" style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                                                            {item.breadcrumb}
                                                        </div>
                                                        <h5 className="mb-2 fw-bold welcome-text fs-18" style={{ color: isDark ? '#fff' : '#0f172a' }}>{item.title}</h5>
                                                        <p className="banner-subtext mb-4 fs-13 opacity-70" style={{ lineHeight: '1.4' }}>
                                                            {item.description}
                                                        </p>
                                                    </div>
                                                    
                                                    <div className="quick-access-btn mt-auto" style={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'space-between', 
                                                        padding: '10px 16px', 
                                                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f4f6fa',
                                                        borderRadius: '12px',
                                                        transition: 'all 0.3s ease'
                                                    }}>
                                                        <span className="fw-700" style={{ fontSize: '0.85rem', color: isDark ? '#fff' : '#0f172a' }}>
                                                            Manage {item.title}
                                                        </span>
                                                        <i className="fa fa-chevron-right fs-10" style={{ color: '#00d2ff', transition: 'transform 0.3s ease' }}></i>
                                                    </div>
                                                    <div className="card-glass-glow"></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Empty State when no shortcuts are configured */}
                        {quickAccessItems.length === 0 && (
                            <div className="fade-up text-center py-5">
                                <p className="banner-subtext opacity-75 mb-3">
                                    No quick access shortcuts configured yet.
                                </p>
                                <button 
                                    type="button"
                                    onClick={() => setShowCustomizeModal(true)}
                                    className="btn btn-primary d-inline-flex align-items-center gap-2"
                                    style={{ 
                                        backgroundColor: '#0a500f', 
                                        borderColor: '#0a500f', 
                                        color: '#ffffff',
                                        height: '34px',
                                        padding: '0 16px',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        borderRadius: '6px',
                                        boxShadow: '0 2px 6px rgba(61, 53, 119, 0.25)'
                                    }}
                                >
                                    <i className="fa fa-cog"></i> Customize Shortcuts
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="fade-up mt-4 w-100 embedded-module-container"
                         onClickCapture={handleEmbeddedClick}
                         style={{ 
                            background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#fff', 
                            borderRadius: '16px', 
                            border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.05)', 
                            boxShadow: isDark ? '0 10px 40px rgba(0, 0, 0, 0.4)' : '0 10px 30px rgba(0,0,0,0.05)',
                            overflow: 'hidden'
                         }}>
                        <div style={{ minHeight: '600px', padding: '24px' }}>
                            {React.isValidElement(activeComponent) 
                                ? React.cloneElement(activeComponent, { embedded: true }) 
                                : activeComponent}
                        </div>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .dashboard-theme-parent {
                    position: relative;
                    min-height: 100vh;
                    transition: all 0.5s ease;
                    font-family: 'Inter', sans-serif;
                }

                .welcome-text { transition: color 0.3s ease; }
                .banner-subtext { transition: color 0.3s ease; }

                .glass-card {
                    backdrop-filter: blur(12px) !important;
                    border-radius: 12px !important;
                    transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
                    background: ${isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.9)'} !important;
                    border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'} !important;
                    box-shadow: ${isDark ? '0 10px 40px rgba(0, 0, 0, 0.4)' : '0 10px 30px rgba(0,0,0,0.05)'} !important;
                }

                .banner-gradient-border {
                    position: relative;
                }
                .banner-gradient-border::after {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0; height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(0, 210, 255, 0.5), transparent);
                }

                .module-card-premium {
                    overflow: hidden;
                    height: 100%;
                }

                .module-card-premium:hover {
                    border-color: #00d2ff !important;
                    box-shadow: ${isDark ? '0 15px 45px rgba(0, 210, 255, 0.15)' : '0 12px 35px rgba(0, 210, 255, 0.1)'} !important;
                    transform: translateY(-5px);
                }

                .module-icon-box-sm {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    background: ${isDark ? 'rgba(0, 210, 255, 0.1)' : 'rgba(0, 210, 255, 0.05)'};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid rgba(0, 210, 255, 0.1);
                }

                .stats-badge-minimal {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                }

                .btn-manage-pill {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0.8rem 1.5rem;
                    background: ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafd'};
                    border-radius: 12px;
                    color: ${isDark ? '#fff' : '#1e293b'} !important;
                    text-decoration: none !important;
                    font-weight: 700;
                    font-size: 0.9rem;
                    transition: all 0.3s ease;
                    border: 1px solid transparent;
                    cursor: pointer;
                }

                .btn-manage-pill:hover {
                    background: #00d2ff !important;
                    color: #fff !important;
                    box-shadow: 0 5px 15px rgba(0, 210, 255, 0.3);
                }

                .active-neon {
                    background: #00d2ff !important;
                    color: #fff !important;
                    box-shadow: 0 5px 15px rgba(0, 210, 255, 0.3);
                }

                .active-neon-green {
                    background: #00e676 !important;
                    color: #fff !important;
                    box-shadow: 0 4px 12px rgba(0, 230, 118, 0.3);
                }

                .card-glass-glow {
                    position: absolute;
                    top: -50%;
                    right: -50%;
                    width: 200px;
                    height: 200px;
                    background: radial-gradient(circle, rgba(0, 210, 255, 0.05) 0%, transparent 70%);
                    pointer-events: none;
                    transition: all 0.6s ease;
                    z-index: 0;
                }

                .live-indicator-neon {
                    display: inline-block;
                    width: 10px;
                    height: 10px;
                    background-color: #00e676;
                    border-radius: 50%;
                    box-shadow: 0 0 12px #00e676;
                    animation: blink 2s infinite;
                }

                @keyframes blink {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(1.2); }
                    100% { opacity: 1; transform: scale(1); }
                }

                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .fade-up {
                    opacity: 0;
                    animation: fadeUp 0.8s cubic-bezier(0.165, 0.84, 0.44, 1) forwards;
                }

                .theme-dark .welcome-text { color: #fff !important; }
                .theme-dark .banner-subtext { color: rgba(255,255,255,0.7) !important; }
                .theme-light .welcome-text { color: #0f172a !important; }
                .theme-light .banner-subtext { color: #475569 !important; }

                .ls-1 { letter-spacing: 1px; }

                /* Embedded Component Global Overrides */
                .embedded-module-container .page-titles {
                    display: none !important;
                }
                .embedded-module-container .card {
                    box-shadow: none !important;
                    border: none !important;
                    background: transparent !important;
                }
                .embedded-module-container .card-header {
                    border-bottom: 2px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} !important;
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                    background: transparent !important;
                }
                .embedded-module-container .card-body {
                    padding: 1.5rem 0 !important;
                }

                .quick-access-icon-box {
                    width: 44px;
                    height: 44px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                }

                .quick-access-card {
                    overflow: hidden;
                    height: 100%;
                    transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
                }

                .quick-access-card:hover {
                    border-color: #00d2ff !important;
                    box-shadow: ${isDark ? '0 15px 45px rgba(0, 210, 255, 0.15)' : '0 12px 35px rgba(0, 210, 255, 0.1)'} !important;
                    transform: translateY(-4px);
                }

                .quick-access-card:hover .quick-access-btn {
                    background: #00d2ff !important;
                }
                
                .quick-access-card:hover .quick-access-btn span {
                    color: #fff !important;
                }
                
                .quick-access-card:hover .quick-access-btn i {
                    color: #fff !important;
                    transform: translateX(3px);
                }

                .quick-access-card-wrapper {
                    transition: transform 0.2s ease, opacity 0.2s ease;
                }

                .quick-access-card-wrapper.is-dragging {
                    opacity: 0.4;
                    transform: scale(0.96);
                    border: 2px dashed #00d2ff !important;
                    border-radius: 12px;
                }
                
                .quick-access-checkbox-card:hover {
                    background: ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9'} !important;
                }
                
                .modal-dark .modal-content {
                    background-color: #0f172a !important;
                    border: 1px solid rgba(255, 255, 255, 0.08) !important;
                    color: #cbd5e1 !important;
                }
                
                .modal-dark .btn-close {
                    filter: invert(1) grayscale(100%) brightness(200%);
                }
                `
            }} />

            {/* Customization Modal */}
            <Modal 
                show={showCustomizeModal} 
                onHide={() => setShowCustomizeModal(false)}
                size="lg"
                centered
                className={`quick-access-modal ${isDark ? 'modal-dark' : 'modal-light'}`}
            >
                <div style={{
                    background: isDark ? '#1e293b' : '#ffffff',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}>
                    {/* Header */}
                    <div className="d-flex align-items-center justify-content-between gap-3" style={{ 
                        background: isDark ? '#1e293b' : '#ffffff', 
                        padding: '20px 24px 16px 24px' 
                    }}>
                        <div className="d-flex align-items-center gap-3">
                            <div 
                                className="form-icon-box"
                                style={{
                                    width: '46px', 
                                    height: '46px', 
                                    borderRadius: '12px',
                                    background: 'var(--form-icon-color, var(--cc-primary, var(--primary, #0a500f)))',
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.12)',
                                    color: '#ffffff'
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                </svg>
                            </div>
                            <div>
                                <h5 style={{ margin: 0, fontWeight: 700, fontSize: '1.15rem', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                    Customize Dashboard Shortcuts
                                </h5>
                                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                                    Select pages to pin to your home dashboard for 1-click access
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowCustomizeModal(false)}
                            aria-label="Close"
                            style={{
                                background: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '1.25rem',
                                lineHeight: 1,
                                color: isDark ? '#94a3b8' : '#64748b',
                                width: '34px',
                                height: '34px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease',
                                flexShrink: 0,
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.12)' : '#e2e8f0';
                                e.currentTarget.style.color = isDark ? '#fff' : '#0f172a';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9';
                                e.currentTarget.style.color = isDark ? '#94a3b8' : '#64748b';
                            }}
                        >
                            &times;
                        </button>
                    </div>

                    <div style={{ padding: '0 24px' }}>
                        <div style={{ borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0' }} />
                    </div>

                    {/* Body */}
                    <div style={{ 
                        maxHeight: '62vh', 
                        overflowY: 'auto',
                        background: isDark ? '#0f172a' : '#f8fafc',
                        color: isDark ? '#cbd5e1' : '#334155',
                        padding: '20px 24px'
                    }}>
                        <div className="mb-4">
                            <div className="d-flex gap-2 mb-3">
                                <div className="position-relative flex-grow-1">
                                    <i className="fa fa-search position-absolute" style={{
                                        left: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: isDark ? '#64748b' : '#94a3b8',
                                        fontSize: '0.85rem'
                                    }}></i>
                                    <input 
                                        type="text" 
                                        className="form-control"
                                        placeholder="Search shortcuts or modules..." 
                                        value={searchTerm} 
                                        onChange={(e) => setSearchTerm(e.target.value)} 
                                        style={{ 
                                            paddingLeft: '34px',
                                            borderRadius: '8px',
                                            fontSize: '0.88rem',
                                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#fff',
                                            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #cbd5e1',
                                            color: isDark ? '#fff' : '#0f172a'
                                        }}
                                    />
                                </div>
                                {searchTerm && (
                                    <button 
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary" 
                                        style={{ borderRadius: '8px', padding: '0 14px' }}
                                        onClick={() => setSearchTerm('')}
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                <div className="d-flex gap-2">
                                    <button 
                                        type="button"
                                        className="btn btn-sm"
                                        style={{ 
                                            borderRadius: '6px', 
                                            fontSize: '0.78rem',
                                            fontWeight: 600,
                                            padding: '4px 12px',
                                            border: '1.5px solid #bfdbfe',
                                            background: isDark ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff',
                                            color: isDark ? '#93c5fd' : '#1d4ed8'
                                        }}
                                        onClick={() => setSelectedPinnedIds(getAllLeafItems(itemsToDisplay).map(l => l.id))}
                                    >
                                        Select All
                                    </button>
                                    <button 
                                        type="button"
                                        className="btn btn-sm"
                                        style={{ 
                                            borderRadius: '6px', 
                                            fontSize: '0.78rem',
                                            fontWeight: 600,
                                            padding: '4px 12px',
                                            border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
                                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#fff',
                                            color: isDark ? '#94a3b8' : '#64748b'
                                        }}
                                        onClick={() => setSelectedPinnedIds([])}
                                    >
                                        Clear All
                                    </button>
                                </div>
                                <span style={{
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    background: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
                                    color: isDark ? '#c7d2fe' : '#4338ca',
                                    border: isDark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid #c7d2fe'
                                }}>
                                    Selected: {selectedPinnedIds.length}
                                </span>
                            </div>
                        </div>
                        
                        {(() => {
                            const allLeafs = getAllLeafItems(itemsToDisplay);
                            const groupedLeafs = {};
                            allLeafs.forEach(leaf => {
                                const moduleName = leaf.breadcrumb.split(' > ')[0] || 'Other';
                                if (!groupedLeafs[moduleName]) {
                                    groupedLeafs[moduleName] = [];
                                }
                                if (searchTerm === '' || leaf.title.toLowerCase().includes(searchTerm.toLowerCase()) || leaf.breadcrumb.toLowerCase().includes(searchTerm.toLowerCase())) {
                                    groupedLeafs[moduleName].push(leaf);
                                }
                            });

                            return (
                                <>
                                    {Object.keys(groupedLeafs).map(moduleName => {
                                        const items = groupedLeafs[moduleName];
                                        if (items.length === 0) return null;
                                        
                                        return (
                                            <div key={moduleName} className="mb-3 p-3 rounded-3" style={{
                                                background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#ffffff',
                                                border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #e2e8f0',
                                                boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                                            }}>
                                                <div className="d-flex align-items-center justify-content-between border-bottom pb-2 mb-3">
                                                    <h6 className="fw-bold mb-0" style={{ 
                                                        fontSize: '0.9rem',
                                                        color: isDark ? '#38bdf8' : '#0284c7',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}>
                                                        <i className="fa fa-folder-open-o"></i> {moduleName}
                                                    </h6>
                                                    <span style={{ fontSize: '0.72rem', color: isDark ? '#64748b' : '#94a3b8', fontWeight: 600 }}>
                                                        {items.filter(i => selectedPinnedIds.includes(i.id)).length} of {items.length} selected
                                                    </span>
                                                </div>
                                                <div className="row g-2">
                                                    {items.map(leaf => {
                                                        const isChecked = selectedPinnedIds.includes(leaf.id);
                                                        return (
                                                            <div key={leaf.id} className="col-md-4 col-sm-6">
                                                                <div 
                                                                    onClick={() => {
                                                                        if (isChecked) {
                                                                            setSelectedPinnedIds(selectedPinnedIds.filter(id => id !== leaf.id));
                                                                        } else {
                                                                            setSelectedPinnedIds([...selectedPinnedIds, leaf.id]);
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        cursor: 'pointer',
                                                                        padding: '10px 12px',
                                                                        borderRadius: '10px',
                                                                        background: isChecked 
                                                                            ? (isDark ? 'rgba(79, 70, 229, 0.18)' : '#eff6ff') 
                                                                            : (isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff'),
                                                                        border: isChecked 
                                                                            ? (isDark ? '1.5px solid #6366f1' : '1.5px solid #3b82f6') 
                                                                            : (isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #e2e8f0'),
                                                                        transition: 'all 0.2s ease',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '10px',
                                                                        height: '100%',
                                                                        boxShadow: isChecked ? '0 2px 8px rgba(59, 130, 246, 0.15)' : 'none'
                                                                    }}
                                                                    className="quick-access-checkbox-card"
                                                                >
                                                                    <div style={{
                                                                        width: '18px',
                                                                        height: '18px',
                                                                        borderRadius: '5px',
                                                                        border: isChecked ? 'none' : (isDark ? '1.5px solid #64748b' : '1.5px solid #cbd5e1'),
                                                                        background: isChecked ? '#3b82f6' : 'transparent',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        flexShrink: 0,
                                                                        transition: 'all 0.15s ease'
                                                                    }}>
                                                                        {isChecked && (
                                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                                                <polyline points="20 6 9 17 4 12"></polyline>
                                                                            </svg>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                                        <div className="fw-bold text-truncate" style={{ 
                                                                            fontSize: '0.84rem', 
                                                                            color: isChecked ? (isDark ? '#93c5fd' : '#1d4ed8') : (isDark ? '#f8fafc' : '#1e293b') 
                                                                        }}>
                                                                            {leaf.title}
                                                                        </div>
                                                                        <div className="text-truncate" style={{ fontSize: '0.7rem', color: isDark ? '#64748b' : '#94a3b8' }}>
                                                                            {leaf.breadcrumb}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    {Object.values(groupedLeafs).every(items => items.length === 0) && (
                                        <div className="text-center py-4 opacity-50">
                                            No matching pages found.
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>

                    {/* Footer */}
                    <div className="d-flex justify-content-end align-items-center gap-2" style={{ 
                        borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
                        background: isDark ? '#1e293b' : '#ffffff',
                        padding: '16px 24px'
                    }}>
                        <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 20px' }} 
                            onClick={() => setShowCustomizeModal(false)}
                        >
                            Cancel
                        </button>
                        <button 
                            type="button" 
                            className="btn btn-primary" 
                            style={{ padding: '6px 20px' }} 
                            onClick={() => handleSavePins(selectedPinnedIds)}
                        >
                            Save
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default QuickAccessDashboard;
