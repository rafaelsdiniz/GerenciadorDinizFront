import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { MensagemService } from '../../services/mensagem.service';
import { ObrigacaoPendenteService } from '../../services/obrigacao-pendente.service';
import { EmpresaService } from '../../services/empresa.service';
import { AuthService } from '../../services/auth.service';
import { ObrigacaoPendenteResponseDTO } from '../../models/obrigacao-pendente-response.dto';
import { EmpresaResponseDTO } from '../../models/empresa-response.dto';
import { StatusObrigacao } from '../../models/enums/status-obrigacao.enum';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/ui/toast.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { AvatarCorPipe, IniciaisPipe, PrazoPipe, diasAte } from '../../pipes/formatos.pipe';
import { ArquivoResponseDTO } from '../../models/arquivo-response.dto';
import { ObrigacaoDetalheComponent } from './obrigacao-detalhe/obrigacao-detalhe.component';
import { ObrigacaoAnexarComponent } from './obrigacao-anexar/obrigacao-anexar.component';
import { ObrigacaoPagamentoComponent, PagamentoConfirmado } from './obrigacao-pagamento/obrigacao-pagamento.component';
import {
  aguardaPagamento, isCliente, mensagemErro, pagamentoVisual, PagamentoVisual, rotuloAnexar, situacaoPagamento
} from './obrigacao.util';

/** Situação "real" exibida: PENDENTE com vencimento passado conta como VENCIDA. */
type Situacao = 'VENCIDA' | 'PENDENTE' | 'ENTREGUE';
type Filtro = 'enviar' | 'pagar' | 'pendentes' | 'vencidas' | 'semana' | 'entregues' | 'entreguesMes' | 'todas' | 'mensagens';
const FILTROS: Filtro[] = ['enviar', 'pagar', 'pendentes', 'vencidas', 'semana', 'entregues', 'entreguesMes', 'todas', 'mensagens'];
/** Atualização das mensagens não lidas enquanto a lista está aberta. */
const POLL_MENSAGENS_MS = 30000;
type Ordem = 'urgencia' | 'nome' | 'empresa' | 'vencimento';

interface Linha {
  p: ObrigacaoPendenteResponseDTO;
  situacao: Situacao;
  dias: number | null;
  empresa: string;
  /** dias de atraso na entrega (só para ENTREGUE) */
  atrasoEntrega: number | null;
  /** responsável CLIENTE: o cliente envia documentos ao escritório */
  cliente: boolean;
  arquivos: number;
  /** rótulo da ação de anexo ("Anexar guia" | "Enviar documento") */
  acao: string;
  /** ADMIN anexa em qualquer obrigação; o cliente só envia nas de responsabilidade dele */
  podeAnexar: boolean;
  /** badge do pagamento da guia (só guias do escritório já entregues) */
  pagamento: PagamentoVisual | null;
  /** entregue pelo escritório e ainda sem pagamento confirmado (AGUARDANDO | ATRASADO) */
  aguardaPagamento: boolean;
  /** aguardando pagamento com o vencimento já passado */
  pagamentoAtrasado: boolean;
}

const PESO: Record<Situacao, number> = { VENCIDA: 0, PENDENTE: 1, ENTREGUE: 2 };
/** Dentro das entregues: pagamento atrasado → aguardando → demais. */
const pesoPagamento = (l: Linha): number => l.pagamentoAtrasado ? 0 : l.aguardaPagamento ? 1 : 2;

@Component({
  selector: 'app-obrigacao-pendente-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, PrazoPipe, IniciaisPipe, AvatarCorPipe,
            ObrigacaoDetalheComponent, ObrigacaoAnexarComponent, ObrigacaoPagamentoComponent],
  templateUrl: './obrigacao-pendente-list.component.html',
  styleUrl: './obrigacao-pendente-list.component.css'
})
export class ObrigacaoPendenteListComponent implements OnInit, OnDestroy {
  @ViewChild('buscaInput') buscaInput?: ElementRef<HTMLInputElement>;

  pendentes: ObrigacaoPendenteResponseDTO[] = [];
  empresas: EmpresaResponseDTO[] = [];
  linhas: Linha[] = [];
  carregando = false;
  isAdmin = false;
  gerando = false;
  /** FUNCIONARIO: vê apenas a própria empresa */
  idEmpresaUsuario: number | null = null;

  busca = '';
  idEmpresaFiltro: number | null = null;
  filtro: Filtro = 'pendentes';
  ordem: Ordem = 'urgencia';
  ordemDesc = false;

  pagina = 1;
  porPagina = 10;
  readonly opcoesPorPagina = [10, 25, 50];

  idAcaoCarregando: number | null = null;

  /** modal de prorrogação */
  prorrogando: Linha | null = null;
  novaDataVencimento = '';
  salvandoVencimento = false;
  readonly atalhosProrrogar = [7, 15, 30];

  /** drawer de detalhes (id da obrigação aberta) */
  detalheId: number | null = null;
  /** modal de anexo */
  anexando: Linha | null = null;
  /** modal de confirmação de pagamento */
  pagando: Linha | null = null;
  /** obrigação com "desfazer pagamento" em andamento */
  idDesfazendo: number | null = null;
  /** filtro veio da URL ou foi escolhido → não aplica o padrão "O que preciso enviar" */
  private filtroDefinido = false;

  /** mensagens não lidas por obrigação (módulo de mensagens) */
  naoLidas: Record<number, number> = {};
  private subs: Subscription[] = [];
  private pollMensagens: ReturnType<typeof setInterval> | null = null;

  readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  readonly hojeIso = toIso(new Date());

  constructor(
    private service: ObrigacaoPendenteService,
    private empresaService: EmpresaService,
    private authService: AuthService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private route: ActivatedRoute,
    private router: Router,
    private mensagemService: MensagemService
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    this.idEmpresaUsuario = this.isAdmin ? null : this.authService.getEmpresaId();

    const qp = this.route.snapshot.queryParamMap;
    const f = qp.get('filtro') as Filtro | null;
    if (f && FILTROS.includes(f)) { this.filtro = f; this.filtroDefinido = true; }
    const emp = Number(qp.get('empresa'));
    if (emp) this.idEmpresaFiltro = emp;

    this.empresaService.listar().subscribe({
      next: (d) => {
        this.empresas = this.idEmpresaUsuario ? d.filter(e => e.id === this.idEmpresaUsuario) : d;
        this.montarLinhas();
      },
      error: () => {}
    });
    this.carregar();
    this.iniciarMensagens();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (this.pollMensagens) clearInterval(this.pollMensagens);
  }

  // -------------------------------------------------------------- mensagens
  /** Contadores de não lidas + abertura do drawer por ?obrigacao=<id> (links das notificações). */
  private iniciarMensagens(): void {
    this.subs.push(this.mensagemService.naoLidas$.subscribe(n => this.naoLidas = n.porObrigacao ?? {}));
    this.mensagemService.atualizarNaoLidas();
    this.pollMensagens = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) this.mensagemService.atualizarNaoLidas();
    }, POLL_MENSAGENS_MS);
    this.subs.push(this.route.queryParamMap.subscribe(qp => {
      const id = Number(qp.get('obrigacao'));
      if (!id) return;
      this.detalheId = id;
      // limpa o parâmetro: um novo clique na mesma notificação volta a abrir o drawer
      this.router.navigate([], { relativeTo: this.route, queryParams: { obrigacao: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }));
  }

  mensagensNovas(l: Linha): number {
    return this.naoLidas[l.p.id] ?? 0;
  }

  // ------------------------------------------------------------------ dados
  carregar(): void {
    this.carregando = true;
    this.service.listar().subscribe({
      next: (d) => {
        this.pendentes = d;
        this.montarLinhas();
        this.carregando = false;
        this.aplicarFiltroPadrao();
      },
      error: () => {
        this.carregando = false;
        this.toast.error('Não foi possível carregar as obrigações', 'Verifique sua conexão e tente novamente.');
      }
    });
  }

  private montarLinhas(): void {
    const visiveis = this.idEmpresaUsuario ? this.pendentes.filter(p => p.idEmpresa === this.idEmpresaUsuario) : this.pendentes;
    this.linhas = visiveis.map(p => {
      const dias = diasAte(p.dataVencimento) ?? p.diasParaVencer;
      let situacao: Situacao = 'PENDENTE';
      if (p.status === StatusObrigacao.ENTREGUE) situacao = 'ENTREGUE';
      else if (p.status === StatusObrigacao.VENCIDA || (dias != null && dias < 0)) situacao = 'VENCIDA';
      let atrasoEntrega: number | null = null;
      if (situacao === 'ENTREGUE' && p.dataEntrega && p.dataVencimento) {
        atrasoEntrega = Math.round((parseIso(p.dataEntrega) - parseIso(p.dataVencimento)) / 86400000);
      }
      return {
        p, situacao, dias, atrasoEntrega,
        empresa: p.nomeEmpresa || this.getNomeEmpresa(p.idEmpresa),
        cliente: isCliente(p),
        arquivos: p.totalArquivos ?? 0,
        acao: rotuloAnexar(p),
        podeAnexar: this.isAdmin || isCliente(p),
        pagamento: pagamentoVisual(p),
        aguardaPagamento: aguardaPagamento(p),
        pagamentoAtrasado: situacaoPagamento(p) === 'ATRASADO'
      };
    });
  }

  /** FUNCIONARIO: abre em "O que preciso enviar" ou, sem documentos a enviar, em "Aguardando pagamento". */
  private aplicarFiltroPadrao(): void {
    if (this.filtroDefinido || this.isAdmin) return;
    this.filtroDefinido = true;
    if (this.linhas.some(l => this.passa(l, 'enviar'))) this.filtro = 'enviar';
    else if (this.linhas.some(l => this.passa(l, 'pagar'))) this.filtro = 'pagar';
  }

  getNomeEmpresa(id: number): string {
    return this.empresas.find(e => e.id === id)?.nomeFantasia ?? '—';
  }

  // ---------------------------------------------------------------- filtros
  /** Linhas após busca e empresa (base para contadores). */
  get base(): Linha[] {
    const termo = normalizar(this.busca.trim());
    return this.linhas.filter(l =>
      (!this.idEmpresaFiltro || l.p.idEmpresa === this.idEmpresaFiltro) &&
      (!termo || normalizar(`${l.p.nomeObrigacao ?? ''} ${l.empresa} ${l.p.competencia ?? ''}`).includes(termo))
    );
  }

  private passa(l: Linha, f: Filtro): boolean {
    switch (f) {
      case 'enviar': return l.cliente && l.situacao !== 'ENTREGUE';
      case 'pagar': return l.aguardaPagamento;
      case 'pendentes': return l.situacao !== 'ENTREGUE';
      case 'vencidas': return l.situacao === 'VENCIDA';
      case 'semana': return l.situacao === 'PENDENTE' && l.dias != null && l.dias >= 0 && l.dias <= 7;
      case 'entregues': return l.situacao === 'ENTREGUE';
      case 'entreguesMes': return l.situacao === 'ENTREGUE' && !!l.p.dataEntrega && l.p.dataEntrega.slice(0, 7) === this.hojeIso.slice(0, 7);
      case 'mensagens': return this.mensagensNovas(l) > 0;
      default: return true;
    }
  }

  contar(f: Filtro): number {
    return this.base.filter(l => this.passa(l, f)).length;
  }

  get filtradas(): Linha[] {
    const r = this.base.filter(l => this.passa(l, this.filtro));
    const dir = this.ordemDesc ? -1 : 1;
    return r.sort((a, b) => {
      let c = 0;
      switch (this.ordem) {
        case 'nome': c = (a.p.nomeObrigacao ?? '').localeCompare(b.p.nomeObrigacao ?? '', 'pt-BR'); break;
        case 'empresa': c = a.empresa.localeCompare(b.empresa, 'pt-BR'); break;
        case 'vencimento': c = a.p.dataVencimento.localeCompare(b.p.dataVencimento); break;
        default:
          c = PESO[a.situacao] - PESO[b.situacao];
          if (!c && a.situacao === 'ENTREGUE') c = pesoPagamento(a) - pesoPagamento(b);
          if (!c) {
            c = a.situacao === 'ENTREGUE' && !a.aguardaPagamento
              ? (b.p.dataEntrega ?? '').localeCompare(a.p.dataEntrega ?? '')
              : a.p.dataVencimento.localeCompare(b.p.dataVencimento);
          }
          return c;
      }
      return c * dir || a.p.dataVencimento.localeCompare(b.p.dataVencimento);
    });
  }

  setFiltro(f: Filtro): void {
    this.filtro = f;
    this.filtroDefinido = true;
    this.pagina = 1;
  }

  aoMudarFiltro(): void {
    this.pagina = 1;
  }

  ordenar(o: Ordem): void {
    if (this.ordem === o) this.ordemDesc = !this.ordemDesc;
    else { this.ordem = o; this.ordemDesc = false; }
  }

  limparFiltros(): void {
    this.busca = '';
    this.idEmpresaFiltro = null;
    this.filtro = 'todas';
    this.pagina = 1;
  }

  get temFiltroExtra(): boolean {
    return !!this.busca.trim() || !!this.idEmpresaFiltro;
  }

  // ------------------------------------------------------------------- KPIs
  get kpiVencidas(): Linha[] { return this.base.filter(l => this.passa(l, 'vencidas')); }
  get kpiSemana(): Linha[] { return this.base.filter(l => this.passa(l, 'semana')); }

  get maiorAtraso(): number {
    return this.kpiVencidas.reduce((m, l) => Math.max(m, -(l.dias ?? 0)), 0);
  }

  get proximoVencimento(): number | null {
    const d = this.base.filter(l => l.situacao === 'PENDENTE' && l.dias != null).map(l => l.dias as number);
    return d.length ? Math.min(...d) : null;
  }

  /** guias entregues aguardando pagamento com vencimento passado */
  get pagamentosAtrasados(): number {
    return this.base.filter(l => l.pagamentoAtrasado).length;
  }

  /** Texto de apoio do aviso "N guia(s) aguardando pagamento" (cliente). */
  get textoAvisoPagamento(): string {
    const n = this.contar('pagar'), at = this.pagamentosAtrasados;
    if (!at) return n === 1
      ? 'O escritório já entregou a guia — depois de pagar, confirme o pagamento aqui.'
      : 'O escritório já entregou as guias — depois de pagar, confirme o pagamento aqui.';
    if (at === n) return n === 1
      ? 'A guia já venceu — se já foi paga, confirme o pagamento informando a data.'
      : 'Todas já venceram — se já foram pagas, confirme o pagamento informando a data.';
    return `${at} já ${at === 1 ? 'venceu' : 'venceram'}. Depois de pagar, confirme o pagamento aqui.`;
  }

  get empresasComAtraso(): number {
    return new Set(this.kpiVencidas.map(l => l.p.idEmpresa)).size;
  }

  // -------------------------------------------------------------- paginação
  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.filtradas.length / this.porPagina));
  }

  get paginaAtual(): number {
    return Math.min(this.pagina, this.totalPaginas);
  }

  get itensPagina(): Linha[] {
    const ini = (this.paginaAtual - 1) * this.porPagina;
    return this.filtradas.slice(ini, ini + this.porPagina);
  }

  get faixa(): { de: number; ate: number; total: number } {
    const total = this.filtradas.length;
    const de = total ? (this.paginaAtual - 1) * this.porPagina + 1 : 0;
    return { de, ate: Math.min(total, de + this.porPagina - 1), total };
  }

  /** Números de página com reticências (-1). */
  get paginas(): number[] {
    const t = this.totalPaginas, a = this.paginaAtual;
    if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
    const set = [1, t, a - 1, a, a + 1].filter(n => n >= 1 && n <= t);
    const ord = [...new Set(set)].sort((x, y) => x - y);
    const out: number[] = [];
    ord.forEach((n, i) => { if (i && n - ord[i - 1] > 1) out.push(-1); out.push(n); });
    return out;
  }

  irPara(n: number): void {
    this.pagina = Math.min(Math.max(1, n), this.totalPaginas);
  }

  /** Mostra cabeçalho de grupo quando a situação muda (só na ordenação por urgência). */
  mostraGrupo(i: number): boolean {
    if (this.ordem !== 'urgencia' || this.filtro === 'enviar' || this.filtro === 'pagar' || this.filtro === 'vencidas' || this.filtro === 'semana' || this.filtro.startsWith('entregues')) return false;
    const itens = this.itensPagina;
    return i === 0 || itens[i].situacao !== itens[i - 1].situacao;
  }

  contarSituacao(s: Situacao): number {
    return this.filtradas.filter(l => l.situacao === s).length;
  }

  // ------------------------------------------------------------- exibição
  statusClasse(s: Situacao): string {
    return s === 'ENTREGUE' ? 'badge-success' : s === 'VENCIDA' ? 'badge-danger' : 'badge-warning';
  }

  statusTexto(s: Situacao): string {
    return s === 'ENTREGUE' ? 'Entregue' : s === 'VENCIDA' ? 'Vencida' : 'Pendente';
  }

  prazoClasse(l: Linha): string {
    if (l.situacao === 'VENCIDA') return 'badge-danger';
    const d = l.dias;
    if (d == null) return 'badge-neutral';
    if (d <= 1) return 'badge-danger';
    if (d <= 7) return 'badge-warning';
    return 'badge-success';
  }

  grupoTitulo(s: Situacao): string {
    return s === 'VENCIDA' ? 'Vencidas — exigem ação' : s === 'PENDENTE' ? 'A vencer' : 'Entregues';
  }

  // ---------------------------------------------------------------- ações
  async gerar(): Promise<void> {
    const ok = await this.confirm.ask({
      titulo: 'Gerar pendências do período?',
      mensagem: 'Serão criadas as obrigações do período a partir das obrigações recorrentes ativas. Pendências já existentes não são duplicadas.',
      confirmar: 'Gerar pendências'
    });
    if (!ok) return;
    this.gerando = true;
    this.service.gerarPendentes().subscribe({
      next: (r) => {
        this.gerando = false;
        if (r.criadas > 0) this.toast.success(`${r.criadas} pendência(s) gerada(s)`, 'A lista foi atualizada.');
        else this.toast.info('Nenhuma pendência nova', 'Todas as obrigações do período já estavam geradas.');
        this.carregar();
      },
      error: (err) => {
        this.gerando = false;
        this.toast.error('Erro ao gerar pendências', err?.error?.mensagem);
      }
    });
  }

  async marcarEntregue(l: Linha): Promise<void> {
    const ok = await this.confirm.ask({
      titulo: 'Marcar como entregue?',
      mensagem: `"${l.p.nomeObrigacao ?? 'Obrigação'}" — ${l.empresa}, vencimento ${formatarData(l.p.dataVencimento)}.`,
      confirmar: 'Marcar entregue'
    });
    if (!ok) return;
    this.idAcaoCarregando = l.p.id;
    this.service.marcarEntregue(l.p.id).subscribe({
      next: () => {
        this.idAcaoCarregando = null;
        this.toast.success('Obrigação entregue', `${l.p.nomeObrigacao ?? 'Obrigação'} · ${l.empresa}`);
        this.carregar();
      },
      error: (err) => {
        this.idAcaoCarregando = null;
        this.toast.error('Erro ao marcar entrega', err?.error?.mensagem);
      }
    });
  }

  abrirProrrogar(l: Linha): void {
    this.prorrogando = l;
    this.novaDataVencimento = l.p.dataVencimento || '';
    this.salvandoVencimento = false;
  }

  fecharProrrogar(): void {
    if (this.salvandoVencimento) return;
    this.prorrogando = null;
    this.novaDataVencimento = '';
  }

  /** Atalho: +N dias a partir de hoje ou do vencimento atual (o que for maior). */
  aplicarAtalho(dias: number): void {
    if (!this.prorrogando) return;
    const venc = this.prorrogando.p.dataVencimento;
    const baseIso = venc && venc > this.hojeIso ? venc : this.hojeIso;
    const d = new Date(parseIso(baseIso));
    d.setDate(d.getDate() + dias);
    this.novaDataVencimento = toIso(d);
  }

  get novaDataDias(): number | null {
    return diasAte(this.novaDataVencimento);
  }

  salvarVencimento(): void {
    const l = this.prorrogando;
    if (!l) return;
    if (!this.novaDataVencimento) {
      this.toast.warning('Informe a nova data de vencimento');
      return;
    }
    this.salvandoVencimento = true;
    this.service.atualizarVencimento(l.p.id, this.novaDataVencimento).subscribe({
      next: () => {
        this.salvandoVencimento = false;
        this.toast.success('Vencimento prorrogado', `Novo vencimento: ${formatarData(this.novaDataVencimento)}`);
        this.prorrogando = null;
        this.novaDataVencimento = '';
        this.carregar();
      },
      error: (err) => {
        this.salvandoVencimento = false;
        this.toast.error('Erro ao atualizar vencimento', err?.error?.mensagem);
      }
    });
  }

  // ------------------------------------------------------ detalhes / anexo
  get detalhe(): Linha | undefined {
    return this.detalheId == null ? undefined : this.linhas.find(l => l.p.id === this.detalheId);
  }

  abrirDetalhe(l: Linha): void {
    this.detalheId = l.p.id;
  }

  fecharDetalhe(): void {
    this.detalheId = null;
    this.mensagemService.atualizarNaoLidas();
  }

  abrirAnexar(l: Linha): void {
    this.anexando = l;
  }

  aoAnexar(_a: ArquivoResponseDTO): void {
    const l = this.anexando;
    this.anexando = null;
    this.toast.success('Arquivo anexado e obrigação marcada como entregue',
      l ? `${l.p.nomeObrigacao ?? 'Obrigação'} · ${l.empresa}` : undefined);
    this.carregar();
  }

  // ------------------------------------------------------------ pagamento
  abrirPagamento(l: Linha): void {
    this.pagando = l;
  }

  /** alterou = o comprovante chegou a ser anexado mesmo sem confirmar o pagamento */
  fecharPagamento(alterou: boolean): void {
    this.pagando = null;
    if (alterou) this.carregar();
  }

  /** Aplica na hora o DTO devolvido pela API (a recarga completa da lista vem logo depois). */
  private aplicarRetorno(o: ObrigacaoPendenteResponseDTO | null | undefined): void {
    if (!o?.id || !this.pendentes.some(p => p.id === o.id)) return;
    this.pendentes = this.pendentes.map(p => p.id === o.id ? { ...p, ...o } : p);
    this.montarLinhas();
  }

  aoConfirmarPagamento(r: PagamentoConfirmado): void {
    const l = this.pagando;
    this.pagando = null;
    this.aplicarRetorno(r.obrigacao);
    const partes = [l ? `${l.p.nomeObrigacao ?? 'Obrigação'} · ${l.empresa}` : '', `pago em ${formatarData(r.data)}`];
    if (r.comComprovante) partes.push('comprovante anexado');
    this.toast.success('Pagamento confirmado', partes.filter(Boolean).join(' · '));
    this.carregar();
  }

  async desfazerPagamento(l: Linha): Promise<void> {
    const ok = await this.confirm.ask({
      titulo: 'Desfazer pagamento?',
      mensagem: `"${l.p.nomeObrigacao ?? 'Obrigação'}" — ${l.empresa} volta para aguardando pagamento${l.p.dataPagamento ? ` (pagamento registrado em ${formatarData(l.p.dataPagamento)})` : ''}. Os arquivos anexados são mantidos.`,
      confirmar: 'Desfazer pagamento',
      tom: 'danger'
    });
    if (!ok) return;
    this.idAcaoCarregando = l.p.id;
    this.idDesfazendo = l.p.id;
    this.service.desfazerPagamento(l.p.id).subscribe({
      next: (o) => {
        this.idAcaoCarregando = null;
        this.idDesfazendo = null;
        this.aplicarRetorno(o);
        this.toast.success('Pagamento desfeito', `${l.p.nomeObrigacao ?? 'Obrigação'} · ${l.empresa}`);
        this.carregar();
      },
      error: (err) => {
        this.idAcaoCarregando = null;
        this.idDesfazendo = null;
        this.toast.error('Erro ao desfazer pagamento', mensagemErro(err));
      }
    });
  }

  async reabrir(l: Linha): Promise<void> {
    const ok = await this.confirm.ask({
      titulo: 'Reabrir obrigação?',
      mensagem: `"${l.p.nomeObrigacao ?? 'Obrigação'}" — ${l.empresa} volta para pendente (ou vencida, se o prazo já passou)${l.p.situacaoPagamento === 'PAGO' ? ' e o pagamento confirmado é desfeito' : ''}. Os arquivos anexados são mantidos.`,
      confirmar: 'Reabrir',
      tom: 'danger'
    });
    if (!ok) return;
    this.idAcaoCarregando = l.p.id;
    this.service.reabrir(l.p.id).subscribe({
      next: () => {
        this.idAcaoCarregando = null;
        this.toast.success('Obrigação reaberta', `${l.p.nomeObrigacao ?? 'Obrigação'} · ${l.empresa}`);
        this.carregar();
      },
      error: (err) => {
        this.idAcaoCarregando = null;
        this.toast.error('Erro ao reabrir obrigação', mensagemErro(err));
      }
    });
  }

  // ------------------------------------------------------------- teclado
  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.prorrogando) this.fecharProrrogar();
      else if (!this.anexando && !this.pagando && this.detalheId != null) this.fecharDetalhe(); // os modais de anexo/pagamento tratam o próprio Esc
      return;
    }
    const alvo = e.target as HTMLElement;
    const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(alvo?.tagName) || alvo?.isContentEditable;
    if (e.key === '/' && !digitando && !this.prorrogando && !this.anexando && !this.pagando && this.detalheId == null) {
      e.preventDefault();
      this.buscaInput?.nativeElement.focus();
    }
  }
}

function parseIso(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d).getTime();
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
