import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    // Handle different event types
    if (event === 'messages.upsert' || event === 'messages.received' || event === 'message') {
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

          // Check for duplicate message
          const { data: existingMsg } = await supabase
            .schema('elfaroukgroup')
            .from('whatsapp_messages')
            .select('id')
            .eq('message_id', message.messageId)
            .single();

          if (existingMsg) {
            console.log('⏭️ Message already exists, skipping');
            continue;
          }

          // Store message in database
          const { error: dbError } = await supabase
            .schema('elfaroukgroup')
            .from('whatsapp_messages')
            .insert({
              message_id: message.messageId,
              from_number: message.from,
              customer_name: message.customerName,
              message_text: message.text,
              message_type: 'incoming',
              media_type: message.mediaType || 'text',
              media_url: message.mediaUrl || null,
              is_read: false,
              created_at: message.timestamp.toISOString(),
            });

          if (dbError) {
            console.error('❌ Database error:', dbError.message);
          } else {
            console.log('✅ Message stored successfully');
          }
        }
      }
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

    // Get message text - WasenderAPI uses messageBody for unified text
    let text = msgData.messageBody || '';
    let mediaType: ParsedMessage['mediaType'] = 'text';
    let mediaUrl: string | undefined;

    // If no messageBody, try to extract from raw message object
    if (!text) {
      if (message.conversation) {
        text = message.conversation;
      } else if (message.extendedTextMessage?.text) {
        text = message.extendedTextMessage.text;
      } else if (message.imageMessage) {
        text = message.imageMessage.caption || '[صورة]';
        mediaType = 'image';
        mediaUrl = message.imageMessage.url;
      } else if (message.videoMessage) {
        text = message.videoMessage.caption || '[فيديو]';
        mediaType = 'video';
        mediaUrl = message.videoMessage.url;
      } else if (message.audioMessage) {
        text = '[رسالة صوتية]';
        mediaType = 'audio';
        mediaUrl = message.audioMessage.url;
      } else if (message.documentMessage) {
        text = message.documentMessage.fileName || '[مستند]';
        mediaType = 'document';
        mediaUrl = message.documentMessage.url;
      } else if (message.locationMessage) {
        const loc = message.locationMessage;
        text = loc.name || loc.address || `[موقع: ${loc.degreesLatitude}, ${loc.degreesLongitude}]`;
        mediaType = 'location';
      } else if (message.contactMessage || message.contactsArrayMessage) {
        text = '[جهة اتصال]';
        mediaType = 'contact';
      } else if (message.stickerMessage) {
        text = '[ملصق]';
        mediaType = 'image';
      }
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
      text: text || '[رسالة فارغة]',
      timestamp,
      mediaType,
      mediaUrl,
    };
  } catch (error) {
    console.error('❌ Error parsing message:', error);
    return null;
  }
}
