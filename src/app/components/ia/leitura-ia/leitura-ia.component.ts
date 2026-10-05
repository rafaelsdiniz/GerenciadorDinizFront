import { Component, Input, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon.component';
import { ToastService } from '../../../shared/ui/toast.service';
import {
  AlertaLeitura, DocumentoAnalisado, copiarTexto, formatarCnpj, formatarLinhaDigitavel
} from '../../../models/documento-analisado.dto';

/**
 * Cartão "Leitura inteligente" mostrado nos modais de envio logo após escolher o arquivo:
 * tipo, valor, vencimento, competência, CNPJ (confere/diverge), linha digitável e alertas de divergência.
 * Conteúdo projetado (<ng-content>) aparece no rodapé do cartão (ex.: "Vincular à obrigação").
 */
@Component({
  selector: 'app-leitura-ia',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './leitura-ia.component.html',
  styleUrl: './leitura-ia.component.css'
})
export class LeituraIaComponent implements OnChanges {
  private toast = inject(ToastService);

  @Input() analise: DocumentoAnalisado | null = null;
  @Input() carregando = false;
  /** Falha da leitura (o envio continua liberado). */
  @Input() erro: string | null = null;
  /** Com o que os dados foram conferidos, ex.: "a obrigação e a empresa". Vazio = sem conferência. */
  @Input() conferencia = '';

  copiado = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  get cnpj(): string { return formatarCnpj(this.analise?.cnpj); }
  get linha(): string { return formatarLinhaDigitavel(this.analise?.linhaDigitavel); }
  get confianca(): number { return Math.round((this.analise?.confianca ?? 0) * 100); }
  get temDanger(): boolean { return !!this.analise?.alertas.some(a => a.nivel === 'danger'); }
  get alertasVisiveis(): AlertaLeitura[] { return this.analise?.alertas ?? []; }
  get semDivergencias(): boolean {
    return !!this.analise?.textoLegivel && !!this.conferencia && !this.analise.alertas.some(a => a.nivel !== 'info');
  }

  ngOnChanges(): void {
    this.copiado = false;
  }

  icone(a: AlertaLeitura): string {
    return a.nivel === 'danger' ? 'alert-triangle' : a.nivel === 'warning' ? 'alert-circle' : 'info';
  }

  async copiar(): Promise<void> {
    const l = this.analise?.linhaDigitavel;
    if (!l) return;
    if (await copiarTexto(l)) {
      this.copiado = true;
      this.toast.success('Linha digitável copiada', 'Cole no app do banco para pagar.');
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => (this.copiado = false), 2500);
    } else {
      this.toast.error('Não foi possível copiar', 'Selecione o número e copie manualmente.');
    }
  }
}
