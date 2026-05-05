import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsuarioService } from '../../../services/usuario.service';
import { EmpresaService } from '../../../services/empresa.service';
import { UsuarioResponseDTO } from '../../../models/usuario-response.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { UsuarioFormComponent } from '../usuario-form/usuario-form.component';

@Component({
  selector: 'app-usuario-list',
  standalone: true,
  imports: [CommonModule, FormsModule, UsuarioFormComponent],
  templateUrl: './usuario-list.component.html',
  styleUrl: './usuario-list.component.css'
})
export class UsuarioListComponent implements OnInit {

  usuarios: UsuarioResponseDTO[] = [];
  usuariosFiltrados: UsuarioResponseDTO[] = [];
  empresas: EmpresaResponseDTO[] = [];
  termoBusca = '';

  carregando = false;
  menuAbertoId: number | null = null;
  menuPosicao = { top: 0, right: 0 };

  painelAberto = false;
  modoPainel: 'novo' | 'editar' | 'detalhes' = 'novo';
  usuarioSelecionado: UsuarioResponseDTO | null = null;

  usuarioParaDeletar: UsuarioResponseDTO | null = null;
  deletando = false;

  constructor(
    private usuarioService: UsuarioService,
    private empresaService: EmpresaService
  ) {}

  ngOnInit(): void {
    this.carregar();
    this.carregarEmpresas();
  }

  carregar(): void {
    this.carregando = true;
    this.usuarioService.listar().subscribe({
      next: (data) => {
        this.usuarios = data;
        this.usuariosFiltrados = data;
        this.carregando = false;
      },
      error: () => { this.carregando = false; }
    });
  }

  carregarEmpresas(): void {
    this.empresaService.listar().subscribe({
      next: (data) => { this.empresas = data; }
    });
  }

  getNomeEmpresa(idEmpresa: number): string {
    return this.empresas.find(e => e.id === idEmpresa)?.nomeFantasia ?? '—';
  }

  filtrar(): void {
    const termo = this.termoBusca.toLowerCase();
    this.usuariosFiltrados = this.usuarios.filter(u =>
      u.nome.toLowerCase().includes(termo) ||
      u.email.toLowerCase().includes(termo)
    );
  }

  toggleMenu(id: number, event: MouseEvent): void {
    if (this.menuAbertoId === id) {
      this.menuAbertoId = null;
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    this.menuPosicao = {
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right
    };
    this.menuAbertoId = id;
  }

  abrirFormNovo(): void {
    this.usuarioSelecionado = null;
    this.modoPainel = 'novo';
    this.painelAberto = true;
    this.menuAbertoId = null;
  }

  abrirFormEdicao(usuario: UsuarioResponseDTO): void {
    this.usuarioSelecionado = usuario;
    this.modoPainel = 'editar';
    this.painelAberto = true;
    this.menuAbertoId = null;
  }

  verDetalhes(usuario: UsuarioResponseDTO): void {
    this.usuarioSelecionado = usuario;
    this.modoPainel = 'detalhes';
    this.painelAberto = true;
    this.menuAbertoId = null;
  }

  fecharPainel(): void {
    this.painelAberto = false;
    this.usuarioSelecionado = null;
    this.menuAbertoId = null;
  }

  confirmarDelete(usuario: UsuarioResponseDTO): void {
    this.usuarioParaDeletar = usuario;
    this.menuAbertoId = null;
  }

  cancelarDelete(): void {
    this.usuarioParaDeletar = null;
  }

  deletar(): void {
    if (!this.usuarioParaDeletar?.id) return;
    this.deletando = true;
    this.usuarioService.deletar(this.usuarioParaDeletar.id).subscribe({
      next: () => {
        this.deletando = false;
        this.usuarioParaDeletar = null;
        this.carregar();
      },
      error: () => { this.deletando = false; }
    });
  }

  onUsuarioSalvo(): void {
    this.fecharPainel();
    this.carregar();
  }
}