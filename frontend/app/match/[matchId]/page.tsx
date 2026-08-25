'use client'
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSocket } from '../../../lib/socket';
import dynamic from 'next/dynamic';
import { rounds, infra } from '../../../lib/api';
import { infraStatus } from '../../../lib/api';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

export default function MatchPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const [round, setRound] = useState<any>(null);
  const [code, setCode] = useState('function solve() {\n  // your code\n}');
  const [result, setResult] = useState<any>(null);
  const [runnerReady, setRunnerReady] = useState<boolean>(false);
  const [status, setStatus] = useState<{ workers: number; queued: number; processing: number }>({ workers: 0, queued: 0, processing: 0 });

  useEffect(() => {
    const s = getSocket();
    s.on('round:start', (payload: any) => {
      setRound(payload.round);
    });
    s.on('submission:result', (payload: any) => setResult(payload));
    return () => {
      s.off('round:start');
      s.off('submission:result');
    };
  }, [matchId]);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const r = await infra.runnerReady();
        if (mounted) setRunnerReady(Boolean(r.ready));
      } catch (e) { if (mounted) setRunnerReady(false); }
      try {
        const s = await infraStatus.status();
        if (mounted) setStatus({ workers: s.workers || 0, queued: s.queued || 0, processing: s.processing || 0 });
      } catch (e) { /* ignore */ }
    };
    check();
    const id = setInterval(check, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const run = async () => {
    if (!round) return;
    const res = await rounds.run(round.id, code);
    setResult(res);
  };

  const submit = async () => {
    if (!round) return;
    const res = await rounds.submit(round.id, code);
    setResult(res);
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl mb-2">Match {matchId}</h2>
      {round ? (
        <div>
          <h3>{round.roundNumber} — Challenge</h3>
          <div className="mb-2">Challenge ID: {round.challengeId}</div>
          <div style={{ height: 400 }}>
            <MonacoEditor height="100%" defaultLanguage="javascript" defaultValue={code} onChange={(v) => setCode(v || '')} />
          </div>
          <div className="mt-2">
            <button onClick={run} className="btn mr-2" disabled={!runnerReady}>Run</button>
            <button onClick={submit} className="btn" disabled={!runnerReady}>Submit</button>
            {!runnerReady && <span className="ml-3 text-sm text-yellow-600">Runner not ready</span>}
          </div>
          <div className="mt-2 text-sm text-gray-600">
            <span className="mr-4">Workers: {status.workers}</span>
            <span className="mr-4">Queued: {status.queued}</span>
            <span>Processing: {status.processing}</span>
          </div>
          {result && <pre className="mt-4">{JSON.stringify(result, null, 2)}</pre>}
        </div>
      ) : (
        <div>Waiting for round...</div>
      )}
    </div>
  );
}
