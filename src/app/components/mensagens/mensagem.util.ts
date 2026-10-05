/** Converte "2026-10-05T14:20:00" (hora local do servidor) em Date. */
export function paraData(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "agora", "há 5 min", "há 3 h", "ontem às 14:20", "12/09 às 09:15", "12/09/2025". */
export function tempoRelativo(iso: string | null | undefined, agora = new Date()): string {
  const d = paraData(iso);
  if (!d) return '';
  const seg = Math.round((agora.getTime() - d.getTime()) / 1000);
  if (seg < 45) return 'agora';
  const min = Math.round(seg / 60);
  if (min < 60) return `há ${min} min`;
  const hora = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  if (d.getTime() >= inicioHoje) return `há ${Math.round(min / 60)} h`;
  if (d.getTime() >= inicioHoje - 86400000) return `ontem às ${hora}`;
  if (d.getFullYear() === agora.getFullYear()) return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${hora}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Data e hora completas para o title (tooltip). */
export function dataHoraCompleta(iso: string | null | undefined): string {
  const d = paraData(iso);
  if (!d) return '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Rótulo do dia para separar a conversa: "Hoje", "Ontem" ou "12/09/2026". */
export function rotuloDia(iso: string | null | undefined, agora = new Date()): string {
  const d = paraData(iso);
  if (!d) return '';
  const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  if (dia === hoje) return 'Hoje';
  if (dia === hoje - 86400000) return 'Ontem';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
