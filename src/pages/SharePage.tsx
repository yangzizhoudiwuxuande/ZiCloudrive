import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getShareByCode } from '@/db/api';
import type { ShareWithFile } from '@/db/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Cloud, Download, File as FileIcon, AlertCircle } from 'lucide-react';

export default function SharePage() {
  const { code } = useParams<{ code: string }>();
  const [share, setShare] = useState<ShareWithFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code) return;
    (async () => {
      const data = await getShareByCode(code);
      if (!data) {
        setNotFound(true);
      } else {
        setShare(data);
      }
      setLoading(false);
    })();
  }, [code]);

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
    <div className="flex min-h-screen flex-col bg-background">
      {/* 顶部品牌栏 */}
      <header className="border-b border-border bg-card px-6 py-4">
        <Link to="/" className="flex items-center gap-2 w-fit">
          <Cloud className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">ZiCloudrive</span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        {loading ? (
          <Card className="w-full max-w-md">
            <CardHeader><Skeleton className="h-6 w-40 bg-muted" /></CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-24 w-full bg-muted" />
              <Skeleton className="h-10 w-full bg-muted" />
            </CardContent>
          </Card>
        ) : notFound || !share?.file ? (
          <Card className="w-full max-w-md text-center">
            <CardContent className="py-16">
              <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50" />
              <p className="text-lg font-semibold">分享链接无效或已过期</p>
              <p className="mt-2 text-sm text-muted-foreground">该文件可能已被删除或链接不正确</p>
              <Button asChild className="mt-6">
                <Link to="/">返回首页</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileIcon className="h-5 w-5 text-primary shrink-0" />
                共享文件
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 文件信息 */}
              <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/40 p-4">
                <span className="text-4xl shrink-0">{getFileIcon(share.file.file_type)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{share.file.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatFileSize(share.file.size)} · {new Date(share.created_at).toLocaleDateString('zh-CN')} 分享
                  </p>
                </div>
              </div>

              <Button className="w-full gap-2" asChild>
                <a href={share.file.url} target="_blank" rel="noopener noreferrer" download={share.file.name}>
                  <Download className="h-4 w-4" />
                  下载文件
                </a>
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                由 ZiCloudrive 提供分享服务
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
