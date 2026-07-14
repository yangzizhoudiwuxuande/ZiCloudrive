-- 创建存储桶
INSERT INTO storage.buckets (id, name, public) VALUES ('files', 'files', true);

-- 配置存储桶策略
CREATE POLICY "用户可以上传自己的文件" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "用户可以查看自己的文件" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "用户可以删除自己的文件" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "所有人可以查看公开文件" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'files');

-- 创建分享计数器 RPC 函数
CREATE OR REPLACE FUNCTION increment_share_view_count(share_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE shares
  SET view_count = view_count + 1
  WHERE id = share_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_share_download_count(share_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE shares
  SET download_count = download_count + 1
  WHERE id = share_id;
END;
$$;
