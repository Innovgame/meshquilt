import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Languages, Menu, Moon, Search, Sun } from "lucide-react";
import { Github } from "./github-icon";
import { githubUrl, sourceUrl, version } from "@/lib/config";
import { useSite } from "@/lib/site-context";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { SearchDialog } from "./search-dialog";

export function Logo({ footer = false }: { footer?: boolean }) {
    return (
        <a href="#/" className={`logo${footer ? " footer-logo" : ""}`} aria-label="MeshQuilt home">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={31} height={31} />
            <span>MeshQuilt</span>
            {!footer && <span className="logo-version">v{version}</span>}
        </a>
    );
}

export function Header({ route }: { route: string }) {
    const { language, setLanguage, theme, setTheme, t } = useSite();
    const [searchOpen, setSearchOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const searchButton = useRef<HTMLButtonElement>(null);
    const menuButton = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setSearchOpen((open) => !open);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    const links = [
        { href: "#/docs/introduction", name: t("Documentation", "文档"), active: route.startsWith("/docs/") },
        { href: "#/playground", name: t("Explore the mesh", "探索网格"), active: route === "/playground" },
        { href: "#/changelog", name: t("Changelog", "更新日志"), active: route === "/changelog" }
    ];

    return (
        <>
            <header className="site-header">
                <div className="header-inner">
                    <Logo />
                    <nav className="desktop-nav" aria-label={t("Main navigation", "主导航")}>
                        {links.map((link) => (
                            <a key={link.href} href={link.href} aria-current={link.active ? "page" : undefined}>
                                {link.name}
                            </a>
                        ))}
                    </nav>
                    <div className="header-actions">
                        <button
                            ref={searchButton}
                            className="search-trigger"
                            onClick={() => setSearchOpen(true)}
                            aria-label={t("Open search", "打开搜索")}
                        >
                            <Search size={15} />
                            <span>{t("Search", "搜索")}</span>
                            <kbd>⌘ K</kbd>
                        </button>
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setLanguage(language === "en" ? "zh" : "en")}
                            aria-label={t("Switch to Chinese", "切换到英文")}
                            title={t("中文", "English")}
                        >
                            <Languages size={18} />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                            aria-label={t(
                                `Switch to ${theme === "light" ? "dark" : "light"} theme`,
                                `切换${theme === "light" ? "深色" : "浅色"}主题`
                            )}
                        >
                            {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
                        </Button>
                        <a
                            className="header-github"
                            href={githubUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={t("Open GitHub repository", "打开 GitHub 仓库")}
                        >
                            <Github size={20} />
                        </a>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="mobile-menu-button"
                            ref={menuButton}
                            onClick={() => setMenuOpen(true)}
                            aria-label={t("Open navigation", "打开导航")}
                        >
                            <Menu size={20} />
                        </Button>
                    </div>
                </div>
            </header>
            <SearchDialog
                open={searchOpen}
                onOpenChange={setSearchOpen}
                returnFocus={() => searchButton.current?.focus()}
            />
            <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
                <DialogContent
                    className="mobile-nav-dialog"
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        menuButton.current?.focus();
                    }}
                >
                    <DialogTitle>{t("Explore MeshQuilt", "探索 MeshQuilt")}</DialogTitle>
                    <DialogDescription>
                        {t("A modular mesh codec for the browser.", "面向浏览器的模块化网格编解码库。")}
                    </DialogDescription>
                    <nav aria-label={t("Mobile navigation", "移动导航")}>
                        {links.map((link) => (
                            <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
                                {link.name}
                                <ArrowUpRight size={17} />
                            </a>
                        ))}
                        <a href={githubUrl} target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)}>
                            GitHub
                            <Github size={17} />
                        </a>
                    </nav>
                </DialogContent>
            </Dialog>
        </>
    );
}

export function Footer() {
    const { t } = useSite();
    return (
        <footer className="site-footer container">
            <div className="footer-top">
                <div>
                    <Logo footer />
                    <p>{t("Smaller pieces. The same whole.", "化整为零，完整如初。")}</p>
                </div>
                <div className="footer-links">
                    <div>
                        <strong>{t("Learn", "学习")}</strong>
                        <a href="#/docs/quick-start">{t("Quick start", "快速上手")}</a>
                        <a href="#/docs/quantization">{t("Quantization", "量化机制")}</a>
                        <a href="#/docs/container-format">{t("Container format", "容器格式")}</a>
                    </div>
                    <div>
                        <strong>{t("Project", "项目")}</strong>
                        <a href={githubUrl} target="_blank" rel="noreferrer">
                            GitHub
                            <ArrowUpRight size={12} />
                        </a>
                        <a href="#/docs/contributing">{t("Contributing", "参与贡献")}</a>
                        <a href="#/changelog">{t("Changelog", "更新日志")}</a>
                    </div>
                </div>
            </div>
            <div className="footer-bottom">
                <span>{t("Open source. MIT licensed.", "开源项目，使用 MIT 许可证。")}</span>
                <a href={sourceUrl("LICENSE")} target="_blank" rel="noreferrer">
                    {t("License", "许可证")}
                </a>
                <a href={sourceUrl("SECURITY.md")} target="_blank" rel="noreferrer">
                    {t("Security", "安全政策")}
                </a>
                <span className="footer-version">MeshQuilt v{version}</span>
            </div>
        </footer>
    );
}
