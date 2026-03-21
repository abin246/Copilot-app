#!/bin/bash
# Setup script for PostgreSQL datastore on Linux/macOS

set -e

echo "🗄️  Setting up PostgreSQL datastore..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Start PostgreSQL container
echo "Starting PostgreSQL container..."
docker compose --profile storage up -d postgres

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until docker exec copilot-postgres pg_isready -U copilot > /dev/null 2>&1; do
    echo "Waiting for database..."
    sleep 2
done

echo "✅ PostgreSQL is ready!"

# Run schema initialization
echo "Initializing database schema..."
docker exec copilot-postgres psql -U copilot -d copilot << 'EOF'
-- Meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id SERIAL PRIMARY KEY,
  session_id UUID UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  duration_seconds INT,
  participant_count INT DEFAULT 1
);

-- Meeting events table
CREATE TABLE IF NOT EXISTS meeting_events (
  id SERIAL PRIMARY KEY,
  meeting_id INT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_text TEXT,
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meetings_session_id ON meetings(session_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_events_meeting_id ON meeting_events(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_events_type ON meeting_events(event_type);
CREATE INDEX IF NOT EXISTS idx_meeting_events_created_at ON meeting_events(created_at DESC);

\echo '✅ Database schema created successfully!'
EOF

echo ""
echo "✅ PostgreSQL datastore setup complete!"
echo ""
echo "Connection details:"
echo "  Host: postgres (Docker) or localhost (Host)"
echo "  Port: 5432"
echo "  Username: copilot"
echo "  Password: copilot"
echo "  Database: copilot"
echo ""
echo "Next steps:"
echo "  1. Run: npm install pg @types/pg"
echo "  2. Start services: docker compose up -d"
echo "  3. Backend will auto-initialize tables on startup"
