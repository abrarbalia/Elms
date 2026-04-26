// import { HttpInterceptorFn } from '@angular/common/http';
// import { catchError } from 'rxjs/operators';
// import { throwError } from 'rxjs';

// export const authInterceptor: HttpInterceptorFn = (req, next) => {
//   const token = JSON.parse(localStorage.getItem('user')!)?.token || '';

//   const clonedReq = token
//     ? req.clone({
//         setHeaders: { Authorization: `Bearer ${token}` }
//       })
//     : req;

//   return next(clonedReq).pipe(
//     catchError((error) => {
//       console.error('HTTP Error:', error);
//       return throwError(() => error);
//     })
//   );
// };


import { HttpInterceptorFn } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {

  let token = '';

  // ✅ FIX HERE
  if (typeof window !== 'undefined' && localStorage.getItem('user')) {
    const user = JSON.parse(localStorage.getItem('user')!);
    token = user?.token || '';
  }

  const clonedReq = token
    ? req.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      })
    : req;

  return next(clonedReq).pipe(
    catchError((error) => {
      console.error('HTTP Error:', error);
      return throwError(() => error);
    })
  );
};