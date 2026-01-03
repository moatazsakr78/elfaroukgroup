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

    // Handle both messages.received and messages.upsert events
    // messages.upsert is used for outgoing messages sent from mobile WhatsApp Business app
    if (event === 'messages.received' || event === 'messages.upsert') {
      // WasenderAPI format: data.messages is a single object (not array)
      const messagesData = body.data?.messages;

      if (!messagesData) {
        console.log('⚠️ No messages data in webhook payload');
        return NextResponse.json({ status: 'received' }, { status: 200 });
      }

      // Handle both single object and array formats
      const messages = Array.isArray(messagesData) ? messagesData : [messagesData];

      for (const msgData of messages) {
        const key = msgData.key || {};
        const isOutgoing = key.fromMe === true;

        // Skip outgoing messages - they're already saved by Send API
        // This prevents duplicate messages in the database
        if (isOutgoing) {
          console.log('⏭️ Skipping outgoing message (already saved by Send API)');
          continue;
        }

        // Parse WasenderAPI message format
        const message = parseWasenderMessage(msgData);

        if (message) {
          // Extra validation before storing
          if (!message.from || message.from.trim() === '') {
            console.warn('⚠️ Skipping message: invalid phone number');
            continue;
          }
          if (!message.messageId) {
            console.warn('⚠️ Skipping message: missing message ID');
            continue;
          }

          console.log(`📥 Incoming message (${event}):`, message.customerName, '-', message.text);

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
          // Store both incoming and outgoing messages
          const { error: dbError } = await supabase
            .schema('elfaroukgroup')
            .from('whatsapp_messages')
            .upsert({
              message_id: message.messageId,
              msg_id: message.msgId || null, // WasenderAPI integer ID for replyTo
              from_number: message.from,
              customer_name: message.customerName,
              message_text: message.text,
              message_type: 'incoming',
              media_type: message.mediaType || 'text',
              media_url: mediaUrl || null,
              is_read: false,
              created_at: message.timestamp.toISOString(),
              // Quoted/Reply message fields
              quoted_message_id: message.quotedMessageId || null,
              quoted_message_text: message.quotedMessageText || null,
              quoted_message_sender: message.quotedMessageSender || null,
            }, {
              onConflict: 'message_id',
              ignoreDuplicates: true
            });

          if (dbError) {
            console.error('❌ Database error:', dbError.message);
          } else {
            console.log('✅ Message stored successfully');

            // Sync contact and fetch profile picture for incoming messages
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
    } else if (event === 'messages.update' || event === 'message.update') {
      // Message status update (delivered, read, etc.)
      console.log('📊 Message status update:', body.data);
    } else if (event === 'connection.update' || event === 'session.update') {
      // Session status update
      console.log('🔗 Connection update:', body.data);
    } else if (event === 'webhook.test') {
      // Test webhook event
      console.log('🧪 Webhook test received');
    } else if (event === 'messages.reaction') {
      // Handle reaction events
      console.log('👍 Reaction event received:', JSON.stringify(body.data, null, 2));

      const reactionsData = body.data;
      const reactions = Array.isArray(reactionsData) ? reactionsData : [reactionsData];

      for (const reactionData of reactions) {
        const key = reactionData.key || {};
        const reaction = reactionData.reaction || {};

        // Get the message ID that was reacted to
        const messageId = reaction.key?.id || key.id;
        const emoji = reaction.text;
        const fromNumber = key.cleanedSenderPn || key.remoteJid?.replace('@s.whatsapp.net', '').replace('@c.us', '') || '';
        const isFromMe = key.fromMe === true;

        if (messageId) {
          // If emoji is empty or null, it means removing the reaction
          if (!emoji || emoji === '') {
            const { error: deleteError } = await supabase
              .schema('elfaroukgroup')
              .from('whatsapp_reactions')
              .delete()
              .eq('message_id', messageId)
              .eq('from_number', fromNumber);

            if (deleteError) {
              console.error('❌ Error removing reaction:', deleteError.message);
            } else {
              console.log('🗑️ Reaction removed from message:', messageId);
            }
          } else {
            // Add or update the reaction
            const { error: upsertError } = await supabase
              .schema('elfaroukgroup')
              .from('whatsapp_reactions')
              .upsert({
                message_id: messageId,
                from_number: fromNumber,
                emoji: emoji,
                is_from_me: isFromMe
              }, {
                onConflict: 'message_id,from_number'
              });

            if (upsertError) {
              console.error('❌ Error storing reaction:', upsertError.message);
            } else {
              console.log('👍 Reaction stored:', emoji, 'on message:', messageId, 'from:', fromNumber);
            }
          }
        }
      }
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
  msgId?: number; // WasenderAPI integer ID for replyTo (only available for sent messages)
  from: string;
  customerName: string;
  text: string;
  timestamp: Date;
  mediaType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact';
  mediaUrl?: string;
  // Quoted/Reply message fields
  quotedMessageId?: string;
  quotedMessageText?: string;
  quotedMessageSender?: string;
}

function parseWasenderMessage(msgData: any): ParsedMessage | null {
  try {
    const key = msgData.key || {};
    const message = msgData.message || {};

    // Get message ID
    const messageId = key.id || msgData.id || `msg_${Date.now()}`;

    // Get msgId from WasenderAPI - needed for replyTo
    // WasenderAPI returns msgId only for sent messages
    // Note: msg_id column is bigint, so we only store integer values
    // For incoming messages without msgId, the frontend uses message_id (string) as fallback
    const msgId = msgData.msgId || msgData.msg_id || key.msgId || null;

    if (msgId) {
      console.log('📌 Found msgId:', msgId);
    } else {
      console.log('📌 No msgId found, will use message_id as fallback for replies');
    }

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

    // Extract quoted/reply message info from contextInfo
    let quotedMessageId: string | undefined;
    let quotedMessageText: string | undefined;
    let quotedMessageSender: string | undefined;

    // contextInfo can be in various message types
    const contextInfo = message.extendedTextMessage?.contextInfo ||
                        message.imageMessage?.contextInfo ||
                        message.videoMessage?.contextInfo ||
                        message.audioMessage?.contextInfo ||
                        message.documentMessage?.contextInfo ||
                        message.stickerMessage?.contextInfo;

    if (contextInfo?.stanzaId) {
      quotedMessageId = contextInfo.stanzaId;
      // Get quoted message sender
      const participant = contextInfo.participant || contextInfo.remoteJid || '';
      quotedMessageSender = participant
        .replace('@s.whatsapp.net', '')
        .replace('@c.us', '')
        .replace('@lid', '');

      // Get quoted message text
      const quotedMsg = contextInfo.quotedMessage;
      if (quotedMsg) {
        quotedMessageText = quotedMsg.conversation ||
                           quotedMsg.extendedTextMessage?.text ||
                           quotedMsg.imageMessage?.caption ||
                           quotedMsg.videoMessage?.caption ||
                           quotedMsg.documentMessage?.caption ||
                           (quotedMsg.imageMessage ? '[صورة]' : null) ||
                           (quotedMsg.videoMessage ? '[فيديو]' : null) ||
                           (quotedMsg.audioMessage ? '[رسالة صوتية]' : null) ||
                           (quotedMsg.documentMessage ? '[مستند]' : null) ||
                           (quotedMsg.stickerMessage ? '[ملصق]' : null) ||
                           '[رسالة]';
      }
      console.log('📎 Quoted message detected:', { quotedMessageId, quotedMessageSender, quotedMessageText });
    }

    // Get timestamp with validation
    let timestamp = new Date();
    if (msgData.messageTimestamp) {
      try {
        const rawTs = msgData.messageTimestamp;
        let ts: number;

        if (typeof rawTs === 'number') {
          // Check if it's already in milliseconds (13 digits) or seconds (10 digits)
          ts = rawTs > 9999999999 ? rawTs : rawTs * 1000;
        } else if (typeof rawTs === 'string') {
          const parsed = parseInt(rawTs, 10);
          if (!isNaN(parsed)) {
            ts = parsed > 9999999999 ? parsed : parsed * 1000;
          } else {
            ts = Date.now();
          }
        } else {
          ts = Date.now();
        }

        const newDate = new Date(ts);
        // Validate the date is valid
        if (!isNaN(newDate.getTime())) {
          timestamp = newDate;
        }
      } catch (e) {
        console.log('⚠️ Could not parse timestamp, using current time');
      }
    }

    return {
      messageId,
      msgId: msgId ? Number(msgId) : undefined, // Convert to number for bigint column
      from,
      customerName,
      text,
      timestamp,
      mediaType,
      mediaUrl,
      quotedMessageId,
      quotedMessageText,
      quotedMessageSender,
    };
  } catch (error) {
    console.error('❌ Error parsing message:', error);
    return null;
  }
}
