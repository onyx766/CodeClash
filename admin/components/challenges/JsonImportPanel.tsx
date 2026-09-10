"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Button, Card, Notice, SectionHeader, cx } from "../ui/Primitives";
import { IconAlert, IconDownload, IconFile, IconUpload } from "../ui/Icons";
import { MAX_IMPORT_BYTES } from "./constants";

/**
 * Import mode.
 *
 * The file is read in the browser only to get its text; the server parses and
 * validates it (size, extension, MIME, schema, prototype-pollution keys) and
 * decides what it means. Nothing is saved or published by importing - the
 * validated draft lands in the editor for review.
 */
export function JsonImportPanel({
  importing,
  error,
  onImport,
  onDownloadTemplate,
}: {
  importing: boolean;
  error: string | null;
  onImport: (content: string, fileName: string, mimeType: string) => void;
  onDownloadTemplate: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const accept = async (file: File) => {
    setLocalError(null);
    if (!/\.json$/i.test(file.name)) {
      setLocalError("Only .json files can be imported.");
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setLocalError(
        `That file is ${Math.round(file.size / 1024)} KB. The limit is ${Math.round(
          MAX_IMPORT_BYTES / 1024,
        )} KB.`,
      );
      return;
    }
    setFileName(file.name);
    onImport(await file.text(), file.name, file.type || "application/json");
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void accept(file);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void accept(file);
  };

  return (
    <Card>
      <SectionHeader
        icon={<IconFile size={17} />}
        title="Import JSON"
        description="Import a problem in the CodeClash challenge format."
        accent="teal"
        action={
          <Button
            size="sm"
            variant="ghost"
            icon={<IconDownload size={14} />}
            onClick={onDownloadTemplate}
          >
            Download JSON Template
          </Button>
        }
      />

      <div className="space-y-3 p-5">
        {error || localError ? (
          <Notice tone="rose">
            <span className="flex items-start gap-2">
              <IconAlert size={15} className="mt-px shrink-0" />
              {localError ?? error}
            </span>
          </Notice>
        ) : null}

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cx(
            "rounded-xl border border-dashed px-5 py-10 text-center transition-colors",
            dragging
              ? "border-blue bg-blue/8"
              : "border-line bg-panel-2/30 hover:border-panel-3",
          )}
        >
          <span className="mx-auto grid size-11 place-items-center rounded-xl border border-teal/25 bg-gradient-to-br from-teal/20 to-teal/5 text-teal-300">
            <IconUpload size={20} />
          </span>
          <p className="mt-3 text-[13.5px] font-semibold text-fg">
            Drop a challenge .json file here
          </p>
          <p className="mt-1 text-[12px] text-dim">
            Max {Math.round(MAX_IMPORT_BYTES / 1024)} KB. The server validates
            the file before anything is filled in.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onFileChange}
          />
          <Button
            className="mt-4"
            variant="primary"
            loading={importing}
            icon={<IconFile size={15} />}
            onClick={() => inputRef.current?.click()}
          >
            Choose file
          </Button>

          {fileName ? (
            <p className="mono mt-3 text-[11px] text-dim">{fileName}</p>
          ) : null}
        </div>

        <p className="field-hint">
          Imported challenges always become drafts. Review the populated editor
          below, then validate and publish as usual.
        </p>
      </div>
    </Card>
  );
}
