import { supabase } from '../supabase/client';

export type CommChannel = 'in_app' | 'email' | 'sms' | 'whatsapp';
export type CommStatus = 'draft' | 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'cancelled' | 'not_configured';

export interface SendMessagePayload {
  customerId: string;
  recipient: string;
  channel: CommChannel;
  templateKey?: string;
  templateId?: string;
  subject?: string;
  messageBody: string;
  messageType: string;
  productUnitId?: string;
  saleId?: string;
  warrantyId?: string;
  serviceTicketId?: string;
  salesReturnId?: string;
  isSimulation?: boolean;
}

export interface SendMessageResult {
  success: boolean;
  logId?: string;
  status: CommStatus;
  providerName: string;
  providerMessageId?: string;
  message: string;
}

export interface ICommunicationAdapter {
  send(payload: SendMessagePayload): Promise<SendMessageResult>;
}

/**
 * Provider Adapter: Simulated / Test Mode Adapter
 * Clearly labels all dispatches as Simulation/Test Mode when no external API provider is bound.
 */
export class SimulationAdapter implements ICommunicationAdapter {
  async send(payload: SendMessagePayload): Promise<SendMessageResult> {
    const isSimulated = payload.isSimulation !== false;
    const providerName = 'SIMULATED_TEST_PROVIDER';
    const providerMsgId = `SIM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const status: CommStatus = isSimulated ? 'sent' : 'not_configured';
    const failureReason = isSimulated
      ? 'Simulation/Test Mode — No external network request was sent to real customer gateway.'
      : 'External message gateway not configured.';

    // Insert log record in Supabase
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id || null;

    const { data, error } = await supabase
      .from('communication_logs')
      .insert({
        customer_id: payload.customerId,
        product_unit_id: payload.productUnitId || null,
        sale_id: payload.saleId || null,
        warranty_id: payload.warrantyId || null,
        service_ticket_id: payload.serviceTicketId || null,
        sales_return_id: payload.salesReturnId || null,
        channel: payload.channel,
        message_type: payload.messageType,
        template_id: payload.templateId || null,
        recipient: payload.recipient,
        subject: payload.subject || null,
        message_body: payload.messageBody,
        provider_name: providerName,
        provider_message_id: providerMsgId,
        status: status,
        failure_reason: failureReason,
        sent_at: isSimulated ? new Date().toISOString() : null,
        created_by: userId,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to log communication dispatch:', error);
      throw new Error(`Database log error: ${error.message}`);
    }

    return {
      success: true,
      logId: data?.id,
      status: status,
      providerName: providerName,
      providerMessageId: providerMsgId,
      message: failureReason
    };
  }
}

export class ProviderAdapterFactory {
  static getAdapter(channel: CommChannel): ICommunicationAdapter {
    // Return SimulationAdapter by default for Phase 6.5 foundation
    return new SimulationAdapter();
  }
}
