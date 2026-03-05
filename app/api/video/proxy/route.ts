import { NextRequest, NextResponse } from 'next/server';

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: '缺少 taskId 参数' }, { status: 400 });
    }

    // 1. 查询任务状态获取最新 video_url
    const queryResponse = await fetch(`${YUNWU_BASE_URL}/v1/video/query?task_id=${taskId}`, {
      headers: {
        'Authorization': `Bearer ${YUNWU_API_KEY}`,
      },
    });

    if (!queryResponse.ok) {
      console.error('查询视频任务失败:', queryResponse.status);
      return NextResponse.json({ error: '查询视频任务失败' }, { status: 500 });
    }

    const taskData = await queryResponse.json();
    console.log('视频任务状态:', taskData);

    // 2. 检查视频是否生成完成
    if (taskData.status !== 'SUCCESS' && taskData.status !== 'success') {
      return NextResponse.json({
        error: '视频尚未生成完成',
        status: taskData.status
      }, { status: 404 });
    }

    const videoUrl = taskData.video_url || taskData.videoUrl;
    if (!videoUrl) {
      return NextResponse.json({ error: '视频 URL 不存在' }, { status: 404 });
    }

    console.log('代理视频 URL:', videoUrl);

    // 3. 获取视频流
    const videoResponse = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!videoResponse.ok) {
      console.error('获取视频流失败:', videoResponse.status);
      return NextResponse.json({ error: '获取视频流失败' }, { status: 500 });
    }

    // 4. 转发视频流
    const videoBlob = await videoResponse.blob();
    const contentType = videoResponse.headers.get('content-type') || 'video/mp4';

    return new NextResponse(videoBlob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('视频代理错误:', error);
    return NextResponse.json(
      { error: error.message || '视频代理失败' },
      { status: 500 }
    );
  }
}
