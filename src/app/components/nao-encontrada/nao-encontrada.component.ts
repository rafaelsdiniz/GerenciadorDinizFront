import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { IconComponent } from '../../shared/icon.component';

/** Página 404: qualquer endereço que não existe no portal. */
@Component({
  selector: 'app-nao-encontrada',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <main class="nf">
      <span class="glow g1"></span><span class="glow g2"></span>
      <a class="marca" [routerLink]="logado ? '/dashboard' : '/login'" aria-label="Diniz — início">
        <img src="images/logo/logo-final.png" alt="Diniz" />
      </a>

      <div class="conteudo">
        <div class="codigo" aria-hidden="true">
          <span class="num n1">4</span>
          <svg class="pasta" viewBox="0 0 220 200">
            <g class="folhas">
              <rect class="f f1" x="58" y="34" width="70" height="88" rx="8" />
              <rect class="f f2" x="96" y="24" width="70" height="88" rx="8" />
              <rect class="l" x="108" y="42" width="36" height="6" rx="3" />
              <rect class="l soft" x="108" y="56" width="46" height="5" rx="2.5" />
              <rect class="l soft" x="108" y="68" width="40" height="5" rx="2.5" />
            </g>
            <path class="tras" d="M30 74 Q30 62 42 62 H90 L104 76 H178 Q190 76 190 88 V170 Q190 182 178 182 H42 Q30 182 30 170 Z" />
            <path class="frente" d="M30 104 Q30 94 42 94 H178 Q190 94 190 104 V170 Q190 182 178 182 H42 Q30 182 30 170 Z" />
            <g class="lupa">
              <circle cx="150" cy="140" r="26" class="lente" />
              <circle cx="150" cy="140" r="26" class="aro" />
              <path d="M169 159 L190 180" class="cabo" />
              <path d="M141 133 q9 -8 18 0" class="brilho" />
            </g>
          </svg>
          <span class="num n2">4</span>
        </div>

        <h1>Página não encontrada</h1>
        <p class="texto">
          O endereço <code>{{ caminho }}</code> não existe ou foi movido.
          Seus documentos e prazos continuam seguros no portal.
        </p>

        <div class="acoes">
          <a class="btn btn-primary btn-lg" [routerLink]="logado ? '/dashboard' : '/login'">
            <app-icon [name]="logado ? 'home' : 'log-in'" [size]="16" [stroke]="2" />
            {{ logado ? 'Voltar ao painel' : 'Ir para o login' }}
          </a>
          <button type="button" class="btn btn-secondary btn-lg" (click)="voltar()">
            <app-icon name="arrow-left" [size]="16" [stroke]="2" /> Página anterior
          </button>
        </div>

        @if (logado) {
          <nav class="atalhos" aria-label="Atalhos">
            <a routerLink="/obrigacoes-pendentes"><app-icon name="list-checks" [size]="14" /> Pendências</a>
            <a routerLink="/arquivos"><app-icon name="folder" [size]="14" /> Arquivos</a>
            <a routerLink="/calendario"><app-icon name="calendar" [size]="14" /> Calendário</a>
            <a routerLink="/assistente"><app-icon name="sparkles" [size]="14" /> Assistente IA</a>
          </nav>
        }
      </div>
    </main>
  `,
  styles: [`
    .nf {
      position: relative; min-height: 100dvh; display: flex; align-items: center; justify-content: center; overflow: hidden;
      padding: 96px 16px 48px; background: radial-gradient(80% 60% at 50% 0%, var(--primary-50), var(--canvas) 70%);
    }
    .glow { position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; }
    .g1 { width: 420px; height: 420px; top: -160px; left: -120px; background: var(--primary-100); opacity: .8; }
    .g2 { width: 380px; height: 380px; bottom: -160px; right: -100px; background: var(--accent-200); opacity: .6; }
    .marca {
      position: absolute; top: 24px; left: 24px; display: grid; place-items: center; padding: 10px 16px;
      border-radius: var(--radius-md); background: linear-gradient(135deg, var(--navy-800), var(--navy-950)); box-shadow: var(--shadow-2);
    }
    .marca img { height: 26px; width: auto; }

    .conteudo { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; max-width: 560px; }
    .codigo { display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 8px; }
    .num {
      font-size: clamp(96px, 16vw, 168px); font-weight: 800; line-height: 1; letter-spacing: -.04em;
      background: linear-gradient(180deg, var(--primary) 10%, var(--navy-900)); -webkit-background-clip: text; background-clip: text; color: transparent;
      animation: cair .8s var(--ease-spring) both;
    }
    .n2 { animation-delay: .16s; }
    .pasta { width: clamp(130px, 22vw, 220px); height: auto; overflow: visible; animation: cair .8s var(--ease-spring) .08s both; }
    .tras { fill: var(--accent-strong); }
    .frente { fill: var(--accent); }
    .f { fill: #fff; stroke: var(--hairline-strong); stroke-width: 2; }
    .l { fill: var(--primary); } .l.soft { fill: var(--primary-200); }
    .folhas { animation: flutuar 3.2s ease-in-out infinite; }
    .f1 { transform-origin: 93px 78px; transform: rotate(-8deg); }
    .lupa { transform-origin: 150px 140px; animation: procurar 3.6s ease-in-out infinite; }
    .lente { fill: rgba(255, 255, 255, .55); }
    .aro { fill: none; stroke: var(--navy-900); stroke-width: 7; }
    .cabo { stroke: var(--navy-900); stroke-width: 10; stroke-linecap: round; }
    .brilho { fill: none; stroke: #fff; stroke-width: 3; stroke-linecap: round; }

    h1 { margin: 8px 0 8px; font-size: clamp(22px, 3vw, 28px); font-weight: 650; letter-spacing: -.02em; color: var(--ink); animation: subir .6s var(--ease-out) .3s both; }
    .texto { margin: 0; font-size: 15px; line-height: 1.6; color: var(--ink-mute); animation: subir .6s var(--ease-out) .38s both; }
    .texto code {
      padding: 1px 6px; border-radius: var(--radius-xs); background: var(--canvas-sunken); color: var(--ink-2);
      font-family: var(--font-mono); font-size: 13px; word-break: break-all;
    }
    .acoes { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 28px; animation: subir .6s var(--ease-out) .46s both; }
    .atalhos { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 18px; margin-top: 28px; animation: subir .6s var(--ease-out) .54s both; }
    .atalhos a { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 500; color: var(--primary); text-decoration: none; }
    .atalhos a:hover { text-decoration: underline; }

    @keyframes cair { from { opacity: 0; transform: translateY(-28px) scale(.9); } to { opacity: 1; transform: none; } }
    @keyframes subir { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    @keyframes flutuar { 50% { transform: translateY(-7px); } }
    @keyframes procurar { 0%, 100% { transform: translate(0, 0) rotate(0); } 30% { transform: translate(-18px, -10px) rotate(-8deg); } 65% { transform: translate(6px, -16px) rotate(6deg); } }
    @media (prefers-reduced-motion: reduce) {
      .num, .pasta, .folhas, .lupa, h1, .texto, .acoes, .atalhos { animation: none; }
    }
    @media (max-width: 480px) {
      .acoes { width: 100%; flex-direction: column; }
      .acoes .btn { width: 100%; justify-content: center; }
    }
  `]
})
export class NaoEncontradaComponent {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  readonly logado = inject(AuthService).isLogado();
  readonly caminho = this.router.url;

  voltar(): void {
    if (history.length > 1) this.location.back();
    else this.router.navigate([this.logado ? '/dashboard' : '/login']);
  }
}
