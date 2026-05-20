'use client';
import { useRef, useState } from 'react';
import { normalizeImage } from '@/lib/image/normalize';
import { compressImage, fileToBase64 } from '@/lib/image/compress';
import { Spinner } from '@/components/ui/spinner';

export function PhotoInput({
  onPicked,
  label = '選擇照片',
}: {
  onPicked: (b64: string, file: File) => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(f: File) {
    setBusy(true);
    try {
      const normalized = await normalizeImage(f);
      const compressed = await compressImage(normalized);
      const b64 = await fileToBase64(compressed);
      onPicked(b64, compressed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/*
        移除 `capture="environment"`：原本強制走後置鏡頭，沒給選相簿的入口。
        無 capture 屬性時，iOS Safari 會彈原生 action sheet：
        「拍照或錄影 / 照片圖庫 / 選擇檔案」，兩種來源都支持。
      */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
        className="sr-only"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={[
          'w-full h-28 rounded-xl border-2 border-dashed border-hairline-strong',
          'bg-surface/50 hover:bg-surface hover:border-accent/40 transition-colors',
          'flex flex-col items-center justify-center gap-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'active:scale-[0.99]',
        ].join(' ')}
      >
        {busy ? (
          <>
            <Spinner size={20} className="text-accent" />
            <span className="text-[12px] text-text-2">處理圖片中…</span>
          </>
        ) : (
          <>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-3">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="11" r="2" />
              <path d="M3 17l6-6 4 4 3-3 5 5" />
            </svg>
            <span className="text-[13px] text-text-2">{label}</span>
          </>
        )}
      </button>
    </>
  );
}
