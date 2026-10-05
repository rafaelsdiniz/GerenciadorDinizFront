import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UiHostComponent } from './shared/ui/ui-host.component';
import { SplashComponent } from './shared/splash/splash.component';
import { ApiStatusService } from './services/api-status.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UiHostComponent, SplashComponent],
  template: '<router-outlet /><app-ui-host /><app-splash />'
})
export class App {
  constructor() {
    // acorda API e banco já no primeiro instante, em paralelo à animação de entrada
    inject(ApiStatusService).aquecer();
  }
}
