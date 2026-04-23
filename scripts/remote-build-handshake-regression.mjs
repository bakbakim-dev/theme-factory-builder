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
    ok: /\/build\/\$\{[^}]+\}\/upload/.test(dashboardSource),
    message: 'Expected Dashboard.tsx to upload ZIPs via /build/${jobId}/upload or equivalent.',
  },
  {
    ok: /new\s+FormData\s*\(/.test(dashboardSource),
    message: 'Expected Dashboard.tsx to create FormData for the remote ZIP upload.',
  },
  {
    ok: dashboardSource.includes('Remote build init request timed out.'),
    message: 'Expected Dashboard.tsx to include the remote build init timeout message.',
  },
  {
    ok: dashboardSource.includes('Remote build upload timed out before the ZIP finished uploading.'),
    message: 'Expected Dashboard.tsx to include the remote build upload timeout message.',
  },
  {
    ok: /\.append\(\s*['"]zip['"]\s*,/.test(dashboardSource),
    message: 'Expected Dashboard.tsx to append the ZIP blob to FormData with the "zip" field.',
  },
  {
    ok: !/['"]Content-Type['"]\s*:\s*['"]application\/zip['"]/.test(dashboardSource),
    message: 'Expected Dashboard.tsx to stop sending the remote ZIP upload as raw application/zip.',
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
