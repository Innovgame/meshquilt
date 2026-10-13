import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type Language = "en" | "zh";
export type Theme = "light" | "dark";

function stored(key: string) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

const SiteContext = createContext({
    language: "en" as Language,
    theme: "light" as Theme,
    setLanguage: (_value: Language) => {},
    setTheme: (_value: Theme) => {},
    t: (english: string, _chinese: string) => english
});

export function SiteProvider({ children }: { children: ReactNode }) {
    const [language, setLanguage] = useState<Language>(() => (stored("meshquilt-language") === "zh" ? "zh" : "en"));
    const [theme, setTheme] = useState<Theme>(() => (stored("meshquilt-theme") === "dark" ? "dark" : "light"));
    const t = useCallback((en: string, zh: string) => (language === "en" ? en : zh), [language]);

    useEffect(() => {
        document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
        document.documentElement.dataset.theme = theme;
        document
            .querySelector('meta[name="theme-color"]')
            ?.setAttribute("content", theme === "dark" ? "#14212e" : "#f5f7f9");
        try {
            localStorage.setItem("meshquilt-language", language);
            localStorage.setItem("meshquilt-theme", theme);
        } catch {
            // The site remains usable when browser storage is disabled.
        }
    }, [language, theme]);

    return (
        <SiteContext.Provider value={{ language, theme, setLanguage, setTheme, t }}>{children}</SiteContext.Provider>
    );
}

export function useSite() {
    return useContext(SiteContext);
}
