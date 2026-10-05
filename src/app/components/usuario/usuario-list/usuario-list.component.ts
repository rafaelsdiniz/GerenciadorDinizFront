import { Component, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsuarioService } from '../../../services/usuario.service';
import { EmpresaService } from '../../../services/empresa.service';
import { AuthService } from '../../../services/auth.service';
import { UsuarioResponseDTO } from '../../../models/usuario-response.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { UsuarioFormComponent } from '../usuario-form/usuario-form.component';
import { IconComponent } from '../../../shared/icon.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { PaginadorComponent, paginar } from '../../../shared/ui/paginador.component';
import { DocumentoPipe, IniciaisPipe, AvatarCorPipe } from '../../../pipes/formatos.pipe';

type FiltroPerfil = 'TODOS' | 'ADMIN' | 'FUNCIONARIO';
type Ordem = 'nome' | 'perfil' | 'empresa' | 'desde';

export const PERFIL_INFO: Record<string, { label: string; desc: string; icon: string }> = {
  ADMIN: { label: 'Administrador', desc: 'Acesso total: empresas, usuários e auditoria', icon: 'shield-check' },
  FUNCIONARIO: { label: 'Funcionário', desc: 'Envia e consulta arquivos da própria empresa', icon: 'user' }
};

@Component({
  selector: 'app-usuario-list',
  standalone: true,
  imports: [CommonModule, FormsModule, UsuarioFormComponent, IconComponent, PaginadorComponent,
            DocumentoPipe, IniciaisPipe, AvatarCorPipe],
  templateUrl: './usuario-list.component.html',
  styleUrl: './usuario-list.component.css'
})
export class UsuarioListComponent implements OnInit {
  private usuarioService = inject(UsuarioService);
  private empresaService = inject(EmpresaService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private auth = inject(AuthService);

  @ViewChild('busca') buscaInput?: ElementRef<HTMLInputElement>;

  readonly perfilInfo = PERFIL_INFO;
  readonly skeletonRows = [1, 2, 3, 4, 5];

  usuarios: UsuarioResponseDTO[] = [];
  usuariosFiltrados: UsuarioResponseDTO[] = [];
  empresas: EmpresaResponseDTO[] = [];
  private empresaMap = new Map<number, EmpresaResponseDTO>();

  termoBusca = '';
  filtroPerfil: FiltroPerfil = 'TODOS';
  filtroEmpresa: number | null = null;
  ordem: Ordem = 'nome';
  ordemAsc = true;

  pagina = 1;
  porPagina = 10;

  carregando = false;
  erroCarregar = false;
  meuId: number | null = this.auth.getUsuarioId();

  painelAberto = false;
  modoPainel: 'novo' | 'editar' | 'detalhes' = 'novo';
  usuarioSelecionado: UsuarioResponseDTO | null = null;
  deletandoId: number | null = null;

  ngOnInit(): void {
    this.carregar();
    this.carregarEmpresas();
  }

  carregar(): void {
    this.carregando = true;
    this.erroCarregar = false;
    this.usuarioService.listar().subscribe({
      next: (data) => {
        this.usuarios = data;
        this.carregando = false;
        this.filtrar();
      },
      error: () => {
        this.carregando = false;
        this.erroCarregar = true;
        this.toast.error('Não foi possível carregar os usuários', 'Verifique sua conexão e tente novamente.');
      }
    });
  }

  carregarEmpresas(): void {
    this.empresaService.listar().subscribe({
      next: (data) => {
        this.empresas = [...data].sort((a, b) => a.nomeFantasia.localeCompare(b.nomeFantasia, 'pt-BR'));
        this.empresaMap = new Map(data.map(e => [e.id, e]));
        this.filtrar();
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
  get totalAdmins(): number { return this.usuarios.filter(u => u.perfilUsuario === 'ADMIN').length; }
  get totalFuncionarios(): number { return this.usuarios.filter(u => u.perfilUsuario === 'FUNCIONARIO').length; }
  get temFiltro(): boolean { return !!this.termoBusca.trim() || this.filtroPerfil !== 'TODOS' || this.filtroEmpresa != null; }
  get paginaItens(): UsuarioResponseDTO[] { return paginar(this.usuariosFiltrados, this.pagina, this.porPagina); }

  // ---------- filtros ----------
  setPerfil(p: FiltroPerfil): void {
    this.filtroPerfil = p;
    this.filtrar();
  }

  ordenarPor(o: Ordem): void {
    if (this.ordem === o) this.ordemAsc = !this.ordemAsc;
    else { this.ordem = o; this.ordemAsc = true; }
    this.filtrar(false);
  }

  ariaSort(o: Ordem): string | null {
    return this.ordem === o ? (this.ordemAsc ? 'ascending' : 'descending') : null;
  }

  limparFiltros(): void {
    this.termoBusca = '';
    this.filtroPerfil = 'TODOS';
    this.filtroEmpresa = null;
    this.filtrar();
  }

  filtrar(resetPagina = true): void {
    const termo = this.normalizar(this.termoBusca.trim());
    const lista = this.usuarios.filter(u =>
      (this.filtroPerfil === 'TODOS' || u.perfilUsuario === this.filtroPerfil) &&
      (this.filtroEmpresa == null || u.idEmpresa === this.filtroEmpresa) &&
      (!termo ||
        this.normalizar(u.nome).includes(termo) ||
        u.email.toLowerCase().includes(termo) ||
        this.normalizar(this.getNomeEmpresa(u.idEmpresa)).includes(termo))
    );
    const dir = this.ordemAsc ? 1 : -1;
    const chave = (u: UsuarioResponseDTO) =>
      this.ordem === 'perfil' ? PERFIL_INFO[u.perfilUsuario]?.label ?? '' :
      this.ordem === 'empresa' ? this.getNomeEmpresa(u.idEmpresa) :
      this.ordem === 'desde' ? u.dataCriacao ?? '' : u.nome;
    lista.sort((a, b) => chave(a).localeCompare(chave(b), 'pt-BR') * dir || a.nome.localeCompare(b.nome, 'pt-BR'));
    this.usuariosFiltrados = lista;
    if (resetPagina) this.pagina = 1;
  }

  private normalizar(s: string): string {
    return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // ---------- ações ----------
  abrirFormNovo(): void {
    this.usuarioSelecionado = null;
    this.modoPainel = 'novo';
    this.painelAberto = true;
  }

  abrirFormEdicao(usuario: UsuarioResponseDTO): void {
    this.usuarioSelecionado = usuario;
    this.modoPainel = 'editar';
    this.painelAberto = true;
  }

  verDetalhes(usuario: UsuarioResponseDTO): void {
    this.usuarioSelecionado = usuario;
    this.modoPainel = 'detalhes';
    this.painelAberto = true;
  }

  fecharPainel(): void {
    this.painelAberto = false;
    this.usuarioSelecionado = null;
  }

  async confirmarDelete(usuario: UsuarioResponseDTO): Promise<void> {
    const proprio = usuario.id === this.meuId;
    const ok = await this.confirm.ask({
      titulo: proprio ? 'Excluir a sua própria conta?' : `Excluir ${usuario.nome}?`,
      mensagem: proprio
        ? 'Você perderá o acesso ao sistema imediatamente. Esta ação não pode ser desfeita.'
        : `${usuario.email} perderá o acesso ao sistema. Esta ação não pode ser desfeita.`,
      confirmar: 'Excluir usuário',
      tom: 'danger'
    });
    if (!ok) return;
    this.deletar(usuario);
  }

  private deletar(usuario: UsuarioResponseDTO): void {
    this.deletandoId = usuario.id;
    this.usuarioService.deletar(usuario.id).subscribe({
      next: () => {
        this.deletandoId = null;
        this.toast.success('Usuário excluído', `${usuario.nome} não tem mais acesso ao sistema.`);
        this.carregar();
      },
      error: () => {
        this.deletandoId = null;
        this.toast.error('Não foi possível excluir o usuário', 'Tente novamente em instantes.');
      }
    });
  }

  onUsuarioSalvo(): void {
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
