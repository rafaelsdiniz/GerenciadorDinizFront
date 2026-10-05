import { Component, EventEmitter, HostListener, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UsuarioService } from '../../services/usuario.service';
import { EmpresaService } from '../../services/empresa.service';
import { AuthService } from '../../services/auth.service';
import { UsuarioResponseDTO } from '../../models/usuario-response.dto';
import { EmpresaResponseDTO } from '../../models/empresa-response.dto';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/ui/toast.service';
import { AvatarCorPipe, DocumentoPipe, IniciaisPipe } from '../../pipes/formatos.pipe';

type CampoSenha = 'atual' | 'nova' | 'confirmar';

@Component({
  selector: 'app-conta',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, AvatarCorPipe, DocumentoPipe, IniciaisPipe],
  templateUrl: './conta.component.html',
  styleUrl: './conta.component.css'
})
export class ContaComponent implements OnInit {
  private usuarioService = inject(UsuarioService);
  private empresaService = inject(EmpresaService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  /** Quando true, a conta abre como pop-up flutuante (menu do avatar) em vez de página. */
  @Input() emModal = false;
  @Output() fechar = new EventEmitter<void>();
  aba: 'perfil' | 'seguranca' | 'sessao' = 'perfil';

  fecharPeloFundo(ev: MouseEvent): void {
    if (this.emModal && ev.target === ev.currentTarget) this.fechar.emit();
  }

  @HostListener('document:keydown.escape')
  aoEsc(): void {
    if (this.emModal) this.fechar.emit();
  }

  perfil: UsuarioResponseDTO | null = null;
  empresa: EmpresaResponseDTO | null = null;
  carregando = false;
  erroCarregar = false;

  // ---------- nome ----------
  nome = '';
  salvandoNome = false;

  // ---------- senha ----------
  senhaAtual = '';
  novaSenha = '';
  confirmarSenha = '';
  visivel: Record<CampoSenha, boolean> = { atual: false, nova: false, confirmar: false };
  tocado: Record<CampoSenha, boolean> = { atual: false, nova: false, confirmar: false };
  salvandoSenha = false;
  erroSenha = '';

  /** Expiração da sessão atual (claim exp do token). */
  readonly expiraEm: Date | null = (() => {
    const exp = this.auth.getPayload()?.exp;
    return exp ? new Date(exp * 1000) : null;
  })();

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.erroCarregar = false;
    this.usuarioService.meuPerfil().subscribe({
      next: (u) => {
        this.perfil = u;
        this.nome = u.nome;
        this.carregando = false;
        this.carregarEmpresa(u.idEmpresa);
      },
      error: () => {
        this.carregando = false;
        this.erroCarregar = true;
        this.toast.error('Não foi possível carregar sua conta', 'Verifique sua conexão e tente novamente.');
      }
    });
  }

  private carregarEmpresa(id: number | null | undefined): void {
    if (!id) return;
    this.empresaService.buscarPorId(id).subscribe({
      next: (e) => (this.empresa = e),
      error: () => (this.empresa = null)
    });
  }

  get isAdmin(): boolean { return this.perfil?.perfilUsuario === 'ADMIN'; }

  // ---------- nome ----------
  get nomeAlterado(): boolean {
    return !!this.perfil && this.nome.trim() !== this.perfil.nome;
  }

  get nomeValido(): boolean {
    return this.nome.trim().length > 0;
  }

  desfazerNome(): void {
    if (this.perfil) this.nome = this.perfil.nome;
  }

  salvarNome(): void {
    if (this.salvandoNome || !this.nomeAlterado || !this.nomeValido) return;
    this.salvandoNome = true;
    const nome = this.nome.trim();
    this.usuarioService.atualizarMeuNome(nome).subscribe({
      next: (u) => {
        this.salvandoNome = false;
        this.perfil = { ...this.perfil!, ...u };
        this.nome = this.perfil.nome;
        this.toast.success('Nome atualizado', `Você agora aparece como ${this.perfil.nome}.`);
      },
      error: (err) => {
        this.salvandoNome = false;
        this.toast.error('Não foi possível salvar o nome', this.mensagemErro(err) || 'Tente novamente em instantes.');
      }
    });
  }

  // ---------- senha: regras ----------
  get regraTamanho(): boolean { return this.novaSenha.length >= 8; }
  get regraLetraNumero(): boolean { return /[A-Za-z]/.test(this.novaSenha) && /\d/.test(this.novaSenha); }
  get regraDiferente(): boolean { return !!this.novaSenha && this.novaSenha !== this.senhaAtual; }
  get confirmacaoOk(): boolean { return !!this.confirmarSenha && this.confirmarSenha === this.novaSenha; }

  get senhaValida(): boolean {
    return !!this.senhaAtual && this.regraTamanho && this.regraLetraNumero && this.regraDiferente && this.confirmacaoOk;
  }

  get temAlgoDigitado(): boolean {
    return !!(this.senhaAtual || this.novaSenha || this.confirmarSenha);
  }

  get erroAtual(): string {
    return this.tocado.atual && !this.senhaAtual ? 'Informe a sua senha atual.' : '';
  }

  get erroNova(): string {
    if (!this.tocado.nova || !this.novaSenha) return this.tocado.nova ? 'Informe a nova senha.' : '';
    if (!this.regraTamanho) return 'A nova senha deve ter no mínimo 8 caracteres.';
    if (!this.regraLetraNumero) return 'Use pelo menos uma letra e um número.';
    if (this.senhaAtual && !this.regraDiferente) return 'A nova senha deve ser diferente da atual.';
    return '';
  }

  get erroConfirmar(): string {
    if (!this.confirmarSenha) return this.tocado.confirmar ? 'Repita a nova senha.' : '';
    if (!this.tocado.confirmar && this.confirmarSenha.length < this.novaSenha.length) return '';
    return this.confirmarSenha !== this.novaSenha ? 'As senhas não coincidem.' : '';
  }

  get forcaSenha(): { nivel: number; label: string; tom: string } {
    const s = this.novaSenha;
    if (!s) return { nivel: 0, label: '', tom: '' };
    let pts = 0;
    if (s.length >= 8) pts++;
    if (s.length >= 12) pts++;
    if (/[A-Z]/.test(s) && /[a-z]/.test(s)) pts++;
    if (/\d/.test(s)) pts++;
    if (/[^A-Za-z0-9]/.test(s)) pts++;
    if (s.length < 8) return { nivel: 15, label: 'Muito curta', tom: 'danger' };
    if (pts <= 2) return { nivel: 40, label: 'Fraca', tom: 'warning' };
    if (pts <= 3) return { nivel: 70, label: 'Boa', tom: 'success' };
    return { nivel: 100, label: 'Forte', tom: 'success' };
  }

  alternarVisivel(campo: CampoSenha): void {
    this.visivel[campo] = !this.visivel[campo];
  }

  aoDigitar(): void {
    this.erroSenha = '';
  }

  limparSenha(): void {
    this.senhaAtual = '';
    this.novaSenha = '';
    this.confirmarSenha = '';
    this.erroSenha = '';
    this.visivel = { atual: false, nova: false, confirmar: false };
    this.tocado = { atual: false, nova: false, confirmar: false };
  }

  alterarSenha(): void {
    this.tocado = { atual: true, nova: true, confirmar: true };
    if (this.salvandoSenha || !this.senhaValida) return;
    this.salvandoSenha = true;
    this.erroSenha = '';
    this.usuarioService.alterarMinhaSenha(this.senhaAtual, this.novaSenha).subscribe({
      next: () => {
        this.salvandoSenha = false;
        this.limparSenha();
        this.toast.success('Senha alterada com sucesso', 'Use a nova senha no próximo acesso.');
      },
      error: (err) => {
        this.salvandoSenha = false;
        const msg = this.mensagemErro(err);
        this.erroSenha = msg || 'Não foi possível alterar a senha. Tente novamente.';
        this.toast.error('Senha não alterada', msg || undefined);
      }
    });
  }

  // ---------- sessão ----------
  sair(): void {
    this.fechar.emit();
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  /** Extrai a mensagem do backend: { codigo, mensagem } ou { violations: [{ message }] }. */
  private mensagemErro(err: any): string {
    const e = err?.error;
    if (!e) return '';
    if (typeof e === 'string') return e;
    return e.mensagem || e.violations?.[0]?.message || e.message || '';
  }
}
