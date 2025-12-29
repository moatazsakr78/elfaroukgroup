import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  decryptAndStoreMedia,
  hasMediaContent,
  getMediaType,
  syncContactWithProfilePicture
} from '@/app/lib/whatsapp';

// Supabase client for storing messages
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Webhook verification
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // WasenderAPI verification
  const challenge = searchParams.get('challenge');
  if (challenge) {
    console.log('✅ WasenderAPI Webhook verified');
    return new NextResponse(challenge, { status: 200 });
  }

  // Also support Meta-style verification (for compatibility)
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const hubChallenge = searchParams.get('hub.challenge');
  const verifyToken = process.env.WASENDER_WEBHOOK_SECRET || process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Webhook verified successfully');
    return new NextResponse(hubChallenge, { status: 200 });
  }

  // If no verification params, return simple OK for health check
  return NextResponse.json({ status: 'ok', message: 'Webhook endpoint active' }, { status: 200 });
}

// POST - Receive incoming messages from WasenderAPI
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('📩 Webhook received:', JSON.stringify(body, null, 2));

    // WasenderAPI webhook format
    const event = body.event || body.type;

    // Handle only messages.received event (ignore messages.upsert to prevent duplicates)
    if (event === 'messages.received') {
      // WasenderAPI format: data.messages is a single object (not array)
      const messagesData = body.data?.messages;

      if (!messagesData) {
        console.log('⚠️ No messages data in webhook payload');
        return NextResponse.json({ status: 'received' }, { status: 200 });
      }

      // Handle both single object and array formats
      const messages = Array.isArray(messagesData) ? messagesData : [messagesData];

      for (const msgData of messages) {
        // Skip outgoing messages
        const key = msgData.key || {};
        if (key.fromMe === true) {
          console.log('⏭️ Skipping outgoing message');
          continue;
        }

        // Parse WasenderAPI message format
        const message = parseWasenderMessage(msgData);

        if (message) {
          console.log('📱 New message from:', message.customerName, '-', message.text);

          // Check if message contains media that needs decryption
          let mediaUrl = message.mediaUrl;
          if (hasMediaContent(msgData)) {
            const mediaType = getMediaType(msgData);
            if (mediaType !== 'text') {
              console.log('🖼️ Processing media message:', mediaType);
              const storedUrl = await decryptAndStoreMedia(msgData, message.messageId, mediaType as 'image' | 'video' | 'audio' | 'document');
              if (storedUrl) {
                mediaUrl = storedUrl;
                console.log('✅ Media URL obtained:', storedUrl);
              } else {
                console.log('⚠️ Could not decrypt/store media, using placeholder');
              }
            }
          }

          // Use upsert to prevent duplicates (atomic operation)
          const { error: dbError } = await supabase
            .schema('elfaroukgroup')
            .from('whatsapp_messages')
            .upsert({
              message_id: message.messageId,
              from_number: message.from,
              customer_name: message.customerName,
              message_text: message.text,
              message_type: 'incoming',
              media_type: message.mediaType || 'text',
              media_url: mediaUrl || null,
              is_read: false,
              created_at: message.timestamp.toISOString(),
            }, {
              onConflict: 'message_id',
              ignoreDuplicates: true
            });

          if (dbError) {
            console.error('❌ Database error:', dbError.message);
          } else {
            console.log('✅ Message stored successfully');

            // Sync contact and fetch profile picture (runs in background)
            syncContactWithProfilePicture(message.from, message.customerName)
              .then(contact => {
                if (contact?.profile_picture_url) {
                  console.log('📷 Contact profile picture synced:', contact.profile_picture_url);
                }
              })
              .catch(err => console.error('❌ Error syncing contact:', err));
          }
        }
      }
    } else if (event === 'messages.upsert') {
      // Ignore messages.upsert to prevent duplicates (we only process messages.received)
      console.log('⏭️ Ignoring messages.upsert event (using messages.received only)');
    } else if (event === 'messages.update' || event === 'message.update') {
      // Message status update (delivered, read, etc.)
      console.log('📊 Message status update:', body.data);
    } else if (event === 'connection.update' || event === 'session.update') {
      // Session status update
      console.log('🔗 Connection update:', body.data);
    } else if (event === 'webhook.test') {
      // Test webhook event
      console.log('🧪 Webhook test received');
    } else {
      console.log('📝 Unknown event type:', event);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    // Still return 200 to prevent retries
    return NextResponse.json({ status: 'error' }, { status: 200 });
  }
}

// Parse WasenderAPI message format
interface ParsedMessage {
  messageId: string;
  from: string;
  customerName: string;
  text: string;
  timestamp: Date;
  mediaType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact';
  mediaUrl?: string;
}

function parseWasenderMessage(msgData: any): ParsedMessage | null {
  try {
    const key = msgData.key || {};
    const message = msgData.message || {};

    // Get message ID
    const messageId = key.id || msgData.id || `msg_${Date.now()}`;

    // Get phone number - WasenderAPI uses cleanedSenderPn or cleanedParticipantPn
    let from = key.cleanedSenderPn || key.cleanedParticipantPn || '';

    // Fallback to remoteJid if no clean phone number
    if (!from && key.remoteJid) {
      from = key.remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', '');
    }

    if (!from) {
      console.log('⚠️ Could not extract phone number from message');
      return null;
    }

    // IMPORTANT: Detect media type FIRST before extracting text
    // This fixes the bug where images with captions were being treated as text
    let text = '';
    let mediaType: ParsedMessage['mediaType'] = 'text';
    let mediaUrl: string | undefined;

    // Check for media content in the message object FIRST
    if (message.imageMessage) {
      mediaType = 'image';
      mediaUrl = message.imageMessage.url;
      text = msgData.messageBody || message.imageMessage.caption || '[صورة]';
    } else if (message.videoMessage) {
      mediaType = 'video';
      mediaUrl = message.videoMessage.url;
      text = msgData.messageBody || message.videoMessage.caption || '[فيديو]';
    } else if (message.audioMessage) {
      mediaType = 'audio';
      mediaUrl = message.audioMessage.url;
      text = '[رسالة صوتية]';
    } else if (message.documentMessage) {
      mediaType = 'document';
      mediaUrl = message.documentMessage.url;
      text = msgData.messageBody || message.documentMessage.fileName || '[مستند]';
    } else if (message.locationMessage) {
      mediaType = 'location';
      const loc = message.locationMessage;
      text = msgData.messageBody || loc.name || loc.address || `[موقع: ${loc.degreesLatitude}, ${loc.degreesLongitude}]`;
    } else if (message.contactMessage || message.contactsArrayMessage) {
      mediaType = 'contact';
      text = '[جهة اتصال]';
    } else if (message.stickerMessage) {
      mediaType = 'image';
      mediaUrl = message.stickerMessage.url;
      text = '[ملصق]';
    } else {
      // Text messages - check various text sources
      text = msgData.messageBody ||
             message.conversation ||
             message.extendedTextMessage?.text ||
             '[رسالة فارغة]';
    }

    // Get customer name
    const customerName = msgData.pushName || key.pushName || msgData.notifyName || from;

    // Get timestamp
    let timestamp = new Date();
    if (msgData.messageTimestamp) {
      const ts = typeof msgData.messageTimestamp === 'number'
        ? msgData.messageTimestamp * 1000
        : parseInt(msgData.messageTimestamp) * 1000;
      timestamp = new Date(ts);
    }

    return {
      messageId,
      from,
      customerName,
      text,
      timestamp,
      mediaType,
      mediaUrl,
    };
  } catch (error) {
    console.error('❌ Error parsing message:', error);
    return null;
  }
}
