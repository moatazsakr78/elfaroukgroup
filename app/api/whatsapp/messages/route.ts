import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering - disable Vercel Edge caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helper function to chunk array for batched queries (Supabase URL limit)
const chunkArray = <T,>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

const QUERY_BATCH_SIZE = 200;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch messages or conversations
// ?phone=XXX - Fetch messages for specific conversation
// ?conversationsOnly=true - Fetch only conversations list (no messages)
// No params - Fetch all (legacy, not recommended)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const phoneNumber = searchParams.get('phone');
    const conversationsOnly = searchParams.get('conversationsOnly') === 'true';

    console.log(`📱 WhatsApp API: phone=${phoneNumber}, conversationsOnly=${conversationsOnly}`);

    // Try to fetch from database first
    let query = supabase
      .schema('elfaroukgroup')
      .from('whatsapp_messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (phoneNumber) {
      query = query.eq('from_number', phoneNumber);
    }

    const { data: rawData, error } = await query;

    console.log(`📨 Fetched ${rawData?.length || 0} messages from database`);

    if (error) {
      // If table doesn't exist, return empty array
      console.log('Database query error:', error.message);
      return NextResponse.json({ messages: [], conversations: [] }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      });
    }

    // Validate and filter out corrupted messages
    const data = (rawData || []).filter(msg => {
      // Required fields validation
      if (!msg.from_number || typeof msg.from_number !== 'string' || msg.from_number.trim() === '') {
        console.warn(`⚠️ Skipping message with invalid from_number:`, msg.id);
        return false;
      }
      if (!msg.message_id) {
        console.warn(`⚠️ Skipping message with missing message_id:`, msg.id);
        return false;
      }
      if (!msg.created_at || isNaN(new Date(msg.created_at).getTime())) {
        console.warn(`⚠️ Skipping message with invalid created_at:`, msg.id);
        return false;
      }
      return true;
    });

    const skippedCount = (rawData?.length || 0) - data.length;
    if (skippedCount > 0) {
      console.log(`⚠️ Skipped ${skippedCount} invalid messages`);
    }

    // Fetch reactions for all messages (using batched queries to avoid URL length limit)
    const messageIds = (data || []).map(m => m.message_id);
    let reactionsMap: Record<string, { emoji: string; from_number: string; is_from_me: boolean }[]> = {};

    if (messageIds.length > 0) {
      // Split messageIds into batches to avoid Supabase URL limit
      const messageIdChunks = chunkArray(messageIds, QUERY_BATCH_SIZE);
      console.log(`📦 Fetching reactions for ${messageIds.length} messages in ${messageIdChunks.length} batches`);

      // Fetch reactions in batches
      const reactionsPromises = messageIdChunks.map(chunk =>
        supabase
          .schema('elfaroukgroup')
          .from('whatsapp_reactions')
          .select('message_id, emoji, from_number, is_from_me')
          .in('message_id', chunk)
      );

      const reactionsResults = await Promise.all(reactionsPromises);

      // Merge results and build reactionsMap
      for (const result of reactionsResults) {
        if (!result.error && result.data) {
          for (const reaction of result.data) {
            if (!reactionsMap[reaction.message_id]) {
              reactionsMap[reaction.message_id] = [];
            }
            reactionsMap[reaction.message_id].push({
              emoji: reaction.emoji,
              from_number: reaction.from_number,
              is_from_me: reaction.is_from_me
            });
          }
        }
      }
    }

    // Add reactions to each message
    const messagesWithReactions = (data || []).map(msg => ({
      ...msg,
      reactions: reactionsMap[msg.message_id] || []
    }));

    // Group messages by phone number for conversations view
    const conversations = new Map<string, {
      phoneNumber: string;
      customerName: string;
      lastMessage: string;
      lastMessageTime: string;
      lastSender: 'customer' | 'me';
      unreadCount: number;
    }>();

    for (const msg of data || []) {
      const existing = conversations.get(msg.from_number);
      const isOutgoing = msg.message_type === 'outgoing';

      if (!existing) {
        // First message for this conversation
        conversations.set(msg.from_number, {
          phoneNumber: msg.from_number,
          // Use customer name only from incoming messages, otherwise keep phone number
          customerName: isOutgoing ? msg.from_number : msg.customer_name,
          lastMessage: msg.message_text,
          lastMessageTime: msg.created_at,
          lastSender: isOutgoing ? 'me' : 'customer',
          unreadCount: !isOutgoing && !msg.is_read ? 1 : 0,
        });
      } else {
        // Update customer name if this is an incoming message (to get the real customer name)
        if (!isOutgoing && msg.customer_name && msg.customer_name !== 'الفاروق جروب') {
          existing.customerName = msg.customer_name;
        }

        // Update last message if this is newer
        if (new Date(msg.created_at) > new Date(existing.lastMessageTime)) {
          existing.lastMessage = msg.message_text;
          existing.lastMessageTime = msg.created_at;
          existing.lastSender = isOutgoing ? 'me' : 'customer';
        }

        // Count unread incoming messages
        if (!isOutgoing && !msg.is_read) {
          existing.unreadCount++;
        }
      }
    }

    // Sort conversations by lastMessageTime (newest first)
    const sortedConversations = Array.from(conversations.values()).sort((a, b) =>
      new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    );

    console.log(`💬 Built ${sortedConversations.length} conversations`);

    // If conversationsOnly mode, don't return all messages (saves bandwidth)
    const returnMessages = conversationsOnly ? [] : messagesWithReactions;

    return NextResponse.json({
      messages: returnMessages,
      conversations: sortedConversations,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('Fetch messages error:', error);
    return NextResponse.json({ messages: [], conversations: [] }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  }
}
