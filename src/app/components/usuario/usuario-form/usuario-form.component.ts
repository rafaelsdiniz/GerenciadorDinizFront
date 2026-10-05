import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsuarioService } from '../../../services/usuario.service';
import { UsuarioRequestDTO } from '../../../models/usuario-request.dto';
import { UsuarioResponseDTO } from '../../../models/usuario-response.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { PerfilUsuario } from '../../../models/enums/tipo-usuario.enum';
import { IconComponent } from '../../../shared/icon.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { DocumentoPipe, IniciaisPipe, AvatarCorPipe } from '../../../pipes/formatos.pipe';

@Component({
  selector: 'app-usuario-form',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, DocumentoPipe, IniciaisPipe, AvatarCorPipe],
  templateUrl: './usuario-form.component.html',
  styleUrl: './usuario-form.component.css'
})
export class UsuarioFormComponent implements OnChanges, AfterViewInit {
  private usuarioService = inject(UsuarioService);
  private toast = inject(ToastService);

  @Input() usuario: UsuarioResponseDTO | null = null;
  @Input() modo: 'novo' | 'editar' | 'detalhes' = 'novo';
  @Input() empresas: EmpresaResponseDTO[] = [];

  @Output() fechar = new EventEmitter<void>();
  @Output() salvo = new EventEmitter<void>();

  @ViewChild('primeiroCampo') primeiroCampo?: ElementRef<HTMLInputElement>;

  readonly perfis = [
    { valor: PerfilUsuario.FUNCIONARIO, label: 'Funcionário', icon: 'user', desc: 'Vê e envia arquivos somente da empresa vinculada.' },
    { valor: PerfilUsuario.ADMIN, label: 'Administrador', icon: 'shield-check', desc: 'Acesso total: empresas, usuários e auditoria.' }
  ];

  dto: UsuarioRequestDTO = this.dtoVazio();
  erros: Record<string, string> = {};
  erroGeral = '';
  salvando = false;
  senhaVisivel = false;

  ngOnChanges(): void {
    this.erros = {};
    this.erroGeral = '';
    this.senhaVisivel = false;
    this.dto = this.modo === 'editar' && this.usuario ? this.fromUsuario(this.usuario) : this.dtoVazio();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.primeiroCampo?.nativeElement.focus(), 60);
  }

  dtoVazio(): UsuarioRequestDTO {
    return { nome: '', email: '', senha: '', perfilUsuario: PerfilUsuario.FUNCIONARIO, idEmpresa: 0 };
  }

  private fromUsuario(u: UsuarioResponseDTO): UsuarioRequestDTO {
    return { nome: u.nome, email: u.email, senha: '', perfilUsuario: u.perfilUsuario, idEmpresa: u.idEmpresa };
  }

  irParaEdicao(): void {
    this.modo = 'editar';
    if (this.usuario) this.dto = this.fromUsuario(this.usuario);
    setTimeout(() => this.primeiroCampo?.nativeElement.focus(), 30);
  }

  getNomeEmpresa(idEmpresa: number): string {
    return this.empresas.find(e => e.id === idEmpresa)?.nomeFantasia ?? '—';
  }

  getCnpjEmpresa(idEmpresa: number): string | undefined {
    return this.empresas.find(e => e.id === idEmpresa)?.cnpj;
  }

  perfilLabel(p: string | undefined): string {
    return this.perfis.find(x => x.valor === p)?.label ?? p ?? '—';
  }

  limparErro(campo: string): void {
    if (this.erros[campo]) delete this.erros[campo];
  }

  // ---------- senha ----------
  get forcaSenha(): { nivel: number; label: string; tom: string } {
    const s = this.dto.senha ?? '';
    if (!s) return { nivel: 0, label: '', tom: '' };
    let pts = 0;
    if (s.length >= 6) pts++;
    if (s.length >= 10) pts++;
    if (/[A-Z]/.test(s) && /[a-z]/.test(s)) pts++;
    if (/\d/.test(s)) pts++;
    if (/[^A-Za-z0-9]/.test(s)) pts++;
    if (s.length < 6) return { nivel: 15, label: 'Muito curta', tom: 'danger' };
    if (pts <= 2) return { nivel: 40, label: 'Fraca', tom: 'warning' };
    if (pts <= 3) return { nivel: 70, label: 'Boa', tom: 'success' };
    return { nivel: 100, label: 'Forte', tom: 'success' };
  }

  gerarSenha(): void {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%';
    const arr = new Uint32Array(12);
    crypto.getRandomValues(arr);
    this.dto.senha = Array.from(arr, n => chars[n % chars.length]).join('');
    this.senhaVisivel = true;
    this.limparErro('senha');
  }

  copiarSenha(): void {
    if (!this.dto.senha) return;
    navigator.clipboard?.writeText(this.dto.senha).then(
      () => this.toast.info('Senha copiada', 'Envie-a ao usuário por um canal seguro.'),
      () => this.toast.error('Não foi possível copiar a senha')
    );
  }

  // ---------- validação / salvar ----------
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  validar(): boolean {
    this.erros = {};
    if (!this.dto.nome.trim()) this.erros['nome'] = 'Informe o nome completo.';
    if (!this.dto.email.trim()) {
      this.erros['email'] = 'Informe o e-mail de acesso.';
    } else if (!UsuarioFormComponent.EMAIL_REGEX.test(this.dto.email.trim())) {
      this.erros['email'] = 'E-mail inválido. Ex.: nome@empresa.com.br';
    }
    if (this.modo === 'novo' && !this.dto.senha.trim()) this.erros['senha'] = 'Defina uma senha inicial.';
    if (this.dto.senha && this.dto.senha.length < 6) this.erros['senha'] = 'A senha deve ter no mínimo 6 caracteres.';
    if (!this.dto.perfilUsuario) this.erros['perfilUsuario'] = 'Escolha um perfil.';
    if (!this.dto.idEmpresa || this.dto.idEmpresa === 0) this.erros['idEmpresa'] = 'Selecione a empresa vinculada.';
    return Object.keys(this.erros).length === 0;
  }

  salvar(): void {
    if (this.salvando) return;
    if (!this.validar()) {
      setTimeout(() => (document.querySelector('.modal .is-invalid') as HTMLElement | null)?.focus());
      return;
    }
    this.salvando = true;
    this.erroGeral = '';

    const novo = this.modo === 'novo';
    const payload: UsuarioRequestDTO = { ...this.dto, nome: this.dto.nome.trim(), email: this.dto.email.trim() };
    const request = novo
      ? this.usuarioService.salvar(payload)
      : this.usuarioService.atualizar(this.usuario!.id!, payload);

    request.subscribe({
      next: () => {
        this.salvando = false;
        this.toast.success(novo ? 'Usuário cadastrado' : 'Alterações salvas',
          novo ? `${payload.nome} já pode acessar o sistema.` : `Os dados de ${payload.nome} foram atualizados.`);
        this.salvo.emit();
      },
      error: (err) => {
        this.salvando = false;
        const msg = typeof err?.error === 'string' ? err.error : err?.error?.message;
        this.erroGeral = msg || 'Erro ao salvar usuário. Verifique os dados e tente novamente.';
        this.toast.error('Não foi possível salvar o usuário', msg || undefined);
      }
    });
  }

  tentarFechar(): void {
    if (!this.salvando) this.fechar.emit();
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.tentarFechar();
  }
}
