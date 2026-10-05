import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FechamentoService } from '../../services/fechamento.service';
import { UsuarioService } from '../../services/usuario.service';
import { AuthService } from '../../services/auth.service';
import { CompetenciaDTO, EtapaFechamento, FechamentoMensalDTO, FechamentoUpdateDTO } from '../../models/fechamento.dto';
import { UsuarioResponseDTO } from '../../models/usuario-response.dto';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/ui/toast.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { AvatarCorPipe, DocumentoPipe, IniciaisPipe, PrazoPipe, PrazoTomPipe } from '../../pipes/formatos.pipe';

interface Etapa {
  id: EtapaFechamento;
  nome: string;
  descricao: string;
  icone: string;
  tom: 'warning' | 'info' | 'accent' | 'success';
}

export const ETAPAS: Etapa[] = [
  { id: 'AGUARDANDO_DOCUMENTOS', nome: 'Aguardando documentos', descricao: 'Esperando extratos, notas e demais documentos do cliente', icone: 'inbox', tom: 'warning' },
  { id: 'EM_APURACAO', nome: 'Em apuração', descricao: 'Escrituração e cálculo dos impostos em andamento', icone: 'activity', tom: 'info' },
  { id: 'GUIAS_EMITIDAS', nome: 'Guias emitidas', descricao: 'Guias e declarações enviadas ao cliente', icone: 'receipt', tom: 'accent' },
  { id: 'CONCLUIDO', nome: 'Concluído', descricao: 'Competência encerrada', icone: 'check-circle', tom: 'success' },
];

interface Chip { texto: string; tom: string; icone: string; titulo: string; }

interface Card {
  f: FechamentoMensalDTO;
  chips: Chip[];
  /** obrigações da competência já cumpridas (documentos recebidos + entregas do escritório) */
  feitas: number;
  total: number;
  pct: number;
}

interface Coluna { etapa: Etapa; cards: Card[]; }

/** Valor do select de responsável: '' = todos, 'nenhum' = sem responsável, ou o id. */
type FiltroResp = '' | 'nenhum' | string;

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** Quadro kanban do fechamento mensal de cada empresa no escritório. */
@Component({
  selector: 'app-fechamento-board',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent, IniciaisPipe, AvatarCorPipe, PrazoPipe, PrazoTomPipe, DocumentoPipe],
  templateUrl: './fechamento-board.component.html',
  styleUrl: './fechamento-board.component.css'
})
export class FechamentoBoardComponent implements OnInit, OnDestroy {
  private service = inject(FechamentoService);
  private usuarioService = inject(UsuarioService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly etapas = ETAPAS;
  readonly meuId = this.auth.getUsuarioId();

  competencias: CompetenciaDTO[] = [];
  competencia = '';
  fechamentos: FechamentoMensalDTO[] = [];
  equipe: UsuarioResponseDTO[] = [];

  carregando = true;
  erro = '';

  busca = '';
  filtroResp: FiltroResp = '';
  soMeus = false;
  soAtrasados = false;

  colunas: Coluna[] = [];
  totalFiltrado = 0;

  // arrastar e soltar
  arrastandoId: number | null = null;
  colunaAlvo: EtapaFechamento | null = null;
  /** ids com PATCH em andamento */
  salvando = new Set<number>();

  // menu "Mover para…"
  menuAberto: number | null = null;

  // modal de edição
  editando: FechamentoMensalDTO | null = null;
  form = { etapa: 'AGUARDANDO_DOCUMENTOS' as EtapaFechamento, responsavel: '', observacao: '' };
  salvandoModal = false;

  private sub?: Subscription;
  private reqSeq = 0;

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap.get('competencia');
    this.competencia = qp && /^\d{2}\/\d{4}$/.test(qp) ? qp : '';

    this.usuarioService.listar().pipe(catchError(() => of([] as UsuarioResponseDTO[]))).subscribe(us => {
      this.equipe = us.filter(u => u.perfilUsuario === 'ADMIN').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    });

    this.service.competencias().pipe(catchError(() => of([] as CompetenciaDTO[]))).subscribe(cs => {
      this.competencias = cs;
      if (!this.competencia) {
        this.competencia = cs.find(c => c.padrao)?.competencia ?? padraoLocal();
      }
      this.garantirNaLista(this.competencia);
      this.carregar();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // ------------------------------------------------------------ carga

  carregar(): void {
    this.sub?.unsubscribe();
    const seq = ++this.reqSeq;
    this.carregando = true;
    this.erro = '';
    this.sub = this.service.listar(this.competencia).subscribe({
      next: (lista) => {
        if (seq !== this.reqSeq) return;
        this.fechamentos = lista;
        this.carregando = false;
        this.recalcular();
      },
      error: (err) => {
        if (seq !== this.reqSeq) return;
        this.carregando = false;
        this.fechamentos = [];
        this.erro = mensagemErro(err, 'Não foi possível carregar o fechamento.');
        this.recalcular();
        this.toast.error('Erro ao carregar o fechamento', this.erro);
      }
    });
  }

  // ------------------------------------------------------------ competência

  get rotuloCompetencia(): string {
    return this.competencias.find(c => c.competencia === this.competencia)?.rotulo ?? rotuloLocal(this.competencia);
  }

  get prazoCompetencia(): string | null {
    return this.fechamentos.find(f => f.prazo)?.prazo ?? null;
  }

  /** a lista vem do mais recente para o mais antigo */
  get indiceCompetencia(): number {
    return this.competencias.findIndex(c => c.competencia === this.competencia);
  }

  get podeAnterior(): boolean {
    const i = this.indiceCompetencia;
    return i >= 0 && i < this.competencias.length - 1;
  }

  get podeProxima(): boolean {
    return this.indiceCompetencia > 0;
  }

  irPara(delta: number): void {
    const i = this.indiceCompetencia - delta;
    const alvo = this.competencias[i];
    if (alvo) this.trocarCompetencia(alvo.competencia);
  }

  trocarCompetencia(c: string): void {
    if (!c || c === this.competencia && !this.erro) return;
    this.competencia = c;
    this.menuAberto = null;
    this.router.navigate([], { relativeTo: this.route, queryParams: { competencia: c }, queryParamsHandling: 'merge', replaceUrl: true });
    this.carregar();
  }

  private garantirNaLista(c: string): void {
    if (c && !this.competencias.some(x => x.competencia === c)) {
      this.competencias = [...this.competencias, { competencia: c, rotulo: rotuloLocal(c), padrao: false }]
        .sort((a, b) => chave(b.competencia) - chave(a.competencia));
    }
  }

  // ------------------------------------------------------------ resumo (calculado a partir das linhas)

  contarEtapa(e: EtapaFechamento): number {
    return this.fechamentos.filter(f => f.etapa === e).length;
  }

  get concluidos(): number { return this.contarEtapa('CONCLUIDO'); }

  get percentual(): number {
    return this.fechamentos.length ? Math.round(this.concluidos * 100 / this.fechamentos.length) : 0;
  }

  get atrasados(): number { return this.fechamentos.filter(f => f.atrasado).length; }

  get semResponsavel(): number {
    return this.fechamentos.filter(f => !f.idResponsavel && f.etapa !== 'CONCLUIDO').length;
  }

  get meus(): number {
    return this.fechamentos.filter(f => f.idResponsavel === this.meuId && f.etapa !== 'CONCLUIDO').length;
  }

  get filtrosAtivos(): boolean {
    return !!this.busca.trim() || !!this.filtroResp || this.soMeus || this.soAtrasados;
  }

  limparFiltros(): void {
    this.busca = '';
    this.filtroResp = '';
    this.soMeus = false;
    this.soAtrasados = false;
    this.recalcular();
  }

  alternarMeus(): void {
    this.soMeus = !this.soMeus;
    if (this.soMeus) this.filtroResp = '';
    this.recalcular();
  }

  alternarAtrasados(): void {
    this.soAtrasados = !this.soAtrasados;
    this.recalcular();
  }

  aoFiltrarResp(): void {
    if (this.filtroResp) this.soMeus = false;
    this.recalcular();
  }

  // ------------------------------------------------------------ colunas

  recalcular(): void {
    const termo = normalizar(this.busca.trim());
    const termoDig = this.busca.replace(/\D/g, '');
    const filtrados = this.fechamentos.filter(f => {
      if (termo && !normalizar(f.nomeEmpresa).includes(termo) && !(termoDig.length >= 3 && (f.cnpj ?? '').includes(termoDig))) return false;
      if (this.soMeus && f.idResponsavel !== this.meuId) return false;
      if (this.filtroResp === 'nenhum' && f.idResponsavel) return false;
      if (this.filtroResp && this.filtroResp !== 'nenhum' && String(f.idResponsavel) !== this.filtroResp) return false;
      if (this.soAtrasados && !f.atrasado) return false;
      return true;
    });
    this.totalFiltrado = filtrados.length;
    this.colunas = ETAPAS.map(etapa => ({
      etapa,
      cards: filtrados
        .filter(f => f.etapa === etapa.id)
        .sort((a, b) => prioridade(b) - prioridade(a) || a.nomeEmpresa.localeCompare(b.nomeEmpresa, 'pt-BR'))
        .map(f => montarCard(f))
    }));
  }

  trackCard = (_: number, c: Card) => c.f.id;

  // ------------------------------------------------------------ mover (arrastar, menu e teclado)

  aoArrastar(ev: DragEvent, c: Card): void {
    if (this.salvando.has(c.f.id)) { ev.preventDefault(); return; }
    this.arrastandoId = c.f.id;
    this.menuAberto = null;
    ev.dataTransfer?.setData('text/plain', String(c.f.id));
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
  }

  aoFimArrastar(): void {
    this.arrastandoId = null;
    this.colunaAlvo = null;
  }

  aoSobrevoar(ev: DragEvent, etapa: EtapaFechamento): void {
    if (this.arrastandoId == null) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
    this.colunaAlvo = etapa;
  }

  aoSairColuna(ev: DragEvent, etapa: EtapaFechamento): void {
    const destino = ev.relatedTarget as Node | null;
    if (destino && (ev.currentTarget as HTMLElement).contains(destino)) return;
    if (this.colunaAlvo === etapa) this.colunaAlvo = null;
  }

  aoSoltar(ev: DragEvent, etapa: EtapaFechamento): void {
    ev.preventDefault();
    const id = this.arrastandoId ?? Number(ev.dataTransfer?.getData('text/plain'));
    this.aoFimArrastar();
    const f = this.fechamentos.find(x => x.id === id);
    if (f) this.mover(f, etapa);
  }

  /** Shift + ← / → move o card focado para a etapa vizinha; Enter abre a edição. */
  aoTeclar(ev: KeyboardEvent, f: FechamentoMensalDTO): void {
    if (ev.target !== ev.currentTarget) return;
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      this.abrirEdicao(f);
      return;
    }
    if (ev.shiftKey && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) {
      ev.preventDefault();
      const i = ETAPAS.findIndex(e => e.id === f.etapa) + (ev.key === 'ArrowRight' ? 1 : -1);
      if (i >= 0 && i < ETAPAS.length) this.mover(f, ETAPAS[i].id, true);
    }
  }

  alternarMenu(ev: Event, id: number): void {
    ev.stopPropagation();
    this.menuAberto = this.menuAberto === id ? null : id;
    // teclado: leva o foco para a primeira opção disponível do menu
    if (this.menuAberto != null && ev instanceof MouseEvent && ev.detail === 0) {
      setTimeout(() => document.querySelector<HTMLElement>('.fmenu .menu-item:not(:disabled)')?.focus(), 0);
    }
  }

  moverPeloMenu(ev: Event, f: FechamentoMensalDTO, etapa: EtapaFechamento): void {
    ev.stopPropagation();
    this.menuAberto = null;
    this.mover(f, etapa);
  }

  async mover(f: FechamentoMensalDTO, etapa: EtapaFechamento, manterFoco = false): Promise<void> {
    if (f.etapa === etapa || this.salvando.has(f.id)) return;
    if (etapa === 'CONCLUIDO' && !(await this.confirmarConclusao(f))) return;

    const anterior = { ...f };
    const destino = nomeEtapa(etapa);
    // atualização otimista
    this.substituir({ ...f, etapa, atrasado: etapa === 'CONCLUIDO' ? false : (f.diasParaPrazo ?? 0) < 0, concluidoEm: etapa === 'CONCLUIDO' ? new Date().toISOString() : null });
    this.salvando.add(f.id);
    if (manterFoco) this.focarCard(f.id);

    this.service.atualizar(f.id, { etapa }).subscribe({
      next: (atual) => {
        this.salvando.delete(f.id);
        this.substituir(atual);
        if (manterFoco) this.focarCard(f.id);
        this.toast.success(`${f.nomeEmpresa} → ${destino}`,
          etapa === 'CONCLUIDO' ? `Fechamento de ${f.competencia} concluído.` : undefined);
      },
      error: (err) => {
        this.salvando.delete(f.id);
        this.substituir(anterior);
        this.toast.error('Não foi possível mover o card', mensagemErro(err));
      }
    });
  }

  private async confirmarConclusao(f: FechamentoMensalDTO): Promise<boolean> {
    const i = f.indicadores;
    const partes: string[] = [];
    if (i.documentosClientePendentes) partes.push(plural(i.documentosClientePendentes, 'documento do cliente pendente', 'documentos do cliente pendentes'));
    if (i.obrigacoesEscritorioPendentes) partes.push(plural(i.obrigacoesEscritorioPendentes, 'obrigação do escritório em aberto', 'obrigações do escritório em aberto'));
    if (!partes.length) return true;
    return this.confirm.ask({
      titulo: 'Concluir com pendências?',
      mensagem: `${f.nomeEmpresa} ainda tem ${partes.join(' e ')} na competência ${f.competencia}. Deseja concluir o fechamento mesmo assim?`,
      confirmar: 'Concluir mesmo assim'
    });
  }

  private substituir(novo: FechamentoMensalDTO): void {
    this.fechamentos = this.fechamentos.map(x => x.id === novo.id ? novo : x);
    if (this.editando?.id === novo.id) this.editando = novo;
    this.recalcular();
  }

  private focarCard(id: number): void {
    setTimeout(() => document.querySelector<HTMLElement>(`[data-card="${id}"]`)?.focus(), 0);
  }

  // ------------------------------------------------------------ modal de edição

  abrirEdicao(f: FechamentoMensalDTO): void {
    this.menuAberto = null;
    this.editando = f;
    this.form = {
      etapa: f.etapa,
      responsavel: f.idResponsavel ? String(f.idResponsavel) : '',
      observacao: f.observacao ?? ''
    };
    setTimeout(() => document.getElementById('fech-etapa')?.focus(), 50);
  }

  fecharEdicao(): void {
    if (this.salvandoModal) return;
    const id = this.editando?.id;
    this.editando = null;
    if (id) this.focarCard(id);
  }

  get equipeModal(): UsuarioResponseDTO[] {
    // garante que o responsável atual apareça mesmo se não vier na lista
    const f = this.editando;
    if (f?.idResponsavel && !this.equipe.some(u => u.id === f.idResponsavel)) {
      return [...this.equipe, { id: f.idResponsavel, nome: f.nomeResponsavel ?? 'Responsável', email: '', perfilUsuario: 'ADMIN' as any, idEmpresa: 1 }];
    }
    return this.equipe;
  }

  async salvarEdicao(): Promise<void> {
    const f = this.editando;
    if (!f || this.salvandoModal) return;
    const dto: FechamentoUpdateDTO = {};
    if (this.form.etapa !== f.etapa) dto.etapa = this.form.etapa;
    const resp = this.form.responsavel ? Number(this.form.responsavel) : null;
    if (resp !== (f.idResponsavel ?? null)) {
      if (resp) dto.idResponsavel = resp; else dto.removerResponsavel = true;
    }
    const obs = this.form.observacao.trim();
    if (obs !== (f.observacao ?? '')) dto.observacao = obs;

    if (!Object.keys(dto).length) { this.fecharEdicao(); return; }
    if (dto.etapa === 'CONCLUIDO' && !(await this.confirmarConclusao(f))) return;

    this.salvandoModal = true;
    this.service.atualizar(f.id, dto).subscribe({
      next: (atual) => {
        this.salvandoModal = false;
        this.substituir(atual);
        this.editando = null;
        this.focarCard(atual.id);
        this.toast.success('Fechamento atualizado', `${atual.nomeEmpresa} · ${nomeEtapa(atual.etapa)}`);
      },
      error: (err) => {
        this.salvandoModal = false;
        this.toast.error('Não foi possível salvar', mensagemErro(err));
      }
    });
  }

  // ------------------------------------------------------------ eventos globais

  @HostListener('document:click')
  fecharMenu(): void {
    this.menuAberto = null;
  }

  @HostListener('document:keydown.escape')
  aoEsc(): void {
    if (this.confirm.state()) return;
    if (this.menuAberto != null) { this.menuAberto = null; return; }
    if (this.editando) this.fecharEdicao();
  }

  // ------------------------------------------------------------ apoio ao template

  nomeEtapa(e: EtapaFechamento): string { return nomeEtapa(e); }

  primeiroNome(nome: string | null): string {
    return (nome ?? '').replace(/^(Sr\.|Sra\.|Dr\.|Dra\.)\s+/i, '').split(' ')[0] || '—';
  }

  regime(r: string | null): string {
    switch (r) {
      case 'SIMPLES_NACIONAL': return 'Simples Nacional';
      case 'LUCRO_PRESUMIDO': return 'Lucro Presumido';
      case 'LUCRO_REAL': return 'Lucro Real';
      case 'MEI': return 'MEI';
      default: return r ? r.replace(/_/g, ' ').toLowerCase().replace(/^./, s => s.toUpperCase()) : '';
    }
  }
}

// ------------------------------------------------------------ funções puras

function montarCard(f: FechamentoMensalDTO): Card {
  const i = f.indicadores;
  const chips: Chip[] = [];
  if (i.documentosClientePendentes) {
    chips.push({ tom: 'warning', icone: 'file-clock', texto: plural(i.documentosClientePendentes, 'doc do cliente pendente', 'docs do cliente pendentes'),
      titulo: `${i.documentosClientePendentes} de ${i.documentosClienteTotal} documento(s) que o cliente precisa enviar` });
  } else if (i.documentosClienteTotal) {
    chips.push({ tom: 'success', icone: 'file-check', texto: 'Documentos recebidos', titulo: 'O cliente enviou todos os documentos da competência' });
  }
  if (i.obrigacoesVencidas) {
    chips.push({ tom: 'danger', icone: 'alert-triangle', texto: plural(i.obrigacoesVencidas, 'vencida', 'vencidas'), titulo: 'Obrigações com vencimento já passado' });
  }
  if (i.obrigacoesEscritorioEntregues) {
    chips.push({ tom: 'primary', icone: 'receipt', texto: plural(i.obrigacoesEscritorioEntregues, 'guia emitida', 'guias emitidas'),
      titulo: `${i.obrigacoesEscritorioEntregues} de ${i.obrigacoesEscritorioTotal} guia(s)/declaração(ões) do escritório entregue(s)` });
  }
  if (i.guiasPagamentoAtrasado) {
    chips.push({ tom: 'danger', icone: 'banknote', texto: plural(i.guiasPagamentoAtrasado, 'pagamento atrasado', 'pagamentos atrasados'), titulo: 'Guias vencidas sem pagamento confirmado' });
  }
  const aguardando = i.guiasAguardandoPagamento - i.guiasPagamentoAtrasado;
  if (aguardando > 0) {
    chips.push({ tom: 'info', icone: 'banknote', texto: `${aguardando} aguardando pagamento`, titulo: 'Guias entregues aguardando o pagamento do cliente' });
  }
  const total = i.documentosClienteTotal + i.obrigacoesEscritorioTotal;
  const feitas = (i.documentosClienteTotal - i.documentosClientePendentes) + i.obrigacoesEscritorioEntregues;
  return { f, chips, feitas, total, pct: total ? Math.round(feitas * 100 / total) : 0 };
}

/** atrasados primeiro, depois quem tem mais pendências */
function prioridade(f: FechamentoMensalDTO): number {
  const i = f.indicadores;
  return (f.atrasado ? 1000 : 0) + i.obrigacoesVencidas * 10 + i.documentosClientePendentes + i.obrigacoesEscritorioPendentes;
}

function nomeEtapa(e: EtapaFechamento): string {
  return ETAPAS.find(x => x.id === e)?.nome ?? e;
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

function normalizar(s: string): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function chave(c: string): number {
  const [m, a] = c.split('/').map(Number);
  return a * 12 + m;
}

function padraoLocal(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function rotuloLocal(c: string): string {
  const [m, a] = (c ?? '').split('/');
  const mes = MESES[Number(m) - 1];
  return mes ? `${mes} de ${a}` : c;
}

function mensagemErro(err: any, padrao = 'Tente novamente em instantes.'): string {
  if (err?.status === 0) return 'Sem conexão com o servidor.';
  if (err?.status === 403) return 'Apenas o escritório pode alterar o fechamento.';
  return err?.error?.mensagem || err?.error?.message || (typeof err?.error === 'string' && err.error.length < 200 ? err.error : '') || padrao;
}
