"use client";

import { useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import { cx } from "./Primitives";

/**
 * Lightweight code editor.
 *
 * The admin app has no editor dependency and the brief was explicit about not
 * adding a second one (the player frontend uses Monaco; pulling it in here
 * would be a separate copy). This is a textarea with a synchronised line
 * gutter, tab handling, auto-indent and a live cursor position - enough for the
 * amount of code an author writes on this page, with none of the weight.
 */

interface CodeEditorProps {
  value: string;
  onChange: (next: string) => void;
  language?: string;
  minRows?: number;
  maxHeight?: number;
  placeholder?: string;
  readOnly?: boolean;
  label?: string;
  /** Rendered on the editor's header bar, right-aligned. */
  toolbar?: React.ReactNode;
  invalid?: boolean;
}

export function CodeEditor({
  value,
  onChange,
  language = "JavaScript",
  minRows = 8,
  maxHeight = 420,
  placeholder,
  readOnly,
  label,
  toolbar,
  invalid,
}: CodeEditorProps) {
  const id = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });

  const lineCount = useMemo(
    () => Math.max(value.split("\n").length, minRows),
    [value, minRows],
  );

  const updateCursor = () => {
    const element = textareaRef.current;
    if (!element) return;
    const upToCaret = element.value.slice(0, element.selectionStart);
    const lines = upToCaret.split("\n");
    setCursor({ line: lines.length, column: lines[lines.length - 1].length + 1 });
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
    requestAnimationFrame(updateCursor);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // The Tab and Enter helpers below write through onChange, which would get
    // around the textarea's own readOnly.
    if (readOnly) return;
    const element = event.currentTarget;

    // Tab inserts two spaces instead of moving focus out of the editor.
    if (event.key === "Tab") {
      event.preventDefault();
      const { selectionStart, selectionEnd } = element;
      const next =
        element.value.slice(0, selectionStart) +
        "  " +
        element.value.slice(selectionEnd);
      onChange(next);
      requestAnimationFrame(() => {
        element.selectionStart = element.selectionEnd = selectionStart + 2;
        updateCursor();
      });
      return;
    }

    // Enter keeps the current line's indentation, and adds a level after `{`.
    if (event.key === "Enter") {
      const { selectionStart, selectionEnd } = element;
      const before = element.value.slice(0, selectionStart);
      const currentLine = before.slice(before.lastIndexOf("\n") + 1);
      const indent = /^[ \t]*/.exec(currentLine)?.[0] ?? "";
      const extra = /[{[(]$/.test(currentLine.trimEnd()) ? "  " : "";
      if (!indent && !extra) return;

      event.preventDefault();
      const insertion = `\n${indent}${extra}`;
      onChange(
        element.value.slice(0, selectionStart) +
          insertion +
          element.value.slice(selectionEnd),
      );
      requestAnimationFrame(() => {
        const caret = selectionStart + insertion.length;
        element.selectionStart = element.selectionEnd = caret;
        updateCursor();
      });
    }
  };

  return (
    <div
      className={cx(
        "overflow-hidden rounded-[10px] border bg-[rgba(3,6,14,0.72)]",
        invalid ? "border-rose/60" : "border-line",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-line-soft bg-[rgba(9,14,28,0.7)] px-3 py-1.5">
        <span className="eyebrow">{label ?? language}</span>
        <div className="flex items-center gap-2">
          {toolbar}
          <span className="mono text-[10.5px] text-faint">
            Ln {cursor.line}, Col {cursor.column}
          </span>
        </div>
      </div>

      <div className="relative flex" style={{ maxHeight }}>
        <div
          ref={gutterRef}
          aria-hidden="true"
          className="code-surface shrink-0 overflow-hidden border-r border-line-soft bg-[rgba(6,10,22,0.6)] py-3 pr-2 pl-3 text-right text-faint select-none"
        >
          {Array.from({ length: lineCount }, (_, index) => (
            <div key={index}>{index + 1}</div>
          ))}
        </div>
        <textarea
          id={id}
          ref={textareaRef}
          value={value}
          readOnly={readOnly}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          placeholder={placeholder}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={updateCursor}
          onClick={updateCursor}
          onScroll={(event) => {
            // Keep the gutter locked to the code as it scrolls.
            if (gutterRef.current) {
              gutterRef.current.scrollTop = event.currentTarget.scrollTop;
            }
          }}
          className="code-surface w-full resize-none border-0 bg-transparent px-3 py-3 text-fg outline-none placeholder:text-faint"
          style={{ minHeight: minRows * 20 + 24, maxHeight }}
        />
      </div>
    </div>
  );
}

/**
 * JSON editor: same surface, plus live parse feedback so an admin sees a typo
 * before they try to save.
 */
export function JsonEditor({
  value,
  onChange,
  label,
  minRows = 4,
  placeholder,
  readOnly,
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  minRows?: number;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const error = useMemo(() => {
    if (!value.trim()) return null;
    try {
      JSON.parse(value);
      return null;
    } catch (parseError) {
      return (parseError as Error).message;
    }
  }, [value]);

  return (
    <div>
      <CodeEditor
        value={value}
        onChange={onChange}
        label={label ?? "JSON"}
        language="JSON"
        minRows={minRows}
        maxHeight={260}
        placeholder={placeholder}
        readOnly={readOnly}
        invalid={!!error}
        toolbar={
          error ? (
            <span className="text-[10.5px] font-semibold text-rose">Invalid JSON</span>
          ) : value.trim() ? (
            <span className="text-[10.5px] font-semibold text-emerald-400">Valid</span>
          ) : null
        }
      />
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
