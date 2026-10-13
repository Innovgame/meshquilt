import { useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, Search } from "lucide-react";
import { docs } from "@/lib/docs";
import { useSite } from "@/lib/site-context";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

export function SearchDialog({
    open,
    onOpenChange,
    returnFocus
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    returnFocus: () => void;
}) {
    const { language, t } = useSite();
    const [query, setQuery] = useState("");
    const languageIndex = language === "en" ? 0 : 1;
    useEffect(() => {
        if (!open) setQuery("");
    }, [open]);
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const results = docs.filter((doc) =>
        terms.every((term) => `${doc.title.join(" ")} ${doc.content.join(" ")}`.toLowerCase().includes(term))
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="search-dialog"
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    returnFocus();
                }}
            >
                <DialogTitle className="sr-only">{t("Search documentation", "搜索文档")}</DialogTitle>
                <DialogDescription className="sr-only">
                    {t("Search the guides, packages, and project documentation.", "搜索使用指南、各包文档和项目信息。")}
                </DialogDescription>
                <div className="search-input-row">
                    <Search size={21} />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t("Search documentation…", "搜索文档…")}
                        aria-label={t("Search documentation", "搜索文档")}
                    />
                </div>
                <div className="search-results">
                    <p className="search-hint" aria-live="polite">
                        {query
                            ? t(`${results.length} results`, `${results.length} 个结果`)
                            : t("Explore the documentation", "浏览文档")}
                    </p>
                    {results.map((doc) => (
                        <a
                            key={doc.id}
                            href={`#/docs/${doc.id}`}
                            className="search-result"
                            onClick={() => onOpenChange(false)}
                        >
                            <BookOpen size={18} />
                            <span>
                                <strong>{doc.title[languageIndex]}</strong>
                                <small>{doc.description[languageIndex]}</small>
                            </span>
                            <ArrowUpRight size={16} />
                        </a>
                    ))}
                    {!results.length && (
                        <div className="search-empty">
                            <Search size={28} />
                            <strong>{t("No matching pages", "没有匹配的页面")}</strong>
                            <p>
                                {t(
                                    "Try “workers”, “quantization”, or “container”.",
                                    "试试搜索 “Worker”、“量化” 或 “容器”。"
                                )}
                            </p>
                        </div>
                    )}
                </div>
                <div className="search-footer">
                    <span>{t("Tab to navigate · Enter to open", "Tab 切换 · Enter 打开")}</span>
                    <span>
                        <kbd>esc</kbd> {t("to close", "关闭")}
                    </span>
                </div>
            </DialogContent>
        </Dialog>
    );
}
