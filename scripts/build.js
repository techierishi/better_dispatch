import { execSync } from 'child_process';
import { mkdirSync, copyFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

execSync('mkdir -p dist/background dist/content dist/icons dist/settings', { cwd: root });

execSync(
  'npx esbuild src/content/content.js --bundle --outfile=dist/content/content.js --format=iife',
  { cwd: root, stdio: 'inherit' }
);

copyFileSync(resolve(root, 'src/background/background.js'), resolve(dist, 'background/background.js'));
copyFileSync(resolve(root, 'src/content/content.css'), resolve(dist, 'content/content.css'));
copyFileSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));

const settingsFiles = ['settings.html', 'settings.js', 'settings.css'];
for (const f of settingsFiles) {
  copyFileSync(resolve(root, 'src/settings', f), resolve(dist, 'settings', f));
}

if (!existsSync(resolve(dist, 'icons/icon16.png'))) {
  execSync('node scripts/generate-icons.js', { cwd: root, stdio: 'inherit' });
}

for (const size of [16, 48, 128]) {
  copyFileSync(resolve(root, `icons/icon${size}.png`), resolve(dist, `icons/icon${size}.png`));
}

console.log('Build complete → dist/');
