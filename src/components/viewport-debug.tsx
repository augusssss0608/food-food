'use client';
import { useEffect, useState } from 'react';

/**
 * 訪問 ?debugViewport=1 啟用。顯示 iOS PWA viewport 實際數值：
 * - red line: window.innerHeight
 * - yellow line: visualViewport.height
 * - green line: main.getBoundingClientRect().bottom
 * - 數值面板（top-left）
 *
 * 用於定位「app 底部一塊全黑」的根因——iOS PWA installed + viewport-fit:cover 的 dvh/viewport bug。
 */
export function ViewportDebug() {
  const [enabled, setEnabled] = useState(false);
  const [data, setData] = useState({
    standalone: false,
    innerH: 0,
    outerH: 0,
    screenH: 0,
    vvH: 0,
    docH: 0,
    mainBottom: 0,
    sab: '',
    sat: '',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // 臨時：默認啟用（PWA standalone 不會帶 query string，沒法用 ?debugViewport=1 觸發）
    // 用戶截圖後撤回此改動
    setEnabled(true);

    function update() {
      const nav = window.navigator as Navigator & { standalone?: boolean };
      const standalone = nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
      const mainEl = document.querySelector('main');
      const mainRect = mainEl?.getBoundingClientRect();
      const root = getComputedStyle(document.documentElement);
      setData({
        standalone,
        innerH: window.innerHeight,
        outerH: window.outerHeight,
        screenH: window.screen.height,
        vvH: window.visualViewport?.height ?? 0,
        docH: document.documentElement.clientHeight,
        mainBottom: mainRect?.bottom ?? 0,
        sab: root.getPropertyValue('--sab').trim() || 'n/a',
        sat: root.getPropertyValue('--sat').trim() || 'n/a',
      });
    }
    update();
    const onResize = () => update();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    const id = window.setInterval(update, 500);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.clearInterval(id);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}>
      {/* 紅線：innerHeight */}
      <div style={{ position: 'fixed', left: 0, right: 0, top: `${data.innerH - 2}px`, height: 2, background: 'red' }} />
      {/* 黃線：visualViewport.height */}
      <div style={{ position: 'fixed', left: 0, right: 0, top: `${data.vvH - 2}px`, height: 2, background: 'yellow' }} />
      {/* 綠線：main.bottom */}
      <div style={{ position: 'fixed', left: 0, right: 0, top: `${data.mainBottom - 2}px`, height: 2, background: '#0f0' }} />
      {/* 數值面板（右下，方便截圖底部黑區同框） */}
      <div style={{
        position: 'fixed', right: 6, bottom: 6, padding: 8, background: 'rgba(0,0,0,0.85)',
        color: 'white', fontFamily: 'monospace', fontSize: 10, lineHeight: 1.4,
        borderRadius: 6, maxWidth: 260, pointerEvents: 'auto',
        border: '1px solid #c8ff00',
      }}>
        <div>standalone: <b style={{ color: data.standalone ? '#0f0' : '#f88' }}>{String(data.standalone)}</b></div>
        <div style={{ color: 'red' }}>innerHeight: {data.innerH}</div>
        <div>outerHeight: {data.outerH}</div>
        <div>screen.h: {data.screenH}</div>
        <div style={{ color: 'yellow' }}>vv.height: {data.vvH}</div>
        <div>doc.clientH: {data.docH}</div>
        <div style={{ color: '#0f0' }}>main.bottom: {data.mainBottom}</div>
        <div>sat: {data.sat || '0'}</div>
        <div>sab: {data.sab || '0'}</div>
      </div>
    </div>
  );
}
