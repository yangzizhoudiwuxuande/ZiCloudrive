import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Cloud, Home, FolderOpen, User, Settings, Menu, LogOut, Trash2, Share2, Smartphone } from 'lucide-react';
import { useState } from 'react';

// 微信小程序码图片地址（替换为真实小程序码）
const MINIPROGRAM_QR_URL = 'https://miaoda-conversation-file.cdn.bcebos.com/user-8j8q3w6q73ls/app-a9b1seyljuv5/20260711/秒哒-无代码应用搭建平台，一句话做应用.png';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: '首页', href: '/', icon: Home },
    { name: '我的文件', href: '/files', icon: FolderOpen },
    { name: '回收站', href: '/trash', icon: Trash2 },
    { name: '我的分享', href: '/shares', icon: Share2 },
    { name: '个人中心', href: '/profile', icon: User },
  ];

  if (profile?.role === 'admin') {
    navigation.push({ name: '管理后台', href: '/admin', icon: Settings });
  }

  const isActive = (path: string) => location.pathname === path;

  const NavLinks = () => (
    <>
      {navigation.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.name}
            to={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive(item.href)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <Icon className="h-4 w-4" />
            {item.name}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card">
        <div className="flex h-16 items-center gap-4 px-4 md:px-6">
          {/* 移动端菜单按钮 */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex h-full flex-col">
                <div className="flex h-16 items-center border-b border-border px-6">
                  <Cloud className="h-6 w-6 text-primary" />
                  <span className="ml-2 text-lg font-bold">网盘</span>
                </div>
                <nav className="flex-1 space-y-1 p-4">
                  <NavLinks />
                </nav>
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <Cloud className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">{"ZiCloudrive"}</span>
          </Link>

          <div className="flex-1" />

          {/* 小程序入口 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="hidden gap-1.5 md:flex">
                <Smartphone className="h-4 w-4 text-[#07C160]" />
                <span className="text-sm">小程序</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-4">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-[#07C160]" />
                  <span className="font-semibold text-sm">微信扫码使用小程序</span>
                </div>
                {MINIPROGRAM_QR_URL ? (
                  <img src={MINIPROGRAM_QR_URL} alt="小程序码" className="h-40 w-40 rounded-xl" />
                ) : (
                  <div className="flex h-40 w-40 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40">
                    <div className="text-center">
                      <Smartphone className="mx-auto mb-2 h-8 w-8 text-muted-foreground opacity-40" />
                      <p className="text-xs text-muted-foreground">小程序码</p>
                      <p className="text-xs text-muted-foreground">（待配置）</p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  使用微信扫一扫，随时随地管理您的云盘文件
                </p>
              </div>
            </PopoverContent>
          </Popover>

          {/* 用户菜单 */}
          {user && profile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden md:inline">{profile.username as string}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{profile.username as string}</p>
                    <p className="text-xs text-muted-foreground">{profile.email as string}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    个人中心
                  </Link>
                </DropdownMenuItem>
                {profile.role === 'admin' && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      管理后台
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild>
              <Link to="/login">登录</Link>
            </Button>
          )}
        </div>
      </header>
      {/* 主内容区域 */}
      <div className="flex flex-1">
        {/* 桌面端侧边栏 */}
        {user && (
          <aside className="hidden w-64 border-r border-border bg-card md:block">
            <nav className="space-y-1 p-4">
              <NavLinks />
            </nav>
          </aside>
        )}

        {/* 内容区域 */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
