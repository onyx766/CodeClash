'use client'
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuth from '../../hooks/useAuth';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handle = async (e: any) => {
    e.preventDefault();
    try {
      await login(email, password);
      router.push('/lobby');
    } catch (err) {
      alert('Login failed');
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl mb-4">Login</h2>
      <form onSubmit={handle} className="flex flex-col gap-2 max-w-md">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" />
        <button className="btn">Login</button>
      </form>
    </div>
  );
}
