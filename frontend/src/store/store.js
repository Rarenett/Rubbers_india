import { applyMiddleware, combineReducers, compose, createStore, } from 'redux';
import PostsReducer, { toggleMenu } from './reducers/PostsReducer';
import thunk from 'redux-thunk';
import { AuthReducer } from './reducers/AuthReducer';
import todoReducers from './reducers/Reducers';
import { MenuReducer } from './reducers/MenuReducer';

const middleware = applyMiddleware(thunk);

const composeEnhancers =
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

const reducers = combineReducers({
    sideMenu: toggleMenu,
    posts: PostsReducer,
    auth: AuthReducer,
    todoReducers,
    menu: MenuReducer,
});

const rootReducer = (state, action) => {
    if (action.type === '[Logout action] logout action') {
        state = undefined;
    }
    return reducers(state, action);
};

export const store = createStore(rootReducer, composeEnhancers(middleware));
