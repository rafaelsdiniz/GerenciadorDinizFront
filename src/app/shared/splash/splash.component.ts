import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ApiStatusService } from '../../services/api-status.service';

/**
 * Animação de entrada (uma vez por sessão). Enquanto ela roda, a API e o banco são acordados;
 * fica no mínimo MIN_MS e sai assim que a API responde (ou em MAX_MS, o que vier primeiro).
 */
@Component({
  selector: 'app-splash',
  standalone: true,
  template: `
    @if (visivel) {
      <div class="splash" [class.saindo]="saindo" role="status" aria-live="polite">
        <span class="glow g1"></span><span class="glow g2"></span>
        <div class="centro">
          <div class="marca">
            <span class="anel a1"></span><span class="anel a2"></span>
            <img src="images/logo/logo-final.png" alt="Diniz Assessoria Contábil" class="logo" />
          </div>
          <span class="linha"></span>
          <p class="slogan">Gestão contábil inteligente</p>
        </div>
        <div class="rodape">
          <div class="barra" [class.cheia]="api.estado() === 'pronto'"><span></span></div>
          <p class="status">{{ texto }}</p>
        </div>
      </div>
    }
  `,
  styles: [`
    .splash {
      position: fixed; inset: 0; z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center;
      overflow: hidden; color: #fff;
      background: radial-gradient(110% 90% at 50% 0%, #1e2b5c 0%, #0b1433 52%, #060b1f 100%);
      transition: opacity .55s cubic-bezier(.4,0,.2,1), visibility .55s;
    }
    .splash.saindo { opacity: 0; visibility: hidden; }
    .splash.saindo .centro { transform: scale(1.06); }
    .glow { position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none; }
    .g1 { width: 520px; height: 520px; top: -180px; left: 50%; margin-left: -260px; background: #3d63e0; opacity: .28; animation: pulsar 4s ease-in-out infinite; }
    .g2 { width: 420px; height: 420px; bottom: -200px; right: -120px; background: #c9a961; opacity: .18; }

    .centro { position: relative; display: flex; flex-direction: column; align-items: center; transition: transform .55s cubic-bezier(.4,0,.2,1); }
    .marca { position: relative; display: grid; place-items: center; width: 260px; height: 160px; }
    .logo { position: relative; width: 190px; height: auto; opacity: 0; animation: logoIn .9s cubic-bezier(.22,.9,.3,1) .15s forwards; }
    .anel { position: absolute; left: 50%; top: 50%; width: 150px; height: 150px; margin: -75px 0 0 -75px; border-radius: 50%;
      border: 1.5px solid rgba(201,169,97,.55); opacity: 0; animation: onda 2.6s cubic-bezier(.22,.9,.3,1) .5s infinite; }
    .a2 { animation-delay: 1.8s; }
    .linha { display: block; height: 2px; width: 0; margin-top: 6px; border-radius: 2px;
      background: linear-gradient(90deg, transparent, #c9a961, transparent); animation: linha .9s cubic-bezier(.22,.9,.3,1) .7s forwards; }
    .slogan { margin: 16px 0 0; font-size: 13px; font-weight: 500; letter-spacing: .32em; text-transform: uppercase;
      color: rgba(255,255,255,.72); opacity: 0; animation: subir .7s cubic-bezier(.22,.9,.3,1) 1s forwards; }

    .rodape { position: absolute; bottom: 56px; display: flex; flex-direction: column; align-items: center; gap: 12px; opacity: 0;
      animation: subir .6s ease 1.2s forwards; }
    .barra { position: relative; width: 180px; height: 3px; border-radius: 3px; overflow: hidden; background: rgba(255,255,255,.12); }
    .barra span { position: absolute; inset: 0; width: 40%; border-radius: 3px; background: #c9a961; animation: vaivem 1.3s ease-in-out infinite; }
    .barra.cheia span { width: 100%; animation: none; transition: width .3s; }
    .status { margin: 0; font-size: 12.5px; color: rgba(255,255,255,.6); }

    @keyframes logoIn { from { opacity: 0; transform: translateY(14px) scale(.92); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
    @keyframes onda { 0% { opacity: .9; transform: scale(.6); } 100% { opacity: 0; transform: scale(1.9); } }
    @keyframes linha { to { width: 180px; } }
    @keyframes subir { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    @keyframes vaivem { 0% { left: -40%; } 100% { left: 100%; } }
    @keyframes pulsar { 50% { opacity: .4; } }
    @media (prefers-reduced-motion: reduce) {
      .logo, .linha, .slogan, .rodape { animation-duration: .01s; animation-delay: 0s; }
      .anel, .g1 { animation: none; }
    }
  `]
})
export class SplashComponent implements OnInit, OnDestroy {
  private static readonly VISTO = 'splash.visto';
  private static readonly MIN_MS = 2400;
  private static readonly MAX_MS = 7000;

  readonly api = inject(ApiStatusService);
  visivel = false;
  saindo = false;
  private inicio = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  get texto(): string {
    switch (this.api.estado()) {
      case 'pronto': return 'Tudo pronto';
      case 'lento': return 'Acordando o servidor, só um instante…';
      case 'offline': return 'Servidor indisponível no momento';
      default: return 'Conectando ao servidor…';
    }
  }

  ngOnInit(): void {
    let visto = false;
    try { visto = sessionStorage.getItem(SplashComponent.VISTO) === '1'; } catch {}
    if (visto) return;
    this.visivel = true;
    this.inicio = Date.now();
    this.timer = setInterval(() => this.verificar(), 150);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private verificar(): void {
    const t = Date.now() - this.inicio;
    const respondeu = this.api.estado() === 'pronto' || this.api.estado() === 'offline';
    if (t < SplashComponent.MIN_MS || (!respondeu && t < SplashComponent.MAX_MS)) return;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    try { sessionStorage.setItem(SplashComponent.VISTO, '1'); } catch {}
    this.saindo = true;
    setTimeout(() => (this.visivel = false), 600);
  }
}
