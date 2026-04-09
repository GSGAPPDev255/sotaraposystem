import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useCsvExports() {
  return useQuery({
    queryKey: ['csv-exports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('csv_exports')
        .select(`*, generated_by:generated_by_id (email, display_name)`)
        .order('generated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useGenerateCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (purchaseOrderIds: string[]) => {
      const { data, error } = await supabase.functions.invoke('generate-csv', {
        body: { purchase_order_ids: purchaseOrderIds },
      });
      if (error) throw error;
      return data as { success: boolean; export_id: string; record_count: number; download_url: string; storage_path: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['csv-exports'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useExportDownloadUrl(storagePath: string | null) {
  return useQuery({
    queryKey: ['export-url', storagePath],
    queryFn: async () => {
      if (!storagePath) return null;
      const { data, error } = await supabase.storage
        .from('csv-exports')
        .createSignedUrl(storagePath, 3600);
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
    enabled: !!storagePath,
    staleTime: 30 * 60 * 1000,
  });
}
