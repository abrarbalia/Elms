import { Injectable, signal, computed } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'offline';

export interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message: string;
  duration: number;
}

let _id = 0;

@Injectable({ providedIn: 'root' })
export class ToastService {

  private _toasts = signal<Toast[]>([]);
  readonly toasts = computed(() => this._toasts());

  show(type: ToastType, title: string, message: string, duration = 4000): void {
    const toast: Toast = { id: ++_id, type, title, message, duration };
    this._toasts.update(list => [...list, toast]);

    if (duration > 0) {
      setTimeout(() => this.dismiss(toast.id), duration);
    }
  }

  success(title: string, message = '')  { this.show('success', title, message); }
  error(title: string, message = '')    { this.show('error',   title, message, 6000); }
  warning(title: string, message = '')  { this.show('warning', title, message, 5000); }
  info(title: string, message = '')     { this.show('info',    title, message); }
  offline(title: string, message = '')  { this.show('offline', title, message, 5000); }

  dismiss(id: number): void {
    this._toasts.update(list => list.filter(t => t.id !== id));
  }
}
