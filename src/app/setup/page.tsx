import { SetupForm } from '@/components/setup-form';

// 從 drawer 的「個人資料」進入。/page.tsx 在沒 profile 時也會 inline 渲染同一個 SetupForm，
// 避免一個 server redirect 雙跳；這個路徑保留是給已登入用戶手動編輯起點數據。
export default function SetupPage() {
  return <SetupForm />;
}
