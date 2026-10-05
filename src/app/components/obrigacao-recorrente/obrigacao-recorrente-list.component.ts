import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ObrigacaoRecorrenteService } from '../../services/obrigacao-recorrente.service';
import { EmpresaService } from '../../services/empresa.service';
import { ObrigacaoRecorrenteResponseDTO } from '../../models/obrigacao-recorrente-response.dto';
import { ObrigacaoRecorrenteRequestDTO } from '../../models/obrigacao-recorrente-request.dto';
import { EmpresaResponseDTO } from '../../models/empresa-response.dto';
import { Periodicidade, PeriodicidadeLabel } from '../../models/enums/periodicidade.enum';
import { TipoArquivo } from '../../models/enums/tipo-arquivo.enum';
import { ResponsavelObrigacao, ResponsavelObrigacaoAjuda } from '../../models/enums/responsavel-obrigacao.enum';
import { AuthService } from '../../services/auth.service';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/ui/toast.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { AvatarCorPipe, IniciaisPipe } from '../../pipes/formatos.pipe';

type FiltroAtivo = 'todas' | 'ativas' | 'inativas';

const SUFIXO_PERIODO: Record<Periodicidade, string> = {
  [Periodicidade.MENSAL]: 'de cada mês',
  [Periodicidade.TRIMESTRAL]: 'a cada trimestre',
  [Periodicidade.ANUAL]: 'uma vez por ano'
};

@Component({
  selector: 'app-obrigacao-recorrente-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, IniciaisPipe, AvatarCorPipe],
  templateUrl: './obrigacao-recorrente-list.component.html',
  styleUrl: './obrigacao-recorrente-list.component.css'
})
export class ObrigacaoRecorrenteListComponent implements OnInit {
  @ViewChild('buscaInput') buscaInput?: ElementRef<HTMLInputElement>;

  obrigacoes: ObrigacaoRecorrenteResponseDTO[] = [];
  empresas: EmpresaResponseDTO[] = [];
  carregando = false;

  busca = '';
  idEmpresaFiltro: number | null = null;
  periodicidadeFiltro: Periodicidade | null = null;
  filtroAtivo: FiltroAtivo = 'todas';
  responsavelFiltro: ResponsavelObrigacao | null = null;
  /** mutações de recorrentes são exclusivas do ADMIN */
  isAdmin = false;

  pagina = 1;
  porPagina = 10;
  readonly opcoesPorPagina = [10, 25, 50];

  formAberto = false;
  editando: ObrigacaoRecorrenteResponseDTO | null = null;
  form: ObrigacaoRecorrenteRequestDTO = this.formVazio();
  erro = '';
  tentouSalvar = false;
  salvando = false;
  idAlternando: number | null = null;

  periodicidades = Object.values(Periodicidade);
  periodLabel = PeriodicidadeLabel;
  sufixoPeriodo = SUFIXO_PERIODO;
  tiposArquivo = Object.values(TipoArquivo);
  readonly Resp = ResponsavelObrigacao;
  readonly opcoesResponsavel = [
    { valor: ResponsavelObrigacao.ESCRITORIO, titulo: 'Escritório entrega', icone: 'briefcase', ajuda: ResponsavelObrigacaoAjuda.ESCRITORIO },
    { valor: ResponsavelObrigacao.CLIENTE, titulo: 'Cliente envia', icone: 'send', ajuda: ResponsavelObrigacaoAjuda.CLIENTE }
  ];
  readonly skeletonRows = [1, 2, 3, 4, 5];

  constructor(
    private service: ObrigacaoRecorrenteService,
    private empresaService: EmpresaService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.auth.isAdmin();
    this.empresaService.listar().subscribe({ next: (d) => this.empresas = d, error: () => {} });
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.service.listar().subscribe({
      next: (d) => { this.obrigacoes = d; this.carregando = false; },
      error: () => {
        this.carregando = false;
        this.toast.error('Não foi possível carregar as obrigações recorrentes');
      }
    });
  }

  getNomeEmpresa(id: number): string {
    return this.empresas.find(e => e.id === id)?.nomeFantasia ?? '—';
  }

  // ---------------------------------------------------------------- filtros
  get base(): ObrigacaoRecorrenteResponseDTO[] {
    const termo = normalizar(this.busca.trim());
    return this.obrigacoes.filter(o =>
      (!this.idEmpresaFiltro || o.idEmpresa === this.idEmpresaFiltro) &&
      (!this.periodicidadeFiltro || o.periodicidade === this.periodicidadeFiltro) &&
      (!this.responsavelFiltro || this.responsavel(o) === this.responsavelFiltro) &&
      (!termo || normalizar(`${o.nome} ${o.descricao ?? ''} ${this.getNomeEmpresa(o.idEmpresa)}`).includes(termo))
    );
  }

  contar(f: FiltroAtivo): number {
    return this.base.filter(o => f === 'todas' || (f === 'ativas' ? o.ativo : !o.ativo)).length;
  }

  get filtradas(): ObrigacaoRecorrenteResponseDTO[] {
    const f = this.filtroAtivo;
    return this.base
      .filter(o => f === 'todas' || (f === 'ativas' ? o.ativo : !o.ativo))
      .sort((a, b) =>
        this.getNomeEmpresa(a.idEmpresa).localeCompare(this.getNomeEmpresa(b.idEmpresa), 'pt-BR') ||
        a.diaVencimento - b.diaVencimento ||
        a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  /** responsável efetivo (registros antigos sem o campo = ESCRITORIO) */
  responsavel(o: { responsavel?: ResponsavelObrigacao | null }): ResponsavelObrigacao {
    return o.responsavel ?? ResponsavelObrigacao.ESCRITORIO;
  }

  /** contagem por responsável, respeitando os demais filtros */
  contarResp(r: ResponsavelObrigacao): number {
    const f = this.filtroAtivo;
    return this.obrigacoes.filter(o => this.responsavel(o) === r).filter(o => {
      const termo = normalizar(this.busca.trim());
      return (!this.idEmpresaFiltro || o.idEmpresa === this.idEmpresaFiltro) &&
        (!this.periodicidadeFiltro || o.periodicidade === this.periodicidadeFiltro) &&
        (f === 'todas' || (f === 'ativas' ? o.ativo : !o.ativo)) &&
        (!termo || normalizar(`${o.nome} ${o.descricao ?? ''} ${this.getNomeEmpresa(o.idEmpresa)}`).includes(termo));
    }).length;
  }

  setResponsavel(r: ResponsavelObrigacao): void {
    this.responsavelFiltro = this.responsavelFiltro === r ? null : r;
    this.pagina = 1;
  }

  get totalAtivas(): number { return this.obrigacoes.filter(o => o.ativo).length; }
  get totalEmpresas(): number { return new Set(this.obrigacoes.map(o => o.idEmpresa)).size; }

  setFiltroAtivo(f: FiltroAtivo): void { this.filtroAtivo = f; this.pagina = 1; }
  aoMudarFiltro(): void { this.pagina = 1; }

  get temFiltro(): boolean {
    return !!this.busca.trim() || !!this.idEmpresaFiltro || !!this.periodicidadeFiltro || !!this.responsavelFiltro || this.filtroAtivo !== 'todas';
  }

  limparFiltros(): void {
    this.busca = '';
    this.idEmpresaFiltro = null;
    this.periodicidadeFiltro = null;
    this.responsavelFiltro = null;
    this.filtroAtivo = 'todas';
    this.pagina = 1;
  }

  periodoClasse(p: Periodicidade): string {
    return p === Periodicidade.MENSAL ? 'badge-info' : p === Periodicidade.TRIMESTRAL ? 'badge-warning' : 'badge-neutral';
  }

  // -------------------------------------------------------------- paginação
  get totalPaginas(): number { return Math.max(1, Math.ceil(this.filtradas.length / this.porPagina)); }
  get paginaAtual(): number { return Math.min(this.pagina, this.totalPaginas); }

  get itensPagina(): ObrigacaoRecorrenteResponseDTO[] {
    const ini = (this.paginaAtual - 1) * this.porPagina;
    return this.filtradas.slice(ini, ini + this.porPagina);
  }

  get faixa(): { de: number; ate: number; total: number } {
    const total = this.filtradas.length;
    const de = total ? (this.paginaAtual - 1) * this.porPagina + 1 : 0;
    return { de, ate: Math.min(total, de + this.porPagina - 1), total };
  }

  get paginas(): number[] {
    const t = this.totalPaginas, a = this.paginaAtual;
    if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
    const ord = [...new Set([1, t, a - 1, a, a + 1].filter(n => n >= 1 && n <= t))].sort((x, y) => x - y);
    const out: number[] = [];
    ord.forEach((n, i) => { if (i && n - ord[i - 1] > 1) out.push(-1); out.push(n); });
    return out;
  }

  irPara(n: number): void { this.pagina = Math.min(Math.max(1, n), this.totalPaginas); }

  // ------------------------------------------------------------------- form
  formVazio(): ObrigacaoRecorrenteRequestDTO {
    return { idEmpresa: 0, nome: '', descricao: '', periodicidade: Periodicidade.MENSAL, diaVencimento: 10, tipoArquivoEsperado: null, ativo: true, responsavel: ResponsavelObrigacao.ESCRITORIO };
  }

  abrirNova(): void {
    if (!this.isAdmin) return;
    this.editando = null;
    this.form = this.formVazio();
    if (this.idEmpresaFiltro) this.form.idEmpresa = this.idEmpresaFiltro;
    this.erro = '';
    this.tentouSalvar = false;
    this.formAberto = true;
  }

  editar(o: ObrigacaoRecorrenteResponseDTO): void {
    if (!this.isAdmin) return;
    this.editando = o;
    this.form = {
      idEmpresa: o.idEmpresa, nome: o.nome, descricao: o.descricao,
      periodicidade: o.periodicidade, diaVencimento: o.diaVencimento,
      tipoArquivoEsperado: o.tipoArquivoEsperado, ativo: o.ativo, responsavel: this.responsavel(o)
    };
    this.erro = '';
    this.tentouSalvar = false;
    this.formAberto = true;
  }

  fecharForm(): void {
    if (this.salvando) return;
    this.formAberto = false;
    this.editando = null;
  }

  get erroEmpresa(): boolean { return !this.form.idEmpresa; }
  get erroNome(): boolean { return !this.form.nome?.trim(); }
  get erroDia(): boolean {
    const d = this.form.diaVencimento;
    return !d || d < 1 || d > 31 || !Number.isInteger(+d);
  }

  get resumoForm(): string {
    const d = this.form.diaVencimento;
    if (this.erroDia) return '';
    return `Vence todo dia ${d} ${SUFIXO_PERIODO[this.form.periodicidade]}.` + (d > 28 ? ' Em meses mais curtos, o vencimento cai no último dia do mês.' : '');
  }

  salvar(): void {
    this.tentouSalvar = true;
    if (this.erroEmpresa || this.erroNome) { this.erro = 'Empresa e nome são obrigatórios.'; return; }
    if (this.erroDia) { this.erro = 'Dia de vencimento entre 1 e 31.'; return; }
    this.erro = '';
    this.salvando = true;
    const editando = !!this.editando;
    const geraPendencia = this.form.ativo && (!editando || !this.editando!.ativo);
    const obs = this.editando
      ? this.service.atualizar(this.editando.id, this.form)
      : this.service.salvar(this.form);
    obs.subscribe({
      next: () => {
        this.salvando = false;
        this.toast.success(
          editando ? 'Obrigação atualizada' : 'Obrigação criada',
          geraPendencia ? `${this.form.nome} · próxima pendência gerada.` : this.form.nome);
        this.fecharForm();
        this.carregar();
      },
      error: (err) => {
        this.salvando = false;
        this.erro = err?.error?.mensagem ?? 'Erro ao salvar.';
        this.toast.error('Erro ao salvar obrigação', this.erro);
      }
    });
  }

  /** Ativa/inativa direto na tabela (PUT com o mesmo payload). */
  alternarAtivo(o: ObrigacaoRecorrenteResponseDTO, ev: Event): void {
    ev.stopPropagation();
    const novo = !o.ativo;
    this.idAlternando = o.id;
    const dto: ObrigacaoRecorrenteRequestDTO = {
      idEmpresa: o.idEmpresa, nome: o.nome, descricao: o.descricao, periodicidade: o.periodicidade,
      diaVencimento: o.diaVencimento, tipoArquivoEsperado: o.tipoArquivoEsperado, ativo: novo,
      responsavel: this.responsavel(o)
    };
    this.service.atualizar(o.id, dto).subscribe({
      next: () => {
        o.ativo = novo;
        this.idAlternando = null;
        this.toast.success(novo ? 'Obrigação ativada' : 'Obrigação inativada', novo ? `${o.nome} · próxima pendência gerada.` : o.nome);
      },
      error: (err) => {
        this.idAlternando = null;
        this.toast.error('Erro ao alterar a obrigação', err?.error?.mensagem);
      }
    });
  }

  async deletar(o: ObrigacaoRecorrenteResponseDTO, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    const ok = await this.confirm.ask({
      titulo: 'Excluir obrigação recorrente?',
      mensagem: `"${o.nome}" (${this.getNomeEmpresa(o.idEmpresa)}) deixará de gerar novas pendências. Esta ação não pode ser desfeita.`,
      confirmar: 'Excluir',
      tom: 'danger'
    });
    if (!ok) return;
    this.service.deletar(o.id).subscribe({
      next: () => { this.toast.success('Obrigação excluída', o.nome); this.carregar(); },
      error: (err) => this.toast.error('Erro ao excluir obrigação', err?.error?.mensagem)
    });
  }

  async excluirEditando(): Promise<void> {
    const o = this.editando;
    if (!o) return;
    this.formAberto = false;
    this.editando = null;
    await this.deletar(o);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.formAberto) { this.fecharForm(); return; }
    const alvo = e.target as HTMLElement;
    const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(alvo?.tagName) || alvo?.isContentEditable;
    if (digitando || this.formAberto) return;
    if (e.key === '/') { e.preventDefault(); this.buscaInput?.nativeElement.focus(); }
    else if (this.isAdmin && e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); this.abrirNova(); }
  }
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
