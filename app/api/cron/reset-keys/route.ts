import { resetDailyRequestCounts } from '@/lib/api-key-pool';

export async function GET(req: Request) {
  // 验证 Cron Secret（防止被滥用）
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  await resetDailyRequestCounts();

  return new Response('OK');
}
