import type { Database } from './types/supabase'
import { createServerClient } from '@supabase/ssr'

// Test: does Database["public"] extend GenericSchema?
import type { SupabaseClient } from '@supabase/supabase-js'

// This declaration tests if the type resolves correctly
declare function makeClient(): SupabaseClient<Database>

const supabase = makeClient()

// These should NOT be 'never' if Database["public"] extends GenericSchema:
type SurveysInsert = typeof supabase extends SupabaseClient<infer D, infer SN, infer S> 
  ? S extends { Tables: { surveys: infer T } } 
    ? T extends { Insert: infer I } ? I : 'NO_INSERT'
    : 'NO_SURVEYS'
  : 'NO_CLIENT'

// Check if surveys table is accessible 
declare const test: SurveysInsert
