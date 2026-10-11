/**
 * ZUVO Analytics & Event Tracking Engine
 * Safe wrapper for Google Analytics (GA4 gtag) & custom conversion telemetry.
 */

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

export type ConversionEvent =
  | 'dealer_form_start'
  | 'dealer_form_submit'
  | 'whatsapp_click'
  | 'phone_click'
  | 'product_enquiry_submit'
  | 'page_view';

export interface EventParams {
  category?: string;
  label?: string;
  value?: number;
  model?: string;
  source?: string;
  [key: string]: any;
}

export const trackEvent = (eventName: ConversionEvent, params: EventParams = {}) => {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', eventName, {
        ...params,
        timestamp: new Date().toISOString(),
      });
    }

    // Always log in development for debugging
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(`[Analytics Event] ${eventName}:`, params);
    }
  } catch (err) {
    // Fail gracefully without breaking user actions
  }
};

export const trackWhatsAppClick = (category: string, modelOrLabel?: string) => {
  trackEvent('whatsapp_click', {
    category,
    label: modelOrLabel || 'General Inquire',
  });
};

export const trackPhoneClick = (source: string) => {
  trackEvent('phone_click', {
    source,
    label: '+91 8056666653',
  });
};
