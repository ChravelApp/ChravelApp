-- Historical trip chat messages (source for GetStream migration)
-- After running scripts/migrate-chat-to-stream.ts this table becomes read-only legacy.
-- The frontend reads exclusively from GetStream going forward.

CREATE TABLE IF NOT EXISTS trip_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  sender_name TEXT,
  sender_avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trip_chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can read messages for trips they belong to
CREATE POLICY "Users can view trip chat messages"
ON trip_chat_messages FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own messages
CREATE POLICY "Users can insert their own chat messages"
ON trip_chat_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Index for efficient per-trip queries
CREATE INDEX IF NOT EXISTS trip_chat_messages_trip_id_idx
  ON trip_chat_messages (trip_id, created_at ASC);
