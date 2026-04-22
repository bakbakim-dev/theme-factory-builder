import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const dashboardPath = path.resolve(process.cwd(), 'components', 'Dashboard.tsx');
const dashboardSource = await readFile(dashboardPath, 'utf8');

const assertions = [
  {
    ok: dashboardSource.includes('/build/init'),
    message: 'Expected Dashboard.tsx to initialize remote builds via /build/init.',
  },
  {
    ok: /\/build\/\$\{[^}]+\}\/upload/.test(dashboardSource) || dashboardSource.includes('/upload'),
    message: 'Expected Dashboard.tsx to upload ZIPs via /build/${jobId}/upload or equivalent.',
  },
  {
    ok: !dashboardSource.includes('Remote build request timed out before the server acknowledged the job'),
    message: 'Expected the old remote build timeout message to be removed.',
  },
];

const failures = assertions.filter((assertion) => !assertion.ok);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL: ${failure.message}`);
  }
  process.exit(1);
}

console.log('PASS: remote build handshake regression checks passed.');
