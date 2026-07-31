const { spawn } = require('child_process');
const path = require('path');

const CWD = __dirname;
const VITE_PORT = 3000;
const API_PORT = 3002;
const LOCAL_API_SCRIPT = path.join(__dirname, 'local_api.cjs');

console.log('Starting Local Casino...');

// Start Vite
console.log('Starting Frontend (Vite)...');
// npm.cmd needs shell: true usually
const vite = spawn('npm.cmd', ['run', 'dev', '--', '--port', String(VITE_PORT)], {
    stdio: 'inherit',
    shell: true,
    cwd: CWD
});

// Start Local API
console.log('Starting Local API...');
// Use shell: false to avoid quoting issues with spaces in path
const api = spawn('node', [LOCAL_API_SCRIPT], {
    stdio: 'inherit',
    shell: false,
    cwd: CWD
});

console.log(`\nCasino is running at: http://localhost:${VITE_PORT}`);
console.log(`Local API is running at: http://localhost:${API_PORT}`);

// Keep alive
setInterval(() => {}, 1000);
