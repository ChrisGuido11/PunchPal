# Supabase Setup Guide for PunchPal

This guide will help you set up Supabase with the necessary database schema for personalized workout generation with Grok AI.

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up or log in
2. Click "New Project"
3. Fill in project details:
   - **Name**: `punchpal` (or your preferred name)
   - **Database Password**: Create a strong password
   - **Region**: Choose the region closest to your users
4. Click "Create new project" and wait for it to initialize (takes 1-2 minutes)

## Step 2: Get Your Credentials

1. Once your project is created, go to **Project Settings** (gear icon)
2. Click on **API** in the left sidebar
3. Copy these values:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public** key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Step 3: Run the Database Schema

1. In Supabase, go to **SQL Editor** (in the left sidebar)
2. Click **New Query**
3. Open the file `/supabase/migrations/001_init_schema.sql` from this project
4. Copy the entire SQL code into the query editor
5. Click **Run** (or press Cmd/Ctrl + Enter)
6. You should see "Success" messages for all the tables and policies

## Step 4: Update Your .env File

Add the following to your `.env` file:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace `your-project-id` and `your-anon-key-here` with the actual values from Step 2.

## Step 5: Verify Tables Were Created

1. In Supabase, go to **Table Editor** (in the left sidebar)
2. You should see three new tables:
   - `user_stats` - User statistics and progress
   - `workout_sessions` - Completed workout logs
   - `combo_progress` - Performance on individual combos

## How It Works

### User Stats
Stores overall user performance metrics used for AI personalization:
- `user_id` - Anonymous user identifier
- `total_workouts` - Number of completed workouts
- `current_level` - Beginner/Intermediate/Advanced
- `avg_accuracy` - Average performance accuracy
- `current_streak` / `longest_streak` - Streak tracking
- `combos_learned` - Number of combos mastered

### Workout Sessions
Logs each completed workout for analytics:
- `user_id` - Links to user
- `workout_name` - Name of the workout
- `accuracy` - Performance score (0-100)
- `combos_completed` - How many combos were successfully executed
- `completed_at` - When the workout was done

### Combo Progress
Tracks performance on individual boxing combos:
- `combo_notation` - Boxing notation (e.g., "1-2-3")
- `times_attempted` - How many times tried
- `best_accuracy` - Best performance on this combo
- `last_attempt_date` - When last attempted

## What Happens Next

Once Supabase is set up:

1. **Personalized Workouts**: Grok AI will analyze your user data to generate custom workouts
2. **Performance Tracking**: The app will automatically log completed workouts
3. **Progression System**: AI will adjust difficulty based on your performance
4. **Combo Analytics**: See which combos you're strongest/weakest at

## Troubleshooting

### "Supabase not enabled" message
- Make sure both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are in your `.env`
- Restart the app after adding credentials
- Check that credentials are correct in Supabase Project Settings

### "Permission denied" errors
- The RLS (Row Level Security) policies are working correctly
- The app is using the anonymous user ID properly
- This is expected behavior - users can only see their own data

### Tables don't appear after running SQL
- Make sure you're in the correct project
- Refresh the Table Editor
- Check for error messages in the SQL editor
- Try running the SQL again

## Next Steps

The app is already configured to use Supabase! Once set up:
- User stats are automatically synced after workouts
- Workout history is logged to the database
- Grok AI uses this data to personalize future workouts
- You can view analytics in the Supabase dashboard

For questions, check the [Supabase documentation](https://supabase.com/docs).
