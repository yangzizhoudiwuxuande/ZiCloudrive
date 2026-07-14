import { supabase } from './supabase';
import type { Profile } from '@/types/types';

// 用户角色
export type UserRole = 'user' | 'admin';

// 订单状态
export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded';

// 文件类型
export type FileType = 'document' | 'image' | 'video' | 'audio' | 'other';

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
  deleted_at: string | null;
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

// ==================== 用户相关 ====================

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('获取用户资料失败:', error);
    return null;
  }
  return data;
}

export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取所有用户失败:', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function updateUserRole(userId: string, role: 'user' | 'admin'): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);

  if (error) {
    console.error('更新用户角色失败:', error);
    return false;
  }
  return true;
}

// 更新用户学生认证信息（生日和认证状态）
export async function updateStudentVerification(
  userId: string,
  birthDate: string,
  isStudent: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ birth_date: birthDate, is_student_verified: isStudent })
    .eq('id', userId);

  if (error) {
    console.error('更新学生认证信息失败:', error);
    return false;
  }
  return true;
}

// 管理员给指定用户追加存储空间（单位：字节）
export async function addUserStorage(userId: string, additionalBytes: number): Promise<boolean> {
  // 先获取当前限额
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('storage_limit')
    .eq('id', userId)
    .maybeSingle();

  if (fetchError) {
    console.error('获取用户存储限额失败:', fetchError);
    return false;
  }

  const currentLimit = Number(profile?.storage_limit || 0);
  const newLimit = currentLimit + additionalBytes;

  const { error } = await supabase
    .from('profiles')
    .update({ storage_limit: newLimit })
    .eq('id', userId);

  if (error) {
    console.error('追加用户存储空间失败:', error);
    return false;
  }
  return true;
}

// ==================== 套餐相关 ====================

export async function getAllPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('获取套餐列表失败:', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function getPlanById(planId: string): Promise<Plan | null> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle();

  if (error) {
    console.error('获取套餐详情失败:', error);
    return null;
  }
  return data;
}

// ==================== 订单相关 ====================

export async function getUserOrders(userId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取用户订单失败:', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function getOrderByNo(orderNo: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('order_no', orderNo)
    .maybeSingle();

  if (error) {
    console.error('获取订单详情失败:', error);
    return null;
  }
  return data;
}

export async function getAllOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取所有订单失败:', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

// ==================== 文件夹相关 ====================

export async function getUserFolders(userId: string, parentId: string | null = null): Promise<Folder[]> {
  let query = supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (parentId === null) {
    query = query.is('parent_id', null);
  } else {
    query = query.eq('parent_id', parentId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('获取文件夹列表失败:', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function createFolder(userId: string, name: string, parentId: string | null = null): Promise<Folder | null> {
  // 构建路径
  let path = `/${name}`;
  if (parentId) {
    const parent = await getFolderById(parentId);
    if (parent) {
      path = `${parent.path}/${name}`;
    }
  }

  const { data, error } = await supabase
    .from('folders')
    .insert({
      user_id: userId,
      parent_id: parentId,
      name,
      path
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('创建文件夹失败:', error);
    return null;
  }
  return data;
}

export async function getFolderById(folderId: string): Promise<Folder | null> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('id', folderId)
    .maybeSingle();

  if (error) {
    console.error('获取文件夹详情失败:', error);
    return null;
  }
  return data;
}

export async function deleteFolder(folderId: string): Promise<boolean> {
  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', folderId);

  if (error) {
    console.error('删除文件夹失败:', error);
    return false;
  }
  return true;
}

export async function renameFolder(folderId: string, newName: string): Promise<boolean> {
  const { error } = await supabase
    .from('folders')
    .update({ name: newName, updated_at: new Date().toISOString() })
    .eq('id', folderId);

  if (error) {
    console.error('重命名文件夹失败:', error);
    return false;
  }
  return true;
}

// ==================== 文件相关 ====================

export async function getUserFiles(userId: string, folderId: string | null = null): Promise<File[]> {
  let query = supabase
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (folderId === null) {
    query = query.is('folder_id', null);
  } else {
    query = query.eq('folder_id', folderId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('获取文件列表失败:', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function createFile(fileData: {
  user_id: string;
  folder_id: string | null;
  name: string;
  original_name: string;
  file_type: string;
  mime_type: string;
  size: number;
  storage_path: string;
  url: string;
}): Promise<File | null> {
  const { data, error } = await supabase
    .from('files')
    .insert(fileData)
    .select()
    .maybeSingle();

  if (error) {
    console.error('创建文件记录失败:', error);
    return null;
  }
  return data;
}

export async function deleteFile(fileId: string): Promise<boolean> {
  // 软删除：设置 deleted_at 而非真正删除
  const { error } = await supabase
    .from('files')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', fileId);

  if (error) {
    console.error('删除文件失败:', error);
    return false;
  }
  return true;
}

// 回收站：获取已删除文件
export async function getTrashFiles(userId: string): Promise<File[]> {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) {
    console.error('获取回收站文件失败:', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

// 回收站：还原文件
export async function restoreFile(fileId: string): Promise<boolean> {
  const { error } = await supabase
    .from('files')
    .update({ deleted_at: null })
    .eq('id', fileId);

  if (error) {
    console.error('还原文件失败:', error);
    return false;
  }
  return true;
}

// 回收站：彻底删除文件（真正从数据库和 Storage 删除）
export async function permanentlyDeleteFile(fileId: string, storagePath: string): Promise<boolean> {
  // 先删除 Storage 文件
  await supabase.storage.from('files').remove([storagePath]);
  // 再删除数据库记录（触发 storage_used 减少）
  const { error } = await supabase
    .from('files')
    .delete()
    .eq('id', fileId);

  if (error) {
    console.error('彻底删除文件失败:', error);
    return false;
  }
  return true;
}

export async function renameFile(fileId: string, newName: string): Promise<boolean> {
  const { error } = await supabase
    .from('files')
    .update({ name: newName, updated_at: new Date().toISOString() })
    .eq('id', fileId);

  if (error) {
    console.error('重命名文件失败:', error);
    return false;
  }
  return true;
}

export async function getFileById(fileId: string): Promise<File | null> {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .maybeSingle();

  if (error) {
    console.error('获取文件详情失败:', error);
    return null;
  }
  return data;
}

// ==================== 分享相关 ====================

export async function createShare(
  userId: string,
  fileId: string | null,
  folderId: string | null,
  password: string | null = null,
  expiresAt: string | null = null
): Promise<Share | null> {
  // 生成分享码
  const shareCode = Math.random().toString(36).substring(2, 10).toUpperCase();

  const { data, error } = await supabase
    .from('shares')
    .insert({
      user_id: userId,
      file_id: fileId,
      folder_id: folderId,
      share_code: shareCode,
      password,
      expires_at: expiresAt
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('创建分享失败:', error);
    return null;
  }
  return data;
}

export async function getShareByCode(shareCode: string): Promise<ShareWithFile | null> {
  const { data, error } = await supabase
    .from('shares')
    .select(`
      *,
      file:files(*),
      folder:folders(*)
    `)
    .eq('share_code', shareCode)
    .maybeSingle();

  if (error) {
    console.error('获取分享详情失败:', error);
    return null;
  }
  return data as ShareWithFile;
}

export async function getUserShares(userId: string): Promise<ShareWithFile[]> {
  const { data, error } = await supabase
    .from('shares')
    .select(`
      *,
      file:files(*),
      folder:folders(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取用户分享列表失败:', error);
    return [];
  }
  return Array.isArray(data) ? data as ShareWithFile[] : [];
}

export async function deleteShare(shareId: string): Promise<boolean> {
  const { error } = await supabase
    .from('shares')
    .delete()
    .eq('id', shareId);

  if (error) {
    console.error('删除分享失败:', error);
    return false;
  }
  return true;
}

export async function incrementShareViewCount(shareId: string): Promise<boolean> {
  const { error } = await supabase.rpc('increment_share_view_count', { share_id: shareId });

  if (error) {
    console.error('增加分享查看次数失败:', error);
    return false;
  }
  return true;
}

export async function incrementShareDownloadCount(shareId: string): Promise<boolean> {
  const { error } = await supabase.rpc('increment_share_download_count', { share_id: shareId });

  if (error) {
    console.error('增加分享下载次数失败:', error);
    return false;
  }
  return true;
}
