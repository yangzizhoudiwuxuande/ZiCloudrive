import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import FilesPage from './pages/FilesPage';
import TrashPage from './pages/TrashPage';
import MySharesPage from './pages/MySharesPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import OrderDetailPage from './pages/OrderDetailPage';
import SharePage from './pages/SharePage';
import type { ReactNode } from 'react';

interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
}

const routes: RouteConfig[] = [
  {
    name: '首页',
    path: '/',
    element: <HomePage />
  },
  {
    name: '登录',
    path: '/login',
    element: <LoginPage />
  },
  {
    name: '我的文件',
    path: '/files',
    element: <FilesPage />
  },
  {
    name: '回收站',
    path: '/trash',
    element: <TrashPage />
  },
  {
    name: '我的分享',
    path: '/shares',
    element: <MySharesPage />
  },
  {
    name: '个人中心',
    path: '/profile',
    element: <ProfilePage />
  },
  {
    name: '管理后台',
    path: '/admin',
    element: <AdminPage />
  },
  {
    name: '订单详情',
    path: '/order/:orderNo',
    element: <OrderDetailPage />
  },
  {
    name: '文件分享',
    path: '/share/:code',
    element: <SharePage />
  }
];

export default routes;
