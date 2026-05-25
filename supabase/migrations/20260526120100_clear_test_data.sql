-- One-off：清空测试数据，配合上一个 migration（meal_preset_category）的部署节点。
-- 之前的 presets / meals 没有 category 概念，新 UI 上不会展示在分类 mode strip 里。
-- 用户授权直接清空，重新建立带 category 的测试数据。

delete from public.user_meal_presets;
delete from public.meals;
