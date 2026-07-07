'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { UserMealPreset, RecentPhotoMeal } from '@/lib/home-snapshot';
import { useHWheelPicker } from '@/lib/h-wheel-picker';
import { MealPresetForm, type MealPresetFormInput, type MealPresetFormPrefill } from '@/components/meal-preset-form';
import { Dialog } from '@/components/ui/dialog';
import { MealPreviewCard, type MealPreview } from '@/components/meal-preview-card';
import { Spinner } from '@/components/ui/spinner';
import { normalizeImage } from '@/lib/image/normalize';
import { compressImage, fileToBase64 } from '@/lib/image/compress';

const MODE_W = 116;
const CARD_W = 200;
const CARD_INNER_W = CARD_W - 16;
const CARD_INNER_H = 118;
const PRESET_AXIS_LOCK = 8;
const VERTICAL_TRIGGER = 60;
const CLOSE_DRAG_TRIGGER = 90;
const DOT_PIXEL = 22;
const LONG_PRESS_MS = 800;
const RECENT_PHOTO_MAX = 5; // 拍照 mode 下方近期橫列展示上限

type ModeItem = {
  key: string;
  label: string;
  sub: string;
  /** true 时表示「拍照」mode（虛線按鈕 + 近期橫列） */
  isCamera: boolean;
  /** 非 camera mode：归属的 category 名称。null = 未分類（pseudo-mode） */
  category: string | null;
};
const CAMERA_MODE: ModeItem = {
  key: '__camera__', label: '拍照', sub: 'camera', isCamera: true, category: null,
};
const UNCATEGORIZED_MODE: ModeItem = {
  key: '__uncat__', label: '未分類', sub: 'menu', isCamera: false, category: null,
};

/**
 * 从 presets 派生 mode strip：
 * - 有 category 的，按本地排序去重生成 mode
 * - 有 category=null/'' 的 preset 时，追加「未分類」pseudo-mode
 * - 末尾固定一个「拍照」mode
 *
 * 0 类别 + 0 null-category 时只剩 [拍照]
 */
function buildModes(presets: UserMealPreset[]): ModeItem[] {
  const cats = new Set<string>();
  let hasUncategorized = false;
  for (const p of presets) {
    const c = (p.category ?? '').trim();
    if (c) cats.add(c);
    else hasUncategorized = true;
  }
  const catModes = [...cats]
    .sort((a, b) => a.localeCompare(b, 'zh-Hant'))
    .map((c): ModeItem => ({ key: `cat:${c}`, label: c, sub: 'menu', isCamera: false, category: c }));
  const result: ModeItem[] = [...catModes];
  if (hasUncategorized) result.push(UNCATEGORIZED_MODE);
  result.push(CAMERA_MODE);
  return result;
}

/** 当前 mode 对应的 preset 列表（按名字排序） */
function presetsForMode(presets: UserMealPreset[], mode: ModeItem): UserMealPreset[] {
  if (mode.isCamera) return [];
  return presets
    .filter((p) => {
      const c = (p.category ?? '').trim();
      if (mode.category === null) return c === '';
      return c === mode.category;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
}

/** 已有类别去重排序，给 form combobox 当下拉候选项 */
function uniqueCategoriesOf(presets: UserMealPreset[]): string[] {
  const set = new Set<string>();
  for (const p of presets) {
    const c = (p.category ?? '').trim();
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
}

type SheetView = 'list' | 'create' | 'edit';

export interface RecordMealSheetProps {
  open: boolean;
  onClose: () => void;
  /** 右下角常駐 knob 按鈕點擊回調（打開 sheet） */
  onOpen: () => void;
  customPresets: UserMealPreset[];
  /** 拍照 mode 下方「近期拍照」橫列數據源；前 RECENT_PHOTO_MAX 筆會被展示 */
  recentPhotoMeals: RecentPhotoMeal[];
  recordingId: string | null;
  /** 點長按完成觸發，記錄一筆 meal。返回 boolean 表示是否成功 */
  onPickCustomPreset: (preset: UserMealPreset) => Promise<boolean> | boolean | void;
  presetBusy: boolean;
  duplicatePresetName: boolean;
  onClearDuplicatePresetName: () => void;
  onCreatePreset: (input: MealPresetFormInput) => Promise<boolean>;
  onUpdatePreset: (id: string, input: MealPresetFormInput) => Promise<boolean>;
  onDeletePreset: (id: string) => Promise<boolean>;
  // 拍照模式相關
  mealExtractBusy: boolean;
  mealPreview: MealPreview | null;
  onUploadMealPhoto: (b64: string) => void | Promise<void>;
  onConfirmMeal: (p: MealPreview, satiety: number | undefined) => void | Promise<void>;
  onCancelMealPreview: () => void;
  confirmMealBusy: boolean;
}

export function RecordMealSheet({
  open,
  onClose,
  onOpen,
  customPresets,
  recentPhotoMeals,
  recordingId,
  onPickCustomPreset,
  presetBusy,
  duplicatePresetName,
  onClearDuplicatePresetName,
  onCreatePreset,
  onUpdatePreset,
  onDeletePreset,
  mealExtractBusy,
  mealPreview,
  onUploadMealPhoto,
  onConfirmMeal,
  onCancelMealPreview,
  confirmMealBusy,
}: RecordMealSheetProps) {
  const [view, setView] = useState<SheetView>('list');
  const [delOpen, setDelOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // —— camera: 內嵌 file input + 圖片預處理 ——
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  async function handlePhotoFile(f: File) {
    setPhotoBusy(true);
    try {
      const normalized = await normalizeImage(f);
      const compressed = await compressImage(normalized);
      const b64 = await fileToBase64(compressed);
      await onUploadMealPhoto(b64);
    } finally {
      setPhotoBusy(false);
    }
  }

  // —— 动态 mode strip：从 customPresets 派生类别 + 末尾固定「拍照」 ——
  const modes = useMemo(() => buildModes(customPresets), [customPresets]);
  const existingCategories = useMemo(() => uniqueCategoriesOf(customPresets), [customPresets]);
  const modeWheel = useHWheelPicker(modes.length, MODE_W, { cyclic: true, maxStep: 1 });
  const safeModeIdx = Math.min(Math.max(0, modeWheel.idx), Math.max(0, modes.length - 1));
  const currentMode = modes[safeModeIdx] ?? CAMERA_MODE;

  const [tickPulse, setTickPulse] = useState(0);
  const presetList = useMemo(
    () => presetsForMode(customPresets, currentMode),
    [customPresets, currentMode],
  );
  const presetWheel = useHWheelPicker(presetList.length, CARD_W, {
    maxStep: 1,
    onTick: () => setTickPulse((t) => t + 1),
  });
  const currentPreset = presetList[presetWheel.idx];

  // —— 拍照 mode 下方「近期拍照」橫列：長按 → 詢問是否新增此餐為 preset ——
  const recentPhotoList = useMemo(
    () => recentPhotoMeals.slice(0, RECENT_PHOTO_MAX),
    [recentPhotoMeals],
  );
  const [convertPhoto, setConvertPhoto] = useState<RecentPhotoMeal | null>(null);
  /** 长按 create 表单的 prefill；photo→preset 时带名字+营养素 */
  const [createPrefill, setCreatePrefill] = useState<MealPresetFormPrefill | undefined>(undefined);

  // 近期拍照卡片长按状态
  const recentPressTimerRef = useRef<number | null>(null);
  const recentPressStartXRef = useRef<number | null>(null);
  const recentPressStartYRef = useRef<number | null>(null);
  const recentPressMealRef = useRef<RecentPhotoMeal | null>(null);
  const [recentPressingId, setRecentPressingId] = useState<string | null>(null);

  function startRecentLongPress(meal: RecentPhotoMeal, e: React.PointerEvent) {
    if (recentPressTimerRef.current) window.clearTimeout(recentPressTimerRef.current);
    recentPressMealRef.current = meal;
    recentPressStartXRef.current = e.clientX;
    recentPressStartYRef.current = e.clientY;
    setRecentPressingId(meal.meal_id);
    recentPressTimerRef.current = window.setTimeout(() => {
      recentPressTimerRef.current = null;
      const m = recentPressMealRef.current;
      setRecentPressingId(null);
      recentPressMealRef.current = null;
      if (!m) return;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([6, 30, 18]); } catch {}
      }
      setConvertPhoto(m);
    }, LONG_PRESS_MS);
  }
  function cancelRecentLongPress() {
    if (recentPressTimerRef.current) {
      window.clearTimeout(recentPressTimerRef.current);
      recentPressTimerRef.current = null;
    }
    recentPressMealRef.current = null;
    recentPressStartXRef.current = null;
    recentPressStartYRef.current = null;
    setRecentPressingId(null);
  }
  function onRecentPointerMove(e: React.PointerEvent) {
    if (recentPressStartXRef.current == null || recentPressStartYRef.current == null) return;
    const dx = Math.abs(e.clientX - recentPressStartXRef.current);
    const dy = Math.abs(e.clientY - recentPressStartYRef.current);
    if (dx > PRESET_AXIS_LOCK || dy > PRESET_AXIS_LOCK) {
      cancelRecentLongPress();
    }
  }

  function confirmConvertPhoto() {
    const m = convertPhoto;
    if (!m) return;
    setCreatePrefill({
      name: m.dish_name,
      kcal: m.kcal,
      protein_g: m.protein_g,
      carb_g: m.carb_g,
      fat_g: m.fat_g,
      fiber_g: m.fiber_g,
      // 保留 provenance：preset 来自这条 photo_ai meal
      source_meal_id: m.meal_id,
    });
    setConvertPhoto(null);
    onClearDuplicatePresetName();
    setView('create');
  }

  // —— preset 手势：水平 1-step wheel / 垂直 CRUD / 长按 record ——
  const gestureAxis = useRef<'idle' | 'horizontal' | 'vertical'>('idle');
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const [verticalDrag, setVerticalDrag] = useState(0);
  const [pressing, setPressing] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);

  function startLongPress() {
    if (currentMode.isCamera || !currentPreset || recordingId != null) return;
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    setPressing(true);
    longPressTimerRef.current = window.setTimeout(async () => {
      longPressTimerRef.current = null;
      setPressing(false);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([6, 30, 18]); } catch {}
      }
      if (currentPreset) {
        const ok = await onPickCustomPreset(currentPreset);
        if (ok !== false) onClose();
      }
    }, LONG_PRESS_MS);
  }
  function cancelLongPress() {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (pressing) setPressing(false);
  }

  function onPresetPointerDown(e: React.PointerEvent) {
    gestureAxis.current = 'idle';
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    setVerticalDrag(0);
    presetWheel.pointerHandlers.onPointerDown(e);
    startLongPress();
  }
  function onPresetPointerMove(e: React.PointerEvent) {
    if (startXRef.current == null || startYRef.current == null) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    if (gestureAxis.current === 'idle') {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx > PRESET_AXIS_LOCK || absDy > PRESET_AXIS_LOCK) {
        gestureAxis.current = absDx > absDy ? 'horizontal' : 'vertical';
        cancelLongPress();
        if (gestureAxis.current === 'vertical') {
          presetWheel.pointerHandlers.onPointerCancel(e);
        }
      }
    }
    if (gestureAxis.current === 'horizontal') {
      presetWheel.pointerHandlers.onPointerMove(e);
    } else if (gestureAxis.current === 'vertical') {
      setVerticalDrag(dy);
    }
  }
  function onPresetPointerUp(e: React.PointerEvent) {
    cancelLongPress();
    const dy = startYRef.current != null ? e.clientY - startYRef.current : 0;
    if (gestureAxis.current === 'vertical' && currentPreset && !currentMode.isCamera) {
      if (dy < -VERTICAL_TRIGGER) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
        setDelOpen(true);
      } else if (dy > VERTICAL_TRIGGER) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
        onClearDuplicatePresetName();
        setView('edit');
      }
    } else if (gestureAxis.current === 'horizontal') {
      presetWheel.pointerHandlers.onPointerUp(e);
    } else {
      presetWheel.pointerHandlers.onPointerCancel(e);
    }
    gestureAxis.current = 'idle';
    startXRef.current = null;
    startYRef.current = null;
    setVerticalDrag(0);
  }
  function onPresetPointerCancel(e: React.PointerEvent) {
    cancelLongPress();
    presetWheel.pointerHandlers.onPointerCancel(e);
    gestureAxis.current = 'idle';
    startXRef.current = null;
    startYRef.current = null;
    setVerticalDrag(0);
  }

  // —— page dots scrub ——
  const dotsStartX = useRef<number | null>(null);
  const dotsStartIdx = useRef<number>(0);
  const dotsLastIdx = useRef<number>(0);
  const dotsLastVibrate = useRef<number>(0);
  function onDotsPointerDown(e: React.PointerEvent) {
    dotsStartX.current = e.clientX;
    dotsStartIdx.current = presetWheel.idx;
    dotsLastIdx.current = presetWheel.idx;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }
  function onDotsPointerMove(e: React.PointerEvent) {
    if (dotsStartX.current == null) return;
    const dx = e.clientX - dotsStartX.current;
    const delta = Math.round(dx / DOT_PIXEL);
    const len = presetList.length;
    if (len === 0) return;
    const raw = dotsStartIdx.current + delta;
    const newIdx = ((raw % len) + len) % len;
    if (newIdx !== dotsLastIdx.current) {
      presetWheel.snapTo(newIdx, { animate: false, haptic: false });
      dotsLastIdx.current = newIdx;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        const now = performance.now();
        if (now - dotsLastVibrate.current > 50) {
          try { navigator.vibrate(2); } catch {}
          dotsLastVibrate.current = now;
        }
      }
    }
  }
  function onDotsPointerUp() {
    dotsStartX.current = null;
  }

  // —— sheet 下滑关闭 ——
  const closeStartY = useRef<number | null>(null);
  const closeDragMoved = useRef(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  function startCloseDrag(clientY: number) {
    if (!open) return;
    closeStartY.current = clientY;
    closeDragMoved.current = false;
    setDragging(true);
  }
  function updateCloseDrag(clientY: number) {
    if (closeStartY.current == null) return;
    const dy = clientY - closeStartY.current;
    if (Math.abs(dy) > 4) closeDragMoved.current = true;
    setDragY(Math.max(0, dy));
  }
  function endCloseDrag(clientY: number) {
    if (closeStartY.current == null) return;
    const dy = clientY - closeStartY.current;
    closeStartY.current = null;
    setDragging(false);
    if (dy > CLOSE_DRAG_TRIGGER) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
      onClose();
    } else {
      setDragY(0);
    }
  }
  function cancelCloseDrag() {
    closeStartY.current = null;
    closeDragMoved.current = false;
    setDragging(false);
    setDragY(0);
  }
  function onCloseDragDown(e: React.PointerEvent) { startCloseDrag(e.clientY); }
  function onCloseDragMove(e: React.PointerEvent) { updateCloseDrag(e.clientY); }
  function onCloseDragUp(e: React.PointerEvent) { endCloseDrag(e.clientY); }

  // open=false 后 320ms 重置 view + dragY；open=true 时把 mode 回到「近期」
  // 用 ref 持有最新 modeWheel.snapTo 闭包，避免 deps 变化触发 effect
  const modeSnapToRef = useRef(modeWheel.snapTo);
  modeSnapToRef.current = modeWheel.snapTo;
  useEffect(() => {
    if (open) {
      modeSnapToRef.current(0, { animate: false, haptic: false });
      return;
    }
    const t = window.setTimeout(() => {
      setView('list');
      setDragY(0);
      setCreatePrefill(undefined);
      setConvertPhoto(null);
    }, 320);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => () => {
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    if (recentPressTimerRef.current) window.clearTimeout(recentPressTimerRef.current);
  }, []);

  // —— mode 手势：水平 wheel / 垂直向下 close drag ——
  const modeGestureAxis = useRef<'idle' | 'horizontal' | 'vertical'>('idle');
  const modeStartXRef = useRef<number | null>(null);
  const modeStartYRef = useRef<number | null>(null);

  function onModePointerDown(e: React.PointerEvent) {
    modeGestureAxis.current = 'idle';
    modeStartXRef.current = e.clientX;
    modeStartYRef.current = e.clientY;
    modeWheel.pointerHandlers.onPointerDown(e);
  }
  function onModePointerMove(e: React.PointerEvent) {
    if (modeStartXRef.current == null || modeStartYRef.current == null) return;
    const dx = e.clientX - modeStartXRef.current;
    const dy = e.clientY - modeStartYRef.current;
    if (modeGestureAxis.current === 'idle') {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx > PRESET_AXIS_LOCK || absDy > PRESET_AXIS_LOCK) {
        if (absDx > absDy) {
          modeGestureAxis.current = 'horizontal';
        } else if (dy > 0) {
          modeGestureAxis.current = 'vertical';
          modeWheel.pointerHandlers.onPointerCancel(e);
          startCloseDrag(modeStartYRef.current);
        } else {
          modeGestureAxis.current = 'horizontal';
        }
      }
    }
    if (modeGestureAxis.current === 'horizontal') {
      modeWheel.pointerHandlers.onPointerMove(e);
    } else if (modeGestureAxis.current === 'vertical') {
      updateCloseDrag(e.clientY);
    }
  }
  function onModePointerUp(e: React.PointerEvent) {
    if (modeGestureAxis.current === 'vertical') {
      endCloseDrag(e.clientY);
    } else if (modeGestureAxis.current === 'horizontal') {
      modeWheel.pointerHandlers.onPointerUp(e);
    } else {
      modeWheel.pointerHandlers.onPointerCancel(e);
    }
    modeGestureAxis.current = 'idle';
    modeStartXRef.current = null;
    modeStartYRef.current = null;
  }
  function onModePointerCancel(e: React.PointerEvent) {
    modeWheel.pointerHandlers.onPointerCancel(e);
    cancelCloseDrag();
    modeGestureAxis.current = 'idle';
    modeStartXRef.current = null;
    modeStartYRef.current = null;
  }

  // page indicator dots
  const total = presetList.length;
  const maxDots = 7;
  const dotsToShow = Math.min(total, maxDots);
  const activeDot = total <= maxDots
    ? presetWheel.idx
    : Math.round((presetWheel.idx * (maxDots - 1)) / Math.max(1, total - 1));

  // sheet 高度統一：list / create / edit 都用同高，避免切換閃；
  // 表单加了 category 字段（多 1 行 + 1 gap ≈ 78px），上限提到 520
  // 计算：header 54 + form padding 28 + 7 行 (name/category/kcal/macros/fiber/buttons) ≈ 434 + 缓冲
  const sheetHeight = 'calc(clamp(460px, 60dvh, 520px) + env(safe-area-inset-bottom))';

  return (
    <>
      {/* 右下角常駐 knob 浮動按鈕（打開 sheet 入口） */}
      <button
        type="button"
        onClick={onOpen}
        aria-label="open add meal sheet"
        className="z-[70]"
        style={{
          position: 'fixed',
          right: 20,
          bottom: 'calc(env(safe-area-inset-bottom) + 24px)',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <span className="rms-knob">
          <span className="rms-knob-rule" aria-hidden />
          <span className="rms-knob-dot" aria-hidden />
        </span>
      </button>

      {/* sheet 始终 mount，靠 transform+transition 控制；open=false 时 translateY(100%) 移出屏幕 */}
      <div className="fixed inset-0 z-[80]" style={{ pointerEvents: open ? 'auto' : 'none' }}>
        <div className="absolute inset-0"
          onClick={() => onClose()}
          style={{
            opacity: open ? 1 : 0,
            pointerEvents: open ? 'auto' : 'none',
            transition: 'opacity 200ms ease-out',
          }}
        />
        <div className="absolute left-0 right-0 bottom-0 rms-sheet"
          style={{
            height: sheetHeight,
            paddingBottom: 'env(safe-area-inset-bottom)',
            transform: open ? `translateY(${dragY}px)` : 'translateY(100%)',
            transition: dragging
              ? 'none'
              : 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1), height 280ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div className="rms-glow" aria-hidden />

          {/* header */}
          <div className="rms-header flex-shrink-0"
            onPointerDown={onCloseDragDown}
            onPointerMove={onCloseDragMove}
            onPointerUp={onCloseDragUp}
            onPointerCancel={cancelCloseDrag}
            style={{ touchAction: 'none' }}
          >
            <div className="rms-header-left">
              <p className="rms-title">
                {view === 'list' ? 'ADD MEAL' : view === 'create' ? 'NEW PRESET' : 'EDIT PRESET'}
              </p>
            </div>
            {view === 'list' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (closeDragMoved.current) return;
                  onClearDuplicatePresetName();
                  setView('create');
                }}
                className="rms-icon-btn"
                aria-label="new preset"
              >＋</button>
            )}
          </div>

          {view === 'list' && (
            <>
              {/* mode strip */}
              <div className="flex-shrink-0 rms-mode-strip">
                <div className="rms-mode-mask-l" aria-hidden />
                <div className="rms-mode-mask-r" aria-hidden />
                <div className="rms-mode-track"
                  onPointerDown={onModePointerDown}
                  onPointerMove={onModePointerMove}
                  onPointerUp={onModePointerUp}
                  onPointerCancel={onModePointerCancel}
                  style={{ touchAction: 'none' }}
                >
                  {/* count=1 时只渲染 rel=0，避免 cyclic 三个 rel 都解到同一 idx 导致重复 */}
                  {(modes.length <= 1 ? [0] : [-1, 0, 1]).map((rel) => {
                    const realIdx = modeWheel.getOffsetIdx(rel);
                    if (realIdx == null) return null;
                    const m = modes[realIdx];
                    if (!m) return null;
                    const visualPos = rel * MODE_W + modeWheel.dragOffset;
                    const distC = Math.abs(visualPos) / MODE_W;
                    const opacity = Math.max(0.25, Math.min(1, 1 - distC * 0.5));
                    const isCenter = distC < 0.5;
                    return (
                      // key 带 rel 后缀：count=2 时 rel=-1 / rel=+1 解到同一 realIdx，
                      // 仅 m.key 会撞 React key
                      <button key={`${m.key}-${rel}`}
                        type="button"
                        onClick={() => {
                          if (modeWheel.isAnimating) return;
                          if (Math.abs(modeWheel.dragOffsetRef.current) > 6) return;
                          if (realIdx === safeModeIdx) return;
                          modeWheel.snapTo(realIdx, { animate: true });
                        }}
                        className={`rms-mode-cell ${isCenter ? 'rms-mode-cell-active' : ''}`}
                        style={{
                          transform: `translate(-50%, -50%) translateX(${visualPos}px)`,
                          opacity,
                        }}
                      >
                        <span className="rms-mode-label">{m.label}</span>
                        <span className="rms-mode-sub">{m.sub}</span>
                      </button>
                    );
                  })}
                </div>
                <span className="rms-mode-underline" aria-hidden
                  style={{ transform: `translateX(calc(-50% + ${modeWheel.dragOffset * 0.3}px))` }}
                />
              </div>

              {/* preset cover-flow / camera */}
              <div className="flex-1 rms-cover-wrap min-h-0 relative">
                {currentMode.isCamera ? (
                  mealPreview ? (
                    <div className="absolute inset-0 px-5 pb-3 overflow-y-auto">
                      <MealPreviewCard
                        initial={mealPreview}
                        onConfirm={async (edited, satiety) => {
                          await onConfirmMeal(edited, satiety);
                        }}
                        onCancel={onCancelMealPreview}
                        busy={confirmMealBusy}
                      />
                    </div>
                  ) : (
                    <div className="rms-camera">
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        disabled={photoBusy || mealExtractBusy}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handlePhotoFile(f);
                          e.currentTarget.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={photoBusy || mealExtractBusy}
                        className="rms-cam-btn"
                      >
                        {photoBusy || mealExtractBusy ? (
                          <>
                            <Spinner size={22} className="text-accent" />
                            <span className="rms-cam-btn-label">
                              {mealExtractBusy ? 'ANALYZING' : 'PROCESSING'}
                            </span>
                          </>
                        ) : (
                          <>
                            <svg className="rms-cam-btn-icon" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2Z" />
                              <circle cx="12" cy="13" r="3.5" />
                            </svg>
                            <span className="rms-cam-btn-label">拍照 / 選圖</span>
                          </>
                        )}
                      </button>

                      {recentPhotoList.length === 0 && (
                        <p className="rms-cam-hint" aria-hidden>AI · KCAL / MACROS</p>
                      )}
                      {/* 下方：近期拍照橫列；長按卡片 → 詢問是否新增為 preset */}
                      {recentPhotoList.length > 0 && (
                        <div className="rms-recent-section" onContextMenu={(e) => e.preventDefault()}>
                          <p className="rms-recent-label" aria-hidden>近期拍照 · 長按新增為菜單</p>
                          <div className="rms-recent-row" style={{ touchAction: 'pan-x' }}>
                            {recentPhotoList.map((meal) => {
                              const pressing = recentPressingId === meal.meal_id;
                              return (
                                <button
                                  key={meal.meal_id}
                                  type="button"
                                  className={`rms-recent-card ${pressing ? 'rms-recent-card-pressing' : ''}`}
                                  onPointerDown={(e) => startRecentLongPress(meal, e)}
                                  onPointerMove={onRecentPointerMove}
                                  onPointerUp={cancelRecentLongPress}
                                  onPointerCancel={cancelRecentLongPress}
                                  onPointerLeave={cancelRecentLongPress}
                                >
                                  {pressing && (
                                    <svg className="rms-recent-progress" viewBox="0 0 100 70" preserveAspectRatio="none" aria-hidden>
                                      <rect
                                        className="rms-recent-progress-rect"
                                        x="1" y="1" width="98" height="68"
                                        rx="11" ry="11"
                                        fill="none"
                                        stroke="var(--color-accent)"
                                        strokeWidth="2"
                                        vectorEffect="non-scaling-stroke"
                                        pathLength="1"
                                      />
                                    </svg>
                                  )}
                                  <p className="rms-recent-name">{meal.dish_name}</p>
                                  <p className="rms-recent-kcal tabular">
                                    {Math.round(meal.kcal)}<span className="rms-recent-kcal-unit">kcal</span>
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                ) : presetList.length === 0 ? (
                  <div className="rms-empty">
                    <p className="text-[13px] text-text-3 font-mono">no preset</p>
                    <button onClick={() => { onClearDuplicatePresetName(); setView('create'); }} className="rms-empty-cta">＋ new</button>
                  </div>
                ) : (
                  <>
                    <div className="rms-cover-mask-l" aria-hidden />
                    <div className="rms-cover-mask-r" aria-hidden />
                    <div className="rms-cover-track"
                      onPointerDown={onPresetPointerDown}
                      onPointerMove={onPresetPointerMove}
                      onPointerUp={onPresetPointerUp}
                      onPointerCancel={onPresetPointerCancel}
                      onContextMenu={(e) => e.preventDefault()}
                      style={{ touchAction: 'none' }}
                    >
                      {[-2, -1, 0, 1, 2].map((rel) => {
                        const realIdx = presetWheel.getOffsetIdx(rel);
                        if (realIdx == null) return null;
                        const p = presetList[realIdx];
                        if (!p) return null;
                        const visualPos = rel * CARD_W + presetWheel.dragOffset;
                        const distC = Math.abs(visualPos) / CARD_W;
                        const scale = Math.max(0.5, 1 - distC * 0.09);
                        const opacity = Math.max(0, Math.min(1, 1 - distC * 0.55));
                        const isCenter = distC < 0.5;
                        const yOffset = isCenter ? Math.max(-30, Math.min(30, verticalDrag * 0.45)) : 0;
                        return (
                          <div key={`${p.id}-${rel}`}
                            className={`rms-card ${isCenter ? 'rms-card-active' : ''} ${isCenter && pressing ? 'rms-card-pressing' : ''}`}
                            style={{
                              transform: `translate(${visualPos}px, ${yOffset}px) scale(${scale})`,
                              opacity,
                            }}
                          >
                            {isCenter && tickPulse > 0 && (
                              <span key={`tk-${tickPulse}`} className="rms-card-tick" aria-hidden />
                            )}
                            {isCenter && pressing && (
                              <svg className="rms-card-progress" viewBox={`0 0 ${CARD_INNER_W} ${CARD_INNER_H}`} preserveAspectRatio="none" aria-hidden>
                                <rect
                                  className="rms-progress-rect"
                                  x="1.5" y="1.5"
                                  width={CARD_INNER_W - 3} height={CARD_INNER_H - 3}
                                  rx="14.5" ry="14.5"
                                  fill="none"
                                  stroke="var(--color-accent)"
                                  strokeWidth="3"
                                  vectorEffect="non-scaling-stroke"
                                  pathLength="1"
                                />
                              </svg>
                            )}
                            <p className="rms-card-name">{p.name}</p>
                            <p className="rms-card-kcal tabular">
                              {Math.round(p.kcal)}<span className="text-[10px] text-text-3 ml-1">kcal</span>
                            </p>
                            {isCenter && (
                              <p className="rms-card-macro tabular">
                                <span style={{ color: '#c8ff00' }}>P {Math.round(p.protein_g)}</span>
                                <span className="opacity-50 mx-1.5">·</span>
                                <span style={{ color: '#f5a623' }}>C {Math.round(p.carb_g)}</span>
                                <span className="opacity-50 mx-1.5">·</span>
                                <span style={{ color: '#a486f4' }}>F {Math.round(p.fat_g)}</span>
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* page dots */}
              {!currentMode.isCamera && presetList.length > 0 && (
                <div className="flex-shrink-0 rms-pager-wrap"
                  onPointerDown={onDotsPointerDown}
                  onPointerMove={onDotsPointerMove}
                  onPointerUp={onDotsPointerUp}
                  onPointerCancel={onDotsPointerUp}
                  style={{ touchAction: 'none' }}
                >
                  <div className="rms-pager">
                    {Array.from({ length: dotsToShow }).map((_, k) => (
                      <span key={k} className={`rms-pdot ${k === activeDot ? 'rms-pdot-active' : ''}`} />
                    ))}
                  </div>
                </div>
              )}

              {/* 操作提示 */}
              <p className="flex-shrink-0 rms-action-hint">
                {recordingId
                  ? <span className="text-accent">recording…</span>
                  : currentMode.isCamera
                  ? '拍照 / 上傳 · 下滑關閉'
                  : currentPreset
                  ? <>長按卡片<span className="text-accent">記錄</span>　·　↑刪除　·　↓編輯</>
                  : '滑動選 preset · 點 ＋ 新增'}
              </p>
            </>
          )}

          {view === 'create' && (
            <div className="flex-1 px-5 pb-5 pt-2 min-h-0 overflow-y-auto">
              <MealPresetForm
                busy={presetBusy}
                duplicateError={duplicatePresetName}
                onClearDuplicate={onClearDuplicatePresetName}
                prefill={createPrefill}
                existingCategories={existingCategories}
                onSubmit={async (input) => {
                  const ok = await onCreatePreset(input);
                  if (ok) {
                    setCreatePrefill(undefined);
                    setView('list');
                  }
                }}
                onCancel={() => {
                  onClearDuplicatePresetName();
                  setCreatePrefill(undefined);
                  setView('list');
                }}
              />
            </div>
          )}

          {view === 'edit' && currentPreset && (
            <div className="flex-1 px-5 pb-5 pt-2 min-h-0 overflow-y-auto">
              <MealPresetForm
                busy={presetBusy}
                duplicateError={duplicatePresetName}
                onClearDuplicate={onClearDuplicatePresetName}
                existingCategories={existingCategories}
                prefill={{
                  name: currentPreset.name,
                  category: currentPreset.category,
                  kcal: currentPreset.kcal,
                  protein_g: currentPreset.protein_g,
                  carb_g: currentPreset.carb_g,
                  fat_g: currentPreset.fat_g,
                  fiber_g: currentPreset.fiber_g,
                }}
                onSubmit={async (input) => {
                  const ok = await onUpdatePreset(currentPreset.id, input);
                  if (ok) setView('list');
                }}
                onCancel={() => { onClearDuplicatePresetName(); setView('list'); }}
              />
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={delOpen}
        title="刪除這個 preset？"
        body={currentPreset ? <span>將永久移除「<span className="text-text font-medium">{currentPreset.name}</span>」。</span> : null}
        confirmText="刪除"
        variant="danger"
        busy={deleteBusy}
        onCancel={deleteBusy ? undefined : () => setDelOpen(false)}
        onConfirm={async () => {
          if (!currentPreset) { setDelOpen(false); return; }
          setDeleteBusy(true);
          try {
            await onDeletePreset(currentPreset.id);
            setDelOpen(false);
          } finally {
            setDeleteBusy(false);
          }
        }}
      />

      {/* 近期拍照 → 新增 preset 确认 */}
      <Dialog
        open={convertPhoto != null}
        title="新增此餐點到菜單？"
        body={convertPhoto ? (
          <span>
            將「<span className="text-text font-medium">{convertPhoto.dish_name}</span>」
            連同熱量 / 營養素帶入新增表單，你可以再選類別並調整。
          </span>
        ) : null}
        confirmText="繼續"
        onCancel={() => setConvertPhoto(null)}
        onConfirm={confirmConvertPhoto}
      />

      <style>{styles}</style>
    </>
  );
}

const styles = `
@keyframes rms-glow-pulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.6; }
}
@keyframes rms-knob-dot-slide {
  0%, 100% { transform: translate(-50%, -50%) translateX(-6px); }
  50% { transform: translate(-50%, -50%) translateX(6px); }
}

/* ========== 右下角常駐 knob ========== */
.rms-knob {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  width: 50px; height: 50px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(40,40,48,0.95), rgba(18,18,22,0.95));
  border: 1.5px solid var(--color-accent);
  backdrop-filter: blur(8px);
  box-shadow: 0 10px 24px -6px rgba(0,0,0,0.7), 0 0 0 4px rgba(200,255,0,0.08), inset 0 1px 0 rgba(255,255,255,0.06);
}
.rms-knob:active { transform: scale(0.92); }
.rms-knob-rule {
  display: block;
  width: 28px; height: 2px;
  border-radius: 999px;
  background-image: repeating-linear-gradient(90deg, var(--color-accent) 0 2px, transparent 2px 6px);
  opacity: 0.7;
}
.rms-knob-dot {
  position: absolute;
  top: 50%; left: 50%;
  width: 6px; height: 6px;
  background: var(--color-accent);
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(200,255,0,0.9);
  animation: rms-knob-dot-slide 2.6s ease-in-out infinite;
}
@keyframes rms-progress-fill {
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
}
@keyframes rms-tick-pulse {
  0% {
    box-shadow: inset 0 0 0 2px rgba(200,255,0,0.85), 0 0 22px rgba(200,255,0,0.55);
    background: rgba(200,255,0,0.07);
  }
  100% {
    box-shadow: inset 0 0 0 0 rgba(200,255,0,0), 0 0 0 rgba(200,255,0,0);
    background: rgba(200,255,0,0);
  }
}

.rms-sheet {
  display: flex; flex-direction: column;
  background: linear-gradient(180deg, #12121a 0%, #0a0a10 100%);
  border-top: 1px solid rgba(200,255,0,0.45);
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  box-shadow: 0 -16px 48px -12px rgba(0,0,0,0.6);
  overflow: hidden;
  will-change: transform;
  /* 全 sheet 禁选取 + 禁 iOS 长按 callout，避免拷貝/查詢/翻譯彈出 */
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}
/* 表單輸入需要保留可選取以支援編輯 */
.rms-sheet input,
.rms-sheet textarea {
  user-select: text;
  -webkit-user-select: text;
  -webkit-touch-callout: default;
}
.rms-glow {
  position: absolute;
  left: 50%; top: -1px;
  transform: translateX(-50%);
  width: 60%; height: 2px;
  background: linear-gradient(90deg, transparent, var(--color-accent), transparent);
  opacity: 0.5;
  pointer-events: none;
  animation: rms-glow-pulse 2.4s ease-in-out infinite;
}

.rms-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px 8px;
  user-select: none;
  cursor: grab;
}
.rms-header:active { cursor: grabbing; }
.rms-header-left { pointer-events: none; }
.rms-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2em;
  line-height: 1;
  color: var(--color-text);
}
.rms-icon-btn {
  width: 32px; height: 32px;
  background: rgba(28,28,34,0.7);
  border: 1px solid rgba(200,255,0,0.25);
  border-radius: 10px;
  color: var(--color-accent);
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.rms-icon-btn:active { transform: scale(0.9); border-color: var(--color-accent); background: rgba(200,255,0,0.1); }

.rms-mode-strip {
  position: relative;
  height: 56px;
  margin: 0 0 4px;
  overflow: hidden;
  user-select: none;
}
.rms-mode-mask-l, .rms-mode-mask-r {
  position: absolute; top: 0; bottom: 0; width: 50px;
  pointer-events: none; z-index: 2;
}
.rms-mode-mask-l { left: 0; background: linear-gradient(90deg, #12121a 0%, transparent 100%); }
.rms-mode-mask-r { right: 0; background: linear-gradient(-90deg, #12121a 0%, transparent 100%); }
.rms-mode-track {
  position: absolute;
  left: 0; right: 0; top: 0; bottom: 8px;
  cursor: grab;
}
.rms-mode-track:active { cursor: grabbing; }
.rms-mode-cell {
  position: absolute;
  left: 50%; top: 50%;
  width: ${MODE_W - 14}px;
  background: transparent;
  border: none;
  color: var(--color-text-3);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 4px;
  padding: 4px;
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  cursor: pointer;
  will-change: transform, opacity;
  transition: color 0.22s;
}
.rms-mode-label {
  font-size: 18px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.02em;
}
.rms-mode-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8.5px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  opacity: 0.5;
  line-height: 1;
  transition: opacity 0.22s, letter-spacing 0.22s;
}
.rms-mode-cell-active { color: var(--color-accent); }
.rms-mode-cell-active .rms-mode-label { font-weight: 600; }
.rms-mode-cell-active .rms-mode-sub { opacity: 0.9; letter-spacing: 0.28em; }
.rms-mode-underline {
  position: absolute;
  left: 50%; bottom: 4px;
  width: 28px; height: 2px;
  background: var(--color-accent);
  border-radius: 999px;
  box-shadow: 0 0 8px rgba(200,255,0,0.65);
  pointer-events: none;
  z-index: 3;
  will-change: transform;
}

.rms-cover-wrap {
  position: relative;
  overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  min-height: 138px;
}
.rms-cover-mask-l, .rms-cover-mask-r {
  position: absolute; top: 0; bottom: 0; width: 70px;
  pointer-events: none; z-index: 3;
}
.rms-cover-mask-l { left: 0; background: linear-gradient(90deg, #0e0e15 0%, rgba(14,14,21,0.6) 60%, transparent 100%); }
.rms-cover-mask-r { right: 0; background: linear-gradient(-90deg, #0e0e15 0%, rgba(14,14,21,0.6) 60%, transparent 100%); }
.rms-cover-track {
  position: relative;
  width: ${CARD_W}px;
  height: 150px;
  cursor: grab;
}
.rms-cover-track:active { cursor: grabbing; }
.rms-card {
  position: absolute;
  left: 0; top: 50%;
  width: ${CARD_INNER_W}px;
  height: ${CARD_INNER_H}px;
  margin-top: -${CARD_INNER_H / 2}px;
  background: linear-gradient(180deg, rgba(28,28,36,0.7) 0%, rgba(18,18,24,0.7) 100%);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
  display: flex; flex-direction: column;
  justify-content: center; align-items: center;
  padding: 10px;
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  will-change: transform, opacity;
  backdrop-filter: blur(6px);
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.rms-card-name {
  font-size: 16px;
  color: var(--color-text);
  font-weight: 600;
  text-align: center;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}
.rms-card-kcal {
  font-size: 20px;
  color: var(--color-text-2);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  margin-top: 5px;
}
.rms-card-macro {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  margin-top: 6px;
  letter-spacing: 0.04em;
}
.rms-card-active {
  background: linear-gradient(180deg, rgba(36,40,24,0.85) 0%, rgba(20,22,18,0.95) 100%);
  border-color: rgba(200,255,0,0.55);
  box-shadow: 0 14px 32px -12px rgba(0,0,0,0.7), 0 0 28px rgba(200,255,0,0.18), inset 0 1px 0 rgba(200,255,0,0.12);
}
.rms-card-active .rms-card-name { color: var(--color-accent); font-size: 18px; }
.rms-card-active .rms-card-kcal { color: var(--color-accent); font-size: 24px; }
.rms-card-pressing {
  border-color: rgba(200,255,0,0.8);
  transform-origin: center;
}

.rms-card-tick {
  position: absolute; inset: 0;
  border-radius: 16px;
  pointer-events: none;
  animation: rms-tick-pulse 0.18s ease-out forwards;
}

.rms-card-progress {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
  z-index: 2;
}
.rms-progress-rect {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: rms-progress-fill ${LONG_PRESS_MS}ms linear forwards;
  filter: drop-shadow(0 0 6px rgba(200,255,0,0.5));
}

.rms-pager-wrap {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center;
  padding: 16px 40px;
  margin: 4px 12px 0;
  min-height: 44px;
  user-select: none;
  cursor: grab;
}
.rms-pager-wrap:active {
  cursor: grabbing;
}
.rms-pager {
  display: flex; gap: 8px; align-items: center;
  padding: 2px 0;
}
.rms-pdot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: rgba(255,255,255,0.18);
  transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
}
.rms-pdot-active {
  background: var(--color-accent);
  transform: scale(1.4);
  box-shadow: 0 0 8px rgba(200,255,0,0.7);
}

.rms-action-hint {
  text-align: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.06em;
  color: var(--color-text-3);
  padding: 6px 16px 4px;
  margin: 0;
  user-select: none;
}

.rms-empty, .rms-camera {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: var(--color-accent);
  gap: 4px;
}
.rms-empty-cta {
  background: var(--color-accent);
  color: var(--color-accent-ink);
  border: none;
  border-radius: 10px;
  padding: 10px 18px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.14em;
  cursor: pointer;
  box-shadow: 0 6px 16px -4px rgba(200,255,0,0.4);
}

/* ========== camera entry button (dashed, compact) ========== */
.rms-cam-btn {
  width: 264px; height: 130px;
  border-radius: 18px;
  border: 1.5px dashed rgba(200,255,0,0.32);
  background: rgba(20,22,28,0.45);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 10px;
  color: var(--color-text-2);
  cursor: pointer;
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.15s ease;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.rms-cam-btn:active:not(:disabled) {
  border-color: rgba(200,255,0,0.7);
  background: rgba(28,32,20,0.6);
  transform: scale(0.98);
}
.rms-cam-btn:disabled { cursor: default; opacity: 0.85; }
.rms-cam-btn-icon { color: var(--color-accent); opacity: 0.85; }
.rms-cam-btn-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2em;
  color: var(--color-text-2);
}
.rms-cam-hint {
  margin: 12px 0 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 0.24em;
  color: var(--color-text-3);
  opacity: 0.55;
}

/* ========== camera 下方近期拍照橫列 ========== */
.rms-recent-section {
  margin-top: 14px;
  width: 100%;
  display: flex; flex-direction: column;
  align-items: center;
  gap: 6px;
}
.rms-recent-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--color-text-3);
  opacity: 0.55;
  margin: 0;
}
.rms-recent-row {
  display: flex;
  gap: 8px;
  padding: 4px 16px;
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  justify-content: flex-start;
  align-items: stretch;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.rms-recent-row::-webkit-scrollbar { display: none; }
.rms-recent-card {
  position: relative;
  flex-shrink: 0;
  width: 100px; height: 70px;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(28,28,36,0.7) 0%, rgba(18,18,24,0.7) 100%);
  border: 1px solid rgba(255,255,255,0.08);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 3px;
  padding: 6px 8px;
  cursor: pointer;
  scroll-snap-align: start;
  transition: border-color 0.2s ease, transform 0.15s ease;
  overflow: hidden;
  font-family: 'JetBrains Mono', 'Noto Sans CJK', sans-serif;
}
.rms-recent-card:active {
  transform: scale(0.96);
}
.rms-recent-card-pressing {
  border-color: rgba(200,255,0,0.7);
  background: linear-gradient(180deg, rgba(36,40,24,0.85) 0%, rgba(20,22,18,0.95) 100%);
}
.rms-recent-name {
  font-size: 11px;
  color: var(--color-text);
  font-weight: 500;
  line-height: 1.15;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  margin: 0;
}
.rms-recent-kcal {
  font-size: 13px;
  color: var(--color-accent);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  line-height: 1;
  margin: 0;
}
.rms-recent-kcal-unit {
  font-size: 8.5px;
  color: var(--color-text-3);
  margin-left: 2px;
}
.rms-recent-progress {
  position: absolute;
  inset: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  overflow: visible;
  z-index: 2;
}
.rms-recent-progress-rect {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: rms-progress-fill ${LONG_PRESS_MS}ms linear forwards;
  filter: drop-shadow(0 0 4px rgba(200,255,0,0.5));
}
`;
