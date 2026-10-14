-- ─── Safe Row Level Security Read Policies ──────────────────────────
-- Allows the web application (anon role) to read collected dataset records
-- while keeping Row Level Security actively enabled (protecting inserts/updates/deletes).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dataset_sources' AND policyname = 'Allow anon read'
  ) THEN
    CREATE POLICY "Allow anon read" ON public.dataset_sources FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dataset_sources_huggingface' AND policyname = 'Allow anon read'
  ) THEN
    CREATE POLICY "Allow anon read" ON public.dataset_sources_huggingface FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'github_dataset_sources' AND policyname = 'Allow anon read'
  ) THEN
    CREATE POLICY "Allow anon read" ON public.github_dataset_sources FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'zenodo_dataset_sources' AND policyname = 'Allow anon read'
  ) THEN
    CREATE POLICY "Allow anon read" ON public.zenodo_dataset_sources FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;
