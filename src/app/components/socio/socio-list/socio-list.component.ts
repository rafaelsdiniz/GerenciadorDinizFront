import { Component, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocioService } from '../../../services/socio.service';
import { EmpresaService } from '../../../services/empresa.service';
import { SocioResponseDTO } from '../../../models/socio-response.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { SocioFormComponent } from '../socio-form/socio-form.component';
import { IconComponent } from '../../../shared/icon.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { PaginadorComponent, paginar } from '../../../shared/ui/paginador.component';
import { DocumentoPipe, IniciaisPipe, AvatarCorPipe } from '../../../pipes/formatos.pipe';

type FiltroFuncao = 'TODOS' | 'ADMIN' | 'OUTROS';
type Ordem = 'nome' | 'empresa' | 'participacao';

@Component({
  selector: 'app-socio-list',
  standalone: true,
  imports: [CommonModule, FormsModule, SocioFormComponent, IconComponent, PaginadorComponent,
            DocumentoPipe, IniciaisPipe, AvatarCorPipe],
  templateUrl: './socio-list.component.html',
  styleUrl: './socio-list.component.css'
})
export class SocioListComponent implements OnInit {
  private socioService = inject(SocioService);
  private empresaService = inject(EmpresaService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  @ViewChild('busca') buscaInput?: ElementRef<HTMLInputElement>;

  readonly skeletonRows = [1, 2, 3, 4, 5];

  socios: SocioResponseDTO[] = [];
  sociosFiltrados: SocioResponseDTO[] = [];
  empresas: EmpresaResponseDTO[] = [];
  private empresaMap = new Map<number, EmpresaResponseDTO>();

  termoBusca = '';
  filtroEmpresa: number | null = null;
  filtroFuncao: FiltroFuncao = 'TODOS';
  ordem: Ordem = 'nome';
  ordemAsc = true;

  pagina = 1;
  porPagina = 10;

  carregando = false;
  erroCarregar = false;

  painelAberto = false;
  modoPainel: 'novo' | 'editar' | 'detalhes' = 'novo';
  socioSelecionado: SocioResponseDTO | null = null;
  deletandoId: number | null = null;

  ngOnInit(): void {
    this.carregar();
    this.carregarEmpresas();
  }

  carregar(): void {
    this.carregando = true;
    this.erroCarregar = false;
    this.socioService.listar().subscribe({
      next: (data) => {
        this.socios = data;
        this.carregando = false;
        this.filtrar(false);
      },
      error: () => {
        this.carregando = false;
        this.erroCarregar = true;
        this.toast.error('Não foi possível carregar os sócios', 'Verifique sua conexão e tente novamente.');
      }
    });
  }

  carregarEmpresas(): void {
    this.empresaService.listar().subscribe({
      next: (data) => {
        this.empresas = [...data].sort((a, b) => a.nomeFantasia.localeCompare(b.nomeFantasia, 'pt-BR'));
        this.empresaMap = new Map(data.map(e => [e.id, e]));
        this.filtrar(false);
      }
    });
  }

  empresa(id: number): EmpresaResponseDTO | undefined {
    return this.empresaMap.get(id);
  }

  getNomeEmpresa(idEmpresa: number): string {
    return this.empresaMap.get(idEmpresa)?.nomeFantasia ?? '—';
  }

  // ---------- contagens ----------
  private get baseEmpresa(): SocioResponseDTO[] {
    return this.filtroEmpresa == null ? this.socios : this.socios.filter(s => s.idEmpresa === this.filtroEmpresa);
  }
  get totalBase(): number { return this.baseEmpresa.length; }
  get totalAdmins(): number { return this.baseEmpresa.filter(s => s.administrador).length; }
  get totalOutros(): number { return this.baseEmpresa.filter(s => !s.administrador).length; }
  get totalEmpresas(): number { return new Set(this.socios.map(s => s.idEmpresa)).size; }
  get temFiltro(): boolean { return !!this.termoBusca.trim() || this.filtroEmpresa != null || this.filtroFuncao !== 'TODOS'; }
  get paginaItens(): SocioResponseDTO[] { return paginar(this.sociosFiltrados, this.pagina, this.porPagina); }

  /** Soma de participação da empresa filtrada (quadro societário). */
  get somaParticipacao(): number {
    return this.baseEmpresa.reduce((t, s) => t + (s.participacao ?? 0), 0);
  }
  get tomSoma(): 'success' | 'warning' | 'danger' {
    const s = Math.round(this.somaParticipacao * 100) / 100;
    return s === 100 ? 'success' : s > 100 ? 'danger' : 'warning';
  }

  // ---------- filtros ----------
  setFuncao(f: FiltroFuncao): void {
    this.filtroFuncao = f;
    this.filtrar();
  }

  ordenarPor(o: Ordem): void {
    if (this.ordem === o) this.ordemAsc = !this.ordemAsc;
    else { this.ordem = o; this.ordemAsc = o !== 'participacao'; }
    this.filtrar(false);
  }

  ariaSort(o: Ordem): string | null {
    return this.ordem === o ? (this.ordemAsc ? 'ascending' : 'descending') : null;
  }

  sortIcon(o: Ordem): string {
    return this.ordem === o ? (this.ordemAsc ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down';
  }

  limparFiltros(): void {
    this.termoBusca = '';
    this.filtroEmpresa = null;
    this.filtroFuncao = 'TODOS';
    this.filtrar();
  }

  filtrar(resetPagina = true): void {
    const termo = this.normalizar(this.termoBusca.trim());
    const termoDig = this.termoBusca.replace(/\D/g, '');
    const lista = this.socios.filter(s =>
      (this.filtroEmpresa == null || s.idEmpresa === this.filtroEmpresa) &&
      (this.filtroFuncao === 'TODOS' || (this.filtroFuncao === 'ADMIN' ? !!s.administrador : !s.administrador)) &&
      (!termo ||
        this.normalizar(s.nome).includes(termo) ||
        (termoDig.length > 0 && (s.cpf ?? '').replace(/\D/g, '').includes(termoDig)) ||
        this.normalizar(this.getNomeEmpresa(s.idEmpresa)).includes(termo))
    );
    const dir = this.ordemAsc ? 1 : -1;
    lista.sort((a, b) => {
      let r = 0;
      if (this.ordem === 'participacao') r = (a.participacao ?? -1) - (b.participacao ?? -1);
      else if (this.ordem === 'empresa') r = this.getNomeEmpresa(a.idEmpresa).localeCompare(this.getNomeEmpresa(b.idEmpresa), 'pt-BR');
      else r = a.nome.localeCompare(b.nome, 'pt-BR');
      return r * dir || a.nome.localeCompare(b.nome, 'pt-BR');
    });
    this.sociosFiltrados = lista;
    if (resetPagina) this.pagina = 1;
  }

  private normalizar(s: string): string {
    return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // ---------- ações ----------
  abrirFormNovo(): void {
    this.socioSelecionado = null;
    this.modoPainel = 'novo';
    this.painelAberto = true;
  }

  abrirFormEdicao(socio: SocioResponseDTO): void {
    this.socioSelecionado = socio;
    this.modoPainel = 'editar';
    this.painelAberto = true;
  }

  verDetalhes(socio: SocioResponseDTO): void {
    this.socioSelecionado = socio;
    this.modoPainel = 'detalhes';
    this.painelAberto = true;
  }

  fecharPainel(): void {
    this.painelAberto = false;
    this.socioSelecionado = null;
  }

  async confirmarDelete(socio: SocioResponseDTO): Promise<void> {
    const ok = await this.confirm.ask({
      titulo: `Excluir ${socio.nome}?`,
      mensagem: `O sócio será removido do quadro societário de ${this.getNomeEmpresa(socio.idEmpresa)}. Esta ação não pode ser desfeita.`,
      confirmar: 'Excluir sócio',
      tom: 'danger'
    });
    if (!ok) return;
    this.deletandoId = socio.id;
    this.socioService.deletar(socio.id).subscribe({
      next: () => {
        this.deletandoId = null;
        this.toast.success('Sócio excluído', `${socio.nome} foi removido do quadro societário.`);
        this.carregar();
      },
      error: () => {
        this.deletandoId = null;
        this.toast.error('Não foi possível excluir o sócio', 'Tente novamente em instantes.');
      }
    });
  }

  onSocioSalvo(): void {
    this.fecharPainel();
    this.carregar();
  }

  // ---------- atalhos: "/" busca, "n" novo ----------
  @HostListener('document:keydown', ['$event'])
  atalhos(e: KeyboardEvent): void {
    if (this.painelAberto || e.ctrlKey || e.metaKey || e.altKey) return;
    const alvo = e.target as HTMLElement;
    if (alvo?.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === '/') { e.preventDefault(); this.buscaInput?.nativeElement.focus(); }
    else if (e.key.toLowerCase() === 'n') { e.preventDefault(); this.abrirFormNovo(); }
  }
}
