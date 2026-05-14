import React, { useState } from 'react';
import { Database, RefreshCw, Server, ShieldAlert } from 'lucide-react';

interface AdminStats {
  projectCount: number;
  jobCount: number;
  completedJobCount: number;
  failedJobCount: number;
  artifactCount: number;
}

interface AdminBackendState {
  connected: boolean;
  message: string;
  stats: AdminStats | null;
}

const ADMIN_BACKEND_URL = 'http://127.0.0.1:8787';

const emptyStats: AdminStats = {
  projectCount: 0,
  jobCount: 0,
  completedJobCount: 0,
  failedJobCount: 0,
  artifactCount: 0,
};

const AdminBackendPanel: React.FC = () => {
  const [state, setState] = useState<AdminBackendState>({
    connected: false,
    message: 'Backend not checked yet.',
    stats: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const health = await fetch(`${ADMIN_BACKEND_URL}/api/admin/health`);
      if (!health.ok) throw new Error(`Health check failed with ${health.status}`);
      const statsResponse = await fetch(`${ADMIN_BACKEND_URL}/api/admin/stats`);
      if (!statsResponse.ok) throw new Error(`Stats request failed with ${statsResponse.status}`);
      const statsJson = await statsResponse.json();
      setState({
        connected: true,
        message: 'Admin backend connected on 127.0.0.1:8787.',
        stats: statsJson.stats || emptyStats,
      });
    } catch (error) {
      setState({
        connected: false,
        message: error instanceof Error ? error.message : String(error),
        stats: null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stats = state.stats || emptyStats;

  return (
    <section className="w-full max-w-7xl mx-auto px-6 pt-6">
      <div className="rounded-3xl border border-slate-700/70 bg-slate-900/75 p-5 md:p-6 shadow-xl shadow-slate-950/30">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`rounded-2xl p-3 ${state.connected ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-400/10 text-amber-200'}`}>
              {state.connected ? <Server className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 font-black">Admin Backend V1</p>
              <h2 className="mt-1 text-xl font-black text-white">Local API, database, artifacts, and operator stats.</h2>
              <p className="mt-1 text-sm text-slate-400">{state.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-slate-100 hover:border-cyan-400/50 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Check Backend
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ['Projects', stats.projectCount],
            ['Jobs', stats.jobCount],
            ['Completed', stats.completedJobCount],
            ['Failed', stats.failedJobCount],
            ['Artifacts', stats.artifactCount],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-[0.18em] font-bold">
                <Database className="w-3 h-3" />
                {label}
              </div>
              <p className="mt-2 text-2xl font-black text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AdminBackendPanel;
