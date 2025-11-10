-- Add interactive_color column to store_theme_colors table
-- This column stores the color used for interactive elements like buttons and icons

ALTER TABLE store_theme_colors
ADD COLUMN IF NOT EXISTS interactive_color TEXT DEFAULT '#EF4444';

-- Update existing rows to have the default interactive color
UPDATE store_theme_colors
SET interactive_color = '#EF4444'
WHERE interactive_color IS NULL;

-- Add comment to describe the column
COMMENT ON COLUMN store_theme_colors.interactive_color IS 'Color used for interactive elements (buttons, icons, hover states)';
