-- 将 storage_gb 和 storage_bytes 均改为 numeric，以支持超大容量套餐
ALTER TABLE plans
  ALTER COLUMN storage_gb TYPE numeric USING storage_gb::numeric,
  ALTER COLUMN storage_bytes TYPE numeric USING storage_bytes::numeric;

-- 插入 1000000000000000000TB 套餐
INSERT INTO plans (id, name, storage_gb, storage_bytes, price_monthly, is_free, sort_order)
VALUES (
  gen_random_uuid(),
  '1000000000000000000TB',
  1024000000000000000000,
  1099511627776000000000000000000,
  1000.00,
  false,
  12
);
