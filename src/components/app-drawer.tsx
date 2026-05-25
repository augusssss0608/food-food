'use client';
import type { ReactNode } from 'react';
import { Drawer, DrawerItem } from '@/components/ui/drawer';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

/**
 * 全 app 共享的左側抽屜內容。所有頁面 hamburger 都打開這個。
 * 包含返回主頁、各功能頁、登出。原本各頁的「← 主頁」link 被取消，所以這裡
 * 補一個「主頁」item 作為通用回主頁入口。
 */
export function AppDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    location.replace('/login');
  }
  return (
    <Drawer open={open} onClose={onClose}>
      <DrawerItem
        icon={<IconHome />}
        label="主頁"
        hint="今日摘要 / 紀錄"
        href="/"
        onClick={onClose}
      />
      <DrawerItem
        icon={<IconBell />}
        label="通知中心"
        hint="本週 / 本月建議、提醒"
        href="/inbox"
        onClick={onClose}
      />
      <DrawerItem
        icon={<IconHistory />}
        label="飲食歷史"
        hint="按日期回看每日紀錄"
        href="/history/meals"
        onClick={onClose}
      />
      <DrawerItem
        icon={<IconChart />}
        label="身體數據"
        hint="體重 / 體脂 / 肌肉 趨勢"
        href="/history/body"
        onClick={onClose}
      />
      <DrawerItem
        icon={<IconSliders />}
        label="修改目標"
        hint="卡路里 · 蛋白 · 碳水 · 脂肪"
        href="/settings"
        onClick={onClose}
      />
      <DrawerItem
        icon={<IconUser />}
        label="個人資料"
        hint="身高 / 體重 / 訓練頻率"
        href="/setup"
        onClick={onClose}
      />
      <DrawerItem
        icon={<IconActivity />}
        label="偵錯面板"
        hint="AI 呼叫 · 錯誤日誌 · cron"
        href="/admin/debug"
        onClick={onClose}
      />
      <DrawerItem
        icon={<IconLogout />}
        label="登出"
        onClick={signOut}
        danger
      />
      <div className="px-5 py-6 text-[11px] uppercase tracking-[0.16em] text-text-4 font-mono">
        v0.1 · single-user beta
      </div>
    </Drawer>
  );
}

const ic = (path: ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);
const IconHome = () => ic(<><path d="M3 11l9-8 9 8" /><path d="M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10" /></>);
const IconBell = () => ic(<><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></>);
const IconSliders = () => ic(<><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>);
const IconUser = () => ic(<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></>);
const IconActivity = () => ic(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />);
const IconLogout = () => ic(<><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>);
const IconHistory = () => ic(<><path d="M3 12a9 9 0 1 0 3-6.7" /><polyline points="3 4 3 10 9 10" /><polyline points="12 7 12 12 15 14" /></>);
const IconChart = () => ic(<><polyline points="3 17 9 11 13 15 21 7" /><polyline points="14 7 21 7 21 14" /></>);
