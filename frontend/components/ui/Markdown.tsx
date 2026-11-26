import ReactMarkdown, { type Components } from "react-markdown";

/*
 * Challenge descriptions are authored as Markdown in the admin console.
 * Raw HTML in them is dropped (skipHtml), never rendered, and react-markdown's
 * default URL filter strips javascript: and other unsafe link targets.
 */

const blockComponents: Components = {
  p: ({ children }) => <p className="my-2.5 first:mt-0 last:mb-0">{children}</p>,
  // An unsafe target arrives here as an empty href: show the text, not a link.
  a: ({ href, children }) =>
    href ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="text-blue-300 underline underline-offset-2 hover:text-blue-200"
      >
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  // Keep the page's heading outline: the challenge title is the heading above.
  h1: ({ children }) => <h3 className="mb-2 mt-4 text-[16px] font-bold text-fg first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 mt-4 text-[16px] font-bold text-fg first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1.5 mt-3.5 text-[14.5px] font-semibold text-fg first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="mb-1.5 mt-3.5 text-[14.5px] font-semibold text-fg first:mt-0">{children}</h4>,
  h5: ({ children }) => <h4 className="mb-1.5 mt-3.5 text-[14.5px] font-semibold text-fg first:mt-0">{children}</h4>,
  h6: ({ children }) => <h4 className="mb-1.5 mt-3.5 text-[14.5px] font-semibold text-fg first:mt-0">{children}</h4>,
  ul: ({ children }) => <ul className="my-2.5 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2.5 list-decimal space-y-1 pl-5">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-line pl-3 text-muted">{children}</blockquote>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-[12.5px] leading-relaxed [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit">
      {children}
    </pre>
  ),
  code: ({ children }) => (
    <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[0.9em] text-violet-200">{children}</code>
  ),
  strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
  hr: () => <hr className="my-4 border-line" />,
};

// The one-line variant keeps only inline formatting; paragraphs flow together.
const INLINE_ELEMENTS = ["p", "strong", "em", "code", "a", "del", "br"];

const inlineComponents: Components = {
  ...blockComponents,
  p: ({ children }) => <span>{children} </span>,
  code: ({ children }) => (
    <code className="rounded bg-black/30 px-1 font-mono text-[0.92em] text-violet-200">{children}</code>
  ),
};

export default function Markdown({
  children,
  inline = false,
  className = "",
}: {
  children: string;
  /** Inline formatting only, for summaries clamped to a line or two. */
  inline?: boolean;
  className?: string;
}) {
  if (inline) {
    return (
      <span className={className}>
        <ReactMarkdown skipHtml allowedElements={INLINE_ELEMENTS} unwrapDisallowed components={inlineComponents}>
          {children}
        </ReactMarkdown>
      </span>
    );
  }
  return (
    <div className={`[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg ${className}`}>
      <ReactMarkdown skipHtml components={blockComponents}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
