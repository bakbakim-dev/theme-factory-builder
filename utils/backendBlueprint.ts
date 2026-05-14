export interface BackendProviderStatus {
  id: string;
  provider: string;
  role: string;
  status: 'ready' | 'missing' | 'pending';
  notes: string;
}

export interface BackendBlueprintReadinessInput {
  WHIPIFY_DATABASE_URL?: string;
  WHIPIFY_AUTH_SECRET?: string;
  WHIPIFY_R2_BUCKET?: string;
  WHIPIFY_TRIGGER_PROJECT_ID?: string;
  WHIPIFY_STRIPE_SECRET_KEY?: string;
  WHIPIFY_TEMPORAL_NAMESPACE?: string;
  WHIPIFY_SANDBOX_PROVIDER?: string;
}

export const WHIPIFY_RECOMMENDED_BACKEND_STACK = {
  database: {
    provider: 'Neon Postgres',
    role: 'Tenant-scoped source of truth for projects, jobs, artifacts, billing, audit logs, and preview metadata.',
  },
  auth: {
    provider: 'Better Auth',
    role: 'Organization, team, invitation, and role management for the SaaS control plane.',
  },
  storage: {
    provider: 'Cloudflare R2',
    role: 'Generated ZIPs, screenshots, reports, media, and signed artifact delivery.',
  },
  jobs: {
    provider: 'Trigger.dev',
    role: 'Durable conversion jobs, retries, long-running workers, and runtime logs.',
  },
  billing: {
    provider: 'Stripe Billing',
    role: 'Subscriptions, customer portal, invoices, credits, and usage gating.',
  },
  workflowUpgrade: {
    provider: 'Temporal Cloud',
    role: 'Future upgrade path for multi-step conversions that need durable resumability across hours or days.',
  },
  sandbox: {
    provider: 'Hosted WordPress sandboxes',
    role: 'Per-project preview installs for live converter QA and customer review.',
  },
  observability: {
    provider: 'Sentry',
    role: 'Frontend/backend error tracking, release health, and conversion failure diagnosis.',
  },
} as const;

export const WHIPIFY_PRODUCTION_BACKEND_SQL = `
create table if not exists tenants (
  id text primary key,
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null,
  password_hash text not null,
  password_salt text not null,
  password_iterations integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create table if not exists projects (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  name text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversion_jobs (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  project_id text not null references projects(id) on delete cascade,
  status text not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists artifacts (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  project_id text not null references projects(id) on delete cascade,
  job_id text references conversion_jobs(id) on delete set null,
  kind text not null,
  file_name text not null,
  sha256 text not null,
  storage_key text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  user_id text,
  action text not null,
  scope text not null,
  target_id text,
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id text primary key,
  tenant_id text not null unique references tenants(id) on delete cascade,
  plan text not null,
  status text not null,
  current_period_end timestamptz not null,
  provider text not null,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists queue_items (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  project_id text not null references projects(id) on delete cascade,
  selected_lanes text not null,
  status text not null,
  attempts integer not null default 0,
  error text,
  result_job_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sandbox_previews (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  project_id text not null references projects(id) on delete cascade,
  job_id text references conversion_jobs(id) on delete set null,
  status text not null,
  preview_url text not null,
  provider text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
`.trim();

export const createBackendProviderReadiness = (input: BackendBlueprintReadinessInput) => {
  const providers: BackendProviderStatus[] = [
    {
      id: 'database',
      provider: WHIPIFY_RECOMMENDED_BACKEND_STACK.database.provider,
      role: WHIPIFY_RECOMMENDED_BACKEND_STACK.database.role,
      status: input.WHIPIFY_DATABASE_URL ? 'ready' : 'missing',
      notes: input.WHIPIFY_DATABASE_URL ? 'Postgres connection string detected.' : 'Managed Postgres connection is still a provider seam.',
    },
    {
      id: 'auth',
      provider: WHIPIFY_RECOMMENDED_BACKEND_STACK.auth.provider,
      role: WHIPIFY_RECOMMENDED_BACKEND_STACK.auth.role,
      status: input.WHIPIFY_AUTH_SECRET ? 'ready' : 'missing',
      notes: input.WHIPIFY_AUTH_SECRET ? 'Auth secret detected.' : 'Organization auth and RBAC still need provider wiring.',
    },
    {
      id: 'storage',
      provider: WHIPIFY_RECOMMENDED_BACKEND_STACK.storage.provider,
      role: WHIPIFY_RECOMMENDED_BACKEND_STACK.storage.role,
      status: input.WHIPIFY_R2_BUCKET ? 'ready' : 'missing',
      notes: input.WHIPIFY_R2_BUCKET ? 'Object storage target configured.' : 'Artifact and screenshot storage provider is pending.',
    },
    {
      id: 'jobs',
      provider: WHIPIFY_RECOMMENDED_BACKEND_STACK.jobs.provider,
      role: WHIPIFY_RECOMMENDED_BACKEND_STACK.jobs.role,
      status: input.WHIPIFY_TRIGGER_PROJECT_ID ? 'ready' : 'missing',
      notes: input.WHIPIFY_TRIGGER_PROJECT_ID ? 'Background job provider detected.' : 'Durable jobs provider is not configured.',
    },
    {
      id: 'billing',
      provider: WHIPIFY_RECOMMENDED_BACKEND_STACK.billing.provider,
      role: WHIPIFY_RECOMMENDED_BACKEND_STACK.billing.role,
      status: input.WHIPIFY_STRIPE_SECRET_KEY ? 'ready' : 'missing',
      notes: input.WHIPIFY_STRIPE_SECRET_KEY ? 'Stripe secret detected.' : 'Billing/customer portal provider is pending.',
    },
    {
      id: 'workflow-upgrade',
      provider: WHIPIFY_RECOMMENDED_BACKEND_STACK.workflowUpgrade.provider,
      role: WHIPIFY_RECOMMENDED_BACKEND_STACK.workflowUpgrade.role,
      status: input.WHIPIFY_TEMPORAL_NAMESPACE ? 'ready' : 'pending',
      notes: input.WHIPIFY_TEMPORAL_NAMESPACE ? 'Temporal namespace detected.' : 'Temporal is recommended for the next workflow maturity step.',
    },
    {
      id: 'sandbox',
      provider: WHIPIFY_RECOMMENDED_BACKEND_STACK.sandbox.provider,
      role: WHIPIFY_RECOMMENDED_BACKEND_STACK.sandbox.role,
      status: input.WHIPIFY_SANDBOX_PROVIDER ? 'ready' : 'pending',
      notes: input.WHIPIFY_SANDBOX_PROVIDER ? 'Sandbox provider detected.' : 'Hosted WordPress sandboxes remain a provider seam.',
    },
  ];

  const readyCount = providers.filter((provider) => provider.status === 'ready').length;
  const missingCount = providers.filter((provider) => provider.status === 'missing').length;
  const pendingCount = providers.filter((provider) => provider.status === 'pending').length;

  return {
    providers,
    readyCount,
    missingCount,
    pendingCount,
    upgradePath: 'Neon Postgres + Better Auth + Cloudflare R2 + Trigger.dev + Stripe Billing + Temporal Cloud',
  };
};
