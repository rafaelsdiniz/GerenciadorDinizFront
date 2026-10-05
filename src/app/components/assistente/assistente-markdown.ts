/**
 * Markdown mínimo e seguro das respostas do assistente (usado pelo widget flutuante e pela página /assistente).
 * Escapa todo o HTML e só então aplica: **negrito**, quebras de linha, listas "- " e "1. ", títulos "#" viram parágrafo.
 */
export function renderizarMarkdownLeve(texto: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const linhas = (texto ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let lista: 'ul' | 'ol' | null = null;
  let paragrafo: string[] = [];
  const fecharParagrafo = () => { if (paragrafo.length) { out.push(`<p>${paragrafo.join('<br>')}</p>`); paragrafo = []; } };
  const fecharLista = () => { if (lista) { out.push(`</${lista}>`); lista = null; } };
  for (const bruta of linhas) {
    const l = bruta.trim();
    const ul = /^[-*•]\s+(.*)$/.exec(l);
    const ol = /^\d+[.)]\s+(.*)$/.exec(l);
    if (ul || ol) {
      fecharParagrafo();
      const tipo = ul ? 'ul' : 'ol';
      if (lista !== tipo) { fecharLista(); out.push(`<${tipo}>`); lista = tipo; }
      out.push(`<li>${inline((ul ?? ol)![1])}</li>`);
    } else if (!l) {
      fecharParagrafo(); fecharLista();
    } else {
      fecharLista();
      paragrafo.push(inline(l.replace(/^#{1,6}\s+/, '')));
    }
  }
  fecharParagrafo(); fecharLista();
  return out.join('');
}

/** Texto puro da resposta (para copiar): remove os marcadores de negrito. */
export function textoPlanoResposta(texto: string): string {
  return (texto ?? '').replace(/\*\*(.+?)\*\*/g, '$1').trim();
}
