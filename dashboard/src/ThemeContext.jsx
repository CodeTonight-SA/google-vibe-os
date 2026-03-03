import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

const STORAGE_KEY = 'googol-vibe-theme';

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'light';
        } catch {
            return 'light';
        }
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            // localStorage unavailable
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
