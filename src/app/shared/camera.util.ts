/**
 * "Enviar pelo celular": botão "Tirar foto" nos envios de arquivo.
 * Só aparece em telas de toque (celular/tablet), onde o input com `capture` abre a câmera.
 */
export function temCameraTouch(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/** Dá um nome legível à foto da câmera (o iPhone manda tudo como "image.jpg"): foto-20261005-143012.jpg */
export function nomearFoto(f: File): File {
  const ext = f.type === 'image/png' ? 'png' : f.type === 'image/jpeg' || f.type === 'image/jpg' ? 'jpg' : null;
  if (!ext) return f; // outro formato: mantém o nome original (a validação do envio decide)
  const d = new Date(f.lastModified || Date.now());
  const p = (n: number) => String(n).padStart(2, '0');
  const nome = `foto-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
  return new File([f], nome, { type: f.type, lastModified: f.lastModified });
}

/** Primeira imagem escolhida no input da câmera (e limpa o input para permitir nova foto). */
export function fotoDoInput(e: Event): File | null {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0] ?? null;
  input.value = '';
  return f ? nomearFoto(f) : null;
}
