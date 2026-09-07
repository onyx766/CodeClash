import RequireAuth from "../../components/auth/RequireAuth";

export default function ChallengesLayout({ children }: LayoutProps<"/challenges">) {
  return <RequireAuth>{children}</RequireAuth>;
}
