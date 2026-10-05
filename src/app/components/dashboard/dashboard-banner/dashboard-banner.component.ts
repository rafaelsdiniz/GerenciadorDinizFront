import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon.component';

export interface Slide {
  tom: 'danger' | 'primary' | 'success';
  icone: string;
  titulo: string;
  texto: string;
  cta: string;
  rota: string;
  queryParams?: Record<string, string | number>;
}

const SELO: Record<Slide['tom'], string> = { danger: 'Urgente', primary: 'Atenção', success: 'Tudo em dia' };

/** Banner em carrossel do painel: um destaque por vez, com ilustração, chamada e ação. */
@Component({
  selector: 'app-dashboard-banner',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './dashboard-banner.component.html',
  styleUrl: './dashboard-banner.component.css'
})
export class DashboardBannerComponent implements OnInit, OnChanges, OnDestroy {
  private readonly FECHADO_KEY = 'dashboard.bannerFechado';

  @Input() slides: Slide[] = [];
  /** Texto ao lado de "Painel" (escritório ou empresa · data). */
  @Input() contexto = '';
  @Input() carregando = false;
  @Input() atualizadoEm: Date | null = null;
  @Output() abrir = new EventEmitter<Slide>();
  @Output() atualizar = new EventEmitter<void>();

  atual = 0;
  fechado = false;
  readonly selo = SELO;
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    try { this.fechado = sessionStorage.getItem(this.FECHADO_KEY) === '1'; } catch {}
  }

  ngOnChanges(): void {
    if (this.atual >= this.slides.length) this.atual = 0;
    this.iniciar();
  }

  ngOnDestroy(): void {
    this.parar();
  }

  get slide(): Slide | null {
    return this.slides[this.atual] ?? null;
  }

  ir(i: number): void {
    if (!this.slides.length) return;
    this.atual = (i + this.slides.length) % this.slides.length;
    this.iniciar();
  }

  iniciar(): void {
    this.parar();
    if (!this.fechado && this.slides.length > 1) this.timer = setInterval(() => this.ir(this.atual + 1), 8000);
  }

  parar(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  fechar(): void {
    this.fechado = true;
    this.parar();
    try { sessionStorage.setItem(this.FECHADO_KEY, '1'); } catch {}
  }

  reabrir(): void {
    this.fechado = false;
    try { sessionStorage.removeItem(this.FECHADO_KEY); } catch {}
    this.iniciar();
  }
}
