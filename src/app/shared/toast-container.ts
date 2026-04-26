import { Component, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from './toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      @for (toast of toasts(); track toast.id) {
        <div class="toast-item toast-{{ toast.type }}" role="alert">
          <div class="toast-icon">
            <i class="bi {{ iconFor(toast.type) }}"></i>
          </div>
          <div class="toast-body">
            <div class="toast-title">{{ toast.title }}</div>
            @if (toast.message) {
              <div class="toast-msg">{{ toast.message }}</div>
            }
          </div>
          <button class="toast-close" (click)="dismiss(toast.id)" aria-label="Close">
            <i class="bi bi-x"></i>
          </button>
          @if (toast.duration > 0) {
            <div class="toast-progress" [style.animation-duration]="toast.duration + 'ms'"></div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
      width: 340px;
    }

    .toast-item {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      backdrop-filter: blur(12px);
      pointer-events: all;
      overflow: hidden;
      animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(110%) scale(0.9); }
      to   { opacity: 1; transform: translateX(0) scale(1); }
    }

    /* Type themes */
    .toast-success { background: rgba(16, 185, 129, 0.95); color: #fff; }
    .toast-error   { background: rgba(239, 68, 68, 0.95);  color: #fff; }
    .toast-warning { background: rgba(245, 158, 11, 0.95); color: #fff; }
    .toast-info    { background: rgba(59, 130, 246, 0.95); color: #fff; }
    .toast-offline { background: rgba(99, 102, 241, 0.95); color: #fff; }

    .toast-icon {
      font-size: 18px;
      flex-shrink: 0;
      margin-top: 1px;
      opacity: 0.9;
    }

    .toast-body { flex: 1; min-width: 0; }

    .toast-title {
      font-weight: 700;
      font-size: 13px;
      line-height: 1.4;
    }

    .toast-msg {
      font-size: 12px;
      opacity: 0.85;
      margin-top: 2px;
      line-height: 1.4;
      word-break: break-word;
    }

    .toast-close {
      background: rgba(255,255,255,0.2);
      border: none;
      color: inherit;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 12px;
      flex-shrink: 0;
      padding: 0;
      transition: background 0.15s;
    }
    .toast-close:hover { background: rgba(255,255,255,0.35); }

    /* Progress bar */
    .toast-progress {
      position: absolute;
      bottom: 0; left: 0;
      height: 3px;
      background: rgba(255,255,255,0.45);
      border-radius: 0 0 12px 12px;
      width: 100%;
      transform-origin: left;
      animation: shrink linear forwards;
    }

    @keyframes shrink {
      from { transform: scaleX(1); }
      to   { transform: scaleX(0); }
    }
  `]
})
export class ToastContainerComponent {
  readonly toasts = computed(() => this.svc.toasts());

  constructor(private svc: ToastService) {}

  dismiss(id: number) { this.svc.dismiss(id); }

  iconFor(type: string): string {
    const icons: Record<string, string> = {
      success: 'bi-check-circle-fill',
      error:   'bi-x-circle-fill',
      warning: 'bi-exclamation-triangle-fill',
      info:    'bi-info-circle-fill',
      offline: 'bi-wifi-off'
    };
    return icons[type] ?? 'bi-bell-fill';
  }
}
