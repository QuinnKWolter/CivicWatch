/**
 * Start Script - Launches both frontend and backend
 * 
 * This script spawns both the backend and frontend development servers
 * and forwards all output (including errors) to the main terminal.
 * 
 * Usage: node start.js
 * 
 * Press Ctrl+C to stop both servers.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for terminal output (ANSI codes)
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

// Check if directories exist
const backendDir = join(__dirname, 'backend');
const frontendDir = join(__dirname, 'frontend');

if (!existsSync(backendDir)) {
  log('ERROR: Backend directory not found!', 'red');
  process.exit(1);
}

if (!existsSync(frontendDir)) {
  log('ERROR: Frontend directory not found!', 'red');
  process.exit(1);
}

// Check if node_modules exist (basic check)
const backendNodeModules = join(backendDir, 'node_modules');
const frontendNodeModules = join(frontendDir, 'node_modules');

if (!existsSync(backendNodeModules)) {
  log('WARNING: Backend node_modules not found. Run "npm install" in backend/ first.', 'yellow');
}

if (!existsSync(frontendNodeModules)) {
  log('WARNING: Frontend node_modules not found. Run "npm install" in frontend/ first.', 'yellow');
}

log('Starting CivicWatch development servers...', 'cyan');
log('='.repeat(70), 'cyan');

// Determine which package manager to use (npm or other)
const packageManager = process.env.npm_execpath?.includes('yarn') ? 'yarn' : 'npm';

// Helper to prefix output lines
function prefixOutput(stream, prefix, prefixColor) {
  stream.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim()) {
        // Preserve original formatting but add prefix
        process.stdout.write(`${colors[prefixColor]}[${prefix}]${colors.reset} ${line}\n`);
      }
    });
  });
}

// Spawn backend process
log('Starting backend server...', 'blue');
const backend = spawn(packageManager, ['run', 'dev'], {
  cwd: backendDir,
  stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout and stderr
  shell: true // Required for Windows
});

prefixOutput(backend.stdout, 'BACKEND', 'blue');
prefixOutput(backend.stderr, 'BACKEND', 'red');

backend.on('error', (error) => {
  log(`Backend spawn error: ${error.message}`, 'red');
});

backend.on('exit', (code, signal) => {
  if (signal) {
    log(`Backend terminated by signal: ${signal}`, 'yellow');
  } else if (code !== 0 && code !== null) {
    log(`Backend exited with code: ${code}`, 'red');
  } else {
    log('Backend stopped', 'yellow');
  }
});

// Spawn frontend process
log('Starting frontend server...', 'magenta');
const frontend = spawn(packageManager, ['run', 'dev'], {
  cwd: frontendDir,
  stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout and stderr
  shell: true // Required for Windows
});

prefixOutput(frontend.stdout, 'FRONTEND', 'magenta');
prefixOutput(frontend.stderr, 'FRONTEND', 'red');

frontend.on('error', (error) => {
  log(`Frontend spawn error: ${error.message}`, 'red');
});

frontend.on('exit', (code, signal) => {
  if (signal) {
    log(`Frontend terminated by signal: ${signal}`, 'yellow');
  } else if (code !== 0 && code !== null) {
    log(`Frontend exited with code: ${code}`, 'red');
  } else {
    log('Frontend stopped', 'yellow');
  }
});

// Handle process termination
const cleanup = () => {
  log('\nShutting down servers...', 'yellow');
  
  if (backend && !backend.killed) {
    backend.kill('SIGTERM');
  }
  
  if (frontend && !frontend.killed) {
    frontend.kill('SIGTERM');
  }
  
  // Force kill after 3 seconds if still running
  setTimeout(() => {
    if (backend && !backend.killed) {
      backend.kill('SIGKILL');
    }
    if (frontend && !frontend.killed) {
      frontend.kill('SIGKILL');
    }
    process.exit(0);
  }, 3000);
};

process.on('SIGINT', cleanup);  // Ctrl+C
process.on('SIGTERM', cleanup);  // Termination signal

// Log startup info
setTimeout(() => {
  log('='.repeat(70), 'green');
  log('Both servers should be running now!', 'green');
  log('Backend: Check the port shown above (default: 8500)', 'green');
  log('Frontend: Check the port shown above (default: 5173)', 'green');
  log('Press Ctrl+C to stop both servers', 'yellow');
  log('='.repeat(70), 'green');
}, 2000);

// Keep the process alive
process.stdin.resume();
