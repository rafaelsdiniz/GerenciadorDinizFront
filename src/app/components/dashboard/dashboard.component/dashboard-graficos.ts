import { ChartConfiguration, ChartData, ChartDataset, ChartEvent, ActiveElement, ScriptableContext, TooltipOptions } from 'chart.js';
import { ObrigacaoPendenteResponseDTO } from '../../../models/obrigacao-pendente-response.dto';
import { ArquivoResponseDTO } from '../../../models/arquivo-response.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { CategoriaFiscal, CategoriaFiscalLabel } from '../../../models/enums/categoria-fiscal.enum';
import { ResponsavelObrigacao } from '../../../models/enums/responsavel-obrigacao.enum';
import { Situacao, Ym, situacaoDe, ymDaData, ymDe, ymSomar } from '../../relatorios/relatorios.util';

/*
 * Gráficos do painel (Chart.js). Paletas validadas com o validador de paleta (modo claro):
 *  - situação (status): verde / âmbar / azul / vermelho — sempre com legenda, gap de 2px e tooltip;
 *  - responsável (categórica): azul da marca / dourado forte da marca.
 */

export const ORDEM_SITUACAO: Situacao[] = ['noPrazo', 'atraso', 'pendente', 'vencida'];
export const COR_SITUACAO: Record<Situacao, string> = {
  noPrazo: '#16a34a', atraso: '#d97706', pendente: '#2563eb', vencida: '#e11d48'
};
export const ROTULO_SITUACAO: Record<Situacao, string> = {
  noPrazo: 'Entregue no prazo', atraso: 'Entregue com atraso', pendente: 'Pendente', vencida: 'Vencida'
};
const COR_RESPONSAVEL: Record<ResponsavelObrigacao, string> = {
  [ResponsavelObrigacao.ESCRITORIO]: '#2042b8',
  [ResponsavelObrigacao.CLIENTE]: '#b8952a'
};
const ROTULO_RESPONSAVEL: Record<ResponsavelObrigacao, string> = {
  [ResponsavelObrigacao.ESCRITORIO]: 'Escritório entrega',
  [ResponsavelObrigacao.CLIENTE]: 'Cliente envia'
};
const COR_UNICA = '#2042b8';

const TINTA_MUDA = '#5d6883';
const GRADE = '#eef1f6';
const SUPERFICIE = '#ffffff';
const FONTE = { family: "'Inter', system-ui, sans-serif", size: 12 };

export interface LegendaItem { label: string; cor: string; total: number; }

/** Sem animação para quem pede menos movimento no sistema. */
function animacao(duration: number): false | { duration: number } {
  const reduzir = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduzir ? false : { duration };
}

type Clique = (indice: number) => void;

const tooltip: Partial<TooltipOptions<'bar' | 'doughnut'>> = {
  backgroundColor: '#0b1433',
  padding: 10,
  cornerRadius: 8,
  boxPadding: 4,
  usePointStyle: true,
  titleFont: { ...FONTE, weight: 600 },
  bodyFont: FONTE
};

function aoClicar(fn?: Clique) {
  return fn ? (_: ChartEvent, el: ActiveElement[]) => { if (el.length) fn(el[0].index); } : undefined;
}

function cursor(fn?: Clique) {
  return fn ? (e: ChartEvent, el: ActiveElement[]) => {
    const alvo = e.native?.target as HTMLElement | undefined;
    if (alvo) alvo.style.cursor = el.length ? 'pointer' : 'default';
  } : undefined;
}

/** Arredonda (4px) só a ponta do segmento mais externo de cada pilha; a base fica reta. */
function pontaArredondada(ctx: ScriptableContext<'bar'>): number {
  const sets = ctx.chart.data.datasets;
  for (let k = sets.length - 1; k >= 0; k--) {
    if (!ctx.chart.isDatasetVisible(k)) continue;
    if (Number(sets[k].data[ctx.dataIndex]) > 0) return k === ctx.datasetIndex ? 4 : 0;
  }
  return 0;
}

function serie(label: string, data: number[], cor: string, horizontal = false): ChartDataset<'bar', number[]> {
  return {
    label, data,
    backgroundColor: cor,
    hoverBackgroundColor: cor,
    borderColor: SUPERFICIE,
    // gap de 2px na cor da superfície entre segmentos empilhados
    borderWidth: horizontal ? { right: 2 } : { top: 2 },
    borderSkipped: 'start',
    borderRadius: pontaArredondada,
    maxBarThickness: horizontal ? 18 : 24,
    categoryPercentage: 0.7,
    barPercentage: 0.9
  };
}

export function opcoesColunas(onClick?: Clique): ChartConfiguration<'bar'>['options'] {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: animacao(500),
    interaction: { mode: 'index', intersect: false },
    onClick: aoClicar(onClick),
    onHover: cursor(onClick),
    plugins: { legend: { display: false }, tooltip: tooltip as TooltipOptions<'bar'> },
    scales: {
      x: { stacked: true, grid: { display: false }, border: { color: GRADE }, ticks: { color: TINTA_MUDA, font: FONTE, maxRotation: 0, autoSkipPadding: 8 } },
      y: {
        stacked: true, beginAtZero: true, border: { display: false },
        grid: { color: GRADE }, ticks: { color: TINTA_MUDA, font: FONTE, precision: 0, maxTicksLimit: 5 }
      }
    }
  };
}

export function opcoesBarrasHorizontais(onClick?: Clique): ChartConfiguration<'bar'>['options'] {
  return {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: animacao(500),
    interaction: { mode: 'index', intersect: false, axis: 'y' },
    onClick: aoClicar(onClick),
    onHover: cursor(onClick),
    plugins: { legend: { display: false }, tooltip: tooltip as TooltipOptions<'bar'> },
    scales: {
      x: {
        stacked: true, beginAtZero: true, border: { display: false }, position: 'top',
        grid: { color: GRADE }, ticks: { color: TINTA_MUDA, font: FONTE, precision: 0, maxTicksLimit: 6 }
      },
      y: {
        stacked: true, grid: { display: false }, border: { color: GRADE },
        ticks: {
          color: '#2c3654', font: { ...FONTE, size: 12.5 }, autoSkip: false,
          callback(v) {
            const r = String(this.getLabelForValue(Number(v)));
            return r.length > 24 ? r.slice(0, 23) + '…' : r;
          }
        }
      }
    }
  };
}

export function opcoesRosca(onClick?: Clique): ChartConfiguration<'doughnut'>['options'] {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '74%',
    animation: animacao(600),
    onClick: aoClicar(onClick),
    onHover: cursor(onClick),
    plugins: {
      legend: { display: false },
      tooltip: {
        ...(tooltip as TooltipOptions<'doughnut'>),
        callbacks: {
          label: (c) => {
            const total = (c.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const pct = total ? Math.round((Number(c.raw) / total) * 100) : 0;
            return ` ${c.label}: ${c.raw} (${pct}%)`;
          }
        }
      }
    }
  };
}

// ---------------------------------------------------------------- dados

function legendaDe(data: ChartData<'bar', number[]>): LegendaItem[] {
  return data.datasets.map(d => ({
    label: d.label ?? '',
    cor: String(d.backgroundColor),
    total: d.data.reduce((a, b) => a + b, 0)
  }));
}

function responsavelDe(o: ObrigacaoPendenteResponseDTO): ResponsavelObrigacao {
  return o.responsavel === ResponsavelObrigacao.CLIENTE ? ResponsavelObrigacao.CLIENTE : ResponsavelObrigacao.ESCRITORIO;
}

function ddmm(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function mesCurto(ym: Ym): string {
  const [a, m] = ym.split('-').map(Number);
  const nome = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${nome}/${String(a).slice(2)}`;
}

export interface GraficoBarras { data: ChartData<'bar', number[]>; legenda: LegendaItem[]; total: number; }

/** Obrigações em aberto que vencem nas próximas `semanas`, por semana e por responsável. */
export function vencimentosPorSemana(obrig: ObrigacaoPendenteResponseDTO[], semanas = 6): GraficoBarras {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const labels = Array.from({ length: semanas }, (_, k) => {
    if (k === 0) return 'Esta semana';
    if (k === 1) return 'Próxima';
    const ini = new Date(hoje);
    ini.setDate(ini.getDate() + 7 * k);
    return ddmm(ini);
  });
  const resp = [ResponsavelObrigacao.ESCRITORIO, ResponsavelObrigacao.CLIENTE];
  const cont = resp.map(() => new Array<number>(semanas).fill(0));
  for (const o of obrig) {
    const d = o.diasParaVencer;
    if (o.status === 'ENTREGUE' || d == null || d < 0 || d >= semanas * 7) continue;
    cont[resp.indexOf(responsavelDe(o))][Math.floor(d / 7)]++;
  }
  const data = { labels, datasets: resp.map((r, i) => serie(ROTULO_RESPONSAVEL[r], cont[i], COR_RESPONSAVEL[r])) };
  const legenda = legendaDe(data);
  return { data, legenda, total: legenda.reduce((a, l) => a + l.total, 0) };
}

/** Base "do mês": vencimentos do mês corrente + o que segue vencido de meses anteriores. */
export function doMes(obrig: ObrigacaoPendenteResponseDTO[]): ObrigacaoPendenteResponseDTO[] {
  const mes = ymDe(new Date());
  return obrig.filter(o => ymDaData(o.dataVencimento) === mes || situacaoDe(o) === 'vencida');
}

export interface GraficoRosca { data: ChartData<'doughnut', number[]>; legenda: LegendaItem[]; total: number; chaves: Situacao[]; }

export function situacaoDoMes(obrig: ObrigacaoPendenteResponseDTO[]): GraficoRosca {
  const cont: Record<Situacao, number> = { noPrazo: 0, atraso: 0, pendente: 0, vencida: 0 };
  for (const o of doMes(obrig)) cont[situacaoDe(o)]++;
  const chaves = ORDEM_SITUACAO.filter(s => cont[s] > 0);
  const legenda = ORDEM_SITUACAO.map(s => ({ label: ROTULO_SITUACAO[s], cor: COR_SITUACAO[s], total: cont[s] }));
  return {
    chaves,
    legenda,
    total: legenda.reduce((a, l) => a + l.total, 0),
    data: {
      labels: chaves.map(s => ROTULO_SITUACAO[s]),
      datasets: [{
        data: chaves.map(s => cont[s]),
        backgroundColor: chaves.map(s => COR_SITUACAO[s]),
        hoverBackgroundColor: chaves.map(s => COR_SITUACAO[s]),
        borderColor: SUPERFICIE,
        borderWidth: 2,
        hoverOffset: 4
      }]
    }
  };
}

export interface GraficoHistorico extends GraficoBarras { taxa: number | null; }

/** Situação das obrigações por mês de vencimento, nos últimos `meses` (inclui o atual). */
export function historicoMensal(obrig: ObrigacaoPendenteResponseDTO[], meses = 6): GraficoHistorico {
  const atual = ymDe(new Date());
  const yms = Array.from({ length: meses }, (_, i) => ymSomar(atual, i - (meses - 1)));
  const cont = ORDEM_SITUACAO.map(() => new Array<number>(meses).fill(0));
  for (const o of obrig) {
    const i = yms.indexOf(ymDaData(o.dataVencimento) ?? '');
    if (i >= 0) cont[ORDEM_SITUACAO.indexOf(situacaoDe(o))][i]++;
  }
  const data = {
    labels: yms.map(mesCurto),
    datasets: ORDEM_SITUACAO.map((s, k) => serie(ROTULO_SITUACAO[s], cont[k], COR_SITUACAO[s]))
  };
  const legenda = legendaDe(data);
  const [noPrazo, atraso, , vencida] = legenda.map(l => l.total);
  const resolvidas = noPrazo + atraso + vencida;
  return {
    data, legenda,
    total: legenda.reduce((a, l) => a + l.total, 0),
    taxa: resolvidas ? Math.round((noPrazo / resolvidas) * 100) : null
  };
}

export interface GraficoCarteira extends GraficoBarras { ids: number[]; altura: number; }

/** Por empresa: situação das obrigações do mês (mais urgentes no topo). */
export function saudeCarteira(obrig: ObrigacaoPendenteResponseDTO[], empresas: EmpresaResponseDTO[]): GraficoCarteira {
  const base = doMes(obrig);
  const linhas = empresas.map(e => {
    const c: Record<Situacao, number> = { noPrazo: 0, atraso: 0, pendente: 0, vencida: 0 };
    for (const o of base) if (o.idEmpresa === e.id) c[situacaoDe(o)]++;
    return { id: e.id!, nome: e.nomeFantasia || e.razaoSocial || `Empresa ${e.id}`, c };
  }).sort((a, b) => b.c.vencida - a.c.vencida || b.c.pendente - a.c.pendente || a.nome.localeCompare(b.nome, 'pt-BR'));
  const data = {
    labels: linhas.map(l => l.nome),
    datasets: ORDEM_SITUACAO.map(s => serie(ROTULO_SITUACAO[s], linhas.map(l => l.c[s]), COR_SITUACAO[s], true))
  };
  const legenda = legendaDe(data);
  return {
    data, legenda,
    ids: linhas.map(l => l.id),
    total: legenda.reduce((a, l) => a + l.total, 0),
    altura: Math.max(220, linhas.length * 34 + 40)
  };
}

/** Documentos ativos por categoria fiscal (série única: sem legenda, o título nomeia). */
export function documentosPorCategoria(arquivos: ArquivoResponseDTO[], maximo = 7): GraficoBarras & { chaves: string[] } {
  const cont = new Map<string, number>();
  for (const a of arquivos) {
    const k = a.categoriaFiscal || 'SEM_CATEGORIA';
    cont.set(k, (cont.get(k) ?? 0) + 1);
  }
  const ordem = [...cont.entries()].sort((a, b) => b[1] - a[1]).slice(0, maximo);
  const rotulo = (k: string) => k === 'SEM_CATEGORIA' ? 'Sem categoria' : CategoriaFiscalLabel[k as CategoriaFiscal] ?? k;
  const data = {
    labels: ordem.map(([k]) => rotulo(k)),
    datasets: [serie('Documentos', ordem.map(([, v]) => v), COR_UNICA, true)]
  };
  return { data, chaves: ordem.map(([k]) => k), legenda: legendaDe(data), total: arquivos.length };
}
