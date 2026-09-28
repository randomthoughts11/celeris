-- 013: Drop — end-to-end encrypted file + note sharing.
-- The server only ever stores ciphertext; the decryption key lives in the
-- link's #fragment and never reaches the server.

CREATE TABLE IF NOT EXISTS drops (
  id TEXT PRIMARY KEY,
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  salt TEXT NOT NULL,
  auth_hash TEXT NOT NULL,
  has_password BOOLEAN NOT NULL DEFAULT false,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  max_downloads INTEGER NOT NULL DEFAULT 1,
  download_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drops_creator ON drops(created_by);
CREATE INDEX IF NOT EXISTS idx_drops_expires ON drops(expires_at);
