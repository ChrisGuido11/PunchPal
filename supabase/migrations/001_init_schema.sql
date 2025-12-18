-- Create user_stats table
CREATE TABLE IF NOT EXISTS user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  total_workouts INTEGER DEFAULT 0,
  total_minutes INTEGER DEFAULT 0,
  current_level TEXT NOT NULL DEFAULT 'beginner',
  next_level_progress FLOAT DEFAULT 0,
  combos_learned INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  avg_accuracy FLOAT DEFAULT 0,
  last_workout_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workout_sessions table
CREATE TABLE IF NOT EXISTS workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  workout_name TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  duration INTEGER NOT NULL,
  rounds INTEGER NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER,
  combos_attempted INTEGER,
  combos_completed INTEGER,
  accuracy FLOAT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES user_stats(user_id) ON DELETE CASCADE
);

-- Create combo_progress table
CREATE TABLE IF NOT EXISTS combo_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  combo_notation TEXT NOT NULL,
  combo_name TEXT NOT NULL,
  times_attempted INTEGER DEFAULT 0,
  times_completed INTEGER DEFAULT 0,
  best_accuracy FLOAT DEFAULT 0,
  last_attempt_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES user_stats(user_id) ON DELETE CASCADE,
  UNIQUE(user_id, combo_notation)
);

-- Create indexes for faster queries
CREATE INDEX idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX idx_workout_sessions_user_id ON workout_sessions(user_id);
CREATE INDEX idx_workout_sessions_completed_at ON workout_sessions(completed_at DESC);
CREATE INDEX idx_combo_progress_user_id ON combo_progress(user_id);
CREATE INDEX idx_combo_progress_best_accuracy ON combo_progress(best_accuracy DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_progress ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for anonymous users (based on user_id match)
CREATE POLICY "Users can view their own stats" ON user_stats
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert their own stats" ON user_stats
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update their own stats" ON user_stats
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can view their own sessions" ON workout_sessions
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert their own sessions" ON workout_sessions
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can view their own combo progress" ON combo_progress
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert their own combo progress" ON combo_progress
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update their own combo progress" ON combo_progress
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', true));
