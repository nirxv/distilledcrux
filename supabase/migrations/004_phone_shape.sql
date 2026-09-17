-- Only an Indian mobile can be stored in user_profiles.phone.
--
-- The application validates this, but +90800888 reached the column anyway:
-- eight digits behind a Turkish country code, accepted by a generic
-- international fallback the form never needed. The application rule is fixed;
-- this is the second line, so a future route, a script or a hand edit in the
-- dashboard cannot put a non-number back.
--
-- NOT VALID skips the check against existing rows. Every row present passes,
-- but that is a fact about today rather than a promise, and validating
-- separately means the ALTER cannot fail on data written between writing this
-- and running it. The VALIDATE below takes only a ShareUpdateExclusive lock,
-- so it does not block writes.
--
-- Run once, via scripts/db-setup.sh.

alter table public.user_profiles
  drop constraint if exists user_profiles_phone_indian_mobile;

alter table public.user_profiles
  add constraint user_profiles_phone_indian_mobile
  check (phone is null or phone ~ '^\+91[6-9][0-9]{9}$')
  not valid;

alter table public.user_profiles
  validate constraint user_profiles_phone_indian_mobile;
