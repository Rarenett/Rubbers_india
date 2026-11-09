import { fetchUserMenus } from '../../services/MenuService';

// Action Types
export const FETCH_MENUS_REQUEST = '[Menu] Fetch Request';
export const FETCH_MENUS_SUCCESS = '[Menu] Fetch Success';
export const FETCH_MENUS_FAILURE = '[Menu] Fetch Failure';

/**
 * Action to start fetching menus
 */
export function fetchMenusRequest() {
    return {
        type: FETCH_MENUS_REQUEST,
    };
}

/**
 * Action when menus are successfully fetched
 */
export function fetchMenusSuccess(menus) {
    return {
        type: FETCH_MENUS_SUCCESS,
        payload: menus,
    };
}

/**
 * Action when menu fetch fails
 */
export function fetchMenusFailure(error) {
    return {
        type: FETCH_MENUS_FAILURE,
        payload: error,
    };
}

/**
 * Async action to fetch user menus from backend
 */
export function fetchUserMenusAction() {
    return (dispatch) => {
        dispatch(fetchMenusRequest());

        fetchUserMenus()
            .then((response) => {
                // console.log('fetchUserMenusAction SUCCESS:', response.data);
                const data = response.data;
                if (typeof data === 'string' && (data.trim().startsWith('<') || data.trim().toLowerCase().startsWith('<!doctype'))) {
                    console.error('fetchUserMenusAction ERROR: Received HTML response instead of JSON. Ensure VITE_API_URL is configured correctly in .env.');
                    dispatch(fetchMenusFailure('Received HTML response from server. Check API URL configuration.'));
                    return;
                }
                const menusData = Array.isArray(data) ? data : (data?.results || data?.data || data?.menus || []);
                dispatch(fetchMenusSuccess(Array.isArray(menusData) ? menusData : []));
            })
            .catch((error) => {
                const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch menus';
                console.error('fetchUserMenusAction ERROR:', errorMessage, error.response);
                dispatch(fetchMenusFailure(errorMessage));
            });
    };
}
