import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { useTheme } from "../theme.jsx";
import { isApprovedImageUrl } from "../imageHosts.js";
import { normalizeDisplayMath } from "./normalizeDisplayMath.js";

const KATEX_OPTIONS = Object.freeze({
  throwOnError: false,
  errorColor: "#dc2626",
  macros: {
    "\\ce": "\\mathrm{#1}",
    "\\degree": "^{\\circ}",
    "\\d": "\\mathrm{d}",
  },
  maxSize: 20,
  maxExpand: 1000,
});

function safeForumUrl(url, key) {
  const transformed = defaultUrlTransform(url);
  if (!transformed) return "";
  if (key !== "src") return transformed;
  // An <img> loads automatically for every reader, so its host is a decision
  // about whose server gets to see an anonymous minor's IP and user-agent —
  // and about what imagery can appear on a page Google indexes. Protocol alone
  // was not a check: it accepted any host on the internet. Links are different
  // and stay open: a reader has to choose to follow one, and they carry
  // rel="noopener noreferrer nofollow".
  return isApprovedImageUrl(transformed) ? transformed : "";
}

/**
 * The only forum component allowed to turn student Markdown/LaTeX into DOM.
 * Raw HTML intentionally stays text: never add rehype-raw to this pipeline.
 */
export default function ForumMathContent({ children = "", className = "" }) {
  const { t } = useTheme();
  return (
    <div
      data-forum-markdown="true"
      className={`min-w-0 max-w-full space-y-3 break-words text-sm leading-relaxed ${t.text} ${className}
        [&_p]:leading-relaxed
        [&_a]:font-medium [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2
        [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6
        [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6
        [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold
        [&_h3]:text-base [&_h3]:font-semibold
        [&_blockquote]:border-l-2 [&_blockquote]:border-hairline-strong [&_blockquote]:pl-4 [&_blockquote]:text-ink-2
        [&_code]:rounded-sm [&_code]:bg-surface-inset [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em]
        [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-surface-inset [&_pre]:p-4
        [&_pre_code]:bg-transparent [&_pre_code]:p-0
        [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto
        [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[[rehypeKatex, KATEX_OPTIONS]]}
        urlTransform={safeForumUrl}
        components={{
          a: ({ href, children: linkChildren }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {linkChildren}
            </a>
          ),
          img: ({ src, alt }) => src ? (
            <img
              src={String(src)}
              alt={alt ?? ""}
              loading="lazy"
              className="max-h-[28rem] h-auto w-auto max-w-full rounded-lg border border-hairline"
            />
          ) : null,
          table: ({ children: tableChildren }) => (
            <div data-allow-horizontal-scroll="true" className="max-w-full overflow-x-auto">
              <table className="w-full min-w-max text-left">{tableChildren}</table>
            </div>
          ),
          th: ({ children: cellChildren }) => (
            <th className="border-b border-hairline px-3 py-2">{cellChildren}</th>
          ),
          td: ({ children: cellChildren }) => (
            <td className="border-b border-hairline px-3 py-2">{cellChildren}</td>
          ),
        }}
      >
        {normalizeDisplayMath(children)}
      </ReactMarkdown>
    </div>
  );
}
