/** Resultado de casos de uso: erros esperados viram valor, sem exceção. */
export type Result<T, C extends string = string> =
  | { ok: true; value: T }
  | { ok: false; error: { code: C; message: string } };

export function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function fail<C extends string>(code: C, message: string): { ok: false; error: { code: C; message: string } } {
  return { ok: false, error: { code, message } };
}
