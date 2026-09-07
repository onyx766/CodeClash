import RequireAuth from "../../components/auth/RequireAuth";

export default function LobbyLayout({ children }: LayoutProps<"/lobby">) {
  return <RequireAuth>{children}</RequireAuth>;
}
