import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserOrders, getAllPlans, updateStudentVerification } from '@/db/api';
import type { Order, Plan } from '@/db/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle, Clock, XCircle, Package, HardDrive, GraduationCap } from 'lucide-react';

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [birthDate, setBirthDate] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    if (profile?.birth_date) {
      setBirthDate((profile.birth_date as string).split('T')[0]);
    }
  }, [profile?.birth_date]);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    const [ordersData, plansData] = await Promise.all([
      getUserOrders(user.id),
      getAllPlans()
    ]);
    setOrders(ordersData);
    setPlans(plansData);
    setLoading(false);
  };

  const getCurrentPlan = () => {
    if (!profile?.current_plan_id) {
      return plans.find(p => p.is_free);
    }
    return plans.find(p => p.id === profile.current_plan_id);
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

  const formatStorage = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    if (bytes < 1024 * 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    return `${(bytes / 1024 / 1024 / 1024 / 1024).toFixed(2)} TB`;
  };

  const currentPlan = getCurrentPlan();

  // 验证年龄18-24岁
  const validateStudentAge = (dateString: string): boolean => {
    const birth = new Date(dateString);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 18 && age < 24;
  };

  const handleVerifyStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!birthDate) {
      toast.error('请选择出生日期');
      return;
    }
    if (!validateStudentAge(birthDate)) {
      toast.error('学生优惠仅限 18-24 周岁用户使用');
      return;
    }
    if (!user) return;

    setVerifying(true);
    const ok = await updateStudentVerification(user.id, birthDate, true);
    setVerifying(false);

    if (ok) {
      toast.success('学生身份认证成功，购买套餐享受 8 折');
      setStudentDialogOpen(false);
      void refreshProfile();
    } else {
      toast.error('认证失败，请稍后重试');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="mb-6 h-8 w-48 bg-muted" />
        <div className="space-y-6">
          <Skeleton className="h-48 w-full bg-muted" />
          <Skeleton className="h-64 w-full bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">个人中心</h1>

      {/* 用户信息 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>账户信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">用户名</p>
              <p className="font-medium">{profile?.username as string}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">邮箱</p>
              <p className="font-medium">{profile?.email as string}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">角色</p>
              <Badge variant={profile?.role === 'admin' ? 'default' : 'secondary'}>
                {profile?.role === 'admin' ? '管理员' : '普通用户'}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">注册时间</p>
              <p className="font-medium">{profile ? new Date(profile.created_at as string).toLocaleDateString('zh-CN') : '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 学生认证 */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              学生认证
            </CardTitle>
            {profile?.is_student_verified ? (
              <Badge className="bg-primary text-primary-foreground hover:bg-primary/90">已认证 · 8 折优惠</Badge>
            ) : (
              <Badge variant="secondary">未认证</Badge>
            )}
          </div>
          <CardDescription>验证学生身份，付费套餐享受 8 折（18-24 周岁）</CardDescription>
        </CardHeader>
        <CardContent>
          {profile?.is_student_verified ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                生日：{profile?.birth_date ? new Date(profile.birth_date as string).toLocaleDateString('zh-CN') : '-'}
              </p>
              <Button variant="outline" onClick={() => setStudentDialogOpen(true)}>
                重新认证
              </Button>
            </div>
          ) : (
            <Button onClick={() => setStudentDialogOpen(true)}>
              <GraduationCap className="mr-2 h-4 w-4" /> 立即认证学生身份
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 存储空间 */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              存储空间
            </CardTitle>
            <Button variant="outline" onClick={() => navigate('/')}>
              升级套餐
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">当前套餐</span>
              <span className="font-semibold">{currentPlan?.name || '免费套餐'}</span>
            </div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">已使用</span>
              <span className="font-semibold">
                {formatStorage(Number(profile?.storage_used) || 0)} / {formatStorage(Number(profile?.storage_limit) || 0)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 订单历史 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            订单历史
          </CardTitle>
          <CardDescription>查看您的所有订单记录</CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Package className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>暂无订单记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-accent"
                  onClick={() => navigate(`/order/${order.order_no}`)}
                >
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <p className="font-medium">{order.plan_snapshot.name}</p>
                      {getStatusBadge(order.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      订单号: {order.order_no}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">¥{order.total_amount}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 学生认证弹窗 */}
      <Dialog open={studentDialogOpen} onOpenChange={setStudentDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center flex items-center justify-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" /> 学生认证
            </DialogTitle>
            <DialogDescription className="text-center">
              认证后即可享受付费套餐 8 折优惠（18-24 周岁可用）
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleVerifyStudent} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="profile-birth-date">出生日期</Label>
              <Input
                id="profile-birth-date"
                type="date"
                required
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <Button type="submit" className="w-full" disabled={verifying}>
              {verifying ? '认证中...' : '立即认证'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
