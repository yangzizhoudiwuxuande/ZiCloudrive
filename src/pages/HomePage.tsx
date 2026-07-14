import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getAllPlans, updateStudentVerification } from '@/db/api';
import type { Plan } from '@/db/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Check, Cloud, Zap, Smartphone, Trophy, Clock, GraduationCap } from 'lucide-react';

const WECHAT_PAY_QR_URL = 'https://miaoda-conversation-file.cdn.bcebos.com/user-8j8q3w6q73ls/app-a9b1seyljuv5/20260710/20260314_123644000_iOS.jpg';
// 微信小程序码图片地址（替换为真实小程序码）
const MINIPROGRAM_QR_URL = 'https://miaoda-conversation-file.cdn.bcebos.com/user-8j8q3w6q73ls/app-a9b1seyljuv5/20260711/秒哒-无代码应用搭建平台，一句话做应用.png';

export default function HomePage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const isStudentVerified = profile?.is_student_verified === true;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    const data = await getAllPlans();
    setPlans(data);
    setLoading(false);
  };

  // 计算学生优惠价：已认证学生且为付费套餐时打八折
  const getStudentPrice = (plan: Plan) => {
    if (plan.is_free || !isStudentVerified) return plan.price_monthly;
    return Math.round(plan.price_monthly * 0.8 * 100) / 100;
  };

  const handlePurchase = (plan: Plan) => {
    if (!user) {
      toast.error('请先登录');
      navigate('/login', { state: { from: '/' } });
      return;
    }
    if (plan.is_free) return;
    setPendingPlan(plan);
    setSelectedPlan(plan);
    // 如果已是学生认证，直接进入支付；否则先弹窗认证
    if (isStudentVerified) {
      setPayDialogOpen(true);
    } else {
      setBirthDate(profile?.birth_date ? (profile.birth_date as string).split('T')[0] : '');
      setStudentDialogOpen(true);
    }
  };

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
      toast.success('学生身份认证成功，已为您打八折');
      setStudentDialogOpen(false);
      setPayDialogOpen(true);
      // 刷新用户 profile
      void refreshProfile();
    } else {
      toast.error('认证失败，请稍后重试');
    }
  };

  // 将字节转为智能单位（KB/MB/GB/TB）
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    if (bytes < 1024 * 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    return `${(bytes / 1024 / 1024 / 1024 / 1024).toFixed(2)} TB`;
  };

  const formatStorage = (gb: number) => {
    if (gb >= 1024) {
      return `${gb / 1024}TB`;
    }
    return `${gb}GB`;
  };

  // 根据套餐容量返回单文件上传上限描述
  const getMaxUploadLabel = (storageGb: number) => {
    if (storageGb <= 20) return '10MB';
    if (storageGb <= 2048) return '200MB';
    if (storageGb <= 24576) return '1GB';
    return '5GB';
  };

  // 根据套餐计算回收站保留天数（null = 永久）
  const getTrashRetentionLabel = (plan: Plan) => {
    if (plan.is_free) return '回收站保留 90 天';
    const gb = Number(plan.storage_gb);
    if (gb <= 500) return '回收站保留 240 天';
    if (gb <= 10240) return '回收站保留 365 天';
    return '回收站永久保留';
  };

  const formatPrice = (price: number) => {
    return price === 0 ? '免费' : `¥${price}/月`;
  };

  const formatStudentPrice = (plan: Plan): React.ReactNode => {
    const studentPrice = getStudentPrice(plan);
    if (plan.is_free) return formatPrice(plan.price_monthly);
    if (studentPrice < plan.price_monthly) {
      return (
        <span className="inline-flex items-baseline gap-2">
          <span className="text-2xl font-bold">¥{studentPrice}/月</span>
          <span className="text-sm text-muted-foreground line-through">¥{plan.price_monthly}/月</span>
        </span>
      );
    }
    return <span className="text-2xl font-bold">{formatPrice(plan.price_monthly)}</span>;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="mb-12 text-center">
        <div className="mb-4 flex justify-center">
          <Cloud className="h-16 w-16 text-primary" />
        </div>
        <h1 className="mb-4 text-4xl font-bold">{"ZiCloudrive服务"}</h1>
        <p className="text-lg text-muted-foreground">
          安全可靠的云存储解决方案，支持多种文件类型，随时随地访问您的文件
        </p>
      </div>
      {/* 用户当前套餐信息 */}
      {user && profile && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>当前套餐</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">已使用</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatBytes(Number(profile.storage_used))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-0.5">总容量</p>
                  <p className="text-2xl font-bold">
                    {formatBytes(Number(profile.storage_limit))}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {/* 套餐列表 */}
      <div className="mb-8">
        <h2 className="mb-6 text-center text-2xl font-bold">选择适合您的套餐</h2>
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="mb-2 h-6 w-24 bg-muted" />
                  <Skeleton className="h-8 w-32 bg-muted" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="mb-4 h-20 w-full bg-muted" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full bg-muted" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <Card key={plan.id} className={plan.is_free ? 'border-primary' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{plan.name}</CardTitle>
                    <div className="flex items-center gap-1.5">
                      {plan.is_free && <Badge variant="secondary">免费</Badge>}
                      {!plan.is_free && isStudentVerified && (
                        <Badge className="bg-primary text-primary-foreground hover:bg-primary/90">
                          <GraduationCap className="h-3 w-3 mr-0.5" /> 学生 8 折
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription className="text-2xl font-bold">
                    {formatStudentPrice(plan)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="text-sm">{formatStorage(plan.storage_gb)} 存储空间</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="text-sm">单文件最大 {getMaxUploadLabel(plan.storage_gb)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="text-sm">支持所有文件类型</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="text-sm">文件分享功能</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="text-sm">{getTrashRetentionLabel(plan)}</span>
                    </div>
                    {!plan.is_free && (
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        <span className="text-sm">按月自动续费</span>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  {plan.is_free ? (
                    <Button variant="outline" className="w-full" asChild>
                      <span>默认套餐</span>
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => handlePurchase(plan)}
                    >
                      立即购买
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
      {/* 微信支付弹窗 */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">扫码支付</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {selectedPlan && (
              <div className="w-full rounded-lg bg-muted px-4 py-3 text-center">
                <p className="text-sm text-muted-foreground">套餐</p>
                <p className="font-semibold">{selectedPlan.name}</p>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-xl font-bold text-primary">¥{getStudentPrice(selectedPlan)} / 月</p>
                  {getStudentPrice(selectedPlan) < selectedPlan.price_monthly && (
                    <p className="text-sm text-muted-foreground line-through">¥{selectedPlan.price_monthly} / 月</p>
                  )}
                </div>
                {isStudentVerified && (
                  <p className="mt-1 text-xs text-primary">
                    <GraduationCap className="inline h-3 w-3" /> 学生认证已通过，享受 8 折优惠
                  </p>
                )}
              </div>
            )}
            <img
              src={WECHAT_PAY_QR_URL}
              alt="微信收款码"
              className="w-64 rounded-xl"
            />
            <p className="text-center text-sm text-muted-foreground">{"请用微信扫描上方二维码完成支付"}</p>
          </div>
        </DialogContent>
      </Dialog>
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
              <Label htmlFor="birth-date">出生日期</Label>
              <Input
                id="birth-date"
                type="date"
                required
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <Button type="submit" className="w-full" disabled={verifying}>
              {verifying ? '认证中...' : '立即认证并购买'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setStudentDialogOpen(false);
                if (pendingPlan) {
                  setPayDialogOpen(true);
                }
              }}
            >
              跳过，以原价购买
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {/* 功能介绍 */}      <div className="mt-16">
                      <h2 className="mb-8 text-center text-2xl font-bold">核心功能</h2>
                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              📄 文档管理
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              支持各类文档格式，轻松管理您的工作文件
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              🖼️ 图片存储
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              安全存储您的照片和图片，随时查看和分享
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              🎬 视频托管
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              上传和管理视频文件，支持在线预览
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              🎵 音频文件
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              存储音乐和音频文件，打造您的云端音乐库
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
      {/* 网盘横向对比 */}
      <div className="mt-16">
        <h2 className="mb-2 text-center text-2xl font-bold">为什么选择 ZiCloudrive？</h2>
        <p className="mb-8 text-center text-sm text-muted-foreground">与主流网盘全面对比，优势一目了然</p>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[1200px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap">对比维度</th>
                <th className="px-4 py-3 text-center font-semibold whitespace-nowrap bg-primary/10 text-primary border-x border-primary/20">
                  <div className="flex items-center justify-center gap-1.5">
                    <Trophy className="h-4 w-4" />
                    ZiCloudrive
                  </div>
                </th>
                {['Onedrive', 'Google Drive', 'iCloud', '百度网盘', '迅雷', '夸克网盘', '腾讯微云', 'Dropbox', '阿里云盘', '115网盘'].map((name) => (
                  <th key={name} className="px-4 py-3 text-center font-semibold text-muted-foreground whitespace-nowrap">{name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* 免费空间 */}
              <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium whitespace-nowrap">免费空间</td>
                <td className="px-4 py-3 text-center bg-primary/5 border-x border-primary/20">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    <Check className="h-3 w-3" /> 20GB
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground">5GB</td>
                <td className="px-4 py-3 text-center text-muted-foreground">15GB</td>
                <td className="px-4 py-3 text-center text-muted-foreground">5GB</td>
                <td className="px-4 py-3 text-center text-muted-foreground">约10GB</td>
                <td className="px-4 py-3 text-center text-muted-foreground">10GB</td>
                <td className="px-4 py-3 text-center text-muted-foreground">10GB</td>
                <td className="px-4 py-3 text-center text-muted-foreground">10GB</td>
                <td className="px-4 py-3 text-center text-muted-foreground">2GB</td>
                <td className="px-4 py-3 text-center text-muted-foreground">100GB</td>
                <td className="px-4 py-3 text-center text-muted-foreground">约15GB</td>
              </tr>
              {/* 限速情况 */}
              <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium whitespace-nowrap">限速情况</td>
                <td className="px-4 py-3 text-center bg-primary/5 border-x border-primary/20">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    <Zap className="h-3 w-3" /> 不限速
                  </span>
                </td>
                {['不限速', '不限速', '不限速'].map((v, i) => (
                  <td key={i} className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">{v}</span>
                  </td>
                ))}
                <td className="px-4 py-3 text-center"><span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">严重限速</span></td>
                <td className="px-4 py-3 text-center"><span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">限速</span></td>
                <td className="px-4 py-3 text-center"><span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">超级限速</span></td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">轻微限速</td>
                {['不限速', '不限速'].map((v, i) => (
                  <td key={i} className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">{v}</span>
                  </td>
                ))}
                <td className="px-4 py-3 text-center"><span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">严重限速</span></td>
              </tr>
              {/* 网页版 */}
              <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium whitespace-nowrap">网页版体验</td>
                <td className="px-4 py-3 text-center bg-primary/5 border-x border-primary/20">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    <Check className="h-3 w-3" /> 非常好
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-xs text-muted-foreground leading-snug">
                  <span className="block">非常好</span><span className="text-destructive/70">（大陆无法使用）</span>
                </td>
                <td className="px-4 py-3 text-center text-xs text-muted-foreground leading-snug">
                  <span className="block">非常好</span><span className="text-destructive/70">（大陆无法使用）</span>
                </td>
                <td className="px-4 py-3 text-center text-xs text-muted-foreground leading-snug">
                  <span className="block">好</span><span className="opacity-60">（云上贵州运营）</span>
                </td>
                <td className="px-4 py-3 text-center"><span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">不好</span></td>
                <td className="px-4 py-3 text-center"><span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">差</span></td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">一般</td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">好</td>
                <td className="px-4 py-3 text-center text-xs text-muted-foreground leading-snug">
                  <span className="block">好</span><span className="text-destructive/70">（大陆无法使用）</span>
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">好</td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">好</td>
              </tr>
              {/* 文件分享与获得 */}
              <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium whitespace-nowrap">文件分享与获得</td>
                <td className="px-4 py-3 text-center bg-primary/5 border-x border-primary/20">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    <Check className="h-3 w-3" /> 非常好
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-xs text-muted-foreground leading-snug">
                  <span className="block">好</span><span className="text-destructive/70">（大陆无法使用）</span>
                </td>
                <td className="px-4 py-3 text-center text-xs text-muted-foreground leading-snug">
                  <span className="block">非常好</span><span className="text-destructive/70">（大陆无法使用）</span>
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">好</td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">好</td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">较好</td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">较好</td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">较好</td>
                <td className="px-4 py-3 text-center text-xs text-muted-foreground leading-snug">
                  <span className="block">好</span><span className="text-destructive/70">（大陆无法使用）</span>
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">较好</td>
                <td className="px-4 py-3 text-center"><span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">差</span></td>
              </tr>
              {/* 广告 */}
              <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium whitespace-nowrap">广告</td>
                <td className="px-4 py-3 text-center bg-primary/5 border-x border-primary/20">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    <Check className="h-3 w-3" /> 无
                  </span>
                </td>
                {['无', '无', '无'].map((v, i) => (
                  <td key={i} className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">{v}</span>
                  </td>
                ))}
                <td className="px-4 py-3 text-center"><span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">较多</span></td>
                <td className="px-4 py-3 text-center"><span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">有</span></td>
                <td className="px-4 py-3 text-center text-xs text-muted-foreground">网页版有</td>
                <td className="px-4 py-3 text-center"><span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">有</span></td>
                {['无', '无', '无'].map((v, i) => (
                  <td key={i} className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">{v}</span>
                  </td>
                ))}
              </tr>
              {/* 会员空间 */}
              <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium whitespace-nowrap">会员空间上限</td>
                <td className="px-4 py-3 text-center bg-primary/5 border-x border-primary/20">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    <Trophy className="h-3 w-3" /> 1,000,000,000,000,000,000 TB
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">最高 1TB</td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">最高 30TB</td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">最高 12TB</td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">最高 30TB</td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">最高 30TB</td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">最高 6TB</td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">最高 8TB</td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">最高 2TB</td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">最高 20TB</td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">最高 5000TB</td>
              </tr>
              {/* 免费回收站文件保留时间 */}
              <tr className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium whitespace-nowrap">免费回收站保留</td>
                <td className="px-4 py-3 text-center bg-primary/5 border-x border-primary/20">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    <Clock className="h-3 w-3" /> 90天
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">30天</td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">30天</td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">30天</td>
                <td className="px-4 py-3 text-center"><span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">10天</span></td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">30天</td>
                <td className="px-4 py-3 text-center"><span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">10天</span></td>
                <td className="px-4 py-3 text-center"><span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">7天</span></td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">30天</td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">90天</span>
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">30天</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 小程序入口 Banner */}
      <div className="mt-12 rounded-2xl bg-gradient-to-r from-[#07C160]/10 to-[#07C160]/5 border border-[#07C160]/20 p-8">
        <div className="flex flex-col items-center gap-6 md:flex-row md:gap-8">
          <div className="flex-1 text-center md:text-left">
            <div className="mb-2 flex items-center justify-center gap-2 md:justify-start">
              <Smartphone className="h-5 w-5 text-[#07C160]" />
              <span className="text-sm font-medium text-[#07C160]">微信小程序</span>
            </div>
            <h3 className="mb-2 text-xl font-bold">随时随地，管理你的云盘</h3>
            <p className="text-sm text-muted-foreground">
              使用微信扫描右侧小程序码，在手机端轻松上传、查看、分享文件，与网页端数据实时同步。
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3 md:justify-start">
              <span className="rounded-full bg-[#07C160]/10 px-3 py-1 text-xs text-[#07C160]">文件管理</span>
              <span className="rounded-full bg-[#07C160]/10 px-3 py-1 text-xs text-[#07C160]">在线预览</span>
              <span className="rounded-full bg-[#07C160]/10 px-3 py-1 text-xs text-[#07C160]">一键分享</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-2">
            {MINIPROGRAM_QR_URL ? (
              <img src={MINIPROGRAM_QR_URL} alt="小程序码" className="h-36 w-36 rounded-xl shadow-md" />
            ) : (
              <div className="flex h-36 w-36 items-center justify-center rounded-xl border-2 border-dashed border-[#07C160]/30 bg-white/50">
                <div className="text-center">
                  <Smartphone className="mx-auto mb-1.5 h-8 w-8 text-[#07C160] opacity-40" />
                  <p className="text-xs text-muted-foreground">小程序码</p>
                  <p className="text-xs text-muted-foreground">（待配置）</p>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">微信扫一扫</p>
          </div>
        </div>
      </div>
    </div>
  );
}
