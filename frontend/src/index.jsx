import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store';
import ThemeContext from "./context/ThemeContext";
import { PermissionProvider } from './context/PermissionContext';
import { TitleProvider } from './context/TitleContext';
import { GoogleMapsProvider } from './context/GoogleMapsProvider';
import { Modal } from 'react-bootstrap';

// Configure all React-Bootstrap modals to prevent closing on outside click or escape key
Modal.defaultProps = {
  ...Modal.defaultProps,
  backdrop: 'static',
  keyboard: false,
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <Provider store={store}>
      <BrowserRouter 
        basename='/'
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <PermissionProvider>
          <TitleProvider>
            <ThemeContext>
              <GoogleMapsProvider>
                <App />
              </GoogleMapsProvider>
            </ThemeContext>
          </TitleProvider>
        </PermissionProvider>
      </BrowserRouter>
    </Provider>
);

reportWebVitals();