-- Meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id SERIAL PRIMARY KEY,
  session_id UUID UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  duration_seconds INT,
  participant_count INT DEFAULT 1
);

-- Meeting events table (stores transcript, AI response, errors, etc.)
CREATE TABLE IF NOT EXISTS meeting_events (
  id SERIAL PRIMARY KEY,
  meeting_id INT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_text TEXT,
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_meetings_session_id ON meetings(session_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_events_meeting_id ON meeting_events(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_events_type ON meeting_events(event_type);
CREATE INDEX IF NOT EXISTS idx_meeting_events_created_at ON meeting_events(created_at DESC);
