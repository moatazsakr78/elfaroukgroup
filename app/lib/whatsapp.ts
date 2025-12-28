// WasenderAPI Utility Functions
// Documentation: https://wasenderapi.com/api-docs

import { getApiKey } from './api-keys';

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

// Send a text message
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<SendMessageResponse> {
  try {
    const cleanNumber = cleanPhoneNumber(to);

    const payload: WasenderTextPayload = {
      to: cleanNumber,
      text: message,
    };

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
