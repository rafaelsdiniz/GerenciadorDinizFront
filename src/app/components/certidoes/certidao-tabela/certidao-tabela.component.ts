import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CertidaoResponseDTO } from '../../../models/certidao.dto';
import { ArquivoService } from '../../../services/arquivo.service';
import { IconComponent } from '../../../shared/icon.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { AvatarCorPipe, IniciaisPipe } from '../../../pipes/formatos.pipe';
import {
  STATUS_ROTULO, abrirBlob, prazoClasse, prazoTexto, situacaoClasse, situacaoRotulo, tipoInfo, tomCertidao
} from '../certidao.util';

/** Tabela de certidões (desktop) + cartões (celular). Abre/baixa o PDF do Drive. */
@Component({
  selector: 'app-certidao-tabela',
  standalone: true,
  imports: [DatePipe, RouterModule, IconComponent, AvatarCorPipe, IniciaisPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './certidao-tabela.component.html',
  styleUrl: './certidao-tabela.component.css'
})
export class CertidaoTabelaComponent {
  @Input() itens: CertidaoResponseDTO[] = [];
  @Input() mostrarEmpresa = true;
  @Input() isAdmin = false;
  /** id da certidão com ação em andamento (exclusão) */
  @Input() ocupadoId: number | null = null;

  @Output() editar = new EventEmitter<CertidaoResponseDTO>();
  @Output() excluir = new EventEmitter<CertidaoResponseDTO>();

  abrindoId: number | null = null;

  readonly tipoInfo = tipoInfo;
  readonly situacaoRotulo = situacaoRotulo;
  readonly situacaoClasse = situacaoClasse;
  readonly prazoTexto = prazoTexto;
  readonly prazoClasse = prazoClasse;
  readonly tom = tomCertidao;
  readonly statusRotulo = STATUS_ROTULO;

  constructor(private arquivos: ArquivoService, private toast: ToastService, private cdr: ChangeDetectorRef) {}

  abrirArquivo(c: CertidaoResponseDTO, baixar = false): void {
    if (!c.idArquivo || this.abrindoId) return;
    this.abrindoId = c.id;
    this.arquivos.download(c.idArquivo).subscribe({
      next: (blob) => {
        abrirBlob(blob, c.nomeArquivo || 'certidao.pdf', baixar);
        this.abrindoId = null;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('Não foi possível abrir o arquivo', 'O PDF da certidão não está disponível no Drive.');
        this.abrindoId = null;
        this.cdr.markForCheck();
      }
    });
  }
}
