import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CertidaoResponseDTO, StatusValidade, TipoCertidao } from '../../models/certidao.dto';
import { EmpresaResponseDTO } from '../../models/empresa-response.dto';
import { CertidaoService } from '../../services/certidao.service';
import { EmpresaService } from '../../services/empresa.service';
import { AuthService } from '../../services/auth.service';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/ui/toast.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { PaginadorComponent, paginar } from '../../shared/ui/paginador.component';
import { CertidaoTabelaComponent } from './certidao-tabela/certidao-tabela.component';
import { CertidaoFormComponent } from './certidao-form/certidao-form.component';
import { CelulaMatriz, CertidaoMatrizComponent } from './certidao-matriz/certidao-matriz.component';
import { TIPOS, mensagemErro, normalizar, porUrgencia, tipoInfo } from './certidao.util';

type FiltroStatus = 'TODAS' | StatusValidade;
type Visao = 'lista' | 'matriz';
const STATUS: FiltroStatus[] = ['TODAS', 'VALIDA', 'VENCENDO', 'VENCIDA'];

@Component({
  selector: 'app-certidao-list',
  standalone: true,
  imports: [FormsModule, RouterModule, IconComponent, PaginadorComponent, CertidaoTabelaComponent, CertidaoFormComponent, CertidaoMatrizComponent],
  templateUrl: './certidao-list.component.html',
  styleUrl: './certidao-list.component.css'
})
export class CertidaoListComponent implements OnInit {
  certidoes: CertidaoResponseDTO[] = [];
  empresas: EmpresaResponseDTO[] = [];
  carregando = true;
  erroCarga = false;
  isAdmin = false;

  busca = '';
  idEmpresaFiltro: number | null = null;
  filtroStatus: FiltroStatus = 'TODAS';
  filtroTipo: TipoCertidao | null = null;
  visao: Visao = 'lista';

  pagina = 1;
  porPagina = 10;

  /** modal */
  formAberto = false;
  editando: CertidaoResponseDTO | null = null;
  formEmpresa: number | null = null;
  formTipo: TipoCertidao | null = null;

  excluindoId: number | null = null;

  readonly tipos = TIPOS;
  readonly skeleton = [1, 2, 3, 4, 5];

  // derivados (recalculados em aplicar())
  base: CertidaoResponseDTO[] = [];
  filtradas: CertidaoResponseDTO[] = [];
  kpi = { validas: 0, vencendo: 0, vencidas: 0, total: 0, empresasAlerta: 0, maiorAtraso: 0, proximo: null as number | null, percentual: 0 };
  contTipo: Record<string, number> = {};
  empresasMatriz: { id: number; nome: string }[] = [];
  certidoesMatriz: CertidaoResponseDTO[] = [];

  constructor(
    private service: CertidaoService,
    private empresaService: EmpresaService,
    private auth: AuthService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.auth.isAdmin();
    const qp = this.route.snapshot.queryParamMap;
    const st = (qp.get('status') ?? '').toUpperCase() as FiltroStatus;
    if (STATUS.includes(st)) this.filtroStatus = st;
    const emp = Number(qp.get('empresa'));
    if (emp) this.idEmpresaFiltro = emp;
    if (this.isAdmin && qp.get('visao') === 'matriz') this.visao = 'matriz';
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.erroCarga = false;
    forkJoin({
      certidoes: this.service.listar(),
      empresas: this.isAdmin ? this.empresaService.listar().pipe(catchError(() => of([] as EmpresaResponseDTO[]))) : of([] as EmpresaResponseDTO[])
    }).subscribe({
      next: ({ certidoes, empresas }) => {
        this.certidoes = certidoes;
        this.empresas = [...empresas].sort((a, b) => (a.nomeFantasia ?? '').localeCompare(b.nomeFantasia ?? ''));
        this.carregando = false;
        this.aplicar();
      },
      error: (err) => {
        this.carregando = false;
        this.erroCarga = true;
        this.toast.error('Não foi possível carregar as certidões', mensagemErro(err));
      }
    });
  }

  // ------------------------------------------------------------------ filtros
  aplicar(): void {
    const termo = normalizar(this.busca.trim());
    const daEmpresa = this.idEmpresaFiltro ? this.certidoes.filter(c => c.idEmpresa === this.idEmpresaFiltro) : this.certidoes;
    this.base = termo
      ? daEmpresa.filter(c => normalizar(`${c.nomeEmpresa} ${c.tipoRotulo} ${c.numero ?? ''} ${c.orgaoEmissor ?? ''}`).includes(termo))
      : daEmpresa;

    const b = this.base;
    const vencidas = b.filter(c => c.statusValidade === 'VENCIDA');
    const proximos = b.filter(c => c.diasParaVencer >= 0).map(c => c.diasParaVencer);
    this.kpi = {
      validas: b.filter(c => c.statusValidade === 'VALIDA').length,
      vencendo: b.filter(c => c.statusValidade === 'VENCENDO').length,
      vencidas: vencidas.length,
      total: b.length,
      empresasAlerta: new Set(b.filter(c => c.statusValidade !== 'VALIDA').map(c => c.idEmpresa)).size,
      maiorAtraso: vencidas.reduce((m, c) => Math.max(m, -c.diasParaVencer), 0),
      proximo: proximos.length ? Math.min(...proximos) : null,
      percentual: b.length ? Math.round(100 * b.filter(c => c.statusValidade === 'VALIDA').length / b.length) : 0,
    };

    const porStatus = this.filtroStatus === 'TODAS' ? b : b.filter(c => c.statusValidade === this.filtroStatus);
    this.contTipo = {};
    for (const c of porStatus) this.contTipo[c.tipo] = (this.contTipo[c.tipo] ?? 0) + 1;
    this.filtradas = (this.filtroTipo ? porStatus.filter(c => c.tipo === this.filtroTipo) : porStatus).slice().sort(porUrgencia);

    // matriz: todas as empresas (filtro de empresa / busca pelo nome)
    const nomeOk = (nome: string) => !termo || normalizar(nome).includes(termo);
    const fonte = this.empresas.length
      ? this.empresas.map(e => ({ id: e.id, nome: e.nomeFantasia }))
      : [...new Map(this.certidoes.map(c => [c.idEmpresa, { id: c.idEmpresa, nome: c.nomeEmpresa }])).values()];
    this.empresasMatriz = fonte.filter(e => (!this.idEmpresaFiltro || e.id === this.idEmpresaFiltro) && (nomeOk(e.nome) || this.base.some(c => c.idEmpresa === e.id)));
    this.certidoesMatriz = this.certidoes.filter(c => this.empresasMatriz.some(e => e.id === c.idEmpresa));
  }

  get itensPagina(): CertidaoResponseDTO[] {
    return paginar(this.filtradas, this.pagina, this.porPagina);
  }

  get temFiltro(): boolean {
    return !!this.busca.trim() || !!this.idEmpresaFiltro || this.filtroStatus !== 'TODAS' || !!this.filtroTipo;
  }

  setStatus(s: FiltroStatus): void {
    this.filtroStatus = this.filtroStatus === s && s !== 'TODAS' ? 'TODAS' : s;
    this.pagina = 1;
    this.aplicar();
    this.sincronizarUrl();
  }

  setTipo(t: TipoCertidao | null): void {
    this.filtroTipo = this.filtroTipo === t ? null : t;
    this.pagina = 1;
    this.aplicar();
  }

  aoMudarFiltro(): void {
    this.pagina = 1;
    this.aplicar();
    this.sincronizarUrl();
  }

  setVisao(v: Visao): void {
    this.visao = v;
    this.sincronizarUrl();
  }

  limparFiltros(): void {
    this.busca = '';
    this.idEmpresaFiltro = null;
    this.filtroStatus = 'TODAS';
    this.filtroTipo = null;
    this.pagina = 1;
    this.aplicar();
    this.sincronizarUrl();
  }

  private sincronizarUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: {
        status: this.filtroStatus !== 'TODAS' ? this.filtroStatus.toLowerCase() : null,
        empresa: this.idEmpresaFiltro || null,
        visao: this.visao === 'matriz' ? 'matriz' : null,
      },
    });
  }

  rotuloTipo(t: TipoCertidao): string { return tipoInfo(t).curto; }
  iconeTipo(t: TipoCertidao): string { return tipoInfo(t).icone; }

  // ------------------------------------------------------------------ ações
  nova(): void {
    this.editando = null;
    this.formEmpresa = this.idEmpresaFiltro;
    this.formTipo = this.filtroTipo;
    this.formAberto = true;
  }

  editar(c: CertidaoResponseDTO): void {
    this.editando = c;
    this.formEmpresa = null;
    this.formTipo = null;
    this.formAberto = true;
  }

  aoClicarCelula(cel: CelulaMatriz): void {
    if (!this.isAdmin) return;
    if (cel.certidao) { this.editar(cel.certidao); return; }
    this.editando = null;
    this.formEmpresa = cel.idEmpresa;
    this.formTipo = cel.tipo;
    this.formAberto = true;
  }

  fecharForm(): void {
    this.formAberto = false;
    this.editando = null;
  }

  aoSalvar(c: CertidaoResponseDTO): void {
    const i = this.certidoes.findIndex(x => x.id === c.id);
    this.certidoes = i >= 0 ? this.certidoes.map(x => x.id === c.id ? c : x) : [...this.certidoes, c];
    this.fecharForm();
    this.aplicar();
  }

  async excluir(c: CertidaoResponseDTO): Promise<void> {
    const ok = await this.confirm.ask({
      titulo: 'Excluir certidão?',
      mensagem: `${c.tipoRotulo} de ${c.nomeEmpresa}${c.numero ? ' (nº ' + c.numero + ')' : ''} deixará de ser acompanhada. O PDF continua no Drive.`,
      confirmar: 'Excluir',
      tom: 'danger'
    });
    if (!ok) return;
    this.excluindoId = c.id;
    this.service.excluir(c.id).subscribe({
      next: () => {
        this.excluindoId = null;
        this.certidoes = this.certidoes.filter(x => x.id !== c.id);
        this.aplicar();
        this.toast.success('Certidão excluída', `${c.tipoRotulo} · ${c.nomeEmpresa}`);
      },
      error: (err) => {
        this.excluindoId = null;
        this.toast.error('Não foi possível excluir', mensagemErro(err));
      }
    });
  }
}
