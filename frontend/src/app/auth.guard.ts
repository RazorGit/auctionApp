import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export const authGuard: CanMatchFn = async () => {
  const api = inject(ApiService);
  const router = inject(Router);

  try {
    const s = await firstValueFrom(api.getSession());
    if (s.authenticated) return true;
  } catch {
    // ignore
  }

  router.navigate(['/']);
  return false;
};

