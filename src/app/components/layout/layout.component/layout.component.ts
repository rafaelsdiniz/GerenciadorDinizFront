import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { ArquivoService } from '../../../services/arquivo.service';
import { ArquivoResponseDTO } from '../../../models/arquivo-response.dto';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent implements OnInit {

  recolhida = false;
  nomeUsuario = '';
  inicialUsuario = '';
  perfilUsuario = '';
  isAdmin = false;
  idEmpresa: number | null = null;

  termoBusca = '';
  menuNotifAberto = false;
  notificacoes: ArquivoResponseDTO[] = [];

  constructor(
    private authService: AuthService,
    private arquivoService: ArquivoService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const payload = this.authService.getPayload();
    if (payload) {
      const email = payload.sub ?? '';
      this.nomeUsuario = email.split('@')[0];
      this.inicialUsuario = this.nomeUsuario.charAt(0).toUpperCase();
      this.perfilUsuario = payload.groups?.[0] ?? '';
      this.isAdmin = this.authService.isAdmin();
      this.idEmpresa = this.authService.getEmpresaId();

      this.carregarNotificacoes();
    }
  }

  carregarNotificacoes(): void {
    // Vencendo em 7 dias
    this.arquivoService.vencendoEm(7).subscribe({
      next: (data) => {
        // Filtra para remover os já entregues ou arquivados (se a query não filtrar)
        this.notificacoes = data.filter(a => a.status !== 'ENTREGUE' && a.status !== 'ARQUIVADO');
      }
    });
  }

  toggleNotif(): void {
    this.menuNotifAberto = !this.menuNotifAberto;
  }

  abrirNotificacao(arq: ArquivoResponseDTO): void {
    this.menuNotifAberto = false;
    this.router.navigate(['/arquivos'], { queryParams: { id: arq.id } });
  }

  buscar(): void {
    const termo = this.termoBusca.trim();
    if (termo) {
      this.router.navigate(['/arquivos'], { queryParams: { q: termo } });
    } else {
      this.router.navigate(['/arquivos']);
    }
  }

  get linkEmpresa(): (string | number)[] {
    if (this.isAdmin) return ['/empresas'];
    return this.idEmpresa ? ['/empresas', this.idEmpresa] : ['/dashboard'];
  }

  get labelEmpresa(): string {
    return this.isAdmin ? 'Empresas' : 'Minha empresa';
  }

  toggleSidebar(): void {
    this.recolhida = !this.recolhida;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}