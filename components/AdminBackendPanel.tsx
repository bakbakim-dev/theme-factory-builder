import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Boxes,
  ClipboardList,
  Database,
  Download,
  ExternalLink,
  FileText,
  KeyRound,
  LifeBuoy,
  PlayCircle,
  Receipt,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldAlert,
  Users,
} from 'lucide-react';
import {
  WHIPIFY_PRODUCTION_BACKEND_SQL,
  WHIPIFY_RECOMMENDED_BACKEND_STACK,
  createBackendProviderReadiness,
} from '../utils/backendBlueprint';

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
  readiness: any | null;
  authRequired: boolean;
  token: string;
  me: any | null;
  projects: any[];
  jobs: any[];
  auditEvents: any[];
  subscription: any | null;
  previews: any[];
}

type AdminConsolePage =
  | 'Overview'
  | 'Projects'
  | 'Jobs'
  | 'Artifacts'
  | 'Reports'
  | 'Sandboxes'
  | 'Billing'
  | 'Audit Logs'
  | 'Backend Blueprint'
  | 'Settings'
  | 'Team'
  | 'Support'
  | 'API Keys';

const ADMIN_BACKEND_URL = 'http://127.0.0.1:8787';
const ADMIN_BACKEND_TOKEN_KEY = 'whipify-admin-backend-token';

const emptyStats: AdminStats = {
  projectCount: 0,
  jobCount: 0,
  completedJobCount: 0,
  failedJobCount: 0,
  artifactCount: 0,
};

const pages: AdminConsolePage[] = [
  'Overview',
  'Projects',
  'Jobs',
  'Artifacts',
  'Reports',
  'Sandboxes',
  'Billing',
  'Audit Logs',
  'Backend Blueprint',
  'Settings',
  'Team',
  'Support',
  'API Keys',
];

const pageId = (page: string): string => `admin-console-page-${page.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

const formatDate = (value?: string): string => {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const statusTone = (status?: string): string => {
  if (['completed', 'active', 'passed', 'provisioned'].includes(status || '')) return 'text-emerald-200 bg-emerald-400/10 border-emerald-400/20';
  if (['failed', 'canceled', 'blocked'].includes(status || '')) return 'text-rose-200 bg-rose-400/10 border-rose-400/20';
  if (['running', 'queued', 'trialing', 'review'].includes(status || '')) return 'text-amber-200 bg-amber-400/10 border-amber-400/20';
  return 'text-slate-300 bg-slate-800 border-slate-700';
};

const uniqueArtifactsFromJobs = (jobs: any[]): any[] => {
  const artifacts = new Map<string, any>();
  for (const job of jobs) {
    for (const artifact of job.artifacts || []) {
      artifacts.set(artifact.id, { ...artifact, jobId: job.id, projectId: job.projectId });
    }
  }
  return Array.from(artifacts.values());
};

const AdminBackendPanel: React.FC = () => {
  const env = (import.meta as any).env || {};
  const [state, setState] = useState<AdminBackendState>({
    connected: false,
    message: 'Backend not checked yet.',
    stats: null,
    readiness: null,
    authRequired: false,
    token: typeof window !== 'undefined' ? window.localStorage.getItem(ADMIN_BACKEND_TOKEN_KEY) || '' : '',
    me: null,
    projects: [],
    jobs: [],
    auditEvents: [],
    subscription: null,
    previews: [],
  });
  const [activePage, setActivePage] = useState<AdminConsolePage>('Overview');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [signedUrlMessage, setSignedUrlMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const requestHeaders = (token = state.token): HeadersInit => (
    token ? { authorization: `Bearer ${token}` } : {}
  );

  const getJson = async (path: string, token = state.token): Promise<any | null> => {
    const response = await fetch(`${ADMIN_BACKEND_URL}${path}`, { headers: requestHeaders(token) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
    return response.json();
  };

  const refresh = async (token = state.token) => {
    setIsLoading(true);
    setActionMessage('');
    try {
      const health = await fetch(`${ADMIN_BACKEND_URL}/api/admin/health`);
      if (!health.ok) throw new Error(`Health check failed with ${health.status}`);
      const healthJson = await health.json();
      if (healthJson.authRequired && !token) {
        setState((current) => ({
          ...current,
          connected: false,
          authRequired: true,
          message: 'Admin backend requires login.',
          stats: null,
          readiness: null,
        }));
        return;
      }

      const statsResponse = await fetch(`${ADMIN_BACKEND_URL}/api/admin/stats`, { headers: requestHeaders(token) });
      if (statsResponse.status === 401) {
        setState((current) => ({
          ...current,
          connected: false,
          authRequired: true,
          token: '',
          message: 'Admin backend rejected the saved token. Login again.',
          stats: null,
          readiness: null,
          me: null,
        }));
        window.localStorage.removeItem(ADMIN_BACKEND_TOKEN_KEY);
        return;
      }
      if (!statsResponse.ok) throw new Error(`Stats request failed with ${statsResponse.status}`);
      const statsJson = await statsResponse.json();

      const [readinessJson, projectsJson, jobsJson, meJson, auditJson, billingJson, previewsJson] = await Promise.all([
        healthJson.authRequired ? getJson('/api/admin/production/readiness', token).catch(() => null) : Promise.resolve(null),
        getJson('/api/admin/projects', token).catch(() => ({ projects: [] })),
        getJson('/api/admin/jobs', token).catch(() => ({ jobs: [] })),
        healthJson.authRequired ? getJson('/api/admin/me', token).catch(() => null) : Promise.resolve(null),
        healthJson.authRequired ? getJson('/api/admin/audit-events', token).catch(() => ({ events: [] })) : Promise.resolve({ events: [] }),
        healthJson.authRequired ? getJson('/api/admin/billing/subscription', token).catch(() => ({ subscription: null })) : Promise.resolve({ subscription: null }),
        healthJson.authRequired ? getJson('/api/admin/sandbox-previews', token).catch(() => ({ previews: [] })) : Promise.resolve({ previews: [] }),
      ]);

      setState({
        connected: true,
        authRequired: Boolean(healthJson.authRequired),
        token,
        message: healthJson.authRequired
          ? 'Authenticated admin console connected on 127.0.0.1:8787.'
          : 'Admin console connected on 127.0.0.1:8787.',
        stats: statsJson.stats || emptyStats,
        readiness: readinessJson?.readiness || null,
        projects: projectsJson?.projects || [],
        jobs: jobsJson?.jobs || [],
        me: meJson || null,
        auditEvents: auditJson?.events || [],
        subscription: billingJson?.subscription || null,
        previews: previewsJson?.previews || [],
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        connected: false,
        message: error instanceof Error ? error.message : String(error),
        stats: null,
        readiness: null,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const login = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${ADMIN_BACKEND_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error(`Login failed with ${response.status}`);
      const json = await response.json();
      window.localStorage.setItem(ADMIN_BACKEND_TOKEN_KEY, json.token);
      setState((current) => ({ ...current, token: json.token, authRequired: true }));
      await refresh(json.token);
    } catch (error) {
      setState((current) => ({
        ...current,
        connected: false,
        authRequired: true,
        message: error instanceof Error ? error.message : String(error),
        stats: null,
        readiness: null,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const postJson = async (path: string, body: unknown = {}) => {
    const response = await fetch(`${ADMIN_BACKEND_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...requestHeaders() },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
    return response.json();
  };

  const createSignedUrl = async (artifactId: string) => {
    try {
      const json = await getJson(`/api/admin/artifacts/${artifactId}/signed-url`);
      setSignedUrlMessage(`Signed URL ready: ${json?.signedUrl?.url || artifactId}`);
    } catch (error) {
      setSignedUrlMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const createSandboxPreview = async (projectId: string, jobId?: string) => {
    try {
      await postJson(`/api/admin/projects/${projectId}/sandbox-previews`, { jobId });
      setActionMessage('Sandbox preview created.');
      await refresh();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const runWorker = async () => {
    try {
      await postJson('/api/admin/worker/run-next');
      setActionMessage('Worker run-next completed.');
      await refresh();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const stats = state.stats || emptyStats;
  const projects = state.projects;
  const jobs = state.jobs;
  const artifacts = uniqueArtifactsFromJobs(jobs);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) || projects[0];
  const filteredProjects = projects.filter((project) => {
    const matchesSearch = !projectSearch || `${project.name} ${project.id}`.toLowerCase().includes(projectSearch.toLowerCase());
    const matchesStatus = projectStatusFilter === 'all' || project.status === projectStatusFilter;
    return matchesSearch && matchesStatus;
  });
  const failedJobs = jobs.filter((job) => job.status === 'failed');
  const warnings = jobs.flatMap((job) => job.report?.warnings || []);

  const renderBadge = (value?: string) => (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusTone(value)}`}>
      {value || 'unknown'}
    </span>
  );

  const renderPage = () => {
    switch (activePage) {
      case 'Overview':
        return (
          <div data-testid={pageId(activePage)} className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
              <h3 className="text-2xl font-black text-white">Overview dashboard</h3>
              <p className="mt-2 text-sm text-slate-400">Operator snapshot for projects, jobs, artifacts, billing, queue health, previews, and incidents.</p>
              <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  ['Projects', stats.projectCount],
                  ['Jobs', stats.jobCount],
                  ['Completed', stats.completedJobCount],
                  ['Failed', stats.failedJobCount],
                  ['Artifacts', stats.artifactCount],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                    <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-[0.16em] font-bold">
                      <Database className="w-3 h-3" />
                      {label}
                    </div>
                    <p className="mt-2 text-2xl font-black text-white">{value}</p>
                  </div>
                ))}
              </div>
              {state.readiness && (
                <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-cyan-200 font-black">Production Infrastructure</div>
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <Metric label="Migrations" value={`${state.readiness.migrations?.appliedCount || 0}/${state.readiness.migrations?.requiredCount || 0}`} />
                    <Metric label="Billing" value={state.readiness.billing?.status || 'missing'} />
                    <Metric label="Queue Done" value={state.readiness.queue?.completedCount || 0} />
                    <Metric label="Previews" value={state.readiness.sandboxes?.previewCount || 0} />
                    <Metric label="Audit Events" value={state.readiness.audit?.eventCount || 0} />
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
              <h3 className="text-xl font-black text-white">Admin Notifications</h3>
              <div className="mt-4 space-y-3">
                {(state.subscription?.status ? [] : ['Billing subscription is missing for this tenant.'])
                  .concat(failedJobs.length ? [`${failedJobs.length} conversion job(s) failed.`] : [])
                  .concat(warnings.slice(0, 3))
                  .concat(state.readiness ? [] : ['Production readiness endpoint is unavailable.'])
                  .map((notice, index) => (
                    <div key={`${notice}-${index}`} className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                      {notice}
                    </div>
                  ))}
                {state.subscription?.status && failedJobs.length === 0 && warnings.length === 0 && state.readiness && (
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">
                    No active admin notifications.
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'Projects':
        return (
          <div data-testid={pageId(activePage)} className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
              <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <h3 className="text-2xl font-black text-white">Project list</h3>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                    <input
                      value={projectSearch}
                      onChange={(event) => setProjectSearch(event.target.value)}
                      placeholder="Search projects"
                      className="w-56 rounded-2xl border border-slate-700 bg-slate-950 py-3 pl-9 pr-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
                    />
                  </div>
                  <select
                    value={projectStatusFilter}
                    onChange={(event) => setProjectStatusFilter(event.target.value)}
                    className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none"
                  >
                    <option value="all">All status</option>
                    <option value="analyzed">Analyzed</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="converting">Converting</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {filteredProjects.map((project) => (
                  <div key={project.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <h4 className="font-black text-white">{project.name}</h4>
                        <p className="text-xs text-slate-500">{project.id} · {project.analysis?.routeCount || 0} route(s) · {project.selectedLanes?.join(', ')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {renderBadge(project.status)}
                        <button type="button" onClick={() => setSelectedProjectId(project.id)} className="rounded-xl bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950">Open Detail</button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredProjects.length === 0 && <EmptyState label="No projects match the current search/filter." />}
              </div>
            </div>
            <ProjectDetail project={selectedProject} jobs={jobs.filter((job) => job.projectId === selectedProject?.id)} onCreateSandbox={createSandboxPreview} />
          </div>
        );

      case 'Jobs':
        return (
          <div data-testid={pageId(activePage)} className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-white">Jobs and queue</h3>
                <button type="button" onClick={runWorker} className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950">
                  <PlayCircle className="w-4 h-4" />
                  Run Worker
                </button>
              </div>
              {actionMessage && <p className="mt-3 text-sm text-cyan-200">{actionMessage}</p>}
              <div className="mt-4 space-y-3">
                {jobs.map((job) => (
                  <div key={job.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <h4 className="font-black text-white">{job.id}</h4>
                        <p className="text-xs text-slate-500">{job.selectedLanes?.join(', ')} · updated {formatDate(job.updatedAt)}</p>
                      </div>
                      {renderBadge(job.status)}
                    </div>
                    <div className="mt-3 text-xs text-slate-400">{job.events?.slice(-1)[0]?.message || 'No job event message.'}</div>
                  </div>
                ))}
                {jobs.length === 0 && <EmptyState label="No jobs yet." />}
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
              <h3 className="text-xl font-black text-white">Worker Health</h3>
              <MetricGrid items={[
                ['Queued', state.readiness?.queue?.queuedCount || 0],
                ['Running', state.readiness?.queue?.runningCount || 0],
                ['Completed', state.readiness?.queue?.completedCount || 0],
                ['Failed', state.readiness?.queue?.failedCount || 0],
              ]} />
              <h3 className="mt-6 text-xl font-black text-white">Retry / cancel policy</h3>
              <p className="mt-2 text-sm text-slate-400">Retry and cancel controls are represented at the queue layer. Remote worker provider integration will make these durable across processes.</p>
            </div>
          </div>
        );

      case 'Artifacts':
        return (
          <div data-testid={pageId(activePage)} className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
            <h3 className="text-2xl font-black text-white">Artifacts and downloads</h3>
            {signedUrlMessage && <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-sm text-cyan-100">Signed URL ready · {signedUrlMessage}</div>}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {artifacts.map((artifact) => (
                <div key={artifact.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-black text-white">{artifact.label}</h4>
                      <p className="text-xs text-slate-500">{artifact.fileName} · {artifact.bytes} bytes · {artifact.kind}</p>
                    </div>
                    <button type="button" onClick={() => createSignedUrl(artifact.id)} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950">
                      <Download className="w-4 h-4" />
                      Create Signed URL
                    </button>
                  </div>
                </div>
              ))}
              {artifacts.length === 0 && <EmptyState label="No artifacts yet." />}
            </div>
          </div>
        );

      case 'Reports':
        return (
          <div data-testid={pageId(activePage)} className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
            <h3 className="text-2xl font-black text-white">Conversion Report Viewer</h3>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {jobs.map((job) => (
                <div key={job.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-black text-white">{job.id}</h4>
                    {renderBadge(job.report?.summary?.releaseStatus || job.status)}
                  </div>
                  <MetricGrid items={[
                    ['Editability', `${job.report?.summary?.editabilityScore ?? 0}%`],
                    ['Visual Ready', `${job.report?.summary?.visualReadinessScore ?? 0}%`],
                    ['Fallback', `${Math.round((job.report?.summary?.fallbackRatio || 0) * 100)}%`],
                    ['Checks', job.report?.summary?.totalChecks || 0],
                  ]} />
                  <div className="mt-3 space-y-2">
                    {(job.report?.checks || []).slice(0, 5).map((check: any) => (
                      <div key={check.id} className="rounded-xl bg-slate-950/60 p-3 text-sm text-slate-300">
                        <span className="font-bold text-white">{check.label}</span> · {check.status}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {jobs.length === 0 && <EmptyState label="No conversion reports yet." />}
            </div>
          </div>
        );

      case 'Sandboxes':
        return (
          <div data-testid={pageId(activePage)} className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-2xl font-black text-white">Sandbox preview manager</h3>
              {selectedProject && (
                <button type="button" onClick={() => createSandboxPreview(selectedProject.id, jobs.find((job) => job.projectId === selectedProject.id)?.id)} className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950">
                  Create Preview
                </button>
              )}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {state.previews.map((preview) => (
                <div key={preview.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-black text-white">{preview.id}</h4>
                      <p className="text-xs text-slate-500">{preview.projectId} · {preview.provider}</p>
                    </div>
                    {renderBadge(preview.status)}
                  </div>
                  <a className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-cyan-200" href={preview.previewUrl} target="_blank" rel="noreferrer">
                    Open preview <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
              {state.previews.length === 0 && <EmptyState label="No sandbox previews yet." />}
            </div>
          </div>
        );

      case 'Billing':
        return (
          <div data-testid={pageId(activePage)} className="grid gap-5 lg:grid-cols-[0.9fr_1fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
              <h3 className="text-2xl font-black text-white">Billing and subscription</h3>
              <MetricGrid items={[
                ['Plan', state.subscription?.plan || state.readiness?.billing?.plan || 'none'],
                ['Status', state.subscription?.status || state.readiness?.billing?.status || 'missing'],
                ['Provider', state.subscription?.provider || 'local/test'],
                ['Renews', state.subscription?.currentPeriodEnd ? formatDate(state.subscription.currentPeriodEnd) : 'Not set'],
              ]} />
            </div>
            <ProviderPending title="Stripe provider" body="Checkout sessions, portal links, webhook verification, tax, coupons, and dunning are ready to wire into this subscription contract once Stripe credentials exist." />
          </div>
        );

      case 'Audit Logs':
        return (
          <div data-testid={pageId(activePage)} className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
            <h3 className="text-2xl font-black text-white">Audit Logs</h3>
            <div className="mt-4 space-y-3">
              {state.auditEvents.map((event) => (
                <div key={event.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <h4 className="font-black text-white">{event.action}</h4>
                    <span className="text-xs text-slate-500">{formatDate(event.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{event.message}</p>
                  <p className="mt-1 text-xs text-slate-500">{event.scope} · {event.targetId || 'tenant'}</p>
                </div>
              ))}
              {state.auditEvents.length === 0 && <EmptyState label="No audit events yet." />}
            </div>
          </div>
        );

      case 'Backend Blueprint':
        return (
          <div data-testid={pageId(activePage)} className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-black text-white">Perfect backend blueprint</h3>
                  <p className="mt-2 text-sm text-slate-400">The recommended hybrid stack for Whipify: Postgres source of truth, durable jobs, object storage, billing, auth, and sandbox previews.</p>
                </div>
                <ExternalLink className="h-5 w-5 text-cyan-300" />
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {Object.entries(WHIPIFY_RECOMMENDED_BACKEND_STACK).map(([key, entry]) => (
                  <div key={key} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-cyan-200 font-black">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                    <h4 className="mt-2 text-lg font-black text-white">{entry.provider}</h4>
                    <p className="mt-2 text-sm text-slate-400">{entry.role}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-emerald-200 font-black">Recommended build shape</div>
                <p className="mt-2 text-sm text-emerald-100">Client portal on top, admin console behind operator tools, API server in the middle, Postgres as the source of truth, R2 for artifacts, Trigger.dev for jobs, Stripe for billing, and Temporal as the future upgrade for durable multi-step workflows.</p>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-cyan-200 font-black">UI inspiration</div>
                  <p className="mt-2 text-sm text-slate-300">Vercel-style project pages with deployments, logs, domains, and settings.</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-cyan-200 font-black">UI inspiration</div>
                  <p className="mt-2 text-sm text-slate-300">Trigger.dev-style run logs with retries, status, and durable worker progress.</p>
                </div>
              </div>
            </div>
            <div className="space-y-5">
              <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
                <h3 className="text-2xl font-black text-white">Provider readiness</h3>
                <div className="mt-4 grid gap-3">
                  {createBackendProviderReadiness({
                    WHIPIFY_DATABASE_URL: env.WHIPIFY_DATABASE_URL,
                    WHIPIFY_AUTH_SECRET: env.WHIPIFY_AUTH_SECRET,
                    WHIPIFY_R2_BUCKET: env.WHIPIFY_R2_BUCKET,
                    WHIPIFY_TRIGGER_PROJECT_ID: env.WHIPIFY_TRIGGER_PROJECT_ID,
                    WHIPIFY_STRIPE_SECRET_KEY: env.WHIPIFY_STRIPE_SECRET_KEY,
                    WHIPIFY_TEMPORAL_NAMESPACE: env.WHIPIFY_TEMPORAL_NAMESPACE,
                    WHIPIFY_SANDBOX_PROVIDER: env.WHIPIFY_SANDBOX_PROVIDER,
                  }).providers.map((provider) => (
                    <div key={provider.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-white">{provider.provider}</p>
                          <p className="mt-1 text-xs text-slate-400">{provider.role}</p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${statusTone(provider.status)}`}>{provider.status}</span>
                      </div>
                      <p className="mt-3 text-sm text-slate-300">{provider.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
                <h3 className="text-2xl font-black text-white">SQL schema contract</h3>
                <p className="mt-2 text-sm text-slate-400">This is the shape the production backend should converge on once managed Postgres is wired in.</p>
                <pre className="mt-4 max-h-[26rem] overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-4 text-[11px] leading-5 text-slate-300">{WHIPIFY_PRODUCTION_BACKEND_SQL}</pre>
              </div>
            </div>
          </div>
        );

      case 'Settings':
        return (
          <div data-testid={pageId(activePage)} className="grid gap-5 lg:grid-cols-2">
            <ProviderStatus />
            <div className="space-y-5">
              <SettingsCard title="Worker Health" icon={<Activity className="w-5 h-5" />}>
                <MetricGrid items={[
                  ['Queued', state.readiness?.queue?.queuedCount || 0],
                  ['Running', state.readiness?.queue?.runningCount || 0],
                  ['Completed', state.readiness?.queue?.completedCount || 0],
                  ['Failed', state.readiness?.queue?.failedCount || 0],
                ]} />
              </SettingsCard>
              <SettingsCard title="Rate Limit Usage" icon={<ShieldAlert className="w-5 h-5" />}>
                <p className="text-sm text-slate-400">Protected API limiter is active when production infrastructure is enabled. Persistent distributed rate-limit storage is a provider integration track.</p>
              </SettingsCard>
              <SettingsCard title="Incident Dashboard" icon={<AlertTriangle className="w-5 h-5" />}>
                <p className="text-sm text-slate-400">{failedJobs.length} failed job(s), {warnings.length} report warning(s), {state.auditEvents.filter((event) => String(event.action).includes('failed')).length} failed audit event(s).</p>
              </SettingsCard>
              <SettingsCard title="Admin Notifications" icon={<ClipboardList className="w-5 h-5" />}>
                <p className="text-sm text-slate-400">Notifications are derived from billing, failed jobs, report warnings, provider readiness, and audit events.</p>
              </SettingsCard>
            </div>
          </div>
        );

      case 'Team':
        return (
          <div data-testid={pageId(activePage)} className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
              <h3 className="text-2xl font-black text-white">User and team management</h3>
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <h4 className="font-black text-white">{state.me?.user?.displayName || 'Current admin'}</h4>
                <p className="text-sm text-slate-400">{state.me?.user?.email || email}</p>
                <div className="mt-3">{renderBadge(state.me?.user?.role || 'owner')}</div>
              </div>
            </div>
            <SettingsCard title="Role-based UI permissions" icon={<Users className="w-5 h-5" />}>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ['Owner', 'Billing, providers, users, impersonation approval, all jobs.'],
                  ['Admin', 'Projects, jobs, artifacts, previews, reports, audit.'],
                  ['Operator', 'Run jobs, inspect reports, manage previews, no billing/users.'],
                ].map(([role, body]) => (
                  <div key={role} className="rounded-2xl bg-slate-900/70 p-4">
                    <h4 className="font-black text-white">{role}</h4>
                    <p className="mt-2 text-sm text-slate-400">{body}</p>
                  </div>
                ))}
              </div>
            </SettingsCard>
          </div>
        );

      case 'Support':
        return (
          <div data-testid={pageId(activePage)} className="grid gap-5 lg:grid-cols-2">
            <SettingsCard title="Customer support console" icon={<LifeBuoy className="w-5 h-5" />}>
              <p className="text-sm text-slate-400">Support can inspect tenant project/job/report state from this console once provider accounts are connected.</p>
            </SettingsCard>
            <SettingsCard title="Admin impersonation" icon={<ShieldAlert className="w-5 h-5" />}>
              <p className="text-sm text-slate-400">Impersonation requires owner role and explicit audit trail. It is intentionally not executable until the production policy and provider identity layer are connected.</p>
            </SettingsCard>
          </div>
        );

      case 'API Keys':
        return (
          <div data-testid={pageId(activePage)} className="grid gap-5 lg:grid-cols-2">
            <SettingsCard title="API keys and secrets" icon={<KeyRound className="w-5 h-5" />}>
              <p className="text-sm text-slate-400">API key inventory and secret rotation UI are represented here. Real secret storage must be backed by the deployment secret manager, not local files.</p>
            </SettingsCard>
            <SettingsCard title="Secret handling policy" icon={<ShieldAlert className="w-5 h-5" />}>
              <p className="text-sm text-slate-400">Never commit live provider keys. Use environment variables, CI/CD secret storage, and provider-specific scoped tokens.</p>
            </SettingsCard>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-6 pt-6">
      <div className="rounded-[2rem] border border-slate-700/70 bg-slate-900/75 p-5 md:p-6 shadow-xl shadow-slate-950/30">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`rounded-2xl p-3 ${state.connected ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-400/10 text-amber-200'}`}>
              {state.connected ? <Server className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 font-black">Admin Console V1</p>
              <h2 className="mt-1 text-xl md:text-2xl font-black text-white">Operator console for projects, jobs, artifacts, billing, previews, audits, providers, and support.</h2>
              <p className="mt-1 text-sm text-slate-400">{state.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refresh()}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-slate-100 hover:border-cyan-400/50 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Check Backend
          </button>
        </div>

        {state.authRequired && !state.connected && (
          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400/70"
              placeholder="Admin email"
              type="email"
            />
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400/70"
              placeholder="Admin password"
              type="password"
            />
            <button
              type="button"
              onClick={login}
              disabled={isLoading || !email || !password}
              className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-200 disabled:opacity-60"
            >
              Login
            </button>
          </div>
        )}

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {pages.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => setActivePage(page)}
              className={`whitespace-nowrap rounded-2xl px-4 py-2.5 text-sm font-black transition-colors ${
                activePage === page
                  ? 'bg-cyan-300 text-slate-950'
                  : 'border border-slate-800 bg-slate-950 text-slate-300 hover:border-cyan-400/50'
              }`}
            >
              {page}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {renderPage()}
        </div>
      </div>
    </section>
  );
};

const Metric: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-xl bg-slate-950/60 p-3">
    <p className="text-slate-500 font-bold">{label}</p>
    <p className="text-white font-black">{value}</p>
  </div>
);

const MetricGrid: React.FC<{ items: Array<[string, React.ReactNode]> }> = ({ items }) => (
  <div className="mt-4 grid grid-cols-2 gap-3">
    {items.map(([label, value]) => <Metric key={label} label={label} value={value} />)}
  </div>
);

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-6 text-sm text-slate-400">
    {label}
  </div>
);

const ProjectDetail: React.FC<{ project?: any; jobs: any[]; onCreateSandbox: (projectId: string, jobId?: string) => void }> = ({ project, jobs, onCreateSandbox }) => {
  if (!project) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
        <h3 className="text-xl font-black text-white">Project Detail</h3>
        <EmptyState label="Select or create a project to inspect details." />
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
      <h3 className="text-xl font-black text-white">Project Detail</h3>
      <h4 className="mt-3 text-2xl font-black text-white">{project.name}</h4>
      <p className="mt-1 text-sm text-slate-400">{project.id}</p>
      <MetricGrid items={[
        ['Routes', project.analysis?.routeCount || 0],
        ['Assets', project.analysis?.assetCount || 0],
        ['Jobs', jobs.length],
        ['Status', project.status],
      ]} />
      <div className="mt-4">
        <button type="button" onClick={() => onCreateSandbox(project.id, jobs[0]?.id)} className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950">
          Create Sandbox Preview
        </button>
      </div>
      <div className="mt-5">
        <h5 className="font-black text-white">Conversion lanes</h5>
        <div className="mt-2 flex flex-wrap gap-2">
          {(project.selectedLanes || []).map((lane: string) => (
            <span key={lane} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300">{lane}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

const SettingsCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
    <div className="flex items-center gap-3">
      <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-200">{icon}</div>
      <h3 className="text-xl font-black text-white">{title}</h3>
    </div>
    <div className="mt-4">{children}</div>
  </div>
);

const ProviderPending: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <SettingsCard title={title} icon={<Settings className="w-5 h-5" />}>
    <p className="text-sm text-slate-400">{body}</p>
    <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs font-bold text-amber-100">Provider pending</div>
  </SettingsCard>
);

const ProviderStatus: React.FC = () => (
  <SettingsCard title="Provider Configuration" icon={<Boxes className="w-5 h-5" />}>
    <div className="grid gap-3">
      {[
        ['Managed database', 'Local JSON adapter active; managed DB provider pending.'],
        ['Stripe billing', 'Subscription contract active; Stripe checkout/webhook provider pending.'],
        ['Cloud artifacts', 'Signed URL contract active; S3/R2/GCS provider pending.'],
        ['Remote workers', 'Queue contract active; remote worker provider pending.'],
        ['WordPress sandboxes', 'Preview record contract active; hosted provisioning provider pending.'],
        ['Observability', 'Audit logs active; metrics/alerts provider pending.'],
      ].map(([label, body]) => (
        <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-black text-white">{label}</h4>
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-xs font-black text-amber-100">pending</span>
          </div>
          <p className="mt-2 text-sm text-slate-400">{body}</p>
        </div>
      ))}
    </div>
  </SettingsCard>
);

export default AdminBackendPanel;
