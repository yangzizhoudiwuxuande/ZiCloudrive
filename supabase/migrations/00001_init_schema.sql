-- 创建用户角色枚举
CREATE TYPE public.user_role AS ENUM ('user', 'admin');

-- 创建订单状态枚举
CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'cancelled', 'refunded');

-- 创建用户资料表
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  email text,
  role user_role NOT NULL DEFAULT 'user'::user_role,
  current_plan_id uuid,
  storage_used bigint NOT NULL DEFAULT 0,
  storage_limit bigint NOT NULL DEFAULT 21474836480, -- 默认 20GB
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 创建套餐表
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  storage_gb int NOT NULL,
  storage_bytes bigint NOT NULL,
  price_monthly numeric(10,2) NOT NULL,
  is_free boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 创建订单表
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status order_status NOT NULL DEFAULT 'pending'::order_status,
  wechat_pay_url text,
  total_amount numeric(12,2) NOT NULL,
  plan_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 创建文件夹表
CREATE TABLE public.folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, parent_id, name)
);

-- 创建文件类型枚举
CREATE TYPE public.file_type AS ENUM ('document', 'image', 'video', 'audio', 'other');

-- 创建文件表
CREATE TABLE public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  original_name text NOT NULL,
  file_type file_type NOT NULL,
  mime_type text NOT NULL,
  size bigint NOT NULL,
  storage_path text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 创建分享表
CREATE TABLE public.shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_id uuid REFERENCES public.files(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.folders(id) ON DELETE CASCADE,
  share_code text UNIQUE NOT NULL,
  password text,
  expires_at timestamptz,
  view_count int NOT NULL DEFAULT 0,
  download_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT share_target_check CHECK (
    (file_id IS NOT NULL AND folder_id IS NULL) OR
    (file_id IS NULL AND folder_id IS NOT NULL)
  )
);

-- 创建索引
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_folders_user_id ON public.folders(user_id);
CREATE INDEX idx_folders_parent_id ON public.folders(parent_id);
CREATE INDEX idx_files_user_id ON public.files(user_id);
CREATE INDEX idx_files_folder_id ON public.files(folder_id);
CREATE INDEX idx_shares_share_code ON public.shares(share_code);

-- 创建用户同步触发器函数
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count int;
  extracted_username text;
BEGIN
  SELECT COUNT(*) INTO user_count FROM profiles;
  
  -- 从邮箱中提取用户名（去掉 @miaoda.com）
  extracted_username := split_part(NEW.email, '@', 1);
  
  INSERT INTO public.profiles (id, username, email, role)
  VALUES (
    NEW.id,
    extracted_username,
    NEW.email,
    CASE WHEN user_count = 0 THEN 'admin'::public.user_role ELSE 'user'::public.user_role END
  );
  RETURN NEW;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL)
  EXECUTE FUNCTION handle_new_user();

-- 创建管理员检查函数
CREATE OR REPLACE FUNCTION is_admin(uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid AND p.role = 'admin'::user_role
  );
$$;

-- 配置 RLS 策略
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

-- Profiles 策略
CREATE POLICY "管理员可以查看所有用户资料" ON public.profiles
  FOR SELECT TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "用户可以查看自己的资料" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "管理员可以更新所有用户资料" ON public.profiles
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "用户可以更新自己的资料（不包括角色）" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM (SELECT role FROM profiles WHERE id = auth.uid()));

-- Plans 策略（所有人可读）
CREATE POLICY "所有人可以查看套餐" ON public.plans
  FOR SELECT TO authenticated USING (true);

-- Orders 策略
CREATE POLICY "管理员可以查看所有订单" ON public.orders
  FOR SELECT TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "用户可以查看自己的订单" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "用户可以创建自己的订单" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Folders 策略
CREATE POLICY "用户可以查看自己的文件夹" ON public.folders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "用户可以创建自己的文件夹" ON public.folders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户可以更新自己的文件夹" ON public.folders
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "用户可以删除自己的文件夹" ON public.folders
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Files 策略
CREATE POLICY "用户可以查看自己的文件" ON public.files
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "用户可以上传文件" ON public.files
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户可以更新自己的文件" ON public.files
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "用户可以删除自己的文件" ON public.files
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Shares 策略
CREATE POLICY "用户可以查看自己的分享" ON public.shares
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "用户可以创建分享" ON public.shares
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户可以删除自己的分享" ON public.shares
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "匿名用户可以通过分享码查看分享" ON public.shares
  FOR SELECT TO anon USING (true);

-- 插入套餐数据
INSERT INTO public.plans (name, storage_gb, storage_bytes, price_monthly, is_free, sort_order) VALUES
  ('免费套餐', 20, 21474836480, 0, true, 1),
  ('100GB', 100, 107374182400, 2, false, 2),
  ('500GB', 500, 536870912000, 10, false, 3),
  ('1TB', 1024, 1099511627776, 25, false, 4),
  ('2TB', 2048, 2199023255552, 30, false, 5),
  ('10TB', 10240, 10995116277760, 50, false, 6),
  ('12TB', 12288, 13194139533312, 60, false, 7),
  ('24TB', 24576, 26388279066624, 100, false, 8);

-- 创建更新存储使用量的函数
CREATE OR REPLACE FUNCTION update_storage_used()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles
    SET storage_used = storage_used + NEW.size
    WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles
    SET storage_used = storage_used - OLD.size
    WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$;

-- 创建触发器自动更新存储使用量
CREATE TRIGGER update_storage_on_file_insert
  AFTER INSERT ON public.files
  FOR EACH ROW
  EXECUTE FUNCTION update_storage_used();

CREATE TRIGGER update_storage_on_file_delete
  AFTER DELETE ON public.files
  FOR EACH ROW
  EXECUTE FUNCTION update_storage_used();
