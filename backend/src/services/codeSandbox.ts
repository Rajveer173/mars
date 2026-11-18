import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AppError } from '../utils/errors.js';

const LANGUAGES: Record<string, { image: string; file: string; command: string[] }> = {
  python: { image: 'python:3.12-alpine', file: 'solution.py', command: ['python', '-B', '/source/solution.py'] },
  javascript: { image: 'node:22-alpine', file: 'solution.js', command: ['node', '/source/solution.js'] },
  java: { image: 'eclipse-temurin:21-jdk-alpine', file: 'Main.java', command: ['java', '/source/Main.java'] },
};

export function sandboxArguments(language: string, directory: string, name: string, memoryMB: number) {
  const runtime = LANGUAGES[language];
  if (!runtime) throw new AppError(400, `Unsupported language: ${language}`);
  return ['run', '--rm', '--pull=never', '--name', name, '-i', '--network=none', '--read-only',
    '--cap-drop=ALL', '--security-opt=no-new-privileges', '--pids-limit=32', '--cpus=0.5',
    `--memory=${memoryMB}m`, `--memory-swap=${memoryMB}m`, '--user=65534:65534',
    '--tmpfs=/tmp:rw,noexec,nosuid,size=32m', '--workdir=/tmp',
    '--mount', `type=bind,source=${directory},target=/source,readonly`, runtime.image, ...runtime.command];
}

/** Submitted programs never execute in the API process or inherit its secrets. */
export async function runSandbox(language: string, code: string, input: string, timeoutMs: number, memoryMB: number) {
  const runtime = LANGUAGES[language];
  if (!runtime) throw new AppError(400, `Unsupported language: ${language}`);
  const directory = await mkdtemp(path.join(os.tmpdir(), 'examforge-sandbox-'));
  const name = `examforge-run-${randomUUID()}`;
  try {
    await writeFile(path.join(directory, runtime.file), code, { mode: 0o644 });
    return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn('docker', sandboxArguments(language, directory, name, memoryMB), { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let failure: Error | null = null;
      const stop = (error: Error) => { failure ??= error; child.kill(); };
      // Include a small, fixed allowance for starting the container itself.
      const timer = setTimeout(() => stop(new Error('Time limit exceeded')), timeoutMs + 1500);
      const append = (chunk: Buffer, stream: 'out' | 'err') => {
        if (stream === 'out') stdout += chunk.toString(); else stderr += chunk.toString();
        if (stdout.length + stderr.length > 64 * 1024) stop(new Error('Output limit exceeded'));
      };
      child.stdout.on('data', chunk => append(chunk, 'out'));
      child.stderr.on('data', chunk => append(chunk, 'err'));
      child.stdin.on('error', () => undefined);
      child.on('error', () => { clearTimeout(timer); reject(new AppError(503, 'The isolated code runner is unavailable.')); });
      child.on('close', exit => {
        clearTimeout(timer);
        if (failure) reject(failure);
        else if (exit === 125 || exit === 127) reject(new AppError(503, 'The code runner image is unavailable. Ask your administrator to configure the runner.'));
        else if (exit !== 0) reject(new Error(stderr.trim() || `Program exited with code ${exit}`));
        else resolve({ stdout, stderr });
      });
      child.stdin.end(input);
    });
  } finally {
    // Killing the docker client alone does not stop its container.
    await new Promise<void>(resolve => execFile('docker', ['rm', '-f', name], { windowsHide: true, timeout: 5000 }, () => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
}
