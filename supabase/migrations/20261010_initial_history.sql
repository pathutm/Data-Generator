-- ─── Supabase Migration: Data Generation & Schema History ────────────
-- Project: Data Generation Agent + Schema Generation Agent History

-- 1. Create data_generation_conversations table
CREATE TABLE IF NOT EXISTS public.data_generation_conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for sorting conversations
CREATE INDEX IF NOT EXISTS idx_data_gen_conv_updated_at 
ON public.data_generation_conversations(updated_at DESC);

-- 2. Create data_generation_messages table
CREATE TABLE IF NOT EXISTS public.data_generation_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES public.data_generation_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    request_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for retrieving messages for a conversation
CREATE INDEX IF NOT EXISTS idx_data_gen_msgs_conv_id 
ON public.data_generation_messages(conversation_id, created_at ASC);

-- 3. Create schema_generation_runs table for permanent history
CREATE TABLE IF NOT EXISTS public.schema_generation_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    request_id TEXT,
    schema_name TEXT NOT NULL,
    user_requirement TEXT,
    source_dataset_names JSONB DEFAULT '[]'::jsonb,
    source_table_count INTEGER DEFAULT 0,
    consolidated_entity_count INTEGER DEFAULT 0,
    column_count INTEGER DEFAULT 0,
    relationship_count INTEGER DEFAULT 0,
    schema_json JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for schema run history queries
CREATE INDEX IF NOT EXISTS idx_schema_gen_runs_created_at 
ON public.schema_generation_runs(created_at DESC);

-- 4. Enable Row Level Security (RLS) policies
ALTER TABLE public.data_generation_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_generation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schema_generation_runs ENABLE ROW LEVEL SECURITY;

-- 5. Safe policies for anon/authenticated roles
-- Allows read, insert, update, and delete for the public anon key while keeping data operations controlled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'data_generation_conversations' AND policyname = 'Allow public access to conversations'
    ) THEN
        CREATE POLICY "Allow public access to conversations" 
        ON public.data_generation_conversations 
        FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'data_generation_messages' AND policyname = 'Allow public access to messages'
    ) THEN
        CREATE POLICY "Allow public access to messages" 
        ON public.data_generation_messages 
        FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'schema_generation_runs' AND policyname = 'Allow public access to schema runs'
    ) THEN
        CREATE POLICY "Allow public access to schema runs" 
        ON public.schema_generation_runs 
        FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
