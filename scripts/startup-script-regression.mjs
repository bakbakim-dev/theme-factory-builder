import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const batPath = path.join(root, 'start-theme-factory-ai-golden.bat');
const source = await readFile(batPath, 'utf8');

assert.match(source, /VITE_BUILD_SERVER_URL=http:\/\/localhost:%BUILDER_PORT%\/build/);
assert.match(source, /%ENV_FILE%/);
assert.match(source, /SetEnvironmentVariable\('PORT','%BUILDER_PORT%','Process'\)/);
assert.match(source, /set "UI_PORT=3001"/);
assert.match(source, /set "UI_URL=http:\/\/localhost:%UI_PORT%"/);
assert.match(source, /--port','%UI_PORT%'/);
assert.match(source, /start "" "%UI_URL%"/);

console.log('startup script regression passed');
