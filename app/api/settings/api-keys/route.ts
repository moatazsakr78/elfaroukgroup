import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { clearTokenCache } from '@/app/lib/whatsapp';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Get encryption key from environment variable or generate a default one
function getEncryptionKey(): Buffer {
  const key = process.env.API_ENCRYPTION_KEY;
  if (key) {
    // If key is provided, ensure it's 32 bytes (256 bits)
    return Buffer.from(key.padEnd(32, '0').slice(0, 32));
  }
  // Default key (should be set in production!)
  return Buffer.from('elfaroukgroup-api-encryption-key'.slice(0, 32));
}

// Encrypt a value using AES-256-GCM
function encrypt(text: string): { encrypted: string; iv: string; authTag: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

// Decrypt a value using AES-256-GCM
function decrypt(encrypted: string, ivHex: string, authTagHex: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// GET - Check if API key is configured (returns boolean, NOT the key itself)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const keyName = searchParams.get('key');

    if (!keyName) {
      return NextResponse.json({ error: 'Key name is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .schema('elfaroukgroup')
      .from('api_settings')
      .select('setting_key, is_configured, updated_at')
      .eq('setting_key', keyName)
      .single();

    if (error || !data) {
      return NextResponse.json({
        isConfigured: false,
        updatedAt: null
      });
    }

    return NextResponse.json({
      isConfigured: data.is_configured,
      updatedAt: data.updated_at
    });
  } catch (error) {
    console.error('Get API key status error:', error);
    return NextResponse.json({ error: 'Failed to get API key status' }, { status: 500 });
  }
}

// POST - Save encrypted API key
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value, userId } = body;

    if (!key || !value) {
      return NextResponse.json({ error: 'Key name and value are required' }, { status: 400 });
    }

    // Encrypt the value
    const { encrypted, iv, authTag } = encrypt(value);

    // Check if key already exists
    const { data: existing } = await supabase
      .schema('elfaroukgroup')
      .from('api_settings')
      .select('id')
      .eq('setting_key', key)
      .single();

    if (existing) {
      // Update existing key
      const { error } = await supabase
        .schema('elfaroukgroup')
        .from('api_settings')
        .update({
          encrypted_value: encrypted,
          iv: iv,
          auth_tag: authTag,
          is_configured: true,
          updated_at: new Date().toISOString(),
          updated_by: userId || null
        })
        .eq('setting_key', key);

      if (error) throw error;
    } else {
      // Insert new key
      const { error } = await supabase
        .schema('elfaroukgroup')
        .from('api_settings')
        .insert({
          setting_key: key,
          encrypted_value: encrypted,
          iv: iv,
          auth_tag: authTag,
          is_configured: true,
          updated_by: userId || null
        });

      if (error) throw error;
    }

    // Clear the token cache so the new token is used immediately
    if (key === 'wasender_api_token') {
      clearTokenCache();
    }

    return NextResponse.json({
      success: true,
      message: 'API key saved successfully'
    });
  } catch (error) {
    console.error('Save API key error:', error);
    return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 });
  }
}

// DELETE - Remove API key
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const keyName = searchParams.get('key');

    if (!keyName) {
      return NextResponse.json({ error: 'Key name is required' }, { status: 400 });
    }

    const { error } = await supabase
      .schema('elfaroukgroup')
      .from('api_settings')
      .delete()
      .eq('setting_key', keyName);

    if (error) throw error;

    // Clear the token cache
    if (keyName === 'wasender_api_token') {
      clearTokenCache();
    }

    return NextResponse.json({
      success: true,
      message: 'API key removed successfully'
    });
  } catch (error) {
    console.error('Delete API key error:', error);
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
  }
}
