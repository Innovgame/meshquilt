import { Component, lazy, Suspense, useEffect, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Footer, Header } from "./components/layout";
import { SiteProvider, useSite } from "./lib/site-context";
import { docs } from "./lib/docs";

const Home = lazy(() => import("./pages/home").then((module) => ({ default: module.Home })));
const Documentation = lazy(() => import("./pages/documentation").then((module) => ({ default: module.Documentation })));

class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
    state = { error: false };
    static getDerivedStateFromError() {
        return { error: true };
    }
    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("MeshQuilt site error", error, info.componentStack);
    }
    render() {
        if (this.state.error)
            return (
                <main className="not-found container">
                    <h1>Unable to load this page / 页面加载失败</h1>
                    <p>Please reload to try again. / 请重新加载页面。</p>
                    <button className="button button-primary" onClick={() => window.location.reload()}>
                        Reload / 重新加载
                    </button>
                </main>
            );
        return this.props.children;
    }
}

function currentRoute() {
    return window.location.hash.slice(1) || "/";
}

function Site() {
    const { language, t } = useSite();
    const [route, setRoute] = useState(currentRoute);
    useEffect(() => {
        const change = () => setRoute(currentRoute());
        window.addEventListener("hashchange", change);
        return () => window.removeEventListener("hashchange", change);
    }, []);
    const docId = route === "/changelog" ? "changelog" : route.startsWith("/docs/") ? route.slice(6) : null;

    useEffect(() => {
        const doc = docs.find((item) => item.id === docId);
        document.title = doc
            ? `${doc.title[language === "en" ? 0 : 1]} — MeshQuilt`
            : t("MeshQuilt — A modular mesh codec for the browser", "MeshQuilt — 面向浏览器的模块化网格编解码库");
        if (docId || route === "/") window.scrollTo(0, 0);
    }, [route, language, docId, t]);

    return (
        <>
            <a
                className="skip-link"
                href="#main-content"
                onClick={(event) => {
                    event.preventDefault();
                    document.getElementById("main-content")?.focus();
                    document.getElementById("main-content")?.scrollIntoView();
                }}
            >
                {t("Skip to content", "跳转到主要内容")}
            </a>
            <Header route={route} />
            <ErrorBoundary>
                <Suspense
                    fallback={
                        <main className="page-loading container" id="main-content" aria-live="polite">
                            {t("Loading MeshQuilt…", "正在加载 MeshQuilt…")}
                        </main>
                    }
                >
                    {docId ? (
                        <Documentation id={docId} />
                    ) : (
                        <Home section={route === "/" ? undefined : route.slice(1)} />
                    )}
                </Suspense>
            </ErrorBoundary>
            <Footer />
        </>
    );
}

export default function App() {
    return (
        <SiteProvider>
            <Site />
        </SiteProvider>
    );
}
