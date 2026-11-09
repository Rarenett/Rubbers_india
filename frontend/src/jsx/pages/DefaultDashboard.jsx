import React, { useState, useEffect, Fragment, useContext, useRef } from 'react';
import { Link, matchPath, useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchUserMenusAction } from '../../store/actions/MenuActions';
import { ThemeContext } from "../../context/ThemeContext";
import { usePermission } from '../../hooks/usePermission';

const DefaultDashboard = ({ allroutes }) => {
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
    const itemsToDisplay = (dynamicMenus || [])
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
            if (!href.startsWith('/default-dashboard')) {
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

                {/* Welcome / Hub Banner */}
                <div className="mb-4">
                            {/* <div className="d-flex justify-content-between align-items-center w-100 mb-0">
                                <div className="z-index-1">
                                    <h1 className="mb-3 fw-light welcome-text" style={{ fontSize: '2.8rem', letterSpacing: '-1.2px' }}>
                                        {currentPath.length === 0 ? 'Welcome to ' : 'The '}
                                        <span className="fw-bold" style={{ color: '#00d2ff', textShadow: isDark ? '0 0 20px rgba(0, 210, 255, 0.3)' : 'none' }}>
                                            {currentPath.length === 0 ? 'Dashboard' : `${currentPath[0].title.replace(/\s+Point$/i, '')}Core`}
                                        </span>
                                        {currentPath.length === 0 ? '' : ' Hub'}
                                    </h1>
                                    <p className="mb-0 banner-subtext fs-18 max-w-600 opacity-70">
                                        {currentPath.length === 0 
                                            ? 'Strategic infrastructure management for your business processes.' 
                                            : `Advanced management and monitoring for the ${currentPath[0].title.toLowerCase()} module.`}
                                    </p>
                                </div>
                                <div className="text-end z-index-1 d-none d-md-block" style={{ minWidth: '200px' }}>
                                    <div className="mb-0">
                                        <span className="fw-900 welcome-text" style={{ fontSize: '1.8rem', lineHeight: '1.2', color: '#fff', display: 'block' }}>
                                            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                                        </span>
                                    </div>
                                    <div className="mb-2">
                                        <span className="banner-subtext fw-500" style={{ fontSize: '0.95rem', opacity: 0.6, display: 'block' }}>
                                            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <div className="d-flex align-items-center justify-content-end gap-2">
                                        <span className="live-indicator-neon"></span>
                                        <span className="fw-800 ls-1 text-uppercase" style={{ color: '#00e676', fontSize: '0.85rem' }}>System Active</span>
                                    </div>
                                </div>
                            </div> */}

                            {/* Navigation Tabs (Inside the Banner) - Submenus */}
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
                                            paddingRight: showSubMenuToggle ? '100px' : '0' // Make space for the absolute toggle button
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
                                                        const targetUrl = (sm.url || sm.to).startsWith('/') ? (sm.url || sm.to) : '/' + (sm.url || sm.to);
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
                                                top: '24px', // Aligns vertically with the top row of tabs (adjust relative to spacing)
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
                                                        maxHeight: isSubSubMenuExpanded ? '1000px' : '38px', // slightly smaller pill
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
                                                            top: '16px', // Align visually
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
                </div>

                {/* Content Area */}
                {!activeComponent ? (
                    <>
                        {/* Content Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                            gap: '24px',
                        }}>
                    {currentPath.length === 0 && itemsToDisplay.map((card, index) => (
                        <div key={card.id || index} className="fade-up h-100" style={{ animationDelay: `${0.1 + (index * 0.1)}s` }}>
                            <div 
                                className="glass-card module-card-premium h-100 border-0" 
                                style={{ cursor: 'pointer', position: 'relative' }}
                                onClick={() => {
                                    if (card.url) {
                                        const targetUrl = card.url.startsWith('/') ? card.url : '/' + card.url;
                                        navigate(targetUrl);
                                    } else {
                                        handleDrillDown(card);
                                    }
                                }}
                            >
                                <div className="card-body p-4 d-flex flex-column h-100 position-relative" style={{ zIndex: 1 }}>
                                    <div className="d-flex justify-content-between align-items-start mb-4">
                                        <div className="module-icon-box-sm">
                                            <i className={card.icon || 'fa fa-layer-group'} style={{ color: '#00d2ff', fontSize: '24px' }}></i>
                                        </div>
                                    </div>
                                    <div className="flex-grow-1">
                                        <h5 className="mb-2 fw-bold welcome-text fs-18">{card.name || card.title}</h5>
                                        <p className="banner-subtext mb-4 fs-14 opacity-70" style={{ lineHeight: '1.5' }}>
                                            {card.description || `Register and manage ${(card.name || card.title || 'item').toLowerCase()} configurations.`}
                                        </p>
                                    </div>
                                    <div className="btn-manage-pill mt-auto">
                                        <span>Manage {(card.name || card.title).split(' ')[0]}</span>
                                        <i className="fa fa-chevron-right ms-2 fs-10"></i>
                                    </div>
                                    <div className="card-glass-glow"></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Empty State */}
                {currentPath.length === 0 && itemsToDisplay.length === 0 && (
                    <div className="fade-up text-center py-5 banner-subtext opacity-50">
                        No menus available.
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
                `
            }} />
        </div>
    );
};

export default DefaultDashboard;
