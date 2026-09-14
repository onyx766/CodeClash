'use client'
import { useEffect, useState } from 'react';
import { infraStatus } from '../../lib/api';

export default function InfraPage() {
  const [status, setStatus] = useState({ workers: 0, queued: 0, processing: 0 });
  const [jobs, setJobs] = useState<Array<any>>([]);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [jobDetails, setJobDetails] = useState<Array<any>>([]);

  useEffect(() => {
    let mounted = true;
    const fetchAll = async () => {
      try {
        const s = await infraStatus.status();
        if (mounted) setStatus({ workers: s.workers || 0, queued: s.queued || 0, processing: s.processing || 0 });
      } catch (e) {}
      try {
        const j = await infraStatus.jobs();
        if (mounted) setJobs(j.items || []);
      } catch (e) {}
    };
    fetchAll();
    const id = setInterval(fetchAll, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl mb-4">Infrastructure Status</h2>
      <div className="mb-4">
        <strong>Workers:</strong> {status.workers} &nbsp; 
        <strong>Queued:</strong> {status.queued} &nbsp; 
        <strong>Processing:</strong> {status.processing}
      </div>
      <div>
        <h3 className="text-xl mb-2">Recent Jobs</h3>
        <div className="overflow-auto max-h-96">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                  <th className="text-left pr-4">Job ID</th>
                  <th className="text-left pr-4">User</th>
                  <th className="text-left pr-4">Match</th>
                  <th className="text-left pr-4">Match challenge</th>
                  <th className="text-left pr-4">Timestamp</th>
                  <th className="text-left pr-4">Exit</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j:any) => (
                <tr key={j.jobId}>
                    <td className="pr-4"><button className="text-blue-600 underline" onClick={async () => {
                    setSelectedJob(j.jobId);
                    const d = await infraStatus.jobDetails(j.jobId);
                    setJobDetails(d.items || []);
                  }}>{j.jobId}</button></td>
                    <td className="pr-4">{j.metadata?.userId || '-'}</td>
                    <td className="pr-4">{j.metadata?.matchId || '-'}</td>
                    <td className="pr-4">{j.metadata?.matchChallengeId || '-'}</td>
                  <td className="pr-4">{new Date(j.timestamp).toLocaleString()}</td>
                  <td>{j.exitCode}</td>
                </tr>
              ))}
              {jobs.length === 0 && <tr><td colSpan={3}>No recent jobs</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-4 rounded w-3/4 max-h-3/4 overflow-auto">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-lg">Job {selectedJob}</h4>
              <button onClick={() => { setSelectedJob(null); setJobDetails([]); }} className="text-sm text-gray-600">Close</button>
            </div>
            <div>
              {jobDetails.map((it:any, idx:number) => (
                <div key={idx} className="mb-3 p-2 border rounded">
                  <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(it, null, 2)}</pre>
                </div>
              ))}
              {jobDetails.length === 0 && <div>No results</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
