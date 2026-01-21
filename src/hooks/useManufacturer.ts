import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Manufacturer {
  id: string;
  user_id: string;
  legal_name: string;
  registered_brand: string;
  brand_logo_url: string;
  verified: boolean;
}

export function useCurrentManufacturer() {
  return useQuery({
    queryKey: ['current-manufacturer'],
    queryFn: async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return null;

      const { data, error } = await supabase
        .from('manufacturers')
        .select('id, user_id, legal_name, registered_brand, brand_logo_url, verified')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as Manufacturer | null;
    },
  });
}
