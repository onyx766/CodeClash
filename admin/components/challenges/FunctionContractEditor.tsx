"use client";

import {
  Button,
  Card,
  Field,
  SectionHeader,
  Select,
  TextInput,
} from "../ui/Primitives";
import { CodeEditor } from "../ui/CodeEditor";
import { IconCode, IconPlus, IconTrash } from "../ui/Icons";
import {
  MAX_PARAMETERS,
} from "./constants";
import {
  VALUE_TYPES,
  buildStarterCode,
  nextKey,
  type ChallengeDraft,
  type DraftParameter,
} from "../../lib/draft";
import type { ValueType } from "../../lib/types";

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * The function contract is the calling convention: the runner builds the
 * positional argument list from these parameters, in this order, by reading a
 * test case's input object by name. Renaming a parameter therefore changes how
 * every test case is read - which is why the editor offers to regenerate the
 * starter code and shows the resulting signature.
 */
export function FunctionContractEditor({
  draft,
  patch,
  disabled,
}: {
  draft: ChallengeDraft;
  patch: (changes: Partial<ChallengeDraft>) => void;
  disabled?: boolean;
}) {
  const setParameters = (parameters: DraftParameter[]) => patch({ parameters });

  const updateParameter = (key: string, changes: Partial<DraftParameter>) =>
    setParameters(
      draft.parameters.map((parameter) =>
        parameter.key === key ? { ...parameter, ...changes } : parameter,
      ),
    );

  const signature = `${draft.functionName || "solve"}(${draft.parameters
    .map((parameter) => parameter.name.trim())
    .filter(Boolean)
    .join(", ")}) → ${draft.returnType}`;

  const nameError = (name: string) =>
    name.trim() && !IDENTIFIER.test(name.trim())
      ? "Not a valid identifier"
      : null;

  return (
    <Card>
      <SectionHeader
        icon={<IconCode size={17} />}
        title="Function Contract"
        description="Define the function signature and provide starter code."
        accent="violet"
      />

      <div className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Function Name"
            required
            htmlFor="function-name"
            hint="Name of the function to be implemented."
            error={nameError(draft.functionName)}
          >
            <TextInput
              id="function-name"
              className="mono"
              value={draft.functionName}
              disabled={disabled}
              maxLength={64}
              placeholder="solve"
              invalid={!!nameError(draft.functionName)}
              onChange={(event) => patch({ functionName: event.target.value })}
            />
          </Field>

          <Field
            label="Return Type"
            required
            htmlFor="return-type"
            hint="Expected return type."
          >
            <Select
              id="return-type"
              className="mono"
              value={draft.returnType}
              disabled={disabled}
              onChange={(event) =>
                patch({ returnType: event.target.value as ValueType })
              }
            >
              {VALUE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* -------- parameters -------- */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="field-label mb-0">
              Parameters<span className="ml-0.5 text-rose">*</span>
            </span>
            <span className="text-[11px] text-dim">
              {draft.parameters.length} / {MAX_PARAMETERS}
            </span>
          </div>

          <div className="overflow-hidden rounded-[10px] border border-line">
            <div className="grid grid-cols-[1fr_180px_36px] gap-2 border-b border-line bg-[rgba(9,14,28,0.6)] px-3 py-2">
              <span className="eyebrow">Name</span>
              <span className="eyebrow">Type</span>
              <span />
            </div>

            {draft.parameters.length === 0 ? (
              <p className="px-3 py-4 text-[12px] text-dim">
                No parameters. The function will be called with no arguments.
              </p>
            ) : (
              draft.parameters.map((parameter, index) => (
                <div
                  key={parameter.key}
                  className="grid grid-cols-[1fr_180px_36px] items-center gap-2 border-b border-line-soft px-3 py-2 last:border-b-0"
                >
                  <TextInput
                    className="mono h-9"
                    value={parameter.name}
                    disabled={disabled}
                    maxLength={32}
                    placeholder={`arg${index + 1}`}
                    aria-label={`Parameter ${index + 1} name`}
                    invalid={!!nameError(parameter.name)}
                    onChange={(event) =>
                      updateParameter(parameter.key, { name: event.target.value })
                    }
                  />
                  <Select
                    className="mono h-9"
                    value={parameter.type}
                    disabled={disabled}
                    aria-label={`Parameter ${index + 1} type`}
                    onChange={(event) =>
                      updateParameter(parameter.key, {
                        type: event.target.value as ValueType,
                      })
                    }
                  >
                    {VALUE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    aria-label={`Remove parameter ${index + 1}`}
                    disabled={disabled}
                    onClick={() =>
                      setParameters(
                        draft.parameters.filter((item) => item.key !== parameter.key),
                      )
                    }
                    className="grid size-8 place-items-center rounded-[8px] text-dim transition-colors hover:bg-rose/12 hover:text-rose-300"
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              icon={<IconPlus size={14} />}
              disabled={disabled || draft.parameters.length >= MAX_PARAMETERS}
              onClick={() =>
                setParameters([
                  ...draft.parameters,
                  { key: nextKey("param"), name: "", type: "any" },
                ])
              }
            >
              Add Parameter
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() =>
                patch({
                  starterCode: buildStarterCode(
                    draft.functionName,
                    draft.parameters,
                  ),
                })
              }
            >
              Regenerate starter code
            </Button>
          </div>

          <p className="field-hint">
            A test case&apos;s input is a JSON object keyed by these names; the
            runner builds the argument list from this order.
          </p>
        </div>

        {/* -------- starter code -------- */}
        <Field label="Starter Code" required>
          <CodeEditor
            value={draft.starterCode}
            onChange={(starterCode) => patch({ starterCode })}
            label="Starter Code (JavaScript)"
            readOnly={disabled}
            minRows={7}
            placeholder="function solve(nums, target) {\n  // Write your code here\n}"
          />
          <p className="field-hint mono">{signature}</p>
        </Field>
      </div>
    </Card>
  );
}
