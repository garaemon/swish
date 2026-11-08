'use client';

import { createAuthClient } from 'better-auth/react';

/**
 * Browser-side Better Auth client. Calls the same-origin /api/auth/* routes,
 * so no base URL configuration is needed.
 */
export const authClient = createAuthClient();
