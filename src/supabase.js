import { createClient } from '@supabase/supabase-js'
import publicConfig from './supabase-config.json'

const url = import.meta.env.VITE_SUPABASE_URL || publicConfig.url
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || publicConfig.publishableKey

export const supabaseConfigured = Boolean(url && key)
export const supabase = supabaseConfigured ? createClient(url, key) : null
