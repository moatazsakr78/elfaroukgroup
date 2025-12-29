// WasenderAPI Utility Functions
// Documentation: https://wasenderapi.com/api-docs

import { getApiKey } from './api-keys';
import { createClient } from '@supabase/supabase-js';

// Supabase client for media storage
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WASENDER_API_URL = 'https://www.wasenderapi.com/api';

// Cache the token to avoid repeated database calls
let cachedToken: string | null = null;
let tokenCacheTime: number = 0;
const TOKEN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ============ Types ============

export interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IncomingMessage {
  messageId: string;
  from: string;
  customerName: string;
  text: string;
  timestamp: Date;
  mediaType?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact';
  mediaUrl?: string;
}

interface WasenderTextPayload {
  to: string;
  text: string;
}

interface WasenderImagePayload {
  to: string;
  imageUrl: string;
  caption?: string;
}

interface WasenderVideoPayload {
  to: string;
  videoUrl: string;
  caption?: string;
}

interface WasenderDocumentPayload {
  to: string;
  documentUrl: string;
  filename?: string;
  caption?: string;
}

interface WasenderAudioPayload {
  to: string;
  audioUrl: string;
}

interface WasenderLocationPayload {
  to: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

interface WasenderContactPayload {
  to: string;
  contact: {
    name: string;
    phone: string;
  };
}

interface WasenderPollPayload {
  to: string;
  poll: {
    name: string;
    options: string[];
    selectableOptionsCount?: number;
  };
}

// ============ Helper Functions ============

async function getApiToken(): Promise<string | null> {
  // Check cache first
  if (cachedToken && Date.now() - tokenCacheTime < TOKEN_CACHE_DURATION) {
    return cachedToken;
  }

  try {
    // Try to get from database first
    const dbToken = await getApiKey('wasender_api_token');
    if (dbToken) {
      cachedToken = dbToken;
      tokenCacheTime = Date.now();
      return dbToken;
    }
  } catch (error) {
    console.error('Error fetching token from database:', error);
  }

  // Fallback to environment variable
  const envToken = process.env.WASENDER_API_TOKEN || null;
  if (envToken) {
    cachedToken = envToken;
    tokenCacheTime = Date.now();
  }

  return envToken;
}

// Clear the token cache (useful when token is updated)
export function clearTokenCache(): void {
  cachedToken = null;
  tokenCacheTime = 0;
}

function getSessionId(): string | null {
  return process.env.WASENDER_SESSION_ID || null;
}

async function makeApiRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST',
  body?: any
): Promise<any> {
  const token = await getApiToken();

  if (!token) {
    throw new Error('WasenderAPI Token غير مُعد. الرجاء إضافته من الإعدادات > الأمان');
  }

  const headers: HeadersInit = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const sessionId = getSessionId();
  if (sessionId) {
    headers['X-Session-Id'] = sessionId;
  }

  const response = await fetch(`${WASENDER_API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || `API Error: ${response.status}`);
  }

  return data;
}

// Clean phone number (remove spaces, dashes, etc.)
export function cleanPhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Ensure it starts with country code
  if (cleaned.startsWith('0')) {
    // Egyptian number - add country code
    cleaned = '20' + cleaned.substring(1);
  }

  // Remove leading + if present
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  return cleaned;
}

// ============ Send Message Functions ============

// Send a text message (with optional quoted message for replies)
export async function sendWhatsAppMessage(
  to: string,
  message: string,
  quotedMessageId?: string
): Promise<SendMessageResponse> {
  try {
    const cleanNumber = cleanPhoneNumber(to);

    const payload: any = {
      to: cleanNumber,
      text: message,
    };

    // Add replyTo if replying to a message (WasenderAPI uses replyTo)
    if (quotedMessageId) {
      payload.replyTo = quotedMessageId;
    }

    const data = await makeApiRequest('/send-message', 'POST', payload);

    return {
      success: true,
      messageId: data.messageId || data.id,
    };
  } catch (error) {
    console.error('WhatsApp Send Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Send an image message
export async function sendImageMessage(
  to: string,
  imageUrl: string,
  caption?: string
): Promise<SendMessageResponse> {
  try {
    const cleanNumber = cleanPhoneNumber(to);

    const payload: WasenderImagePayload = {
      to: cleanNumber,
      imageUrl,
      caption,
    };

    const data = await makeApiRequest('/send-message', 'POST', payload);

    return {
      success: true,
      messageId: data.messageId || data.id,
    };
  } catch (error) {
    console.error('WhatsApp Send Image Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Send a video message
export async function sendVideoMessage(
  to: string,
  videoUrl: string,
  caption?: string
): Promise<SendMessageResponse> {
  try {
    const cleanNumber = cleanPhoneNumber(to);

    const payload: WasenderVideoPayload = {
      to: cleanNumber,
      videoUrl,
      caption,
    };

    const data = await makeApiRequest('/send-message', 'POST', payload);

    return {
      success: true,
      messageId: data.messageId || data.id,
    };
  } catch (error) {
    console.error('WhatsApp Send Video Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Send a document message
export async function sendDocumentMessage(
  to: string,
  documentUrl: string,
  filename?: string,
  caption?: string
): Promise<SendMessageResponse> {
  try {
    const cleanNumber = cleanPhoneNumber(to);

    const payload: WasenderDocumentPayload = {
      to: cleanNumber,
      documentUrl,
      filename,
      caption,
    };

    const data = await makeApiRequest('/send-message', 'POST', payload);

    return {
      success: true,
      messageId: data.messageId || data.id,
    };
  } catch (error) {
    console.error('WhatsApp Send Document Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Send an audio message
export async function sendAudioMessage(
  to: string,
  audioUrl: string
): Promise<SendMessageResponse> {
  try {
    const cleanNumber = cleanPhoneNumber(to);

    const payload: WasenderAudioPayload = {
      to: cleanNumber,
      audioUrl,
    };

    const data = await makeApiRequest('/send-message', 'POST', payload);

    return {
      success: true,
      messageId: data.messageId || data.id,
    };
  } catch (error) {
    console.error('WhatsApp Send Audio Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Send a location message
export async function sendLocationMessage(
  to: string,
  latitude: number,
  longitude: number,
  name?: string,
  address?: string
): Promise<SendMessageResponse> {
  try {
    const cleanNumber = cleanPhoneNumber(to);

    const payload: WasenderLocationPayload = {
      to: cleanNumber,
      latitude,
      longitude,
      name,
      address,
    };

    const data = await makeApiRequest('/send-message', 'POST', payload);

    return {
      success: true,
      messageId: data.messageId || data.id,
    };
  } catch (error) {
    console.error('WhatsApp Send Location Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Send a contact message
export async function sendContactMessage(
  to: string,
  contactName: string,
  contactPhone: string
): Promise<SendMessageResponse> {
  try {
    const cleanNumber = cleanPhoneNumber(to);

    const payload: WasenderContactPayload = {
      to: cleanNumber,
      contact: {
        name: contactName,
        phone: cleanPhoneNumber(contactPhone),
      },
    };

    const data = await makeApiRequest('/send-message', 'POST', payload);

    return {
      success: true,
      messageId: data.messageId || data.id,
    };
  } catch (error) {
    console.error('WhatsApp Send Contact Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Send a poll message
export async function sendPollMessage(
  to: string,
  question: string,
  options: string[],
  selectableOptionsCount?: number
): Promise<SendMessageResponse> {
  try {
    const cleanNumber = cleanPhoneNumber(to);

    const payload: WasenderPollPayload = {
      to: cleanNumber,
      poll: {
        name: question,
        options,
        selectableOptionsCount: selectableOptionsCount || 1,
      },
    };

    const data = await makeApiRequest('/send-message', 'POST', payload);

    return {
      success: true,
      messageId: data.messageId || data.id,
    };
  } catch (error) {
    console.error('WhatsApp Send Poll Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============ Utility Functions ============

// Check session status
export async function getSessionStatus(): Promise<{
  connected: boolean;
  status: string;
  phoneNumber?: string;
}> {
  try {
    const data = await makeApiRequest('/status', 'GET');

    return {
      connected: data.status === 'connected' || data.connected === true,
      status: data.status || 'unknown',
      phoneNumber: data.phoneNumber || data.phone,
    };
  } catch (error) {
    console.error('Error getting session status:', error);
    return {
      connected: false,
      status: 'error',
    };
  }
}

// Check if a number is on WhatsApp
export async function isOnWhatsApp(phone: string): Promise<boolean> {
  try {
    const cleanNumber = cleanPhoneNumber(phone);
    const data = await makeApiRequest(`/on-whatsapp/${cleanNumber}`, 'GET');

    return data.exists === true || data.onWhatsApp === true;
  } catch (error) {
    console.error('Error checking WhatsApp number:', error);
    return false;
  }
}

// Mark message as read
export async function markMessageAsRead(messageId: string): Promise<boolean> {
  try {
    await makeApiRequest(`/messages/${messageId}/read`, 'POST');
    return true;
  } catch (error) {
    console.error('Error marking message as read:', error);
    return false;
  }
}

// ============ Media Decryption & Storage ============

// Get file extension based on media type
function getFileExtension(mediaType: string, mimeType?: string): string {
  if (mimeType) {
    const ext = mimeType.split('/')[1];
    if (ext) return ext.replace('jpeg', 'jpg').replace('mpeg', 'mp3');
  }

  switch (mediaType) {
    case 'image': return 'jpg';
    case 'video': return 'mp4';
    case 'audio': return 'mp3';
    case 'document': return 'pdf';
    default: return 'bin';
  }
}

// Decrypt media from WasenderAPI and store in Supabase Storage
export async function decryptAndStoreMedia(
  messageData: any,
  messageId: string,
  mediaType: 'image' | 'video' | 'audio' | 'document'
): Promise<string | null> {
  try {
    const token = await getApiToken();
    if (!token) {
      console.error('❌ No API token available for media decryption');
      return null;
    }

    console.log('🔓 Decrypting media for message:', messageId);

    // 1. Call WasenderAPI decrypt endpoint
    const response = await fetch(`${WASENDER_API_URL}/decrypt-media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          messages: messageData
        }
      }),
    });

    const decryptResult = await response.json();
    console.log('🔓 Decrypt result:', JSON.stringify(decryptResult, null, 2));

    const publicUrl = decryptResult.publicUrl || decryptResult.url;
    if (!publicUrl) {
      console.error('❌ No public URL returned from decrypt API');
      return null;
    }

    console.log('📥 Downloading media from:', publicUrl);

    // 2. Download the decrypted media
    const mediaResponse = await fetch(publicUrl);
    if (!mediaResponse.ok) {
      console.error('❌ Failed to download media:', mediaResponse.status);
      return null;
    }

    const mediaBuffer = await mediaResponse.arrayBuffer();
    const contentType = mediaResponse.headers.get('content-type') || '';

    // 3. Determine file extension
    const extension = getFileExtension(mediaType, contentType);
    const filePath = `${mediaType}s/${messageId}.${extension}`;

    console.log('📤 Uploading to Supabase Storage:', filePath);

    // 4. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('whatsapp')
      .upload(filePath, mediaBuffer, {
        contentType: contentType || 'application/octet-stream',
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Failed to upload to storage:', uploadError.message);
      return null;
    }

    // 5. Get public URL
    const { data: urlData } = supabase.storage
      .from('whatsapp')
      .getPublicUrl(filePath);

    console.log('✅ Media stored successfully:', urlData.publicUrl);
    return urlData.publicUrl;

  } catch (error) {
    console.error('❌ Error in decryptAndStoreMedia:', error);
    return null;
  }
}

// Check if message contains media that needs decryption
export function hasMediaContent(messageData: any): boolean {
  const message = messageData.message || {};
  return !!(
    message.imageMessage ||
    message.videoMessage ||
    message.audioMessage ||
    message.documentMessage ||
    message.stickerMessage
  );
}

// Get media type from message data
export function getMediaType(messageData: any): 'image' | 'video' | 'audio' | 'document' | 'text' {
  const message = messageData.message || {};
  if (message.imageMessage || message.stickerMessage) return 'image';
  if (message.videoMessage) return 'video';
  if (message.audioMessage) return 'audio';
  if (message.documentMessage) return 'document';
  return 'text';
}

// ============ Contact Profile Picture Functions ============

export interface WhatsAppContact {
  id: string;
  phone_number: string;
  customer_name: string | null;
  profile_picture_url: string | null;
  last_picture_fetch: string | null;
  created_at: string;
  updated_at: string;
}

// Get or create a contact in the database
export async function getOrCreateContact(
  phoneNumber: string,
  customerName?: string
): Promise<WhatsAppContact | null> {
  try {
    const cleanNumber = cleanPhoneNumber(phoneNumber);

    // Try to get existing contact
    const { data: existing, error: selectError } = await supabase
      .schema('elfaroukgroup')
      .from('whatsapp_contacts')
      .select('*')
      .eq('phone_number', cleanNumber)
      .single();

    if (existing && !selectError) {
      // Update customer name if provided and different
      if (customerName && customerName !== existing.customer_name) {
        const { data: updated } = await supabase
          .schema('elfaroukgroup')
          .from('whatsapp_contacts')
          .update({
            customer_name: customerName,
            updated_at: new Date().toISOString()
          })
          .eq('phone_number', cleanNumber)
          .select()
          .single();
        return updated || existing;
      }
      return existing;
    }

    // Create new contact
    const { data: newContact, error: insertError } = await supabase
      .schema('elfaroukgroup')
      .from('whatsapp_contacts')
      .insert({
        phone_number: cleanNumber,
        customer_name: customerName || null
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error creating contact:', insertError.message);
      return null;
    }

    return newContact;
  } catch (error) {
    console.error('❌ Error in getOrCreateContact:', error);
    return null;
  }
}

// Check if profile picture needs refresh (older than 24 hours or never fetched)
export function shouldRefreshProfilePicture(contact: WhatsAppContact | null): boolean {
  if (!contact) return true;
  if (!contact.last_picture_fetch) return true;

  const lastFetch = new Date(contact.last_picture_fetch);
  const now = new Date();
  const hoursDiff = (now.getTime() - lastFetch.getTime()) / (1000 * 60 * 60);

  return hoursDiff > 24;
}

// Fetch profile picture from WasenderAPI and store in Supabase Storage
export async function fetchAndStoreProfilePicture(phoneNumber: string): Promise<string | null> {
  try {
    const token = await getApiToken();
    if (!token) {
      console.error('❌ No API token available for profile picture fetch');
      return null;
    }

    const cleanNumber = cleanPhoneNumber(phoneNumber);
    console.log('📷 Fetching profile picture for:', cleanNumber);

    // 1. Call WasenderAPI to get profile picture URL
    const response = await fetch(`${WASENDER_API_URL}/contacts/${cleanNumber}/picture`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.log('⚠️ Profile picture not available for:', cleanNumber);
      return null;
    }

    const data = await response.json();
    if (!data.success || !data.data?.imgUrl) {
      console.log('⚠️ No profile picture URL in response');
      return null;
    }

    console.log('📥 Downloading profile picture from:', data.data.imgUrl);

    // 2. Download the image
    const imageResponse = await fetch(data.data.imgUrl);
    if (!imageResponse.ok) {
      console.error('❌ Failed to download profile picture:', imageResponse.status);
      return null;
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // 3. Upload to Supabase Storage
    const filePath = `profiles/${cleanNumber}.jpg`;
    console.log('📤 Uploading profile picture to:', filePath);

    const { error: uploadError } = await supabase.storage
      .from('whatsapp')
      .upload(filePath, imageBuffer, {
        contentType,
        upsert: true // Overwrite if exists
      });

    if (uploadError) {
      console.error('❌ Failed to upload profile picture:', uploadError.message);
      return null;
    }

    // 4. Get public URL
    const { data: urlData } = supabase.storage
      .from('whatsapp')
      .getPublicUrl(filePath);

    console.log('✅ Profile picture stored:', urlData.publicUrl);
    return urlData.publicUrl;

  } catch (error) {
    console.error('❌ Error in fetchAndStoreProfilePicture:', error);
    return null;
  }
}

// Update contact's profile picture URL in database
export async function updateContactProfilePicture(
  phoneNumber: string,
  pictureUrl: string | null
): Promise<boolean> {
  try {
    const cleanNumber = cleanPhoneNumber(phoneNumber);

    const { error } = await supabase
      .schema('elfaroukgroup')
      .from('whatsapp_contacts')
      .update({
        profile_picture_url: pictureUrl,
        last_picture_fetch: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('phone_number', cleanNumber);

    if (error) {
      console.error('❌ Error updating contact profile picture:', error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error in updateContactProfilePicture:', error);
    return false;
  }
}

// Full flow: Get or create contact and refresh profile picture if needed
export async function syncContactWithProfilePicture(
  phoneNumber: string,
  customerName?: string
): Promise<WhatsAppContact | null> {
  try {
    // 1. Get or create contact
    const contact = await getOrCreateContact(phoneNumber, customerName);
    if (!contact) return null;

    // 2. Check if profile picture needs refresh
    if (shouldRefreshProfilePicture(contact)) {
      console.log('🔄 Refreshing profile picture for:', phoneNumber);
      const pictureUrl = await fetchAndStoreProfilePicture(phoneNumber);
      await updateContactProfilePicture(phoneNumber, pictureUrl);

      // Return updated contact
      const cleanNumber = cleanPhoneNumber(phoneNumber);
      const { data: updated } = await supabase
        .schema('elfaroukgroup')
        .from('whatsapp_contacts')
        .select('*')
        .eq('phone_number', cleanNumber)
        .single();

      return updated || contact;
    }

    return contact;
  } catch (error) {
    console.error('❌ Error in syncContactWithProfilePicture:', error);
    return null;
  }
}

// Get all contacts with profile pictures
export async function getAllContacts(): Promise<WhatsAppContact[]> {
  try {
    const { data, error } = await supabase
      .schema('elfaroukgroup')
      .from('whatsapp_contacts')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching contacts:', error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error in getAllContacts:', error);
    return [];
  }
}

// ============ Parse Incoming Webhook ============

// Parse incoming webhook message from WasenderAPI
export function parseIncomingMessage(webhookData: any): IncomingMessage | null {
  try {
    // WasenderAPI webhook format
    const message = webhookData.message || webhookData;

    if (!message) {
      return null;
    }

    // Extract phone number
    const from = message.from || message.sender || message.remoteJid;
    if (!from) {
      return null;
    }

    // Clean the phone number (remove @s.whatsapp.net suffix if present)
    const cleanFrom = from.replace('@s.whatsapp.net', '').replace('@c.us', '');

    // Determine message type and content
    let text = '';
    let mediaType: IncomingMessage['mediaType'] = 'text';
    let mediaUrl: string | undefined;

    if (message.text || message.body || message.conversation) {
      text = message.text || message.body || message.conversation;
      mediaType = 'text';
    } else if (message.imageMessage || message.image) {
      const img = message.imageMessage || message.image;
      text = img.caption || '[صورة]';
      mediaType = 'image';
      mediaUrl = img.url || img.directPath;
    } else if (message.videoMessage || message.video) {
      const vid = message.videoMessage || message.video;
      text = vid.caption || '[فيديو]';
      mediaType = 'video';
      mediaUrl = vid.url || vid.directPath;
    } else if (message.audioMessage || message.audio) {
      text = '[رسالة صوتية]';
      mediaType = 'audio';
      mediaUrl = (message.audioMessage || message.audio)?.url;
    } else if (message.documentMessage || message.document) {
      const doc = message.documentMessage || message.document;
      text = doc.fileName || doc.title || '[مستند]';
      mediaType = 'document';
      mediaUrl = doc.url || doc.directPath;
    } else if (message.locationMessage || message.location) {
      const loc = message.locationMessage || message.location;
      text = loc.name || loc.address || '[موقع]';
      mediaType = 'location';
    } else if (message.contactMessage || message.contact) {
      const contact = message.contactMessage || message.contact;
      text = contact.displayName || '[جهة اتصال]';
      mediaType = 'contact';
    }

    // Get timestamp
    const timestamp = message.timestamp
      ? new Date(typeof message.timestamp === 'number' ? message.timestamp * 1000 : message.timestamp)
      : new Date();

    // Get customer name
    const customerName = message.pushName || message.senderName || message.notifyName || cleanFrom;

    return {
      messageId: message.id || message.key?.id || `msg_${Date.now()}`,
      from: cleanFrom,
      customerName,
      text,
      timestamp,
      mediaType,
      mediaUrl,
    };
  } catch (error) {
    console.error('Error parsing incoming message:', error);
    return null;
  }
}
