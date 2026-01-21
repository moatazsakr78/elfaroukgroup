import { NextRequest, NextResponse } from 'next/server';
import {
  sendWhatsAppMessage,
  sendImageMessage,
  sendVideoMessage,
  sendDocumentMessage,
  sendAudioMessage,
  sendLocationMessage,
  sendContactMessage,
  sendPollMessage,
  cleanPhoneNumber,
} from '@/app/lib/whatsapp';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type MessageType = 'text' | 'image' | 'video' | 'document' | 'audio' | 'location' | 'contact' | 'poll';

interface SendMessageRequest {
  to: string;
  message?: string;
  messageType?: MessageType;
  // For media messages
  mediaUrl?: string;
  caption?: string;
  filename?: string;
  // For location
  latitude?: number;
  longitude?: number;
  locationName?: string;
  address?: string;
  // For contact
  contactName?: string;
  contactPhone?: string;
  // For poll
  pollQuestion?: string;
  pollOptions?: string[];
  selectableOptionsCount?: number;
  // For reply/quoted messages
  quotedMsgId?: number | string; // WasenderAPI integer ID or WhatsApp string ID for replyTo
  quotedMessageId?: string; // WhatsApp string ID for our database
  quotedMessageText?: string;
  quotedMessageSender?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SendMessageRequest = await request.json();
    const {
      to,
      message,
      messageType = 'text',
      mediaUrl,
      caption,
      filename,
      latitude,
      longitude,
      locationName,
      address,
      contactName,
      contactPhone,
      pollQuestion,
      pollOptions,
      selectableOptionsCount,
      quotedMsgId,
      quotedMessageId,
      quotedMessageText,
      quotedMessageSender,
    } = body;

    // Validate required fields
    if (!to) {
      return NextResponse.json(
        { error: 'رقم الهاتف مطلوب' },
        { status: 400 }
      );
    }

    const cleanNumber = cleanPhoneNumber(to);
    let result;
    let messageText = '';
    let mediaType = messageType;

    switch (messageType) {
      case 'text':
        if (!message) {
          return NextResponse.json(
            { error: 'نص الرسالة مطلوب' },
            { status: 400 }
          );
        }
        // Pass quotedMsgId (integer) for WasenderAPI replyTo
        result = await sendWhatsAppMessage(cleanNumber, message, quotedMsgId);
        messageText = message;
        break;

      case 'image':
        if (!mediaUrl) {
          return NextResponse.json(
            { error: 'رابط الصورة مطلوب' },
            { status: 400 }
          );
        }
        result = await sendImageMessage(cleanNumber, mediaUrl, caption);
        messageText = caption || '[صورة]';
        break;

      case 'video':
        if (!mediaUrl) {
          return NextResponse.json(
            { error: 'رابط الفيديو مطلوب' },
            { status: 400 }
          );
        }
        result = await sendVideoMessage(cleanNumber, mediaUrl, caption);
        messageText = caption || '[فيديو]';
        break;

      case 'document':
        if (!mediaUrl) {
          return NextResponse.json(
            { error: 'رابط المستند مطلوب' },
            { status: 400 }
          );
        }
        result = await sendDocumentMessage(cleanNumber, mediaUrl, filename, caption);
        messageText = filename || caption || '[مستند]';
        break;

      case 'audio':
        if (!mediaUrl) {
          return NextResponse.json(
            { error: 'رابط الملف الصوتي مطلوب' },
            { status: 400 }
          );
        }
        result = await sendAudioMessage(cleanNumber, mediaUrl);
        messageText = '[رسالة صوتية]';
        break;

      case 'location':
        if (latitude === undefined || longitude === undefined) {
          return NextResponse.json(
            { error: 'إحداثيات الموقع مطلوبة' },
            { status: 400 }
          );
        }
        result = await sendLocationMessage(cleanNumber, latitude, longitude, locationName, address);
        messageText = locationName || address || '[موقع]';
        break;

      case 'contact':
        if (!contactName || !contactPhone) {
          return NextResponse.json(
            { error: 'اسم ورقم جهة الاتصال مطلوبان' },
            { status: 400 }
          );
        }
        result = await sendContactMessage(cleanNumber, contactName, contactPhone);
        messageText = `[جهة اتصال: ${contactName}]`;
        break;

      case 'poll':
        if (!pollQuestion || !pollOptions || pollOptions.length < 2) {
          return NextResponse.json(
            { error: 'سؤال الاستطلاع وخياران على الأقل مطلوبان' },
            { status: 400 }
          );
        }
        result = await sendPollMessage(cleanNumber, pollQuestion, pollOptions, selectableOptionsCount);
        messageText = `[استطلاع: ${pollQuestion}]`;
        break;

      default:
        return NextResponse.json(
          { error: 'نوع الرسالة غير مدعوم' },
          { status: 400 }
        );
    }

    if (result.success) {
      // Generate message_id if not provided by WasenderAPI
      const generatedMessageId = result.messageId || `sent_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Store message in database
      const { error: dbError } = await supabase.schema('elfaroukgroup').from('whatsapp_messages').insert({
        message_id: generatedMessageId,
        msg_id: result.msgId || null, // WasenderAPI integer ID for replyTo
        from_number: cleanNumber,
        customer_name: 'الفاروق جروب',
        message_text: messageText,
        message_type: 'outgoing',
        media_type: mediaType,
        media_url: mediaUrl || null,
        created_at: new Date().toISOString(),
        // Quoted message fields
        quoted_message_id: quotedMessageId || null,
        quoted_message_text: quotedMessageText || null,
        quoted_message_sender: quotedMessageSender || null,
      });

      if (dbError) {
        console.error('Database insert error:', dbError.message);
      } else {
        // Broadcast to connected clients
        const supabaseForBroadcast = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const messageData = {
          id: generatedMessageId,
          message_id: generatedMessageId,
          msg_id: result.msgId || null,
          from_number: cleanNumber,
          customer_name: 'الفاروق جروب',
          message_text: messageText,
          message_type: 'outgoing',
          media_type: mediaType,
          media_url: mediaUrl || null,
          is_read: true,
          created_at: new Date().toISOString(),
          quoted_message_id: quotedMessageId || null,
          quoted_message_text: quotedMessageText || null,
          quoted_message_sender: quotedMessageSender || null,
        };

        supabaseForBroadcast
          .channel('whatsapp_global')
          .send({
            type: 'broadcast',
            event: 'new_message',
            payload: messageData
          })
          .then(() => console.log('📡 Broadcast sent for outgoing message'))
          .catch((err) => console.error('❌ Broadcast failed:', err));
      }

      return NextResponse.json({
        success: true,
        messageId: generatedMessageId,
        msgId: result.msgId, // Return msgId for client if needed
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: 'فشل في إرسال الرسالة' },
      { status: 500 }
    );
  }
}

// GET endpoint to check WhatsApp session status
export async function GET() {
  try {
    const { getSessionStatus } = await import('@/app/lib/whatsapp');
    const status = await getSessionStatus();

    return NextResponse.json(status);
  } catch (error) {
    console.error('Error getting session status:', error);
    return NextResponse.json(
      { connected: false, status: 'error', error: 'Failed to get status' },
      { status: 500 }
    );
  }
}
