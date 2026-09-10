"use client";

import { useState, type KeyboardEvent } from "react";
import {
  Badge,
  Card,
  Field,
  SectionHeader,
  Select,
  TextArea,
  TextInput,
  cx,
} from "../ui/Primitives";
import { IconDashboard, IconPlus } from "../ui/Icons";
import { DIFFICULTIES, slugify, type ChallengeDraft } from "../../lib/draft";
import { DESCRIPTION_MAX } from "./constants";

export function BasicInformationSection({
  draft,
  patch,
  disabled,
}: {
  draft: ChallengeDraft;
  patch: (changes: Partial<ChallengeDraft>) => void;
  disabled?: boolean;
}) {
  const [tagInput, setTagInput] = useState("");

  const addTag = () => {
    const label = tagInput.trim();
    if (!label) return;
    if (draft.tags.length >= 10) return;
    if (draft.tags.some((tag) => tag.toLowerCase() === label.toLowerCase())) {
      setTagInput("");
      return;
    }
    patch({ tags: [...draft.tags, label] });
    setTagInput("");
  };

  const onTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag();
    } else if (event.key === "Backspace" && !tagInput && draft.tags.length) {
      patch({ tags: draft.tags.slice(0, -1) });
    }
  };

  return (
    <Card>
      <SectionHeader
        icon={<IconDashboard size={17} />}
        title="Basic Information"
        description="Set the core details for your coding challenge."
        accent="blue"
      />

      <div className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Title"
            required
            htmlFor="challenge-title"
            hint="A clear, concise title for the problem."
          >
            <TextInput
              id="challenge-title"
              value={draft.title}
              disabled={disabled}
              maxLength={120}
              placeholder="Two Sum"
              onChange={(event) => {
                const title = event.target.value;
                // The slug tracks the title until the admin edits it directly.
                patch(
                  draft.slugTouched
                    ? { title }
                    : { title, slug: slugify(title) },
                );
              }}
            />
          </Field>

          <Field
            label="Slug"
            required
            htmlFor="challenge-slug"
            hint="URL-friendly identifier (lowercase, hyphens only)."
          >
            <TextInput
              id="challenge-slug"
              value={draft.slug}
              disabled={disabled}
              maxLength={120}
              placeholder="two-sum"
              className="mono"
              onChange={(event) =>
                patch({ slug: event.target.value, slugTouched: true })
              }
              onBlur={(event) =>
                patch({ slug: slugify(event.target.value), slugTouched: true })
              }
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <Field label="Difficulty" required htmlFor="challenge-difficulty">
            <div className="relative">
              <span
                className={cx(
                  "pointer-events-none absolute top-1/2 left-3 size-2 -translate-y-1/2 rounded-full",
                  DIFFICULTIES.find((d) => d.value === draft.difficulty)?.tone,
                )}
              />
              <Select
                id="challenge-difficulty"
                className="pl-7"
                value={draft.difficulty}
                disabled={disabled}
                onChange={(event) =>
                  patch({
                    difficulty: event.target.value as ChallengeDraft["difficulty"],
                  })
                }
              >
                {DIFFICULTIES.map((difficulty) => (
                  <option key={difficulty.value} value={difficulty.value}>
                    {difficulty.label}
                  </option>
                ))}
              </Select>
            </div>
          </Field>

          <Field
            label="Tags"
            htmlFor="challenge-tags"
            hint="Press Enter to add. Tags help with categorization."
          >
            <div className="flex flex-wrap items-center gap-1.5 rounded-[10px] border border-line bg-[rgba(4,8,18,0.6)] p-1.5">
              {draft.tags.map((tag) => (
                <Badge key={tag} tone="blue">
                  {tag}
                  <button
                    type="button"
                    aria-label={`Remove tag ${tag}`}
                    disabled={disabled}
                    onClick={() =>
                      patch({ tags: draft.tags.filter((item) => item !== tag) })
                    }
                    className="ml-0.5 text-blue-soft/70 transition-colors hover:text-fg"
                  >
                    ×
                  </button>
                </Badge>
              ))}
              <input
                id="challenge-tags"
                value={tagInput}
                disabled={disabled || draft.tags.length >= 10}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={onTagKeyDown}
                onBlur={addTag}
                maxLength={32}
                placeholder={draft.tags.length ? "" : "array, hash-map…"}
                className="min-w-[120px] flex-1 bg-transparent px-1.5 py-1 text-[13px] text-fg outline-none placeholder:text-faint"
              />
              {draft.tags.length < 10 ? (
                <button
                  type="button"
                  aria-label="Add tag"
                  onClick={addTag}
                  disabled={disabled}
                  className="grid size-6 place-items-center rounded-[6px] text-dim transition-colors hover:bg-panel-3 hover:text-fg"
                >
                  <IconPlus size={14} />
                </button>
              ) : null}
            </div>
          </Field>
        </div>

        <Field
          label="Description"
          required
          htmlFor="challenge-description"
          hint="Markdown is supported. This is exactly what players will read."
        >
          <div className="relative">
            <TextArea
              id="challenge-description"
              rows={8}
              value={draft.description}
              disabled={disabled}
              maxLength={DESCRIPTION_MAX}
              placeholder={
                "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers such that they add up to `target`."
              }
              onChange={(event) => patch({ description: event.target.value })}
            />
            <span className="mono pointer-events-none absolute right-3 bottom-2.5 text-[10.5px] text-faint">
              {draft.description.length} / {DESCRIPTION_MAX}
            </span>
          </div>
        </Field>
      </div>
    </Card>
  );
}
