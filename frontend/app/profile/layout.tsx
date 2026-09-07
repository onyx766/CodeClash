import RequireAuth from "../../components/auth/RequireAuth";

export default function ProfileLayout({ children }: LayoutProps<"/profile">) {
  return <RequireAuth>{children}</RequireAuth>;
}
