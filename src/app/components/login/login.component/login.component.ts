import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LoginRequestDTO } from '../../../models/login-request.dto';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {

  dto: LoginRequestDTO = {
    email: '',
    senha: ''
  };

  senhaVisivel = false;
  carregando = false;
  erro = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  toggleSenha(): void {
    this.senhaVisivel = !this.senhaVisivel;
  }

entrar(): void {
  this.erro = '';
  this.carregando = true;

  this.authService.login(this.dto).subscribe({
    next: () => {
      this.carregando = false;
      this.router.navigate(['/dashboard']);
    },
    error: () => {
      this.carregando = false;
      this.erro = 'Email ou senha inválidos.';
    }
  });
}
}