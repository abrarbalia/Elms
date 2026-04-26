import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OfflineIndicatorComponent } from './offline-indicator';
import { ToastContainerComponent } from './shared/toast-container';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, OfflineIndicatorComponent, ToastContainerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('elms');
}
