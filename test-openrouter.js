// 测试 OpenRouter 图片生成 API
const OpenAI = require('openai');
const fs = require('fs');

// 读取 .env.local 文件
const envContent = fs.readFileSync('.env.local', 'utf8');
const apiKey = envContent.match(/OPENROUTER_API_KEY=(.+)/)?.[1]?.trim();

if (!apiKey) {
  console.error('未找到 OPENROUTER_API_KEY');
  process.exit(1);
}

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: apiKey,
  defaultHeaders: {
    'HTTP-Referer': 'https://boluoing.com',
    'X-Title': 'BoLuoing AI',
  },
});

async function testImageGeneration() {
  console.log('=== 测试 Nano Banana (普通) ===');
  try {
    const response1 = await openrouter.chat.completions.create({
      model: 'google/gemini-2.5-flash-image',
      messages: [
        {
          role: 'user',
          content: 'A beautiful sunset over the ocean',
        },
      ],
    });
    console.log('Nano 响应:', JSON.stringify(response1, null, 2));
    console.log('Content:', response1.choices?.[0]?.message?.content);
  } catch (error) {
    console.error('Nano 错误:', error.message);
    if (error.response) {
      console.error('错误详情:', error.response.data);
    }
  }

  console.log('\n=== 测试 Nano Banana Pro ===');
  try {
    const response2 = await openrouter.chat.completions.create({
      model: 'google/gemini-3-pro-image-preview',
      messages: [
        {
          role: 'user',
          content: 'A beautiful sunset over the ocean',
        },
      ],
    });
    console.log('Pro 响应:', JSON.stringify(response2, null, 2));
    console.log('Content:', response2.choices?.[0]?.message?.content);
  } catch (error) {
    console.error('Pro 错误:', error.message);
    if (error.response) {
      console.error('错误详情:', error.response.data);
    }
  }
}

testImageGeneration();
