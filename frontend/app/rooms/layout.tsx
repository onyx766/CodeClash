import RequireAuth from "../../components/auth/RequireAuth";

export default function RoomsLayout({ children }: LayoutProps<"/rooms">) {
  return <RequireAuth>{children}</RequireAuth>;
}
