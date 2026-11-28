/** Uma coleção do cache: guarda cópias e devolve cópias, então quem chama nunca altera o cache sem querer. */
export class Collection<V> {
  private items = new Map<string, V>();
  /** Chaves com escritas a caminho: o último valor que o servidor confirmou e quantas escritas faltam. */
  private pending = new Map<string, { confirmed: V | undefined; count: number }>();

  constructor(
    private readonly keyOf: (value: V) => string,
    private readonly clone: (value: V) => V,
  ) {}

  /** Troca tudo (vindo do servidor). */
  replaceAll(values: readonly V[]): void {
    this.items = new Map(values.map((value) => [this.keyOf(value), this.clone(value)]));
  }

  /** Guarda uma cópia e devolve a instância guardada (serve para comparar identidade no rollback). */
  put(value: V): V {
    const stored = this.clone(value);
    this.items.set(this.keyOf(value), stored);
    return stored;
  }

  /** Recoloca uma instância que já estava guardada antes (rollback). */
  restore(key: string, stored: V): void {
    this.items.set(key, stored);
  }

  /**
   * Aplica na hora uma escrita que ainda vai ao servidor (`null` apaga). Devolve quem a encerra: com `true`, ela passa a
   * ser o valor confirmado; com `false`, a chave volta ao último confirmado, se ninguém mexeu depois (devolve se voltou).
   */
  begin(key: string, next: V | null): (saved: boolean) => boolean {
    const entry = this.pending.get(key) ?? { confirmed: this.items.get(key), count: 0 };
    this.pending.set(key, entry);
    entry.count += 1;
    const mine = next === null ? undefined : this.put(next);
    if (next === null) this.items.delete(key);
    return (saved) => {
      entry.count -= 1;
      if (entry.count === 0) this.pending.delete(key);
      if (saved) {
        entry.confirmed = mine;
        return false;
      }
      if (this.items.get(key) !== mine) return false;
      if (entry.confirmed === undefined) this.items.delete(key);
      else this.items.set(key, entry.confirmed);
      return true;
    };
  }

  peek(key: string): V | undefined {
    return this.items.get(key);
  }

  remove(key: string): void {
    this.items.delete(key);
  }

  clear(): void {
    this.items.clear();
  }

  /** Cópias, na ordem em que o servidor mandou (e depois as escritas locais). */
  values(): V[] {
    return [...this.items.values()].map(this.clone);
  }

  /** Instâncias guardadas, sem copiar. Uso interno. */
  raw(): V[] {
    return [...this.items.values()];
  }
}
