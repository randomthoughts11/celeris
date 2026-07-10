-- Employee clock in/out with optional GPS coordinates

CREATE TABLE IF NOT EXISTS work_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  clock_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out_at TIMESTAMPTZ,
  clock_in_latitude DECIMAL(10, 7),
  clock_in_longitude DECIMAL(10, 7),
  clock_in_accuracy_m DECIMAL(10, 2),
  clock_out_latitude DECIMAL(10, 7),
  clock_out_longitude DECIMAL(10, 7),
  clock_out_accuracy_m DECIMAL(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_shifts_user ON work_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_work_shifts_clock_in ON work_shifts(clock_in_at DESC);

-- One open shift per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_shifts_one_open
  ON work_shifts(user_id)
  WHERE clock_out_at IS NULL;
