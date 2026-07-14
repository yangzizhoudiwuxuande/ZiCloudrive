import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrderByNo } from '@/db/api';
import type { Order } from '@/db/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import QRCodeDataUrl from '@/components/ui/qrcodedataurl';
import { ArrowLeft, CheckCircle, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function OrderDetailPage() {
  const { orderNo } = useParams<{ orderNo: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (orderNo) {
      loadOrder();
    }
  }, [orderNo]);

  useEffect(() => {
    if (order?.status === 'pending') {
      setPolling(true);
      const interval = setInterval(() => {
        loadOrder(true);
      }, 2000);

      return () => {
        clearInterval(interval);
        setPolling(false);
      };
    }
  }, [order?.status]);

  const loadOrder = async (silent = false) => {
    if (!orderNo) return;

    if (!silent) setLoading(true);
    const data = await getOrderByNo(orderNo);
    setOrder(data);
    if (!silent) setLoading(false);

    // 如果订单状态变为已支付，显示提示
    if (data?.status === 'paid' && polling) {
      toast.success('支付成功！');
      setPolling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />待支付</Badge>;
      case 'paid':
        return <Badge className="gap-1 bg-green-500"><CheckCircle className="h-3 w-3" />已支付</Badge>;
      case 'cancelled':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />已取消</Badge>;
      case 'refunded':
        return <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" />已退款</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatStorage = (gb: number) => {
    if (gb >= 1024) {
      return `${gb / 1024}TB`;
    }
    return `${gb}GB`;
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Skeleton className="mb-4 h-8 w-48 bg-muted" />
        <Card>
          <CardHeader>
            <Skeleton className="mb-2 h-6 w-32 bg-muted" />
            <Skeleton className="h-4 w-48 bg-muted" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full bg-muted" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>订单不存在</CardTitle>
            <CardDescription>未找到该订单信息</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')}>返回首页</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 gap-2">
        <ArrowLeft className="h-4 w-4" />
        返回
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>订单详情</CardTitle>
            {getStatusBadge(order.status)}
          </div>
          <CardDescription>订单号: {order.order_no}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 订单信息 */}
          <div className="space-y-2">
            <h3 className="font-semibold">套餐信息</h3>
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{order.plan_snapshot.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatStorage(order.plan_snapshot.storage_gb)} 存储空间
                  </p>
                </div>
                <p className="text-xl font-bold">¥{order.total_amount}</p>
              </div>
            </div>
          </div>

          {/* 支付二维码 */}
          {order.status === 'pending' && order.wechat_pay_url && (
            <div className="space-y-2">
              <h3 className="font-semibold">微信支付</h3>
              <div className="flex flex-col items-center rounded-lg border border-border p-6">
                <QRCodeDataUrl text={order.wechat_pay_url} width={200} />
                <p className="mt-4 text-sm text-muted-foreground">请使用微信扫码支付</p>
                <p className="text-xs text-muted-foreground">支付完成后将自动跳转</p>
              </div>
            </div>
          )}

          {/* 已支付状态 */}
          {order.status === 'paid' && (
            <div className="rounded-lg border border-green-500 bg-green-50 p-4 dark:bg-green-950">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle className="h-5 w-5" />
                <div>
                  <p className="font-semibold">支付成功</p>
                  <p className="text-sm">您的套餐已激活，可以开始使用了</p>
                </div>
              </div>
              <Button onClick={() => navigate('/files')} className="mt-4 w-full">
                前往我的文件
              </Button>
            </div>
          )}

          {/* 订单时间 */}
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>创建时间: {new Date(order.created_at).toLocaleString('zh-CN')}</p>
            <p>更新时间: {new Date(order.updated_at).toLocaleString('zh-CN')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
