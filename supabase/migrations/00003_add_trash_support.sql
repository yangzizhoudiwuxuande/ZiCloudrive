
-- 给 files 表添加软删除字段
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- 创建索引加速回收站查询
CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON public.files(user_id, deleted_at) WHERE deleted_at IS NOT NULL;

-- 修改 update_storage_used 触发器：软删除（UPDATE deleted_at）不影响存储，只有物理 DELETE 才减少
-- 现有触发器已经是 AFTER DELETE，软删除只是 UPDATE，所以行为正确，无需修改。

-- 创建定时自动彻底删除超过7天的回收站文件的函数（供 Edge Function 或手动调用）
CREATE OR REPLACE FUNCTION public.cleanup_expired_trash()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.files
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - INTERVAL '7 days';
END;
$$;
