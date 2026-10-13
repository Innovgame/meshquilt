import { Children, isValidElement } from "react";
import type { ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, ChevronRight, FileText } from "lucide-react";
import { docs, headingId } from "@/lib/docs";
import { repositoryUrl, sourceUrl } from "@/lib/config";
import { useSite } from "@/lib/site-context";
import { CodeBlock } from "@/components/code-block";
import { Button } from "@/components/ui/button";

function plainText(children: ReactNode): string {
    return Children.toArray(children)
        .map((child) => {
            if (typeof child === "string" || typeof child === "number") return String(child);
            if (isValidElement<{ children?: ReactNode }>(child)) return plainText(child.props.children);
            return "";
        })
        .join("");
}

function docLink(href: string) {
    if (href.startsWith("#/")) return href;
    const path = href.split("#")[0] ?? "";
    if (path.endsWith("quantization.md")) return "#/docs/quantization";
    if (path.endsWith("container-format.md")) return "#/docs/container-format";
    if (path.endsWith("runtime-and-memory.md")) return "#/docs/runtime";
    if (path.endsWith("geometry.md")) return "#/docs/core";
    for (const name of ["quick-start", "introduction", "draco", "workers", "three", "migration", "releasing"]) {
        if (path.endsWith(`${name}.md`)) return `#/docs/${name}`;
    }
    if (path.endsWith("CONTRIBUTING.md")) return "#/docs/contributing";
    if (path.endsWith("CHANGELOG.md")) return "#/changelog";
    if (path.endsWith("README.md")) return "#/docs/introduction";
    if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("#")) return href;
    return sourceUrl(path.replace(/^(\.\.\/)+/, ""));
}

export function Documentation({ id }: { id: string }) {
    const { language, t } = useSite();
    const index = language === "en" ? 0 : 1;
    const doc = docs.find((item) => item.id === id);
    if (!doc)
        return (
            <main id="main-content" className="not-found container">
                <FileText size={36} />
                <h1>{t("Page not found", "页面未找到")}</h1>
                <p>
                    {t(
                        "This guide does not exist. Browse the documentation to find your way.",
                        "该指南不存在，可从文档首页继续浏览。"
                    )}
                </p>
                <Button asChild>
                    <a href="#/docs/introduction">
                        {t("Open documentation", "打开文档")}
                        <ArrowRight size={16} />
                    </a>
                </Button>
            </main>
        );

    const content = doc.content[index];
    const headings = [...content.matchAll(/^## (.+)$/gm)].map((match) => ({
        title: match[1]!,
        id: headingId(match[1]!)
    }));
    const current = docs.indexOf(doc);
    const previous = docs[current - 1];
    const next = docs[current + 1];
    const categories = [
        { id: "start", name: t("Getting started", "开始使用") },
        { id: "api", name: t("API & integration", "API 与集成") },
        { id: "concepts", name: t("Under the hood", "实现原理") },
        { id: "project", name: t("Project", "项目") }
    ];

    return (
        <main className="docs-layout container" id="main-content" tabIndex={-1}>
            <aside className="docs-sidebar">
                <a className="docs-sidebar-heading" href="#/docs/introduction">
                    <BookOpen size={18} />
                    {t("Documentation", "文档")}
                </a>
                <nav aria-label={t("Documentation navigation", "文档导航")}>
                    {categories.map((category) => (
                        <div className="docs-nav-group" key={category.id}>
                            <strong>{category.name}</strong>
                            {docs
                                .filter((item) => item.category === category.id)
                                .map((item) => (
                                    <a
                                        key={item.id}
                                        href={`#/docs/${item.id}`}
                                        aria-current={item.id === id ? "page" : undefined}
                                    >
                                        {item.title[index]}
                                        {item.id === id && <ChevronRight size={13} />}
                                    </a>
                                ))}
                        </div>
                    ))}
                </nav>
                <a className="sidebar-github" href={sourceUrl("CONTRIBUTING.md")} target="_blank" rel="noreferrer">
                    {t("Help improve MeshQuilt", "帮助改进 MeshQuilt")}
                    <ArrowUpRight size={14} />
                </a>
            </aside>
            <article className="docs-article" key={`${id}-${language}`}>
                <div className="docs-breadcrumb">
                    <span>{t("Docs", "文档")}</span>
                    <ChevronRight size={12} />
                    <span>{doc.title[index]}</span>
                </div>
                <div className="markdown-content">
                    <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            h1: ({ children }) => <h1>{children}</h1>,
                            h2: ({ children }) => <h2 id={headingId(plainText(children))}>{children}</h2>,
                            h3: ({ children }) => <h3 id={headingId(plainText(children))}>{children}</h3>,
                            pre: ({ children }) => <>{children}</>,
                            code: ({ className, children }) => {
                                const text = String(children);
                                return className || text.includes("\n") ? (
                                    <CodeBlock code={text} language={className?.replace("language-", "") || "text"} />
                                ) : (
                                    <code>{children}</code>
                                );
                            },
                            table: ({ children }) => (
                                <div className="markdown-table" tabIndex={0}>
                                    <table>{children}</table>
                                </div>
                            ),
                            a: ({ href, children }) => {
                                const url = docLink(href ?? "");
                                return (
                                    <a
                                        href={url}
                                        target={url.startsWith("http") ? "_blank" : undefined}
                                        rel={url.startsWith("http") ? "noreferrer" : undefined}
                                        onClick={
                                            url.startsWith("#") && !url.startsWith("#/")
                                                ? (event) => {
                                                      event.preventDefault();
                                                      document.getElementById(url.slice(1))?.scrollIntoView();
                                                  }
                                                : undefined
                                        }
                                    >
                                        {children}
                                    </a>
                                );
                            }
                        }}
                    >
                        {content}
                    </Markdown>
                </div>
                {doc.source && repositoryUrl && (
                    <a className="edit-page" href={sourceUrl(doc.source)} target="_blank" rel="noreferrer">
                        {t("View this page on GitHub", "在 GitHub 查看本页")}
                        <ArrowUpRight size={14} />
                    </a>
                )}
                <nav className="docs-pagination" aria-label={t("Adjacent documentation pages", "相邻文档页")}>
                    {previous ? (
                        <a href={`#/docs/${previous.id}`}>
                            <small>
                                <ArrowLeft size={12} />
                                {t("Previous", "上一页")}
                            </small>
                            <strong>{previous.title[index]}</strong>
                        </a>
                    ) : (
                        <span />
                    )}
                    {next && (
                        <a href={`#/docs/${next.id}`}>
                            <small>
                                {t("Next", "下一页")}
                                <ArrowRight size={12} />
                            </small>
                            <strong>{next.title[index]}</strong>
                        </a>
                    )}
                </nav>
            </article>
            <aside className="docs-toc" aria-label={t("On this page", "本页目录")}>
                <strong>{t("On this page", "本页目录")}</strong>
                {headings.map((heading) => (
                    <button
                        key={heading.id}
                        onClick={() =>
                            document.getElementById(heading.id)?.scrollIntoView({
                                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                                    ? "instant"
                                    : "smooth"
                            })
                        }
                    >
                        {heading.title}
                    </button>
                ))}
                <div className="toc-note">
                    <span className="tiny-dot" />
                    {t("Version", "版本")} {t("1 container format", "1 容器格式")}
                    <p>{t("Looking for a starting point?", "寻找入门方向？")}</p>
                    <a href="#/docs/quick-start">
                        {t("Try the quick start", "阅读快速上手")}
                        <ArrowRight size={12} />
                    </a>
                </div>
            </aside>
        </main>
    );
}
