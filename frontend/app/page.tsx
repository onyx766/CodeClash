import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="max-w-3xl w-full p-8">
        <h1 className="text-4xl font-bold mb-4 text-black dark:text-white">Welcome to CodeClash</h1>
        <p className="mb-6 text-zinc-700 dark:text-zinc-300">Jump into the lobby, view infra status or sign in to start coding challenges.</p>
        <div className="flex gap-3">
          <Link href="/lobby" className="px-4 py-2 bg-black text-white rounded">Go to Lobby</Link>
          <Link href="/infra" className="px-4 py-2 border rounded">Infra</Link>
          <Link href="/login" className="px-4 py-2 border rounded">Login</Link>
          <Link href="/register" className="px-4 py-2 border rounded">Register</Link>
        </div>
      </div>
    </div>
  );
}
