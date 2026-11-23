-- Restrições que o Prisma não expressa no schema: CHECKs de domínio e o índice único parcial.
-- Os limites vêm de packages/core/config/decisions.ts (BLOCK_MIN_MINUTES, BLOCK_MAX_MINUTES, ENERGY_MIN, ENERGY_MAX).

-- Bloco da rotina: dia 0 a 6, início dentro do dia e duração de 5 a 120 minutos.
ALTER TABLE "routine_block"
  ADD CONSTRAINT "routine_block_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6),
  ADD CONSTRAINT "routine_block_start_check" CHECK ("startMinutes" BETWEEN 0 AND 1439),
  ADD CONSTRAINT "routine_block_duration_check" CHECK ("durationMinutes" BETWEEN 5 AND 120);

-- Hábito: todos os dias da semana válidos.
ALTER TABLE "habit"
  ADD CONSTRAINT "habit_weekdays_check" CHECK ("weekdays" <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]);

-- Sessão de foco: tempos coerentes e fim preenchido só quando a sessão acabou.
ALTER TABLE "focus_session"
  ADD CONSTRAINT "focus_session_planned_check" CHECK ("plannedMinutes" > 0),
  ADD CONSTRAINT "focus_session_paused_check" CHECK ("pausedMs" >= 0),
  ADD CONSTRAINT "focus_session_end_check" CHECK (("state" = 'em_andamento') = ("endedAt" IS NULL));

-- Uma única sessão em andamento por pessoa.
CREATE UNIQUE INDEX "focus_session_one_active_per_user"
  ON "focus_session" ("userId")
  WHERE "state" = 'em_andamento';

-- Check in: energia de 1 a 5.
ALTER TABLE "check_in"
  ADD CONSTRAINT "check_in_energy_check" CHECK ("energy" BETWEEN 1 AND 5);

-- Sapo: fase de 1 a 4 e dias de cuidado não negativos.
ALTER TABLE "mascot_state"
  ADD CONSTRAINT "mascot_state_phase_check" CHECK ("phase" BETWEEN 1 AND 4),
  ADD CONSTRAINT "mascot_state_care_days_check" CHECK ("careDays" >= 0);
