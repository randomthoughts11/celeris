-- Clerk authentication: link profiles to Clerk users without passwords

ALTER TABLE profiles
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS clerk_user_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_profiles_clerk_user_id ON profiles (clerk_user_id);
