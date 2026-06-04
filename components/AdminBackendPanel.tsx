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
  | 'Command Center'
  | 'Overview'
  | 'Projects'
  | 'Run Detail'
  | 'Live Logs'
  | 'Visual QA'
  | 'Editability'
  | 'Jobs'
  | 'Artifacts'
  | 'Reports'
  | 'Sandboxes'
  | 'Billing'
  | 'Audit Logs'
  | 'Backend Blueprint'
  | 'Settings'
  | 'Team'
  | 'Support Timeline'
  | 'Support'
  | 'API Keys';

const ADMIN_BACKEND_URL = (import.meta as any).env?.VITE_ADMIN_BACKEND_URL || 'http://127.0.0.1:8787';
const ADMIN_BACKEND_TOKEN_KEY = 'whipify-admin-backend-token';

const emptyStats: AdminStats = {
  projectCount: 0,
  jobCount: 0,
  completedJobCount: 0,
  failedJobCount: 0,
  artifactCount: 0,
};

const pages: AdminConsolePage[] = [
  'Command Center',
  'Overview',
  'Projects',
  'Run Detail',
  'Live Logs',
  'Visual QA',
  'Editability',
  'Jobs',
  'Artifacts',
  'Reports',
  'Sandboxes',
  'Billing',
  'Audit Logs',
  'Backend Blueprint',
  'Settings',
  'Team',
  'Support Timeline',
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
  const [commandQuery, setCommandQuery] = useState('');
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
          ? `Authenticated admin console connected on ${ADMIN_BACKEND_URL.replace(/^https?:\/\//, '')}.`
          : `Admin console connected on ${ADMIN_BACKEND_URL.replace(/^https?:\/\//, '')}.`,
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
  const selectedProjectJobs = selectedProject ? jobs.filter((job) => job.projectId === selectedProject.id) : jobs;
  const latestJob = selectedProjectJobs[0] || jobs[0];
  const latestReport = latestJob?.report || null;
  const editabilityScore = latestReport?.summary?.editabilityScore ? Math.round(latestReport.summary.editabilityScore * 100) : 95;
  const visualScore = latestReport?.summary?.visualReadinessScore ? Math.round(latestReport.summary.visualReadinessScore * 100) : 92;

  const renderBadge = (value?: string) => (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusTone(value)}`}>
      {value || 'unknown'}
    </span>
  );

  const renderPage = () => {
    switch (activePage) {
      case 'Command Center':
        return (
          <div data-testid={pageId(activePage)} className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
              <h3 className="text-2xl font-black text-white">Global command center</h3>
              <p className="mt-2 text-sm text-slate-400">Search projects, conversion runs, artifacts, customers, failed checks, audit events, and support signals from one operator surface.</p>
              <input
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                className="mt-5 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400/70"
                placeholder="Search projects, jobs, artifacts, customers, errors"
              />
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {[
                  ['Create project', 'Start a new customer conversion from URL, ZIP, or captured site.'],
                  ['Rerun failed conversion', `${failedJobs.length} failed run(s) are ready for inspection or retry.`],
                  ['Open latest preview', state.previews[0]?.previewUrl || 'No hosted preview yet.'],
                  ['Download release package', artifacts[0]?.fileName || 'No artifact package yet.'],
                ].map(([title, body]) => (
                  <button key={title} type="button" className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left hover:border-cyan-400/50">
                    <h4 className="font-black text-white">{title}</h4>
                    <p className="mt-2 text-sm text-slate-400">{body}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-5">
              <SettingsCard title="Quick actions" icon={<PlayCircle className="w-5 h-5" />}>
                <div className="grid gap-3">
                  {['Create project', 'Rerun failed conversion', 'Open latest preview', 'Download artifact bundle', 'Create support note'].map((action) => (
                    <div key={action} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-sm font-bold text-slate-200">{action}</div>
                  ))}
                </div>
              </SettingsCard>
              <SettingsCard title="Operational focus" icon={<Activity className="w-5 h-5" />}>
                <MetricGrid items={[
                  ['Query', commandQuery || 'empty'],
                  ['Visual QA', `${visualScore}%`],
                  ['Editability', `${editabilityScore}%`],
                  ['Warnings', warnings.length],
                ]} />
              </SettingsCard>
            </div>
          </div>
        );

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

      case 'Run Detail':
        return (
          <div data-testid={pageId(activePage)} className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-black text-white">Conversion run timeline</h3>
                  <p className="mt-2 text-sm text-slate-400">{latestJob?.id || 'No run selected'} · {selectedProject?.name || 'No project selected'}</p>
                </div>
                {renderBadge(latestJob?.status || 'review')}
              </div>
              <div className="mt-5 space-y-3">
                {[
                  ['intake', 'Capture source files, routes, scripts, forms, and assets.'],
                  ['analyze', 'Classify page archetypes, section signals, risks, SEO, and lane suitability.'],
                  ['convert', 'Generate Platinum, Elementor, static, reports, and artifacts.'],
                  ['PHP lint', 'Validate generated WordPress PHP before packaging.'],
                  ['screenshot QA', 'Compare source and converted pages across breakpoints.'],
                  ['Elementor doctor', 'Check Elementor schema, editability, widgets, and fallbacks.'],
                  ['preview deploy', 'Provision WordPress sandbox and expose review links.'],
                ].map(([step, body], index) => (
                  <div key={step} className="grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-cyan-300 text-xs font-black text-slate-950">{index + 1}</div>
                    <div>
                      <h4 className="font-black text-white">{step}</h4>
                      <p className="mt-1 text-sm text-slate-400">{body}</p>
                    </div>
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-black text-emerald-100">passed</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-5">
              <SettingsCard title="Run controls" icon={<RefreshCw className="w-5 h-5" />}>
                <div className="grid gap-3">
                  {['retry run', 'cancel run', 'copy failure summary', 'open latest artifact', 'open preview'].map((action) => (
                    <button key={action} type="button" className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-left text-sm font-bold text-slate-200 hover:border-cyan-400/50">{action}</button>
                  ))}
                </div>
              </SettingsCard>
              <SettingsCard title="Run metadata" icon={<FileText className="w-5 h-5" />}>
                <MetricGrid items={[
                  ['Project', selectedProject?.name || 'none'],
                  ['Status', latestJob?.status || 'none'],
                  ['Artifacts', latestJob?.artifacts?.length || 0],
                  ['Warnings', latestJob?.report?.warnings?.length || 0],
                ]} />
              </SettingsCard>
            </div>
          </div>
        );

      case 'Live Logs':
        return (
          <div data-testid={pageId(activePage)} className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
              <h3 className="text-2xl font-black text-white">Structured logs</h3>
              <p className="mt-2 text-sm text-slate-400">Vercel-style searchable runtime logs and Trigger.dev-style worker run logs for every conversion stage.</p>
              <div className="mt-5 space-y-3">
                {[
                  ['info', 'intake', 'Captured 2 routes and 1 asset bundle.'],
                  ['info', 'convert', 'Generated Platinum and Elementor artifacts.'],
                  ['warn', 'visual', 'alignment drift detected below hero section.'],
                  ['info', 'artifact', 'copy log excerpt available for support handoff.'],
                ].map(([severity, stage, message]) => (
                  <div key={`${stage}-${message}`} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 font-mono text-xs text-slate-300">
                    <span className="text-cyan-200">severity</span>={severity} <span className="text-emerald-200">stage</span>={stage} <span className="text-slate-500">message</span>="{message}"
                  </div>
                ))}
              </div>
            </div>
            <SettingsCard title="Log controls" icon={<Search className="w-5 h-5" />}>
              <div className="grid gap-3">
                {['filter by project', 'filter by severity', 'group by conversion stage', 'copy log excerpt', 'share debug link'].map((control) => (
                  <div key={control} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-sm font-bold text-slate-200">{control}</div>
                ))}
              </div>
            </SettingsCard>
          </div>
        );

      case 'Visual QA':
        return (
          <div data-testid={pageId(activePage)} className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
              <h3 className="text-2xl font-black text-white">Visual QA dashboard</h3>
              <p className="mt-2 text-sm text-slate-400">Compare source vs converted pages by breakpoint and section before a release is marked ready.</p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  ['Source screenshot', 'Original React/static capture at 1440px.'],
                  ['Converted screenshot', 'WordPress/Elementor rendered result.'],
                  ['Diff heatmap', 'Pixel and section-level mismatch overlay.'],
                ].map(([title, body]) => (
                  <div key={title} className="min-h-44 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-4">
                    <h4 className="font-black text-white">{title}</h4>
                    <p className="mt-2 text-sm text-slate-400">{body}</p>
                  </div>
                ))}
              </div>
            </div>
            <SettingsCard title="Detected visual issues" icon={<AlertTriangle className="w-5 h-5" />}>
              <div className="grid gap-3">
                {['alignment drift', 'button width mismatch', 'typography scale mismatch', 'FAQ open state mismatch'].map((issue) => (
                  <div key={issue} className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm font-bold text-amber-100">{issue}</div>
                ))}
              </div>
            </SettingsCard>
          </div>
        );

      case 'Editability':
        return (
          <div data-testid={pageId(activePage)} className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
              <h3 className="text-2xl font-black text-white">Elementor editability dashboard</h3>
              <p className="mt-2 text-sm text-slate-400">Tracks whether converted content is actually editable through native widgets or generated custom widgets instead of opaque HTML fallbacks.</p>
              <MetricGrid items={[
                ['Editability score', `${editabilityScore}%`],
                ['Native widgets', latestReport?.summary?.nativeAtomCount || 84],
                ['Custom widgets', latestReport?.summary?.customWidgetAtomCount || 24],
                ['HTML fallback count', latestReport?.summary?.fallbackAtomCount || 3],
              ]} />
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {['Feature grid cards', 'Pricing cards', 'FAQ accordion answers', 'Review carousel items'].map((region) => (
                  <div key={region} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <h4 className="font-black text-white">{region}</h4>
                    <p className="mt-2 text-sm text-slate-400">Click/select/edit path tracked for Elementor QA.</p>
                  </div>
                ))}
              </div>
            </div>
            <SettingsCard title="Editability actions" icon={<Boxes className="w-5 h-5" />}>
              <div className="grid gap-3">
                {['Open in Elementor', 'Regenerate as custom widget', 'Flag HTML fallback', 'Export editability report'].map((action) => (
                  <button key={action} type="button" className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-left text-sm font-bold text-slate-200 hover:border-cyan-400/50">{action}</button>
                ))}
              </div>
            </SettingsCard>
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

      case 'Support Timeline':
        return (
          <div data-testid={pageId(activePage)} className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
              <h3 className="text-2xl font-black text-white">Customer timeline</h3>
              <p className="mt-2 text-sm text-slate-400">Support-facing history for customer activity, conversions, previews, downloads, billing, and operator actions.</p>
              <div className="mt-5 space-y-3">
                {[
                  ['project.created', selectedProject?.name || 'Project created'],
                  ['conversion.completed', latestJob?.id || 'Latest conversion run'],
                  ['sandbox.preview.created', state.previews[0]?.previewUrl || 'Preview requested'],
                  ['artifact.downloaded', artifacts[0]?.fileName || 'Release package'],
                  ['support.note', 'support note added after visual QA review.'],
                ].map(([action, body]) => (
                  <div key={`${action}-${body}`} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <h4 className="font-black text-white">{action}</h4>
                    <p className="mt-2 text-sm text-slate-400">{body}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-5">
              <SettingsCard title="Safe support actions" icon={<LifeBuoy className="w-5 h-5" />}>
                <div className="grid gap-3">
                  {['safe impersonation request', 'create support note', 'copy project summary', 'open billing record', 'open latest failed run'].map((action) => (
                    <div key={action} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-sm font-bold text-slate-200">{action}</div>
                  ))}
                </div>
              </SettingsCard>
              <SettingsCard title="Support guardrails" icon={<ShieldAlert className="w-5 h-5" />}>
                <p className="text-sm text-slate-400">Impersonation stays request-only until owner approval, audit logging, and provider identity are connected.</p>
              </SettingsCard>
            </div>
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

  const navigationGroups: Array<[string, AdminConsolePage[]]> = [
    ['Operations cockpit', ['Command Center', 'Overview', 'Projects']],
    ['Conversion Ops', ['Run Detail', 'Jobs', 'Live Logs', 'Artifacts', 'Sandboxes']],
    ['QA Studio', ['Visual QA', 'Editability', 'Reports']],
    ['Control Plane', ['Backend Blueprint', 'Settings', 'Billing', 'Audit Logs', 'Team', 'Support Timeline', 'Support', 'API Keys']],
  ];

  return (
    <section data-testid="operator-console-shell" className="w-full px-4 py-6 md:px-6">
      <div className="relative mx-auto max-w-[96rem] overflow-hidden rounded-[2rem] border border-slate-700/70 bg-[#07111f] shadow-2xl shadow-slate-950/50">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.12),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.94),rgba(2,6,23,0.98))]" />
        <div className="relative grid min-h-[52rem] lg:grid-cols-[18rem_1fr]">
          <aside className="border-b border-slate-800 bg-slate-950/55 p-5 backdrop-blur-xl lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/30">W</div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Whipify</p>
                <h2 className="text-lg font-black text-white">Mission Control</h2>
              </div>
            </div>
            <div className={`mt-5 rounded-2xl border p-3 text-xs font-bold ${state.connected ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100' : 'border-amber-400/20 bg-amber-400/10 text-amber-100'}`}>
              {state.connected ? 'Connected backend' : 'Backend check needed'}
            </div>
            <nav className="mt-6 space-y-6">
              {navigationGroups.map(([group, groupPages]) => (
                <div key={group}>
                  <p className="px-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{group}</p>
                  <div className="mt-2 space-y-1">
                    {groupPages.map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setActivePage(page)}
                        className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-black transition-colors ${
                          activePage === page
                            ? 'bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/30'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span>{page}</span>
                        {activePage === page && <span className="h-2 w-2 rounded-full bg-slate-950" />}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          <div className="min-w-0">
            <header className="border-b border-slate-800 bg-slate-950/35 p-5 backdrop-blur-xl">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">Operations cockpit</p>
                  <h1 className="mt-1 text-3xl font-black tracking-tight text-white">Whipify Mission Control</h1>
                  <p className="mt-1 text-sm text-slate-400">{state.message}</p>
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="relative min-w-[22rem]">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      value={commandQuery}
                      onChange={(event) => setCommandQuery(event.target.value)}
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 py-3 pl-11 pr-4 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-400/70"
                      placeholder="Search projects, runs, pages, artifacts, customers, errors..."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => refresh()}
                    disabled={isLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-slate-100 hover:border-cyan-400/50 disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Check Backend
                  </button>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {[
                  ['Active conversions', stats.jobCount],
                  ['Pages needing review', warnings.length],
                  ['Provider health', state.readiness ? 'online' : 'pending'],
                  ['Artifact vault', artifacts.length],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
                    <p className="mt-2 text-2xl font-black text-white">{value}</p>
                  </div>
                ))}
              </div>
            </header>

            {state.authRequired && !state.connected && (
              <div className="m-5 grid gap-3 rounded-3xl border border-slate-800 bg-slate-950/70 p-4 md:grid-cols-[1fr_1fr_auto]">
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

            <div className="grid gap-5 p-5 xl:grid-cols-[1fr_22rem]">
              <main className="min-w-0">
                {renderPage()}
              </main>
              <aside className="space-y-5">
                <SettingsCard title="Visual QA spotlight" icon={<AlertTriangle className="w-5 h-5" />}>
                  <MetricGrid items={[
                    ['Score', `${visualScore}%`],
                    ['Open issues', warnings.length],
                    ['Breakpoints', '3'],
                    ['Release gate', warnings.length ? 'review' : 'ready'],
                  ]} />
                </SettingsCard>
                <SettingsCard title="Elementor editability radar" icon={<Boxes className="w-5 h-5" />}>
                  <MetricGrid items={[
                    ['Score', `${editabilityScore}%`],
                    ['Fallbacks', latestReport?.summary?.fallbackAtomCount || 3],
                    ['Custom widgets', latestReport?.summary?.customWidgetAtomCount || 24],
                    ['Native widgets', latestReport?.summary?.nativeAtomCount || 84],
                  ]} />
                </SettingsCard>
                <SettingsCard title="Artifact vault" icon={<Download className="w-5 h-5" />}>
                  <div className="space-y-2">
                    {(artifacts.slice(0, 4).length ? artifacts.slice(0, 4) : [{ fileName: 'theme-package.zip', kind: 'wordpress-package' }, { fileName: 'qa-report.json', kind: 'qa-report' }]).map((artifact: any) => (
                      <div key={artifact.id || artifact.fileName} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                        <p className="text-sm font-black text-white">{artifact.fileName}</p>
                        <p className="text-xs text-slate-500">{artifact.kind}</p>
                      </div>
                    ))}
                  </div>
                </SettingsCard>
              </aside>
            </div>
          </div>
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
