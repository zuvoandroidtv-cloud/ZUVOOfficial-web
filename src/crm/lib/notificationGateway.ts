/**
 * ZUVO TV CRM — Notification Gateway Abstraction & Adapter Layer
 * 
 * Provides a provider-agnostic, fail-safe communication gateway interface
 * for SMS, WhatsApp, and In-App notifications.
 * 
 * In accordance with Phase 7.0 requirements:
 * - VITE_SMS_GATEWAY_ENABLED=false by default (Safe simulation & in-app fallback)
 * - Zero third-party secrets exposed in client-side code
 * - Graceful fallback to simulation logging and in-app notifications
 * - Standardized delivery receipts and idempotency key handling
 */

export type NotificationChannel = 'sms' | 'whatsapp' | 'in_app' | 'email';
export type DeliveryStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'not_configured';

export interface NotificationPayload {
  idempotencyKey?: string;
  recipient: string;
  channel: NotificationChannel;
  messageType: string;
  subject?: string;
  messageBody: string;
  metadata?: Record<string, any>;
  customerName?: string;
  customerId?: string;
  ticketId?: string;
  warrantyId?: string;
}

export interface NotificationDeliveryResult {
  success: boolean;
  channel: NotificationChannel;
  provider: string;
  messageId: string;
  status: DeliveryStatus;
  isSimulated: boolean;
  deliveredAt?: string;
  error?: string;
}

export interface NotificationGatewayConfig {
  enabled: boolean;
  primaryProvider: 'simulation' | 'webhook_relay' | 'disabled';
  defaultSenderId: string;
  supportContact: string;
}

export interface INotificationProvider {
  readonly providerName: string;
  send(payload: NotificationPayload): Promise<NotificationDeliveryResult>;
  checkHealth?(): Promise<{ ok: boolean; message: string }>;
}

/**
 * 1. Safe Local Simulation Provider (Default)
 * Simulates telecom/messaging delivery in development and test environments
 * without calling external APIs or incurring financial costs.
 */
export class SimulationNotificationProvider implements INotificationProvider {
  readonly providerName = 'ZUVO_SIMULATION_ADAPTER';

  async send(payload: NotificationPayload): Promise<NotificationDeliveryResult> {
    const timestamp = new Date().toISOString();
    const simulatedMsgId = `SIM-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Mask sensitive numbers in debug logs
    const maskedRecipient = payload.recipient.length > 5 
      ? payload.recipient.substring(0, 3) + '****' + payload.recipient.slice(-2)
      : '***';

    console.info(`[ZUVO Comm Gateway Simulation] Channel: ${payload.channel} | Recipient: ${maskedRecipient} | Type: ${payload.messageType}`);

    return {
      success: true,
      channel: payload.channel,
      provider: this.providerName,
      messageId: simulatedMsgId,
      status: 'delivered',
      isSimulated: true,
      deliveredAt: timestamp
    };
  }

  async checkHealth() {
    return { ok: true, message: 'Simulation adapter operational' };
  }
}

/**
 * 2. Webhook Relay Provider (For Authorized Self-Hosted Backend Dispatchers)
 * Relays payload to a secure backend endpoint if configured, safely falling back to simulation if unreachable.
 */
export class WebhookRelayNotificationProvider implements INotificationProvider {
  readonly providerName = 'ZUVO_SECURE_RELAY_ADAPTER';
  private endpointUrl: string;

  constructor(endpointUrl: string) {
    this.endpointUrl = endpointUrl;
  }

  async send(payload: NotificationPayload): Promise<NotificationDeliveryResult> {
    try {
      if (!this.endpointUrl || typeof window === 'undefined') {
        throw new Error('Relay endpoint not configured');
      }

      const res = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': payload.idempotencyKey || `IDEM-${Date.now()}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Relay returned HTTP ${res.status}`);
      }

      const data = await res.json();
      return {
        success: true,
        channel: payload.channel,
        provider: this.providerName,
        messageId: data.messageId || `RELAY-${Date.now()}`,
        status: data.status || 'sent',
        isSimulated: false,
        deliveredAt: data.deliveredAt || new Date().toISOString()
      };
    } catch (err: any) {
      console.warn(`[ZUVO Comm Gateway] Relay error: ${err.message}. Falling back to safe simulation.`);
      return {
        success: false,
        channel: payload.channel,
        provider: this.providerName,
        messageId: `FAIL-${Date.now()}`,
        status: 'not_configured',
        isSimulated: true,
        error: err.message
      };
    }
  }
}

/**
 * 3. Notification Gateway Service (Orchestrator)
 * Enforces provider fallback, idempotency cache, and audit logging.
 */
export class NotificationGatewayService {
  private static instance: NotificationGatewayService;
  private config: NotificationGatewayConfig;
  private primaryProvider: INotificationProvider;
  private simulationProvider: INotificationProvider;
  private idempotencyStore = new Map<string, NotificationDeliveryResult>();

  private constructor() {
    const isGatewayEnabled = typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_SMS_GATEWAY_ENABLED === 'true'
      : false;

    this.config = {
      enabled: isGatewayEnabled,
      primaryProvider: isGatewayEnabled ? 'webhook_relay' : 'simulation',
      defaultSenderId: 'ZUVOTV',
      supportContact: '+91 8056666653'
    };

    this.simulationProvider = new SimulationNotificationProvider();

    if (this.config.enabled && typeof import.meta !== 'undefined' && import.meta.env?.VITE_SMS_GATEWAY_URL) {
      this.primaryProvider = new WebhookRelayNotificationProvider(import.meta.env.VITE_SMS_GATEWAY_URL);
    } else {
      this.primaryProvider = this.simulationProvider;
    }
  }

  public static getInstance(): NotificationGatewayService {
    if (!NotificationGatewayService.instance) {
      NotificationGatewayService.instance = new NotificationGatewayService();
    }
    return NotificationGatewayService.instance;
  }

  public getConfig(): Readonly<NotificationGatewayConfig> {
    return { ...this.config };
  }

  public setSimulationMode(enabled: boolean) {
    this.config.enabled = !enabled;
    this.primaryProvider = enabled ? this.simulationProvider : this.primaryProvider;
  }

  /**
   * Dispatches a notification across the configured provider with automatic simulation fallback.
   */
  public async dispatchNotification(payload: NotificationPayload): Promise<NotificationDeliveryResult> {
    // 1. Idempotency Check
    if (payload.idempotencyKey && this.idempotencyStore.has(payload.idempotencyKey)) {
      const cached = this.idempotencyStore.get(payload.idempotencyKey)!;
      console.info(`[ZUVO Comm Gateway] Idempotency hit: returning cached delivery for key ${payload.idempotencyKey}`);
      return cached;
    }

    // 2. Dispatch via primary provider with graceful fallback
    let result: NotificationDeliveryResult;
    try {
      if (!this.config.enabled || payload.channel === 'in_app') {
        result = await this.simulationProvider.send(payload);
      } else {
        result = await this.primaryProvider.send(payload);
        if (!result.success) {
          // Graceful fallback to simulation
          result = await this.simulationProvider.send(payload);
          result.status = 'delivered'; // Delivered in simulation fallback
        }
      }
    } catch (error: any) {
      console.warn(`[ZUVO Comm Gateway] Provider exception. Executing safe simulation fallback:`, error);
      result = await this.simulationProvider.send(payload);
    }

    // 3. Cache Idempotency
    if (payload.idempotencyKey) {
      this.idempotencyStore.set(payload.idempotencyKey, result);
    }

    return result;
  }
}

export const notificationGateway = NotificationGatewayService.getInstance();
