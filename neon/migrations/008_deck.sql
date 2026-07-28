-- 008: Deck-style Kanban (boards, stacks, labels) replacing the static task board.
-- Cards remain rows in the existing `tasks` table so dashboards keep working.

CREATE TABLE IF NOT EXISTS deck_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deck_stacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES deck_boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  -- Keeps tasks.status in sync when cards move, so existing
  -- open/overdue/workload queries stay accurate.
  status_map task_status NOT NULL DEFAULT 'todo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deck_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES deck_boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deck_card_labels (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES deck_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES deck_boards(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS stack_id UUID REFERENCES deck_stacks(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_deck_boards_company ON deck_boards(company_id);
CREATE INDEX IF NOT EXISTS idx_deck_stacks_board ON deck_stacks(board_id);
CREATE INDEX IF NOT EXISTS idx_deck_labels_board ON deck_labels(board_id);
CREATE INDEX IF NOT EXISTS idx_tasks_stack ON tasks(stack_id);
CREATE INDEX IF NOT EXISTS idx_tasks_board ON tasks(board_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);

-- Seed a default board per company and place existing tasks into stacks by status.
DO $$
DECLARE
  comp RECORD;
  b UUID;
  s_backlog UUID;
  s_todo UUID;
  s_progress UUID;
  s_review UUID;
  s_done UUID;
BEGIN
  FOR comp IN SELECT id FROM companies LOOP
    SELECT id INTO b FROM deck_boards WHERE company_id = comp.id LIMIT 1;
    IF b IS NULL THEN
      INSERT INTO deck_boards (company_id, title)
      VALUES (comp.id, 'Main Board')
      RETURNING id INTO b;

      INSERT INTO deck_stacks (board_id, title, position, status_map)
      VALUES (b, 'Backlog', 0, 'backlog') RETURNING id INTO s_backlog;
      INSERT INTO deck_stacks (board_id, title, position, status_map)
      VALUES (b, 'To Do', 1, 'todo') RETURNING id INTO s_todo;
      INSERT INTO deck_stacks (board_id, title, position, status_map)
      VALUES (b, 'In Progress', 2, 'in_progress') RETURNING id INTO s_progress;
      INSERT INTO deck_stacks (board_id, title, position, status_map)
      VALUES (b, 'Review', 3, 'review') RETURNING id INTO s_review;
      INSERT INTO deck_stacks (board_id, title, position, status_map)
      VALUES (b, 'Done', 4, 'done') RETURNING id INTO s_done;

      UPDATE tasks SET
        board_id = b,
        stack_id = CASE status
          WHEN 'backlog' THEN s_backlog
          WHEN 'todo' THEN s_todo
          WHEN 'in_progress' THEN s_progress
          WHEN 'review' THEN s_review
          WHEN 'blocked' THEN s_todo
          ELSE s_done
        END
      WHERE company_id = comp.id AND stack_id IS NULL;
    END IF;
  END LOOP;
END $$;

-- Assign initial positions within each stack.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY stack_id ORDER BY created_at) AS rn
  FROM tasks
  WHERE stack_id IS NOT NULL
)
UPDATE tasks SET position = ranked.rn
FROM ranked
WHERE tasks.id = ranked.id AND tasks.position = 0;
