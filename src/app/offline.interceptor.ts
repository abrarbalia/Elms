import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { of } from 'rxjs';
import { OfflineSyncService } from './offline-sync.service';

/**
 * Offline HTTP Interceptor
 *
 * When the device is offline:
 *   - POST / PUT / DELETE requests are intercepted and queued in IndexedDB
 *   - A synthetic HttpResponse(offlineQueued: true) is returned so components
 *     continue their success path (form resets, alerts, etc.) without errors
 *
 * When online:
 *   - All requests flow through unchanged
 *
 * GET requests are always forwarded (they may hit the cache fallback elsewhere).
 */
export const offlineInterceptor: HttpInterceptorFn = (req, next) => {
  // Only intercept state-changing requests
  const isStateMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method.toUpperCase());

  if (!isStateMutation || (typeof navigator !== 'undefined' && navigator.onLine)) {
    return next(req);
  }

  const offlineSync = inject(OfflineSyncService);

  // Serialize headers (exclude auto-set browser headers)
  const headers: Record<string, string> = {};
  req.headers.keys().forEach(key => {
    const value = req.headers.get(key);
    if (value) headers[key] = value;
  });

  const isFormData = req.body instanceof FormData;

  // Queue request in IndexedDB
  offlineSync.queueRequest(
    req.url,
    req.method,
    req.body,
    headers,
    isFormData
  );

  // Return a synthetic success response so the component's `.next()` handler fires
  return of(
    new HttpResponse({
      status: 200,
      body: { offlineQueued: true, message: 'Request saved offline. Will sync when reconnected.' }
    })
  );
};
