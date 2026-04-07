import { NextRequest, NextResponse } from 'next/server';
import { ingestInterviewTranscriptFromBot } from '@/app/actions';

export async function POST(request: NextRequest) {
  const expectedKey = process.env.INTERVIEW_BOT_WEBHOOK_KEY;
  if (!expectedKey) {
    return NextResponse.json(
      { error: 'Webhook key is not configured.' },
      { status: 500 }
    );
  }

  const providedKey = request.headers.get('x-bot-webhook-key');
  if (providedKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const result = await ingestInterviewTranscriptFromBot(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to ingest transcript',
      },
      { status: 400 }
    );
  }
}
