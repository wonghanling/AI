'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase-client';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Loader2, CreditCard, ArrowLeft } from 'lucide-react';

interface Order {
  id: string;
  order_no: string;
  user_id: string;
  plan_type: string;
  amount: number;
  status: string;
  payment_method: string;
  trade_no?: string;
  created_at: string;
  paid_at?: string;
  expires_at?: string;
}

function OrdersContent() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      router.push('/auth/login');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth/login');
      return;
    }

    setUser(user);
    fetchOrders(user.id);
  };

  const fetchOrders = async (userId: string) => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('payment_orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(data || []);
    } catch (error) {
      console.error('获取订单失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '待支付';
      case 'paid':
        return '已支付';
      case 'cancelled':
        return '已取消';
      case 'refunded':
        return '已退款';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'paid':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'cancelled':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      case 'refunded':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPlanName = (planType: string) => {
    switch (planType) {
      case 'free':
        return '免费版';
      case 'pro':
        return '专业版';
      default:
        return planType;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-[#F5C518] mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 导航栏 */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-gray-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <ArrowLeft size={20} />
              <span className="text-sm font-medium">返回首页</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="BoLuoing"
              width={32}
              height={32}
              className="object-contain"
            />
            <span className="font-bold text-xl tracking-tight">BoLuoing</span>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <div className="pt-24 pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <CreditCard size={32} className="text-[#F5C518]" />
            <h1 className="text-3xl font-bold">我的订单</h1>
          </div>

          {orders.length === 0 ? (
            <div className="bg-gray-50 rounded-2xl p-12 text-center border border-gray-200">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard size={32} className="text-gray-400" />
              </div>
              <p className="text-lg text-gray-600 mb-6">您还没有订单</p>
              <Link
                href="/#pricing"
                className="inline-block bg-[#F5C518] hover:bg-[#E6B800] text-black px-8 py-3 rounded-full text-sm font-bold transition-all shadow-sm"
              >
                查看订阅计划
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                  {/* 订单头部 */}
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">订单号</p>
                        <p className="font-mono font-bold text-sm">{order.order_no}</p>
                      </div>
                      <div className={`px-4 py-2 rounded-full border font-bold text-sm ${getStatusColor(order.status)}`}>
                        {getStatusText(order.status)}
                      </div>
                    </div>
                  </div>

                  {/* 订单内容 */}
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold mb-2">{getPlanName(order.plan_type)}</h3>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p>下单时间: {new Date(order.created_at).toLocaleString('zh-CN')}</p>
                          {order.paid_at && (
                            <p>支付时间: {new Date(order.paid_at).toLocaleString('zh-CN')}</p>
                          )}
                          {order.expires_at && (
                            <p>到期时间: {new Date(order.expires_at).toLocaleString('zh-CN')}</p>
                          )}
                          {order.trade_no && (
                            <p>交易号: {order.trade_no}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500 mb-1">订单金额</p>
                        <p className="text-2xl font-bold text-[#F5C518]">
                          ¥{order.amount.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* 待支付订单显示继续支付按钮 */}
                    {order.status === 'pending' && (
                      <div className="pt-4 border-t border-gray-200">
                        <button
                          onClick={() => router.push(`/payment?plan=${order.plan_type}`)}
                          className="w-full bg-[#F5C518] hover:bg-[#E6B800] text-black py-3 rounded-full text-sm font-bold transition-all"
                        >
                          继续支付
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return <OrdersContent />;
}
