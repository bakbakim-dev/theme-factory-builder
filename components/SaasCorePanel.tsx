import React, { useMemo, useState } from 'react';
import { AlertTriangle, Archive, CheckCircle2, ClipboardCheck, Layers3, Play, ShieldCheck } from 'lucide-react';
import { analyzeSaasIntake } from '../utils/saas-core/analyzer';
import { createSaasQaReport } from '../utils/saas-core/qa';
import {
  attachJobToProject,
  completeConversionJob,
  createConversionJob,
  createSaasProject,
  createStorageSaasProjectRepository,
  startConversionJob,
} from '../utils/saas-core/orchestrator';
import type { SaasConversionJob, SaasIntakeSource, SaasOutputLane, SaasProject, SaasQaReport } from '../utils/saas-core/types';

const SAMPLE_INTAKE: SaasIntakeSource = {
  id: 'sample-ai-marketing-site',
  kind: 'static-zip',
  label: 'AI marketing site export',
  sourceSummary: 'Representative Lovable/Bolt/Vite-style static marketing website.',
  routes: [
    { path: '/', title: 'Home', htmlBytes: 74000, sectionCount: 11, widgetHints: ['hero', 'feature-grid', 'testimonial-carousel', 'faq'], hasForms: true, hasScripts: true },
    { path: '/pricing/', title: 'Pricing', htmlBytes: 61000, sectionCount: 8, widgetHints: ['pricing', 'tabs', 'faq'], hasForms: false, hasScripts: true },
    { path: '/locations/', title: 'Locations', htmlBytes: 52000, sectionCount: 7, widgetHints: ['location-grid', 'map'], hasForms: false, hasScripts: false },
    { path: '/blog/', title: 'Blog', htmlBytes: 39000, sectionCount: 5, widgetHints: ['post-list'], hasForms: false, hasScripts: false },
  ],
  assets: [
    { path: '/assets/app.css', kind: 'css', bytes: 98000 },
    { path: '/assets/app.js', kind: 'js', bytes: 180000 },
    { path: '/assets/hero.webp', kind: 'image', bytes: 240000 },
    { path: '/assets/reviews.webp', kind: 'image', bytes: 180000 },
  ],
};

const LANES: SaasOutputLane[] = ['gutenberg-native', 'wordpress-elementor', 'static-site'];

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

const releaseBadgeClass = (status: string): string => {
  if (status === 'ready') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
  if (status === 'blocked') return 'border-red-500/40 bg-red-500/10 text-red-200';
  return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
};

const makeClock = () => () => new Date().toISOString();
const makeIdFactory = () => {
  let index = 0;
  return () => `saas-${Date.now().toString(36)}-${index++}`;
};

const buildReport = (intake: SaasIntakeSource): SaasQaReport => {
  const analysis = analyzeSaasIntake(intake);
  return createSaasQaReport({
    analysis,
    lanes: LANES,
    nativeAtoms: 92,
    customWidgetAtoms: 24,
    fallbackAtoms: analysis.riskFlags.length + 3,
    checks: [
      { id: 'php-lint', label: 'Generated PHP lint', scope: 'wordpress', status: 'passed' },
      { id: 'gutenberg-parity', label: 'Platinum/Gutenberg parity', scope: 'gutenberg', status: 'passed' },
      { id: 'elementor-schema', label: 'Elementor document schema', scope: 'elementor', status: 'passed' },
      { id: 'visual-parity-required', label: 'Screenshot parity gate', scope: 'visual', status: 'warning', message: 'Production jobs must run screenshot diff before release.' },
      { id: 'editability-score', label: 'Elementor editability scoring', scope: 'elementor', status: 'warning', message: 'Complex widgets need generated controls and fallback reporting.' },
    ],
  });
};

const runSampleJob = (): SaasProject => {
  const nextId = makeIdFactory();
  const clock = makeClock();
  const project = createSaasProject({
    name: 'Sample SaaS Conversion',
    intake: SAMPLE_INTAKE,
    selectedLanes: LANES,
    nextId,
    clock,
  });
  const queued = createConversionJob(project, { selectedLanes: LANES, nextId, clock });
  const running = startConversionJob(queued, clock);
  const completed = completeConversionJob(running, {
    clock,
    report: buildReport(SAMPLE_INTAKE),
    artifact: {
      id: nextId(),
      kind: 'wordpress-package',
      label: 'Downloadable WordPress package',
      fileName: 'sample-wordpress-package.zip',
      bytes: 2400000,
      sha256: 'local-preview-artifact',
    },
  });
  return attachJobToProject(project, completed);
};

const createRepository = () => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return createStorageSaasProjectRepository({ storage: window.localStorage, key: 'whipify-saas-core-projects' });
};

const SaasCorePanel: React.FC = () => {
  const repository = useMemo(createRepository, []);
  const [project, setProject] = useState<SaasProject | null>(() => repository?.listProjects()[0] || null);

  const analysis = project?.analysis || analyzeSaasIntake(SAMPLE_INTAKE);
  const latestJob: SaasConversionJob | undefined = project?.jobs[0];
  const report = latestJob?.report || buildReport(SAMPLE_INTAKE);

  const handleRun = () => {
    const nextProject = runSampleJob();
    repository?.saveProject(nextProject);
    setProject(nextProject);
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-6 pt-10">
      <div className="rounded-3xl border border-cyan-400/20 bg-slate-900/80 shadow-2xl shadow-cyan-950/40 overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))]">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">
                <ShieldCheck className="w-4 h-4" />
                SaaS Core V1
              </div>
              <h2 className="mt-4 text-3xl md:text-4xl font-black text-white tracking-tight">
                Repeatable conversion jobs, QA reports, and release gates.
              </h2>
              <p className="mt-3 max-w-3xl text-sm md:text-base text-slate-300 leading-7">
                This is the SaaS foundation layer: intake analysis, queued conversion jobs, lane isolation checks,
                editability scoring, visual-readiness scoring, and artifact manifests. It is intentionally local-first
                so the converter can mature before auth, billing, cloud queues, and hosted sandboxes are bolted on.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRun}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/40 hover:bg-cyan-200 transition-colors"
            >
              <Play className="w-4 h-4" />
              Run Sample SaaS Job
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-0">
          <div className="p-6 md:p-8 border-b lg:border-b-0 lg:border-r border-slate-800">
            <div className="flex items-center gap-2 text-slate-100 font-bold">
              <Layers3 className="w-5 h-5 text-cyan-300" />
              Intake Analysis
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-4">
                <dt className="text-slate-500">Routes</dt>
                <dd className="mt-1 text-2xl font-black text-white">{analysis.routeCount}</dd>
              </div>
              <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-4">
                <dt className="text-slate-500">Assets</dt>
                <dd className="mt-1 text-2xl font-black text-white">{analysis.assetCount}</dd>
              </div>
            </dl>
            <div className="mt-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">Detected sections</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {analysis.sectionSignals.map((signal) => (
                  <span key={signal} className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1 text-xs text-slate-300">
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 border-b lg:border-b-0 lg:border-r border-slate-800">
            <div className="flex items-center gap-2 text-slate-100 font-bold">
              <ClipboardCheck className="w-5 h-5 text-emerald-300" />
              QA Summary
            </div>
            <div className="mt-5 grid gap-3">
              <div className={`rounded-2xl border px-4 py-3 text-sm font-black uppercase tracking-[0.18em] ${releaseBadgeClass(report.summary.releaseStatus)}`}>
                {report.summary.releaseStatus}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-4">
                  <p className="text-slate-500 text-sm">Editability</p>
                  <p className="mt-1 text-2xl font-black text-white">{formatPercent(report.summary.editabilityScore)}</p>
                </div>
                <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-4">
                  <p className="text-slate-500 text-sm">Visual Ready</p>
                  <p className="mt-1 text-2xl font-black text-white">{formatPercent(report.summary.visualReadinessScore)}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                {report.summary.passedChecks} passed, {report.summary.warningChecks} warnings, {report.summary.failedChecks} failed.
              </p>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="flex items-center gap-2 text-slate-100 font-bold">
              <Archive className="w-5 h-5 text-amber-300" />
              Job + Artifacts
            </div>
            {latestJob ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">Latest job</p>
                  <p className="mt-2 text-lg font-black text-white">{latestJob.status}</p>
                  <p className="mt-1 text-xs text-slate-500">{latestJob.id}</p>
                </div>
                {latestJob.artifacts.map((artifact) => (
                  <div key={artifact.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <p className="font-bold text-slate-100">{artifact.label}</p>
                    <p className="text-xs text-slate-500 mt-1">{artifact.fileName}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-5 text-sm text-slate-400">
                No local SaaS job has been run yet. Run the sample job to create a project, QA report, and artifact manifest.
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-800 p-6 md:p-8">
          <div className="grid md:grid-cols-2 gap-4">
            {report.checks.slice(0, 6).map((check) => (
              <div key={check.id} className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                {check.status === 'passed' ? <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0" />}
                <div>
                  <p className="font-bold text-slate-100">{check.label}</p>
                  <p className="text-xs text-slate-500 mt-1">{check.message || check.scope}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SaasCorePanel;
