import { Injectable, NgZone, OnDestroy } from '@angular/core';

/**
 * Substitui os pop-ups nativos do navegador (lista do <select> e calendário do
 * <input type="date">) por versões no padrão visual do sistema, sem alterar os
 * templates: os elementos nativos continuam existindo e recebendo o valor, então
 * ngModel / formControl seguem funcionando.
 *
 * Aplica-se a `select.select` e `input.input[type=date]`. Para manter o nativo
 * num campo específico, adicione o atributo `data-nativo`. Em telas de toque o
 * nativo é mantido (é melhor no celular).
 */
@Injectable({ providedIn: 'root' })
export class CamposAprimoradosService implements OnDestroy {

  private painel: HTMLElement | null = null;
  private alvo: HTMLSelectElement | HTMLInputElement | null = null;
  private ativo = false;
  private mesVisivel = new Date();
  private indiceFoco = -1;

  private readonly MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
    'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  private readonly DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  /** Nome dos estados: selects de UF mostram e buscam pelo nome, não só pela sigla. */
  private readonly UFS: Record<string, string> = {
    AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
    ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
    MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
    RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
    SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins'
  };

  constructor(private zone: NgZone) {}

  iniciar(): void {
    if (this.ativo || typeof window === 'undefined') return;
    if (window.matchMedia?.('(pointer: coarse)').matches) return;
    this.ativo = true;
    this.zone.runOutsideAngular(() => {
      document.addEventListener('mousedown', this.onMouseDown, true);
      document.addEventListener('keydown', this.onKeyDown, true);
      window.addEventListener('resize', this.fechar);
      document.addEventListener('scroll', this.onScroll, true);
    });
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousedown', this.onMouseDown, true);
    document.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('resize', this.fechar);
    document.removeEventListener('scroll', this.onScroll, true);
    this.fechar();
  }

  // ------------------------------------------------------------------ eventos

  private elegivel(el: Element | null): HTMLSelectElement | HTMLInputElement | null {
    if (!el) return null;
    const campo = el.closest('select.select, input.input[type="date"]') as HTMLSelectElement | HTMLInputElement | null;
    if (!campo || campo.disabled || campo.hasAttribute('data-nativo')) return null;
    if (campo instanceof HTMLSelectElement && (campo.multiple || campo.size > 1)) return null;
    if (campo instanceof HTMLInputElement && campo.readOnly) return null;
    return campo;
  }

  private onMouseDown = (ev: MouseEvent) => {
    const alvo = ev.target as HTMLElement;
    if (this.painel && this.painel.contains(alvo)) return;

    const campo = this.elegivel(alvo);
    if (campo instanceof HTMLSelectElement) {
      ev.preventDefault();
      campo.focus();
      if (this.alvo === campo) { this.fechar(); return; }
      this.abrirSelect(campo);
      return;
    }
    if (campo instanceof HTMLInputElement) {
      // deixa o clique posicionar o cursor nos segmentos dd/mm/aaaa e abre o calendário próprio
      if (this.alvo !== campo) setTimeout(() => this.abrirData(campo));
      return;
    }
    this.fechar();
  };

  private onScroll = (ev: Event) => {
    if (this.painel && ev.target instanceof Node && this.painel.contains(ev.target)) return;
    this.fechar();
  };

  private onKeyDown = (ev: KeyboardEvent) => {
    const foco = document.activeElement as HTMLElement | null;

    // calendário nativo pelo teclado (Alt+↓ / F4) → o nosso
    const campo = this.elegivel(foco);
    if (!this.painel && campo) {
      const abre = ev.key === 'F4' || (ev.altKey && ev.key === 'ArrowDown')
        || (campo instanceof HTMLSelectElement && (ev.key === 'Enter' || ev.key === ' '));
      if (abre) {
        ev.preventDefault();
        campo instanceof HTMLSelectElement ? this.abrirSelect(campo) : this.abrirData(campo);
      }
      return;
    }
    if (!this.painel || !this.alvo) return;

    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      const a = this.alvo;
      this.fechar();
      a.focus();
      return;
    }
    if (ev.key === 'Tab') { this.fechar(); return; }

    if (this.alvo instanceof HTMLSelectElement) {
      const itens = this.itensVisiveis();
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (!itens.length) return;
        const delta = ev.key === 'ArrowDown' ? 1 : -1;
        this.indiceFoco = (this.indiceFoco + delta + itens.length) % itens.length;
        this.destacar(itens);
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        const item = itens[this.indiceFoco];
        if (item) this.escolherOpcao(Number(item.dataset['indice']));
      } else if (foco?.classList.contains('cp-busca')) {
        // digitando na busca: deixa o input tratar
      } else if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey) {
        const busca = this.painel.querySelector<HTMLInputElement>('.cp-busca');
        if (busca) { busca.focus(); }
        else {
          // salto por letra inicial
          const letra = ev.key.toLowerCase();
          const i = itens.findIndex(it => (it.textContent ?? '').trim().toLowerCase().startsWith(letra));
          if (i >= 0) { this.indiceFoco = i; this.destacar(itens); }
        }
      }
    } else if (ev.key === 'Enter' && this.painel) {
      this.fechar();
    }
  };

  readonly fechar = () => {
    this.painel?.remove();
    this.painel = null;
    this.alvo?.classList.remove('cp-aberto');
    this.alvo = null;
    this.indiceFoco = -1;
  };

  // ------------------------------------------------------------------ select

  private abrirSelect(sel: HTMLSelectElement): void {
    this.fechar();
    this.alvo = sel;
    sel.classList.add('cp-aberto');

    const painel = document.createElement('div');
    painel.className = 'menu cp-painel cp-select';
    painel.setAttribute('role', 'listbox');

    const opcoes = Array.from(sel.options);
    if (opcoes.length > 8) {
      const busca = document.createElement('input');
      busca.className = 'input input-sm cp-busca';
      busca.placeholder = 'Buscar…';
      busca.setAttribute('aria-label', 'Buscar opção');
      busca.addEventListener('input', () => this.filtrar(busca.value));
      painel.appendChild(busca);
    }

    const lista = document.createElement('div');
    lista.className = 'cp-lista';
    opcoes.forEach((op, i) => {
      if (op.hidden) return;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'menu-item cp-opcao';
      item.dataset['indice'] = String(i);
      item.setAttribute('role', 'option');
      item.disabled = op.disabled;
      const vazio = op.value === '' || /^\d+:\s*(null|undefined)$/.test(op.value);
      if (vazio) item.classList.add('cp-placeholder');
      if (i === sel.selectedIndex) { item.classList.add('cp-selecionado'); item.setAttribute('aria-selected', 'true'); }
      const txt = document.createElement('span');
      txt.className = 'cp-texto';
      txt.textContent = op.text;
      item.appendChild(txt);
      const uf = this.UFS[op.text.trim()];
      item.dataset['busca'] = this.normalizar(op.text + ' ' + (uf ?? ''));
      if (uf) {
        const nome = document.createElement('span');
        nome.className = 'cp-dica';
        nome.textContent = uf;
        txt.appendChild(nome);
      }
      if (i === sel.selectedIndex) {
        item.insertAdjacentHTML('beforeend',
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>');
      }
      item.addEventListener('mousedown', e => e.preventDefault());
      item.addEventListener('click', () => this.escolherOpcao(i));
      lista.appendChild(item);
    });
    const vazio = document.createElement('div');
    vazio.className = 'cp-vazio';
    vazio.textContent = 'Nenhuma opção encontrada';
    lista.appendChild(vazio);
    painel.appendChild(lista);

    document.body.appendChild(painel);
    this.painel = painel;
    this.posicionar(sel, painel, Math.max(sel.getBoundingClientRect().width, 180));

    const itens = this.itensVisiveis();
    this.indiceFoco = Math.max(0, itens.findIndex(i => i.classList.contains('cp-selecionado')));
    this.destacar(itens, true);
    painel.querySelector<HTMLInputElement>('.cp-busca')?.focus();
  }

  private itensVisiveis(): HTMLButtonElement[] {
    if (!this.painel) return [];
    return Array.from(this.painel.querySelectorAll<HTMLButtonElement>('.cp-opcao'))
      .filter(b => !b.disabled && b.style.display !== 'none');
  }

  private destacar(itens: HTMLButtonElement[], centralizar = false): void {
    itens.forEach((it, i) => it.classList.toggle('cp-foco', i === this.indiceFoco));
    itens[this.indiceFoco]?.scrollIntoView({ block: centralizar ? 'center' : 'nearest' });
  }

  private filtrar(termo: string): void {
    if (!this.painel) return;
    const t = this.normalizar(termo);
    let visiveis = 0;
    this.painel.querySelectorAll<HTMLElement>('.cp-opcao').forEach(el => {
      const ok = !t || (el.dataset['busca'] ?? this.normalizar(el.textContent ?? '')).includes(t);
      el.style.display = ok ? '' : 'none';
      if (ok) visiveis++;
    });
    this.painel.classList.toggle('cp-sem-resultado', visiveis === 0);
    this.indiceFoco = 0;
    this.destacar(this.itensVisiveis());
  }

  private escolherOpcao(indice: number): void {
    const sel = this.alvo;
    if (!(sel instanceof HTMLSelectElement)) return;
    const mudou = sel.selectedIndex !== indice;
    sel.selectedIndex = indice;
    this.fechar();
    sel.focus();
    if (mudou) {
      this.zone.run(() => {
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
  }

  // ------------------------------------------------------------------ data

  private abrirData(inp: HTMLInputElement): void {
    if (this.alvo === inp && this.painel) return;
    this.fechar();
    this.alvo = inp;
    inp.classList.add('cp-aberto');
    const atual = this.parseISO(inp.value);
    this.mesVisivel = atual ? new Date(atual.getFullYear(), atual.getMonth(), 1) : this.inicioMes(new Date());

    const painel = document.createElement('div');
    painel.className = 'menu cp-painel cp-data';
    painel.addEventListener('mousedown', e => {
      // mantém o foco no input enquanto navega no calendário
      if (!(e.target as HTMLElement).closest('input')) e.preventDefault();
    });
    document.body.appendChild(painel);
    this.painel = painel;
    this.renderCalendario();
    this.posicionar(inp, painel, 292);
  }

  private renderCalendario(): void {
    const inp = this.alvo;
    if (!(inp instanceof HTMLInputElement) || !this.painel) return;
    const sel = this.parseISO(inp.value);
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const min = this.parseISO(inp.min);
    const max = this.parseISO(inp.max);
    const ano = this.mesVisivel.getFullYear();
    const mes = this.mesVisivel.getMonth();

    const p = this.painel;
    p.innerHTML = '';

    const cab = document.createElement('div');
    cab.className = 'cp-cab';
    cab.innerHTML = `<button type="button" class="btn-icon sm" data-nav="-1" aria-label="Mês anterior">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
      <strong class="cp-titulo">${this.MESES[mes]} ${ano}</strong>
      <button type="button" class="btn-icon sm" data-nav="1" aria-label="Próximo mês">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>`;
    cab.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach(b =>
      b.addEventListener('click', () => {
        this.mesVisivel = new Date(ano, mes + Number(b.dataset['nav']), 1);
        this.renderCalendario();
      }));
    p.appendChild(cab);

    const grade = document.createElement('div');
    grade.className = 'cp-grade';
    this.DIAS.forEach(d => {
      const s = document.createElement('span');
      s.className = 'cp-dow';
      s.textContent = d;
      grade.appendChild(s);
    });
    const inicio = new Date(ano, mes, 1 - new Date(ano, mes, 1).getDay());
    for (let i = 0; i < 42; i++) {
      const dia = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cp-dia';
      b.textContent = String(dia.getDate());
      if (dia.getMonth() !== mes) b.classList.add('cp-fora');
      if (dia.getTime() === hoje.getTime()) b.classList.add('cp-hoje');
      if (sel && dia.getTime() === sel.getTime()) b.classList.add('cp-sel');
      if ((min && dia < min) || (max && dia > max)) b.disabled = true;
      b.setAttribute('aria-label', dia.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }));
      b.addEventListener('click', () => this.escolherData(dia));
      grade.appendChild(b);
    }
    p.appendChild(grade);

    const rod = document.createElement('div');
    rod.className = 'cp-rodape';
    rod.innerHTML = `<button type="button" class="link text-sm" data-acao="limpar">Limpar</button>
      <button type="button" class="link text-sm" data-acao="hoje">Hoje</button>`;
    rod.querySelector('[data-acao="limpar"]')!.addEventListener('click', () => this.escolherData(null));
    rod.querySelector('[data-acao="hoje"]')!.addEventListener('click', () => this.escolherData(hoje));
    p.appendChild(rod);
  }

  private escolherData(d: Date | null): void {
    const inp = this.alvo;
    if (!(inp instanceof HTMLInputElement)) return;
    inp.value = d ? this.toISO(d) : '';
    this.fechar();
    inp.focus();
    this.zone.run(() => {
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  // ------------------------------------------------------------------ util

  private posicionar(ancora: HTMLElement, painel: HTMLElement, largura: number): void {
    const r = ancora.getBoundingClientRect();
    painel.style.position = 'fixed';
    painel.style.minWidth = largura + 'px';
    painel.style.maxWidth = Math.max(largura, 320) + 'px';
    const alto = painel.offsetHeight;
    const abaixo = window.innerHeight - r.bottom;
    const top = abaixo < alto + 12 && r.top > alto + 12 ? r.top - alto - 6 : r.bottom + 6;
    const left = Math.min(r.left, window.innerWidth - painel.offsetWidth - 12);
    painel.style.top = Math.max(8, top) + 'px';
    painel.style.left = Math.max(8, left) + 'px';
  }

  private parseISO(v: string | null | undefined): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  private toISO(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private inicioMes(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  private normalizar(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
}
