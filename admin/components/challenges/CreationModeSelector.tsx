"use client";

import { Badge, Card, OptionCard, SectionHeader } from "../ui/Primitives";
import { IconCode, IconFile, IconPencil, IconSparkles } from "../ui/Icons";

export type CreationMode = "AI" | "MANUAL" | "JSON_IMPORT";

/**
 * Mode picker. Whichever one is chosen, the result is the same Challenge Draft
 * - AI and JSON only ever prefill the editor below, they never save or publish
 * on their own.
 */
export function CreationModeSelector({
  mode,
  onChange,
  aiConfigured,
  aiStatusKnown,
}: {
  mode: CreationMode;
  onChange: (next: CreationMode) => void;
  aiConfigured: boolean;
  aiStatusKnown: boolean;
}) {
  return (
    <Card>
      <SectionHeader
        icon={<IconSparkles size={17} />}
        title="Creation Mode"
        description="Choose how you want to create this coding challenge."
        accent="blue"
        action={
          <Badge tone="violet">
            <IconCode size={12} />
            JavaScript · function-based judging
          </Badge>
        }
      />
      <div
        role="radiogroup"
        aria-label="Creation mode"
        className="grid gap-3 p-5 lg:grid-cols-3"
      >
        <OptionCard
          name="creation-mode"
          selected={mode === "AI"}
          onSelect={() => onChange("AI")}
          icon={<IconSparkles size={17} />}
          accent="violet"
          title="AI Generate"
          description="Use AI to generate a complete problem with tests, starter code, and more."
          badge={
            aiStatusKnown && !aiConfigured ? (
              <Badge tone="amber">Not configured</Badge>
            ) : null
          }
        />
        <OptionCard
          name="creation-mode"
          selected={mode === "MANUAL"}
          onSelect={() => onChange("MANUAL")}
          icon={<IconPencil size={17} />}
          accent="blue"
          title="Manual"
          description="Create the problem manually with full control over every field."
        />
        <OptionCard
          name="creation-mode"
          selected={mode === "JSON_IMPORT"}
          onSelect={() => onChange("JSON_IMPORT")}
          icon={<IconFile size={17} />}
          accent="teal"
          title="Import JSON"
          description="Import a problem from a JSON file in the CodeClash format."
        />
      </div>
    </Card>
  );
}
