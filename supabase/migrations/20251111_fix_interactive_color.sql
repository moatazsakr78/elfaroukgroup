-- Fix: Add interactive_color column if missing
-- This migration is idempotent and can be run multiple times safely

DO $$
BEGIN
  -- Add interactive_color column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_theme_colors'
    AND column_name = 'interactive_color'
  ) THEN
    ALTER TABLE store_theme_colors
    ADD COLUMN interactive_color TEXT DEFAULT '#EF4444';

    RAISE NOTICE 'Added interactive_color column';
  ELSE
    RAISE NOTICE 'interactive_color column already exists';
  END IF;
END $$;

-- Update existing rows to have the default interactive color if NULL
UPDATE store_theme_colors
SET interactive_color = '#EF4444'
WHERE interactive_color IS NULL;

-- Add comment to describe the column (safe to run multiple times)
COMMENT ON COLUMN store_theme_colors.interactive_color IS 'Color used for interactive elements (buttons, icons, hover states)';
