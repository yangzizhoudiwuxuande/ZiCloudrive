// 用户角色
export type UserRole = 'user' | 'admin';

// 订单状态
export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded';

// 文件类型
export type FileType = 'document' | 'image' | 'video' | 'audio' | 'other';

// 用户资料
export interface Profile {
  id: string;
  username: string | null;
  email: string | null;
  role: UserRole;
  current_plan_id: string | null;
  storage_used: number;
  storage_limit: number;
  birth_date: string | null;
  is_student_verified: boolean;
  created_at: string;
  updated_at: string;
}

// 套餐
export interface Plan {
  id: string;
  name: string;
  storage_gb: number;
  storage_bytes: number;
  price_monthly: number;
  is_free: boolean;
  sort_order: number;
  created_at: string;
}

// 订单
export interface Order {
  id: string;
  order_no: string;
  user_id: string;
  plan_id: string;
  status: OrderStatus;
  wechat_pay_url: string | null;
  total_amount: number;
  plan_snapshot: Plan;
  created_at: string;
  updated_at: string;
}

// 文件夹
export interface Folder {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  path: string;
  created_at: string;
  updated_at: string;
}

// 文件
export interface File {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  original_name: string;
  file_type: FileType;
  mime_type: string;
  size: number;
  storage_path: string;
  url: string;
  created_at: string;
  updated_at: string;
}

// 分享
export interface Share {
  id: string;
  user_id: string;
  file_id: string | null;
  folder_id: string | null;
  share_code: string;
  password: string | null;
  expires_at: string | null;
  view_count: number;
  download_count: number;
  created_at: string;
}

// 带文件信息的分享
export interface ShareWithFile extends Share {
  file?: File;
  folder?: Folder;
}
