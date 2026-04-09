import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { PurchaseOrder, InvoiceStatus, NominalLine, VatLine, OcrExtraction } from '../lib/supabase';

export function useInvoices(statusFilter?: InvoiceStatus | InvoiceStatus[]) {
  return useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: async () => {
      let q = supabase
        .from('purchase_orders')
        .select(`
          *,
          invoice_file:invoice_file_id (id, original_name, storage_path, email_from, email_date),
          approver:assigned_approver_id (id, email, display_name, department),
          second_approver:second_approver_id (id, email, display_name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        if (Array.isArray(statusFilter)) {
          q = q.in('status', statusFilter);
        } else {
          q = q.eq('status', statusFilter);
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as (PurchaseOrder & { invoice_file?: unknown; approver?: unknown; second_approver?: unknown })[];
    },
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          invoice_file:invoice_file_id (*),
          approver:assigned_approver_id (*),
          second_approver:second_approver_id (*),
          approved_by:approved_by_id (id, email, display_name),
          created_by:created_by_id (id, email, display_name),
          updated_by:updated_by_id (id, email, display_name)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useNominalLines(poId: string) {
  return useQuery({
    queryKey: ['nominal-lines', poId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nominal_lines')
        .select('*')
        .eq('purchase_order_id', poId)
        .order('line_number');
      if (error) throw error;
      return data as NominalLine[];
    },
    enabled: !!poId,
  });
}

export function useVatLines(poId: string) {
  return useQuery({
    queryKey: ['vat-lines', poId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vat_lines')
        .select('*')
        .eq('purchase_order_id', poId)
        .order('line_number');
      if (error) throw error;
      return data as VatLine[];
    },
    enabled: !!poId,
  });
}

export function useOcrExtraction(poId: string) {
  return useQuery({
    queryKey: ['ocr', poId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ocr_extractions')
        .select('*')
        .eq('purchase_order_id', poId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as OcrExtraction | null;
    },
    enabled: !!poId,
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<PurchaseOrder>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('purchase_orders')
        .update({ ...updates, updated_by_id: user?.id })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['invoice', vars.id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useUpsertNominalLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (line: Partial<NominalLine> & { purchase_order_id: string; line_number: 1 | 2 }) => {
      const { data, error } = await supabase
        .from('nominal_lines')
        .upsert(line, { onConflict: 'purchase_order_id,line_number' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['nominal-lines', data.purchase_order_id] });
    },
  });
}

export function useUpsertVatLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (line: Partial<VatLine> & { purchase_order_id: string; line_number: 1 | 2 }) => {
      const { data, error } = await supabase
        .from('vat_lines')
        .upsert(line, { onConflict: 'purchase_order_id,line_number' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['vat-lines', data.purchase_order_id] });
    },
  });
}
