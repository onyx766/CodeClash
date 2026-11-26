import RequireAuth from "../../components/auth/RequireAuth";

export default function MatchLayout({ children }: LayoutProps<"/match">) {
  return <RequireAuth>{children}</RequireAuth>;
}
