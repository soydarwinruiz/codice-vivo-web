// Desarrollo: arranca Vite (recarga en caliente) y abre Electron apuntando a él.
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import electron from 'electron';

const server = await createServer({ mode: 'desktop', server: { port: 5174 } });
await server.listen();
const url = server.resolvedUrls.local[0];
const child = spawn(electron, ['.'], { stdio: 'inherit', env: { ...process.env, CODICE_DEV_URL: url } });
child.on('exit', async (code) => { await server.close(); process.exit(code ?? 0); });
