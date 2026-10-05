import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { AvatarCorPipe, BytesPipe, IniciaisPipe, PrazoPipe, PrazoTomPipe, diasAte } from '../../pipes/formatos.pipe';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/ui/toast.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { ArquivoService } from '../../services/arquivo.service';
import { PastaService } from '../../services/pasta.service';
import { EmpresaService } from '../../services/empresa.service';
import { AuthService } from '../../services/auth.service';
import { ArquivoResponseDTO } from '../../models/arquivo-response.dto';
import { PastaResponseDTO } from '../../models/pasta-response.dto';
import { EmpresaResponseDTO } from '../../models/empresa-response.dto';
import { PastaRequestDTO } from '../../models/pasta-request.dto';
import { StatusArquivo, StatusArquivoLabel } from '../../models/enums/status-arquivo.enum';
import { CategoriaFiscal, CategoriaFiscalLabel } from '../../models/enums/categoria-fiscal.enum';
import { ArquivoFormComponent } from '../arquivo/arquivo-form/arquivo-form.component';
import { PaginadorComponent, paginar } from '../../shared/ui/paginador.component';
import { GrupoTipo, grupoTipo, mostraPrazo, tempoDe, tomStatus, visualTipo, VisualTipo } from './tipo-arquivo.util';
import { ArquivoDetalheComponent } from './arquivo-detalhe/arquivo-detalhe.component';
import { MoverDialogComponent, OpcaoDestino } from './mover-dialog/mover-dialog.component';
import { ContextMenuComponent } from './context-menu/context-menu.component';
import { DriveArquivoCardComponent } from './drive-arquivo-card/drive-arquivo-card.component';
import { DragPasta, DriveSidebarComponent, SecaoDrive } from './drive-sidebar/drive-sidebar.component';
import { DriveFiltrosComponent, FiltroModificado, Visao } from './drive-filtros/drive-filtros.component';
import { DrivePastaInfoComponent } from './drive-pasta-info/drive-pasta-info.component';
import { DriveBuscaComponent } from './drive-busca/drive-busca.component';
import { DriveLixeiraComponent } from './drive-lixeira/drive-lixeira.component';

type Crumb = { id: number | null; nome: string };
type Ordem = 'nome' | 'modificado' | 'vencimento' | 'tamanho' | 'status';
type AlvoMenu =
  | { tipo: 'arq'; id: number } | { tipo: 'pasta'; id: number } | { tipo: 'multi' }
  | { tipo: 'crumb' } | { tipo: 'fundo' } | { tipo: 'ordem' } | { tipo: 'novo' };
type MenuAberto = AlvoMenu & { x: number; y: number; yAcima: number; direita: boolean };
type InfoPainel = {
  titulo: string; icone: string; caminho: string; descricao: string; nPastas: number | null;
  nArquivos: number; bytes: number; acoes: boolean; ehRaiz: boolean; idPasta: number | null;
};

const VISAO_KEY = 'diniz.arquivos.visao';
const PAINEL_KEY = 'diniz.arquivos.painel';
const ORDEM_STATUS: Record<string, number> = { VENCIDO: 0, PENDENTE: 1, ENTREGUE: 2, ARQUIVADO: 3 };
const COLLATOR = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
/** Largura mínima da área de arquivos para o painel ⓘ ficar embutido (abaixo disso vira gaveta). */
const LARGURA_PAINEL = 1000;
const DIAS_VENCENDO = 30;
const SECOES_URL: SecaoDrive[] = ['recentes', 'vencendo', 'lixeira'];

export const ORDEM_OPCOES: { valor: Ordem; label: string }[] = [
  { valor: 'nome', label: 'Nome' },
  { valor: 'modificado', label: 'Modificado' },
  { valor: 'vencimento', label: 'Vencimento' },
  { valor: 'status', label: 'Status' },
  { valor: 'tamanho', label: 'Tamanho' },
];

@Component({
  selector: 'app-explorer',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, ArquivoFormComponent, ArquivoDetalheComponent, MoverDialogComponent, PaginadorComponent,
    IconComponent, BytesPipe, PrazoPipe, PrazoTomPipe, IniciaisPipe, AvatarCorPipe, ContextMenuComponent, DriveArquivoCardComponent,
    DriveSidebarComponent, DriveFiltrosComponent, DrivePastaInfoComponent, DriveBuscaComponent, DriveLixeiraComponent
  ],
  templateUrl: './explorer.component.html',
  styleUrl: './explorer.component.css'
})
export class ExplorerComponent implements OnInit, AfterViewInit, OnDestroy {

  private arquivoService = inject(ArquivoService);
  private pastaService = inject(PastaService);
  private empresaService = inject(EmpresaService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private zone = inject(NgZone);

  @ViewChild('driveEl') driveEl?: ElementRef<HTMLElement>;
  @ViewChild(ArquivoFormComponent) uploadForm?: ArquivoFormComponent;

  empresas: EmpresaResponseDTO[] = [];
  pastas: PastaResponseDTO[] = [];
  arquivos: ArquivoResponseDTO[] = [];

  idEmpresaSelecionada: number | null = null;
  secao: SecaoDrive = 'pasta';
  pastaAtualId: number | null = null;
  breadcrumb: Crumb[] = [];

  carregando = true;
  isAdmin = false;

  readonly statusLabel = StatusArquivoLabel;
  readonly categoriaLabel = CategoriaFiscalLabel;
  readonly ordemOpcoes = ORDEM_OPCOES;
  readonly skeletons = [1, 2, 3, 4, 5, 6];
  readonly porPaginaOpcoes = [24, 48, 96];

  // ================= BUSCA / FILTROS / VISÃO =================
  termoBusca = '';
  filtroTipo: GrupoTipo | '' = '';
  filtroStatus: StatusArquivo | '' = '';
  filtroCategoria: CategoriaFiscal | '' = '';
  filtroModificado: FiltroModificado = '';
  visao: Visao = 'grade';
  ordem: Ordem = 'nome';
  ordemAsc = true;
  pagina = 1;
  porPagina = 24;
  private ultimoQ: string | null = null;

  // ================= PAINEL ⓘ / GAVETA LATERAL =================
  painelAberto = false;
  /** Há espaço para o painel embutido (medido pelo ResizeObserver). */
  painelInline = false;
  /** Pasta mostrada no painel via "Detalhes" (sem arquivo em foco). */
  pastaFocoId: number | null = null;
  /** Coluna de pastas aberta como gaveta (< 900px). */
  sidebarAberta = false;

  // ================= DRAG & DROP =================
  arquivoArrastadoId: number | null = null;
  private arrastandoIds: number[] = [];
  dropTargetId: number | 'raiz' | null = null;
  arrastandoExterno = false;
  private profundidadeDrag = 0;

  // ================= UPLOAD =================
  uploadAberto = false;
  uploadArquivos: File[] = [];
  uploadPastaId: number | null = null;

  // ================= PASTA (nova / renomear) =================
  pastaModal: { modo: 'nova' | 'renomear'; pasta?: PastaResponseDTO; idPai: number | null } | null = null;
  pastaNome = '';
  pastaDescricao = '';
  salvandoPasta = false;

  // ================= MENU CONTEXTUAL =================
  menu: MenuAberto | null = null;

  // ================= SELEÇÃO / AÇÕES EM MASSA =================
  arquivosSelecionados = new Set<number>();
  private ancoraId: number | null = null;
  baixandoEmMassa = false;
  deletando = false;

  // ================= MOVER =================
  moverIds: number[] | null = null;
  movendo = false;
  pastasOrigemMover = new Set<number>();

  // ================= VISUALIZAÇÃO (gaveta grande) =================
  arquivoDetalhe: ArquivoResponseDTO | null = null;

  private idParaAbrir: number | null = null;
  private tentouTrocarEmpresa = false;
  private abrirUploadAoCarregar = false;
  private sub?: Subscription;
  private ro?: ResizeObserver;
  /** Esc que fechou o diálogo de confirmação global não deve fechar também o painel. */
  private escComConfirm = false;
  private capturaEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') this.escComConfirm = !!this.confirm.state(); };

  constructor() {
    document.addEventListener('keydown', this.capturaEsc, true);
  }

  // ================= CICLO DE VIDA =================

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    try {
      const v = localStorage.getItem(VISAO_KEY);
      if (v === 'grade' || v === 'lista') this.visao = v;
      const p = localStorage.getItem(PAINEL_KEY);
      if (p === '0' || p === '1') this.painelAberto = p === '1';
    } catch { /* storage indisponível */ }

    this.sub = this.route.queryParamMap.subscribe(p => {
      // ?secao=recentes|vencendo|lixeira (links, voltar/avançar do navegador)
      const sp = p.get('secao') as SecaoDrive | null;
      const alvo: SecaoDrive = sp && SECOES_URL.includes(sp) ? sp : 'pasta';
      if (alvo !== this.secao && !(alvo === 'pasta' && p.get('q'))) this.aplicarSecao(alvo);
      const q = p.get('q');
      if (q !== this.ultimoQ) {
        this.ultimoQ = q;
        this.termoBusca = q ?? '';
        if (q && this.secao !== 'pasta') { this.aplicarSecao('pasta'); this.escreverSecaoUrl('pasta'); }
        this.pagina = 1;
        this.limparSelecao();
      }
      const id = Number(p.get('id'));
      if (id) {
        this.idParaAbrir = id;
        this.tentouTrocarEmpresa = false;
        if (!this.carregando) this.abrirPendente();
      }
      if (p.get('upload')) {
        if (this.carregando) this.abrirUploadAoCarregar = true;
        else this.abrirUpload();
      }
    });

    this.empresaService.listar().subscribe({
      next: (empresas) => {
        this.empresas = empresas;
        if (!this.isAdmin) {
          this.idEmpresaSelecionada = this.authService.getEmpresaId();
        } else if (empresas.length > 0) {
          this.idEmpresaSelecionada = empresas[0].id!;
        }
        this.carregarDadosEmpresa();
      },
      error: () => {
        this.carregando = false;
        this.toast.error('Não foi possível carregar as empresas', 'Verifique sua conexão e tente novamente.');
      }
    });
  }

  ngAfterViewInit(): void {
    const el = this.driveEl?.nativeElement;
    if (!el || typeof ResizeObserver === 'undefined') return;
    this.ro = new ResizeObserver(entries => {
      const largo = (entries[0]?.contentRect.width ?? 0) >= LARGURA_PAINEL;
      if (largo !== this.painelInline) this.zone.run(() => { this.painelInline = largo; });
    });
    this.ro.observe(el);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.ro?.disconnect();
    document.removeEventListener('keydown', this.capturaEsc, true);
  }

  /** Carrega pastas e arquivos da empresa. `manterPasta` = atualização silenciosa sem voltar à raiz. */
  carregarDadosEmpresa(manterPasta = false): void {
    if (!this.idEmpresaSelecionada) {
      this.pastas = [];
      this.arquivos = [];
      this.carregando = false;
      return;
    }

    if (!manterPasta) {
      this.carregando = true;
      this.pastaAtualId = null;
      this.breadcrumb = [];
      this.pastaFocoId = null;
    }

    let falhou = false;
    const idEmpresa = this.idEmpresaSelecionada;
    forkJoin({
      pastas: this.pastaService.buscarPorEmpresa(idEmpresa).pipe(catchError(() => { falhou = true; return of([] as PastaResponseDTO[]); })),
      arquivos: this.arquivoService.buscarPorEmpresa(idEmpresa).pipe(catchError(() => { falhou = true; return of([] as ArquivoResponseDTO[]); }))
    }).subscribe(({ pastas, arquivos }) => {
      if (idEmpresa !== this.idEmpresaSelecionada) return;
      this.pastas = pastas;
      this.arquivos = arquivos.filter(x => !x.excluidoEm);
      this.carregando = false;
      if (falhou) this.toast.error('Erro ao carregar arquivos', 'Alguns dados não puderam ser carregados.');

      if (manterPasta && this.pastaAtualId != null && this.pastas.some(p => p.id === this.pastaAtualId)) {
        this.rebuildBreadcrumb();
      } else if (manterPasta) {
        this.pastaAtualId = null;
        this.breadcrumb = [];
      }
      if (this.pastaFocoId != null && !this.pastas.some(p => p.id === this.pastaFocoId)) this.pastaFocoId = null;
      const existentes = new Set(this.arquivos.map(a => a.id));
      if ([...this.arquivosSelecionados].some(id => !existentes.has(id))) {
        this.arquivosSelecionados = new Set([...this.arquivosSelecionados].filter(id => existentes.has(id)));
      }
      if (this.arquivoDetalhe) {
        const atual = this.arquivos.find(a => a.id === this.arquivoDetalhe!.id);
        if (atual) this.arquivoDetalhe = atual; else this.fecharDetalhe();
      }
      this.abrirPendente();
      if (this.abrirUploadAoCarregar) {
        this.abrirUploadAoCarregar = false;
        this.abrirUpload();
      }
    });
  }

  onEmpresaChange(): void {
    this.limparSelecao();
    this.fecharDetalhe();
    this.carregarDadosEmpresa();
  }

  /** Abre o arquivo pedido via ?id= (topbar, notificações, dashboard): vai até a pasta e mostra os detalhes. */
  private abrirPendente(): void {
    const id = this.idParaAbrir;
    if (!id) return;
    const arq = this.arquivos.find(a => a.id === id);
    if (arq) {
      this.idParaAbrir = null;
      this.limparFiltros(false);
      this.mudarSecao('pasta');
      this.pastaAtualId = arq.idPasta ?? null;
      this.rebuildBreadcrumb();
      this.pastaFocoId = null;
      this.arquivosSelecionados = new Set([arq.id]);
      this.ancoraId = arq.id;
      const idx = this.arquivosAtuais().findIndex(a => a.id === arq.id);
      this.pagina = idx >= 0 ? Math.floor(idx / this.porPagina) + 1 : 1;
      if (this.painelInline) this.definirPainel(true);
      else this.arquivoDetalhe = arq;
      this.rolarAte(arq.id);
      this.router.navigate([], { relativeTo: this.route, queryParams: { id: null, secao: null }, queryParamsHandling: 'merge', replaceUrl: true });
      return;
    }
    if (!this.isAdmin || this.tentouTrocarEmpresa) {
      this.idParaAbrir = null;
      this.toast.warning('Arquivo não encontrado', 'Ele pode ter sido movido para a lixeira ou excluído.');
      return;
    }
    this.tentouTrocarEmpresa = true;
    this.arquivoService.buscarPorId(id).subscribe({
      next: (a) => {
        if (a.excluidoEm) {
          this.idParaAbrir = null;
          this.toast.warning('Arquivo na lixeira', `"${a.nomeOriginal}" está na lixeira. Restaure-o para abrir.`);
          return;
        }
        if (a.idEmpresa !== this.idEmpresaSelecionada) {
          this.idEmpresaSelecionada = a.idEmpresa;
          this.carregarDadosEmpresa();
        } else {
          this.idParaAbrir = null;
        }
      },
      error: () => {
        this.idParaAbrir = null;
        this.toast.error('Arquivo não encontrado');
      }
    });
  }

  private rolarAte(id: number): void {
    setTimeout(() => document.querySelector(`[data-arq="${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
  }

  // ================= VISÃO (memoizada) =================

  private cacheRef: unknown[] = [];
  private cacheKey = '';
  private cache = {
    pastas: [] as PastaResponseDTO[],
    arquivos: [] as ArquivoResponseDTO[],
    contagemStatus: {} as Record<string, number>,
    contagemTipo: {} as Record<string, number>,
  };
  private estruturaRef: unknown[] = [];
  private estrutura = {
    contagem: new Map<number, { arquivos: number; pastas: number; bytes: number; arquivosRec: number }>(),
    caminho: new Map<number, string>(),
    destinos: [] as OpcaoDestino[],
    totalBytes: 0,
    qtdVencendo: 0,
    temVencido: false,
    recentes: [] as ArquivoResponseDTO[],
  };

  get filtrosAtivos(): boolean {
    return !!this.termoBusca.trim() || !!this.filtroTipo || !!this.filtroStatus || !!this.filtroCategoria || !!this.filtroModificado;
  }

  /** Busca/filtros em "Meus arquivos" procuram em todas as pastas da empresa. */
  get emResultados(): boolean { return this.secao === 'pasta' && this.filtrosAtivos; }

  /** Mostra o caminho da pasta em cada arquivo (resultados, Recentes, Vencendo). */
  get mostrarCaminho(): boolean { return this.secao !== 'pasta' || this.emResultados; }

  private limiteModificado(): number {
    if (!this.filtroModificado) return 0;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    switch (this.filtroModificado) {
      case '7d': d.setDate(d.getDate() - 6); break;
      case '30d': d.setDate(d.getDate() - 29); break;
      case 'ano': d.setMonth(0, 1); break;
    }
    return d.getTime();
  }

  private ehVencendo(a: ArquivoResponseDTO): boolean {
    if (!mostraPrazo(a)) return false;
    const dias = a.diasParaVencer ?? diasAte(a.dataVencimento);
    return dias != null && dias <= DIAS_VENCENDO;
  }

  private visaoAtual() {
    const key = [this.termoBusca.trim().toLowerCase(), this.filtroTipo, this.filtroStatus, this.filtroCategoria, this.filtroModificado,
      this.secao, this.pastaAtualId, this.ordem, this.ordemAsc].join('|');
    if (key === this.cacheKey && this.cacheRef[0] === this.arquivos && this.cacheRef[1] === this.pastas) return this.cache;

    const termo = this.termoBusca.trim().toLowerCase();
    const limite = this.limiteModificado();
    const casaTermo = (a: ArquivoResponseDTO) => !termo
      || a.nomeOriginal.toLowerCase().includes(termo)
      || (a.descricao?.toLowerCase().includes(termo) ?? false)
      || (a.nomeUsuario?.toLowerCase().includes(termo) ?? false)
      || (a.categoriaFiscal ? this.categoriaLabel[a.categoriaFiscal].toLowerCase().includes(termo) : false);

    let base: ArquivoResponseDTO[];
    if (this.secao === 'lixeira') base = [];
    else if (this.secao === 'recentes' || this.emResultados) base = this.arquivos;
    else if (this.secao === 'vencendo') base = this.arquivos.filter(a => this.ehVencendo(a));
    else base = this.arquivos.filter(a => (a.idPasta ?? null) === this.pastaAtualId);

    const casaPre = (a: ArquivoResponseDTO) => casaTermo(a)
      && (!this.filtroCategoria || a.categoriaFiscal === this.filtroCategoria)
      && (!limite || tempoDe(a.dataCriacao) >= limite);
    const pre = base.filter(casaPre);
    // Em "Meus arquivos" os filtros procuram em todas as pastas: as contagens dos menus refletem a empresa toda.
    const preContagem = this.secao === 'pasta' && !this.emResultados ? this.arquivos.filter(casaPre) : pre;
    const tipoOk = (a: ArquivoResponseDTO) => !this.filtroTipo || grupoTipo(a.nomeOriginal, a.tipoArquivo) === this.filtroTipo;
    const statusOk = (a: ArquivoResponseDTO) => !this.filtroStatus || a.status === this.filtroStatus;

    const contagemStatus: Record<string, number> = {};
    const contagemTipo: Record<string, number> = {};
    for (const a of preContagem) {
      if (a.status && tipoOk(a)) contagemStatus[a.status] = (contagemStatus[a.status] ?? 0) + 1;
      if (statusOk(a)) { const g = grupoTipo(a.nomeOriginal, a.tipoArquivo); contagemTipo[g] = (contagemTipo[g] ?? 0) + 1; }
    }
    let arquivos = pre.filter(a => tipoOk(a) && statusOk(a));

    let pastas: PastaResponseDTO[] = [];
    if (this.secao === 'pasta' && !this.emResultados) {
      pastas = this.pastas.filter(p => (p.idPastaPai ?? null) === this.pastaAtualId);
    } else if (this.emResultados && termo && !this.filtroTipo && !this.filtroStatus && !this.filtroCategoria && !this.filtroModificado) {
      pastas = this.pastas.filter(p => p.nome.toLowerCase().includes(termo) || (p.descricao?.toLowerCase().includes(termo) ?? false));
    }

    pastas = [...pastas].sort((a, b) => COLLATOR.compare(a.nome, b.nome));
    arquivos = [...arquivos].sort((a, b) => this.comparar(a, b));

    this.cache = { pastas, arquivos, contagemStatus, contagemTipo };
    this.cacheKey = key;
    this.cacheRef = [this.arquivos, this.pastas];
    return this.cache;
  }

  private comparar(a: ArquivoResponseDTO, b: ArquivoResponseDTO): number {
    const dir = this.ordemAsc ? 1 : -1;
    switch (this.ordem) {
      case 'modificado': {
        const d = tempoDe(a.dataCriacao) - tempoDe(b.dataCriacao);
        if (d) return d * dir;
        break;
      }
      case 'vencimento': {
        if (!a.dataVencimento && !b.dataVencimento) break;
        if (!a.dataVencimento) return 1;
        if (!b.dataVencimento) return -1;
        const d = a.dataVencimento.localeCompare(b.dataVencimento);
        if (d) return d * dir;
        break;
      }
      case 'tamanho': return ((a.tamanho ?? 0) - (b.tamanho ?? 0)) * dir;
      case 'status': {
        const d = (ORDEM_STATUS[a.status ?? ''] ?? 9) - (ORDEM_STATUS[b.status ?? ''] ?? 9);
        if (d) return d * dir;
        break;
      }
    }
    return COLLATOR.compare(a.nomeOriginal, b.nomeOriginal) * (this.ordem === 'nome' ? dir : 1);
  }

  private estruturaAtual() {
    if (this.estruturaRef[0] === this.arquivos && this.estruturaRef[1] === this.pastas) return this.estrutura;
    const contagem = new Map<number, { arquivos: number; pastas: number; bytes: number; arquivosRec: number }>();
    const get = (id: number) => {
      let c = contagem.get(id);
      if (!c) { c = { arquivos: 0, pastas: 0, bytes: 0, arquivosRec: 0 }; contagem.set(id, c); }
      return c;
    };
    const porId = new Map(this.pastas.map(p => [p.id, p]));
    let totalBytes = 0, qtdVencendo = 0, temVencido = false;
    for (const a of this.arquivos) {
      totalBytes += a.tamanho ?? 0;
      if (this.ehVencendo(a)) {
        qtdVencendo++;
        const dias = a.diasParaVencer ?? diasAte(a.dataVencimento);
        if (dias != null && dias < 0) temVencido = true;
      }
      if (a.idPasta == null) continue;
      get(a.idPasta).arquivos++;
      let p: PastaResponseDTO | undefined = porId.get(a.idPasta);
      let guarda = 0;
      while (p && guarda++ < 50) {
        const c = get(p.id);
        c.bytes += a.tamanho ?? 0;
        c.arquivosRec++;
        p = p.idPastaPai != null ? porId.get(p.idPastaPai) : undefined;
      }
    }
    for (const p of this.pastas) if (p.idPastaPai != null) get(p.idPastaPai).pastas++;

    const caminho = new Map<number, string>();
    for (const p of this.pastas) {
      const partes: string[] = [];
      let atual: PastaResponseDTO | undefined = p;
      let guarda = 0;
      while (atual && guarda++ < 50) {
        partes.unshift(atual.nome);
        atual = atual.idPastaPai != null ? porId.get(atual.idPastaPai) : undefined;
      }
      caminho.set(p.id, partes.join(' / '));
    }

    const destinos: OpcaoDestino[] = [];
    const filhos = (pai: number | null) => this.pastas
      .filter(p => (p.idPastaPai ?? null) === pai)
      .sort((a, b) => COLLATOR.compare(a.nome, b.nome));
    const visitar = (pai: number | null, nivel: number) => {
      if (nivel > 20) return;
      for (const p of filhos(pai)) { destinos.push({ id: p.id, nome: p.nome, nivel }); visitar(p.id, nivel + 1); }
    };
    visitar(null, 0);

    const recentes = [...this.arquivos].sort((a, b) => tempoDe(b.dataCriacao) - tempoDe(a.dataCriacao) || b.id - a.id).slice(0, 4);

    this.estrutura = { contagem, caminho, destinos, totalBytes, qtdVencendo, temVencido, recentes };
    this.estruturaRef = [this.arquivos, this.pastas];
    return this.estrutura;
  }

  pastasAtuais(): PastaResponseDTO[] { return this.visaoAtual().pastas; }
  arquivosAtuais(): ArquivoResponseDTO[] { return this.visaoAtual().arquivos; }
  get contagemStatus(): Record<string, number> { return this.visaoAtual().contagemStatus; }
  get contagemTipo(): Record<string, number> { return this.visaoAtual().contagemTipo; }
  get totalBytes(): number { return this.estruturaAtual().totalBytes; }
  get qtdVencendo(): number { return this.estruturaAtual().qtdVencendo; }
  get temVencido(): boolean { return this.estruturaAtual().temVencido; }

  /** "Sugeridos": na raiz de Meus arquivos, sem filtros. */
  get sugeridos(): ArquivoResponseDTO[] {
    if (this.secao !== 'pasta' || this.pastaAtualId !== null || this.filtrosAtivos) return [];
    return this.estruturaAtual().recentes;
  }

  /** Página efetiva (corrigida quando um filtro reduz o total) — mesma regra do <app-paginador>. */
  get paginaEfetiva(): number {
    const total = Math.max(1, Math.ceil(this.arquivosAtuais().length / this.porPagina));
    return Math.min(Math.max(1, this.pagina), total);
  }

  arquivosPagina(): ArquivoResponseDTO[] {
    return paginar(this.arquivosAtuais(), this.pagina, this.porPagina);
  }

  get mostrarPaginacao(): boolean { return this.arquivosAtuais().length > this.porPaginaOpcoes[0]; }

  contagemPasta(id: number) {
    return this.estruturaAtual().contagem.get(id) ?? { arquivos: 0, pastas: 0, bytes: 0, arquivosRec: 0 };
  }

  caminhoPasta(id: number | null | undefined): string {
    if (id == null) return 'Meus arquivos';
    return this.estruturaAtual().caminho.get(id) ?? '—';
  }

  get opcoesDestino(): OpcaoDestino[] { return this.estruturaAtual().destinos; }

  get nomeEmpresaAtual(): string {
    return this.empresas.find(e => e.id === this.idEmpresaSelecionada)?.nomeFantasia ?? '';
  }

  get pastaAtual(): PastaResponseDTO | undefined {
    return this.pastas.find(p => p.id === this.pastaAtualId);
  }

  /** Pasta usada como destino de "Nova pasta"/"Enviar" a partir do contexto atual. */
  private get pastaContexto(): number | null {
    return this.secao === 'pasta' && !this.emResultados ? this.pastaAtualId : null;
  }

  get pastaContextoNome(): string {
    const id = this.pastaContexto;
    return id == null ? '' : (this.pastas.find(p => p.id === id)?.nome ?? '');
  }

  get tituloSecao(): string {
    if (this.secao === 'recentes') return 'Recentes';
    if (this.secao === 'vencendo') return 'Vencendo';
    if (this.secao === 'lixeira') return 'Lixeira';
    return 'Resultados da pesquisa';
  }

  // ================= PAINEL ⓘ =================

  get mostrarPainel(): boolean { return this.painelInline && this.painelAberto && !!this.idEmpresaSelecionada && this.secao !== 'lixeira'; }

  /** Arquivo mostrado no painel: o único selecionado. */
  get arquivoPainel(): ArquivoResponseDTO | null {
    if (this.arquivosSelecionados.size !== 1) return null;
    const [id] = this.arquivosSelecionados;
    return this.arquivos.find(a => a.id === id) ?? null;
  }

  get bytesSelecionados(): number {
    let t = 0;
    for (const a of this.arquivos) if (this.arquivosSelecionados.has(a.id)) t += a.tamanho ?? 0;
    return t;
  }

  get infoPainel(): InfoPainel {
    const pasta = this.pastaFocoId != null ? this.pastas.find(p => p.id === this.pastaFocoId) : undefined;
    if (pasta) return this.infoDePasta(pasta);
    if (this.secao !== 'pasta' || this.emResultados) {
      const lista = this.arquivosAtuais();
      return {
        titulo: this.tituloSecao, icone: this.secao === 'recentes' ? 'clock' : this.secao === 'vencendo' ? 'calendar-clock' : 'search',
        caminho: '', descricao: this.secao === 'vencendo' ? `Documentos vencidos ou com prazo nos próximos ${DIAS_VENCENDO} dias, ainda não entregues.` : '',
        nPastas: null, nArquivos: lista.length, bytes: lista.reduce((s, a) => s + (a.tamanho ?? 0), 0), acoes: false, ehRaiz: true, idPasta: null
      };
    }
    const atual = this.pastaAtual;
    if (atual) return this.infoDePasta(atual);
    return {
      titulo: 'Meus arquivos', icone: 'hard-drive', caminho: '', descricao: '', nPastas: this.pastas.filter(p => p.idPastaPai == null).length,
      nArquivos: this.arquivos.length, bytes: this.totalBytes, acoes: true, ehRaiz: true, idPasta: null
    };
  }

  private infoDePasta(p: PastaResponseDTO): InfoPainel {
    const c = this.contagemPasta(p.id);
    return {
      titulo: p.nome, icone: 'folder', caminho: this.caminhoPasta(p.idPastaPai), descricao: p.descricao ?? '',
      nPastas: c.pastas, nArquivos: c.arquivosRec, bytes: c.bytes, acoes: true, ehRaiz: false, idPasta: p.id
    };
  }

  definirPainel(aberto: boolean): void {
    this.painelAberto = aberto;
    try { localStorage.setItem(PAINEL_KEY, aberto ? '1' : '0'); } catch { /* storage indisponível */ }
  }

  togglePainel(): void { this.definirPainel(!this.painelAberto); }

  /** "Detalhes" (menu): painel embutido quando cabe, senão a gaveta. */
  verDetalhes(arquivo: ArquivoResponseDTO): void {
    this.menu = null;
    this.pastaFocoId = null;
    this.arquivosSelecionados = new Set([arquivo.id]);
    this.ancoraId = arquivo.id;
    if (this.painelInline) this.definirPainel(true);
    else this.arquivoDetalhe = arquivo;
  }

  verDetalhesPasta(pasta: PastaResponseDTO): void {
    this.menu = null;
    this.limparSelecao();
    this.pastaFocoId = pasta.id;
    this.definirPainel(true);
  }

  // ================= FILTROS / VISÃO =================

  onBuscaChange(): void { this.pagina = 1; this.limparSelecao(); this.pastaFocoId = null; }

  limparBusca(): void {
    this.termoBusca = '';
    this.onBuscaChange();
    this.limparQueryQ();
  }

  setTipo(t: GrupoTipo | ''): void { this.filtroTipo = t; this.onBuscaChange(); }
  setStatus(s: StatusArquivo | ''): void { this.filtroStatus = s; this.onBuscaChange(); }
  setCategoria(c: CategoriaFiscal | ''): void { this.filtroCategoria = c; this.onBuscaChange(); }
  setModificado(m: FiltroModificado): void { this.filtroModificado = m; this.onBuscaChange(); }

  limparFiltros(limparUrl = true): void {
    this.termoBusca = '';
    this.filtroTipo = '';
    this.filtroStatus = '';
    this.filtroCategoria = '';
    this.filtroModificado = '';
    this.pagina = 1;
    if (limparUrl) this.limparQueryQ();
  }

  private limparQueryQ(): void {
    if (this.ultimoQ != null) {
      this.router.navigate([], { relativeTo: this.route, queryParams: { q: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  setVisao(v: Visao): void {
    this.visao = v;
    try { localStorage.setItem(VISAO_KEY, v); } catch { /* storage indisponível */ }
  }

  ordenarPor(campo: Ordem): void {
    if (this.ordem === campo) this.ordemAsc = !this.ordemAsc;
    else { this.ordem = campo; this.ordemAsc = campo === 'nome' || campo === 'vencimento' || campo === 'status'; }
    this.pagina = 1;
  }

  escolherOrdem(campo: Ordem): void {
    this.menu = null;
    if (this.ordem !== campo) this.ordenarPor(campo);
  }

  inverterOrdem(): void { this.ordemAsc = !this.ordemAsc; this.pagina = 1; }

  get rotuloOrdem(): string { return ORDEM_OPCOES.find(o => o.valor === this.ordem)?.label ?? 'Nome'; }

  ariaSort(campo: Ordem): string | null {
    return this.ordem === campo ? (this.ordemAsc ? 'ascending' : 'descending') : null;
  }

  iconeOrdem(campo: Ordem): string {
    return this.ordem === campo ? (this.ordemAsc ? 'arrow-up' : 'arrow-down') : 'chevrons-up-down';
  }

  private ordemPadrao(): void {
    if (this.secao === 'recentes') { this.ordem = 'modificado'; this.ordemAsc = false; }
    else if (this.secao === 'vencendo') { this.ordem = 'vencimento'; this.ordemAsc = true; }
    else { this.ordem = 'nome'; this.ordemAsc = true; }
  }

  // ================= NAVEGAÇÃO =================

  private mudarSecao(s: SecaoDrive): void {
    if (this.secao === s) return;
    this.secao = s;
    this.ordemPadrao();
  }

  irSecao(s: SecaoDrive): void {
    this.aplicarSecao(s);
    this.escreverSecaoUrl(s);
  }

  /** Reflete a seção na URL (/arquivos?secao=lixeira) para poder ser compartilhada e para o botão Voltar. */
  private escreverSecaoUrl(s: SecaoDrive): void {
    const qp = this.route.snapshot.queryParamMap;
    const novo = s === 'pasta' ? null : s;
    if (qp.get('secao') === novo) return;
    const params: Record<string, string | null> = { secao: novo };
    if (!this.termoBusca.trim()) params['q'] = null;
    this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: 'merge' });
  }

  private aplicarSecao(s: SecaoDrive): void {
    if (this.filtrosAtivos) this.limparFiltros();
    this.mudarSecao(s);
    this.pastaAtualId = null;
    this.breadcrumb = [];
    this.limparSelecao();
    this.pastaFocoId = null;
    this.pagina = 1;
    this.menu = null;
  }

  entrarPasta(pasta: PastaResponseDTO): void { this.irPara(pasta.id!); }

  irPara(id: number | null): void {
    if (this.filtrosAtivos) this.limparFiltros();
    this.mudarSecao('pasta');
    this.escreverSecaoUrl('pasta');
    this.pastaAtualId = id;
    this.rebuildBreadcrumb();
    this.limparSelecao();
    this.pastaFocoId = null;
    this.pagina = 1;
    this.menu = null;
  }

  irParaCrumb(crumb: Crumb): void { this.irPara(crumb.id); }
  voltarInicio(): void { this.irPara(null); }
  voltar(): void { this.irPara(this.pastaPaiId()); }

  private rebuildBreadcrumb(): void {
    const crumbs: Crumb[] = [];
    let atual: PastaResponseDTO | undefined = this.pastas.find(p => p.id === this.pastaAtualId);
    let guarda = 0;
    while (atual && guarda++ < 50) {
      crumbs.unshift({ id: atual.id!, nome: atual.nome });
      atual = atual.idPastaPai ? this.pastas.find(p => p.id === atual!.idPastaPai) : undefined;
    }
    this.breadcrumb = crumbs;
  }

  pastaPaiId(): number | null {
    if (this.pastaAtualId == null) return null;
    return this.pastaAtual?.idPastaPai ?? null;
  }

  // ================= DRAG & DROP (mover entre pastas) =================

  onDragStartArquivo(event: DragEvent, arquivo: ArquivoResponseDTO): void {
    this.menu = null;
    this.arquivoArrastadoId = arquivo.id!;
    this.arrastandoIds = this.isSelecionado(arquivo.id!) ? [...this.arquivosSelecionados] : [arquivo.id!];
    event.dataTransfer?.setData('text/plain', String(arquivo.id));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDragEndArquivo(): void {
    this.arquivoArrastadoId = null;
    this.arrastandoIds = [];
    this.dropTargetId = null;
  }

  get qtdArrastando(): number { return this.arrastandoIds.length; }

  arrastandoAtivo(id: number): boolean { return this.arquivoArrastadoId !== null && this.arrastandoIds.includes(id); }

  onDragOverPasta(event: DragEvent, idPasta: number | null): void {
    if (this.arquivoArrastadoId == null) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dropTargetId = idPasta == null ? 'raiz' : idPasta;
  }

  onDragLeavePasta(idPasta: number | null): void {
    if (this.dropTargetId === (idPasta == null ? 'raiz' : idPasta)) this.dropTargetId = null;
  }

  onDropPasta(event: DragEvent, idPasta: number | null): void {
    if (this.arquivoArrastadoId == null) return;
    event.preventDefault();
    event.stopPropagation();
    const ids = this.arrastandoIds;
    this.onDragEndArquivo();
    if (idPasta == null) {
      this.toast.warning('Escolha uma pasta', 'Arquivos precisam ficar dentro de uma pasta.');
      return;
    }
    this.moverArquivos(ids, idPasta);
  }

  /** Eventos vindos da árvore de pastas da coluna esquerda. */
  onSidebarDragOver(d: DragPasta): void { this.onDragOverPasta(d.evento, d.id); }
  onSidebarDrop(d: DragPasta): void { this.onDropPasta(d.evento, d.id); }

  /** Move um ou mais arquivos para a pasta indicada (drag & drop e diálogo "Mover"). */
  private moverArquivos(ids: number[], idPasta: number, aoConcluir?: () => void): void {
    const pastaDestino = this.pastas.find(p => p.id === idPasta);
    if (!pastaDestino) { aoConcluir?.(); return; }
    const alvos = this.arquivos.filter(a => ids.includes(a.id) && a.idPasta !== idPasta);
    if (!alvos.length) {
      this.toast.info('Nada para mover', `Os arquivos já estão em "${pastaDestino.nome}".`);
      aoConcluir?.();
      return;
    }
    if (alvos.some(a => a.idEmpresa !== pastaDestino.idEmpresa)) {
      this.toast.error('Não foi possível mover', 'A pasta de destino é de outra empresa.');
      aoConcluir?.();
      return;
    }

    this.movendo = true;
    forkJoin(alvos.map(a => this.arquivoService.moverParaPasta(a.id, idPasta).pipe(
      map(atualizado => ({ ok: true as const, atualizado, erro: null as string | null })),
      catchError(err => of({ ok: false as const, atualizado: a, erro: this.msgErro(err, 'Erro ao mover arquivo.') }))
    ))).subscribe(res => {
      this.movendo = false;
      const ok = res.filter(r => r.ok).map(r => r.atualizado);
      this.substituirArquivos(ok);
      if (ok.length) {
        const s = new Set(this.arquivosSelecionados);
        ok.forEach(a => s.delete(a.id));
        this.arquivosSelecionados = s;
        this.toast.success(
          ok.length === 1 ? `"${ok[0].nomeOriginal}" movido` : `${ok.length} arquivos movidos`,
          `Destino: ${this.caminhoPasta(pastaDestino.id)}`
        );
      }
      const falhas = res.filter(r => !r.ok);
      if (falhas.length) this.toast.error(falhas.length === 1 ? 'Erro ao mover arquivo' : `${falhas.length} arquivos não foram movidos`, falhas[0].erro ?? undefined);
      aoConcluir?.();
    });
  }

  // ================= DRAG & DROP DE ARQUIVOS DO COMPUTADOR =================

  private ehArquivoExterno(e: DragEvent): boolean {
    return this.arquivoArrastadoId == null && Array.from(e.dataTransfer?.types ?? []).includes('Files');
  }

  @HostListener('window:dragenter', ['$event'])
  onWindowDragEnter(e: DragEvent): void {
    if (!this.ehArquivoExterno(e)) return;
    this.profundidadeDrag++;
    if (!this.uploadAberto && this.idEmpresaSelecionada) this.arrastandoExterno = true;
  }

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(e: DragEvent): void {
    if (!this.ehArquivoExterno(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = this.idEmpresaSelecionada ? 'copy' : 'none';
  }

  @HostListener('window:dragleave', ['$event'])
  onWindowDragLeave(e: DragEvent): void {
    if (!this.ehArquivoExterno(e)) return;
    this.profundidadeDrag = Math.max(0, this.profundidadeDrag - 1);
    if (this.profundidadeDrag === 0) this.arrastandoExterno = false;
  }

  @HostListener('window:drop', ['$event'])
  onWindowDrop(e: DragEvent): void {
    if (!this.ehArquivoExterno(e)) return;
    const tratadoPeloFormulario = e.defaultPrevented;
    e.preventDefault();
    this.profundidadeDrag = 0;
    this.arrastandoExterno = false;
    if (tratadoPeloFormulario && this.uploadAberto) return;
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (!files.length || !this.idEmpresaSelecionada) return;
    if (this.uploadAberto) this.uploadForm?.adicionarArquivos(files);
    else this.abrirUpload(files);
  }

  // ================= PASTAS (criar / renomear / excluir) =================

  abrirNovaPasta(idPai: number | null = this.pastaContexto): void {
    if (!this.idEmpresaSelecionada) return;
    this.menu = null;
    this.sidebarAberta = false;
    this.pastaModal = { modo: 'nova', idPai };
    this.pastaNome = '';
    this.pastaDescricao = '';
  }

  abrirRenomearPasta(pasta: PastaResponseDTO): void {
    this.menu = null;
    this.pastaModal = { modo: 'renomear', pasta, idPai: pasta.idPastaPai ?? null };
    this.pastaNome = pasta.nome;
    this.pastaDescricao = pasta.descricao ?? '';
  }

  fecharPastaModal(): void {
    if (this.salvandoPasta) return;
    this.pastaModal = null;
  }

  salvarPasta(): void {
    const nome = this.pastaNome.trim();
    if (!nome || !this.idEmpresaSelecionada || !this.pastaModal || this.salvandoPasta) return;
    const editando = this.pastaModal.modo === 'renomear' ? this.pastaModal.pasta! : null;
    const idPai = this.pastaModal.idPai;

    const dto: PastaRequestDTO = {
      nome,
      descricao: this.pastaDescricao.trim() || undefined,
      idEmpresa: editando ? editando.idEmpresa : this.idEmpresaSelecionada,
      idPastaPai: editando ? (editando.idPastaPai ?? undefined) : (idPai ?? undefined)
    };

    this.salvandoPasta = true;
    const req = editando ? this.pastaService.atualizar(editando.id, dto) : this.pastaService.salvar(dto);
    req.subscribe({
      next: (pasta) => {
        this.salvandoPasta = false;
        this.pastaModal = null;
        this.pastas = editando ? this.pastas.map(p => p.id === pasta.id ? pasta : p) : [...this.pastas, pasta];
        this.rebuildBreadcrumb();
        this.toast.success(editando ? 'Pasta atualizada' : 'Pasta criada', `"${pasta.nome}"`);
      },
      error: (err) => {
        this.salvandoPasta = false;
        this.toast.error(editando ? 'Erro ao atualizar pasta' : 'Erro ao criar pasta', this.msgErro(err));
      }
    });
  }

  async confirmarDeletarPasta(pasta: PastaResponseDTO): Promise<void> {
    this.menu = null;
    const c = this.contagemPasta(pasta.id);
    if (c.arquivos + c.pastas > 0) {
      const partes = [];
      if (c.pastas) partes.push(`${c.pastas} ${c.pastas === 1 ? 'subpasta' : 'subpastas'}`);
      if (c.arquivos) partes.push(`${c.arquivos} ${c.arquivos === 1 ? 'arquivo' : 'arquivos'}`);
      this.toast.warning('A pasta não está vazia', `"${pasta.nome}" contém ${partes.join(' e ')}. Mova ou exclua o conteúdo antes.`);
      return;
    }
    const ok = await this.confirm.ask({
      titulo: 'Excluir pasta?',
      mensagem: `A pasta "${pasta.nome}" será excluída permanentemente.`,
      confirmar: 'Excluir pasta',
      tom: 'danger'
    });
    if (!ok) return;
    this.pastaService.deletar(pasta.id).subscribe({
      next: () => {
        this.pastas = this.pastas.filter(p => p.id !== pasta.id);
        if (this.pastaFocoId === pasta.id) this.pastaFocoId = null;
        if (this.pastaAtualId === pasta.id) this.irPara(pasta.idPastaPai ?? null);
        this.toast.success('Pasta excluída', `"${pasta.nome}"`);
      },
      error: (err) => this.toast.error('Erro ao excluir pasta', this.msgErro(err))
    });
  }

  // ================= UPLOAD =================

  abrirUpload(arquivos: File[] = [], idPasta: number | null = this.pastaContexto): void {
    if (!this.idEmpresaSelecionada) return;
    this.menu = null;
    this.sidebarAberta = false;
    this.uploadArquivos = arquivos;
    this.uploadPastaId = idPasta;
    this.uploadAberto = true;
  }

  fecharUpload(): void {
    this.uploadAberto = false;
    this.uploadArquivos = [];
    if (this.route.snapshot.queryParamMap.get('upload')) {
      this.router.navigate([], { relativeTo: this.route, queryParams: { upload: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  onArquivoSalvo(qtd: number | void): void {
    const n = typeof qtd === 'number' ? qtd : 1;
    this.fecharUpload();
    this.carregarDadosEmpresa(true);
    this.toast.success(n > 1 ? `${n} arquivos enviados` : 'Arquivo enviado', 'Já está disponível na pasta escolhida.');
  }

  onUploadParcial(): void {
    this.carregarDadosEmpresa(true);
  }

  // ================= AÇÕES =================

  download(arquivo: ArquivoResponseDTO): void {
    this.menu = null;
    this.arquivoService.download(arquivo.id!).subscribe({
      next: (blob) => saveAs(blob, arquivo.nomeOriginal),
      error: () => this.toast.error('Erro ao baixar arquivo', 'O arquivo físico pode não estar disponível no servidor.')
    });
  }

  async confirmarDeletarArquivo(arquivo: ArquivoResponseDTO): Promise<void> {
    this.menu = null;
    const ok = await this.confirm.ask({
      titulo: 'Mover para a lixeira?',
      mensagem: `"${arquivo.nomeOriginal}" poderá ser restaurado pela Lixeira.`,
      confirmar: 'Mover para a lixeira',
      tom: 'danger'
    });
    if (!ok) return;
    this.arquivoService.deletar(arquivo.id!).subscribe({
      next: () => {
        this.arquivos = this.arquivos.filter(a => a.id !== arquivo.id);
        if (this.arquivosSelecionados.has(arquivo.id)) {
          const s = new Set(this.arquivosSelecionados);
          s.delete(arquivo.id);
          this.arquivosSelecionados = s;
        }
        if (this.arquivoDetalhe?.id === arquivo.id) this.fecharDetalhe();
        this.toast.success('Movido para a lixeira', `"${arquivo.nomeOriginal}"`);
      },
      error: (err) => this.toast.error('Erro ao excluir', this.msgErro(err))
    });
  }

  abrirMover(ids: number[]): void {
    this.menu = null;
    if (!ids.length) return;
    this.moverIds = ids;
    this.pastasOrigemMover = new Set(this.arquivos.filter(a => ids.includes(a.id)).map(a => a.idPasta));
  }

  fecharMover(): void {
    if (this.movendo) return;
    this.moverIds = null;
  }

  confirmarMover(idPasta: number): void {
    if (!this.moverIds || this.movendo) return;
    this.moverArquivos(this.moverIds, idPasta, () => { this.moverIds = null; });
  }

  // ================= MENU CONTEXTUAL =================

  /** Botão "⋮" (ou outro gatilho): menu alinhado ao botão. */
  abrirMenuBotao(alvo: AlvoMenu, event: MouseEvent, alinharDireita = true): void {
    event.stopPropagation();
    if (this.menu && this.mesmoAlvo(this.menu, alvo)) { this.menu = null; return; }
    if (alvo.tipo === 'arq') this.prepararSelecaoMenu(alvo.id);
    const r = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const a = alvo.tipo === 'arq' && this.arquivosSelecionados.size > 1 ? { tipo: 'multi' as const } : alvo;
    this.menu = { ...a, x: alinharDireita ? r.right : r.left, y: r.bottom + 4, yAcima: r.top - 4, direita: alinharDireita };
  }

  /** Clique direito: menu na posição do cursor. */
  abrirMenuContexto(alvo: AlvoMenu, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (alvo.tipo === 'arq') this.prepararSelecaoMenu(alvo.id);
    const a = alvo.tipo === 'arq' && this.arquivosSelecionados.size > 1 ? { tipo: 'multi' as const } : alvo;
    this.menu = { ...a, x: event.clientX, y: event.clientY, yAcima: event.clientY, direita: false };
  }

  /** Como no Drive: clicar com o direito num item fora da seleção seleciona só ele. */
  private prepararSelecaoMenu(id: number): void {
    if (!this.arquivosSelecionados.has(id)) {
      this.arquivosSelecionados = new Set([id]);
      this.ancoraId = id;
      this.pastaFocoId = null;
    }
  }

  private mesmoAlvo(m: MenuAberto, a: AlvoMenu): boolean {
    if (m.tipo !== a.tipo) return m.tipo === 'multi' && a.tipo === 'arq' && this.arquivosSelecionados.has(a.id);
    return !('id' in a) || ('id' in m && m.id === a.id);
  }

  menuAbertoPara(tipo: 'arq' | 'pasta', id: number): boolean {
    const m = this.menu;
    if (!m) return false;
    if (m.tipo === 'multi') return tipo === 'arq' && this.arquivosSelecionados.has(id);
    return m.tipo === tipo && 'id' in m && m.id === id;
  }

  get arquivoDoMenu(): ArquivoResponseDTO | undefined {
    const m = this.menu;
    return m?.tipo === 'arq' ? this.arquivos.find(a => a.id === m.id) : undefined;
  }

  get pastaDoMenu(): PastaResponseDTO | undefined {
    const m = this.menu;
    return m?.tipo === 'pasta' ? this.pastas.find(p => p.id === m.id) : undefined;
  }

  /** Clique direito numa área vazia: Nova pasta / Enviar arquivos. */
  onFundoContexto(e: MouseEvent): void {
    if (!this.idEmpresaSelecionada || this.carregando || this.secao === 'lixeira') return;
    if ((e.target as HTMLElement).closest('[data-item], input, textarea, select, .menu')) return;
    this.abrirMenuContexto({ tipo: 'fundo' }, e);
  }

  /** Clique numa área vazia limpa a seleção (como no Drive). */
  onFundoClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).closest('[data-item], button, a, input, label, select, app-drive-filtros, app-paginador, .menu')) return;
    this.limparSelecao();
    this.pastaFocoId = null;
  }

  // ================= CLIQUES EM ARQUIVOS =================

  private get toque(): boolean {
    try { return window.matchMedia('(hover: none)').matches; } catch { return false; }
  }

  clicarArquivo(arquivo: ArquivoResponseDTO, event: MouseEvent): void {
    const id = arquivo.id;
    this.pastaFocoId = null;
    if (event.shiftKey && this.ancoraId != null) {
      const lista = this.arquivosPagina();
      const i = lista.findIndex(a => a.id === this.ancoraId), j = lista.findIndex(a => a.id === id);
      if (i >= 0 && j >= 0) {
        const s = (event.ctrlKey || event.metaKey) ? new Set(this.arquivosSelecionados) : new Set<number>();
        lista.slice(Math.min(i, j), Math.max(i, j) + 1).forEach(a => s.add(a.id));
        this.arquivosSelecionados = s;
        return;
      }
    }
    if (event.ctrlKey || event.metaKey) { this.toggleSelecao(id); return; }
    if (this.toque) {
      if (this.arquivosSelecionados.size) this.toggleSelecao(id);
      else this.abrirVisualizacao(arquivo);
      return;
    }
    this.arquivosSelecionados = new Set([id]);
    this.ancoraId = id;
  }

  /** Duplo clique / Enter / "Visualizar": gaveta grande com pré-visualização. */
  abrirVisualizacao(arquivo: ArquivoResponseDTO): void {
    this.menu = null;
    this.arquivoDetalhe = arquivo;
  }

  /** Mantido por compatibilidade com o fluxo antigo. */
  abrirDetalhe(arquivo: ArquivoResponseDTO): void { this.abrirVisualizacao(arquivo); }
  abrirPreview(arquivo: ArquivoResponseDTO): void { this.abrirVisualizacao(arquivo); }

  fecharDetalhe(): void { this.arquivoDetalhe = null; }
  fecharPreview(): void { this.fecharDetalhe(); }

  irParaPastaDoArquivo(arquivo: ArquivoResponseDTO): void {
    this.fecharDetalhe();
    this.menu = null;
    this.irPara(arquivo.idPasta ?? null);
    this.arquivosSelecionados = new Set([arquivo.id]);
    this.ancoraId = arquivo.id;
    const idx = this.arquivosAtuais().findIndex(a => a.id === arquivo.id);
    if (idx >= 0) this.pagina = Math.floor(idx / this.porPagina) + 1;
    this.rolarAte(arquivo.id);
  }

  onArquivoAtualizado(atualizado: ArquivoResponseDTO): void {
    this.substituirArquivos([atualizado]);
    if (this.arquivoDetalhe?.id === atualizado.id) this.arquivoDetalhe = atualizado;
  }

  // ================= SELEÇÃO / AÇÕES EM MASSA =================

  toggleSelecao(id: number, event?: Event): void {
    event?.stopPropagation();
    const s = new Set(this.arquivosSelecionados);
    if (s.has(id)) s.delete(id); else s.add(id);
    this.arquivosSelecionados = s;
    this.ancoraId = id;
    this.pastaFocoId = null;
  }

  isSelecionado(id: number): boolean { return this.arquivosSelecionados.has(id); }

  toggleSelecionarTodos(): void {
    const atuais = this.arquivosPagina();
    const s = new Set(this.arquivosSelecionados);
    if (this.todosSelecionados()) atuais.forEach(a => s.delete(a.id!));
    else atuais.forEach(a => s.add(a.id!));
    this.arquivosSelecionados = s;
  }

  todosSelecionados(): boolean {
    const atuais = this.arquivosPagina();
    return atuais.length > 0 && atuais.every(a => this.arquivosSelecionados.has(a.id!));
  }

  algunsSelecionados(): boolean {
    return this.arquivosSelecionados.size > 0 && !this.todosSelecionados();
  }

  limparSelecao(): void {
    if (this.arquivosSelecionados.size) this.arquivosSelecionados = new Set();
  }

  get idsSelecionados(): number[] { return [...this.arquivosSelecionados]; }

  baixarSelecionados(): void {
    this.menu = null;
    const ids = this.idsSelecionados;
    if (!ids.length || this.baixandoEmMassa) return;
    if (ids.length === 1) {
      const arq = this.arquivos.find(a => a.id === ids[0]);
      if (arq) this.download(arq);
      return;
    }

    this.baixandoEmMassa = true;
    this.toast.info('Preparando download', `Compactando ${ids.length} arquivos…`);
    const arqs = this.arquivos.filter(a => ids.includes(a.id));
    forkJoin(arqs.map(arq => this.arquivoService.download(arq.id!).pipe(
      map(blob => ({ arq, blob: blob as Blob | null })),
      catchError(() => of({ arq, blob: null as Blob | null }))
    ))).subscribe(res => {
      const zip = new JSZip();
      const usados = new Map<string, number>();
      let incluidos = 0;
      for (const { arq, blob } of res) {
        if (!blob) continue;
        let nome = arq.nomeOriginal;
        const n = usados.get(nome) ?? 0;
        usados.set(nome, n + 1);
        if (n) nome = nome.replace(/(\.[^.]*)?$/, ` (${n})$1`);
        zip.file(nome, blob);
        incluidos++;
      }
      if (!incluidos) {
        this.baixandoEmMassa = false;
        this.toast.error('Download não realizado', 'Nenhum dos arquivos pôde ser baixado.');
        return;
      }
      zip.generateAsync({ type: 'blob' }).then(content => {
        saveAs(content, 'Arquivos_Selecionados.zip');
        this.baixandoEmMassa = false;
        this.limparSelecao();
        const falhas = res.length - incluidos;
        if (falhas) this.toast.warning('Download concluído com pendências', `${falhas} arquivo(s) não puderam ser incluídos no ZIP.`);
        else this.toast.success('Download concluído', `${incluidos} arquivos compactados.`);
      }).catch(() => {
        this.baixandoEmMassa = false;
        this.toast.error('Erro ao gerar o ZIP');
      });
    });
  }

  /** Arquivos arrastados até "Lixeira" na coluna esquerda. */
  onDropLixeira(): void {
    const ids = [...this.arrastandoIds];
    this.onDragEndArquivo();
    if (ids.length) this.confirmarExcluirSelecionados(ids);
  }

  onRestaurado(): void { this.carregarDadosEmpresa(true); }

  async confirmarExcluirSelecionados(lista?: number[]): Promise<void> {
    this.menu = null;
    const ids = lista ?? this.idsSelecionados;
    if (!ids.length || this.deletando) return;
    const ok = await this.confirm.ask({
      titulo: ids.length === 1 ? 'Mover 1 arquivo para a lixeira?' : `Mover ${ids.length} arquivos para a lixeira?`,
      mensagem: 'Você poderá restaurá-los depois pela Lixeira.',
      confirmar: 'Mover para a lixeira',
      tom: 'danger'
    });
    if (!ok) return;

    this.deletando = true;
    forkJoin(ids.map(id => this.arquivoService.deletar(id).pipe(
      map(() => ({ id, ok: true })),
      catchError(() => of({ id, ok: false }))
    ))).subscribe(res => {
      this.deletando = false;
      const removidos = new Set(res.filter(r => r.ok).map(r => r.id));
      this.arquivos = this.arquivos.filter(a => !removidos.has(a.id));
      if (this.arquivoDetalhe && removidos.has(this.arquivoDetalhe.id)) this.fecharDetalhe();
      this.arquivosSelecionados = new Set([...this.arquivosSelecionados].filter(id => !removidos.has(id)));
      if (removidos.size) this.toast.success('Movidos para a lixeira', `${removidos.size} arquivo(s).`);
      const falhas = res.length - removidos.size;
      if (falhas) this.toast.error('Alguns arquivos não foram excluídos', `${falhas} arquivo(s) continuam selecionados.`);
    });
  }

  // ================= ATALHOS DE TECLADO =================

  get algumModalAberto(): boolean {
    return this.uploadAberto || !!this.pastaModal || !!this.moverIds || !!this.arquivoDetalhe || this.sidebarAberta || !!this.confirm.state();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.escComConfirm) { this.escComConfirm = false; return; }
    if (this.confirm.state() || this.uploadAberto) return;

    if (e.key === 'Escape') {
      if (this.menu) { this.menu = null; return; }
      if (this.moverIds) { this.fecharMover(); return; }
      if (this.pastaModal) { this.fecharPastaModal(); return; }
      if (this.arquivoDetalhe) { this.fecharDetalhe(); return; }
      if (this.sidebarAberta) { this.sidebarAberta = false; return; }
      if (this.arquivosSelecionados.size) { this.limparSelecao(); return; }
      if (this.pastaFocoId != null) { this.pastaFocoId = null; return; }
      return;
    }

    const alvo = e.target as HTMLElement | null;
    const digitando = !!alvo && (/^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) || alvo.isContentEditable);
    if (digitando || this.algumModalAberto || this.menu) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && this.arquivosPagina().length) {
      e.preventDefault();
      if (!this.todosSelecionados()) this.toggleSelecionarTodos();
    } else if (e.key === 'Delete' && this.arquivosSelecionados.size) {
      e.preventDefault();
      this.confirmarExcluirSelecionados();
    }
  }

  // ================= HELPERS =================

  visual(arquivo: ArquivoResponseDTO): VisualTipo {
    return visualTipo(arquivo.nomeOriginal, arquivo.tipoArquivo);
  }

  tomStatus(status: string | null | undefined): string { return tomStatus(status); }

  metaPasta(id: number): string {
    const c = this.contagemPasta(id);
    if (!c.arquivos && !c.pastas) return 'Vazia';
    const partes: string[] = [];
    if (c.pastas) partes.push(`${c.pastas} ${c.pastas === 1 ? 'pasta' : 'pastas'}`);
    if (c.arquivos) partes.push(`${c.arquivos} ${c.arquivos === 1 ? 'arquivo' : 'arquivos'}`);
    return partes.join(' · ');
  }

  /** Valor para os pipes prazo/prazoTom (dias calculados pela API ou a data). */
  prazoValor(a: ArquivoResponseDTO): number | string | null { return a.diasParaVencer ?? a.dataVencimento; }

  mostrarPrazo(a: ArquivoResponseDTO): boolean { return mostraPrazo(a); }

  plural(n: number, um: string, varios: string): string { return `${n} ${n === 1 ? um : varios}`; }

  private substituirArquivos(lista: ArquivoResponseDTO[]): void {
    if (!lista.length) return;
    const porId = new Map(lista.map(a => [a.id, a]));
    this.arquivos = this.arquivos.map(a => porId.get(a.id) ?? a);
  }

  private msgErro(err: any, padrao = 'Tente novamente em instantes.'): string {
    return err?.error?.mensagem ?? err?.error?.message ?? (typeof err?.error === 'string' && err.error ? err.error : padrao);
  }
}
