import { AfterViewChecked, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, inject } from '@angular/core';

/**
 * Menu flutuante (position: fixed) para clique direito, botão "⋮" e menus suspensos.
 * Conteúdo projetado: `<button class="menu-item">`, `.menu-sep`, `.menu-label`.
 * Fecha ao clicar fora, ao escolher um item, com Esc, ao rolar a página ou redimensionar.
 *
 * Posição: `x`/`y` = canto superior esquerdo (ou direito, com `alinharDireita`).
 * Se não couber abaixo, abre acima de `yAcima` (padrão: o próprio `y`).
 */
@Component({
  selector: 'app-context-menu',
  standalone: true,
  host: { class: 'menu ctx-menu', role: 'menu', '(click)': 'onClickDentro($event)', '(contextmenu)': '$event.preventDefault()' },
  template: `<ng-content />`,
  styles: [`
    :host(.ctx-menu) { position: fixed; top: 0; left: 0; visibility: hidden; max-height: calc(100vh - 16px); overflow-y: auto; min-width: 220px; max-width: calc(100vw - 16px); }
    :host(.ctx-menu.is-pronto) { visibility: visible; }
    :host ::ng-deep .menu-item { min-height: 36px; }
    :host ::ng-deep .menu-item app-icon { color: var(--ink-mute); }
    :host ::ng-deep .menu-item.danger app-icon { color: inherit; }
    :host ::ng-deep .menu-item.is-on { color: var(--primary); font-weight: 500; }
    :host ::ng-deep .menu-item.is-on app-icon { color: var(--primary); }
    :host ::ng-deep .menu-item .menu-meta { margin-left: auto; padding-left: 16px; font-size: 12px; color: var(--ink-faint); }
    :host ::ng-deep .menu-item:disabled { opacity: .45; cursor: not-allowed; }
  `]
})
export class ContextMenuComponent implements OnChanges, AfterViewChecked, OnDestroy {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input() x = 0;
  @Input() y = 0;
  @Input() yAcima: number | null = null;
  @Input() alinharDireita = false;
  @Input() rotulo = 'Menu';

  @Output() fechar = new EventEmitter<void>();

  /** Ignora o próprio evento que abriu o menu (ele ainda está propagando quando o menu nasce). */
  private abertoEm = performance.now();
  private precisaPosicionar = true;

  ngOnChanges(): void {
    this.precisaPosicionar = true;
    this.abertoEm = performance.now();
    this.el.nativeElement.setAttribute('aria-label', this.rotulo);
  }

  ngAfterViewChecked(): void {
    if (!this.precisaPosicionar) return;
    this.precisaPosicionar = false;
    const host = this.el.nativeElement;
    const w = host.offsetWidth, h = host.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight, m = 8;
    let left = this.alinharDireita ? this.x - w : this.x;
    left = Math.max(m, Math.min(left, vw - w - m));
    let top = this.y;
    if (top + h > vh - m) {
      const acima = (this.yAcima ?? this.y) - h;
      top = acima >= m ? acima : Math.max(m, vh - h - m);
    }
    host.style.left = `${Math.round(left)}px`;
    host.style.top = `${Math.round(top)}px`;
    host.classList.add('is-pronto');
    const primeiro = host.querySelector<HTMLElement>('.menu-item:not(:disabled)');
    if (primeiro && document.activeElement?.closest('.ctx-menu') !== host) primeiro.focus({ preventScroll: true });
  }

  onClickDentro(e: MouseEvent): void {
    e.stopPropagation();
    const item = (e.target as HTMLElement).closest('.menu-item') as HTMLButtonElement | null;
    if (item && !item.disabled && !item.hasAttribute('data-manter')) this.fechar.emit();
  }

  private recente(e: Event): boolean { return e.timeStamp <= this.abertoEm + 1; }

  @HostListener('document:click', ['$event'])
  @HostListener('document:contextmenu', ['$event'])
  onFora(e: MouseEvent): void {
    if (this.recente(e)) return;
    if (!this.el.nativeElement.contains(e.target as Node)) this.fechar.emit();
  }

  @HostListener('document:keydown', ['$event'])
  onTecla(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopImmediatePropagation();
      e.preventDefault();
      this.fechar.emit();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const itens = Array.from(this.el.nativeElement.querySelectorAll<HTMLElement>('.menu-item:not(:disabled)'));
    if (!itens.length) return;
    e.preventDefault();
    const i = itens.indexOf(document.activeElement as HTMLElement);
    const prox = e.key === 'ArrowDown' ? (i + 1) % itens.length : (i <= 0 ? itens.length - 1 : i - 1);
    itens[prox].focus();
  }

  /** Rolagem em qualquer lugar (página, árvore de pastas, tabela) fecha o menu — exceto dentro dele. */
  private onScroll = (e: Event) => {
    if (this.el.nativeElement.contains(e.target as Node)) return;
    this.fechar.emit();
  };

  constructor() { window.addEventListener('scroll', this.onScroll, true); }

  ngOnDestroy(): void { window.removeEventListener('scroll', this.onScroll, true); }

  @HostListener('window:resize')
  onResize(): void { this.fechar.emit(); }
}
