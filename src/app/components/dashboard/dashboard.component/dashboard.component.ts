import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { ArquivoResponseDTO } from '../../../models/arquivo-response.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { PastaResponseDTO } from '../../../models/pasta-response.dto';
import { DashboardResponseDTO } from '../../../models/dashboard-response.dto';
import { LogAcessoResponseDTO } from '../../../models/log-acesso-response.dto';
import { ObrigacaoPendenteResponseDTO } from '../../../models/obrigacao-pendente-response.dto';
import { ArquivoService } from '../../../services/arquivo.service';
import { AuthService } from '../../../services/auth.service';
import { EmpresaService } from '../../../services/empresa.service';
import { PastaService } from '../../../services/pasta.service';
import { SocioService } from '../../../services/socio.service';
import { UsuarioService } from '../../../services/usuario.service';
import { DashboardService } from '../../../services/dashboard.service';
import { LogAcessoService } from '../../../services/log-acesso.service';
import { ObrigacaoPendenteService } from '../../../services/obrigacao-pendente.service';
import { StatusArquivo, StatusArquivoLabel } from '../../../models/enums/status-arquivo.enum';
import { CategoriaFiscal, CategoriaFiscalLabel } from '../../../models/enums/categoria-fiscal.enum';
import { AcaoLogLabel } from '../../../models/enums/acao-log.enum';

interface DistItem {
  chave: string;
  label: string;
  total: number;
  percentual: number;
  cor: string;
}

interface ResumoEmpresa {
  id: number;
  nome: string;
  total: number;
  vencidos: number;
  pendentes: number;
  vencendo7: number;
}

interface ProximoVencimento {
  id: number;
  nome: string;
  descricao: string | null;
  dataVencimento: string;
  diasParaVencer: number;
  status: StatusArquivo | null;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {

  private readonly EMPRESA_KEY = 'dashboard.empresaSelecionada';

  dataAtual = '';
  saudacao = '';
  nomeUsuario = '';
  isAdmin = false;

  totalEmpresas = 0;
  totalArquivos = 0;
  totalPastas = 0;
  totalUsuarios = 0;
  totalSocios = 0;
  totalStorage = '0 B';
  totalVencidosGeral = 0;
  totalPendentesObrigGeral = 0;

  arquivos: ArquivoResponseDTO[] = [];
  empresas: EmpresaResponseDTO[] = [];
  pastas: PastaResponseDTO[] = [];
  logsRecentes: LogAcessoResponseDTO[] = [];
  obrigacoesGeral: ObrigacaoPendenteResponseDTO[] = [];
  resumoEmpresas: ResumoEmpresa[] = [];
  proximosVencimentos: ProximoVencimento[] = [];

  carregando = true;

  idEmpresaSelecionada: number | null = null;
  metricas: DashboardResponseDTO | null = null;
  carregandoMetricas = false;
  distStatus: DistItem[] = [];
  distCategoria: DistItem[] = [];

  // ================= GRÁFICOS =================
  chartDoughnutData: ChartConfiguration<'doughnut'>['data'] | undefined;
  chartDoughnutOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { color: '#a0a0a0', font: { family: 'Inter' } } }
    },
    cutout: '70%'
  };

  chartBarData: ChartConfiguration<'bar'>['data'] | undefined;
  chartBarOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { color: '#a0a0a0', font: { family: 'Inter' } } },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      x: { stacked: true, grid: { color: '#ffffff10' }, ticks: { color: '#a0a0a0' } },
      y: { stacked: true, grid: { color: '#ffffff10' }, ticks: { color: '#a0a0a0', stepSize: 1 } }
    }
  };
  // ============================================

  statusLabel = StatusArquivoLabel;
  categoriaLabel = CategoriaFiscalLabel;
  acaoLabel = AcaoLogLabel;

  private coresStatus: Record<StatusArquivo, string> = {
    [StatusArquivo.PENDENTE]: '#b8952a',
    [StatusArquivo.ENTREGUE]: '#2e7d32',
    [StatusArquivo.VENCIDO]: '#c62828',
    [StatusArquivo.ARQUIVADO]: '#455a64'
  };

  constructor(
    private arquivoService: ArquivoService,
    private empresaService: EmpresaService,
    private pastaService: PastaService,
    private usuarioService: UsuarioService,
    private socioService: SocioService,
    private authService: AuthService,
    private dashboardService: DashboardService,
    private logService: LogAcessoService,
    private obrigacaoPendenteService: ObrigacaoPendenteService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.dataAtual = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
    this.saudacao = this.calcularSaudacao();
    this.nomeUsuario = this.extrairNomeUsuario();
    this.isAdmin = this.authService.isAdmin();
    this.carregarDados();
  }

  private calcularSaudacao(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  private extrairNomeUsuario(): string {
    const sub = this.authService.getPayload()?.sub ?? '';
    if (!sub) return '';
    const local = sub.split('@')[0];
    return local
      .split(/[.\-_]/)
      .filter(Boolean)
      .map(p => p[0].toUpperCase() + p.slice(1))
      .join(' ');
  }

  carregarDados(): void {
    this.carregando = true;

    this.empresaService.listar().subscribe({
      next: (data) => {
        this.empresas = data;
        this.totalEmpresas = data.length;

        if (this.idEmpresaSelecionada == null) {
          const salva = this.lerEmpresaSalva();
          this.idEmpresaSelecionada = salva
            ?? this.authService.getEmpresaId()
            ?? data[0]?.id
            ?? null;
        }
        if (this.idEmpresaSelecionada != null) this.carregarMetricas();
      }
    });

    this.pastaService.listar().subscribe({
      next: (data) => {
        this.pastas = data;
        this.totalPastas = data.length;
      }
    });

    this.usuarioService.listar().subscribe({
      next: (data) => { this.totalUsuarios = data.length; }
    });

    this.socioService.listar().subscribe({
      next: (data) => { this.totalSocios = data.length; }
    });

    this.arquivoService.listar().subscribe({
      next: (data) => {
        this.arquivos = data;
        this.totalArquivos = data.length;
        this.totalStorage = this.calcularStorage(data);
        this.totalVencidosGeral = data.filter(a => a.status === StatusArquivo.VENCIDO).length;
        this.proximosVencimentos = this.calcularProximosVencimentos(data);
        this.atualizarResumoEmpresas();
        this.carregando = false;
      },
      error: () => { this.carregando = false; }
    });

    this.obrigacaoPendenteService.listar().subscribe({
      next: (data) => {
        this.obrigacoesGeral = data;
        this.totalPendentesObrigGeral = data.filter(o => o.status === 'PENDENTE' || o.status === 'VENCIDA').length;
        this.atualizarResumoEmpresas();
      }
    });

    if (this.isAdmin) {
      this.logService.listarRecentes(8).subscribe({
        next: (d) => this.logsRecentes = d
      });
    }
  }

  private atualizarResumoEmpresas(): void {
    if (!this.empresas.length || !this.arquivos.length) return;
    this.resumoEmpresas = this.empresas.map(e => {
      const arqs = this.arquivos.filter(a => a.idEmpresa === e.id && !a.excluidoEm);
      const vencidos = arqs.filter(a => a.status === StatusArquivo.VENCIDO).length;
      const pendentes = arqs.filter(a => a.status === StatusArquivo.PENDENTE).length;
      const vencendo7 = arqs.filter(a => a.diasParaVencer != null && a.diasParaVencer >= 0 && a.diasParaVencer <= 7).length;
      return {
        id: e.id!,
        nome: e.nomeFantasia,
        total: arqs.length,
        vencidos,
        pendentes,
        vencendo7
      };
    }).sort((a, b) => b.vencidos - a.vencidos || b.pendentes - a.pendentes);

    this.construirGraficos();
  }

  private construirGraficos(): void {
    if (this.resumoEmpresas.length === 0) return;

    // 1. Gráfico Doughnut (Saúde Geral)
    let emDia = 0;
    let comPendencias = 0;
    let comAtrasos = 0;

    this.resumoEmpresas.forEach(r => {
      if (r.vencidos > 0) comAtrasos++;
      else if (r.pendentes > 0) comPendencias++;
      else emDia++;
    });

    this.chartDoughnutData = {
      labels: ['100% em dia', 'Com Pendências', 'Com Atrasos'],
      datasets: [{
        data: [emDia, comPendencias, comAtrasos],
        backgroundColor: ['#2e7d32', '#b8952a', '#c62828'],
        hoverBackgroundColor: ['#388e3c', '#c7a331', '#d32f2f'],
        borderWidth: 0
      }]
    };

    // 2. Gráfico Bar (Top Empresas por Problemas)
    // Filtra empresas que tenham ao menos 1 pendência ou atraso
    const topEmpresas = [...this.resumoEmpresas]
      .filter(r => r.vencidos > 0 || r.pendentes > 0)
      .slice(0, 10);

    this.chartBarData = {
      labels: topEmpresas.map(r => r.nome),
      datasets: [
        {
          label: 'Atrasados (Vencidos)',
          data: topEmpresas.map(r => r.vencidos),
          backgroundColor: '#c62828',
          borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 }
        },
        {
          label: 'Pendentes',
          data: topEmpresas.map(r => r.pendentes),
          backgroundColor: '#b8952a',
          borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 }
        }
      ]
    };
  }

  private calcularProximosVencimentos(data: ArquivoResponseDTO[]): ProximoVencimento[] {
    return data
      .filter(a =>
        !a.excluidoEm
        && a.dataVencimento
        && a.diasParaVencer != null
        && a.diasParaVencer >= 0
        && a.diasParaVencer <= 14
        && a.status !== StatusArquivo.ENTREGUE
        && a.status !== StatusArquivo.ARQUIVADO
      )
      .sort((a, b) => (a.diasParaVencer ?? 0) - (b.diasParaVencer ?? 0))
      .slice(0, 8)
      .map(a => ({
        id: a.id,
        nome: a.nomeOriginal,
        descricao: a.descricao,
        dataVencimento: a.dataVencimento!,
        diasParaVencer: a.diasParaVencer!,
        status: a.status
      }));
  }

  carregarMetricas(): void {
    if (this.idEmpresaSelecionada == null) return;
    this.carregandoMetricas = true;
    this.metricas = null;
    this.salvarEmpresa(this.idEmpresaSelecionada);
    this.dashboardService.porEmpresa(this.idEmpresaSelecionada).subscribe({
      next: (data) => {
        this.metricas = data;
        this.distStatus = this.montarDistStatus(data);
        this.distCategoria = this.montarDistCategoria(data);
        this.carregandoMetricas = false;
      },
      error: () => { this.carregandoMetricas = false; }
    });
  }

  private montarDistStatus(d: DashboardResponseDTO): DistItem[] {
    const total = Object.values(d.distribuicaoPorStatus).reduce((a, b) => a + (b ?? 0), 0);
    if (total === 0) return [];
    return Object.entries(d.distribuicaoPorStatus)
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([k, v]) => ({
        chave: k,
        label: this.statusLabel[k as StatusArquivo],
        total: v as number,
        percentual: Math.round(((v as number) / total) * 100),
        cor: this.coresStatus[k as StatusArquivo]
      }));
  }

  private montarDistCategoria(d: DashboardResponseDTO): DistItem[] {
    const entries = Object.entries(d.distribuicaoPorCategoria)
      .filter(([, v]) => (v ?? 0) > 0);
    const max = Math.max(...entries.map(([, v]) => v as number), 1);
    return entries
      .map(([k, v]) => ({
        chave: k,
        label: this.categoriaLabel[k as CategoriaFiscal],
        total: v as number,
        percentual: Math.round(((v as number) / max) * 100),
        cor: '#0d1b4b'
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }

  private salvarEmpresa(id: number): void {
    try { localStorage.setItem(this.EMPRESA_KEY, String(id)); } catch {}
  }

  private lerEmpresaSalva(): number | null {
    try {
      const v = localStorage.getItem(this.EMPRESA_KEY);
      return v ? Number(v) : null;
    } catch { return null; }
  }

  navegarPara(rota: string): void {
    this.router.navigate([rota]);
  }

  abrirArquivo(id: number): void {
    this.router.navigate(['/arquivos'], { queryParams: { id } });
  }

  calcularStorage(arquivos: ArquivoResponseDTO[]): string {
    const total = arquivos.reduce((acc, a) => acc + a.tamanho, 0);
    if (total < 1024) return `${total} B`;
    if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} KB`;
    if (total < 1024 * 1024 * 1024) return `${(total / (1024 * 1024)).toFixed(1)} MB`;
    return `${(total / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  formatarTaxa(taxa: number | null): string {
    if (taxa == null) return 'sem dados';
    return `${taxa.toFixed(1)}%`;
  }

  rotuloDias(dias: number): string {
    if (dias === 0) return 'Vence hoje';
    if (dias === 1) return 'Vence amanhã';
    return `Em ${dias} dias`;
  }

  classeDias(dias: number): string {
    if (dias <= 1) return 'd-vermelho';
    if (dias <= 3) return 'd-laranja';
    if (dias <= 7) return 'd-amarelo';
    return 'd-verde';
  }
}
