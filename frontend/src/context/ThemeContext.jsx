import React, { createContext, useEffect, useState, useRef } from "react";
import {dezThemeSet} from './ThemeDemo';

export const ThemeContext = createContext();

const hexToHsl = (hex) => {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
};

const hslToHex = (h, s, l) => {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    let p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  const toHex = x => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const hexDarken = (hex, amount) => {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, s, Math.max(0, l - amount));
};

const applyCustomThemeStyles = (primaryHex, navHeaderHex, headerHex, sidebarHex) => {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;

  // Primary
  root.style.setProperty('--cc-primary', primaryHex);
  root.style.setProperty('--cc-primary-dark', hexDarken(primaryHex, 8));
  const pr = parseInt(primaryHex.slice(1, 3), 16);
  const pg = parseInt(primaryHex.slice(3, 5), 16);
  const pb = parseInt(primaryHex.slice(5, 7), 16);
  root.style.setProperty('--cc-primary-rgb', `${pr},${pg},${pb}`);

  // Navigation Header
  root.style.setProperty('--cc-nav-header', navHeaderHex);

  // Top Header
  root.style.setProperty('--cc-header', headerHex);

  // Sidebar
  root.style.setProperty('--cc-sidebar', sidebarHex);
  root.style.setProperty('--cc-sidebar-dark', hexDarken(sidebarHex, 10));
};


const customPrimaryColorLocal = (hex) => {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
};

const ThemeContextProvider = (props) => {
  const [sideBarStyle, setSideBarStyle] = useState(() => {
    const saved = localStorage.getItem("sideBarStyle");
    return saved ? JSON.parse(saved) : { value: "full", label: "Full" };
  });
  const [sidebarposition, setSidebarposition] = useState(() => {
    const saved = localStorage.getItem("sidebarposition");
    return saved ? JSON.parse(saved) : { value: "fixed", label: "Fixed" };
  });
  const [headerposition, setHeaderposition] = useState(() => {
    const saved = localStorage.getItem("headerposition");
    return saved ? JSON.parse(saved) : { value: "fixed", label: "Fixed" };
  });
  const [sidebarLayout, setSidebarLayout] = useState(() => {
    const saved = localStorage.getItem("sidebarLayout");
    return saved ? JSON.parse(saved) : { value: "vertical", label: "Vertical" };
  });
  const [direction, setDirection] = useState(() => {
    const saved = localStorage.getItem("direction");
    return saved ? JSON.parse(saved) : { value: "ltr", label: "LTR" };
  });
  const [primaryColor, setPrimaryColor] = useState(
    localStorage.getItem("primaryColor") || "color_1"
  );
  const [navigationHader, setNavigationHader] = useState(
    localStorage.getItem("navigationHader") || "color_1"
  );
  const [haderColor, setHaderColor] = useState(
    localStorage.getItem("haderColor") || "color_1"
  );
  const [sidebarColor, setSidebarColor] = useState(
    localStorage.getItem("sidebarColor") || "color_1"
  );
  const [background, setBackground] = useState(() => {
    const saved = localStorage.getItem("themeVersion") || "light";
    return { value: saved, label: saved.charAt(0).toUpperCase() + saved.slice(1) };
  });
  const [containerPosition_, setcontainerPosition_] = useState(() => {
    const saved = localStorage.getItem("containerPosition_");
    return saved ? JSON.parse(saved) : { value: "wide", label: "Wide" };
  });
  const [bodyFont, setBodyFont] = useState(
    localStorage.getItem("bodyFont") || "poppins"
  );
  const [iconHover, setIconHover] = useState(false);
  const [menuToggle, setMenuToggle] = useState(false);
  const [chatBoxToggle, setChatBox] = useState(false);    
  const [sidebariconHover, setSidebariconHover] = useState(false);
  const body = document.querySelector("body");
  const [windowWidth, setWindowWidth] = useState(0);
  const [windowHeight, setWindowHeight] = useState(0);
  const [formIconColor, setFormIconColor] = useState(
    localStorage.getItem("formIconColor") || "#0a500f"
  );

    const changeFormIconColor = (color) => {
      setFormIconColor(color);
      localStorage.setItem("formIconColor", color);
      patchThemeToBackend({ theme_form_icon_color: color });
    };

  useEffect(() => {
    document.documentElement.style.setProperty('--form-icon-color', formIconColor);
  }, [formIconColor]);

  const [customPrimaryColor, setCustomPrimaryColor] = useState(
    localStorage.getItem("customPrimaryColor") || "#0a500f"
  );

  const [customBgColor, setCustomBgColor] = useState(
    localStorage.getItem("customBgColor") || ""
  );

  const [customFontColor, setCustomFontColor] = useState(
    localStorage.getItem("customFontColor") || ""
  );

  const [customNavHeaderColor, setCustomNavHeaderColor] = useState(
    localStorage.getItem("customNavHeaderColor") || "#0a500f"
  );

  const [customHeaderColor, setCustomHeaderColor] = useState(
    localStorage.getItem("customHeaderColor") || "#0a500f"
  );

  const [customSidebarColor, setCustomSidebarColor] = useState(
    localStorage.getItem("customSidebarColor") || "#0a500f"
  );

  const [customSidebarFontColor, setCustomSidebarFontColor] = useState(
    localStorage.getItem("customSidebarFontColor") || ""
  );

  // ── Fetch theme from backend on mount (works in any browser, not just first one) ──
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
    fetch(`${backendUrl}/api/settings/company/branding/`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;

        // Cache the company ID so patch requests are direct and fast
        if (data.id) {
          localStorage.setItem('companyId', data.id);
        }
            try {
              const userDetailsStr = localStorage.getItem('userDetails');
              if (userDetailsStr) {
                const userDetails = JSON.parse(userDetailsStr);
                fetch(`${backendUrl}/api/settings/company-financial-years/?company=${data.id}`, {
                    headers: { Authorization: `Bearer ${userDetails.access}` }
                })
                .then(res => res.ok ? res.json() : null)
                .then(fyData => {
                    if (fyData && Array.isArray(fyData)) {
                        const activeFy = fyData.find(fy => fy.is_active);
                        if (activeFy) {
                            localStorage.setItem('active_fy_start', activeFy.start_date);
                            localStorage.setItem('active_fy_end', activeFy.end_date);
                            window.dispatchEvent(new Event('financialYearUpdate'));
                        }
                    }
                }).catch(() => {});
              }
            } catch (e) {}

        // Apply theme version
        if (data.theme_version) {
          const v = data.theme_version;
          document.body.setAttribute('data-theme-version', v);
          setBackground({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) });
          localStorage.setItem('themeVersion', v);
        }

        // Navigation Header Background
        if (data.theme_nav_header_color) {
          setCustomNavHeaderColor(data.theme_nav_header_color);
          localStorage.setItem('customNavHeaderColor', data.theme_nav_header_color);
          setNavigationHader('color_custom');
          document.body.setAttribute('data-nav-headerbg', 'color_custom');
          localStorage.setItem('navigationHader', 'color_custom');
        } else {
          setNavigationHader('color_1');
          document.body.setAttribute('data-nav-headerbg', 'color_1');
          localStorage.setItem('navigationHader', 'color_1');
          setCustomNavHeaderColor('#0a500f');
          localStorage.setItem('customNavHeaderColor', '#0a500f');
        }

        // Top Header Background
        if (data.theme_header_color) {
          setCustomHeaderColor(data.theme_header_color);
          localStorage.setItem('customHeaderColor', data.theme_header_color);
          setHaderColor('color_custom');
          document.body.setAttribute('data-headerbg', 'color_custom');
          localStorage.setItem('haderColor', 'color_custom');
        } else {
          setHaderColor('color_1');
          document.body.setAttribute('data-headerbg', 'color_1');
          localStorage.setItem('haderColor', 'color_1');
          setCustomHeaderColor('#0a500f');
          localStorage.setItem('customHeaderColor', '#0a500f');
        }

        // Sidebar Background
        if (data.theme_sidebar_color) {
          setCustomSidebarColor(data.theme_sidebar_color);
          localStorage.setItem('customSidebarColor', data.theme_sidebar_color);
          setSidebarColor('color_custom');
          document.body.setAttribute('data-sibebarbg', 'color_custom');
          localStorage.setItem('sidebarColor', 'color_custom');
        } else {
          setSidebarColor('color_1');
          document.body.setAttribute('data-sibebarbg', 'color_1');
          localStorage.setItem('sidebarColor', 'color_1');
          setCustomSidebarColor('#0a500f');
          localStorage.setItem('customSidebarColor', '#0a500f');
        }

        // Sidebar Font Color
        if (data.theme_sidebar_font_color) {
          setCustomSidebarFontColor(data.theme_sidebar_font_color);
          localStorage.setItem('customSidebarFontColor', data.theme_sidebar_font_color);
        } else {
          setCustomSidebarFontColor('');
          localStorage.removeItem('customSidebarFontColor');
        }

        // Primary Color
        if (data.theme_primary_color) {
          setCustomPrimaryColor(data.theme_primary_color);
          localStorage.setItem('customPrimaryColor', data.theme_primary_color);
          setPrimaryColor('color_custom');
          document.body.setAttribute('data-primary', 'color_custom');
          localStorage.setItem('primaryColor', 'color_custom');
        } else {
          setPrimaryColor('color_1');
          document.body.setAttribute('data-primary', 'color_1');
          localStorage.setItem('primaryColor', 'color_1');
          setCustomPrimaryColor('#0a500f');
          localStorage.setItem('customPrimaryColor', '#0a500f');
        }

        // Background Color
        if (data.theme_bg_color) {
          setCustomBgColor(data.theme_bg_color);
          localStorage.setItem('customBgColor', data.theme_bg_color);
        } else {
          setCustomBgColor('');
          localStorage.removeItem('customBgColor');
        }

        // Font Color
        if (data.theme_font_color) {
          setCustomFontColor(data.theme_font_color);
          localStorage.setItem('customFontColor', data.theme_font_color);
        } else {
          setCustomFontColor('');
          localStorage.removeItem('customFontColor');
        }

        // Form Icon Color
        if (data.theme_form_icon_color) {
          setFormIconColor(data.theme_form_icon_color);
          localStorage.setItem('formIconColor', data.theme_form_icon_color);
          document.documentElement.style.setProperty('--form-icon-color', data.theme_form_icon_color);
        } else {
          setFormIconColor('#0a500f');
          localStorage.setItem('formIconColor', '#0a500f');
          document.documentElement.style.setProperty('--form-icon-color', '#0a500f');
        }
      })
      .catch(() => { /* silently ignore — localStorage values remain */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helper: PATCH theme colours to backend so any browser picks them up ──
  const pendingPatch = useRef({});
  const patchTimeout = useRef(null);

  const patchThemeToBackend = (patch) => {
    // Accumulate the patch object
    pendingPatch.current = { ...pendingPatch.current, ...patch };

    // Clear previous timeout if user is still dragging the color picker
    if (patchTimeout.current) clearTimeout(patchTimeout.current);

    // Set new timeout (debounce)
    patchTimeout.current = setTimeout(() => {
      const finalPatch = pendingPatch.current;
      pendingPatch.current = {}; // Reset for next batch

      try {
        const userDetails = localStorage.getItem('userDetails');
        if (!userDetails) return;
        const { access } = JSON.parse(userDetails);
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
        
        // Directly patch if companyId is cached!
        const id = localStorage.getItem('companyId');
        if (id) {
          fetch(`${backendUrl}/api/settings/company/${id}/`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(finalPatch)
          });
        } else {
          // Fallback if not cached yet
          fetch(`${backendUrl}/api/settings/company/`, {
            headers: { Authorization: `Bearer ${access}` }
          })
            .then(r => r.ok ? r.json() : null)
            .then(list => {
              if (!list || !list.length) return;
              const companyId = list[0].id;
              localStorage.setItem('companyId', companyId);
              fetch(`${backendUrl}/api/settings/company/${companyId}/`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(finalPatch)
              });
            })
            .catch(() => {});
        }
      } catch {}
    }, 800); // 800ms debounce
  };

    // layout
    const layoutOption = [
      { value: "vertical", label: "Vertical" },
      { value: "horizontal", label: "Horizontal" },
    ];
    const sideBarOption = [
      { value: "compact", label: "Compact" },
      { value: "full", label: "Full" },
      { value: "mini", label: "Mini" },
      { value: "modern", label: "Modern" },
      { value: "overlay", label: "Overlay" },
      { value: "icon-hover", label: "Icon-hover" },
    ];
    const backgroundOption = [
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
    ];
    const sidebarpositions = [
      { value: "fixed", label: "Fixed" },
      { value: "static", label: "Static" },
    ];
    const headerPositions = [
      { value: "fixed", label: "Fixed" },
      { value: "static", label: "Static" },
    ];
    const containerPosition = [
      { value: "wide-boxed", label: "Wide Boxed" },
      { value: "boxed", label: "Boxed" },
      { value: "wide", label: "Wide" },
    ];
    const colors = [
      "color_1",
      "color_2",
      "color_3",
      "color_4",
      "color_5",
      "color_6",
      "color_7",
      "color_8",
      "color_9",
      "color_10",
      "color_11",
      "color_12",
      "color_13",
      "color_14",
      "color_15",
    ];
    const directionPosition = [
      { value: "ltr", label: "LTR" },
      { value: "rtl", label: "RTL" },
    ];
    const fontFamily = [
      { value: "roboto", label: "Roboto" },
      { value: "poppins", label: "Poppins" },
      { value: "opensans", label: "Open Sans" },
      { value: "HelveticaNeue", label: "HelveticaNeue" },
    ];
    const changePrimaryColor = (name) => {
      setPrimaryColor(name);
      body.setAttribute("data-primary", name);
      localStorage.setItem("primaryColor", name);
    };
    const changeCustomPrimaryColor = (color) => {
      setCustomPrimaryColor(color);
      localStorage.setItem("customPrimaryColor", color);
      changePrimaryColor("color_custom");
      patchThemeToBackend({ theme_primary_color: color });
    };
    const changeNavigationHader = (name) => {
      setNavigationHader(name);
      body.setAttribute("data-nav-headerbg", name);
      localStorage.setItem("navigationHader", name);
    };
    const changeCustomNavHeaderColor = (color) => {
      setCustomNavHeaderColor(color);
      localStorage.setItem("customNavHeaderColor", color);
      changeNavigationHader("color_custom");
      patchThemeToBackend({ theme_nav_header_color: color });
    };
    const chnageHaderColor = (name) => {
      setHaderColor(name);
      body.setAttribute("data-headerbg", name);
      localStorage.setItem("haderColor", name);
    };
    const changeCustomHeaderColor = (color) => {
      setCustomHeaderColor(color);
      localStorage.setItem("customHeaderColor", color);
      chnageHaderColor("color_custom");
      patchThemeToBackend({ theme_header_color: color });
    };
    const chnageSidebarColor = (name) => {
      setSidebarColor(name);
      body.setAttribute("data-sibebarbg", name);
      localStorage.setItem("sidebarColor", name);
    };
    const changeCustomSidebarColor = (color) => {
      setCustomSidebarColor(color);
      localStorage.setItem("customSidebarColor", color);
      chnageSidebarColor("color_custom");
      patchThemeToBackend({ theme_sidebar_color: color });
    };

    const resetToDefault = (mode = 'light') => {
      // 1. Reset preset selectors back to color_1 (default)
      setPrimaryColor("color_1");
      body.setAttribute("data-primary", "color_1");
      localStorage.setItem("primaryColor", "color_1");

      setNavigationHader("color_1");
      body.setAttribute("data-nav-headerbg", "color_1");
      localStorage.setItem("navigationHader", "color_1");

      setHaderColor("color_1");
      body.setAttribute("data-headerbg", "color_1");
      localStorage.setItem("haderColor", "color_1");

      setSidebarColor("color_1");
      body.setAttribute("data-sibebarbg", "color_1");
      localStorage.setItem("sidebarColor", "color_1");

      // 2. Set theme version
      body.setAttribute("data-theme-version", mode);
      setBackground({ value: mode, label: mode.charAt(0).toUpperCase() + mode.slice(1) });
      localStorage.setItem("themeVersion", mode);

      // 3. Clear all custom colors from state and localStorage
      setCustomPrimaryColor("#0a500f");
      localStorage.setItem("customPrimaryColor", "#0a500f");

      setCustomNavHeaderColor("#0a500f");
      localStorage.setItem("customNavHeaderColor", "#0a500f");

      setCustomHeaderColor("#0a500f");
      localStorage.setItem("customHeaderColor", "#0a500f");

      setCustomSidebarColor("#0a500f");
      localStorage.setItem("customSidebarColor", "#0a500f");

      setCustomSidebarFontColor("");
      localStorage.removeItem("customSidebarFontColor");
      body.classList.remove('has-custom-sidebar-font');
      document.documentElement.style.removeProperty('--custom-sidebar-font-color');

      setCustomBgColor("");
      localStorage.removeItem("customBgColor");
      body.classList.remove('has-custom-bg');
      document.documentElement.style.removeProperty('--custom-bg');

      setCustomFontColor("");
      localStorage.removeItem("customFontColor");
      body.classList.remove('has-custom-font-color');
      document.documentElement.style.removeProperty('--custom-font-color');

      // 4. Remove the injected custom CSS style tag
      const styleTag = document.getElementById('custom-theme-styles');
      if (styleTag) styleTag.remove();

      // 5. Remove CSS variable overrides
      document.documentElement.style.removeProperty('--primary');
      for (let i = 1; i <= 9; i++) {
        document.documentElement.style.removeProperty(`--rgba-primary-${i}`);
      }

      // 6. Persist defaults to backend so all browsers see the reset
      patchThemeToBackend({
        theme_version: mode,
        theme_nav_header_color: '',
        theme_header_color: '',
        theme_sidebar_color: '',
        theme_sidebar_font_color: '',
        theme_primary_color: '',
        theme_bg_color: '',
        theme_font_color: '',
        theme_form_icon_color: '',
        login_panel_color: '#0a500f',
      });

      // 7. Reset formIconColor state
      setFormIconColor('#0a500f');
      localStorage.setItem('formIconColor', '#0a500f');
      document.documentElement.style.setProperty('--form-icon-color', '#0a500f');

      // 8. Reset login panel color in companySettings localStorage
      const settings = JSON.parse(localStorage.getItem('companySettings') || '{}');
      localStorage.setItem('companySettings', JSON.stringify({ ...settings, loginPanelColor: '#0a500f' }));
      window.dispatchEvent(new Event('companySettingsUpdate'));
    };
    const changeSideBarPostion = (name) => {
      setSidebarposition(name);
      body.setAttribute("data-sidebar-position", name.value);
      localStorage.setItem("sidebarposition", JSON.stringify(name));
    };
    const changeDirectionLayout = (name) => {
      setDirection(name);
      body.setAttribute("direction", name.value);
      let html = document.querySelector("html");
      html.setAttribute("dir", name.value);
      html.className = name.value;
      localStorage.setItem("direction", JSON.stringify(name));
    };
    const changeSideBarLayout = (name) => {
      if (name.value === "horizontal") {
        if (sideBarStyle.value === "overlay") {
          setSidebarLayout(name);
          body.setAttribute("data-layout", name.value);
          const defaultStyle = { value: "full", label: "Full" };
          setSideBarStyle(defaultStyle);
          body.setAttribute("data-sidebar-style", "full");
          localStorage.setItem("sideBarStyle", JSON.stringify(defaultStyle));
        } else {
          setSidebarLayout(name);
          body.setAttribute("data-layout", name.value);
        }
      } else {
        setSidebarLayout(name);
        body.setAttribute("data-layout", name.value);
      }
      localStorage.setItem("sidebarLayout", JSON.stringify(name));
    };
    const changeSideBarStyle = (name) => {
      if (sidebarLayout.value === "horizontal") {
        if (name.value === "overlay") {
          alert("Sorry! Overlay is not possible in Horizontal layout.");
          return;
        }
      }
      setSideBarStyle(name);
      setIconHover(name.value === "icon-hover" ? "_i-hover" : "");
      body.setAttribute("data-sidebar-style", name.value);
      localStorage.setItem("sideBarStyle", JSON.stringify(name));
    };

    const ChangeIconSidebar = (value) => {
      if(sideBarStyle.value==="icon-hover"){
        if(value){
          setSidebariconHover(true);
        }else{
          setSidebariconHover(false);
        }
      }
    }

    const changeHeaderPostion = (name) => {
      setHeaderposition(name);
      body.setAttribute("data-header-position", name.value);
      localStorage.setItem("headerposition", JSON.stringify(name));
    };

    const openMenuToggle = () => {
      sideBarStyle.value === "overly"
        ? setMenuToggle(true)
        : setMenuToggle(false);
    };

    const changeBackground = (name) => {
      body.setAttribute("data-theme-version", name.value);
      setBackground(name);
      localStorage.setItem("themeVersion", name.value);
      setCustomBgColor("");
      localStorage.removeItem("customBgColor");
      patchThemeToBackend({ theme_version: name.value, theme_bg_color: '' });
    };

    const changeCustomBgColor = (color) => {
      setCustomBgColor(color);
      if (color) {
        localStorage.setItem("customBgColor", color);
      } else {
        localStorage.removeItem("customBgColor");
      }
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      const newTheme = brightness < 128 ? "dark" : "light";
      body.setAttribute("data-theme-version", newTheme);
      setBackground({ value: newTheme, label: newTheme.charAt(0).toUpperCase() + newTheme.slice(1) });
      localStorage.setItem("themeVersion", newTheme);
      patchThemeToBackend({ theme_bg_color: color, theme_version: newTheme });
    };

    const changeCustomFontColor = (color) => {
      setCustomFontColor(color);
      if (color) {
        localStorage.setItem("customFontColor", color);
      } else {
        localStorage.removeItem("customFontColor");
      }
      patchThemeToBackend({ theme_font_color: color });
    };

    const changeCustomSidebarFontColor = (color) => {
      setCustomSidebarFontColor(color);
      if (color) {
        localStorage.setItem("customSidebarFontColor", color);
      } else {
        localStorage.removeItem("customSidebarFontColor");
      }
      patchThemeToBackend({ theme_sidebar_font_color: color });
    };

    const changeContainerPosition = (name) => {
      setcontainerPosition_(name);
      body.setAttribute("data-container", name.value);
      if (name.value === "boxed") {
        const overlayStyle = { value: "overlay", label: "Overlay" };
        changeSideBarStyle(overlayStyle);
      }
      localStorage.setItem("containerPosition_", JSON.stringify(name));
    };

    const changeBodyFont = (font) => {
      setBodyFont(font);
      body.setAttribute("data-typography", font);
      localStorage.setItem("bodyFont", font);
    };
  
  const setDemoTheme = (theme,direction) => {
    var setAttr = {};	
    var themeSettings = dezThemeSet[theme];	
      
    changeBodyFont(themeSettings.typography);
  
    setAttr.value = themeSettings.version;
    changeBackground(setAttr);
    
    setAttr.value = themeSettings.layout;
    changeSideBarLayout(setAttr);
    
    //setAttr.value = themeSettings.primary;
    changePrimaryColor(themeSettings.primary);
    
  //setAttr.value = themeSettings.navheaderBg;
    changeNavigationHader(themeSettings.navheaderBg);
    
  //setAttr.value = themeSettings.headerBg;
    chnageHaderColor(themeSettings.headerBg);
    
    setAttr.value = themeSettings.sidebarStyle;
    changeSideBarStyle(setAttr);
    
    //setAttr.value = themeSettings.sidebarBg;
    chnageSidebarColor(themeSettings.sidebarBg);
    
    setAttr.value = themeSettings.sidebarPosition;    
    changeSideBarPostion(setAttr);
    
    setAttr.value = themeSettings.headerPosition;
    changeHeaderPostion(setAttr);
    
    setAttr.value = themeSettings.containerLayout;
    changeContainerPosition(setAttr);
    
    //setAttr.value = themeSettings.direction;
    setAttr.value = direction;
    changeDirectionLayout(setAttr); 
	
	};

  useEffect(() => {
    body.setAttribute("data-theme-version", background.value);
    body.setAttribute("data-typography", bodyFont);
    body.setAttribute("data-layout", sidebarLayout.value);
    body.setAttribute("data-primary", primaryColor);
    body.setAttribute("data-nav-headerbg", navigationHader);
    body.setAttribute("data-headerbg", haderColor);
    body.setAttribute("data-sibebarbg", sidebarColor);
    body.setAttribute("data-sidebar-position", sidebarposition.value);
    body.setAttribute("data-header-position", headerposition.value);
    body.setAttribute("data-container", containerPosition_.value);
    body.setAttribute("direction", direction.value);

    let html = document.querySelector("html");
    html.setAttribute("dir", direction.value);
    html.className = direction.value;

    let resizeTimer;
    let resizeWindow = () => {
      document.body.classList.add("resize-animation-stopper");
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        document.body.classList.remove("resize-animation-stopper");
      }, 400);

      // Keep sidebar stable: only switch to overlay on mobile screens, otherwise stay full.
      if (window.innerWidth <= 768) {
        body.setAttribute("data-sidebar-style", "overlay");
      } else {
        body.setAttribute("data-sidebar-style", sideBarStyle.value);
      }
    };

    // Initialize correctly on load
    if (window.innerWidth <= 768) {
      body.setAttribute("data-sidebar-style", "overlay");
    } else {
      body.setAttribute("data-sidebar-style", sideBarStyle.value);
    }

    // resizeWindow(); // Not strictly needed since we just initialized, but safe.
    window.addEventListener("resize", resizeWindow);
    return () => {
      window.removeEventListener("resize", resizeWindow);
      clearTimeout(resizeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const isAnyCustom =
      primaryColor === "color_custom" ||
      navigationHader === "color_custom" ||
      haderColor === "color_custom" ||
      sidebarColor === "color_custom";

    if (isAnyCustom) {
      const applyStyles = () => {
        applyCustomThemeStyles(
          customPrimaryColor,
          customNavHeaderColor,
          customHeaderColor,
          customSidebarColor
        );
      };

      // Apply immediately
      applyStyles();

      // Retry periodically for 3 seconds to ensure dynamic styles catch asynchronously loaded stylesheets
      let retries = 0;
      const interval = setInterval(() => {
        applyStyles();
        const styleTag = document.getElementById('custom-theme-styles');
        if ((styleTag && styleTag.innerHTML.length > 0) || retries > 15) {
          clearInterval(interval);
        }
        retries++;
      }, 200);

      // Set CSS variables on documentElement
      const r = parseInt(customPrimaryColor.slice(1, 3), 16);
      const g = parseInt(customPrimaryColor.slice(3, 5), 16);
      const b = parseInt(customPrimaryColor.slice(5, 7), 16);
      
      document.documentElement.style.setProperty('--primary', customPrimaryColor);
      document.documentElement.style.setProperty('--rgba-primary-1', `rgba(${r}, ${g}, ${b}, 0.1)`);
      document.documentElement.style.setProperty('--rgba-primary-2', `rgba(${r}, ${g}, ${b}, 0.2)`);
      document.documentElement.style.setProperty('--rgba-primary-3', `rgba(${r}, ${g}, ${b}, 0.3)`);
      document.documentElement.style.setProperty('--rgba-primary-4', `rgba(${r}, ${g}, ${b}, 0.4)`);
      document.documentElement.style.setProperty('--rgba-primary-5', `rgba(${r}, ${g}, ${b}, 0.5)`);
      document.documentElement.style.setProperty('--rgba-primary-6', `rgba(${r}, ${g}, ${b}, 0.6)`);
      document.documentElement.style.setProperty('--rgba-primary-7', `rgba(${r}, ${g}, ${b}, 0.7)`);
      document.documentElement.style.setProperty('--rgba-primary-8', `rgba(${r}, ${g}, ${b}, 0.8)`);
      document.documentElement.style.setProperty('--rgba-primary-9', `rgba(${r}, ${g}, ${b}, 0.9)`);

      return () => {
        clearInterval(interval);
      };
    } else {
      const styleTag = document.getElementById('custom-theme-styles');
      if (styleTag) {
        styleTag.remove();
      }
    }
  }, [
    primaryColor,
    customPrimaryColor,
    navigationHader,
    customNavHeaderColor,
    haderColor,
    customHeaderColor,
    sidebarColor,
    customSidebarColor
  ]);

  useEffect(() => {
    if (customBgColor) {
      body.classList.add('has-custom-bg');
      document.documentElement.style.setProperty('--custom-bg', customBgColor);
    } else {
      body.classList.remove('has-custom-bg');
      document.documentElement.style.removeProperty('--custom-bg');
    }
  }, [customBgColor]);

  useEffect(() => {
    if (customFontColor) {
      body.classList.add('has-custom-font-color');
      document.documentElement.style.setProperty('--custom-font-color', customFontColor);
    } else {
      body.classList.remove('has-custom-font-color');
      document.documentElement.style.removeProperty('--custom-font-color');
    }
  }, [customFontColor]);

  useEffect(() => {
    if (customSidebarFontColor) {
      body.classList.add('has-custom-sidebar-font');
      document.documentElement.style.setProperty('--custom-sidebar-font-color', customSidebarFontColor);
    } else {
      body.classList.remove('has-custom-sidebar-font');
      document.documentElement.style.removeProperty('--custom-sidebar-font-color');
    }
  }, [customSidebarFontColor]);

  return (
    <ThemeContext.Provider
      value={{
        body,
        sideBarOption,
        layoutOption,
        backgroundOption,
        sidebarposition,
        headerPositions,
        containerPosition,
        directionPosition,
        fontFamily,
        primaryColor,
        setChatBox,
        windowWidth,
        windowHeight,
        navigationHader,
        changePrimaryColor,
        changeNavigationHader,
        changeSideBarStyle,
        sideBarStyle,
        changeSideBarPostion,
        sidebarpositions,
        changeHeaderPostion,
        headerposition,
        changeSideBarLayout,
        sidebarLayout,
        changeDirectionLayout,
        changeContainerPosition,
        direction,
        colors,
        haderColor,
        chnageHaderColor,
        chnageSidebarColor,
        sidebarColor,
        iconHover,
        ChangeIconSidebar,
        sidebariconHover,
        menuToggle,
        openMenuToggle,
        changeBackground,
        background,
        containerPosition_,
		    setDemoTheme,
        chatBoxToggle,
        formIconColor,
        changeFormIconColor,
        bodyFont,
        changeBodyFont,
        customPrimaryColor,
        changeCustomPrimaryColor,
        customBgColor,
        changeCustomBgColor,
        customFontColor,
        changeCustomFontColor,
        customNavHeaderColor,
        changeCustomNavHeaderColor,
        customHeaderColor,
        changeCustomHeaderColor,
        customSidebarColor,
        changeCustomSidebarColor,
        customSidebarFontColor,
        changeCustomSidebarFontColor,
        resetToDefault
	}}
    >
      {props.children}
    </ThemeContext.Provider>
  );
};

export default ThemeContextProvider;


