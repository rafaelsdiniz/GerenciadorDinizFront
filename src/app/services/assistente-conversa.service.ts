import { Injectable, computed, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { AuthService } from './auth.service';
import { AssistenteAcao, AssistenteItemHistorico, AssistenteService, AssistenteStatus } from './assistente.service';
import { renderizarMarkdownLeve } from '../components/assistente/assistente-markdown';

/** Mensagem da conversa com o Assistente Diniz (compartilhada entre o widget flutuante e a página /assistente). */
export interface AssistenteMensagem {
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
/** Mesmo limite do backend (AssistenteLimitador.MAXIMO por minuto). */
const LIMITE_POR_MINUTO = 20;

const SUGESTOES_CLIENTE = [
  'O que eu preciso enviar este mês?', 'Quais guias vencem esta semana?',
  'Tenho comunicação nova da SEFAZ?', 'Como confirmo o pagamento de uma guia?'
];
const SUGESTOES_ESCRITORIO = [
  'Quais empresas estão com obrigações vencidas?', 'Resuma a situação da carteira hoje',
  'Quais comunicações do DEC exigem atenção?', 'Quais certidões vencem nos próximos 15 dias?'
];

/**
 * Estado único da conversa com o assistente: mensagens, envio, status da IA e persistência em sessionStorage.
 * O widget flutuante e a página dedicada usam a mesma conversa (por usuário).
 */
@Injectable({ providedIn: 'root' })
export class AssistenteConversaService {

  readonly max = AssistenteService.MAX;

  private readonly _mensagens = signal<AssistenteMensagem[]>([]);
  private readonly _enviando = signal(false);
  private readonly _status = signal<AssistenteStatus | null>(null);
  private readonly _carregandoStatus = signal(false);

  readonly mensagens = this._mensagens.asReadonly();
  readonly enviando = this._enviando.asReadonly();
  readonly status = this._status.asReadonly();
  readonly carregandoStatus = this._carregandoStatus.asReadonly();
  readonly ia = computed(() => !!this._status()?.iaConfigurada);
  readonly nome = computed(() => this._status()?.nome ?? '');

  /** Emite quando chega uma resposta (ou erro) do assistente. */
  readonly resposta$ = new Subject<AssistenteMensagem>();
  /** Emite a cada mudança na lista (para rolar até o fim). */
  readonly mudou$ = new Subject<void>();

  private seq = 0;
  private chave = '';
  private pedido?: Subscription;

  constructor(
    private service: AssistenteService,
    private auth: AuthService,
    private router: Router
  ) {}

  /** Garante que a conversa carregada é a do usuário logado (troca de usuário na mesma aba). */
  sincronizarUsuario(): void {
    const chave = `assistente-diniz:${this.auth.getUsuarioId() ?? 'anon'}`;
    if (chave === this.chave) return;
    this.chave = chave;
    this.pedido?.unsubscribe();
    this._enviando.set(false);
    this._status.set(null);
    this.restaurar();
  }

  sugestoes(): string[] {
    const s = this._status()?.sugestoes;
    if (s?.length) return s;
    return this.auth.isAdmin() ? SUGESTOES_ESCRITORIO : SUGESTOES_CLIENTE;
  }

  carregarStatus(): void {
    this.sincronizarUsuario();
    if (this._status() || this._carregandoStatus()) return;
    this._carregandoStatus.set(true);
    this.service.status().subscribe({
      next: s => { this._status.set(s); this._carregandoStatus.set(false); },
      error: () => this._carregandoStatus.set(false)
    });
  }

  limpar(): void {
    this.pedido?.unsubscribe();
    this._enviando.set(false);
    this._mensagens.set([]);
    this.salvar();
    this.mudou$.next();
  }

  /**
   * Envia a pergunta (ou repete uma que falhou). Retorna false se não pôde enviar
   * (vazia, longa demais ou já esperando resposta).
   */
  enviar(texto: string, repetir = false): boolean {
    this.sincronizarUsuario();
    const pergunta = (texto ?? '').trim();
    if (!pergunta || this._enviando() || pergunta.length > this.max) return false;

    // histórico válido (sem mensagens de erro), antes de incluir a nova pergunta — mesmo formato do backend
    const historico: AssistenteItemHistorico[] = this._mensagens()
      .filter(m => !m.erro)
      .slice(-8)
      .map(m => ({ papel: m.papel, texto: m.texto }));

    if (repetir) {
      this._mensagens.update(l => l.filter(m => m.repetir !== pergunta));
    } else {
      this.adicionar({ papel: 'usuario', texto: pergunta });
    }
    this._enviando.set(true);
    this.mudou$.next();

    this.pedido = this.service.perguntar(pergunta, historico).subscribe({
      next: r => {
        this._enviando.set(false);
        const bruto = (r.resposta ?? '').trim() || 'Não encontrei uma resposta para isso.';
        const nota = NOTA_AUTOMATICA.exec(bruto);
        this.resposta$.next(this.adicionar({
          papel: 'assistente',
          texto: nota ? bruto.slice(0, nota.index).trim() : bruto,
          nota: nota ? nota[0].trim().replace(/^\(|\)$/g, '') : undefined,
          fonte: r.fonte,
          acoes: (r.acoes ?? []).slice(0, 3)
        }));
      },
      error: (e: HttpErrorResponse) => {
        this._enviando.set(false);
        let texto: string;
        let podeRepetir = true;
        if (e.status === 429) {
          texto = e.error?.mensagem
            ?? `Muitas perguntas em pouco tempo (limite de ${LIMITE_POR_MINUTO} por minuto). Aguarde um minuto e tente de novo.`;
        } else if (e.status === 400 && e.error?.mensagem) {
          texto = e.error.mensagem;
          podeRepetir = false;
        } else if (e.status === 0) {
          texto = 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';
        } else {
          texto = 'Não consegui responder agora. Tente de novo em instantes.';
        }
        this.resposta$.next(this.adicionar({ papel: 'assistente', texto, erro: true, repetir: podeRepetir ? pergunta : undefined }));
      }
    });
    return true;
  }

  /**
   * Navega pela ação sugerida. Na mesma tela, recria o componente para aplicar os novos filtros
   * (as telas leem os filtros ao abrir).
   */
  navegar(a: AssistenteAcao): Promise<boolean> {
    const destino = () => this.router.navigate([a.rota], { queryParams: a.queryParams ?? {} });
    const mesmaTela = this.router.url.split('?')[0] === a.rota;
    return mesmaTela ? this.router.navigateByUrl('/', { skipLocationChange: true }).then(destino) : destino();
  }

  // ------------------------------------------------------------------ apoio

  private adicionar(m: Omit<AssistenteMensagem, 'id' | 'html'>): AssistenteMensagem {
    const msg: AssistenteMensagem = { ...m, id: ++this.seq, html: renderizarMarkdownLeve(m.texto) };
    this._mensagens.update(l => [...l, msg]);
    this.salvar();
    this.mudou$.next();
    return msg;
  }

  private salvar(): void {
    if (!this.chave) return;
    try {
      const dados = this._mensagens().slice(-MAX_SALVAS).map(({ html, ...resto }) => resto);
      sessionStorage.setItem(this.chave, JSON.stringify(dados));
    } catch { /* storage indisponível: a conversa vale só enquanto a aba está aberta */ }
  }

  private restaurar(): void {
    let lista: AssistenteMensagem[] = [];
    try {
      const bruto = sessionStorage.getItem(this.chave);
      const dados = bruto ? JSON.parse(bruto) : [];
      if (Array.isArray(dados)) {
        lista = dados
          .filter((m: AssistenteMensagem) => m && (m.papel === 'usuario' || m.papel === 'assistente') && typeof m.texto === 'string')
          .map((m: AssistenteMensagem) => ({ ...m, id: ++this.seq, html: renderizarMarkdownLeve(m.texto) }));
      }
    } catch { lista = []; }
    this._mensagens.set(lista);
  }
}
