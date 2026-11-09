import {
    FETCH_MENUS_REQUEST,
    FETCH_MENUS_SUCCESS,
    FETCH_MENUS_FAILURE,
} from '../actions/MenuActions';

const initialState = {
    menus: [],
    loading: false,
    error: null,
    lastFetched: null,
};

export function MenuReducer(state = initialState, action) {
    switch (action.type) {
        case FETCH_MENUS_REQUEST:
            return {
                ...state,
                loading: true,
                error: null,
            };

        case FETCH_MENUS_SUCCESS:
            return {
                ...state,
                menus: action.payload,
                loading: false,
                error: null,
                lastFetched: new Date().toISOString(),
            };

        case FETCH_MENUS_FAILURE:
            return {
                ...state,
                loading: false,
                error: action.payload,
            };

        default:
            return state;
    }
}
