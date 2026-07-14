import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getTrashFiles, restoreFile, permanentlyDeleteFile, getPlanById } from '@/db/api';
import type { File as FileItem, Plan } from '@/db/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Trash2, RotateCcw, AlertTriangle, Trash, Infinity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// 根据当前套餐计算回收站保留天数（null = 永久）
function getTrashRetentionDays(plan: Plan | null): number | null {
  if (!plan || plan.is_free) return 90;
  const gb = Number(plan.storage_gb);
  if (gb <= 500) return 240;      // 购买 20GB / 100GB / 500GB
  if (gb <= 10240) return 365;    // 购买 1TB / 2TB / 10TB
  return null;                     // 12TB 及以上：永久
}

export default function TrashPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [trashFiles, setTrashFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [emptyDialogOpen, setEmptyDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);

  useEffect(() => {
    if (user) loadTrash();
  }, [user]);

  useEffect(() => {
    const planId = profile?.current_plan_id;
    if (typeof planId === 'string') {
      getPlanById(planId).then((plan) => setCurrentPlan(plan));
    } else {
      setCurrentPlan(null);
    }
  }, [profile?.current_plan_id]);

  const retentionDays = getTrashRetentionDays(currentPlan);

  const loadTrash = async () => {
    if (!user) return;
    setLoading(true);
    const files = await getTrashFiles(user.id);
    setTrashFiles(files);
    setLoading(false);
  };

  // 计算距离彻底删除剩余天数（null retention = 永久，返回 null）
  const getDaysLeft = (deletedAt: string): number | null => {
    if (retentionDays === null) return null;
    const deleted = new Date(deletedAt).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((deleted + retentionDays * 24 * 3600 * 1000 - now) / (1000 * 3600 * 24));
    return Math.max(0, diffDays);
  };

  const handleRestore = async (file: FileItem) => {
    const success = await restoreFile(file.id);
    if (success) {
      toast.success(`"${file.name}" 已还原`);
      await refreshProfile();
      loadTrash();
    } else {
      toast.error('还原失败');
    }
  };

  const handlePermanentDelete = async () => {
    if (!fileToDelete) return;
    const success = await permanentlyDeleteFile(fileToDelete.id, fileToDelete.storage_path);
    if (success) {
      toast.success(`"${fileToDelete.name}" 已彻底删除`);
      await refreshProfile();
      loadTrash();
    } else {
      toast.error('删除失败');
    }
    setDeleteDialogOpen(false);
    setFileToDelete(null);
  };

  const handleEmptyTrash = async () => {
    let allSuccess = true;
    for (const file of trashFiles) {
      const ok = await permanentlyDeleteFile(file.id, file.storage_path);
      if (!ok) allSuccess = false;
    }
    if (allSuccess) {
      toast.success('回收站已清空');
    } else {
      toast.error('部分文件删除失败');
    }
    await refreshProfile();
    loadTrash();
    setEmptyDialogOpen(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'image': return '🖼️';
      case 'video': return '🎬';
      case 'audio': return '🎵';
      case 'document': return '📄';
      default: return '📎';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle>回收站</CardTitle>
              {trashFiles.length > 0 && (
                <Badge variant="secondary">{trashFiles.length}</Badge>
              )}
            </div>
            {trashFiles.length > 0 && (
              <Button
                variant="outline"
                className="gap-2 text-destructive hover:bg-destructive/10"
                onClick={() => setEmptyDialogOpen(true)}
              >
                <Trash className="h-4 w-4" />
                清空回收站
              </Button>
            )}
          </div>
          {/* 提示信息 */}
          <div className="flex items-start gap-2 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span>
              回收站中的文件将在删除后{' '}
              <strong className="text-foreground">
                {retentionDays === null ? '永久保留（不自动删除）' : `${retentionDays}天后自动彻底删除`}
              </strong>
              ，期间占用存储空间。您可手动还原或提前彻底删除。
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full bg-muted" />
              ))}
            </div>
          ) : trashFiles.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Trash2 className="mx-auto mb-4 h-12 w-12 opacity-30" />
              <p className="font-medium">回收站为空</p>
              <p className="mt-1 text-sm">已删除的文件会在这里显示</p>
            </div>
          ) : (
            <div className="space-y-2">
              {trashFiles.map((file) => {
                const daysLeft = getDaysLeft(file.deleted_at!);
                return (
                  <div
                    key={file.id}
                    className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-accent"
                  >
                    <div className="flex flex-1 min-w-0 items-center gap-3">
                      <span className="text-2xl shrink-0">{getFileIcon(file.file_type)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-muted-foreground">{file.name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)} · 删除于 {new Date(file.deleted_at!).toLocaleDateString('zh-CN')}
                          </span>
                          <Badge
                            variant={daysLeft !== null && daysLeft <= 1 ? 'destructive' : 'secondary'}
                            className="text-xs px-1.5 py-0"
                          >
                            {daysLeft === null ? (
                              <span className="flex items-center gap-0.5"><Infinity className="h-3 w-3" /> 永久保留</span>
                            ) : daysLeft === 0 ? '今天到期' : `${daysLeft}天后删除`}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => handleRestore(file)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        还原
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs text-destructive hover:text-destructive"
                        onClick={() => {
                          setFileToDelete(file);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        彻底删除
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 彻底删除单文件确认 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>彻底删除文件</AlertDialogTitle>
            <AlertDialogDescription>
              文件 "{fileToDelete?.name}" 将被永久删除，此操作无法撤销，存储空间将被释放。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              彻底删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 清空回收站确认 */}
      <AlertDialog open={emptyDialogOpen} onOpenChange={setEmptyDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>清空回收站</AlertDialogTitle>
            <AlertDialogDescription>
              回收站中所有 {trashFiles.length} 个文件将被永久删除，此操作无法撤销，存储空间将被释放。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEmptyTrash}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
