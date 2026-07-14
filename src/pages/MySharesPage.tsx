import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserShares, deleteShare } from '@/db/api';
import type { ShareWithFile } from '@/db/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Share2, Copy, Check, Trash2, ExternalLink } from 'lucide-react';

export default function MySharesPage() {
  const { user } = useAuth();
  const [shares, setShares] = useState<ShareWithFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [shareToCancel, setShareToCancel] = useState<ShareWithFile | null>(null);

  useEffect(() => {
    if (user) loadShares();
  }, [user]);

  const loadShares = async () => {
    if (!user) return;
    setLoading(true);
    const data = await getUserShares(user.id);
    setShares(data);
    setLoading(false);
  };

  const getShareUrl = (code: string) => `${window.location.origin}/share/${code}`;

  const handleCopy = async (share: ShareWithFile) => {
    try {
      await navigator.clipboard.writeText(getShareUrl(share.share_code));
      setCopiedId(share.id);
      toast.success('链接已复制');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  const handleCancel = async () => {
    if (!shareToCancel) return;
    const ok = await deleteShare(shareToCancel.id);
    if (ok) {
      toast.success('分享已取消');
      loadShares();
    } else {
      toast.error('取消失败，请重试');
    }
    setCancelDialogOpen(false);
    setShareToCancel(null);
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
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle>我的分享</CardTitle>
            {!loading && shares.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {shares.length}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full bg-muted" />)}
            </div>
          ) : shares.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Share2 className="mx-auto mb-4 h-12 w-12 opacity-30" />
              <p className="font-medium">暂无分享</p>
              <p className="mt-1 text-sm">在文件列表中点击"分享链接"即可创建分享</p>
            </div>
          ) : (
            <div className="space-y-2">
              {shares.map((share) => {
                const file = share.file;
                const shareUrl = getShareUrl(share.share_code);
                return (
                  <div
                    key={share.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-accent"
                  >
                    {/* 文件信息 */}
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="shrink-0 text-2xl">
                        {file ? getFileIcon(file.file_type) : '📎'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {file ? file.name : '文件已删除'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          {file && (
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            分享于 {new Date(share.created_at).toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                        {/* 链接预览（桌面端） */}
                        <p className="mt-1 hidden truncate text-xs text-muted-foreground md:block">
                          {shareUrl}
                        </p>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => window.open(shareUrl, '_blank')}
                        title="在新标签页打开"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">访问</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => handleCopy(share)}
                      >
                        {copiedId === share.id
                          ? <Check className="h-3.5 w-3.5 text-green-500" />
                          : <Copy className="h-3.5 w-3.5" />
                        }
                        <span className="hidden md:inline">{copiedId === share.id ? '已复制' : '复制链接'}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs text-destructive hover:text-destructive"
                        onClick={() => { setShareToCancel(share); setCancelDialogOpen(true); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">取消分享</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 取消分享确认对话框 */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>取消分享</AlertDialogTitle>
            <AlertDialogDescription>
              取消后分享链接将立即失效，他人将无法再通过该链接访问文件。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认取消
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
