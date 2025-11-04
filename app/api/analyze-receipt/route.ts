import { NextRequest, NextResponse } from 'next/server';
import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';

// Azure Document Intelligence Configuration
// Note: Client is initialized lazily inside the request handler to avoid build-time errors

// Helper function to extract amount from text (SMART ALGORITHM)
function extractAmount(text: string): number | null {
  console.log('💰 Starting amount extraction...');

  // STEP 1: أولاً، ابحث عن الأرقام القريبة من كلمات العملة (أولوية عالية)
  const currencyPatterns = [
    /(\d+(?:[.,]\d{1,2})?)\s*(?:EGP|egp)/gi,  // "475 EGP" or "475.00 EGP"
    /(?:EGP|egp)\s*(\d+(?:[.,]\d{1,2})?)/gi,  // "EGP 475"
    /(\d+(?:[.,]\d{1,2})?)\s*(?:ج\.م|جنيه|ج)\b/gi,  // "475 جنيه"
    /(?:ج\.م|جنيه|ج)\s*(\d+(?:[.,]\d{1,2})?)/gi,  // "جنيه 475"
  ];

  const amountsWithCurrency: number[] = [];

  for (const pattern of currencyPatterns) {
    const matches = Array.from(text.matchAll(pattern));
    for (const match of matches) {
      const numStr = (match[1] || match[0]).replace(/[,\s]/g, '');
      const parsed = parseFloat(numStr);
      if (!isNaN(parsed) && parsed >= 1 && parsed < 1000000) {
        console.log('💰 Amount found WITH currency:', parsed, 'from:', match[0]);
        amountsWithCurrency.push(parsed);
      }
    }
  }

  // إذا وجدنا مبالغ مع عملة، خذ الأصغر (عادة المبلغ الصحيح)
  if (amountsWithCurrency.length > 0) {
    const amount = Math.min(...amountsWithCurrency);
    console.log('✅ Final amount (from currency match):', amount);
    return amount;
  }

  // STEP 2: إذا لم نجد، ابحث عن أي رقم معقول (لكن استبعد التواريخ والسنوات)
  console.log('⚠️ No amount found near currency. Searching standalone numbers...');

  // استبعد السنوات (2020-2099) والتواريخ
  const textWithoutDates = text
    .replace(/20\d{2}/g, '')  // Remove years
    .replace(/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/g, '')  // Remove dates
    .replace(/\d{1,2}:\d{2}/g, '');  // Remove times

  const standalonePattern = /\b(\d{2,5})\b/g;
  const matches = Array.from(textWithoutDates.matchAll(standalonePattern));

  const candidates: number[] = [];
  for (const match of matches) {
    const parsed = parseFloat(match[1]);
    // فقط الأرقام بين 10 و 100,000
    if (!isNaN(parsed) && parsed >= 10 && parsed <= 100000) {
      candidates.push(parsed);
      console.log('🔍 Standalone number found:', parsed);
    }
  }

  if (candidates.length > 0) {
    // خذ أصغر رقم معقول (عادة المبلغ الصحيح)
    const amount = Math.min(...candidates);
    console.log('✅ Final amount (standalone):', amount, 'from candidates:', candidates);
    return amount;
  }

  console.log('❌ No amount found');
  return null;
}

// Helper function to extract account number
function extractAccountNumber(text: string): string | null {
  // Look for Egyptian mobile numbers (01xxxxxxxxx)
  const mobilePattern = /01[0-2|5]\d{8}/g;
  const matches = text.match(mobilePattern);

  if (matches && matches.length > 0) {
    return matches[0];
  }

  // Fallback: any 10+ digit number
  const numberPattern = /\d{10,}/g;
  const numberMatches = text.match(numberPattern);
  if (numberMatches && numberMatches.length > 0) {
    return numberMatches[0].replace(/\D/g, '');
  }

  return null;
}

// Helper function to extract date
function extractDate(text: string): string | null {
  const datePatterns = [
    // "17 Sep 2025 03:50 PM" format
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi,
    // "17-09-2025" or "17/09/2025"
    /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/g,
    // "2025-09-17"
    /(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/g,
    // "17-09-25" or "17/09/25"
    /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2})/g,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match && match[0]) {
      return match[0].trim();
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    console.log('📸 Analyze receipt API called (Azure Document Intelligence)');

    // Initialize Azure client (lazy initialization to avoid build-time errors)
    const AZURE_ENDPOINT = process.env.AZURE_ENDPOINT;
    const AZURE_API_KEY = process.env.AZURE_API_KEY;

    if (!AZURE_ENDPOINT || !AZURE_API_KEY) {
      console.error('❌ Azure credentials not configured');
      return NextResponse.json(
        { error: 'Azure Document Intelligence credentials not configured' },
        { status: 500 }
      );
    }

    const client = new DocumentAnalysisClient(
      AZURE_ENDPOINT,
      new AzureKeyCredential(AZURE_API_KEY)
    );

    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      console.error('❌ No image file provided');
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    console.log('✓ File received:', file.name, file.size, 'bytes');

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log('✓ Buffer created:', buffer.length, 'bytes');

    // Perform document analysis using Azure Document Intelligence
    console.log('🔍 Calling Azure Document Intelligence (Read API)...');

    const poller = await client.beginAnalyzeDocument('prebuilt-read', buffer);
    const result = await poller.pollUntilDone();

    console.log('✓ Azure Document Intelligence responded');

    // Extract all text from the document
    let fullText = '';
    if (result.content) {
      fullText = result.content;
    }

    console.log('✓ Text detected, length:', fullText.length);
    console.log('📄 Full text:', fullText.substring(0, 500)); // First 500 chars for debugging

    // Extract amount, account number, and date
    const amount = extractAmount(fullText);
    const accountNumber = extractAccountNumber(fullText);
    const transactionDate = extractDate(fullText);

    console.log('✓ Extracted - Amount:', amount, 'Account:', accountNumber, 'Date:', transactionDate);

    return NextResponse.json({
      success: true,
      amount,
      accountNumber,
      transactionDate,
      fullText: fullText.substring(0, 1000), // Return first 1000 chars for debugging
    });

  } catch (error: any) {
    console.error('❌ Error analyzing receipt:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack?.substring(0, 500)
    });

    return NextResponse.json(
      {
        error: 'Failed to analyze receipt',
        details: error.message,
        code: error.code
      },
      { status: 500 }
    );
  }
}
