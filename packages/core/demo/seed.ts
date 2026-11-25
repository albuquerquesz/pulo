import { DEFAULT_DAY_START_HOUR } from '../config/decisions';
import { providesFreezeStore } from '../domain/gelo-store';
import type { Clock, Repository } from '../domain/types';
import { countCareDays, phaseForCareDays } from './careDays';
import { DEMO_DEFAULT_SEED, DEMO_FIRST_MONDAY, generateDemoData } from './generate';
import { localToMs } from './time';

/**
 * Carrega o demo no repositório. Apaga os dados atuais antes (o demo substitui o uso real)
 * e grava um MascotState coerente com os dados sintéticos.
 */
export async function seedRepository(
  repo: Repository,
  clock: Clock,
  seed: number = DEMO_DEFAULT_SEED,
): Promise<void> {
  const now = clock.now();
  // A conta de exemplo nasce com os dados, para as métricas terem história.
  const d = generateDemoData(seed, localToMs(DEMO_FIRST_MONDAY, DEFAULT_DAY_START_HOUR * 60));
  await repo.clearAll();
  await repo.saveUser(d.user);
  for (const b of d.blocks) await repo.saveBlock(b);
  for (const h of d.habits) await repo.saveHabit(h);
  for (const l of d.habitLogs) await repo.saveHabitLog(l);
  for (const s of d.sessions) await repo.saveSession(s);
  for (const r of d.restDays) await repo.saveRestDay(r);
  if (providesFreezeStore(repo)) await repo.saveFreezeUses(d.freezeUses);
  const careDays = countCareDays(d.sessions, d.restDays);
  await repo.saveMascotState({ phase: phaseForCareDays(careDays), careDays, updatedAt: now });
}

/** "Limpar" do painel demo. */
export async function clearDemo(repo: Repository): Promise<void> {
  await repo.clearAll();
}
