import React, { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CloudUpload,
  Code2,
  Download,
  Eye,
  FileArchive,
  Globe2,
  LayoutDashboard,
  LockKeyhole,
  MousePointer2,
  PlayCircle,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react';

interface ClientPortalProps {
  onOpenOperatorTools: () => void;
  operatorToolsOpen: boolean;
}

const intakeOptions = [
  {
    title: 'AI builder URL',
    description: 'Paste a Lovable, Bolt, v0, Framer, Webflow, or published prototype URL.',
    icon: WandSparkles,
  },
  {
    title: 'Static ZIP upload',
    description: 'Upload exported HTML, CSS, JS, images, and forms from any static site builder.',
    icon: FileArchive,
  },
  {
    title: 'React build folder',
    description: 'Bring a Vite/React build artifact without asking clients to understand React.',
    icon: Code2,
  },
  {
    title: 'Public website crawl',
    description: 'Capture pages, assets, links, and SEO-critical structure from an existing site.',
    icon: Globe2,
  },
];

const outputModes = [
  {
    title: 'Platinum WordPress',
    description: 'The safe Gutenberg baseline with real post_content and SEO-friendly WordPress pages.',
    badge: 'Best for launch',
  },
  {
    title: 'Native Elementor',
    description: 'Editable Elementor documents, generated widgets, and fallback reporting when needed.',
    badge: 'Builder editing',
  },
  {
    title: 'Static SEO export',
    description: 'Fast static handoff for previews, audits, and situations where WordPress is not required.',
    badge: 'Preview ready',
  },
];

const workflowSteps = [
  {
    title: 'Analyze',
    text: 'Detect pages, forms, scripts, SEO metadata, repeated sections, and conversion risk.',
  },
  {
    title: 'Choose output',
    text: 'Select Gutenberg, Elementor, static, or bundled delivery without mixing source-of-truth lanes.',
  },
  {
    title: 'Convert',
    text: 'Generate WordPress themes, importer plugins, artifacts, reports, and native editing data.',
  },
  {
    title: 'Preview and QA',
    text: 'Compare screenshots, DOM signals, editability, routes, forms, and SEO checks before release.',
  },
  {
    title: 'Download or publish',
    text: 'Export files, provision a sandbox, or hand off a publish-ready WordPress package.',
  },
];

const projectRows = [
  ['Duty Cleaners', '18 pages', 'Elementor + Platinum', 'Review'],
  ['AI SaaS Landing', '6 pages', 'Platinum', 'Ready'],
  ['Local Services Template', '42 pages', 'Bundle', 'Queued'],
];

const qaCards = [
  ['Preview parity', '92%', 'Desktop, tablet, and mobile screenshot comparisons are queued per page.'],
  ['Editability score', '95%', 'Text, buttons, cards, FAQ items, and pricing sections are checked for native editing.'],
  ['SEO handoff', 'Ready', 'Routes, metadata, headings, schema hints, and internal links stay visible to WordPress.'],
];

const PortalCard: React.FC<React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>> = ({ className = '', children, ...props }) => (
  <div
    {...props}
    className={`rounded-[2rem] border border-slate-200/80 bg-white/85 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur ${className}`}
  >
    {children}
  </div>
);

const ClientPortal: React.FC<ClientPortalProps> = ({ onOpenOperatorTools, operatorToolsOpen }) => {
  const [selectedMode, setSelectedMode] = useState('Native Elementor');

  return (
    <section
      data-testid="client-portal-v1"
      className="relative overflow-hidden bg-[#f8f4ec] text-slate-950"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-200/70 blur-3xl" />
        <div className="absolute right-[-10rem] top-40 h-[34rem] w-[34rem] rounded-full bg-sky-200/70 blur-3xl" />
        <div className="absolute bottom-20 left-[-12rem] h-[28rem] w-[28rem] rounded-full bg-amber-200/60 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:42px_42px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 py-5 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between rounded-full border border-slate-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-sm font-black text-white shadow-lg">
              TC
            </div>
            <div>
              <p className="text-sm font-black tracking-tight">Theme Convert</p>
              <p className="hidden text-xs text-slate-500 sm:block">Whipify client portal</p>
            </div>
          </div>
          <div className="hidden items-center gap-6 text-sm font-bold text-slate-600 md:flex">
            <a href="#client-start" className="hover:text-slate-950">New Conversion</a>
            <a href="#client-projects" className="hover:text-slate-950">Projects</a>
            <a href="#client-qa" className="hover:text-slate-950">Reports</a>
            <a href="#client-downloads" className="hover:text-slate-950">Downloads</a>
          </div>
          <button
            type="button"
            onClick={onOpenOperatorTools}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm transition hover:border-slate-950"
          >
            {operatorToolsOpen ? 'Operator tools open' : 'Open operator tools'}
          </button>
        </nav>

        <div className="grid gap-8 pb-12 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-20 lg:pt-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-emerald-800">
              <Sparkles className="h-4 w-4" />
              Customer portal first
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.06em] text-slate-950 sm:text-6xl lg:text-7xl">
              Turn AI-built sites into editable WordPress.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
              Built for Lovable, Bolt, v0, static exports, React builds, and public URLs. Theme Convert explains the
              conversion in customer language: paste a site, choose WordPress or Elementor, preview the result, then
              download or publish a clean SEO-ready package.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-black text-white shadow-xl shadow-slate-950/20 transition hover:-translate-y-0.5"
              >
                Start new conversion
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-4 text-sm font-black text-slate-900 shadow-sm transition hover:border-slate-950"
              >
                View sample QA report
                <Eye className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              {['SEO-friendly pages', 'Native editing contracts', 'No lock-in HTML blobs'].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-3 text-sm font-bold text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <PortalCard className="p-4 sm:p-6">
            <div className="rounded-[1.5rem] bg-slate-950 p-4 text-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Live project</p>
                  <h2 className="mt-1 text-xl font-black">Duty Cleaners Website</h2>
                </div>
                <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-black text-slate-950">Ready</span>
              </div>
              <div className="grid gap-3 py-5 sm:grid-cols-3">
                {qaCards.map(([title, value, text]) => (
                  <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                    <p className="text-xs text-slate-400">{title}</p>
                    <p className="mt-2 text-2xl font-black">{value}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{text}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl bg-white p-4 text-slate-950">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black">Project Workspace</p>
                  <p className="text-xs font-bold text-slate-500">18 pages detected</p>
                </div>
                <div className="mt-4 space-y-3">
                  {['Home', 'Edmonton', 'Calgary pricing', 'Locations'].map((page, index) => (
                    <div key={page} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-xs font-black text-white">{index + 1}</div>
                        <div>
                          <p className="text-sm font-black">{page}</p>
                          <p className="text-xs text-slate-500">Preview, editability, SEO, links</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PortalCard>
        </div>

        <div id="client-start" className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <PortalCard className="p-6">
            <div className="flex items-center gap-3">
              <CloudUpload className="h-6 w-6 text-sky-700" />
              <h2 className="text-2xl font-black tracking-tight">Start New Conversion</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The customer does not need to know what React, build artifacts, or importers are. They choose how their
              site exists today, and the portal explains what Whipify can safely convert.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {intakeOptions.map(({ title, description, icon: Icon }) => (
                <button
                  key={title}
                  type="button"
                  className="group rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-950 hover:bg-white"
                >
                  <Icon className="h-6 w-6 text-slate-900" />
                  <p className="mt-4 font-black">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </button>
              ))}
            </div>
          </PortalCard>

          <PortalCard className="p-6">
            <div className="flex items-center gap-3">
              <Boxes className="h-6 w-6 text-emerald-700" />
              <h2 className="text-2xl font-black tracking-tight">Choose Output</h2>
            </div>
            <div className="mt-6 grid gap-3">
              {outputModes.map((mode) => {
                const selected = selectedMode === mode.title;
                return (
                  <button
                    key={mode.title}
                    type="button"
                    onClick={() => setSelectedMode(mode.title)}
                    className={`rounded-3xl border p-4 text-left transition ${
                      selected
                        ? 'border-slate-950 bg-slate-950 text-white shadow-xl shadow-slate-950/15'
                        : 'border-slate-200 bg-slate-50 text-slate-950 hover:border-slate-950'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black">{mode.title}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${selected ? 'bg-white text-slate-950' : 'bg-emerald-100 text-emerald-800'}`}>
                        {mode.badge}
                      </span>
                    </div>
                    <p className={`mt-2 text-sm leading-6 ${selected ? 'text-slate-300' : 'text-slate-600'}`}>{mode.description}</p>
                  </button>
                );
              })}
            </div>
          </PortalCard>
        </div>

        <PortalCard className="mt-6 p-6">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <div className="flex items-center gap-3">
                <LayoutDashboard className="h-6 w-6 text-amber-700" />
                <h2 className="text-2xl font-black tracking-tight">Conversion Workflow</h2>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Each customer sees an honest pipeline instead of backend jargon. The portal keeps confidence high by
                showing what has been analyzed, what is being generated, what still needs review, and what is ready.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-700">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Customer portal first. Operator console second.
            </span>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-5">
            {workflowSteps.map((step, index) => (
              <div
                key={step.title}
                data-testid={`client-workflow-${step.title.toLowerCase().replaceAll(' ', '-')}`}
                className="relative rounded-3xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-950 text-xs font-black text-white">{index + 1}</div>
                  <p className="font-black">{step.title}</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{step.text}</p>
              </div>
            ))}
          </div>
        </PortalCard>

        <PortalCard className="mt-6 overflow-hidden border-slate-950 bg-slate-950 p-0 text-white">
          <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.26),transparent_38%),linear-gradient(135deg,#020617,#0f172a)] p-6 sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-cyan-100">
                <ShieldCheck className="h-4 w-4" />
                New Admin Ops UI V2
              </div>
              <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
                A conversion operations cockpit is now inside operator tools.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                If you do not see the admin/backend changes, open operator tools. The new backend UI is not on the
                customer landing screen by default; it lives in the internal console where conversion teams manage runs,
                logs, visual QA, Elementor editability, support timelines, and backend providers.
              </p>
              <button
                type="button"
                onClick={onOpenOperatorTools}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/30"
              >
                Open operator tools
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 p-6 sm:grid-cols-2 sm:p-8">
              {[
                ['Command Center', 'Global search, quick actions, and operational focus metrics.'],
                ['Run Detail', 'Conversion timeline, run controls, status, artifacts, and warnings.'],
                ['Live Logs', 'Structured stage/severity logs with copy/share controls.'],
                ['Visual QA', 'Source screenshot, converted screenshot, diff heatmap, and issue labels.'],
                ['Editability', 'Elementor editability score, fallback count, and custom-widget actions.'],
                ['Support Timeline', 'Customer timeline, safe impersonation request, and support notes.'],
              ].map(([title, body]) => (
                <div key={title} className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                  <h3 className="font-black text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </PortalCard>

        <div id="client-projects" className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <PortalCard className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Projects</h2>
                <p className="mt-2 text-sm text-slate-600">A client-friendly workspace for conversions, previews, reports, and downloads.</p>
              </div>
              <SearchCheck className="h-8 w-8 text-sky-700" />
            </div>
            <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
              {projectRows.map(([name, pages, output, status]) => (
                <div key={name} className="grid gap-3 border-b border-slate-200 bg-white px-4 py-4 last:border-b-0 md:grid-cols-[1fr_0.5fr_0.7fr_0.4fr] md:items-center">
                  <p className="font-black">{name}</p>
                  <p className="text-sm text-slate-600">{pages}</p>
                  <p className="text-sm text-slate-600">{output}</p>
                  <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">{status}</span>
                </div>
              ))}
            </div>
          </PortalCard>

          <PortalCard id="client-qa" className="p-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-emerald-700" />
              <h2 className="text-2xl font-black tracking-tight">Report Snapshot</h2>
            </div>
            <div className="mt-6 space-y-3">
              {qaCards.map(([title, value, text]) => (
                <div key={title} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black">{title}</p>
                    <p className="text-lg font-black text-slate-950">{value}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </PortalCard>
        </div>

        <div id="client-downloads" className="grid gap-6 py-6 lg:grid-cols-3">
          {[
            ['Download packages', Download, 'WordPress theme ZIPs, importer plugins, static exports, and JSON reports.'],
            ['Sandbox previews', MousePointer2, 'Hosted WordPress preview links before the customer publishes anything.'],
            ['Secure handoff', LockKeyhole, 'Signed URLs, audit logs, tenant permissions, and provider readiness checks.'],
          ].map(([title, Icon, text]) => {
            const TypedIcon = Icon as typeof Download;
            return (
              <PortalCard key={title as string} className="p-6">
                <TypedIcon className="h-7 w-7 text-slate-950" />
                <h3 className="mt-5 text-xl font-black">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{text as string}</p>
              </PortalCard>
            );
          })}
        </div>

        <div className="pb-10">
          <PortalCard className="flex flex-col gap-5 bg-slate-950 p-6 text-white md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-300">
                <BadgeCheck className="h-5 w-5" />
                <p className="text-sm font-black uppercase tracking-[0.18em]">SaaS-ready frontend direction</p>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Admin Console V1 remains the internal operations surface. Theme Convert is the customer surface:
                clearer language, guided conversion, visual trust signals, and project-centered delivery.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenOperatorTools}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              Open operator tools
              <PlayCircle className="h-4 w-4" />
            </button>
          </PortalCard>
        </div>
      </div>
    </section>
  );
};

export default ClientPortal;
