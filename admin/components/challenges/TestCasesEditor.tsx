"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Notice,
  SectionHeader,
  Tabs,
  cx,
} from "../ui/Primitives";
import { JsonEditor } from "../ui/CodeEditor";
import {
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconFlask,
  IconLock,
  IconPlus,
  IconTrash,
} from "../ui/Icons";
import {
  MIN_HIDDEN_TESTS,
  MIN_PUBLIC_TESTS,
  buildInputSkeleton,
  emptyTestCase,
  nextKey,
  type ChallengeDraft,
  type DraftTestCase,
} from "../../lib/draft";
import { MAX_TEST_CASES } from "./constants";

type Visibility = "public" | "hidden";

/**
 * Public and hidden tests are two views of one ordered list, which is what the
 * API stores. Hidden tests are marked clearly because they are the whole
 * defence against a player tuning code until the grader is satisfied - they
 * never reach a player-facing response.
 */
export function TestCasesEditor({
  draft,
  patch,
  disabled,
}: {
  draft: ChallengeDraft;
  patch: (changes: Partial<ChallengeDraft>) => void;
  disabled?: boolean;
}) {
  const [tab, setTab] = useState<Visibility>("public");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const publicTests = useMemo(
    () => draft.testCases.filter((test) => !test.isHidden),
    [draft.testCases],
  );
  const hiddenTests = useMemo(
    () => draft.testCases.filter((test) => test.isHidden),
    [draft.testCases],
  );
  const visible = tab === "public" ? publicTests : hiddenTests;

  const replace = (key: string, changes: Partial<DraftTestCase>) =>
    patch({
      testCases: draft.testCases.map((test) =>
        test.key === key ? { ...test, ...changes } : test,
      ),
    });

  const removeTest = (key: string) =>
    patch({ testCases: draft.testCases.filter((test) => test.key !== key) });

  const duplicateTest = (key: string) => {
    const index = draft.testCases.findIndex((test) => test.key === key);
    if (index < 0 || draft.testCases.length >= MAX_TEST_CASES) return;
    const source = draft.testCases[index];
    const copy: DraftTestCase = {
      ...source,
      key: nextKey("test"),
      id: undefined,
    };
    const next = [...draft.testCases];
    next.splice(index + 1, 0, copy);
    patch({ testCases: next });
  };

  /** Moves a test within its own visibility group. */
  const move = (key: string, direction: -1 | 1) => {
    const group = visible;
    const groupIndex = group.findIndex((test) => test.key === key);
    const swapWith = group[groupIndex + direction];
    if (!swapWith) return;

    const next = [...draft.testCases];
    const a = next.findIndex((test) => test.key === key);
    const b = next.findIndex((test) => test.key === swapWith.key);
    [next[a], next[b]] = [next[b], next[a]];
    patch({ testCases: next });
  };

  const addTest = () => {
    if (draft.testCases.length >= MAX_TEST_CASES) return;
    patch({
      testCases: [
        ...draft.testCases,
        emptyTestCase(draft.parameters, tab === "hidden"),
      ],
    });
  };

  return (
    <Card>
      <SectionHeader
        icon={<IconFlask size={17} />}
        title="Test Cases"
        description="Add test cases to validate submissions."
        accent="blue"
        action={
          <Button
            size="sm"
            variant="primary"
            icon={<IconPlus size={14} />}
            disabled={disabled || draft.testCases.length >= MAX_TEST_CASES}
            onClick={addTest}
          >
            Add Test Case
          </Button>
        }
      />

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs<Visibility>
            value={tab}
            onChange={setTab}
            tabs={[
              {
                value: "public",
                label: (
                  <>
                    <IconFlask size={13} />
                    Public Tests ({publicTests.length})
                  </>
                ),
              },
              {
                value: "hidden",
                label: (
                  <>
                    <IconLock size={13} />
                    Hidden Tests ({hiddenTests.length})
                  </>
                ),
              },
            ]}
          />
          <span className="text-[11.5px] text-dim">
            {tab === "public"
              ? "Visible to players as worked examples."
              : "Never returned by any player-facing API."}
          </span>
        </div>

        {tab === "public" && publicTests.length < MIN_PUBLIC_TESTS ? (
          <Notice tone="amber">
            At least {MIN_PUBLIC_TESTS} public test case is required to publish.
          </Notice>
        ) : null}
        {tab === "hidden" && hiddenTests.length < MIN_HIDDEN_TESTS ? (
          <Notice tone="amber">
            At least {MIN_HIDDEN_TESTS} hidden test cases are required to publish.
          </Notice>
        ) : null}

        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-5 py-10 text-center">
            <p className="text-[13px] font-semibold text-fg">
              No {tab} test cases yet
            </p>
            <p className="mt-1 text-[12px] text-dim">
              Add one to describe what a correct solution should return.
            </p>
            <Button
              size="sm"
              className="mt-4"
              icon={<IconPlus size={14} />}
              disabled={disabled}
              onClick={addTest}
            >
              Add Test Case
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((testCase, index) => {
              const isCollapsed = collapsed[testCase.key];
              return (
                <li
                  key={testCase.key}
                  className="overflow-hidden rounded-xl border border-line bg-panel-2/40"
                >
                  <div className="flex flex-wrap items-center gap-2 border-b border-line-soft bg-[rgba(9,14,28,0.5)] px-3 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsed((state) => ({
                          ...state,
                          [testCase.key]: !isCollapsed,
                        }))
                      }
                      aria-expanded={!isCollapsed}
                      className="flex items-center gap-2 text-[12.5px] font-semibold text-fg"
                    >
                      <span
                        className={cx(
                          "size-1.5 rounded-full",
                          testCase.isHidden ? "bg-violet" : "bg-blue",
                        )}
                      />
                      Test Case {index + 1}
                      {isCollapsed ? (
                        <IconChevronDown size={14} className="text-dim" />
                      ) : (
                        <IconChevronUp size={14} className="text-dim" />
                      )}
                    </button>

                    {testCase.isHidden ? (
                      <Badge tone="violet">
                        <IconLock size={11} />
                        Hidden
                      </Badge>
                    ) : (
                      <Badge tone="blue">Public</Badge>
                    )}

                    <div className="ml-auto flex items-center gap-1">
                      <IconButton
                        label="Move up"
                        disabled={disabled || index === 0}
                        onClick={() => move(testCase.key, -1)}
                      >
                        <IconChevronUp size={14} />
                      </IconButton>
                      <IconButton
                        label="Move down"
                        disabled={disabled || index === visible.length - 1}
                        onClick={() => move(testCase.key, 1)}
                      >
                        <IconChevronDown size={14} />
                      </IconButton>
                      <IconButton
                        label="Toggle visibility"
                        disabled={disabled}
                        onClick={() =>
                          replace(testCase.key, { isHidden: !testCase.isHidden })
                        }
                      >
                        <IconLock size={14} />
                      </IconButton>
                      <IconButton
                        label="Duplicate test"
                        disabled={disabled}
                        onClick={() => duplicateTest(testCase.key)}
                      >
                        <IconCopy size={14} />
                      </IconButton>
                      <IconButton
                        label="Delete test"
                        danger
                        disabled={disabled}
                        onClick={() => removeTest(testCase.key)}
                      >
                        <IconTrash size={14} />
                      </IconButton>
                    </div>
                  </div>

                  {!isCollapsed ? (
                    <div className="grid gap-3 p-3 lg:grid-cols-2">
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="field-label mb-0">
                            Input (JSON)<span className="ml-0.5 text-rose">*</span>
                          </span>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                              replace(testCase.key, {
                                inputText: buildInputSkeleton(draft.parameters),
                              })
                            }
                            className="text-[11px] text-dim transition-colors hover:text-blue-soft disabled:pointer-events-none disabled:opacity-40"
                          >
                            Reset to contract
                          </button>
                        </div>
                        <JsonEditor
                          value={testCase.inputText}
                          onChange={(inputText) =>
                            replace(testCase.key, { inputText })
                          }
                          label="Input"
                          minRows={4}
                          readOnly={disabled}
                        />
                      </div>

                      <div>
                        <span className="field-label">Expected Output (JSON)</span>
                        <JsonEditor
                          value={testCase.expectedText}
                          onChange={(expectedText) =>
                            replace(testCase.key, { expectedText })
                          }
                          label="Expected"
                          minRows={4}
                          readOnly={disabled}
                        />
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <p className="field-hint">
          Input keys must match the declared parameter names. With a reference
          solution configured you may leave an expected output as{" "}
          <code className="mono">null</code> and let validation derive it.
        </p>
      </div>
    </Card>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "grid size-7 place-items-center rounded-[7px] text-dim transition-colors disabled:cursor-not-allowed disabled:opacity-35",
        danger
          ? "hover:bg-rose/12 hover:text-rose-300"
          : "hover:bg-panel-3 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
