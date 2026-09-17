import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Inicializa Supabase solo si existen las credenciales reales
export const supabase = supabaseUrl && supabaseUrl.startsWith('http')
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
