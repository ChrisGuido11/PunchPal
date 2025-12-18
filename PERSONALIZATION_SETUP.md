# Boxing Experience Level Personalization with Grok AI

## Overview
The app now uses Supabase to store and track your boxing experience level and workout history, enabling Grok AI to generate highly personalized workouts tailored to your skills, progress, and performance.

## What Was Added

### 1. Supabase Integration for User Stats Tracking
- **OnboardingScreen**: When you select your boxing level, it's saved to Supabase with initial stats (0 workouts, 0 minutes, etc.)
- **HomeScreen**: Before generating each workout, your current stats are synced to Supabase:
  - Total workouts completed
  - Total training minutes
  - Current boxing level
  - Progress toward next level (%)
  - Number of unique combos mastered
  - Current and longest training streaks
  - Average accuracy
  - Last workout date

### 2. Enhanced Grok AI Personalization
The workout generator now:
- Fetches your latest stats from Supabase
- Sends personalized data to Grok AI including:
  - Your total training sessions and time
  - Your progress toward the next level
  - How many combos you've mastered
  - Your training streak and accuracy
  - When you last worked out

### 3. AI Personalization Logic
Grok AI uses your stats to:
1. **Adjust combo complexity** - More combos mastered = more challenging variations
2. **Match accuracy** - High accuracy = more challenge; low accuracy = focus on fundamentals
3. **Reward consistency** - Longer streaks = more variety and advanced techniques
4. **Track progression** - If you're close to leveling up (>80%), introduces harder combinations
5. **Consider recency** - Adjusts difficulty based on when you last trained

### 4. Profile Screen Updates
- **Boxing level changes now sync to Supabase** - When you change your level in Profile, all your stats are updated
- Stats calculation ensures AI always has your latest performance data

## How It Works

### Flow:
1. **Onboarding**: Select boxing level → Saves to Supabase with initial stats
2. **Generate Workout**: 
   - HomeScreen syncs your latest stats to Supabase
   - Workout generator fetches your stats from Supabase
   - Grok AI receives personalized context
   - AI generates workout tailored to your experience
3. **Change Level**: Update in Profile → Syncs to Supabase with recalculated progress

### Data Synced to Supabase:
```typescript
{
  userId: string,
  totalWorkouts: number,        // How many workouts you've completed
  totalMinutes: number,          // Total training time
  currentLevel: BoxingLevel,     // beginner | intermediate | advanced
  nextLevelProgress: number,     // 0-100% progress to next level
  combosLearned: number,         // Unique combos you've completed
  currentStreak: number,         // Current consecutive workout days
  longestStreak: number,         // Your best streak ever
  avgAccuracy: number,           // 0-100% average performance
  lastWorkoutDate: string        // ISO date of last workout
}
```

## Level Progression Thresholds
- **Beginner → Intermediate**: 20 workouts = 100% progress
- **Intermediate → Advanced**: 50 workouts = 100% progress
- **Advanced**: 100 workouts = 100% mastery

## Example AI Personalization

If you have:
- 15 workouts completed
- 85% average accuracy
- 5 day streak
- 12 combos mastered

Grok AI will:
- Generate combos slightly harder than your level suggests
- Include variety to reward your consistency
- Build on the 12 combos you've already mastered
- Consider you're getting close to leveling up

## Requirements

### Make sure you've run the SQL migration:
1. Go to your Supabase dashboard: https://mftzjqaelevpfsvvpoyc.supabase.co
2. Navigate to SQL Editor
3. Run the migration file: `supabase/migrations/001_init_schema.sql`
4. This creates the `user_stats` table needed for personalization

## Benefits
✅ Workouts adapt to your actual skill level
✅ AI recognizes your progress and adjusts difficulty
✅ Consistent training is rewarded with variety
✅ Poor performance focuses on fundamentals
✅ Near level-ups introduce preview of next level

## Privacy
- All data is stored in your personal Supabase database
- Row Level Security (RLS) ensures only you can access your stats
- Data is used exclusively for workout personalization
