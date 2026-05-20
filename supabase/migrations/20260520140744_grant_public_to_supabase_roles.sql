-- Supabase Hosted 不会像 Local 那样自动给 service_role / anon / authenticated
-- 加 public schema 表的 DML 权限——本地 e2e 能跑，hosted 部署 POST 报
-- "permission denied for table meals"。这里显式补齐 + 设默认权限。
--
-- 安全性：public 表全部 enable RLS，权限只是"能否调表"，行级访问由 RLS 控制。

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
