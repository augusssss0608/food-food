import { PageShell } from '@/components/ui/page-shell';
import { Card, SectionLabel } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

/**
 * Cold RSC navigation 時的立即回饋 UI。
 * 用靜態 header（不引入 PageHeader 的 drawer client state），讓 fallback 輕且穩。
 */
export default function Loading() {
  return (
    <PageShell>
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.24em] text-text-3 font-mono mb-1">history</p>
        <h1 className="display-roman text-[32px] leading-none">飲食歷史</h1>
      </header>
      <section className="mb-7">
        <SectionLabel>載入中</SectionLabel>
        <Card className="px-5 py-6 flex items-center gap-3 text-text-3">
          <Spinner size={16} className="text-accent" />
          <span className="text-[13px]">同步資料中…</span>
        </Card>
      </section>
    </PageShell>
  );
}
