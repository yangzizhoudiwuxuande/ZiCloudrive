import { useEffect, useState } from 'react';
import { getAllProfiles, updateUserRole, getAllOrders, addUserStorage } from '@/db/api';
import type { Profile } from '@/types/types';
import type { Order } from '@/db/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, Package, Shield, HardDrive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminPage() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageInputs, setStorageInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [profilesData, ordersData] = await Promise.all([
      getAllProfiles(),
      getAllOrders()
    ]);
    setProfiles(profilesData);
    setOrders(ordersData);
    setLoading(false);
  };

  const handleRoleChange = async (userId: string, newRole: 'user' | 'admin') => {
    const success = await updateUserRole(userId, newRole);
    if (success) {
      toast.success('角色更新成功');
      loadData();
    } else {
      toast.error('角色更新失败');
    }
  };

  const handleAddStorage = async (userId: string) => {
    const gb = parseFloat(storageInputs[userId] || '0');
    if (!gb || gb <= 0) {
      toast.error('请输入有效的 GB 数值');
      return;
    }
    const additionalBytes = Math.round(gb * 1024 * 1024 * 1024);
    const success = await addUserStorage(userId, additionalBytes);
    if (success) {
      toast.success(`已为用户追加 ${gb}GB 存储空间`);
      setStorageInputs(prev => ({ ...prev, [userId]: '' }));
      loadData();
    } else {
      toast.error('追加存储空间失败');
    }
  };

  const formatStorage = (bytes: number) => {
    const gb = bytes / 1024 / 1024 / 1024;
    if (gb >= 1024) {
      return `${(gb / 1024).toFixed(2)} TB`;
    }
    return `${gb.toFixed(2)} GB`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">待支付</Badge>;
      case 'paid':
        return <Badge className="bg-green-500">已支付</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">已取消</Badge>;
      case 'refunded':
        return <Badge variant="outline">已退款</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="mb-6 h-8 w-48 bg-muted" />
        <Skeleton className="h-96 w-full bg-muted" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <Shield className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">管理后台</h1>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            用户管理
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2">
            <Package className="h-4 w-4" />
            订单管理
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>用户列表</CardTitle>
              <CardDescription>管理所有用户的角色和权限</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {profiles.map((profile) => (
                  <div
                    key={profile.id as string}
                    className="flex flex-col gap-4 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <p className="font-medium">{profile.username as string}</p>
                        <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>
                          {profile.role === 'admin' ? '管理员' : '普通用户'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{profile.email as string}</p>
                      <p className="text-xs text-muted-foreground">
                        存储: {formatStorage(profile.storage_used as number)} / {formatStorage(profile.storage_limit as number)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 md:flex-row md:items-center">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="GB"
                          className="w-24"
                          value={storageInputs[profile.id as string] || ''}
                          onChange={(e) => setStorageInputs(prev => ({ ...prev, [profile.id as string]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddStorage(profile.id as string)}
                        >
                          <HardDrive className="mr-1 h-4 w-4" /> 追加空间
                        </Button>
                      </div>
                      <Select
                        value={profile.role as string}
                        onValueChange={(value: 'user' | 'admin') => handleRoleChange(profile.id as string, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">普通用户</SelectItem>
                          <SelectItem value="admin">管理员</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>订单列表</CardTitle>
              <CardDescription>查看所有用户的订单记录</CardDescription>
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
                      key={order.id as string}
                      className="flex cursor-pointer flex-col gap-2 rounded-lg border border-border p-4 transition-colors hover:bg-accent md:flex-row md:items-center md:justify-between"
                      onClick={() => navigate(`/order/${order.order_no as string}`)}
                    >
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <p className="font-medium">{order.plan_snapshot.name as string}</p>
                          {getStatusBadge(order.status as string)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          订单号: {order.order_no as string}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at as string).toLocaleString('zh-CN')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">¥{order.total_amount as number}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
