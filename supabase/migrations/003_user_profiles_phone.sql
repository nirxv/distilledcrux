-- A mobile number on every profile.
--
-- Collected during onboarding, which is now the only way past the picker.
-- Stored in E.164 (a leading '+' and digits) so the value is dialable as
-- written rather than needing a country guessed at read time.
--
-- Deliberately nullable. 68 profiles already exist without one, and a NOT NULL
-- column would have to invent a value for every one of them. Onboarding is
-- what makes it mandatory, and it now stops an existing user without a number
-- as well as a new one.
--
-- Run once in the Supabase SQL editor, or via scripts/db-setup.sh.

alter table public.user_profiles
  add column if not exists phone text;

-- Numbers are how a paying reader gets contacted, so looking one up by number,
-- or finding the profiles still missing one, should not scan the table.
create index if not exists user_profiles_phone_idx
  on public.user_profiles (phone)
  where phone is not null;
