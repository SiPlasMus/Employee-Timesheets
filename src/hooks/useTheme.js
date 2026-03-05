import { useState, useEffect } from "react";

const STORAGE_KEY = "et_theme";

export function useTheme() {
    const [theme, setTheme] = useState(
        () => localStorage.getItem(STORAGE_KEY) || "light"
    );

    useEffect(() => {
        const root = document.documentElement;
        if (theme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
        localStorage.setItem(STORAGE_KEY, theme);
    }, [theme]);

    function toggle() {
        setTheme((t) => (t === "dark" ? "light" : "dark"));
    }

    return { theme, toggle };
}
