export function horaTexto(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

export function blocoTexto(inicio: number, duracao: number): string {
  return `${horaTexto(inicio)} a ${horaTexto(inicio + duracao)}`;
}
