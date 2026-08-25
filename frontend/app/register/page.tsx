'use client'
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuth from '../../hooks/useAuth';

export default function RegisterPage() {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handle = async (e: any) => {
    e.preventDefault();
    try {
      await register(email, username, password);
      router.push('/lobby');
    } catch (err) {
      alert('Register failed');
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl mb-4">Register</h2>
      <form onSubmit={handle} className="flex flex-col gap-2 max-w-md">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" />
        <button className="btn">Register</button>
      </form>
    </div>
  );
}
