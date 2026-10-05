import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { ArquivoService } from '../../../services/arquivo.service';
import { ObrigacaoPendenteService } from '../../../services/obrigacao-pendente.service';
import { UsuarioService } from '../../../services/usuario.service';
import { DecService } from '../../../services/dec.service';
import { ComunicacaoDecDTO, decPrecisaAtencao } from '../../../models/comunicacao-dec.dto';
import { ArquivoResponseDTO } from '../../../models/arquivo-response.dto';
import { ObrigacaoPendenteResponseDTO } from '../../../models/obrigacao-pendente-response.dto';
import { IconComponent } from '../../../shared/icon.component';
import { ContaComponent } from '../../conta/conta.component';
import { PrazoPipe, PrazoTomPipe, IniciaisPipe } from '../../../pipes/formatos.pipe';

interface NavItem {
  label: string;
  icon: string;
  link: (string | number)[];
  badge?: () => number;
  exact?: boolean;
}

interface NavSecao {
  titulo: string;
  itens: NavItem[];
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, IconComponent, ContaComponent, PrazoPipe, PrazoTomPipe, IniciaisPipe],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent implements OnInit {

  private readonly SIDEBAR_KEY = 'layout.sidebarRecolhida';

  @ViewChild('buscaInput') buscaInput?: ElementRef<HTMLInputElement>;

  recolhida = false;
  mobileAberta = false;
  nomeUsuario = '';
  emailUsuario = '';
  perfilUsuario = '';
  isAdmin = false;
  idEmpresa: number | null = null;

  termoBusca = '';
  menuNotifAberto = false;
  menuUsuarioAberto = false;
  /** Minha conta em pop-up flutuante. */
  contaAberta = false;

  abrirConta(): void {
    this.menuUsuarioAberto = false;
    this.contaAberta = true;
  }

  arquivosVencendo: ArquivoResponseDTO[] = [];
  obrigacoesVencidas: ObrigacaoPendenteResponseDTO[] = [];
  obrigacoesVencendo: ObrigacaoPendenteResponseDTO[] = [];

  secoes: NavSecao[] = [];

  constructor(
    private authService: AuthService,
    private arquivoService: ArquivoService,
    private obrigacaoService: ObrigacaoPendenteService,
    private usuarioService: UsuarioService,
    private decService: DecService,
    private router: Router
  ) {}

  ngOnInit(): void {
    try { this.recolhida = localStorage.getItem(this.SIDEBAR_KEY) === '1'; } catch {}

    const payload = this.authService.getPayload();
    if (payload) {
      this.emailUsuario = payload.sub ?? '';
      this.nomeUsuario = this.formatarNome(this.emailUsuario);
      this.isAdmin = this.authService.isAdmin();
      this.perfilUsuario = this.isAdmin ? 'Administrador' : 'Funcionário';
      this.idEmpresa = this.authService.getEmpresaId();
      this.carregarNotificacoes();
      // nome real cadastrado (o e-mail é só o fallback enquanto carrega)
      this.usuarioService.meuPerfil().subscribe({ next: (u) => { if (u?.nome) this.nomeUsuario = u.nome; } });
    }

    this.montarMenu();

    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      this.mobileAberta = false;
      this.menuNotifAberto = false;
      this.menuUsuarioAberto = false;
    });
  }

  private montarMenu(): void {
    const empresa: NavItem = this.isAdmin
      ? { label: 'Empresas', icon: 'building', link: ['/empresas'] }
      : { label: 'Minha empresa', icon: 'building', link: this.idEmpresa ? ['/empresas', this.idEmpresa] : ['/dashboard'] };

    this.secoes = [
      {
        titulo: 'Acompanhamento',
        itens: [
          { label: 'Painel', icon: 'dashboard', link: ['/dashboard'] },
          { label: 'Pendências', icon: 'list-checks', link: ['/obrigacoes-pendentes'], badge: () => this.obrigacoesVencidas.length },
          { label: 'Calendário', icon: 'calendar', link: ['/calendario'] },
          { label: 'Comunicações DEC', icon: 'inbox', link: ['/dec'], badge: () => this.decSemCiencia },
          { label: 'Arquivos', icon: 'folder', link: ['/arquivos'] },
        ]
      },
      {
        titulo: 'Operação',
        itens: [
          empresa,
          ...(this.isAdmin ? [{ label: 'Obrigações recorrentes', icon: 'repeat', link: ['/obrigacoes-recorrentes'] }] : []),
        ]
      },
      ...(this.isAdmin ? [{
        titulo: 'Administração',
        itens: [
          { label: 'Usuários', icon: 'user-cog', link: ['/usuarios'] },
          { label: 'Sócios', icon: 'users', link: ['/socios'] },
          { label: 'Auditoria', icon: 'activity', link: ['/logs'] },
        ]
      }] : []),
      {
        titulo: 'Ajuda',
        itens: [
          { label: 'Como usar', icon: 'info', link: ['/como-usar'] },
        ]
      },
    ];
  }

  atualizadoEm = new Date();

  carregarNotificacoes(): void {
    this.decService.listar().subscribe({
      next: (lista) => {
        const abertas = lista.filter(c => !c.cienteEm && !c.encerrada && c.status !== 'RESOLVIDA' && c.status !== 'ARQUIVADA');
        this.decSemCiencia = abertas.length;
        this.decAtencao = lista.filter(decPrecisaAtencao)
          .sort((a, b) => (a.diasRestantes ?? 99) - (b.diasRestantes ?? 99));
      },
      error: () => { this.decSemCiencia = 0; this.decAtencao = []; }
    });
    this.atualizadoEm = new Date();
    const daEmpresa = <T extends { idEmpresa: number }>(l: T[]) =>
      this.isAdmin || this.idEmpresa == null ? l : l.filter(x => x.idEmpresa === this.idEmpresa);

    this.arquivoService.vencendoEm(7).subscribe({
      next: (data) => {
        this.arquivosVencendo = daEmpresa(data)
          .filter(a => a.status !== 'ENTREGUE' && a.status !== 'ARQUIVADO' && !a.excluidoEm)
          .sort((a, b) => (a.diasParaVencer ?? 0) - (b.diasParaVencer ?? 0));
      }
    });
    // mesmo critério do painel: atrasada = VENCIDA ou PENDENTE com prazo já passado
    this.obrigacaoService.listar().subscribe({
      next: (data) => {
        const lista = daEmpresa(data);
        this.obrigacoesVencidas = lista.filter(o =>
          o.status === 'VENCIDA' || (o.status === 'PENDENTE' && o.diasParaVencer != null && o.diasParaVencer < 0));
        this.obrigacoesVencendo = lista
          .filter(o => o.status === 'PENDENTE' && o.diasParaVencer != null && o.diasParaVencer >= 0 && o.diasParaVencer <= 7)
          .sort((x, y) => (x.diasParaVencer ?? 0) - (y.diasParaVencer ?? 0));
      }
    });
  }

  /** Comunicações do DEC que ainda não tiveram ciência (contador do menu). */
  decSemCiencia = 0;
  decAtencao: ComunicacaoDecDTO[] = [];

  get totalNotificacoes(): number {
    return this.arquivosVencendo.length + this.obrigacoesVencidas.length + this.obrigacoesVencendo.length + this.decAtencao.length;
  }

  abrirDec(): void {
    this.menuNotifAberto = false;
    this.router.navigate(['/dec']);
  }

  get primeiroNome(): string {
    return this.nomeUsuario.split(' ')[0];
  }

  private formatarNome(email: string): string {
    return email.split('@')[0]
      .split(/[.\-_]/)
      .filter(Boolean)
      .map(p => p[0].toUpperCase() + p.slice(1))
      .join(' ');
  }

  toggleNotif(ev: Event): void {
    ev.stopPropagation();
    this.menuNotifAberto = !this.menuNotifAberto;
    this.menuUsuarioAberto = false;
  }

  toggleUsuario(ev: Event): void {
    ev.stopPropagation();
    this.menuUsuarioAberto = !this.menuUsuarioAberto;
    this.menuNotifAberto = false;
  }

  @HostListener('document:click', ['$event'])
  fecharMenus(ev: MouseEvent): void {
    const alvo = ev.target as HTMLElement;
    if (!alvo.closest('.pop-anchor')) {
      this.menuNotifAberto = false;
      this.menuUsuarioAberto = false;
    }
  }

  @HostListener('document:keydown', ['$event'])
  atalhos(ev: KeyboardEvent): void {
    const alvo = ev.target as HTMLElement;
    const digitando = alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT' || alvo.isContentEditable);
    if (((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') || (ev.key === '/' && !digitando)) {
      ev.preventDefault();
      this.buscaInput?.nativeElement.focus();
      this.buscaInput?.nativeElement.select();
    }
    if (ev.key === 'Escape') {
      this.menuNotifAberto = false;
      this.menuUsuarioAberto = false;
      this.mobileAberta = false;
    }
  }

  abrirArquivo(arq: ArquivoResponseDTO): void {
    this.menuNotifAberto = false;
    this.router.navigate(['/arquivos'], { queryParams: { id: arq.id } });
  }

  abrirObrigacoes(): void {
    this.menuNotifAberto = false;
    this.router.navigate(['/obrigacoes-pendentes']);
  }

  buscar(): void {
    const termo = this.termoBusca.trim();
    this.buscaInput?.nativeElement.blur();
    this.router.navigate(['/arquivos'], termo ? { queryParams: { q: termo } } : {});
  }

  toggleSidebar(): void {
    this.recolhida = !this.recolhida;
    try { localStorage.setItem(this.SIDEBAR_KEY, this.recolhida ? '1' : '0'); } catch {}
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
