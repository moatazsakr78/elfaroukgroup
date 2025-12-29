import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Mark all messages from a phone number as read
export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'رقم الهاتف مطلوب' },
        { status: 400 }
      );
    }

    // Update all unread incoming messages from this phone number
    const { error } = await supabase
      .schema('elfaroukgroup')
      .from('whatsapp_messages')
      .update({ is_read: true })
      .eq('from_number', phoneNumber)
      .eq('message_type', 'incoming')
      .eq('is_read', false);

    if (error) {
      console.error('Error marking messages as read:', error);
      return NextResponse.json(
        { error: 'فشل في تحديث الرسائل' },
        { status: 500 }
      );
    }

    console.log('✅ Messages marked as read for:', phoneNumber);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark as read error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ' },
      { status: 500 }
    );
  }
}
