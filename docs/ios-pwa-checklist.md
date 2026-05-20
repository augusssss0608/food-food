# iOS PWA 实机测试 checklist（v1 上线前）

23 项，分必测 15 + 应测 8。需要 iPhone（iOS 16.4+）实机走一遍。

## 必测 15 项（不通过不能上线）

- [ ] 1. Add to Home Screen 后独立 PWA 打开（不带 Safari 地址栏）
- [ ] 2. 登录后杀进程重开 session 仍有效
- [ ] 3. 隔夜后 session refresh 正常
- [ ] 4. 无网开 PWA 不白屏
- [ ] 5. 无网新增餐能存本地草稿（IndexedDB）
- [ ] 6. 恢复网络后草稿只同步一次（client_mutation_id 幂等）
- [ ] 7. HEIC 选图能转 JPEG 不失败
- [ ] 8. 图片过大（> 2MB）有友好错误
- [ ] 9. Push 权限请求时机合理（用户操作后）
- [ ] 10. A2HS PWA 能收 Web Push
- [ ] 11. Push subscription 失效后能重新订阅
- [ ] 12. 时区 Asia/Tokyo 下周/月 cutoff 计算正确
- [ ] 13. 改 meal `ate_at` 后对应 advice 标 stale
- [ ] 14. cron catchup 手动触发 missing advice 能生成
- [ ] 15. cron 重复触发不重复 meals/advice/inbox/push

## 应测 8 项（不通过开 ticket 补）

- [ ] 16. 飞行模式下拍照保存草稿
- [ ] 17. 地铁弱网下提交超时不重复插入
- [ ] 18. App 后台 30 分钟后恢复同步正确
- [ ] 19. 30 天没打开 App 后重开 reconcile 正确
- [ ] 20. 低电量模式 push 行为
- [ ] 21. iCloud Photos "优化存储" 下选图能拿原图
- [ ] 22. VAPID key 轮换后旧订阅失败并能重新订阅
- [ ] 23. 月末 cutoff 在 28/29/30/31 天月份正确
