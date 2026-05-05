import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ArquivoService } from '../../services/arquivo.service';
import { EmpresaService } from '../../services/empresa.service';
import { AuthService } from '../../services/auth.service';
import { ArquivoResponseDTO } from '../../models/arquivo-response.dto';
import { EmpresaResponseDTO } from '../../models/empresa-response.dto';

@Component({
  selector: 'app-lixeira',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <div>
          <h1 class="page-titulo">Lixeira</h1>
          <span class="page-subtitulo">{{ arquivos.length }} arquivo(s) excluído(s)</span>
        </div>
      </div>

      @if (carregando) {
        <div class="estado-vazio"><span class="spinner"></span><p>Carregando...</p></div>
      } @else if (arquivos.length === 0) {
        <div class="estado-vazio"><p>Lixeira vazia.</p></div>
      } @else {
        <div class="tabela-wrapper">
          <table class="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Empresa</th>
                <th>Excluído em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (arquivo of arquivos; track arquivo.id) {
                <tr>
                  <td>
                    <strong>{{ arquivo.nomeOriginal }}</strong>
                    @if (arquivo.descricao) { <div class="td-desc">{{ arquivo.descricao }}</div> }
                  </td>
                  <td>{{ getNomeEmpresa(arquivo.idEmpresa) }}</td>
                  <td>{{ arquivo.excluidoEm | date:'dd/MM/yyyy HH:mm' }}</td>
                  <td class="td-acoes">
                    <button class="btn-restaurar" (click)="restaurar(arquivo)">Restaurar</button>
                    @if (isAdmin) {
                      <button class="btn-deletar" (click)="excluirPermanente(arquivo)">Excluir definitivamente</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (toastVisivel) { <div class="toast">{{ toastMensagem }}</div> }
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 2rem; max-width: 1100px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; }
    .page-header { margin-bottom: 1.5rem; }
    .page-titulo { font-size: 1.6rem; font-weight: 700; color: #0d1b4b; margin: 0; }
    .page-subtitulo { font-size: 0.82rem; color: #888; }
    .estado-vazio { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; color: #aaa; gap: 0.5rem; }
    .tabela-wrapper { background: #fff; border: 1px solid #eaeaea; border-radius: 12px; overflow: hidden; }
    .tabela { width: 100%; border-collapse: collapse; }
    .tabela th { text-align: left; background: #f9fafe; padding: 0.85rem 1rem; font-size: 0.72rem; font-weight: 700; color: #0d1b4b; text-transform: uppercase; letter-spacing: 0.04em; }
    .tabela td { padding: 0.8rem 1rem; font-size: 0.85rem; border-top: 1px solid #f0f0f0; vertical-align: middle; }
    .td-desc { color: #888; font-size: 0.72rem; margin-top: 2px; }
    .td-acoes { display: flex; gap: 0.5rem; justify-content: flex-end; }
    .btn-restaurar { background: #0d1b4b; color: #fff; border: none; border-radius: 6px; padding: 0.4rem 0.9rem; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
    .btn-restaurar:hover { background: #162566; }
    .btn-deletar { background: #fff; color: #c62828; border: 1.5px solid #fdecea; border-radius: 6px; padding: 0.4rem 0.9rem; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
    .btn-deletar:hover { background: #fdecea; }
    .spinner { width: 28px; height: 28px; border: 3px solid #eee; border-top-color: #0d1b4b; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .toast { position: fixed; bottom: 24px; right: 24px; background: #0d1b4b; color: #fff; padding: 0.75rem 1.25rem; border-radius: 8px; font-size: 0.85rem; }
  `]
})
export class LixeiraComponent implements OnInit {
  arquivos: ArquivoResponseDTO[] = [];
  empresas: EmpresaResponseDTO[] = [];
  carregando = false;
  isAdmin = false;
  toastVisivel = false;
  toastMensagem = '';

  constructor(
    private arquivoService: ArquivoService,
    private empresaService: EmpresaService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    this.empresaService.listar().subscribe({ next: (d) => this.empresas = d });
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.arquivoService.listarLixeira().subscribe({
      next: (data) => { this.arquivos = data; this.carregando = false; },
      error: () => { this.carregando = false; }
    });
  }

  getNomeEmpresa(id: number): string {
    return this.empresas.find(e => e.id === id)?.nomeFantasia ?? '—';
  }

  restaurar(arquivo: ArquivoResponseDTO): void {
    this.arquivoService.restaurar(arquivo.id).subscribe({
      next: () => { this.mostrarToast('Arquivo restaurado.'); this.carregar(); }
    });
  }

  excluirPermanente(arquivo: ArquivoResponseDTO): void {
    if (!confirm(`Excluir definitivamente "${arquivo.nomeOriginal}"? Esta ação não pode ser desfeita.`)) return;
    this.arquivoService.excluirPermanente(arquivo.id).subscribe({
      next: () => { this.mostrarToast('Arquivo excluído permanentemente.'); this.carregar(); }
    });
  }

  mostrarToast(msg: string): void {
    this.toastMensagem = msg;
    this.toastVisivel = true;
    setTimeout(() => this.toastVisivel = false, 3000);
  }
}
