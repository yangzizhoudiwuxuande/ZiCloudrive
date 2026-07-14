import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserFiles, getUserFolders, createFolder, deleteFile, deleteFolder, renameFile, renameFolder, createShare } from '@/db/api';
import { supabase } from '@/db/supabase';
import type { File as FileItem, Folder } from '@/db/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Upload, FolderPlus, File as FileIcon, Folder as FolderIcon, MoreVertical, Download, Trash2, Edit, ArrowLeft, Share2, Copy, Check } from 'lucide-react';
import { Label } from '@/components/ui/label';

export default function FilesPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'file' | 'folder'; id: string } | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [itemToRename, setItemToRename] = useState<{ type: 'file' | 'folder'; id: string; currentName: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      loadFiles();
    }
  }, [user, currentFolder]);

  const loadFiles = async () => {
    if (!user) return;

    setLoading(true);
    const [filesData, foldersData] = await Promise.all([
      getUserFiles(user.id, currentFolder?.id || null),
      getUserFolders(user.id, currentFolder?.id || null)
    ]);
    setFiles(filesData);
    setFolders(foldersData);
    setLoading(false);
  };

  const handleCreateFolder = async () => {
    if (!user || !newFolderName.trim()) {
      toast.error('请输入文件夹名称');
      return;
    }

    const folder = await createFolder(user.id, newFolderName.trim(), currentFolder?.id || null);
    if (folder) {
      toast.success('文件夹创建成功');
      setNewFolderName('');
      setCreateFolderOpen(false);
      loadFiles();
    } else {
      toast.error('文件夹创建失败');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !profile || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];

    // 根据当前套餐容量确定单文件上传上限
    const storageLimit = Number(profile.storage_limit);
    const GB = 1024 * 1024 * 1024;
    const TB = 1024 * GB;
    let maxUploadBytes: number;
    let maxUploadLabel: string;
    if (storageLimit <= 21474836480) {          // ≤ 20GB（免费版）
      maxUploadBytes = 10 * 1024 * 1024;        // 10MB
      maxUploadLabel = '10MB';
    } else if (storageLimit <= 2 * 1024 * GB) { // ≤ 2TB
      maxUploadBytes = 200 * 1024 * 1024;       // 200MB
      maxUploadLabel = '200MB';
    } else if (storageLimit <= 24 * TB) {       // ≤ 24TB
      maxUploadBytes = 1 * GB;                  // 1GB
      maxUploadLabel = '1GB';
    } else {                                    // 36TB+
      maxUploadBytes = 5 * GB;                  // 5GB
      maxUploadLabel = '5GB';
    }

    if (file.size > maxUploadBytes) {
      toast.error(`您当前套餐单文件上传上限为 ${maxUploadLabel}，请升级套餐以上传更大文件`);
      e.target.value = '';
      return;
    }

    // 检查存储空间
    if (Number(profile.storage_used) + file.size > storageLimit) {
      toast.error('存储空间不足，请升级套餐');
      return;
    }

    setUploading(true);

    try {
      // 生成文件名（使用时间戳和随机字符串）
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const ext = file.name.split('.').pop();
      const fileName = `${timestamp}_${randomStr}.${ext}`;
      const filePath = `${user.id}/${fileName}`;

      // 上传到 Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('files')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) {
        console.error('文件上传失败:', uploadError);
        toast.error('文件上传失败');
        setUploading(false);
        return;
      }

      // 获取公共 URL
      const { data: urlData } = supabase.storage
        .from('files')
        .getPublicUrl(filePath);

      // 确定文件类型
      let fileType: 'document' | 'image' | 'video' | 'audio' | 'other' = 'other';
      if (file.type.startsWith('image/')) fileType = 'image';
      else if (file.type.startsWith('video/')) fileType = 'video';
      else if (file.type.startsWith('audio/')) fileType = 'audio';
      else if (file.type.includes('document') || file.type.includes('pdf') || file.type.includes('text')) fileType = 'document';

      // 创建文件记录
      const { data: fileRecord, error: dbError } = await supabase
        .from('files')
        .insert({
          user_id: user.id,
          folder_id: currentFolder?.id || null,
          name: file.name,
          original_name: file.name,
          file_type: fileType,
          mime_type: file.type,
          size: file.size,
          storage_path: filePath,
          url: urlData.publicUrl
        } as any)
        .select()
        .single();

      if (dbError) {
        console.error('创建文件记录失败:', dbError);
        // 删除已上传的文件
        await supabase.storage.from('files').remove([filePath]);
        toast.error('创建文件记录失败');
        setUploading(false);
        return;
      }

      toast.success('文件上传成功');
      await refreshProfile();
      loadFiles();
    } catch (error) {
      console.error('上传文件错误:', error);
      toast.error('上传失败，请稍后重试');
    } finally {
      setUploading(false);
      // 重置 input
      e.target.value = '';
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    let success = false;
    if (itemToDelete.type === 'file') {
      // 软删除：移入回收站，不删除 Storage 中的文件
      success = await deleteFile(itemToDelete.id);
    } else {
      success = await deleteFolder(itemToDelete.id);
    }

    if (success) {
      toast.success(itemToDelete.type === 'file' ? '文件已移入回收站' : '删除成功');
      await refreshProfile();
      loadFiles();
    } else {
      toast.error('删除失败');
    }

    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const handleRename = async () => {
    if (!itemToRename || !newName.trim()) {
      toast.error('请输入新名称');
      return;
    }

    let success = false;
    if (itemToRename.type === 'file') {
      success = await renameFile(itemToRename.id, newName.trim());
    } else {
      success = await renameFolder(itemToRename.id, newName.trim());
    }

    if (success) {
      toast.success('重命名成功');
      loadFiles();
    } else {
      toast.error('重命名失败');
    }

    setRenameDialogOpen(false);
    setItemToRename(null);
    setNewName('');
  };

  const handleDownload = (file: FileItem) => {
    window.open(file.url, '_blank');
  };

  const handleShare = async (file: FileItem) => {
    if (!user) return;
    const share = await createShare(user.id, file.id, null, null, null);
    if (share) {
      const link = `${window.location.origin}/share/${share.share_code}`;
      setShareLink(link);
      setShareDialogOpen(true);
    } else {
      toast.error('生成分享链接失败');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      toast.success('链接已复制');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'image':
        return '🖼️';
      case 'video':
        return '🎬';
      case 'audio':
        return '🎵';
      case 'document':
        return '📄';
      default:
        return '📎';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              {currentFolder && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentFolder(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <CardTitle>
                {currentFolder ? currentFolder.name : '我的文件'}
              </CardTitle>
            </div>
            <div className="flex gap-2">
              <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <FolderPlus className="h-4 w-4" />
                    新建文件夹
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新建文件夹</DialogTitle>
                    <DialogDescription>请输入文件夹名称</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="folder-name">文件夹名称</Label>
                    <Input
                      id="folder-name"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="请输入文件夹名称"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>
                      取消
                    </Button>
                    <Button onClick={handleCreateFolder}>创建</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button className="gap-2" disabled={uploading} asChild>
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4" />
                  {uploading ? '上传中...' : '上传文件'}
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full bg-muted" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {/* 文件夹列表 */}
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-accent"
                >
                  <div
                    className="flex flex-1 cursor-pointer items-center gap-3"
                    onClick={() => setCurrentFolder(folder)}
                  >
                    <FolderIcon className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{folder.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(folder.created_at).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setItemToRename({ type: 'folder', id: folder.id, currentName: folder.name });
                          setNewName(folder.name);
                          setRenameDialogOpen(true);
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        重命名
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setItemToDelete({ type: 'folder', id: folder.id });
                          setDeleteDialogOpen(true);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}

              {/* 文件列表 */}
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-accent"
                >
                  <div className="flex flex-1 items-center gap-3">
                    <span className="text-2xl">{getFileIcon(file.file_type)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)} · {new Date(file.created_at).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDownload(file)}>
                        <Download className="mr-2 h-4 w-4" />
                        下载
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShare(file)}>
                        <Share2 className="mr-2 h-4 w-4" />
                        分享链接
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setItemToRename({ type: 'file', id: file.id, currentName: file.name });
                          setNewName(file.name);
                          setRenameDialogOpen(true);
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        重命名
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setItemToDelete({ type: 'file', id: file.id });
                          setDeleteDialogOpen(true);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}

              {folders.length === 0 && files.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  <FileIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>暂无文件，点击上传按钮开始使用</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              文件将移入回收站，保留7天后自动删除。确定要删除这个{itemToDelete?.type === 'file' ? '文件' : '文件夹'}吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 重命名对话框 */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名</DialogTitle>
            <DialogDescription>
              请输入新的{itemToRename?.type === 'file' ? '文件' : '文件夹'}名称
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-name">新名称</Label>
            <Input
              id="new-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="请输入新名称"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleRename}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 分享链接对话框 */}
      <Dialog open={shareDialogOpen} onOpenChange={(open) => { setShareDialogOpen(open); if (!open) { setShareLink(''); setCopied(false); } }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              分享链接
            </DialogTitle>
            <DialogDescription>
              任何拥有此链接的人都可以查看并下载该文件
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input value={shareLink} readOnly className="flex-1 text-sm" />
            <Button size="icon" variant="outline" onClick={handleCopyLink}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setShareDialogOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
