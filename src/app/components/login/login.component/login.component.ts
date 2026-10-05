import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LoginRequestDTO } from '../../../models/login-request.dto';
import { AuthService } from '../../../services/auth.service';
import { IconComponent } from '../../../shared/icon.component';
import { ApiStatusService } from '../../../services/api-status.service';

interface PerfilDemo { nome: string; papel: string; detalhe: string; email: string; iniciais: string; tom: 'primary' | 'accent' | 'success'; }

/** Logins de demonstração para a banca avaliadora (dados fictícios). */
const DEMO: PerfilDemo[] = [
  { nome: 'Rafael', papel: 'Escritório', detalhe: 'Administrador · vê toda a carteira', email: 'rafael@diniz.com.br', iniciais: 'RD', tom: 'primary' },
  { nome: 'Maria', papel: 'Cliente', detalhe: 'Padaria Pão Quente', email: 'maria@paoquente.com.br', iniciais: 'MS', tom: 'accent' },
  { nome: 'Carlos', papel: 'Cliente', detalhe: 'Auto Peças Tocantins', email: 'carlos@topecas.com.br', iniciais: 'CA', tom: 'success' }
];
const SENHA_DEMO = '123456';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {

  dto: LoginRequestDTO = {
    email: '',
    senha: ''
  };

  readonly ano = new Date().getFullYear();
  readonly api = inject(ApiStatusService);
  readonly demo = DEMO;
  readonly senhaDemo = SENHA_DEMO;
  entrandoComo: string | null = null;
  senhaCopiada = false;
  senhaVisivel = false;
  ajudaSenha = false;
  carregando = false;
  erro = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  toggleSenha(): void {
    this.senhaVisivel = !this.senhaVisivel;
  }

  /** Preenche e entra com um perfil de demonstração. */
  entrarComo(p: PerfilDemo): void {
    if (this.carregando) return;
    this.dto = { email: p.email, senha: SENHA_DEMO };
    this.entrandoComo = p.email;
    this.entrar();
  }

  copiarSenha(): void {
    navigator.clipboard?.writeText(SENHA_DEMO).then(() => {
      this.senhaCopiada = true;
      setTimeout(() => (this.senhaCopiada = false), 1800);
    }).catch(() => {});
  }

  entrar(): void {
    this.erro = '';
    this.carregando = true;

    this.authService.login(this.dto).subscribe({
      next: () => {
        this.carregando = false;
        this.router.navigate(['/dashboard']);
      },
      error: (e: { status?: number }) => {
        this.carregando = false;
        this.entrandoComo = null;
        this.erro = e?.status === 0
          ? 'Não foi possível falar com o servidor. Aguarde alguns segundos e tente de novo.'
          : 'E-mail ou senha inválidos.';
      }
    });
  }
}