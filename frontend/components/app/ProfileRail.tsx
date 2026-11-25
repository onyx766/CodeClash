"use client";

import { Panel, Tag } from "../ui/Bits";
import useProfile from "../../hooks/useProfile";

/** The player's favourite languages and topics, from their profile preferences. */
export default function ProfileRail({ onEdit }: { onEdit?: () => void }) {
  const { preferences } = useProfile();
  const languages = preferences?.favoriteLanguages ?? [];
  const topics = preferences?.favoriteTopics ?? [];

  return (
    <Panel
      title="Favorite Languages & Topics"
      action={
        onEdit ? (
          <button type="button" onClick={onEdit} className="link-quiet">
            Edit
          </button>
        ) : undefined
      }
      bodyClassName="space-y-2.5"
    >
      {languages.length > 0 || topics.length > 0 ? (
        <>
          {languages.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {languages.map((language) => (
                <Tag key={language} tone="amber">
                  {language}
                </Tag>
              ))}
            </div>
          )}
          {topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {topics.map((topic) => (
                <Tag key={topic} tone="slate">
                  {topic}
                </Tag>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-[12px] leading-relaxed text-dim">None picked yet.</p>
      )}
    </Panel>
  );
}
