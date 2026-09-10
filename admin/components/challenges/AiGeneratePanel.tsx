"use client";

import { useState } from "react";
import {
  Button,
  Card,
  Field,
  Notice,
  NumberInput,
  SectionHeader,
  Select,
  TextArea,
  TextInput,
} from "../ui/Primitives";
import { IconAlert, IconSparkles } from "../ui/Icons";
import { DIFFICULTIES } from "../../lib/draft";
import type { AiGenerateRequest, Difficulty } from "../../lib/types";

/**
 * Setup panel for AI mode.
 *
 * Generate only ever *prefills the editor*: the response is validated by the
 * backend against the same schema as a JSON import, and the admin still has to
 * review it, save it as a draft and pass runner validation. When no provider is
 * configured the button is disabled and says so - no fabricated output.
 */
export function AiGeneratePanel({
  configured,
  statusMessage,
  generating,
  error,
  onGenerate,
}: {
  configured: boolean;
  statusMessage: string;
  generating: boolean;
  error: string | null;
  onGenerate: (request: AiGenerateRequest) => void;
}) {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  const [tags, setTags] = useState("");
  const [concept, setConcept] = useState("");
  const [publicTestCount, setPublicTestCount] = useState(3);
  const [hiddenTestCount, setHiddenTestCount] = useState(5);
  const [instructions, setInstructions] = useState("");

  return (
    <Card>
      <SectionHeader
        icon={<IconSparkles size={17} />}
        title="AI Generation"
        description="Describe the problem you want; review the draft before saving."
        accent="violet"
      />

      <div className="space-y-4 p-5">
        {!configured ? (
          <Notice tone="amber">
            <span className="flex items-start gap-2">
              <IconAlert size={15} className="mt-px shrink-0" />
              {statusMessage || "AI generation is not configured."}
            </span>
          </Notice>
        ) : null}

        {error ? <Notice tone="rose">{error}</Notice> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Topic"
            required
            htmlFor="ai-topic"
            hint="The area the problem should cover."
          >
            <TextInput
              id="ai-topic"
              value={topic}
              disabled={!configured}
              maxLength={200}
              placeholder="Arrays / Hash Maps"
              onChange={(event) => setTopic(event.target.value)}
            />
          </Field>

          <Field label="Difficulty" required htmlFor="ai-difficulty">
            <Select
              id="ai-difficulty"
              value={difficulty}
              disabled={!configured}
              onChange={(event) =>
                setDifficulty(event.target.value as Difficulty)
              }
            >
              {DIFFICULTIES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Tags"
            htmlFor="ai-tags"
            hint="Comma separated, e.g. array, hash-map."
          >
            <TextInput
              id="ai-tags"
              value={tags}
              disabled={!configured}
              placeholder="array, hash-map"
              onChange={(event) => setTags(event.target.value)}
            />
          </Field>

          <Field
            label="Concept"
            htmlFor="ai-concept"
            hint="The specific technique to exercise."
          >
            <TextInput
              id="ai-concept"
              value={concept}
              disabled={!configured}
              maxLength={500}
              placeholder="Map lookups in a single pass"
              onChange={(event) => setConcept(event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Public tests" htmlFor="ai-public-tests">
            <NumberInput
              id="ai-public-tests"
              value={publicTestCount}
              min={1}
              max={20}
              onChange={setPublicTestCount}
            />
          </Field>
          <Field label="Hidden tests" htmlFor="ai-hidden-tests">
            <NumberInput
              id="ai-hidden-tests"
              value={hiddenTestCount}
              min={1}
              max={50}
              onChange={setHiddenTestCount}
            />
          </Field>
        </div>

        <Field
          label="Additional instructions"
          htmlFor="ai-instructions"
          hint="Anything else the generator should respect."
        >
          <TextArea
            id="ai-instructions"
            rows={4}
            value={instructions}
            disabled={!configured}
            maxLength={2000}
            placeholder="Create a problem testing Map usage without being identical to Two Sum."
            onChange={(event) => setInstructions(event.target.value)}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            loading={generating}
            icon={<IconSparkles size={15} />}
            disabled={!configured || topic.trim().length < 3}
            onClick={() =>
              onGenerate({
                topic: topic.trim(),
                difficulty,
                tags: tags
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean)
                  .slice(0, 10),
                concept: concept.trim() || undefined,
                publicTestCount,
                hiddenTestCount,
                instructions: instructions.trim() || undefined,
              })
            }
          >
            Generate Draft
          </Button>
          <p className="text-[11.5px] text-dim">
            The result fills in the editor below as a draft. It is never
            published automatically and still has to pass validation.
          </p>
        </div>
      </div>
    </Card>
  );
}
