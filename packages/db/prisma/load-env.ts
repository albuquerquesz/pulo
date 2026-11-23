import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * O Prisma 7 não carrega .env sozinho. Lê o .env da raiz do repositório, se existir,
 * sem sobrescrever variáveis que já vieram do ambiente (como no CI).
 */
export function loadRootEnv(): void {
  const file = fileURLToPath(new URL('../../../.env', import.meta.url));
  if (existsSync(file)) process.loadEnvFile(file);
}
