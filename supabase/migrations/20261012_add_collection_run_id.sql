-- ─── Supabase Migration: Add Collection Run ID Support & Public Read ───────
-- Adds collection_run_id to all four dataset sources tables so that
-- dataset records collected during a specific agent execution can be
-- uniquely and reliably associated with that collection run.

-- 1. dataset_sources (Kaggle)
ALTER TABLE IF EXISTS public.dataset_sources 
ADD COLUMN IF NOT EXISTS collection_run_id TEXT;

CREATE INDEX IF NOT EXISTS idx_dataset_sources_collection_run_id 
ON public.dataset_sources(collection_run_id);

ALTER TABLE IF EXISTS public.dataset_sources ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dataset_sources' AND policyname = 'Allow public read access'
  ) THEN
    CREATE POLICY "Allow public read access" ON public.dataset_sources FOR SELECT USING (true);
  END IF;
END $$;

-- 2. dataset_sources_huggingface
ALTER TABLE IF EXISTS public.dataset_sources_huggingface 
ADD COLUMN IF NOT EXISTS collection_run_id TEXT;

CREATE INDEX IF NOT EXISTS idx_dataset_sources_hf_collection_run_id 
ON public.dataset_sources_huggingface(collection_run_id);

ALTER TABLE IF EXISTS public.dataset_sources_huggingface ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dataset_sources_huggingface' AND policyname = 'Allow public read access'
  ) THEN
    CREATE POLICY "Allow public read access" ON public.dataset_sources_huggingface FOR SELECT USING (true);
  END IF;
END $$;

-- 3. github_dataset_sources
ALTER TABLE IF EXISTS public.github_dataset_sources 
ADD COLUMN IF NOT EXISTS collection_run_id TEXT;

CREATE INDEX IF NOT EXISTS idx_github_dataset_sources_collection_run_id 
ON public.github_dataset_sources(collection_run_id);

ALTER TABLE IF EXISTS public.github_dataset_sources ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'github_dataset_sources' AND policyname = 'Allow public read access'
  ) THEN
    CREATE POLICY "Allow public read access" ON public.github_dataset_sources FOR SELECT USING (true);
  END IF;
END $$;

-- 4. zenodo_dataset_sources
ALTER TABLE IF EXISTS public.zenodo_dataset_sources 
ADD COLUMN IF NOT EXISTS collection_run_id TEXT;

CREATE INDEX IF NOT EXISTS idx_zenodo_dataset_sources_collection_run_id 
ON public.zenodo_dataset_sources(collection_run_id);

ALTER TABLE IF EXISTS public.zenodo_dataset_sources ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'zenodo_dataset_sources' AND policyname = 'Allow public read access'
  ) THEN
    CREATE POLICY "Allow public read access" ON public.zenodo_dataset_sources FOR SELECT USING (true);
  END IF;
END $$;

-- 5. data_generation_messages
ALTER TABLE IF EXISTS public.data_generation_messages 
ADD COLUMN IF NOT EXISTS collection_run_id TEXT;

CREATE INDEX IF NOT EXISTS idx_data_gen_msgs_run_id 
ON public.data_generation_messages(collection_run_id);

ALTER TABLE IF EXISTS public.data_generation_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'data_generation_messages' AND policyname = 'Allow public read access'
  ) THEN
    CREATE POLICY "Allow public read access" ON public.data_generation_messages FOR SELECT USING (true);
  END IF;
END $$;
