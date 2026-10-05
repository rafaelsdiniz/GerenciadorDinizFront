import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { EmpresaService } from '../../services/empresa.service';
import { ObrigacaoPendenteService } from '../../services/obrigacao-pendente.service';
import { ArquivoService } from '../../services/arquivo.service';
import { DecService } from '../../services/dec.service';
import { UsuarioService } from '../../services/usuario.service';
import { EmpresaResponseDTO } from '../../models/empresa-response.dto';
import { ObrigacaoPendenteResponseDTO } from '../../models/obrigacao-pendente-response.dto';
import { ArquivoResponseDTO } from '../../models/arquivo-response.dto';
import { ComunicacaoDecDTO, StatusDecLabel, TipoDecLabel } from '../../models/comunicacao-dec.dto';
import { RegimeTributario, RegimeTributarioLabel } from '../../models/enums/regime-tributario.enum';
import { CategoriaFiscal, CategoriaFiscalLabel } from '../../models/enums/categoria-fiscal.enum';
import { ResponsavelObrigacao } from '../../models/enums/responsavel-obrigacao.enum';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/ui/toast.service';
import { DocumentoPipe, PrazoPipe, PrazoTomPipe } from '../../pipes/formatos.pipe';
import { decSemCiencia } from '../dec/dec.util';
import {
  Celula, Resumo, Situacao, Ym, baixarCsv, cnpjBr, competenciaDe, dataBr, diasAte, moedaBr, resumir, situacaoDe, slug,
  valorGuiaDe, ymDaData, ymDe, ymExtenso, ymIntervalo, ymRotulo, ymSomar
} from './relatorios.util';

type Tipo = 'mensal' | 'carteira' | 'pendencias';
type Tom = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface OpcaoTipo { id: Tipo; titulo: string; desc: string; icon: string; admin: boolean; }

const TIPOS: OpcaoTipo[] = [
  { id: 'mensal', titulo: 'Relatório mensal da empresa', desc: 'Obrigações, documentos, certidões e DEC da competência.', icon: 'file-text', admin: false },
  { id: 'carteira', titulo: 'Relatório da carteira', desc: 'Todas as empresas lado a lado, com ranking de atenção.', icon: 'bar-chart', admin: true },
  { id: 'pendencias', titulo: 'Pendências em aberto', desc: 'Tudo o que ainda falta entregar, por empresa e vencimento.', icon: 'list-checks', admin: false }
];

const SITUACAO: Record<Situacao, { label: string; curto: string; tom: Tom }> = {
  noPrazo: { label: 'Entregue no prazo', curto: 'Entregue', tom: 'success' },
  atraso: { label: 'Entregue com atraso', curto: 'Com atraso', tom: 'warning' },
  pendente: { label: 'Pendente', curto: 'Pendente', tom: 'info' },
  vencida: { label: 'Vencida', curto: 'Vencida', tom: 'danger' }
};

/* ---------------- filtros (aplicados no cliente, sobre os dados já carregados) ---------------- */

type Secao = 'obrigacoes' | 'arquivos' | 'certidoes' | 'dec' | 'obs';
type Atencao = '' | 'atencao' | 'emDia';
type Ordem = 'nome' | 'atencao' | 'taxa';
type Prazo = '' | 'vencidas' | '7' | '30';

interface Filtros {
  sit: Situacao | '';
  resp: ResponsavelObrigacao | '';
  regime: RegimeTributario | '';
  atencao: Atencao;
  ordem: Ordem;
  empresa: number | null;
  prazo: Prazo;
  secoes: Record<Secao, boolean>;
}

const filtrosPadrao = (): Filtros => ({
  sit: '', resp: '', regime: '', atencao: '', ordem: 'nome', empresa: null, prazo: '',
  secoes: { obrigacoes: true, arquivos: true, certidoes: true, dec: true, obs: true }
});

const SECOES: { id: Secao; label: string }[] = [
  { id: 'obrigacoes', label: 'Obrigações' },
  { id: 'arquivos', label: 'Documentos enviados' },
  { id: 'certidoes', label: 'Certidões' },
  { id: 'dec', label: 'Comunicações DEC' },
  { id: 'obs', label: 'Observações' }
];

const OPC_SITUACAO: { v: Situacao; l: string }[] = [
  { v: 'noPrazo', l: 'Entregue no prazo' }, { v: 'atraso', l: 'Com atraso' },
  { v: 'pendente', l: 'Pendente' }, { v: 'vencida', l: 'Vencida' }
];
const OPC_RESP: { v: ResponsavelObrigacao; l: string }[] = [
  { v: ResponsavelObrigacao.ESCRITORIO, l: 'Escritório' }, { v: ResponsavelObrigacao.CLIENTE, l: 'Cliente' }
];
const OPC_ATENCAO: { v: Atencao; l: string }[] = [{ v: 'atencao', l: 'Exigem atenção' }, { v: 'emDia', l: 'Em dia' }];
const OPC_ORDEM: { v: Ordem; l: string }[] = [
  { v: 'nome', l: 'Nome' }, { v: 'atencao', l: 'Mais atenção' }, { v: 'taxa', l: 'Menor taxa no prazo' }
];
const OPC_PRAZO: { v: Prazo; l: string }[] = [
  { v: 'vencidas', l: 'Só vencidas' }, { v: '7', l: 'Vencem em até 7 dias' }, { v: '30', l: 'Vencem em até 30 dias' }
];

/** Dados brutos da última geração: os filtros remontam o relatório a partir daqui, sem nova requisição. */
type Bruto =
  | { tipo: 'mensal'; id: number; obrig: ObrigacaoPendenteResponseDTO[]; arq: ArquivoResponseDTO[]; dec: ComunicacaoDecDTO[]; cert: unknown }
  | { tipo: 'carteira'; obrig: ObrigacaoPendenteResponseDTO[]; dec: ComunicacaoDecDTO[] }
  | { tipo: 'pendencias'; obrig: ObrigacaoPendenteResponseDTO[] };

interface LinhaObrig {
  o: ObrigacaoPendenteResponseDTO;
  nome: string;
  empresa: string;
  competencia: string;
  responsavel: string;
  sit: Situacao;
  pagamento: string;
  pagTom: Tom | null;
  /** texto curto do selo de pagamento (a data do pagamento aparece ao lado) */
  pagCurto: string;
  pagData: string;
  valor: number | null;
}

interface CertidaoView { nome: string; orgao: string; situacao: string; emissao: string; validade: string; tom: Tom; }

interface RelMensal {
  empresa: EmpresaResponseDTO;
  regime: string;
  resumo: Resumo;
  obrigacoes: LinhaObrig[];
  /** obrigações da competência antes dos filtros */
  universo: number;
  temValor: boolean;
  totalValor: number;
  arquivos: ArquivoResponseDTO[];
  certidoes: CertidaoView[] | null;
  dec: ComunicacaoDecDTO[];
}

interface LinhaCarteira { empresa: EmpresaResponseDTO; r: Resumo; dec: number; score: number; motivo: string; }

interface RelCarteira {
  linhas: LinhaCarteira[];
  /** empresas antes dos filtros */
  universo: number;
  total: Resumo;
  dec: number;
  empresasComVencidas: number;
  ranking: LinhaCarteira[];
  maxScore: number;
}

interface GrupoPend { nome: string; cnpj: string; itens: LinhaObrig[]; vencidas: number; }

interface RelPendencias { grupos: GrupoPend[]; total: number; vencidas: number; semana: number; }

@Component({
  selector: 'app-relatorios',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, DocumentoPipe, PrazoPipe, PrazoTomPipe],
  templateUrl: './relatorios.component.html',
  styleUrl: './relatorios.component.css'
})
export class RelatoriosComponent implements OnInit, OnDestroy {
  private readonly doc = inject(DOCUMENT);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly empresaService = inject(EmpresaService);
  private readonly obrigacaoService = inject(ObrigacaoPendenteService);
  private readonly arquivoService = inject(ArquivoService);
  private readonly decService = inject(DecService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly toast = inject(ToastService);

  isAdmin = false;
  tipos: OpcaoTipo[] = [];
  tipo: Tipo = 'mensal';
  empresas: EmpresaResponseDTO[] = [];
  idEmpresa: number | null = null;
  competencia: Ym = ymSomar(ymDe(new Date()), -1);
  readonly competenciaMax: Ym = ymSomar(ymDe(new Date()), 1);

  carregando = true;
  erro = false;
  usuario = '';
  geradoEm = new Date();

  mensal: RelMensal | null = null;
  carteira: RelCarteira | null = null;
  pendencias: RelPendencias | null = null;

  readonly situacao = SITUACAO;
  readonly tipoDecLabel = TipoDecLabel;
  readonly statusDecLabel = StatusDecLabel;
  readonly skeleton = [1, 2, 3, 4, 5, 6];
  private seq = 0;

  filtros: Filtros = filtrosPadrao();
  private bruto: Bruto | null = null;
  readonly secoes = SECOES;
  readonly opcSituacao = OPC_SITUACAO;
  readonly opcResp = OPC_RESP;
  readonly opcRegime = (Object.keys(RegimeTributarioLabel) as RegimeTributario[]).map(v => ({ v, l: RegimeTributarioLabel[v] }));
  readonly opcAtencao = OPC_ATENCAO;
  readonly opcOrdem = OPC_ORDEM;
  readonly opcPrazo = OPC_PRAZO;

  ngOnInit(): void {
    this.doc.body.classList.add('rel-print');
    this.isAdmin = this.auth.isAdmin();
    this.tipos = TIPOS.filter(t => this.isAdmin || !t.admin);
    this.usuario = this.auth.getPayload()?.sub ?? '';

    // atalhos por URL: /relatorios?tipo=carteira&competencia=2026-09&empresa=2
    const qp = this.route.snapshot.queryParamMap;
    const t = qp.get('tipo') as Tipo | null;
    if (t && this.tipos.some(x => x.id === t)) this.tipo = t;
    const c = qp.get('competencia');
    if (c && /^\d{4}-\d{2}$/.test(c)) this.competencia = c;

    this.usuarioService.meuPerfil().pipe(catchError(() => of(null)))
      .subscribe(u => { if (u?.nome) this.usuario = u.nome; });

    this.carregarEmpresas(Number(qp.get('empresa')));
  }

  private empresasCarregadas = false;

  private carregarEmpresas(pedida?: number): void {
    this.carregando = true;
    this.erro = false;
    const empresas$: Observable<EmpresaResponseDTO[]> = this.isAdmin
      ? this.empresaService.listar()
      : this.empresaService.buscarPorId(this.auth.getEmpresaId() ?? 0).pipe(map(e => [e]));
    empresas$.subscribe({
      next: lista => {
        this.empresasCarregadas = true;
        this.empresas = [...lista].sort((a, b) => this.nomeEmpresa(a).localeCompare(this.nomeEmpresa(b), 'pt-BR'));
        this.idEmpresa = this.empresas.find(e => e.id === pedida)?.id ?? this.empresas[0]?.id ?? null;
        this.gerar();
      },
      error: () => { this.carregando = false; this.erro = true; this.toast.error('Não foi possível carregar as empresas'); }
    });
  }

  /** Botão "Tentar novamente": recarrega as empresas se elas também falharam. */
  tentarNovamente(): void {
    if (this.empresasCarregadas) this.gerar();
    else this.carregarEmpresas();
  }

  ngOnDestroy(): void {
    this.doc.body.classList.remove('rel-print');
  }

  // ---------------- parâmetros ----------------

  get tipoAtual(): OpcaoTipo { return TIPOS.find(t => t.id === this.tipo)!; }
  get competenciaRotulo(): string { return ymRotulo(this.competencia); }
  get competenciaExtenso(): string { return ymExtenso(this.competencia); }
  get movimento(): string {
    const [ini, fim] = ymIntervalo(ymSomar(this.competencia, 1));
    return `${ini} a ${fim}`;
  }
  get podeAvancar(): boolean { return this.competencia < this.competenciaMax; }
  get temDados(): boolean { return !!(this.mensal || this.carteira || this.pendencias); }

  escolherTipo(t: Tipo): void {
    if (this.tipo === t) return;
    this.tipo = t;
    // mantém só os filtros que valem para o novo tipo (o responsável vale para todos)
    const p = filtrosPadrao();
    const f = this.filtros;
    this.filtros = {
      ...p,
      resp: f.resp,
      ...(t === 'mensal' ? { sit: f.sit, secoes: f.secoes } : {}),
      ...(t === 'carteira' ? { regime: f.regime, atencao: f.atencao, ordem: f.ordem } : {}),
      ...(t === 'pendencias' ? { empresa: f.empresa, prazo: f.prazo } : {})
    };
    this.gerar();
  }

  // ---------------- filtros ----------------

  /** Filtros ativos do tipo atual, em texto (painel, folha impressa e CSV). */
  get filtrosAtivos(): { rotulo: string; valor: string }[] {
    const f = this.filtros;
    const a: { rotulo: string; valor: string }[] = [];
    const add = (rotulo: string, valor: string | undefined) => { if (valor) a.push({ rotulo, valor }); };
    if (this.tipo === 'mensal') add('Situação', OPC_SITUACAO.find(o => o.v === f.sit)?.l);
    if (this.tipo === 'carteira') add('Regime', f.regime ? RegimeTributarioLabel[f.regime] : '');
    if (this.tipo === 'pendencias' && this.isAdmin && f.empresa != null) {
      add('Empresa', this.nomeEmpresa(this.empresas.find(e => e.id === f.empresa)));
    }
    add('Responsável', OPC_RESP.find(o => o.v === f.resp)?.l);
    if (this.tipo === 'carteira') add('Situação', OPC_ATENCAO.find(o => o.v === f.atencao)?.l);
    if (this.tipo === 'pendencias') add('Prazo', OPC_PRAZO.find(o => o.v === f.prazo)?.l);
    if (this.tipo === 'mensal') add('Seções ocultas', SECOES.filter(s => !f.secoes[s.id]).map(s => s.label).join(', '));
    return a;
  }

  get filtrosTexto(): string {
    return this.filtrosAtivos.map(x => `${x.rotulo}: ${x.valor}`).join(' · ');
  }

  /** Há filtro que reduz a lista de obrigações (mensal) / empresas (carteira) / pendências? */
  get filtrandoLinhas(): boolean {
    return this.filtrosAtivos.some(x => x.rotulo !== 'Seções ocultas');
  }

  limparFiltros(): void {
    this.filtros = filtrosPadrao();
    this.aplicarFiltros();
  }

  /** Remonta o relatório a partir dos dados já carregados, aplicando os filtros (sem nova requisição). */
  aplicarFiltros(): void {
    this.mensal = this.carteira = this.pendencias = null;
    const b = this.bruto;
    if (b?.tipo === 'mensal') this.montarMensal(b.id, b.obrig, b.arq, b.dec, b.cert);
    else if (b?.tipo === 'carteira') this.montarCarteira(b.obrig, b.dec);
    else if (b?.tipo === 'pendencias') this.montarPendencias(b.obrig);
  }

  private passaResp(o: ObrigacaoPendenteResponseDTO): boolean {
    const r = this.filtros.resp;
    return !r || (o.responsavel === ResponsavelObrigacao.CLIENTE ? ResponsavelObrigacao.CLIENTE : ResponsavelObrigacao.ESCRITORIO) === r;
  }

  private passaPrazo(o: ObrigacaoPendenteResponseDTO): boolean {
    const p = this.filtros.prazo;
    if (!p) return true;
    const sit = situacaoDe(o);
    if (p === 'vencidas') return sit === 'vencida';
    const dias = diasAte(o.dataVencimento);
    return sit === 'pendente' && dias != null && dias <= +p;
  }

  mudarCompetencia(delta: number): void {
    const nova = ymSomar(this.competencia, delta);
    if (nova > this.competenciaMax) return;
    this.competencia = nova;
    this.gerar();
  }

  aoEditarCompetencia(v: string): void {
    if (!/^\d{4}-\d{2}$/.test(v ?? '')) return; // input limpo/parcial: mantém a anterior
    this.competencia = v;
    this.gerar();
  }

  nomeEmpresa(e: EmpresaResponseDTO | undefined | null): string {
    return e ? (e.nomeFantasia || e.razaoSocial || `Empresa ${e.id}`) : '—';
  }

  // ---------------- geração ----------------

  gerar(): void {
    const n = ++this.seq;
    this.carregando = true;
    this.erro = false;
    const fim = <T>(fn: (dados: T) => void) => ({
      next: (dados: T) => {
        if (n !== this.seq) return;
        fn(dados);
        this.aplicarFiltros();
        this.geradoEm = new Date();
        this.carregando = false;
      },
      error: () => {
        if (n !== this.seq) return;
        this.carregando = false;
        this.erro = true;
        this.toast.error('Não foi possível gerar o relatório', 'Verifique a conexão e tente novamente.');
      }
    });

    if (this.tipo === 'mensal') {
      const id = this.idEmpresa;
      if (id == null) { this.carregando = false; this.mensal = null; this.bruto = null; return; }
      forkJoin({
        obrig: this.obrigacaoService.buscarPorEmpresa(id),
        arq: this.arquivoService.buscarPorEmpresa(id).pipe(catchError(() => of([] as ArquivoResponseDTO[]))),
        dec: this.decService.porEmpresa(id).pipe(catchError(() => of([] as ComunicacaoDecDTO[]))),
        cert: this.http.get<unknown>(`${environment.apiUrl}/certidoes/empresa/${id}`).pipe(catchError(() => of(null)))
      }).subscribe(fim<{ obrig: ObrigacaoPendenteResponseDTO[]; arq: ArquivoResponseDTO[]; dec: ComunicacaoDecDTO[]; cert: unknown }>(
        d => (this.bruto = { tipo: 'mensal', id, ...d })
      ));
    } else if (this.tipo === 'carteira') {
      forkJoin({
        obrig: this.obrigacaoService.listar(),
        dec: this.decService.listar().pipe(catchError(() => of([] as ComunicacaoDecDTO[])))
      }).subscribe(fim<{ obrig: ObrigacaoPendenteResponseDTO[]; dec: ComunicacaoDecDTO[] }>(d => (this.bruto = { tipo: 'carteira', ...d })));
    } else {
      const obrig$ = this.isAdmin
        ? this.obrigacaoService.listar()
        : this.obrigacaoService.buscarPorEmpresa(this.auth.getEmpresaId() ?? 0);
      obrig$.subscribe(fim<ObrigacaoPendenteResponseDTO[]>(obrig => (this.bruto = { tipo: 'pendencias', obrig })));
    }
  }

  private linha(o: ObrigacaoPendenteResponseDTO): LinhaObrig {
    const comp = competenciaDe(o);
    let pagamento = '—';
    let pagTom: Tom | null = null;
    switch (o.situacaoPagamento) {
      case 'PAGO': pagamento = o.dataPagamento ? `Pago em ${dataBr(o.dataPagamento)}` : 'Pago'; pagTom = 'success'; break;
      case 'AGUARDANDO': pagamento = 'Aguardando'; pagTom = 'warning'; break;
      case 'ATRASADO': pagamento = 'Em atraso'; pagTom = 'danger'; break;
    }
    return {
      o,
      nome: o.nomeObrigacao || 'Obrigação',
      empresa: o.nomeEmpresa || this.nomeEmpresa(this.empresas.find(e => e.id === o.idEmpresa)),
      competencia: comp ? ymRotulo(comp) : (o.competencia || '—'),
      responsavel: o.responsavel === ResponsavelObrigacao.CLIENTE ? 'Cliente' : 'Escritório',
      sit: situacaoDe(o),
      pagamento,
      pagTom,
      pagCurto: o.situacaoPagamento === 'PAGO' ? 'Pago' : pagamento,
      pagData: o.situacaoPagamento === 'PAGO' && o.dataPagamento ? dataBr(o.dataPagamento) : '',
      valor: valorGuiaDe(o)
    };
  }

  private daCompetencia(lista: ObrigacaoPendenteResponseDTO[]): ObrigacaoPendenteResponseDTO[] {
    return lista.filter(o => competenciaDe(o) === this.competencia)
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));
  }

  private montarMensal(id: number, obrig: ObrigacaoPendenteResponseDTO[], arq: ArquivoResponseDTO[],
                       dec: ComunicacaoDecDTO[], cert: unknown): void {
    const empresa = this.empresas.find(e => e.id === id);
    if (!empresa) return;
    const mesMovimento = ymSomar(this.competencia, 1);
    const todas = this.daCompetencia(obrig);
    const sit = this.filtros.sit;
    const daComp = todas.filter(o => (!sit || situacaoDe(o) === sit) && this.passaResp(o));
    const linhas = daComp.map(o => this.linha(o));
    const valores = linhas.map(l => l.valor).filter((v): v is number => v != null);
    this.mensal = {
      empresa,
      regime: empresa.regimeTributario ? RegimeTributarioLabel[empresa.regimeTributario as RegimeTributario] ?? empresa.regimeTributario : 'Não informado',
      resumo: resumir(daComp),
      obrigacoes: linhas,
      universo: todas.length,
      temValor: valores.length > 0,
      totalValor: valores.reduce((s, v) => s + v, 0),
      arquivos: arq.filter(a => !a.excluidoEm && ymDaData(a.dataCriacao) === mesMovimento)
        .sort((a, b) => (b.dataCriacao ?? '').localeCompare(a.dataCriacao ?? '')),
      certidoes: this.lerCertidoes(cert),
      dec: dec.filter(c => ymDaData(c.disponibilizadaEm) === mesMovimento)
        .sort((a, b) => (b.disponibilizadaEm ?? '').localeCompare(a.disponibilizadaEm ?? ''))
    };
  }

  /** Certidões vêm de outro módulo; o formato é lido de forma tolerante. null = módulo indisponível (seção omitida). */
  private lerCertidoes(resp: unknown): CertidaoView[] | null {
    const r = resp as Record<string, unknown> | unknown[] | null;
    const lista = Array.isArray(r) ? r : (r && Array.isArray((r as Record<string, unknown>)['certidoes']) ? (r as Record<string, unknown[]>)['certidoes'] : null);
    if (!lista) return null;
    const txt = (c: Record<string, unknown>, ...k: string[]) => {
      for (const x of k) { const v = c[x]; if (v != null && v !== '') return String(v); }
      return '';
    };
    const legivel = (s: string) => /^[A-Z0-9_]+$/.test(s) ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, m => m.toUpperCase()) : s;
    const hoje = ymDe(new Date()) + '-' + String(new Date().getDate()).padStart(2, '0');
    return (lista as Record<string, unknown>[]).map(c => {
      const validadeIso = txt(c, 'dataValidade', 'validade', 'validaAte', 'dataVencimento');
      const situacao = legivel(txt(c, 'situacao', 'status', 'resultado'));
      const s = situacao.toLowerCase();
      const validade = txt(c, 'statusValidade').toUpperCase(); // VALIDA | VENCENDO | VENCIDA
      let tom: Tom = 'warning';
      if (validade === 'VENCIDA' || (validadeIso && validadeIso.slice(0, 10) < hoje)) tom = 'danger';
      else if (/positiva(?! com)|irregular|vencida|pendente de/.test(s)) tom = 'danger';
      else if (validade === 'VENCENDO') tom = 'warning';
      else if (/negativa|regular|v[aá]lida|emitida/.test(s)) tom = 'success';
      const sufixo = tom === 'danger' && (validade === 'VENCIDA' || (validadeIso && validadeIso.slice(0, 10) < hoje)) ? ' · vencida'
        : validade === 'VENCENDO' ? ' · vencendo' : '';
      return {
        nome: legivel(txt(c, 'tipoRotulo', 'nome', 'tipoLabel', 'tipo', 'tipoCertidao', 'descricao')) || 'Certidão',
        orgao: txt(c, 'orgaoEmissor', 'orgaoLabel', 'orgao', 'emissor', 'esfera') || '—',
        situacao: situacao ? situacao.replace(/ com efeito de /i, ' c/ efeito de ') + sufixo : (tom === 'danger' ? 'Vencida' : '—'),
        emissao: dataBr(txt(c, 'dataEmissao', 'emitidaEm', 'emissao')),
        validade: dataBr(validadeIso),
        tom
      };
    });
  }

  private montarCarteira(obrig: ObrigacaoPendenteResponseDTO[], dec: ComunicacaoDecDTO[]): void {
    const f = this.filtros;
    const daComp = this.daCompetencia(obrig).filter(o => this.passaResp(o));
    const empresas = this.empresas.filter(e => !f.regime || e.regimeTributario === f.regime);
    let linhas: LinhaCarteira[] = empresas.map(empresa => {
      const r = resumir(daComp.filter(o => o.idEmpresa === empresa.id));
      const nDec = dec.filter(c => c.idEmpresa === empresa.id && decSemCiencia(c)).length;
      const score = r.vencidas * 3 + nDec * 2 + r.guiasAPagar * 2 + r.pendentes + r.atraso;
      const motivo = [
        r.vencidas && `${r.vencidas} vencida${r.vencidas > 1 ? 's' : ''}`,
        nDec && `${nDec} DEC sem ciência`,
        r.guiasAPagar && `${r.guiasAPagar} guia${r.guiasAPagar > 1 ? 's' : ''} a pagar`,
        r.pendentes && `${r.pendentes} pendente${r.pendentes > 1 ? 's' : ''}`,
        r.atraso && `${r.atraso} com atraso`
      ].filter(Boolean).join(' · ');
      return { empresa, r, dec: nDec, score, motivo };
    });
    if (f.atencao) linhas = linhas.filter(l => (l.score > 0) === (f.atencao === 'atencao'));
    // this.empresas já vem em ordem alfabética; o sort é estável, então empates ficam por nome
    if (f.ordem === 'atencao') linhas.sort((a, b) => b.score - a.score);
    else if (f.ordem === 'taxa') linhas.sort((a, b) => (a.r.taxa ?? 101) - (b.r.taxa ?? 101));
    const ids = new Set(linhas.map(l => l.empresa.id));
    const total = resumir(daComp.filter(o => ids.has(o.idEmpresa)));
    const ranking = linhas.filter(l => l.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
    this.carteira = {
      linhas,
      universo: this.empresas.length,
      total,
      dec: linhas.reduce((s, l) => s + l.dec, 0),
      empresasComVencidas: linhas.filter(l => l.r.vencidas > 0).length,
      ranking,
      maxScore: ranking[0]?.score ?? 1
    };
  }

  private montarPendencias(obrig: ObrigacaoPendenteResponseDTO[]): void {
    const emp = this.isAdmin ? this.filtros.empresa : null;
    const abertas = obrig.filter(o => o.status !== 'ENTREGUE' && (emp == null || o.idEmpresa === emp)
        && this.passaResp(o) && this.passaPrazo(o))
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))
      .map(o => this.linha(o));
    const grupos = new Map<number, GrupoPend>();
    for (const l of abertas) {
      let g = grupos.get(l.o.idEmpresa);
      if (!g) {
        const e = this.empresas.find(x => x.id === l.o.idEmpresa);
        g = { nome: e ? this.nomeEmpresa(e) : l.empresa, cnpj: e ? cnpjBr(e.cnpj) : '', itens: [], vencidas: 0 };
        grupos.set(l.o.idEmpresa, g);
      }
      g.itens.push(l);
      if (l.sit === 'vencida') g.vencidas++;
    }
    const semana = abertas.filter(l => l.sit === 'pendente' && (l.o.diasParaVencer ?? 99) <= 7).length;
    this.pendencias = {
      grupos: [...grupos.values()], // já em ordem do vencimento mais próximo
      total: abertas.length,
      vencidas: abertas.filter(l => l.sit === 'vencida').length,
      semana
    };
  }

  // ---------------- apresentação ----------------

  categoria(a: ArquivoResponseDTO): string {
    return a.categoriaFiscal ? CategoriaFiscalLabel[a.categoriaFiscal as CategoriaFiscal] ?? a.categoriaFiscal : 'Sem categoria';
  }

  moeda(v: number | null): string { return moedaBr(v); }

  pct(parte: number, total: number): number { return total ? (parte / total) * 100 : 0; }

  tomTaxa(t: number | null): Tom { return t == null ? 'neutral' : t >= 90 ? 'success' : t >= 70 ? 'warning' : 'danger'; }

  /** Leitura automática do relatório mensal, em linguagem simples. */
  get observacoes(): string[] {
    const m = this.mensal;
    if (!m) return [];
    const r = m.resumo;
    const obs: string[] = [];
    const s = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
    const filtrado = r.total < m.universo || (!r.total && this.filtrandoLinhas);
    if (filtrado) obs.push(`Leitura considerando apenas as obrigações filtradas (${r.total} de ${m.universo}).`);
    if (!r.total) { if (!filtrado) obs.push(`Nenhuma obrigação registrada para a competência ${this.competenciaRotulo}.`); }
    else if (!r.vencidas && !r.atraso && !r.pendentes) obs.push(`Todas as obrigações ${filtrado ? 'listadas' : 'da competência'} foram entregues no prazo.`);
    if (r.vencidas) obs.push(`${s(r.vencidas, 'obrigação vencida exige', 'obrigações vencidas exigem')} atenção imediata.`);
    if (r.pendentes) obs.push(`${s(r.pendentes, 'obrigação ainda está', 'obrigações ainda estão')} dentro do prazo, aguardando entrega.`);
    if (r.atraso) obs.push(`${s(r.atraso, 'entrega ocorreu', 'entregas ocorreram')} após o vencimento.`);
    if (r.guiasAPagar) obs.push(`${s(r.guiasAPagar, 'guia aguarda', 'guias aguardam')} confirmação de pagamento.`);
    const vencidasCert = m.certidoes?.filter(c => c.tom === 'danger').length ?? 0;
    if (vencidasCert) obs.push(`${s(vencidasCert, 'certidão precisa', 'certidões precisam')} ser renovada${vencidasCert > 1 ? 's' : ''} ou regularizada${vencidasCert > 1 ? 's' : ''}.`);
    const semCiencia = m.dec.filter(c => !c.cienteEm).length;
    if (semCiencia) obs.push(`${s(semCiencia, 'comunicação do DEC está', 'comunicações do DEC estão')} sem ciência.`);
    return obs;
  }

  // ---------------- ações ----------------

  private nomeArquivo(): string {
    const comp = this.competencia;
    if (this.tipo === 'mensal' && this.mensal) return `relatorio-mensal-${slug(this.nomeEmpresa(this.mensal.empresa))}-${comp}`;
    if (this.tipo === 'carteira') return `relatorio-carteira-${comp}`;
    return `pendencias-em-aberto-${ymDe(new Date())}-${String(new Date().getDate()).padStart(2, '0')}`;
  }

  imprimir(): void {
    if (!this.temDados) return;
    // o título vira o nome sugerido ao "Salvar como PDF"
    const anterior = this.doc.title;
    this.doc.title = this.nomeArquivo();
    window.print();
    setTimeout(() => (this.doc.title = anterior), 500);
  }

  exportarCsv(): void {
    const L: Celula[][] = [];
    const rodape = [`Gerado em ${this.geradoEm.toLocaleString('pt-BR')} por ${this.usuario} — Gerenciador Diniz`];
    if (this.mensal) {
      const m = this.mensal;
      L.push(['Relatório mensal da empresa'], ['Empresa', m.empresa.razaoSocial], ['CNPJ', cnpjBr(m.empresa.cnpj)],
        ['Competência', this.competenciaRotulo], []);
      const sec = this.filtros.secoes;
      if (sec.obrigacoes) {
        L.push(['Obrigações', 'Responsável', 'Vencimento', 'Entrega', 'Status', 'Pagamento', ...(m.temValor ? ['Valor da guia (R$)'] : [])]);
        m.obrigacoes.forEach(l => L.push([l.nome, l.responsavel, dataBr(l.o.dataVencimento), dataBr(l.o.dataEntrega),
          SITUACAO[l.sit].label, l.pagamento, ...(m.temValor ? [l.valor] : [])]));
        if (m.temValor) L.push(['Total das guias', '', '', '', '', '', m.totalValor]);
        L.push([]);
      }
      if (sec.arquivos) {
        L.push(['Documentos enviados', 'Categoria', 'Enviado por', 'Data']);
        m.arquivos.forEach(a => L.push([a.nomeOriginal || a.nome, this.categoria(a), a.nomeUsuario || '—', dataBr(a.dataCriacao)]));
        L.push([]);
      }
      if (m.certidoes && sec.certidoes) {
        L.push(['Certidões', 'Órgão', 'Situação', 'Emissão', 'Validade']);
        m.certidoes.forEach(c => L.push([c.nome, c.orgao, c.situacao, c.emissao, c.validade]));
        L.push([]);
      }
      if (sec.dec) {
        L.push(['Comunicações DEC', 'Tipo', 'Disponibilizada em', 'Ciência', 'Status']);
        m.dec.forEach(c => L.push([c.assunto, this.tipoDecLabel[c.tipo] ?? c.tipo, dataBr(c.disponibilizadaEm),
          c.cienteEm ? dataBr(c.cienteEm) : 'Sem ciência', this.statusDecLabel[c.status] ?? c.status]));
      }
      if (sec.obs) {
        L.push([], ['Observações']);
        this.observacoes.forEach(o => L.push([o]));
      }
    } else if (this.carteira) {
      L.push(['Relatório da carteira'], ['Competência', this.competenciaRotulo], []);
      L.push(['Empresa', 'CNPJ', 'Obrigações', 'Entregues', 'Pendentes', 'Vencidas', 'Taxa no prazo (%)', 'Guias aguardando pagamento', 'DEC sem ciência']);
      const linha = (nome: string, cnpj: string, r: Resumo, dec: number) =>
        [nome, cnpj, r.total, r.noPrazo + r.atraso, r.pendentes, r.vencidas, r.taxa, r.guiasAPagar, dec];
      this.carteira.linhas.forEach(l => L.push(linha(this.nomeEmpresa(l.empresa), cnpjBr(l.empresa.cnpj), l.r, l.dec)));
      L.push(linha('Total', '', this.carteira.total, this.carteira.dec));
    } else if (this.pendencias) {
      L.push(['Pendências em aberto'], []);
      L.push(['Empresa', 'Obrigação', 'Competência', 'Responsável', 'Vencimento', 'Situação']);
      this.pendencias.grupos.forEach(g => g.itens.forEach(l =>
        L.push([g.nome, l.nome, l.competencia, l.responsavel, dataBr(l.o.dataVencimento), SITUACAO[l.sit].label])));
    } else return;
    if (this.filtrosAtivos.length) L.splice(1, 0, ['Filtros', this.filtrosTexto]);
    L.push([], rodape);
    baixarCsv(`${this.nomeArquivo()}.csv`, L);
    this.toast.success('CSV exportado', 'Abra no Excel ou Planilhas Google.');
  }
}
