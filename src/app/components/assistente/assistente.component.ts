import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { IconComponent } from '../../shared/icon.component';
import { AuthService } from '../../services/auth.service';
import {
  AssistenteAcao, AssistenteItemHistorico, AssistenteService, AssistenteStatus
} from '../../services/assistente.service';

interface Mensagem {
  id: number;
  papel: 'usuario' | 'assistente';
  texto: string;
  fonte?: 'IA' | 'AUTOMATICA';
  acoes?: AssistenteAcao[];
  /** resposta de erro (não vai para o histórico enviado à IA) */
  erro?: boolean;
  /** pergunta que falhou, para "Tentar novamente" */
  repetir?: string;
  /** nota final da resposta automática, exibida discreta */
  nota?: string;
  /** HTML seguro já renderizado (não é salvo) */
  html?: string;
}

const NOTA_AUTOMATICA = /\n*\(resposta automática[^)]*\)\s*$/i;
const MAX_SALVAS = 40;

const SUGESTOES_CLIENTE = [
  'O que eu preciso enviar este mês?', 'Quais guias vencem esta semana?',
  'Tenho comunicação nova da SEFAZ?', 'Como confirmo o pagamento de uma guia?'
];
const SUGESTOES_ESCRITORIO = [
  'Quais empresas estão com obrigações vencidas?', 'Resuma a situação da carteira hoje',
  'Quais comunicações do DEC exigem atenção?', 'Quais certidões vencem nos próximos 15 dias?'
];

/** Escapa HTML e aplica um markdown mínimo: **negrito**, quebras de linha, listas "- " e "1. ". */
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

@Component({
  selector: 'app-assistente',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  templateUrl: './assistente.component.html',
  styleUrl: './assistente.component.css'
})
export class AssistenteComponent implements OnInit, OnDestroy {
  @ViewChild('lista') lista?: ElementRef<HTMLElement>;
  @ViewChild('campo') campo?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('fab') fab?: ElementRef<HTMLButtonElement>;

  readonly max = AssistenteService.MAX;

  aberto = false;
  pulsar = false;
  naoLida = false;
  /** na tela Arquivos (mobile) o botão sobe para não cobrir o botão "+" do Drive */
  acimaFab = false;

  status: AssistenteStatus | null = null;
  carregandoStatus = false;
  mensagens: Mensagem[] = [];
  texto = '';
  enviando = false;

  private seq = 0;
  private chave = 'assistente-diniz';
  private subs: Subscription[] = [];
  private pedido?: Subscription;
  private destruido = false;

  constructor(
    private service: AssistenteService,
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // conversa por usuário: quem entra depois na mesma aba não vê a conversa anterior
    this.chave = `assistente-diniz:${this.auth.getUsuarioId() ?? 'anon'}`;
    this.restaurar();
    try { this.pulsar = localStorage.getItem('assistente-diniz:visto') !== '1'; } catch { this.pulsar = true; }
    this.acimaFab = this.router.url.startsWith('/arquivos');
    this.subs.push(this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(e => {
      this.acimaFab = (e as NavigationEnd).urlAfterRedirects.startsWith('/arquivos');
    }));
  }

  ngOnDestroy(): void {
    this.destruido = true;
    this.subs.forEach(s => s.unsubscribe());
    this.pedido?.unsubscribe();
  }

  // ------------------------------------------------------------------ painel

  get ia(): boolean { return !!this.status?.iaConfigurada; }

  get sugestoes(): string[] {
    if (this.status?.sugestoes?.length) return this.status.sugestoes;
    return this.auth.isAdmin() ? SUGESTOES_ESCRITORIO : SUGESTOES_CLIENTE;
  }

  get nome(): string { return this.status?.nome ?? ''; }

  get podeEnviar(): boolean {
    const t = this.texto.trim();
    return !this.enviando && t.length > 0 && t.length <= this.max;
  }

  abrir(): void {
    this.aberto = true;
    this.naoLida = false;
    if (this.pulsar) {
      this.pulsar = false;
      try { localStorage.setItem('assistente-diniz:visto', '1'); } catch { /* sem storage */ }
    }
    if (!this.status && !this.carregandoStatus) this.carregarStatus();
    this.depoisDeRenderizar(() => { this.rolarParaFim(); this.campo?.nativeElement.focus(); });
  }

  minimizar(): void {
    this.aberto = false;
    this.depoisDeRenderizar(() => this.fab?.nativeElement.focus());
  }

  fechar(): void {
    this.minimizar();
  }

  limpar(): void {
    this.pedido?.unsubscribe();
    this.enviando = false;
    this.mensagens = [];
    this.salvar();
    this.campo?.nativeElement.focus();
  }

  private carregarStatus(): void {
    this.carregandoStatus = true;
    this.service.status().subscribe({
      next: s => { this.status = s; this.carregandoStatus = false; },
      error: () => { this.carregandoStatus = false; }
    });
  }

  // ------------------------------------------------------------------ conversa

  usarSugestao(s: string): void {
    this.texto = s;
    this.enviar();
  }

  aoTeclar(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
      ev.preventDefault();
      this.enviar();
    }
  }

  ajustarAltura(): void {
    const el = this.campo?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 132) + 'px';
  }

  enviar(repetir?: string): void {
    const pergunta = (repetir ?? this.texto).trim();
    if (!pergunta || this.enviando || pergunta.length > this.max) return;

    // histórico válido (sem mensagens de erro), antes de incluir a nova pergunta
    const historico: AssistenteItemHistorico[] = this.mensagens
      .filter(m => !m.erro)
      .slice(-8)
      .map(m => ({ papel: m.papel, texto: m.texto }));

    if (repetir) {
      this.mensagens = this.mensagens.filter(m => m.repetir !== repetir);
    } else {
      this.adicionar({ papel: 'usuario', texto: pergunta });
      this.texto = '';
      this.depoisDeRenderizar(() => this.ajustarAltura());
    }
    this.enviando = true;
    this.rolarDepois();

    this.pedido = this.service.perguntar(pergunta, historico).subscribe({
      next: r => {
        this.enviando = false;
        const bruto = (r.resposta ?? '').trim() || 'Não encontrei uma resposta para isso.';
        const nota = NOTA_AUTOMATICA.exec(bruto);
        this.adicionar({
          papel: 'assistente',
          texto: nota ? bruto.slice(0, nota.index).trim() : bruto,
          nota: nota ? nota[0].trim().replace(/^\(|\)$/g, '') : undefined,
          fonte: r.fonte,
          acoes: (r.acoes ?? []).slice(0, 3)
        });
        if (!this.aberto) this.naoLida = true;
      },
      error: (e: HttpErrorResponse) => {
        this.enviando = false;
        const limite = e.status === 429;
        const texto = limite
          ? (e.error?.mensagem ?? 'Muitas perguntas em pouco tempo. Aguarde um minuto e tente de novo.')
          : e.status === 400 && e.error?.mensagem
            ? e.error.mensagem
            : 'Não consegui responder agora. Verifique sua conexão e tente de novo em instantes.';
        this.adicionar({ papel: 'assistente', texto, erro: true, repetir: limite || e.status === 400 ? undefined : pergunta });
        if (!this.aberto) this.naoLida = true;
      }
    });
  }

  /** Navega pela ação sugerida e minimiza o painel. */
  irPara(ev: MouseEvent, a: AssistenteAcao): void {
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return; // nova aba: deixa o link agir
    ev.preventDefault();
    const destino = () => this.router.navigate([a.rota], { queryParams: a.queryParams ?? {} });
    const mesmaTela = this.router.url.split('?')[0] === a.rota;
    // a tela lê os filtros ao abrir: na mesma tela, recria o componente para aplicar o novo filtro
    if (mesmaTela) this.router.navigateByUrl('/', { skipLocationChange: true }).then(destino);
    else destino();
    this.minimizar();
  }

  aoTeclarPainel(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      this.fechar();
    }
  }

  // ------------------------------------------------------------------ apoio

  private adicionar(m: Omit<Mensagem, 'id' | 'html'>): void {
    const msg: Mensagem = { ...m, id: ++this.seq };
    msg.html = renderizarMarkdownLeve(msg.texto);
    this.mensagens = [...this.mensagens, msg];
    this.salvar();
    this.rolarDepois();
  }

  private salvar(): void {
    try {
      const dados = this.mensagens.slice(-MAX_SALVAS).map(({ html, ...resto }) => resto);
      sessionStorage.setItem(this.chave, JSON.stringify(dados));
    } catch { /* storage indisponível: a conversa vale só nesta tela */ }
  }

  private restaurar(): void {
    try {
      const bruto = sessionStorage.getItem(this.chave);
      if (!bruto) return;
      const lista = JSON.parse(bruto) as Mensagem[];
      if (!Array.isArray(lista)) return;
      this.mensagens = lista
        .filter(m => m && (m.papel === 'usuario' || m.papel === 'assistente') && typeof m.texto === 'string')
        .map(m => ({ ...m, id: ++this.seq, html: renderizarMarkdownLeve(m.texto) }));
    } catch { this.mensagens = []; }
  }

  private rolarDepois(): void {
    this.depoisDeRenderizar(() => this.rolarParaFim());
  }

  private rolarParaFim(): void {
    const el = this.lista?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  private depoisDeRenderizar(fn: () => void): void {
    setTimeout(() => {
      if (this.destruido) return;
      this.cdr.detectChanges();
      fn();
    });
  }

  trackId(_: number, m: Mensagem): number { return m.id; }
}
