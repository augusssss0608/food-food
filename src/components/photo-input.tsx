'use client';
import { useState } from 'react';
import { normalizeImage } from '@/lib/image/normalize';
import { compressImage, fileToBase64 } from '@/lib/image/compress';

export function PhotoInput({ onPicked }: { onPicked: (b64: string, file: File) => void }) {
  const [busy, setBusy] = useState(false);

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
    <input
      type="file"
      accept="image/*"
      capture="environment"
      disabled={busy}
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) handleFile(f);
      }}
      className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-black file:text-white"
    />
  );
}
