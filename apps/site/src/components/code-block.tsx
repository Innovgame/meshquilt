import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useSite } from "@/lib/site-context";

function Highlight({ code }: { code: string }) {
    const parts = code.split(
        /(\/\/[^\n]*|"[^"\n]*"|'[^'\n]*'|\b(?:import|from|const|await|try|finally|return|new|export|function)\b|\b\d[\d_]*\b)/g
    );
    return parts.map((part, index) => {
        const kind = part.startsWith("//")
            ? "comment"
            : /^["']/.test(part)
              ? "string"
              : /^\d/.test(part)
                ? "number"
                : /^(import|from|const|await|try|finally|return|new|export|function)$/.test(part)
                  ? "keyword"
                  : "";
        return kind ? (
            <span className={`syntax-${kind}`} key={index}>
                {part}
            </span>
        ) : (
            part
        );
    });
}

export function CodeBlock({
    code,
    language = "typescript",
    title
}: {
    code: string;
    language?: string;
    title?: string;
}) {
    const { t } = useSite();
    const [copied, setCopied] = useState(false);
    const [failed, setFailed] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(timer.current), []);

    async function copy() {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setFailed(false);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 2000);
        } catch {
            setFailed(true);
        }
    }

    return (
        <div className="code-block">
            <div className="code-header">
                <span>{title || language}</span>
                <button onClick={copy} className="copy-button" aria-label={t("Copy code", "复制代码")}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span aria-live="polite">
                        {copied
                            ? t("Copied", "已复制")
                            : failed
                              ? t("Select to copy", "请选择后复制")
                              : t("Copy", "复制")}
                    </span>
                </button>
            </div>
            <pre tabIndex={0}>
                <code>
                    <Highlight code={code.trimEnd()} />
                </code>
            </pre>
        </div>
    );
}
