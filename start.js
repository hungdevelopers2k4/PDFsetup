import { spawnSync, spawn } from 'child_process';

async function main() {
  console.log('Running vite build...');
  const build = spawnSync('npm', ['run', 'build'], {
    stdio: 'inherit'
  });

  if (build.status !== 0) {
    console.error('Build failed, aborting.');
    process.exit(1);
  }

  console.log('Starting Electron...');
  const electronProc = spawn(
    'npx',
    ['electron', '.'],
    { stdio: 'inherit' }
  );

  electronProc.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
