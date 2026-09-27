import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'beacon-theme';

/** The saved choice, or the device's own light/dark setting the first time. */
export function initialTheme(): Theme {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') return saved;
    } catch {
        // Storage can be blocked (private mode); fall through to the system setting.
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** index.css switches every colour off this attribute. */
export function applyTheme(theme: Theme) {
    document.documentElement.dataset.theme = theme;
}

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(initialTheme);

    useEffect(() => {
        applyTheme(theme);
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            // Not saved, but the switch still works for this visit.
        }
    }, [theme]);

    const toggle = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
    return { theme, toggle };
}
