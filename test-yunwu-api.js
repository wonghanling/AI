// 测试云雾 API 图片生成
// 运行: node test-yunwu-api.js

// 从 .env.local 读取环境变量
require('dotenv').config({ path: '.env.local' });

const YUNWU_API_KEY = process.env.YUNWU_API_KEY;
const YUNWU_BASE_URL = 'https://allapi.store';

if (!YUNWU_API_KEY) {
  console.error('错误: 未找到 YUNWU_API_KEY 环境变量');
  console.error('请确保 .env.local 文件中包含 YUNWU_API_KEY');
  process.exit(1);
}

console.log('API Key 长度:', YUNWU_API_KEY.length);
console.log('API Key 前10个字符:', YUNWU_API_KEY.substring(0, 10) + '...');

async function testImageGeneration() {
  console.log('=== 测试云雾 API 图片生成 ===\n');

  const requestBody = {
    contents: [{
      role: 'user',
      parts: [{
        text: 'a cute cat'
      }]
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE']
    }
  };

  console.log('请求体:');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('\n发送请求到:', `${YUNWU_BASE_URL}/v1beta/models/gemini-2.5-flash-image:generateContent`);

  try {
    const response = await fetch(`${YUNWU_BASE_URL}/v1beta/models/gemini-2.5-flash-image:generateContent`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YUNWU_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('\n响应状态:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('\n错误响应:');
      console.error(errorText);
      return;
    }

    const data = await response.json();
    console.log('\n成功响应:');
    console.log(JSON.stringify(data, null, 2));

    // 分析响应结构
    console.log('\n=== 响应结构分析 ===');
    console.log('顶层键:', Object.keys(data));

    if (data.candidates) {
      console.log('candidates 数量:', data.candidates.length);
      const candidate = data.candidates[0];
      console.log('第一个 candidate 的键:', Object.keys(candidate));

      if (candidate.content) {
        console.log('content 的键:', Object.keys(candidate.content));

        if (candidate.content.parts) {
          console.log('parts 数量:', candidate.content.parts.length);
          candidate.content.parts.forEach((part, i) => {
            console.log(`part ${i} 的键:`, Object.keys(part));
            if (part.inline_data) {
              console.log(`  - inline_data.mime_type:`, part.inline_data.mime_type);
              console.log(`  - inline_data.data 长度:`, part.inline_data.data?.length || 0);
            }
            if (part.text) {
              console.log(`  - text:`, part.text.substring(0, 100));
            }
          });
        }
      }
    }

  } catch (error) {
    console.error('\n请求失败:');
    console.error(error.message);
    console.error(error.stack);
  }
}

testImageGeneration();
