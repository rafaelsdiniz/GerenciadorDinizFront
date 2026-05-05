import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsuarioService } from '../../../services/usuario.service';
import { UsuarioRequestDTO } from '../../../models/usuario-request.dto';
import { UsuarioResponseDTO } from '../../../models/usuario-response.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { PerfilUsuario } from '../../../models/enums/tipo-usuario.enum';

@Component({
  selector: 'app-usuario-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuario-form.component.html',
  styleUrl: './usuario-form.component.css'
})
export class UsuarioFormComponent implements OnChanges {

  @Input() usuario: UsuarioResponseDTO | null = null;
  @Input() modo: 'novo' | 'editar' | 'detalhes' = 'novo';
  @Input() empresas: EmpresaResponseDTO[] = [];

  @Output() fechar = new EventEmitter<void>();
  @Output() salvo = new EventEmitter<void>();

  dto: UsuarioRequestDTO = this.dtoVazio();
  erros: Record<string, string> = {};
  erroGeral = '';
  salvando = false;
  senhaVisivel = false;

  constructor(private usuarioService: UsuarioService) {}

  ngOnChanges(): void {
    this.erros = {};
    this.erroGeral = '';
    this.senhaVisivel = false;

    if (this.modo === 'editar' && this.usuario) {
      this.dto = {
        nome: this.usuario.nome,
        email: this.usuario.email,
        senha: '',
        perfilUsuario: this.usuario.perfilUsuario,
        idEmpresa: this.usuario.idEmpresa
      };
    } else {
      this.dto = this.dtoVazio();
    }
  }

  dtoVazio(): UsuarioRequestDTO {
    return {
      nome: '',
      email: '',
      senha: '',
      perfilUsuario: PerfilUsuario.FUNCIONARIO,
      idEmpresa: 0
    };
  }

  irParaEdicao(): void {
    this.modo = 'editar';
    if (this.usuario) {
      this.dto = {
        nome: this.usuario.nome,
        email: this.usuario.email,
        senha: '',
        perfilUsuario: this.usuario.perfilUsuario,
        idEmpresa: this.usuario.idEmpresa
      };
    }
  }

  getNomeEmpresa(idEmpresa: number): string {
    return this.empresas.find(e => e.id === idEmpresa)?.nomeFantasia ?? '—';
  }

  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  validar(): boolean {
    this.erros = {};
    if (!this.dto.nome.trim()) this.erros['nome'] = 'Nome é obrigatório.';
    if (!this.dto.email.trim()) {
      this.erros['email'] = 'Email é obrigatório.';
    } else if (!UsuarioFormComponent.EMAIL_REGEX.test(this.dto.email.trim())) {
      this.erros['email'] = 'Email inválido.';
    }
    if (this.modo === 'novo' && !this.dto.senha.trim()) this.erros['senha'] = 'Senha é obrigatória.';
    if (this.dto.senha && this.dto.senha.length < 6) this.erros['senha'] = 'Senha deve ter no mínimo 6 caracteres.';
    if (!this.dto.perfilUsuario) this.erros['perfilUsuario'] = 'Perfil é obrigatório.';
    if (!this.dto.idEmpresa || this.dto.idEmpresa === 0) this.erros['idEmpresa'] = 'Empresa é obrigatória.';
    return Object.keys(this.erros).length === 0;
  }

  salvar(): void {
    if (!this.validar()) return;
    this.salvando = true;
    this.erroGeral = '';

    const request = this.modo === 'novo'
      ? this.usuarioService.salvar(this.dto)
      : this.usuarioService.atualizar(this.usuario!.id!, this.dto);

    request.subscribe({
      next: () => {
        this.salvando = false;
        this.salvo.emit();
      },
      error: () => {
        this.salvando = false;
        this.erroGeral = 'Erro ao salvar usuário. Verifique os dados e tente novamente.';
      }
    });
  }
}