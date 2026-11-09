import React, { createContext, useState, useContext, useEffect } from 'react';

export const TitleContext = createContext();

export const TitleProvider = ({ children }) => {
    const [pageTitle, setPageTitle] = useState('');

    return (
        <TitleContext.Provider value={{ pageTitle, setPageTitle }}>
            {children}
        </TitleContext.Provider>
    );
};

export const usePageTitle = (title) => {
    const { setPageTitle } = useContext(TitleContext);

    useEffect(() => {
        if (title) {
            const stringTitle = typeof title === 'object' ? (title?.title || '') : String(title || '');
            setPageTitle(stringTitle);
        }
        // Cleanup when the component unmounts
        return () => {
            setPageTitle('');
        };
    }, [title, setPageTitle]);
};

export const UsePageTitle = usePageTitle;
