import React, { useContext, useReducer, useState, useEffect, useRef } from "react";
import { Collapse } from 'react-bootstrap';
/// Scroll
import PerfectScrollbar from "react-perfect-scrollbar";
/// Link
import { Link, useLocation } from "react-router-dom";
import { useScrollPosition } from "@n8tb1t/use-scroll-position";

import { ThemeContext } from "../../../context/ThemeContext";
import { useDispatch, useSelector } from 'react-redux';
import { fetchUserMenusAction } from '../../../store/actions/MenuActions';
import { transformMenusToFrontendFormat } from '../../../services/MenuService';

import { usePermission } from '../../../hooks/usePermission';
import CrmPurposeModal from '../../components/crm_new/CrmPurposeModal';
import CrmOfferModal from '../../components/crm_new/CrmOfferModal';

const reducer = (previousState, updatedState) => ({
  ...previousState,
  ...updatedState,
});

const initialState = {
  active: "",
  activeSubmenu: "",
}


const SideBar = () => {

  const dispatch = useDispatch();
  const { menus: dynamicMenus } = useSelector(state => state.menu);

  // Bring in the permission checking function
  const { can } = usePermission();

  const [showPurposeModal, setShowPurposeModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);

  useEffect(() => {
    const handleOpenPurpose = () => setShowPurposeModal(true);
    const handleOpenOffer = () => setShowOfferModal(true);
    window.addEventListener('open-crm-purpose-modal', handleOpenPurpose);
    window.addEventListener('open-crm-offer-modal', handleOpenOffer);
    return () => {
      window.removeEventListener('open-crm-purpose-modal', handleOpenPurpose);
      window.removeEventListener('open-crm-offer-modal', handleOpenOffer);
    };
  }, []);

  const {
    iconHover,
    sidebarposition,
    headerposition,
    sidebarLayout,
    ChangeIconSidebar
  } = useContext(ThemeContext);
  const [state, setState] = useReducer(reducer, initialState);

  // Fetch menus on component mount
  useEffect(() => {
    dispatch(fetchUserMenusAction());
  }, [dispatch]);

  // Transform dynamic menus for display.
  // The user-menus endpoint already enforces server-side permission filtering,
  // so we trust its response directly. We only additionally filter sub-submenus
  // by the serializer's own can_view field as a lightweight client-side guard.
  const menusToDisplay = React.useMemo(() => {
    if (Array.isArray(dynamicMenus) && dynamicMenus.length > 0) {
      const transformed = transformMenusToFrontendFormat(dynamicMenus);

      return transformed.map(menu => {
        // Menu Level Check
        let menuCanView = true;
        if (typeof menu.can_view === 'boolean') {
          menuCanView = menu.can_view;
        } else if (menu.code) {
          menuCanView = can(menu.code, 'view');
        }
        if (!menuCanView) return null;

        if (!Array.isArray(menu.content)) {
          return menu;
        }

        const mappedMenuContent = menu.content
          .filter(submenu => {
            // Submenu Level Check
            let submenuCanView = true;
            if (typeof submenu.can_view === 'boolean') {
              submenuCanView = submenu.can_view;
            } else if (submenu.code) {
              submenuCanView = can(submenu.code, 'view');
            }
            return submenuCanView;
          })
          .map(submenu => {
            if (!Array.isArray(submenu.content)) {
              return submenu;
            }

            // Sub-submenu Level Check
            const filteredSubSubmenus = submenu.content.filter(ssm => {
              if (typeof ssm.can_view === 'boolean') return ssm.can_view;
              if (!ssm.code) return true;
              return can(ssm.code, 'view');
            });

            if (filteredSubSubmenus.length === 0) return null;

            return {
              ...submenu,
              content: filteredSubSubmenus
            };
          })
          .filter(submenu => submenu !== null);

        if (mappedMenuContent.length === 0) return null;

        return {
          ...menu,
          content: mappedMenuContent
        };
      }).filter(menu => menu !== null);
    }
    return [];
  }, [dynamicMenus, can]);


  // For scroll
  const [hideOnScroll, setHideOnScroll] = useState(true)
  useScrollPosition(
    ({ prevPos, currPos }) => {
      const isShow = currPos.y > prevPos.y
      if (isShow !== hideOnScroll) setHideOnScroll(isShow)
    },
    [hideOnScroll]
  )


  const location = useLocation();

  const handleMenuActive = status => {
    setState({ active: state.active === status ? "" : status });
  }
  const handleSubmenuActive = (status) => {
    setState({ activeSubmenu: state.activeSubmenu === status ? "" : status });
  }

  // Route normalizer
  const normalizeRoute = (r) => {
    if (!r || typeof r !== 'string') return '';
    const cleanUrl = r.split('?')[0].split('#')[0].trim().toLowerCase();
    if (!cleanUrl || cleanUrl === '#') return '';
    let res = cleanUrl.startsWith('/') ? cleanUrl : '/' + cleanUrl;
    if (res.endsWith('/') && res.length > 1) res = res.slice(0, -1);
    return res;
  };

  const isLinkActive = (targetUrl) => {
    const t = normalizeRoute(targetUrl);
    if (!t) return false;
    const c = normalizeRoute(location.pathname);
    return c === t || (t !== '/' && c.startsWith(t + '/'));
  };

  const lastSyncedPathRef = useRef(null);

  // Synchronize active menu and submenu on direct URL navigation / page refresh only
  useEffect(() => {
    if (!Array.isArray(menusToDisplay) || menusToDisplay.length === 0) return;
    const normalizedCurrent = normalizeRoute(location.pathname);
    if (!normalizedCurrent) return;

    // Guard: Do not overwrite the user's manual expand/collapse toggles if the route has not changed!
    if (lastSyncedPathRef.current === normalizedCurrent) return;

    // 1. Exact match check (deepest child sub-submenu first)
    for (const menu of menusToDisplay) {
      if (Array.isArray(menu.content)) {
        for (const subItem of menu.content) {
          if (Array.isArray(subItem.content)) {
            for (const childItem of subItem.content) {
              if (normalizeRoute(childItem.to) === normalizedCurrent) {
                lastSyncedPathRef.current = normalizedCurrent;
                setState({ active: menu.title, activeSubmenu: subItem.title });
                return;
              }
            }
          } else if (normalizeRoute(subItem.to) === normalizedCurrent) {
            lastSyncedPathRef.current = normalizedCurrent;
            setState({ active: menu.title, activeSubmenu: "" });
            return;
          }
        }
      } else if (normalizeRoute(menu.to) === normalizedCurrent) {
        lastSyncedPathRef.current = normalizedCurrent;
        setState({ active: menu.title, activeSubmenu: "" });
        return;
      }
    }

    // 2. Prefix match fallback (e.g. /access-point/gate-entry/42 -> gate-entry)
    for (const menu of menusToDisplay) {
      if (Array.isArray(menu.content)) {
        for (const subItem of menu.content) {
          if (Array.isArray(subItem.content)) {
            for (const childItem of subItem.content) {
              const t = normalizeRoute(childItem.to);
              if (t && t !== '/' && normalizedCurrent.startsWith(t + '/')) {
                lastSyncedPathRef.current = normalizedCurrent;
                setState({ active: menu.title, activeSubmenu: subItem.title });
                return;
              }
            }
          } else {
            const t = normalizeRoute(subItem.to);
            if (t && t !== '/' && normalizedCurrent.startsWith(t + '/')) {
              lastSyncedPathRef.current = normalizedCurrent;
              setState({ active: menu.title, activeSubmenu: "" });
              return;
            }
          }
        }
      } else {
        const t = normalizeRoute(menu.to);
        if (t && t !== '/' && normalizedCurrent.startsWith(t + '/')) {
          lastSyncedPathRef.current = normalizedCurrent;
          setState({ active: menu.title, activeSubmenu: "" });
          return;
        }
      }
    }

    lastSyncedPathRef.current = normalizedCurrent;
  }, [location.pathname, menusToDisplay]);

  return (
    <div
      onMouseEnter={() => ChangeIconSidebar(true)}
      onMouseLeave={() => ChangeIconSidebar(false)}
      className={`deznav ${iconHover} ${sidebarposition.value === "fixed" &&
        sidebarLayout.value === "horizontal" &&
        headerposition.value === "static"
        ? hideOnScroll > 120
          ? "fixed"
          : ""
        : ""
        }`}
    >
      {/* <Link to={"#"} className="add-project-sidebar btn btn-primary" onClick={()=>setNewProject(true)}>+ New Project</Link> */}
      <PerfectScrollbar className="deznav-scroll">
        <ul className="metismenu" id="menu">
          {menusToDisplay.map((data, index) => {
            let menuClass = data.classsChange;
            if (menuClass === "menu-title") {
              return (
                <li className={menuClass} key={index} >{data.title}</li>
              )
            } else {
              return (
                <li className={` ${state.active === data.title ? 'mm-active' : ''}`}
                  key={index}
                >
                  {data.content && data.content.length > 0 ?
                    <Link to={"#"}
                      className="has-arrow"
                      onClick={() => { handleMenuActive(data.title) }}
                    >
                      {typeof data.iconStyle === 'string' ? <i className={data.iconStyle} /> : data.iconStyle}{" "}
                      <span className="nav-text">{data.title}</span>
                    </Link>
                    :
                    <Link to={data.to ? (data.to.startsWith('/') ? data.to : '/' + data.to) : '#'}>
                      {typeof data.iconStyle === 'string' ? <i className={data.iconStyle} /> : data.iconStyle}
                      <span className="nav-text">{data.title}</span>
                    </Link>
                  }
                  <Collapse in={state.active === data.title ? true : false}>
                    <ul className={`${menuClass === "mm-collapse" ? "mm-show" : ""}`}>
                      {data.content && data.content.map((subItem, subIndex) => {
                        return (
                          <li key={subIndex}
                            className={`${state.activeSubmenu === subItem.title ? "mm-active" : ""}`}
                          >
                            {subItem.content && subItem.content.length > 0 ?
                              <>
                                <Link to="#" className={subItem.hasMenu ? 'has-arrow' : ''}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleSubmenuActive(subItem.title);
                                  }}
                                >
                                  <span className="nav-text">{subItem.title}</span>
                                </Link>
                                <Collapse in={state.activeSubmenu === subItem.title ? true : false}>
                                  <ul className={`${menuClass === "mm-collapse" ? "mm-show" : ""}`}>
                                    {subItem.content && subItem.content.map((childItem, childIndex) => {
                                      const isOfferModal = childItem.code === 'crm_offer_modal' || childItem.to === '#offer' || childItem.to === '#offers';
                                      const isPurpose = (childItem.title && childItem.title.toLowerCase() === 'purpose') || childItem.code === 'crm_purpose' || childItem.to === '#purpose';
                                      const targetTo = isPurpose ? '/crm/purposes' : (childItem.to ? (childItem.to.startsWith('/') ? childItem.to : '/' + childItem.to) : '#');
                                      return (
                                        <li key={childIndex}>
                                          <Link
                                            className={`${isLinkActive(childItem.to || targetTo) ? "mm-active" : ""}`}
                                            to={isOfferModal ? "#" : targetTo}
                                            onClick={(e) => {
                                              if (isOfferModal) {
                                                e.preventDefault();
                                                setShowOfferModal(true);
                                              }
                                            }}
                                          >
                                            <span className="nav-text">{childItem.title}</span>
                                          </Link>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </Collapse>
                              </>
                              :
                              (() => {
                                const isOfferModal = subItem.code === 'crm_offer_modal' || subItem.to === '#offer' || subItem.to === '#offers';
                                const isPurpose = (subItem.title && subItem.title.toLowerCase() === 'purpose') || subItem.code === 'crm_purpose' || subItem.to === '#purpose';
                                const targetTo = isPurpose ? '/crm/purposes' : (subItem.to ? (subItem.to.startsWith('/') ? subItem.to : '/' + subItem.to) : '#');
                                return (
                                  <Link
                                    className={`${isLinkActive(subItem.to || targetTo) ? "mm-active" : ""}`}
                                    to={isOfferModal ? "#" : targetTo}
                                    onClick={(e) => {
                                      if (isOfferModal) {
                                        e.preventDefault();
                                        setShowOfferModal(true);
                                      }
                                    }}
                                  >
                                    <span className="nav-text">{subItem.title}</span>
                                  </Link>
                                );
                              })()
                            }

                          </li>

                        )
                      })}
                    </ul>
                  </Collapse>
                </li>
              )
            }
          })}
        </ul>
        {/* <div className="copyright">
            <p><strong>Fasto React Admin Dashboard</strong> © {d.getFullYear()} All Rights Reserved</p>
            <p className="fs-12">Made with 
              <span className={`heart ${ btnHeart ? 'heart-blast' : ''}`}
                onClick={()=>setBtnHeart(!btnHeart)}
              ></span> 
              by DexignZone</p>
          </div> */}
      </PerfectScrollbar>
      <CrmPurposeModal show={showPurposeModal} onHide={() => setShowPurposeModal(false)} />
      <CrmOfferModal show={showOfferModal} onHide={() => setShowOfferModal(false)} />
    </div>
  );
};

export default SideBar;
