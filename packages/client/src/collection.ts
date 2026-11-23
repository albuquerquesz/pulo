/** Uma coleção do cache: guarda cópias e devolve cópias, então quem chama nunca altera o cache sem querer. */
export class Collection<V> {
  private items = new Map<string, V>();

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
