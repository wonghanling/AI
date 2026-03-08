import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 把外部 URL 或 base64 下载后上传到 Supabase Storage，返回永久 URL
export async function uploadToStorage(
  userId: string,
  url: string,
  type: 'image' | 'video'
): Promise<string> {
  const bucket = type === 'video' ? 'videos' : 'images';
  const ext = type === 'video' ? 'mp4' : 'jpg';
  const contentType = type === 'video' ? 'video/mp4' : 'image/jpeg';
  const filename = `${userId}/${Date.now()}.${ext}`;

  let blob: Blob;

  if (url.startsWith('data:')) {
    // base64 data URL
    const res = await fetch(url);
    blob = await res.blob();
  } else {
    // 外部 URL 下载
    const res = await fetch(url);
    if (!res.ok) throw new Error(`下载失败: ${res.status}`);
    blob = await res.blob();
  }

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filename, blob, { contentType, upsert: false });

  if (error) throw new Error(`上传失败: ${error.message}`);

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(filename);
  return data.publicUrl;
}
