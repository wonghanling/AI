'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MODEL_MAP, ModelKey } from '@/lib/model-config';
import { getSupabaseClient } from '@/lib/supabase-client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string; // 改为 string 以便 JSON 序列化
}

function ChatPageContent() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<ModelKey>('gpt-5.2');
  const [loading, setLoading] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [quota, setQuota] = useState({ advanced: 3, basic: 10 });
  const [userType, setUserType] = useState<'free' | 'premium'>('free');
  const [error, setError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false); // 移动端侧边栏控制
  const [userId, setUserId] = useState<string | null>(null); // 添加用户 ID 状态
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 获取配额信息
  const fetchQuota = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/user/quota', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserType(data.user_type);

        if (data.user_type === 'free') {
          setQuota({
            advanced: data.advanced.remaining,
            basic: data.basic.remaining,
          });
        } else {
          // 付费用户显示每小时剩余次数
          setQuota({
            advanced: data.rate_limits.per_hour.remaining,
            basic: data.rate_limits.per_hour.remaining,
          });
        }
      }
    } catch (error) {
      console.error('获取配额失败:', error);
    }
  }, []);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 页面加载时获取配额和恢复对话历史
  useEffect(() => {
    const initUser = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);

        // 从 localStorage 恢复对话历史（使用用户 ID 作为 key）
        const savedConversations = localStorage.getItem(`conversations_${user.id}`);
        const savedCurrentId = localStorage.getItem(`currentConversationId_${user.id}`);

        if (savedConversations) {
          try {
            const parsed = JSON.parse(savedConversations);
            setConversations(parsed);

            if (savedCurrentId && parsed.find((c: Conversation) => c.id === savedCurrentId)) {
              setCurrentConversationId(savedCurrentId);
              const currentConv = parsed.find((c: Conversation) => c.id === savedCurrentId);
              if (currentConv) {
                setMessages(currentConv.messages);
              }
            }
          } catch (e) {
            console.error('恢复对话历史失败:', e);
          }
        }
      }
    };

    fetchQuota();
    initUser();
  }, [fetchQuota]);

  // 保存对话历史到 localStorage（使用用户 ID）
  useEffect(() => {
    if (conversations.length > 0 && userId) {
      localStorage.setItem(`conversations_${userId}`, JSON.stringify(conversations));
    }
  }, [conversations, userId]);

  // 保存当前对话 ID（使用用户 ID）
  useEffect(() => {
    if (currentConversationId && userId) {
      localStorage.setItem(`currentConversationId_${userId}`, currentConversationId);
    }
  }, [currentConversationId, userId]);

  // 自动调整输入框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  // 创建新对话
  const createNewConversation = useCallback(() => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [],
      createdAt: new Date().toISOString(),
    };
    setConversations(prev => [newConv, ...prev]);
    setCurrentConversationId(newConv.id);
    setMessages([]);
  }, []);

  // 删除对话
  const deleteConversation = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations(prev => {
      const updatedConversations = prev.filter(conv => conv.id !== id);

      if (currentConversationId === id) {
        if (updatedConversations.length > 0) {
          setCurrentConversationId(updatedConversations[0].id);
          setMessages(updatedConversations[0].messages);
        } else {
          setCurrentConversationId(null);
          setMessages([]);
        }
      }

      return updatedConversations;
    });
  }, [currentConversationId]);

  // 发送消息
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    setError(null); // 清除之前的错误
    const userMessage: Message = { role: 'user', content: input.trim(), model: selectedModel };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      // 获取 Supabase session token
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('无法连接到认证服务');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('请先登录');
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          model_key: selectedModel,
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '请求失败');
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let usedModel = selectedModel;

      // 添加空的助手消息
      setMessages(prev => [...prev, { role: 'assistant', content: '', model: selectedModel }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);

              // 处理元数据（模型信息）
              if (parsed.type === 'metadata') {
                usedModel = parsed.data.used_model;
                // 如果发生了降级，显示提示
                if (parsed.data.fallback) {
                  console.log(`模型已自动降级到: ${parsed.data.display_name}`);
                }
              }

              // 处理内容
              if (parsed.type === 'content' && parsed.data) {
                assistantMessage += parsed.data;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1].content = assistantMessage;
                  newMessages[newMessages.length - 1].model = usedModel;
                  return newMessages;
                });
              }

              // 处理使用统计
              if (parsed.type === 'usage') {
                console.log('Token 使用:', parsed.data);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      // 更新对话标题和消息（使用第一条消息）
      const finalMessages = [...newMessages, { role: 'assistant' as const, content: assistantMessage, model: usedModel }];
      setMessages(finalMessages);

      if (currentConversationId) {
        setConversations(prev =>
          prev.map(conv =>
            conv.id === currentConversationId
              ? {
                  ...conv,
                  title: conv.title === '新对话' ? userMessage.content.slice(0, 30) + (userMessage.content.length > 30 ? '...' : '') : conv.title,
                  messages: finalMessages
                }
              : conv
          )
        );
      } else {
        // 如果没有当前对话，创建一个新对话
        const newConv: Conversation = {
          id: Date.now().toString(),
          title: userMessage.content.slice(0, 30) + (userMessage.content.length > 30 ? '...' : ''),
          messages: finalMessages,
          createdAt: new Date().toISOString(),
        };
        setConversations(prev => [newConv, ...prev]);
        setCurrentConversationId(newConv.id);
      }

      // 刷新配额
      fetchQuota();
    } catch (error: any) {
      console.error('发送消息失败:', error);
      setError(error.message || '发送失败，请重试');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  // 获取模型信息
  const getModelInfo = useCallback((modelKey: ModelKey) => MODEL_MAP[modelKey], []);

  // 高级模型列表 - 更新为云雾API的12个高级模型
  const advancedModels: ModelKey[] = useMemo(() => [
    'gpt-5.2',
    'gpt-5.1-2025-11-13',
    'gpt-5.1-thinking-all',
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-flash-all',
    'gemini-2.5-pro-all',
    'claude-3-5-haiku-20241022',
    'claude-3-sonnet-all',
    'grok-4.1',
    'grok-4',
    'gpt-5.1-chat',
  ], []);
  // 普通模型列表 - 待用户提供
  const basicModels: ModelKey[] = useMemo(() => [], []);

  const currentModelInfo = useMemo(() => getModelInfo(selectedModel), [selectedModel, getModelInfo]);
  const isAdvancedModel = useMemo(() => currentModelInfo.tier === 'advanced', [currentModelInfo]);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* 移动端遮罩层 */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* 左侧边栏 - 移动端可滑出 */}
      <div className={`
        fixed md:relative
        w-64 bg-[#0D0D0D] text-white flex flex-col
        h-full z-50
        transform transition-transform duration-300 ease-in-out
        ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-800">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="BoLuoing" width={32} height={32} />
            <span className="font-semibold text-lg">BoLuoing</span>
          </Link>
        </div>

        {/* 新对话按钮 */}
        <div className="p-4">
          <button
            onClick={createNewConversation}
            className="w-full px-4 py-2.5 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新对话
          </button>
        </div>

        {/* 对话历史 */}
        <div className="flex-1 overflow-y-auto px-2">
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`group relative mb-1 rounded-lg hover:bg-gray-800 transition-colors ${
                currentConversationId === conv.id ? 'bg-gray-800' : ''
              }`}
            >
              <button
                onClick={() => {
                  setCurrentConversationId(conv.id);
                  setMessages(conv.messages);
                  setShowSidebar(false); // 移动端点击后关闭侧边栏
                }}
                className="w-full text-left px-3 py-2.5"
              >
                <p className="text-sm truncate pr-6">{conv.title}</p>
              </button>
              <button
                onClick={(e) => deleteConversation(conv.id, e)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-700 rounded transition-opacity"
                title="删除对话"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* 底部导航 */}
        <div className="border-t border-gray-800">
          <Link
            href="/image"
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm">图片生成</span>
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-sm">个人中心</span>
          </Link>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部栏 */}
        <div className="h-14 border-b border-gray-200 flex items-center justify-between px-4 md:px-6">
          {/* 移动端汉堡菜单 */}
          <button
            onClick={() => setShowSidebar(true)}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-3">
            {/* 模型选择器 */}
            <div className="relative">
              <button
                onClick={() => setShowModelSelector(!showModelSelector)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:border-gray-400 transition-colors"
              >
                <span className="font-medium">{currentModelInfo.displayName}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 模型选择下拉菜单 */}
              {showModelSelector && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                  <div className="p-3 border-b border-gray-200">
                    <h3 className="font-semibold text-sm text-gray-900">选择模型</h3>
                  </div>

                  {/* 高级模型 */}
                  <div className="p-3 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-gray-500">高级模型</p>
                      <span className="text-xs text-gray-400">
                        {userType === 'free' ? `剩余 ${quota.advanced} 次/天` : `剩余 ${quota.advanced} 次/小时`}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {advancedModels.map(modelKey => {
                        const model = getModelInfo(modelKey);
                        return (
                          <button
                            key={modelKey}
                            onClick={() => {
                              setSelectedModel(modelKey);
                              setShowModelSelector(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors ${
                              selectedModel === modelKey ? 'bg-gray-100' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm">{model.displayName}</p>
                              <div className="flex gap-1">
                                {model.capabilities?.includes('vision') && (
                                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded" title="识图">👁️</span>
                                )}
                                {model.capabilities?.includes('thinking') && (
                                  <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded" title="思考">🧠</span>
                                )}
                                {model.capabilities?.includes('internet') && (
                                  <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded" title="联网">🌐</span>
                                )}
                                {model.capabilities?.includes('coding') && (
                                  <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded" title="编程">💻</span>
                                )}
                              </div>
                            </div>
                            {model.description && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{model.description}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 普通模型 */}
                  {basicModels.length > 0 && (
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-gray-500">普通模型</p>
                        <span className="text-xs text-gray-400">
                          {userType === 'free' ? `剩余 ${quota.basic} 次/天` : `剩余 ${quota.basic} 次/小时`}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {basicModels.map(modelKey => {
                          const model = getModelInfo(modelKey);
                          return (
                            <button
                              key={modelKey}
                              onClick={() => {
                                setSelectedModel(modelKey);
                                setShowModelSelector(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors ${
                                selectedModel === modelKey ? 'bg-gray-100' : ''
                              }`}
                            >
                              <p className="font-medium text-sm">{model.displayName}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 模型标签 */}
            <span className={`text-xs px-2 py-1 rounded ${
              isAdvancedModel ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {isAdvancedModel ? '高级' : '普通'}
            </span>
          </div>

          {/* 配额显示 - 移动端简化 */}
          <div className="text-sm text-gray-600">
            {userType === 'free' ? (
              <span className="hidden sm:inline">今日剩余: {isAdvancedModel ? quota.advanced : quota.basic} 次</span>
            ) : (
              <span className="hidden sm:inline">本小时剩余: {isAdvancedModel ? quota.advanced : quota.basic} 次</span>
            )}
            <span className="sm:hidden">{isAdvancedModel ? quota.advanced : quota.basic}</span>
          </div>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-2xl px-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">开始新对话</h2>
                <p className="text-gray-500 mb-6">选择一个模型，输入你的问题开始对话</p>

                {/* 示例问题 */}
                <div className="grid grid-cols-2 gap-3 max-w-xl mx-auto">
                  {[
                    '帮我写一篇关于 AI 的文章',
                    '解释量子计算的原理',
                    '推荐一些学习编程的资源',
                    '如何提高工作效率？',
                  ].map((example, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInput(example)}
                      className="px-4 py-3 text-left text-sm border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6">
              {messages.map((msg, idx) => (
                <div key={idx} className="mb-8">
                  {msg.role === 'user' ? (
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-gray-900 whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-[#F5C518] flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {msg.model && msg.model in MODEL_MAP
                              ? getModelInfo(msg.model as ModelKey).displayName
                              : currentModelInfo.displayName}
                          </span>
                        </div>
                        <div className="text-gray-900 prose prose-sm max-w-none">
                          {msg.content ? (
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code({ node, className, children, ...props }: any) {
                                  const isInline = !className;
                                  return isInline ? (
                                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                                      {children}
                                    </code>
                                  ) : (
                                    <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono" {...props}>
                                      {children}
                                    </code>
                                  );
                                },
                                pre({ children }) {
                                  return <div className="my-2">{children}</div>;
                                },
                                p({ children }) {
                                  return <p className="mb-2 last:mb-0">{children}</p>;
                                },
                                ul({ children }) {
                                  return <ul className="list-disc list-inside mb-2">{children}</ul>;
                                },
                                ol({ children }) {
                                  return <ol className="list-decimal list-inside mb-2">{children}</ol>;
                                },
                                a({ href, children }) {
                                  return (
                                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                      {children}
                                    </a>
                                  );
                                },
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-gray-400">
                              <span className="animate-pulse">●</span>
                              <span className="animate-pulse delay-100">●</span>
                              <span className="animate-pulse delay-200">●</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 输入区域 */}
        <div className="border-t border-gray-200 bg-white safe-area-bottom">
          {/* 错误提示 */}
          {error && (
            <div className="max-w-3xl mx-auto px-4 pt-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-500 hover:text-red-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="max-w-3xl mx-auto px-3 md:px-4 py-3 md:py-4">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="输入消息... (Shift + Enter 换行)"
                className="w-full px-3 md:px-4 py-3 md:py-3 pr-12 md:pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none max-h-40 text-base"
                rows={1}
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="absolute right-2 bottom-2 p-2 md:p-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors touch-manipulation"
              >
                {loading ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              BoLuoing 可能会出错。请核查重要信息。
            </p>
          </div>
        </div>
      </div>

      {/* 点击外部关闭模型选择器 */}
      {showModelSelector && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowModelSelector(false)}
        />
      )}
    </div>
  );
}

export default function ChatPage() {
  return <ChatPageContent />;
}
