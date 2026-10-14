/**
 * ZUVO TV CRM Integration Configuration
 *
 * Configures the connection endpoints between the official public website
 * and the ZUVO TV CRM / Supabase operational system.
 */

// CRM Application Host URL
// In development, defaults to local Vite CRM dev port (http://localhost:5173).
// In production, configure VITE_ZUVO_CRM_URL in environment (e.g., https://crm.zuvoandroidtv.com).
export const ZUVO_CRM_URL =
  import.meta.env.VITE_ZUVO_CRM_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5173'
    : 'https://crm.zuvoandroidtv.com');

/**
 * Returns the URL for customer warranty registration.
 * Appends '?view=warranty&embed=true' for embedded mode or clean customer view.
 */
export const getCrmWarrantyUrl = (options?: { embedded?: boolean }): string => {
  const base = ZUVO_CRM_URL.replace(/\/+$/, '');
  const params = new URLSearchParams();
  params.set('view', 'warranty');
  if (options?.embedded) {
    params.set('embed', 'true');
  }
  return `${base}/?${params.toString()}`;
};

/**
 * Returns the URL for authorized ZUVO staff and service administrator authentication.
 */
export const getCrmStaffLoginUrl = (): string => {
  const base = ZUVO_CRM_URL.replace(/\/+$/, '');
  return `${base}/login`;
};
