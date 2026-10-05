import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EmpresaRequestDTO } from '../../../models/empresa-request.dto';
import { EmpresaService } from '../../../services/empresa.service';
import { ObrigacaoPendenteService } from '../../../services/obrigacao-pendente.service';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { ObrigacaoPendenteResponseDTO } from '../../../models/obrigacao-pendente-response.dto';
import { StatusObrigacao } from '../../../models/enums/status-obrigacao.enum';
import { RegimeTributario, RegimeTributarioLabel } from '../../../models/enums/regime-tributario.enum';
import { SituacaoCadastral, SituacaoCadastralLabel } from '../../../models/enums/situacao-cadastral.enum';
import { EmpresaFormComponent } from '../empresa-form/empresa-form.component';
import { IconComponent } from '../../../shared/icon.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { AvatarCorPipe, DocumentoPipe, IniciaisPipe, PrazoPipe, PrazoTomPipe, TelefonePipe } from '../../../pipes/formatos.pipe';

/** Resumo de obrigações por empresa (para "quem precisa de atenção"). */
export interface ResumoObrigacoes {
  vencidas: number;
  pendentes: number;
  vencendo7: number;
  proxima: ObrigacaoPendenteResponseDTO | null;
}

type FiltroAtencao = 'todas' | 'vencidas' | 'vencendo' | 'irregular';
type Ordem = 'nome' | 'cnpj' | 'regime' | 'atencao';

@Component({
  selector: 'app-empresa-list',
  standalone: true,
  imports: [CommonModule, FormsModule, EmpresaFormComponent, IconComponent,
    DocumentoPipe, TelefonePipe, IniciaisPipe, AvatarCorPipe, PrazoPipe, PrazoTomPipe],
  templateUrl: './empresa-list.component.html',
  styleUrl: './empresa-list.component.css'
})
export class EmpresaListComponent implements OnInit {

  @ViewChild('buscaInput') buscaInput?: ElementRef<HTMLInputElement>;

  private readonly VIEW_KEY = 'empresas.visao';

  empresas: EmpresaResponseDTO[] = [];
  empresasFiltradas: EmpresaResponseDTO[] = [];
  termoBusca = '';

  carregando = false;
  carregandoObrigacoes = false;
  resumo = new Map<number, ResumoObrigacoes>();

  filtroAtencao: FiltroAtencao = 'todas';
  filtroRegime: RegimeTributario | 'SEM' | null = null;
  filtroSituacao: SituacaoCadastral | null = null;
  ordem: Ordem = 'atencao';
  ordemAsc = true;
  visao: 'lista' | 'grade' = 'lista';

  pagina = 1;
  porPagina = 10;
  readonly opcoesPorPagina = [10, 25, 50];

  menuAbertoId: number | null = null;
  menuPosicao = { top: 0, right: 0 };

  painelAberto = false;
  modoPainel: 'novo' | 'editar' | 'detalhes' = 'novo';
  empresaSelecionada: EmpresaResponseDTO | null = null;

  regimes = Object.values(RegimeTributario);
  regimeLabel = RegimeTributarioLabel;
  situacoes = Object.values(SituacaoCadastral);
  situacaoLabel = SituacaoCadastralLabel;
  readonly skeletonRows = [1, 2, 3, 4, 5, 6];

  constructor(
    private empresaService: EmpresaService,
    private obrigacaoService: ObrigacaoPendenteService,
    private router: Router,
    private route: ActivatedRoute,
    private toast: ToastService,
    private confirm: ConfirmService
  ) {}

  ngOnInit(): void {
    try {
      const v = localStorage.getItem(this.VIEW_KEY);
      if (v === 'grade' || v === 'lista') this.visao = v;
    } catch { /* sem storage */ }
    this.carregar();
    this.abrirPreenchidoPelaUrl();
  }

  /** Pré-cadastro vindo de outra tela (ex.: comunicação do DEC de CNPJ não cadastrado). */
  preenchimento: Partial<EmpresaRequestDTO> | null = null;

  private abrirPreenchidoPelaUrl(): void {
    const q = this.route.snapshot.queryParamMap;
    if (q.get('novo') !== '1') return;
    const d = (q.get('cnpj') ?? '').replace(/\D/g, '');
    const cnpj = d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : d;
    const razao = (q.get('razao') ?? '').trim();
    this.preenchimento = { cnpj, razaoSocial: razao };
    this.abrirFormNovo();
    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  // ============ carregamento ============

  carregar(): void {
    this.carregando = true;
    this.empresaService.listar().subscribe({
      next: (data) => {
        this.empresas = data;
        this.filtrar();
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.toast.error('Erro ao carregar empresas', 'Verifique a conexão com o servidor e tente novamente.');
      }
    });
    this.carregarObrigacoes();
  }

  /** Obrigações de todas as empresas → contadores por cliente (não bloqueia a lista). */
  private carregarObrigacoes(): void {
    this.carregandoObrigacoes = true;
    this.obrigacaoService.listar().subscribe({
      next: (lista) => {
        const mapa = new Map<number, ResumoObrigacoes>();
        for (const o of lista) {
          if (o.status === StatusObrigacao.ENTREGUE) continue;
          const r = mapa.get(o.idEmpresa) ?? { vencidas: 0, pendentes: 0, vencendo7: 0, proxima: null };
          const dias = o.diasParaVencer;
          if (o.status === StatusObrigacao.VENCIDA || (dias != null && dias < 0)) {
            r.vencidas++;
          } else {
            r.pendentes++;
            if (dias != null && dias <= 7) r.vencendo7++;
            if (o.dataVencimento && (!r.proxima || o.dataVencimento < r.proxima.dataVencimento)) r.proxima = o;
          }
          mapa.set(o.idEmpresa, r);
        }
        this.resumo = mapa;
        this.carregandoObrigacoes = false;
        this.filtrar();
      },
      error: () => { this.carregandoObrigacoes = false; }
    });
  }

  // ============ filtros / ordenação ============

  resumoDe(e: EmpresaResponseDTO): ResumoObrigacoes | undefined {
    return this.resumo.get(e.id);
  }

  private irregular(e: EmpresaResponseDTO): boolean {
    return (!!e.situacaoCadastral && e.situacaoCadastral !== SituacaoCadastral.ATIVA) || !e.regimeTributario;
  }

  private pesoAtencao(e: EmpresaResponseDTO): number {
    const r = this.resumoDe(e);
    return (r?.vencidas ?? 0) * 1000 + (r?.vencendo7 ?? 0) * 10 + (this.irregular(e) ? 1 : 0);
  }

  get qtdVencidas(): number { return this.empresas.filter(e => (this.resumoDe(e)?.vencidas ?? 0) > 0).length; }
  get qtdVencendo(): number { return this.empresas.filter(e => (this.resumoDe(e)?.vencendo7 ?? 0) > 0).length; }
  get qtdIrregular(): number { return this.empresas.filter(e => this.irregular(e)).length; }
  get qtdAtivas(): number { return this.empresas.filter(e => e.situacaoCadastral === SituacaoCadastral.ATIVA).length; }
  get totalObrigacoesVencidas(): number {
    let t = 0; this.resumo.forEach(r => t += r.vencidas); return t;
  }
  get qtdAtencao(): number {
    return this.empresas.filter(e => (this.resumoDe(e)?.vencidas ?? 0) > 0 || (this.resumoDe(e)?.vencendo7 ?? 0) > 0).length;
  }

  qtdRegime(r: RegimeTributario | 'SEM'): number {
    return this.empresas.filter(e => r === 'SEM' ? !e.regimeTributario : e.regimeTributario === r).length;
  }

  get regimesPresentes(): RegimeTributario[] {
    return this.regimes.filter(r => this.qtdRegime(r) > 0);
  }

  get filtrosAtivos(): boolean {
    return !!this.termoBusca.trim() || this.filtroAtencao !== 'todas' || this.filtroRegime !== null || this.filtroSituacao !== null;
  }

  filtrar(): void {
    const termo = this.termoBusca.trim().toLowerCase();
    const termoDig = termo.replace(/\D/g, '');
    let lista = this.empresas.filter(e => {
      if (termo) {
        const ok = e.nomeFantasia?.toLowerCase().includes(termo)
          || e.razaoSocial?.toLowerCase().includes(termo)
          || e.email?.toLowerCase().includes(termo)
          || (!!termoDig && e.cnpj?.replace(/\D/g, '').includes(termoDig));
        if (!ok) return false;
      }
      if (this.filtroRegime === 'SEM' && e.regimeTributario) return false;
      if (this.filtroRegime && this.filtroRegime !== 'SEM' && e.regimeTributario !== this.filtroRegime) return false;
      if (this.filtroSituacao && e.situacaoCadastral !== this.filtroSituacao) return false;
      const r = this.resumoDe(e);
      if (this.filtroAtencao === 'vencidas' && !(r?.vencidas)) return false;
      if (this.filtroAtencao === 'vencendo' && !(r?.vencendo7)) return false;
      if (this.filtroAtencao === 'irregular' && !this.irregular(e)) return false;
      return true;
    });

    const dir = this.ordemAsc ? 1 : -1;
    const nome = (e: EmpresaResponseDTO) => (e.nomeFantasia ?? '').toLocaleLowerCase('pt-BR');
    lista = [...lista].sort((a, b) => {
      switch (this.ordem) {
        case 'cnpj': return dir * (a.cnpj ?? '').localeCompare(b.cnpj ?? '');
        case 'regime': return dir * (this.regimeTexto(a)).localeCompare(this.regimeTexto(b), 'pt-BR');
        case 'atencao': {
          const d = this.pesoAtencao(b) - this.pesoAtencao(a);
          return d !== 0 ? dir * d : nome(a).localeCompare(nome(b), 'pt-BR');
        }
        default: return dir * nome(a).localeCompare(nome(b), 'pt-BR');
      }
    });
    this.empresasFiltradas = lista;
    if (this.pagina > this.totalPaginas) this.pagina = this.totalPaginas;
  }

  private regimeTexto(e: EmpresaResponseDTO): string {
    return e.regimeTributario ? this.regimeLabel[e.regimeTributario] : '~';
  }

  setAtencao(f: FiltroAtencao): void {
    this.filtroAtencao = this.filtroAtencao === f ? 'todas' : f;
    this.pagina = 1;
    this.filtrar();
  }

  setRegime(r: RegimeTributario | 'SEM' | null): void {
    this.filtroRegime = this.filtroRegime === r ? null : r;
    this.pagina = 1;
    this.filtrar();
  }

  onBusca(): void { this.pagina = 1; this.filtrar(); }

  ordenar(campo: Ordem): void {
    if (this.ordem === campo) this.ordemAsc = !this.ordemAsc;
    else { this.ordem = campo; this.ordemAsc = true; }
    this.filtrar();
  }

  iconeOrdem(campo: Ordem): string {
    if (this.ordem !== campo) return 'chevrons-up-down';
    return this.ordemAsc ? 'chevron-up' : 'chevron-down';
  }

  limparFiltros(): void {
    this.termoBusca = '';
    this.filtroAtencao = 'todas';
    this.filtroRegime = null;
    this.filtroSituacao = null;
    this.pagina = 1;
    this.filtrar();
  }

  setVisao(v: 'lista' | 'grade'): void {
    this.visao = v;
    try { localStorage.setItem(this.VIEW_KEY, v); } catch { /* sem storage */ }
  }

  // ============ paginação ============

  get totalPaginas(): number { return Math.max(1, Math.ceil(this.empresasFiltradas.length / this.porPagina)); }
  get inicio(): number { return this.empresasFiltradas.length ? (this.pagina - 1) * this.porPagina + 1 : 0; }
  get fim(): number { return Math.min(this.pagina * this.porPagina, this.empresasFiltradas.length); }
  get empresasPagina(): EmpresaResponseDTO[] {
    return this.empresasFiltradas.slice((this.pagina - 1) * this.porPagina, this.pagina * this.porPagina);
  }

  /** Páginas visíveis, com 0 representando reticências. */
  get paginas(): number[] {
    const t = this.totalPaginas, p = this.pagina;
    if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
    const set = [1, p - 1, p, p + 1, t].filter(n => n >= 1 && n <= t);
    const uniq = [...new Set(set)].sort((a, b) => a - b);
    const out: number[] = [];
    uniq.forEach((n, i) => { if (i && n - uniq[i - 1] > 1) out.push(0); out.push(n); });
    return out;
  }

  irPara(p: number): void {
    if (p < 1 || p > this.totalPaginas) return;
    this.pagina = p;
  }

  mudarPorPagina(): void { this.pagina = 1; }

  // ============ helpers de exibição ============

  situacaoTom(s: SituacaoCadastral | null | undefined): string {
    switch (s) {
      case SituacaoCadastral.ATIVA: return 'badge-success';
      case SituacaoCadastral.BAIXADA: return 'badge-neutral';
      case SituacaoCadastral.NULA: return 'badge-danger';
      case SituacaoCadastral.INAPTA:
      case SituacaoCadastral.SUSPENSA: return 'badge-warning';
      default: return 'badge-neutral';
    }
  }

  // ============ navegação / menu ============

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (this.painelAberto) return;
    const alvo = e.target as HTMLElement;
    const digitando = alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT' || alvo.isContentEditable);
    if (e.key === 'Escape' && this.menuAbertoId !== null) { this.menuAbertoId = null; return; }
    if (digitando || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); this.buscaInput?.nativeElement.focus(); }
    else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); this.abrirFormNovo(); }
  }

  @HostListener('document:click')
  @HostListener('window:resize')
  fecharMenu(): void { this.menuAbertoId = null; }

  @HostListener('window:scroll')
  onScroll(): void { if (this.menuAbertoId !== null) this.menuAbertoId = null; }

  abrirPerfil(empresa: EmpresaResponseDTO): void {
    this.menuAbertoId = null;
    this.router.navigate(['/empresas', empresa.id]);
  }

  toggleMenu(id: number, event: MouseEvent): void {
    event.stopPropagation();
    if (this.menuAbertoId === id) { this.menuAbertoId = null; return; }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const alturaMenu = 230;
    const abreParaCima = rect.bottom + alturaMenu > window.innerHeight;
    this.menuPosicao = {
      top: abreParaCima ? Math.max(8, rect.top - alturaMenu - 4) : rect.bottom + 4,
      right: Math.max(8, window.innerWidth - rect.right)
    };
    this.menuAbertoId = id;
  }

  abrirFormNovo(): void {
    this.empresaSelecionada = null;
    if (!this.route.snapshot.queryParamMap.get('novo')) this.preenchimento = null;
    this.modoPainel = 'novo';
    this.painelAberto = true;
    this.menuAbertoId = null;
  }

  abrirFormEdicao(empresa: EmpresaResponseDTO): void {
    this.empresaSelecionada = empresa;
    this.modoPainel = 'editar';
    this.painelAberto = true;
    this.menuAbertoId = null;
  }

  verDetalhes(empresa: EmpresaResponseDTO): void {
    this.empresaSelecionada = empresa;
    this.modoPainel = 'detalhes';
    this.painelAberto = true;
    this.menuAbertoId = null;
  }

  fecharPainel(): void {
    this.painelAberto = false;
    this.empresaSelecionada = null;
    this.menuAbertoId = null;
  }

  copiarCnpj(empresa: EmpresaResponseDTO): void {
    this.menuAbertoId = null;
    const v = new DocumentoPipe().transform(empresa.cnpj);
    navigator.clipboard?.writeText(v).then(
      () => this.toast.success('CNPJ copiado', v),
      () => this.toast.error('Não foi possível copiar')
    );
  }

  async confirmarDelete(empresa: EmpresaResponseDTO): Promise<void> {
    this.menuAbertoId = null;
    const ok = await this.confirm.ask({
      titulo: 'Excluir empresa?',
      mensagem: `"${empresa.nomeFantasia}" será removida do sistema. Esta ação não pode ser desfeita.`,
      confirmar: 'Excluir',
      tom: 'danger'
    });
    if (!ok || !empresa.id) return;
    this.empresaService.deletar(empresa.id).subscribe({
      next: () => {
        this.toast.success('Empresa excluída', empresa.nomeFantasia);
        this.carregar();
      },
      error: (err) => {
        this.toast.error('Não foi possível excluir', err?.error?.mensagem ?? err?.error?.message ?? 'Verifique se há arquivos ou usuários vinculados.');
      }
    });
  }

  onEmpresaSalva(): void {
    this.fecharPainel();
    this.carregar();
  }

  onEmpresaDeletada(): void {
    this.fecharPainel();
    this.carregar();
  }
}
