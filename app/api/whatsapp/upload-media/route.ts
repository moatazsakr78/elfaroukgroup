import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/3gpp', 'video/quicktime', 'video/webm'];
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'application/x-rar-compressed',
];

// Max file sizes (in bytes)
const MAX_IMAGE_SIZE = 16 * 1024 * 1024; // 16MB
const MAX_VIDEO_SIZE = 16 * 1024 * 1024; // 16MB
const MAX_DOCUMENT_SIZE = 100 * 1024 * 1024; // 100MB

function getFileExtension(mimeType: string, originalName: string): string {
  // Try to get from original filename first
  const extFromName = originalName.split('.').pop()?.toLowerCase();
  if (extFromName) return extFromName;

  // Fallback to MIME type mapping
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'application/zip': 'zip',
    'application/x-rar-compressed': 'rar',
  };

  return mimeToExt[mimeType] || 'bin';
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const mediaType = formData.get('mediaType') as string; // 'image' | 'video' | 'document'

    if (!file) {
      return NextResponse.json(
        { error: 'الملف مطلوب' },
        { status: 400 }
      );
    }

    if (!mediaType || !['image', 'video', 'document'].includes(mediaType)) {
      return NextResponse.json(
        { error: 'نوع الملف غير صالح' },
        { status: 400 }
      );
    }

    // Validate file type and size
    let allowedTypes: string[];
    let maxSize: number;
    let folder: string;

    switch (mediaType) {
      case 'image':
        allowedTypes = ALLOWED_IMAGE_TYPES;
        maxSize = MAX_IMAGE_SIZE;
        folder = 'images';
        break;
      case 'video':
        allowedTypes = ALLOWED_VIDEO_TYPES;
        maxSize = MAX_VIDEO_SIZE;
        folder = 'videos';
        break;
      case 'document':
        allowedTypes = ALLOWED_DOCUMENT_TYPES;
        maxSize = MAX_DOCUMENT_SIZE;
        folder = 'documents';
        break;
      default:
        return NextResponse.json(
          { error: 'نوع الملف غير مدعوم' },
          { status: 400 }
        );
    }

    // Check file type (allow all for documents if type is unknown)
    if (mediaType !== 'document' && !allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `نوع الملف غير مدعوم. الأنواع المسموحة: ${allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      return NextResponse.json(
        { error: `حجم الملف كبير جداً. الحد الأقصى: ${maxSizeMB}MB` },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate filename
    const timestamp = Date.now();
    const extension = getFileExtension(file.type, file.name);
    const sanitizedOriginalName = file.name.replace(/[^a-zA-Z0-9\u0600-\u06FF._-]/g, '_');
    const filePath = `${folder}/outgoing_${timestamp}_${sanitizedOriginalName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('whatsapp')
      .upload(filePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'فشل في رفع الملف' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('whatsapp')
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      filename: file.name,
      mimeType: file.type,
      size: file.size
    });

  } catch (error) {
    console.error('Media upload error:', error);
    return NextResponse.json(
      { error: 'فشل في رفع الملف' },
      { status: 500 }
    );
  }
}
