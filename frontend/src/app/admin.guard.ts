import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export const adminGuard: CanMatchFn = async () => {
  const api = inject(ApiService);
  const router = inject(Router);

  try {
    const s = await firstValueFrom(api.getSession());
    if (s.authenticated && s.user?.role === 'admin') return true;
    if (s.authenticated) {
      // logged in but not an admin
      if (s.user?.event_locator) {
        router.navigate([`/user/${s.user.event_locator}`]);
      } else {
        router.navigate(['/']);
      }
      return false;
    }
  } catch {
    // ignore
  }

  router.navigate(['/']);
  return false;
};

