import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CertidaoResponseDTO, StatusValidade, TipoCertidao } from '../../../models/certidao.dto';
import { IconComponent } from '../../../shared/icon.component';
import { AvatarCorPipe, IniciaisPipe } from '../../../pipes/formatos.pipe';
import { TIPOS_MATRIZ, Tom, prazoTexto, situacaoRotulo, tomCertidao } from '../certidao.util';

export interface CelulaMatriz {
  idEmpresa: number;
  nomeEmpresa: string;
  tipo: TipoCertidao;
  certidao: CertidaoResponseDTO | null;
  tom: Tom;
  texto: string;
  titulo: string;
}

interface LinhaMatriz {
  idEmpresa: number;
  nome: string;
  celulas: CelulaMatriz[];
  alertas: number;
  faltando: number;
  pior: number;
}

const PESO: Record<Tom, number> = { danger: 0, warning: 1, neutral: 2, success: 3 };

/** Matriz empresas × tipos de certidão com a situação de cada uma (verde / âmbar / vermelho / cinza). */
@Component({
  selector: 'app-certidao-matriz',
  standalone: true,
  imports: [DatePipe, RouterModule, IconComponent, AvatarCorPipe, IniciaisPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './certidao-matriz.component.html',
  styleUrl: './certidao-matriz.component.css'
})
export class CertidaoMatrizComponent implements OnChanges {
  @Input() certidoes: CertidaoResponseDTO[] = [];
  /** empresas exibidas (inclusive as que ainda não têm certidões) */
  @Input() empresas: { id: number; nome: string }[] = [];
  /** destaca só as células nesta situação */
  @Input() destaque: StatusValidade | null = null;
  @Input() podeEditar = false;

  @Output() abrir = new EventEmitter<CelulaMatriz>();

  readonly tipos = TIPOS_MATRIZ;
  linhas: LinhaMatriz[] = [];
  totais: Record<Tom, number> = { success: 0, warning: 0, danger: 0, neutral: 0 };

  ngOnChanges(): void {
    // certidão "vigente" de cada tipo = a de validade mais distante
    const vigente = new Map<string, CertidaoResponseDTO>();
    for (const c of this.certidoes) {
      const k = `${c.idEmpresa}|${c.tipo}`;
      const atual = vigente.get(k);
      if (!atual || c.dataValidade > atual.dataValidade) vigente.set(k, c);
    }
    const totais: Record<Tom, number> = { success: 0, warning: 0, danger: 0, neutral: 0 };
    this.linhas = this.empresas.map(e => {
      const celulas = this.tipos.map<CelulaMatriz>(t => {
        const c = vigente.get(`${e.id}|${t.id}`) ?? null;
        const tom: Tom = c ? tomCertidao(c) : 'neutral';
        totais[tom]++;
        return {
          idEmpresa: e.id, nomeEmpresa: e.nome, tipo: t.id, certidao: c, tom,
          texto: c ? (c.diasParaVencer < 0 ? 'Vencida' : c.diasParaVencer + 'd') : '—',
          titulo: c
            ? `${t.rotulo} · ${situacaoRotulo(c.situacao)} · ${prazoTexto(c.diasParaVencer)}`
            : `${t.rotulo} · não cadastrada`
        };
      });
      return {
        idEmpresa: e.id,
        nome: e.nome,
        celulas,
        alertas: celulas.filter(c => c.tom === 'danger' || c.tom === 'warning').length,
        faltando: celulas.filter(c => !c.certidao).length,
        pior: Math.min(...celulas.filter(c => c.certidao).map(c => PESO[c.tom]), 3),
      };
    }).sort((a, b) => a.pior - b.pior || b.alertas - a.alertas || a.nome.localeCompare(b.nome));
    this.totais = totais;
  }

  esmaecida(c: CelulaMatriz): boolean {
    if (!this.destaque) return false;
    const st = c.certidao?.statusValidade;
    return st !== this.destaque;
  }
}
