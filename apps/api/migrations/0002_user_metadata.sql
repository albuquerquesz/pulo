-- Metadados do usuário (preferências e progresso), em JSON.
-- O D1 é SQLite: JSON fica em TEXT, validado por json_valid. No Postgres seria jsonb.
alter table "user" add column "metadata" text check ("metadata" is null or json_valid("metadata"));
