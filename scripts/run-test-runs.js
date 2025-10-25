// Runner to execute TypeScript test under ts-node when direct ts-node import fails
// It registers ts-node and then requires the TS test file.
try {
  require('ts-node').register({ transpileOnly: true });
} catch (e) {
  console.error('ts-node not available. Install dev dependency ts-node.');
  process.exit(1);
}

require('./test-runs.ts');
