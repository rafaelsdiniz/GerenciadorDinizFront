import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { IconComponent } from '../icon.component';

/**
 * Rodapé de tabela com paginação client-side.
 * Uso: <app-paginador [total]="lista.length" rotulo="pessoas" [(pagina)]="pagina" [(porPagina)]="porPagina" />
 * O host já é um `.table-footer`; coloque-o logo após o `.table-wrap` dentro do `.table-card`.
 */
@Component({
  selector: 'app-paginador',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'table-footer pager' },
  template: `
    <span class="tnum">
      @if (total() > 0) {
        Mostrando <strong>{{ inicio() }}</strong> a <strong>{{ fim() }}</strong> de <strong>{{ total() }}</strong> {{ rotulo() }}
      } @else {
        Nenhum registro
      }
    </span>
    <div class="table-footer-right">
      <label class="rows-per-page">
        <span>Linhas por página</span>
        <select class="select" [value]="porPagina()" (change)="mudarTamanho($any($event.target).value)" aria-label="Linhas por página">
          @for (o of opcoes(); track o) { <option [value]="o" [selected]="o === porPagina()">{{ o }}</option> }
        </select>
      </label>
      <nav class="pagination" aria-label="Paginação">
        <button type="button" class="page-btn nav" [disabled]="paginaAtual() <= 1" (click)="ir(paginaAtual() - 1)" aria-label="Página anterior" title="Página anterior">
          <app-icon name="chevron-left" [size]="16" />
        </button>
        @for (p of paginas(); track $index) {
          @if (p === 0) {
            <span class="pager-gap" aria-hidden="true">…</span>
          } @else {
            <button type="button" class="page-btn tnum" [class.active]="p === paginaAtual()" (click)="ir(p)"
                    [attr.aria-current]="p === paginaAtual() ? 'page' : null" [attr.aria-label]="'Página ' + p">{{ p }}</button>
          }
        }
        <button type="button" class="page-btn nav" [disabled]="paginaAtual() >= totalPaginas()" (click)="ir(paginaAtual() + 1)" aria-label="Próxima página" title="Próxima página">
          <app-icon name="chevron-right" [size]="16" />
        </button>
      </nav>
    </div>
  `,
  styles: [`
    :host { flex-wrap: wrap; gap: 12px 24px; }
    .rows-per-page { white-space: nowrap; }
    .rows-per-page .select { padding-right: 28px; background-position: right 8px center; }
    .pager-gap { min-width: 20px; text-align: center; color: var(--ink-faint); }
    @media (max-width: 560px) { :host { justify-content: center; } .rows-per-page span { display: none; } }
  `]
})
export class PaginadorComponent {
  readonly total = input(0);
  readonly rotulo = input('registros');
  readonly opcoes = input<number[]>([10, 25, 50]);
  readonly pagina = model(1);
  readonly porPagina = model(10);

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / this.porPagina())));
  /** página efetiva (corrige automaticamente quando o filtro reduz o total) */
  readonly paginaAtual = computed(() => Math.min(Math.max(1, this.pagina()), this.totalPaginas()));
  readonly inicio = computed(() => this.total() === 0 ? 0 : (this.paginaAtual() - 1) * this.porPagina() + 1);
  readonly fim = computed(() => Math.min(this.total(), this.paginaAtual() * this.porPagina()));

  /** números de página com 0 representando reticências */
  readonly paginas = computed(() => {
    const n = this.totalPaginas(), p = this.paginaAtual();
    if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);
    const set = [1, p - 1, p, p + 1, n].filter(x => x >= 1 && x <= n);
    const uniq = [...new Set(set)].sort((a, b) => a - b);
    const out: number[] = [];
    uniq.forEach((x, i) => { if (i && x - uniq[i - 1] > 1) out.push(0); out.push(x); });
    return out;
  });

  ir(p: number): void {
    this.pagina.set(Math.min(Math.max(1, p), this.totalPaginas()));
  }

  mudarTamanho(v: string): void {
    this.porPagina.set(Number(v) || 10);
    this.pagina.set(1);
  }
}

/** Fatia uma lista para a página atual (mesma regra de correção do paginador). */
export function paginar<T>(lista: T[], pagina: number, porPagina: number): T[] {
  const total = Math.max(1, Math.ceil(lista.length / porPagina));
  const p = Math.min(Math.max(1, pagina), total);
  return lista.slice((p - 1) * porPagina, p * porPagina);
}
