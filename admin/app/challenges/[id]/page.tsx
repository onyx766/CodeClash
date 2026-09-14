"use client";

import { useParams } from "next/navigation";
import { ChallengeEditorScreen } from "../../../components/challenges/ChallengeEditorScreen";

export default function ChallengeDetailPage() {
  const params = useParams();
  return <ChallengeEditorScreen challengeId={params.id as string} />;
}
