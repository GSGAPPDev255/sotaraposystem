import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { AuditLogEntry } from '../lib/supabase';

export function useAuditLog(poId: string) {
  return useQuery({
    queryKey: ['audit', poId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('purchase_order_id', poId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as AuditLogEntry[];
    },
    enabled: !!poId,
  });
}

export function useApprovers() {
  return useQuery({
    queryKey: ['approvers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approvers')
        .select('*')
        .eq('is_active', true)
        .order('display_name');
      if (error) throw error;
      return data;
    },
  });
}

export function useMarkReadyForApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (poId: string) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Update PO status
      const { data, error } = await supabase
        .from('purchase_orders')
        .update({ status: 'pending_approval', updated_by_id: user?.id })
        .eq('id', poId)
        .select()
        .single();
      if (error) throw error;

      // Trigger send-approval edge function
      const { error: fnError } = await supabase.functions.invoke('send-approval', {
        body: { purchase_order_id: poId },
      });
      if (fnError) throw fnError;

      return data;
    },
    onSuccess: (_, poId) => {
      qc.invalidateQueries({ queryKey: ['invoice', poId] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['audit', poId] });
    },
  });
}

export function useSubmitApprovalDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      purchase_order_id: string;
      action: 'approve' | 'reject' | 'forward';
      comment?: string;
      forward_to_approver_id?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('process-approval', {
        body: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['invoice', vars.purchase_order_id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['audit', vars.purchase_order_id] });
    },
  });
}
