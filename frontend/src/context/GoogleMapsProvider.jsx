import React, { createContext, useContext } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

const GoogleMapsContext = createContext({ isLoaded: false, loadError: null });

// Include all libraries that might be used across the app (e.g. AreaLocationMapping, Logistics routes)
const libraries = ['places', 'geometry', 'visualization'];

export const GoogleMapsProvider = ({ children }) => {
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
        libraries,
    });

    return (
        <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
            {children}
        </GoogleMapsContext.Provider>
    );
};

export const useGoogleMaps = () => useContext(GoogleMapsContext);
