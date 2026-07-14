-- 将 profiles.storage_limit 改为 numeric 以支持超大容量
ALTER TABLE profiles ALTER COLUMN storage_limit TYPE numeric USING storage_limit::numeric;
