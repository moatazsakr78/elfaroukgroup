import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
}

// Singleton instance for storage client
let supabaseStorageInstance: SupabaseClient | null = null

// Get singleton storage client instance (for client-side and storage operations)
export const getSupabaseAdmin = (): SupabaseClient => {
  if (!supabaseStorageInstance) {
    supabaseStorageInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true
      }
    })
  }
  return supabaseStorageInstance
}

// Legacy export for backwards compatibility
export const supabaseAdmin = getSupabaseAdmin()

export const uploadCategoryImage = async (file: File): Promise<string> => {
  try {
    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `categories/${fileName}`

    // Upload file to bucket
    const { data, error } = await getSupabaseAdmin().storage
      .from('category-pos-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      throw error
    }

    // Get public URL
    const { data: { publicUrl } } = getSupabaseAdmin().storage
      .from('category-pos-images')
      .getPublicUrl(filePath)

    return publicUrl
  } catch (error) {
    console.error('Error uploading image:', error)
    throw error
  }
}

export const deleteCategoryImage = async (imageUrl: string): Promise<void> => {
  try {
    // Extract file path from URL
    const urlParts = imageUrl.split('/')
    const fileName = urlParts[urlParts.length - 1]
    const filePath = `categories/${fileName}`

    const { error } = await getSupabaseAdmin().storage
      .from('category-pos-images')
      .remove([filePath])

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('Error deleting image:', error)
    throw error
  }
}

// Storage bucket names for products
export const PRODUCT_STORAGE_BUCKETS = {
  MAIN_PRODUCTS: 'main-products-pos-images',
  SUB_PRODUCTS: 'sub-products-pos-images',
  VARIANT_PRODUCTS: 'variant-products-pos-images',
  PRODUCT_VIDEOS: 'product_videos'
} as const

// Upload product image to storage bucket
export const uploadProductImage = async (
  file: File,
  bucket: keyof typeof PRODUCT_STORAGE_BUCKETS,
  path?: string
): Promise<{ data: { path: string } | null; error: Error | null }> => {
  try {
    // ENHANCED: Use versioned filename generation to prevent conflicts
    const fileExt = file.name.split('.').pop() || 'jpg'
    const timestamp = Date.now()
    const uuid = Math.random().toString(36).substring(2, 15)

    // Generate versioned filename: timestamp_uuid.extension
    const fileName = `${timestamp}_${uuid}.${fileExt}`
    const filePath = path ? `${path}/${fileName}` : fileName

    const { data, error } = await getSupabaseAdmin().storage
      .from(PRODUCT_STORAGE_BUCKETS[bucket])
      .upload(filePath, file, {
        cacheControl: '31536000', // 1 year cache (enhanced)
        upsert: false // NEVER overwrite existing files
      })

    if (error) {
      console.error('Storage upload error:', error)
      return { data: null, error }
    }

    return { data, error: null }
  } catch (error) {
    console.error('Upload error:', error)
    return { data: null, error: error as Error }
  }
}

// Get public URL for uploaded product image
export const getProductImageUrl = (bucket: keyof typeof PRODUCT_STORAGE_BUCKETS, path: string): string => {
  const { data } = getSupabaseAdmin().storage
    .from(PRODUCT_STORAGE_BUCKETS[bucket])
    .getPublicUrl(path)

  return data.publicUrl
}

// Delete product image from storage
export const deleteProductImage = async (
  bucket: keyof typeof PRODUCT_STORAGE_BUCKETS,
  path: string
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await getSupabaseAdmin().storage
      .from(PRODUCT_STORAGE_BUCKETS[bucket])
      .remove([path])

    return { error }
  } catch (error) {
    console.error('Delete error:', error)
    return { error: error as Error }
  }
}

// ============== VIDEO UPLOAD FUNCTIONS ==============

// Create the product videos bucket if it doesn't exist (manual operation only)
// NOTE: Buckets are now pre-created in Supabase dashboard, this function is disabled
export const createProductVideosBucket = async (): Promise<{ data: any | null; error: Error | null }> => {
  // Buckets are pre-created, just return success
  console.log('Bucket initialization skipped (buckets are pre-created)')
  return { data: null, error: null }
}

// Upload product video to storage bucket
export const uploadProductVideo = async (
  file: File,
  productId?: string
): Promise<{ data: { path: string; publicUrl: string } | null; error: Error | null }> => {
  try {
    // Validate video file
    const allowedTypes = ['video/mp4', 'video/webm', 'video/mov', 'video/avi', 'video/quicktime']
    if (!allowedTypes.includes(file.type)) {
      return { data: null, error: new Error('نوع الملف غير مدعوم. يرجى رفع ملفات MP4, WebM, MOV, أو AVI فقط') }
    }

    // Check file size (100MB limit)
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      return { data: null, error: new Error('حجم الملف كبير جداً. الحد الأقصى 100 ميجابايت') }
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop() || 'mp4'
    const timestamp = Date.now()
    const uuid = Math.random().toString(36).substring(2, 15)
    const fileName = `${timestamp}_${uuid}.${fileExt}`
    const filePath = productId ? `products/${productId}/${fileName}` : `temp/${fileName}`

    // Upload file to bucket (assume bucket exists)
    const { data, error } = await getSupabaseAdmin().storage
      .from('product_videos')
      .upload(filePath, file, {
        cacheControl: '31536000', // 1 year cache
        upsert: false
      })

    if (error) {
      console.error('Video upload error:', error)
      return { data: null, error }
    }

    // Get public URL
    const { data: { publicUrl } } = getSupabaseAdmin().storage
      .from('product_videos')
      .getPublicUrl(filePath)

    return {
      data: {
        path: filePath,
        publicUrl
      },
      error: null
    }
  } catch (error) {
    console.error('Video upload error:', error)
    return { data: null, error: error as Error }
  }
}

// Delete product video from storage
export const deleteProductVideo = async (videoUrl: string): Promise<{ error: Error | null }> => {
  try {
    // Extract file path from URL
    const urlParts = videoUrl.split('/')
    const bucketIndex = urlParts.findIndex(part => part === 'product_videos')

    if (bucketIndex === -1) {
      return { error: new Error('Invalid video URL') }
    }

    const filePath = urlParts.slice(bucketIndex + 1).join('/')

    const { error } = await getSupabaseAdmin().storage
      .from('product_videos')
      .remove([filePath])

    return { error }
  } catch (error) {
    console.error('Error deleting video:', error)
    return { error: error as Error }
  }
}

// Get public URL for video
export const getProductVideoUrl = (path: string): string => {
  const { data } = getSupabaseAdmin().storage
    .from('product_videos')
    .getPublicUrl(path)

  return data.publicUrl
}

// Generate video thumbnail (basic implementation)
export const generateVideoThumbnail = async (videoFile: File): Promise<string | null> => {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      video.addEventListener('loadedmetadata', () => {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        video.currentTime = 1 // Get frame at 1 second
      })

      video.addEventListener('seeked', () => {
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const thumbnail = canvas.toDataURL('image/jpeg', 0.8)
          resolve(thumbnail)
        } else {
          resolve(null)
        }
      })

      video.src = URL.createObjectURL(videoFile)
    } catch (error) {
      console.error('Error generating thumbnail:', error)
      resolve(null)
    }
  })
}