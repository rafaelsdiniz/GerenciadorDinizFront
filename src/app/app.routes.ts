import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component/login.component')
      .then(m => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./components/layout/layout.component/layout.component')
      .then(m => m.LayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./components/dashboard/dashboard.component/dashboard.component')
          .then(m => m.DashboardComponent)
      },
      {
        path: 'empresas',
        canActivate: [adminGuard],
        loadComponent: () => import('./components/empresa/empresa-list/empresa-list.component')
          .then(m => m.EmpresaListComponent)
      },
      {
        path: 'empresas/:id',
        loadComponent: () => import('./components/empresa/empresa-detail/empresa-detail.component')
          .then(m => m.EmpresaDetailComponent)
      },
      {
        path: 'arquivos',
        loadComponent: () => import('./components/explorer/explorer.component')
          .then(m => m.ExplorerComponent)
      },
      {
        path: 'pastas',
        redirectTo: 'arquivos',
        pathMatch: 'full'
      },
      {
        path: 'lixeira',
        loadComponent: () => import('./components/lixeira/lixeira.component')
          .then(m => m.LixeiraComponent)
      },
      {
        path: 'calendario',
        loadComponent: () => import('./components/calendario/calendario.component')
          .then(m => m.CalendarioComponent)
      },
      {
        path: 'obrigacoes-recorrentes',
        loadComponent: () => import('./components/obrigacao-recorrente/obrigacao-recorrente-list.component')
          .then(m => m.ObrigacaoRecorrenteListComponent)
      },
      {
        path: 'obrigacoes-pendentes',
        loadComponent: () => import('./components/obrigacao-pendente/obrigacao-pendente-list.component')
          .then(m => m.ObrigacaoPendenteListComponent)
      },
      {
        path: 'logs',
        canActivate: [adminGuard],
        loadComponent: () => import('./components/log-acesso/log-acesso-list.component')
          .then(m => m.LogAcessoListComponent)
      },
      {
        path: 'usuarios',
        canActivate: [adminGuard],
        loadComponent: () => import('./components/usuario/usuario-list/usuario-list.component')
          .then(m => m.UsuarioListComponent)
      },
      {
        path: 'socios',
        canActivate: [adminGuard],
        loadComponent: () => import('./components/socio/socio-list/socio-list.component')
          .then(m => m.SocioListComponent)
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
