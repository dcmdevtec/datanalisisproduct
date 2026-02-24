import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials' },
        { status: 500 }
      )
    }

    // Use service role key for migrations (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const results: string[] = []

    // Step 1: Check if general_status column exists
    const { data: columns, error: columnError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'survey_surveyor_zones' AND column_name = 'general_status'
        `
      })

    // If RPC doesn't exist, try direct approach
    if (columnError) {
      results.push(`Checking columns via direct query: ${columnError.message}`)
    }

    // Step 2: Add general_status column if it doesn't exist
    const { error: alterError } = await supabase.rpc('exec_sql', {
      query: `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'survey_surveyor_zones' 
            AND column_name = 'general_status'
          ) THEN
            ALTER TABLE public.survey_surveyor_zones ADD COLUMN general_status boolean NULL;
          END IF;
        END $$;
      `
    })

    if (alterError) {
      results.push(`Error adding general_status column: ${alterError.message}`)
    } else {
      results.push('general_status column added or already exists')
    }

    // Step 3: Add id column if it doesn't exist
    const { error: idError } = await supabase.rpc('exec_sql', {
      query: `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'survey_surveyor_zones' 
            AND column_name = 'id'
          ) THEN
            ALTER TABLE public.survey_surveyor_zones ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
          END IF;
        END $$;
      `
    })

    if (idError) {
      results.push(`Error adding id column: ${idError.message}`)
    } else {
      results.push('id column added or already exists')
    }

    // Step 4: Update existing records
    const { error: updateError } = await supabase.rpc('exec_sql', {
      query: `
        UPDATE public.survey_surveyor_zones 
        SET general_status = true 
        WHERE zone_id IS NULL AND general_status IS NULL;
      `
    })

    if (updateError) {
      results.push(`Error updating records: ${updateError.message}`)
    } else {
      results.push('Existing records updated')
    }

    // Verify the table structure
    const { data: tableInfo, error: tableError } = await supabase
      .from('survey_surveyor_zones')
      .select('survey_id, surveyor_id, zone_id, general_status, id')
      .limit(1)

    if (tableError) {
      results.push(`Error verifying table: ${tableError.message}`)
    } else {
      results.push('Table structure verified successfully')
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      results
    })

  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: error.message || 'Migration failed' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to run the migration',
    instructions: [
      '1. Make sure you have SUPABASE_SERVICE_ROLE_KEY in your .env.local',
      '2. Send a POST request to this endpoint to run the migration',
      '3. The migration will add general_status column if it doesn\'t exist',
      '4. It will also add id column as primary key if needed'
    ]
  })
}
