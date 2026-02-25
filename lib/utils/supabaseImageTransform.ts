/**
 * Supabase Image Transform Utility
 * Converts Supabase storage URLs to use Image Transforms (Pro Plan feature)
 * This serves resized/WebP images server-side, dramatically reducing image size
 */

export type ImagePreset = 'card_desktop' | 'card_tablet' | 'card_mobile' | 'search_thumb';

interface TransformOptions {
  width: number;
  quality?: number;
}

const PRESETS: Record<ImagePreset, TransformOptions> = {
  card_desktop: { width: 400, quality: 75 },
  card_tablet: { width: 350, quality: 75 },
  card_mobile: { width: 250, quality: 70 },
  search_thumb: { width: 128, quality: 70 },
};

/**
 * Convert a Supabase storage URL to use Image Transforms
 *
 * Transforms:
 *   .../storage/v1/object/public/bucket/image.jpg
 * To:
 *   .../storage/v1/render/image/public/bucket/image.jpg?width=400&quality=75
 *
 * Non-Supabase URLs are returned as-is.
 */
export function getTransformedImageUrl(
  src: string | null | undefined,
  presetOrOptions: ImagePreset | TransformOptions
): string {
  if (!src) return '/placeholder-product.svg';

  // Only transform Supabase storage URLs
  if (!src.includes('supabase.co') || !src.includes('/storage/v1/object/public/')) {
    return src;
  }

  const options = typeof presetOrOptions === 'string'
    ? PRESETS[presetOrOptions]
    : presetOrOptions;

  const { width, quality = 75 } = options;

  // Replace /object/public/ with /render/image/public/
  const transformedUrl = src.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );

  // Add transform query parameters
  const separator = transformedUrl.includes('?') ? '&' : '?';
  return `${transformedUrl}${separator}width=${width}&quality=${quality}&resize=contain`;
}

/**
 * Get the appropriate image preset for a device type
 */
export function getPresetForDevice(deviceType: 'desktop' | 'tablet' | 'mobile'): ImagePreset {
  switch (deviceType) {
    case 'desktop': return 'card_desktop';
    case 'tablet': return 'card_tablet';
    case 'mobile': return 'card_mobile';
  }
}

/**
 * Generate an array of transformed URLs for background preloading
 */
export function getTransformedUrls(
  images: (string | null | undefined)[],
  presetOrOptions: ImagePreset | TransformOptions
): string[] {
  return images
    .filter((img): img is string => !!img)
    .map(img => getTransformedImageUrl(img, presetOrOptions));
}
