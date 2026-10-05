import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { saveAs } from 'file-saver';
import { IconComponent } from '../../../shared/icon.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { AuthService } from '../../../services/auth.service';
import { IaService } from '../../../services/ia.service';
import { StatusIa } from '../../../models/documento-analisado.dto';

/**
 * Cartão da página "Como usar": explica a leitura inteligente de documentos e oferece
 * guias fictícias (DAS e FGTS) montadas para a empresa do usuário, para testar o recurso.
 */
@Component({
  selector: 'app-ia-exemplos',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <section class="card ia-ex">
      <header class="card-header plain">
        <div>
          <h2 class="card-title"><app-icon name="sparkles" [size]="17" /> Leitura inteligente de documentos</h2>
          <p class="card-subtitle">Ao escolher uma guia para enviar, o sistema lê o PDF e confere os dados antes do envio.</p>
        </div>
        @if (status) {
          <span class="badge" [class.badge-accent]="status.configurada" [class.badge-neutral]="!status.configurada">
            <app-icon [name]="status.configurada ? 'sparkles' : 'zap'" [size]="12" />
            {{ status.configurada ? 'IA ativa · ' + (status.modelo || status.provedor) : 'Leitura automática ativa' }}
          </span>
        }
      </header>
      <div class="card-body ia-ex-body">
        <ul class="ia-ex-lista">
          <li><app-icon name="scan-text" [size]="15" /> <span>Extrai <strong>tipo, valor, vencimento, competência, CNPJ e linha digitável</strong> (PDF, XML, TXT, CSV).</span></li>
          <li><app-icon name="shield-check" [size]="15" /> <span>Confere com a obrigação e a empresa: avisa se o <strong>CNPJ é de outra empresa</strong>, se a guia é de <strong>outro imposto</strong> ou se o vencimento/competência não batem.</span></li>
          <li><app-icon name="banknote" [size]="15" /> <span>Preenche descrição, categoria e vencimento, mostra o <strong>valor da guia</strong> nas pendências e permite <strong>copiar o código de barras</strong>.</span></li>
        </ul>
        @if (logado) {
          <div class="ia-ex-acoes">
            <span class="text-sm text-mute">Guias fictícias para testar (geradas para a sua empresa):</span>
            <button type="button" class="btn btn-secondary btn-sm" (click)="baixar('das')" [disabled]="baixando !== null">
              @if (baixando === 'das') { <span class="spinner"></span> } @else { <app-icon name="download" [size]="14" /> } Guia DAS
            </button>
            <button type="button" class="btn btn-secondary btn-sm" (click)="baixar('fgts')" [disabled]="baixando !== null">
              @if (baixando === 'fgts') { <span class="spinner"></span> } @else { <app-icon name="download" [size]="14" /> } Guia FGTS
            </button>
            <a class="btn btn-outline btn-sm" routerLink="/obrigacoes-pendentes">Testar em Pendências <app-icon name="arrow-right" [size]="14" /></a>
          </div>
          <p class="footnote"><app-icon name="info" [size]="15" />
            <span>Em Pendências, abra uma obrigação de DAS ou FGTS e clique em <strong>Anexar guia</strong>: o próprio modal oferece
              "Testar a leitura inteligente com uma guia de exemplo". Experimente também anexar a guia do DAS numa obrigação de FGTS.</span></p>
        }
      </div>
    </section>
  `,
  styles: [`
    .ia-ex .card-header { align-items: flex-start; gap: 12px; flex-wrap: wrap; }
    .ia-ex .card-title app-icon { color: var(--accent-fg); }
    .ia-ex-body { display: flex; flex-direction: column; gap: 14px; }
    .ia-ex-lista { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .ia-ex-lista li { display: flex; gap: 8px; align-items: flex-start; font-size: 14px; color: var(--ink-2); line-height: 1.5; }
    .ia-ex-lista app-icon { margin-top: 3px; color: var(--primary); }
    .ia-ex-acoes { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .ia-ex-acoes > span { flex-basis: 100%; }
  `]
})
export class IaExemplosComponent implements OnInit {
  private ia = inject(IaService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  status: StatusIa | null = null;
  logado = false;
  baixando: 'das' | 'fgts' | null = null;

  ngOnInit(): void {
    this.logado = this.auth.isLogado();
    if (this.logado) this.ia.status().subscribe(s => (this.status = s));
  }

  baixar(tipo: 'das' | 'fgts'): void {
    this.baixando = tipo;
    this.ia.baixarExemplo(tipo).subscribe({
      next: (blob) => {
        this.baixando = null;
        saveAs(blob, `guia-${tipo}-exemplo.pdf`);
      },
      error: () => {
        this.baixando = null;
        this.toast.error('Não foi possível gerar o exemplo', 'Tente novamente em instantes.');
      }
    });
  }
}
