-- Hindi sides for the flashcard decks.
--
-- Cards live in public.flashcards (supabase/migrations/006_flashcards.sql) and
-- are served by /api/flashcards. Hindi is a view of the same rows: the id,
-- topic, type and status never change, and lib/flashcardStore.ts falls back to
-- the English side when a Hindi one is null, so a partly translated deck still
-- works.
--
-- Safe to re-run.

alter table public.flashcards
  add column if not exists front_hi text,
  add column if not exists back_hi  text;
