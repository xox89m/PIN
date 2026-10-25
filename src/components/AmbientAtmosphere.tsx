import React, { useEffect, useRef } from 'react';
import rainyWindowBg from '../assets/images/rainy_window_candle_desk_1792837371636.jpg';
import nightPorchBg from '../assets/images/rainy_night_house_porch_1792837373495.jpg';
import warmDeskBg from '../assets/images/warm_wooden_desk_candlelight_1792837373650.jpg';

export type LivingSceneId = 'rainy_window' | 'night_porch' | 'warm_desk';

interface AmbientAtmosphereProps {
  sceneId: LivingSceneId;
  customBgUrl?: string;
}

interface NormalizedPoint {
  u: number;
  v: number;
}

interface CandleSpec {
  /** พิกัดปลายไส้เทียน (0..1 ของภาพต้นฉบับ) */
  wickU: number;
  wickV: number;
  /** ความสูงเปลวไฟเทียบกับความสูงภาพ */
  flameHeightRatio: number;
  /** ความกว้างโคนเปลวไฟเทียบกับความกว้างภาพ */
  flameWidthRatio: number;
  /** พิกัดและสีสำหรับเกลบปลายเปลวไฟนิ่งในภาพต้นฉบับเพื่อให้เปลวไฟใหม่พริ้วไหวได้อิสระ */
  maskVOffset: number;
  maskRadiusRatio: number;
  maskColor: string;
  /** ความสว่างรัศมีแสงเทียนรอบห้อง */
  auraRadiusRatio: number;
  auraAlpha: number;
  /** เป็นเงาสะท้อนในกระจกหรือไม่ */
  isReflection?: boolean;
  phaseOffset: number;
}

interface WindowPanePolygon {
  points: NormalizedPoint[];
  /** ขอบเขตสี่เหลี่ยมคร่าว ๆ สำหรับสุ่มเม็ดฝนและหยดน้ำไหล */
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
  /** ความชันขอบล่างของหน้าต่าง: vBottom(u) = sillVStart + ((u - minU)/(maxU - minU))*(sillVEnd - sillVStart) */
  sillVStart: number;
  sillVEnd: number;
}

interface RainStreak {
  u: number;
  v: number;
  lenV: number;
  speedV: number;
  windU: number;
  alpha: number;
  thickness: number;
}

interface TrailNode {
  u: number;
  v: number;
}

interface WindowRivulet {
  paneIndex: number;
  u: number;
  v: number;
  radiusPx: number;
  speedV: number;
  pauseTimer: number;
  wobbleSeed: number;
  alpha: number;
  trail: TrailNode[];
}

interface GlassBead {
  paneIndex: number;
  u: number;
  v: number;
  radiusPx: number;
  alpha: number;
  twinklePhase: number;
}

interface SillRipple {
  u: number;
  v: number;
  progress: number; // 0..1
}

interface SteamPuff {
  progress: number; // 0..1
  driftSeed: number;
}

interface WarmMote {
  xRatio: number;
  yRatio: number;
  radius: number;
  vx: number;
  vy: number;
  alpha: number;
  phase: number;
}

const SCENE_URLS: Record<LivingSceneId, string> = {
  rainy_window: rainyWindowBg,
  night_porch: nightPorchBg,
  warm_desk: warmDeskBg,
};

/**
 * พิกัดเปลวไฟเทียนจริงและเงาสะท้อนบนกระจกของแต่ละฉาก
 */
const SCENE_CANDLES: Record<LivingSceneId, CandleSpec[]> = {
  rainy_window: [
    // เทียนในแก้วใสบนโต๊ะไม้ฝั่งซ้าย
    {
      wickU: 0.2185,
      wickV: 0.626,
      flameHeightRatio: 0.044,
      flameWidthRatio: 0.022,
      maskVOffset: -0.025,
      maskRadiusRatio: 0.026,
      maskColor: 'rgba(52, 33, 19, 0.88)',
      auraRadiusRatio: 0.26,
      auraAlpha: 0.24,
      phaseOffset: 0,
    },
    // เงาสะท้อนเปลวเทียนในกระจกหน้าต่างฝั่งขวา
    {
      wickU: 0.716,
      wickV: 0.535,
      flameHeightRatio: 0.031,
      flameWidthRatio: 0.016,
      maskVOffset: -0.017,
      maskRadiusRatio: 0.017,
      maskColor: 'rgba(38, 44, 54, 0.72)',
      auraRadiusRatio: 0.1,
      auraAlpha: 0.1,
      isReflection: true,
      phaseOffset: 0.15,
    },
  ],
  night_porch: [
    // โคมไฟสีเหลืองอุ่นหน้าประตูบ้านไม้
    {
      wickU: 0.509,
      wickV: 0.427,
      flameHeightRatio: 0.026,
      flameWidthRatio: 0.018,
      maskVOffset: -0.012,
      maskRadiusRatio: 0.012,
      maskColor: 'rgba(168, 98, 34, 0.35)',
      auraRadiusRatio: 0.25,
      auraAlpha: 0.22,
      phaseOffset: 1.1,
    },
  ],
  warm_desk: [
    // เทียนไขตั้งบนเชิงเทียนทองเหลืองฝั่งขวาของโต๊ะ
    {
      wickU: 0.919,
      wickV: 0.233,
      flameHeightRatio: 0.084,
      flameWidthRatio: 0.021,
      maskVOffset: -0.052,
      maskRadiusRatio: 0.046,
      maskColor: 'rgba(42, 27, 17, 0.9)',
      auraRadiusRatio: 0.34,
      auraAlpha: 0.26,
      phaseOffset: 2.3,
    },
  ],
};

/**
 * พิกัดบานกระจกหน้าต่างสำหรับสายฝนด้านนอกและหยดน้ำไหลเกาะตามกระจก
 */
const SCENE_WINDOWS: Record<LivingSceneId, WindowPanePolygon[]> = {
  rainy_window: [
    // บานกระจกบน
    {
      points: [
        { u: 0.532, v: 0.0 },
        { u: 1.0, v: 0.0 },
        { u: 1.0, v: 0.112 },
        { u: 0.532, v: 0.142 },
      ],
      minU: 0.54,
      maxU: 0.99,
      minV: 0.0,
      maxV: 0.138,
      sillVStart: 0.14,
      sillVEnd: 0.112,
    },
    // บานกระจกหลักด้านล่าง (เห็นไฟถนนยามฝนตก)
    {
      points: [
        { u: 0.533, v: 0.184 },
        { u: 1.0, v: 0.152 },
        { u: 1.0, v: 0.652 },
        { u: 0.533, v: 0.588 },
      ],
      minU: 0.542,
      maxU: 0.992,
      minV: 0.16,
      maxV: 0.648,
      sillVStart: 0.586,
      sillVEnd: 0.65,
    },
  ],
  night_porch: [
    // ฉากหน้าบ้านกลางสายฝน: ให้มีหยดน้ำไหลเบา ๆ เหมือนมองผ่านบานกระจกใสออกไปยังชานบ้าน
    {
      points: [
        { u: 0.0, v: 0.0 },
        { u: 1.0, v: 0.0 },
        { u: 1.0, v: 1.0 },
        { u: 0.0, v: 1.0 },
      ],
      minU: 0.02,
      maxU: 0.98,
      minV: 0.0,
      maxV: 0.96,
      sillVStart: 0.96,
      sillVEnd: 0.96,
    },
  ],
  warm_desk: [
    // บานกระจกซ้าย (ถัดจากตะเกียงแก้ว)
    {
      points: [
        { u: 0.084, v: 0.0 },
        { u: 0.176, v: 0.0 },
        { u: 0.176, v: 0.168 },
        { u: 0.084, v: 0.208 },
      ],
      minU: 0.088,
      maxU: 0.172,
      minV: 0.0,
      maxV: 0.205,
      sillVStart: 0.206,
      sillVEnd: 0.168,
    },
    // บานกระจกขวาบนของมุมซ้ายห้อง
    {
      points: [
        { u: 0.212, v: 0.0 },
        { u: 0.362, v: 0.0 },
        { u: 0.362, v: 0.088 },
        { u: 0.212, v: 0.156 },
      ],
      minU: 0.216,
      maxU: 0.358,
      minV: 0.0,
      maxV: 0.154,
      sillVStart: 0.154,
      sillVEnd: 0.088,
    },
  ],
};

/**
 * พิกัดถ้วยกาแฟในภาพพื้นหลังเพื่อให้มีไอร้อนลอยกรุ่นสอดคล้องกับภาพ
 */
const SCENE_MUGS: Record<LivingSceneId, NormalizedPoint | null> = {
  rainy_window: { u: 0.65, v: 0.728 },
  night_porch: null,
  warm_desk: { u: 0.146, v: 0.502 },
};

function computeCoverTransform(
  viewW: number,
  viewH: number,
  imgW: number,
  imgH: number,
  sceneId: LivingSceneId,
  driftX: number,
  driftY: number,
  driftScale: number
) {
  const isLandscapeViewport = viewW / Math.max(1, viewH) > 1.05;
  const isNarrowMobile = viewW / Math.max(1, viewH) < 0.8;

  // ปรับจุดโฟกัสของภาพให้เห็นทั้งเทียนและหน้าต่างฝนตกได้ชัดเจนทุกขนาดหน้าจอ
  let alignX = 0.5;
  let alignY = 0.5;

  if (sceneId === 'rainy_window' && isLandscapeViewport) {
    alignY = 0.58; // ให้เห็นทั้งเทียนบนโต๊ะและหน้าต่างสายฝนเต็มตาบนจอคอมพิวเตอร์
  } else if (sceneId === 'warm_desk' && isNarrowMobile) {
    alignX = 0.84; // บนจอมือถือแนวตั้ง ให้เห็นเทียนไขด้านขวาบนโต๊ะไม้ชัดเจน
  } else if (sceneId === 'night_porch' && isLandscapeViewport) {
    alignY = 0.44;
  }

  const baseScale = Math.max(viewW / imgW, viewH / imgH) * driftScale;
  const drawW = imgW * baseScale;
  const drawH = imgH * baseScale;
  const offsetX = (viewW - drawW) * alignX + driftX * viewW;
  const offsetY = (viewH - drawH) * alignY + driftY * viewH;

  return { offsetX, offsetY, drawW, drawH };
}

function getPaneBottomV(pane: WindowPanePolygon, u: number): number {
  const span = Math.max(0.001, pane.maxU - pane.minU);
  const t = Math.max(0, Math.min(1, (u - pane.minU) / span));
  return pane.sillVStart + t * (pane.sillVEnd - pane.sillVStart);
}

export function AmbientAtmosphere({
  sceneId,
  customBgUrl,
}: AmbientAtmosphereProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetSceneRef = useRef<LivingSceneId>(sceneId);
  const customUrlRef = useRef<string | undefined>(customBgUrl);

  useEffect(() => {
    targetSceneRef.current = sceneId;
    customUrlRef.current = customBgUrl;
  }, [sceneId, customBgUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // โหลดภาพพื้นหลังทั้ง 3 ฉากเก็บไว้ในหน่วยความจำเพื่อสลับฉากแบบนุ่มนวลทันที
    const loadedImages: Partial<Record<LivingSceneId, HTMLImageElement>> = {};
    let customImg: HTMLImageElement | null = null;

    (['rainy_window', 'night_porch', 'warm_desk'] as LivingSceneId[]).forEach(
      (id) => {
        const img = new Image();
        img.src = SCENE_URLS[id];
        img.onload = () => {
          loadedImages[id] = img;
        };
      }
    );

    if (customUrlRef.current) {
      const cImg = new Image();
      cImg.src = customUrlRef.current;
      cImg.onload = () => {
        customImg = cImg;
      };
    }

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let viewW = window.innerWidth;
    let viewH = window.innerHeight;

    const resizeCanvas = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      viewW = window.innerWidth;
      viewH = window.innerHeight;
      canvas.width = Math.round(viewW * dpr);
      canvas.height = Math.round(viewH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    // ขอบเขตรวมของหน้าต่างแต่ละฉากเพื่อให้สายฝนทุกเส้นตกอยู่ในช่องหน้าต่างเต็ม ๆ ไม่สูญเปล่า
    const getSceneRainBounds = (scene: LivingSceneId) => {
      const panes = SCENE_WINDOWS[scene];
      let minU = 1;
      let maxU = 0;
      let minV = 1;
      let maxV = 0;
      for (const p of panes) {
        if (p.minU < minU) minU = p.minU;
        if (p.maxU > maxU) maxU = p.maxU;
        if (p.minV < minV) minV = p.minV;
        if (p.maxV > maxV) maxV = p.maxV;
      }
      return { minU, maxU, minV, maxV };
    };

    const createRainStreaksForScene = (scene: LivingSceneId): RainStreak[] => {
      const b = getSceneRainBounds(scene);
      const count = scene === 'warm_desk' ? 75 : 110;
      return Array.from({ length: count }, () => {
        const depth = Math.random(); // 0 = ไกล, 1 = ใกล้หน้าต่าง
        return {
          u: b.minU + Math.random() * (b.maxU - b.minU),
          v: b.minV + Math.random() * (b.maxV - b.minV),
          lenV: (b.maxV - b.minV) * (0.06 + depth * 0.09),
          speedV: (b.maxV - b.minV) * (0.018 + depth * 0.024),
          windU: -(b.maxU - b.minU) * (0.0022 + depth * 0.002),
          alpha: 0.2 + depth * 0.38,
          thickness: 0.85 + depth * 1.15,
        };
      });
    };

    let activeSimScene: LivingSceneId = targetSceneRef.current;
    let prevDrawScene: LivingSceneId = targetSceneRef.current;
    let sceneFadeAlpha = 1;

    let rainStreaks: RainStreak[] = createRainStreaksForScene(activeSimScene);

    const createRivuletForScene = (
      scene: LivingSceneId,
      randomV = true,
      visTopV = 0,
      visBotV = 1
    ): WindowRivulet => {
      const panes = SCENE_WINDOWS[scene];
      const paneIndex =
        scene === 'rainy_window'
          ? Math.random() < 0.88
            ? 1
            : 0
          : Math.floor(Math.random() * panes.length);
      const pane = panes[paneIndex];
      const u =
        scene === 'night_porch'
          ? Math.random() < 0.5
            ? 0.02 + Math.random() * 0.24
            : 0.74 + Math.random() * 0.24
          : pane.minU + 0.008 + Math.random() * Math.max(0.01, pane.maxU - pane.minU - 0.016);

      const paneTop = Math.max(pane.minV, visTopV - 0.02);
      const maxBottom = Math.min(getPaneBottomV(pane, u), visBotV + 0.03);
      const safeTop = paneTop < maxBottom - 0.03 ? paneTop : pane.minV;
      const safeBottom = Math.max(safeTop + 0.03, getPaneBottomV(pane, u));

      const v = randomV
        ? safeTop + Math.random() * (safeBottom - safeTop)
        : safeTop + Math.random() * Math.min(0.04, (safeBottom - safeTop) * 0.25);

      return {
        paneIndex,
        u,
        v,
        radiusPx: 2.4 + Math.random() * 2.5,
        speedV: 0.00065 + Math.random() * 0.00135,
        pauseTimer: Math.random() < 0.3 ? Math.floor(Math.random() * 35) : 0,
        wobbleSeed: Math.random() * Math.PI * 2,
        alpha: 0.68 + Math.random() * 0.3,
        trail: [],
      };
    };

    let rivulets: WindowRivulet[] = Array.from({ length: 26 }, () =>
      createRivuletForScene(activeSimScene, true)
    );

    const createBeadsForScene = (scene: LivingSceneId): GlassBead[] => {
      const panes = SCENE_WINDOWS[scene];
      const count = scene === 'night_porch' ? 42 : 80;
      return Array.from({ length: count }, () => {
        const paneIndex =
          scene === 'rainy_window'
            ? Math.random() < 0.86
              ? 1
              : 0
            : Math.floor(Math.random() * panes.length);
        const pane = panes[paneIndex];
        const u =
          scene === 'night_porch'
            ? Math.random() < 0.5
              ? 0.015 + Math.random() * 0.25
              : 0.735 + Math.random() * 0.25
            : pane.minU + Math.random() * (pane.maxU - pane.minU);
        const maxBottom = getPaneBottomV(pane, u);
        const v =
          pane.minV + Math.random() * Math.max(0.02, maxBottom - pane.minV - 0.008);
        return {
          paneIndex,
          u,
          v,
          radiusPx: 1.1 + Math.random() * 2.0,
          alpha: 0.28 + Math.random() * 0.45,
          twinklePhase: Math.random() * Math.PI * 2,
        };
      });
    };

    let glassBeads: GlassBead[] = createBeadsForScene(activeSimScene);
    const sillRipples: SillRipple[] = [];

    // หยดน้ำไหลขอบหน้าต่างสำหรับจอมือถือแนวตั้งในหน้าโต๊ะจดหมาย
    const mobileEdgeDrops = Array.from({ length: 10 }, () => ({
      xFrac: Math.random() < 0.65 ? 0.02 + Math.random() * 0.16 : 0.82 + Math.random() * 0.16,
      yFrac: Math.random() * 0.55,
      speed: 0.0008 + Math.random() * 0.0012,
      radius: 2.3 + Math.random() * 1.8,
      seed: Math.random() * 10,
      trail: [] as Array<{ x: number; y: number }>,
    }));

    const steamPuffs: SteamPuff[] = Array.from({ length: 7 }, (_, i) => ({
      progress: i / 7,
      driftSeed: i * 1.7,
    }));

    const warmMotes: WarmMote[] = Array.from({ length: 28 }, () => ({
      xRatio: Math.random(),
      yRatio: Math.random(),
      radius: 1.3 + Math.random() * 2.4,
      vx: (Math.random() - 0.5) * 0.00025,
      vy: -0.00018 - Math.random() * 0.0003,
      alpha: 0.2 + Math.random() * 0.36,
      phase: Math.random() * Math.PI * 2,
    }));

    // วาดเปลวไฟเทียนที่กำลังขยับพริ้วไหวตามสายลมอย่างสมจริง
    const drawLivingCandleFlame = (
      candle: CandleSpec,
      tSec: number,
      offsetX: number,
      offsetY: number,
      drawW: number,
      drawH: number,
      sceneAlpha: number
    ) => {
      const t = tSec + candle.phaseOffset;
      const wx = offsetX + candle.wickU * drawW;
      const wy = offsetY + candle.wickV * drawH;
      const flameH = candle.flameHeightRatio * drawH;
      const flameW = candle.flameWidthRatio * drawW;

      // 1) กลบปลายเปลวไฟนิ่งในรูปต้นฉบับเพื่อให้เปลวไฟมีชีวิตโยกซ้าย-ขวาได้โดยไม่ซ้อนเป็นสองยอด
      const maskY = offsetY + (candle.wickV + candle.maskVOffset) * drawH;
      const maskR = candle.maskRadiusRatio * drawH;
      const coverGrad = ctx.createRadialGradient(wx, maskY, 0, wx, maskY, maskR);
      coverGrad.addColorStop(0, candle.maskColor);
      coverGrad.addColorStop(0.65, candle.maskColor);
      coverGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.save();
      ctx.globalAlpha = sceneAlpha;
      ctx.fillStyle = coverGrad;
      ctx.beginPath();
      ctx.arc(wx, maskY, maskR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // แรงลมธรรมชาติพัดเปลวเทียนให้ไหวเอนยืดหดมีชีวิตชีวา
      const gust =
        Math.sin(t * 1.05) * Math.pow(Math.max(0, Math.sin(t * 0.52)), 2) * 0.52;
      const sway =
        Math.sin(t * 3.1) * 0.32 +
        Math.sin(t * 7.2) * 0.16 +
        Math.cos(t * 11.6) * 0.08 +
        gust;
      const stretch =
        1 +
        Math.sin(t * 5.6) * 0.11 +
        Math.cos(t * 13.2) * 0.055 -
        Math.abs(sway) * 0.09;
      const flickerIntensity =
        0.88 + Math.sin(t * 7.8) * 0.09 + Math.cos(t * 16.4) * 0.05;

      const curH = flameH * stretch;
      const tipX = wx + sway * flameH * 0.65;
      const tipY = wy - curH;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = sceneAlpha * (candle.isReflection ? 0.55 : 1);

      // 2) รัศมีแสงเทียนส่องสว่างรอบโต๊ะและผนังห้อง (ขยับตามจังหวะเปลวไฟจริง)
      const auraR =
        candle.auraRadiusRatio * Math.max(drawW, drawH) * (0.95 + stretch * 0.06);
      const auraCenterY = wy - curH * 0.45;
      const auraGrad = ctx.createRadialGradient(
        wx + sway * 10,
        auraCenterY,
        0,
        wx,
        auraCenterY,
        auraR
      );
      const aAlpha = candle.auraAlpha * flickerIntensity;
      auraGrad.addColorStop(0, `rgba(255, 214, 136, ${aAlpha * 1.2})`);
      auraGrad.addColorStop(0.24, `rgba(248, 174, 80, ${aAlpha * 0.68})`);
      auraGrad.addColorStop(0.58, `rgba(214, 124, 42, ${aAlpha * 0.22})`);
      auraGrad.addColorStop(1, 'rgba(214, 124, 42, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(wx, auraCenterY, auraR, 0, Math.PI * 2);
      ctx.fill();

      // 3) รัศมีโกลว์สีส้มทองชั้นในรอบเปลวไฟ
      const innerHaloR = curH * 1.4;
      const innerHalo = ctx.createRadialGradient(
        (wx + tipX) * 0.5,
        wy - curH * 0.45,
        0,
        wx,
        wy - curH * 0.42,
        innerHaloR
      );
      innerHalo.addColorStop(0, `rgba(255, 200, 102, ${0.46 * flickerIntensity})`);
      innerHalo.addColorStop(0.5, `rgba(242, 134, 42, ${0.18 * flickerIntensity})`);
      innerHalo.addColorStop(1, 'rgba(242, 134, 42, 0)');
      ctx.fillStyle = innerHalo;
      ctx.beginPath();
      ctx.arc(wx, wy - curH * 0.42, innerHaloR, 0, Math.PI * 2);
      ctx.fill();

      // 4) เปลวไฟชั้นนอกทรงหยดน้ำพริ้วไหว (สีส้มทองไล่เฉด)
      const midSwayX = wx + sway * flameH * 0.28;
      const outerGrad = ctx.createLinearGradient(wx, wy + 2, tipX, tipY);
      outerGrad.addColorStop(0, 'rgba(120, 160, 255, 0.38)');
      outerGrad.addColorStop(0.16, 'rgba(255, 168, 56, 0.95)');
      outerGrad.addColorStop(0.65, 'rgba(255, 218, 114, 0.96)');
      outerGrad.addColorStop(1, 'rgba(255, 138, 34, 0.14)');

      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.moveTo(wx, wy + 1.5);
      ctx.bezierCurveTo(
        wx - flameW * 0.7,
        wy - curH * 0.14,
        midSwayX - flameW * 0.46,
        wy - curH * 0.66,
        tipX,
        tipY
      );
      ctx.bezierCurveTo(
        midSwayX + flameW * 0.46,
        wy - curH * 0.66,
        wx + flameW * 0.7,
        wy - curH * 0.14,
        wx,
        wy + 1.5
      );
      ctx.fill();

      // 5) แกนกลางเปลวไฟสีขาวนวลสว่างจ้าพริ้วตามด้านใน
      const coreH = curH * 0.66;
      const coreW = flameW * 0.39;
      const coreTipX = wx + sway * flameH * 0.38;
      const coreTipY = wy - coreH;
      const coreGrad = ctx.createLinearGradient(wx, wy, coreTipX, coreTipY);
      coreGrad.addColorStop(0, 'rgba(255, 250, 232, 0.96)');
      coreGrad.addColorStop(0.72, 'rgba(255, 254, 242, 0.98)');
      coreGrad.addColorStop(1, 'rgba(255, 234, 170, 0.26)');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.bezierCurveTo(
        wx - coreW * 0.65,
        wy - coreH * 0.18,
        wx + sway * flameH * 0.17 - coreW * 0.35,
        wy - coreH * 0.68,
        coreTipX,
        coreTipY
      );
      ctx.bezierCurveTo(
        wx + sway * flameH * 0.17 + coreW * 0.35,
        wy - coreH * 0.68,
        wx + coreW * 0.65,
        wy - coreH * 0.18,
        wx,
        wy
      );
      ctx.fill();

      ctx.restore();
    };

    // วาดสายฝนและหยดน้ำไหลเป็นทางลงมาตามกระจกหน้าต่าง
    const drawSceneWeatherAndCandle = (
      scene: LivingSceneId,
      tSec: number,
      offsetX: number,
      offsetY: number,
      drawW: number,
      drawH: number,
      alpha: number,
      shouldUpdatePhysics: boolean
    ) => {
      const panes = SCENE_WINDOWS[scene];
      const rainBounds = getSceneRainBounds(scene);
      const visTopV = Math.max(0, -offsetY / drawH);
      const visBotV = Math.min(1, (viewH - offsetY) / drawH);

      // A) วาดสายฝนตกด้านนอกหน้าต่าง (ตัดขอบตามกรอบบานหน้าต่างจริงอย่างแม่นยำ)
      ctx.save();
      ctx.beginPath();
      for (let p = 0; p < panes.length; p++) {
        const pts = panes[p].points;
        ctx.moveTo(offsetX + pts[0].u * drawW, offsetY + pts[0].v * drawH);
        for (let k = 1; k < pts.length; k++) {
          ctx.lineTo(offsetX + pts[k].u * drawW, offsetY + pts[k].v * drawH);
        }
        ctx.closePath();
      }
      ctx.clip();

      ctx.lineCap = 'round';
      for (let i = 0; i < rainStreaks.length; i++) {
        const r = rainStreaks[i];
        const x1 = offsetX + r.u * drawW;
        const y1 = offsetY + r.v * drawH;
        const x2 = offsetX + (r.u + r.windU * 2.8) * drawW;
        const y2 = offsetY + (r.v + r.lenV) * drawH;

        const rainGrad = ctx.createLinearGradient(x1, y1, x2, y2);
        rainGrad.addColorStop(0, 'rgba(205, 222, 242, 0)');
        rainGrad.addColorStop(
          0.55,
          `rgba(222, 234, 248, ${r.alpha * alpha * 0.9})`
        );
        rainGrad.addColorStop(
          1,
          `rgba(250, 240, 224, ${r.alpha * alpha * 1.15})`
        );

        ctx.strokeStyle = rainGrad;
        ctx.lineWidth = r.thickness;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        if (shouldUpdatePhysics) {
          r.u += r.windU;
          r.v += r.speedV;
          if (r.v > rainBounds.maxV + 0.03) {
            r.v = rainBounds.minV - r.lenV;
            r.u =
              rainBounds.minU +
              Math.random() * (rainBounds.maxU - rainBounds.minU + 0.04);
          }
          if (r.u < rainBounds.minU - 0.03) {
            r.u = rainBounds.maxU;
          }
        }
      }

      // B) หยดไอน้ำเล็ก ๆ เกาะพราวบนผิวกระจกหน้าต่าง
      for (let i = 0; i < glassBeads.length; i++) {
        const b = glassBeads[i];
        const bx = offsetX + b.u * drawW;
        const by = offsetY + b.v * drawH;
        const twinkle = 0.7 + 0.3 * Math.sin(tSec * 2.4 + b.twinklePhase);
        const bAlpha = b.alpha * twinkle * alpha;

        ctx.fillStyle = `rgba(12, 18, 28, ${bAlpha * 0.55})`;
        ctx.beginPath();
        ctx.arc(bx, by - 0.5, b.radiusPx, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(252, 234, 202, ${bAlpha * 0.88})`;
        ctx.beginPath();
        ctx.arc(bx + 0.4, by + 0.5, b.radiusPx * 0.65, 0, Math.PI * 2);
        ctx.fill();
      }

      // C) สายน้ำและหยดน้ำฝนไหลเลื้อยลงมาตามบานหน้าต่าง (Window Rivulets)
      for (let i = 0; i < rivulets.length; i++) {
        const drop = rivulets[i];
        const pane = panes[drop.paneIndex] || panes[0];

        if (shouldUpdatePhysics) {
          if (drop.pauseTimer > 0) {
            drop.pauseTimer -= 1;
          } else {
            const surge =
              0.5 +
              0.95 *
                Math.pow(
                  0.5 + 0.5 * Math.sin(tSec * 3.3 + drop.wobbleSeed * 2.1),
                  2
                );
            const dv = drop.speedV * surge;
            const du =
              Math.sin(drop.v * 52 + drop.wobbleSeed) * 0.00045 - 0.00004;

            drop.v += dv;
            drop.u = Math.max(
              pane.minU + 0.005,
              Math.min(pane.maxU - 0.005, drop.u + du)
            );

            const lastNode = drop.trail[drop.trail.length - 1];
            if (
              !lastNode ||
              Math.hypot(drop.u - lastNode.u, drop.v - lastNode.v) > 0.0038
            ) {
              drop.trail.push({ u: drop.u, v: drop.v });
              if (drop.trail.length > 38) {
                drop.trail.shift();
              }
            }

            if (Math.random() < 0.011) {
              drop.pauseTimer = 8 + Math.floor(Math.random() * 20);
            }

            for (let bIdx = 0; bIdx < glassBeads.length; bIdx++) {
              const bead = glassBeads[bIdx];
              if (
                bead.paneIndex === drop.paneIndex &&
                Math.abs(bead.u - drop.u) < 0.009 &&
                Math.abs(bead.v - drop.v) < 0.009
              ) {
                bead.v =
                  pane.minV +
                  Math.random() *
                    Math.max(0.02, getPaneBottomV(pane, bead.u) - pane.minV);
                drop.radiusPx = Math.min(4.8, drop.radiusPx + 0.14);
              }
            }

            const bottomLimit = getPaneBottomV(pane, drop.u);
            if (drop.v >= bottomLimit || drop.v > visBotV + 0.05) {
              if (
                scene !== 'night_porch' &&
                drop.v >= bottomLimit &&
                sillRipples.length < 12
              ) {
                sillRipples.push({
                  u: drop.u,
                  v: bottomLimit + 0.014,
                  progress: 0,
                });
              }
              rivulets[i] = createRivuletForScene(
                scene,
                false,
                visTopV,
                visBotV
              );
              continue;
            }
          }
        }

        // วาดรอยทางน้ำเปียกใสแวววาวแบบหักเหแสงคู่ (เงาเข้ม + เส้นแสงสะท้อน)
        if (drop.trail.length > 1) {
          for (let tIdx = 1; tIdx < drop.trail.length; tIdx++) {
            const p0 = drop.trail[tIdx - 1];
            const p1 = drop.trail[tIdx];
            const frac = tIdx / drop.trail.length;
            const x0 = offsetX + p0.u * drawW;
            const y0 = offsetY + p0.v * drawH;
            const x1 = offsetX + p1.u * drawW;
            const y1 = offsetY + p1.v * drawH;

            ctx.strokeStyle = `rgba(14, 22, 34, ${frac * 0.28 * drop.alpha * alpha})`;
            ctx.lineWidth = Math.max(1.1, drop.radiusPx * 0.72 * frac);
            ctx.beginPath();
            ctx.moveTo(x0 - 0.6, y0);
            ctx.lineTo(x1 - 0.6, y1);
            ctx.stroke();

            ctx.strokeStyle = `rgba(250, 238, 216, ${frac * 0.46 * drop.alpha * alpha})`;
            ctx.lineWidth = Math.max(0.85, drop.radiusPx * 0.48 * frac);
            ctx.beginPath();
            ctx.moveTo(x0 + 0.5, y0);
            ctx.lineTo(x1 + 0.5, y1);
            ctx.stroke();
          }
        }

        // วาดหัวหยดน้ำกลมนูนมีมิติสะท้อนแสงไฟและแสงเทียน
        const dx = offsetX + drop.u * drawW;
        const dy = offsetY + drop.v * drawH;
        const rPx = drop.radiusPx;

        ctx.fillStyle = `rgba(12, 18, 28, ${0.58 * drop.alpha * alpha})`;
        ctx.beginPath();
        ctx.ellipse(dx, dy - 0.7, rPx * 0.94, rPx * 1.22, 0, 0, Math.PI * 2);
        ctx.fill();

        const dropGrad = ctx.createRadialGradient(
          dx + rPx * 0.3,
          dy + rPx * 0.38,
          0.2,
          dx,
          dy,
          rPx * 1.2
        );
        dropGrad.addColorStop(
          0,
          `rgba(255, 248, 224, ${0.98 * drop.alpha * alpha})`
        );
        dropGrad.addColorStop(
          0.55,
          `rgba(232, 206, 168, ${0.62 * drop.alpha * alpha})`
        );
        dropGrad.addColorStop(1, 'rgba(140, 160, 185, 0)');
        ctx.fillStyle = dropGrad;
        ctx.beginPath();
        ctx.ellipse(dx, dy, rPx * 0.9, rPx * 1.16, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // D) วงกระเพื่อมน้ำเล็ก ๆ บนขอบหน้าต่างไม้
      for (let i = sillRipples.length - 1; i >= 0; i--) {
        const rp = sillRipples[i];
        const rx = offsetX + rp.u * drawW;
        const ry = offsetY + rp.v * drawH;
        const rpAlpha = (1 - rp.progress) * 0.48 * alpha;
        ctx.strokeStyle = `rgba(242, 232, 218, ${rpAlpha})`;
        ctx.lineWidth = 1.05;
        ctx.beginPath();
        ctx.ellipse(
          rx,
          ry,
          2 + rp.progress * 10,
          0.8 + rp.progress * 3.4,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();

        if (shouldUpdatePhysics) {
          rp.progress += 0.03;
          if (rp.progress >= 1) {
            sillRipples.splice(i, 1);
          }
        }
      }

      // E) กรณีจอมือถือแนวตั้งในฉากโต๊ะไม้ ให้มีหยดน้ำไหลบาง ๆ ที่ขอบบนซ้าย-ขวา
      if (scene === 'warm_desk' && viewW / Math.max(1, viewH) < 0.8) {
        for (let i = 0; i < mobileEdgeDrops.length; i++) {
          const md = mobileEdgeDrops[i];
          if (shouldUpdatePhysics) {
            md.yFrac += md.speed * (0.65 + 0.5 * Math.sin(tSec * 2.8 + md.seed));
            md.xFrac += Math.sin(md.yFrac * 35 + md.seed) * 0.00045;
            md.trail.push({ x: md.xFrac * viewW, y: md.yFrac * viewH });
            if (md.trail.length > 22) md.trail.shift();
            if (md.yFrac > 0.56) {
              md.yFrac = -0.02;
              md.xFrac =
                Math.random() < 0.65
                  ? 0.02 + Math.random() * 0.16
                  : 0.82 + Math.random() * 0.16;
              md.trail = [];
            }
          }
          for (let k = 1; k < md.trail.length; k++) {
            const frac = k / md.trail.length;
            ctx.strokeStyle = `rgba(244, 232, 214, ${frac * 0.28 * alpha})`;
            ctx.lineWidth = md.radius * 0.52 * frac;
            ctx.beginPath();
            ctx.moveTo(md.trail[k - 1].x, md.trail[k - 1].y);
            ctx.lineTo(md.trail[k].x, md.trail[k].y);
            ctx.stroke();
          }
          const mx = md.xFrac * viewW;
          const my = md.yFrac * viewH;
          ctx.fillStyle = `rgba(255, 242, 214, ${0.68 * alpha})`;
          ctx.beginPath();
          ctx.ellipse(mx, my, md.radius * 0.85, md.radius * 1.15, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // F) ไอร้อนนุ่มนวลลอยขึ้นจากแก้วกาแฟที่วาดอยู่ในภาพพื้นหลัง
      const mug = SCENE_MUGS[scene];
      if (mug) {
        const mugX = offsetX + mug.u * drawW;
        const mugY = offsetY + mug.v * drawH;
        const maxRise = 0.095 * drawH;

        for (let i = 0; i < steamPuffs.length; i++) {
          const sp = steamPuffs[i];
          if (shouldUpdatePhysics) {
            sp.progress = (sp.progress + 0.0034) % 1;
          }
          const p = sp.progress;
          const sy = mugY - p * maxRise;
          const sx =
            mugX +
            Math.sin(p * Math.PI * 2.2 + tSec * 1.15 + sp.driftSeed) *
              (8 + p * 15);
          const sRadius = (10 + p * 26) * (drawH / 900);
          const sAlpha = Math.sin(p * Math.PI) * 0.15 * alpha;

          const steamGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sRadius);
          steamGrad.addColorStop(0, `rgba(250, 242, 232, ${sAlpha})`);
          steamGrad.addColorStop(1, 'rgba(250, 242, 232, 0)');
          ctx.fillStyle = steamGrad;
          ctx.beginPath();
          ctx.arc(sx, sy, sRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // G) เปลวไฟเทียนขยับพริ้วไหวและส่องแสงวูบวาบอบอุ่น
      const candles = SCENE_CANDLES[scene];
      for (let c = 0; c < candles.length; c++) {
        drawLivingCandleFlame(
          candles[c],
          tSec,
          offsetX,
          offsetY,
          drawW,
          drawH,
          alpha
        );
      }
    };

    let rafId = 0;
    const startTime = performance.now();

    const renderLoop = (now: number) => {
      const tSec = (now - startTime) * 0.001;

      if (targetSceneRef.current !== activeSimScene) {
        prevDrawScene = activeSimScene;
        activeSimScene = targetSceneRef.current;
        sceneFadeAlpha = 0;
        rainStreaks = createRainStreaksForScene(activeSimScene);
        rivulets = Array.from({ length: 26 }, () =>
          createRivuletForScene(activeSimScene, true)
        );
        glassBeads = createBeadsForScene(activeSimScene);
        sillRipples.length = 0;
      }

      if (sceneFadeAlpha < 1) {
        sceneFadeAlpha = Math.min(1, sceneFadeAlpha + 0.038);
      }

      ctx.fillStyle = '#0F0D0C';
      ctx.fillRect(0, 0, viewW, viewH);

      const driftScale = 1.032 + Math.sin(tSec * 0.22) * 0.014;
      const driftX = Math.sin(tSec * 0.17) * 0.006;
      const driftY = Math.cos(tSec * 0.14) * 0.005;

      const drawBaseImage = (scene: LivingSceneId, alpha: number) => {
        const img = customImg || loadedImages[scene];
        if (!img || !img.naturalWidth) return null;

        const transform = computeCoverTransform(
          viewW,
          viewH,
          img.naturalWidth,
          img.naturalHeight,
          scene,
          driftX,
          driftY,
          driftScale
        );

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(
          img,
          transform.offsetX,
          transform.offsetY,
          transform.drawW,
          transform.drawH
        );
        ctx.restore();
        return transform;
      };

      const prevTransform =
        sceneFadeAlpha < 1 && prevDrawScene !== activeSimScene
          ? drawBaseImage(prevDrawScene, 1)
          : null;
      const activeTransform = drawBaseImage(activeSimScene, sceneFadeAlpha);

      // แผ่นกรองแสงนุ่มนวลรองรับให้อ่านตัวหนังสือชัดเจน โดยไม่บดบังความสว่างของเปลวเทียนและหยดน้ำ
      const scrim = ctx.createLinearGradient(0, 0, 0, viewH);
      scrim.addColorStop(0, 'rgba(10, 8, 7, 0.5)');
      scrim.addColorStop(0.5, 'rgba(10, 8, 7, 0.34)');
      scrim.addColorStop(1, 'rgba(10, 8, 7, 0.64)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, viewW, viewH);

      // วาดสายฝน หยดน้ำไหลตามหน้าต่าง และเปลวไฟเทียนสดใสเหนือแผ่นกรองแสงเพื่อให้เห็นชัดเจนมีชีวิตชีวา
      if (!customImg) {
        if (prevTransform && sceneFadeAlpha < 1) {
          drawSceneWeatherAndCandle(
            prevDrawScene,
            tSec,
            prevTransform.offsetX,
            prevTransform.offsetY,
            prevTransform.drawW,
            prevTransform.drawH,
            1 - sceneFadeAlpha,
            false
          );
        }
        if (activeTransform) {
          drawSceneWeatherAndCandle(
            activeSimScene,
            tSec,
            activeTransform.offsetX,
            activeTransform.offsetY,
            activeTransform.drawW,
            activeTransform.drawH,
            sceneFadeAlpha,
            true
          );
        }
      }

      // ละอองแสงสีทองอบอุ่นลอยเอื่อยในอากาศ
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < warmMotes.length; i++) {
        const m = warmMotes[i];
        m.phase += 0.022;
        m.xRatio += m.vx + Math.sin(m.phase * 0.6) * 0.00012;
        m.yRatio += m.vy;
        if (m.yRatio < -0.03) {
          m.yRatio = 1.03;
          m.xRatio = Math.random();
        }
        if (m.xRatio < -0.03) m.xRatio = 1.03;
        if (m.xRatio > 1.03) m.xRatio = -0.03;

        const mx = m.xRatio * viewW;
        const my = m.yRatio * viewH;
        const pulse = 0.5 + 0.5 * Math.sin(m.phase);
        const ma = m.alpha * pulse;

        const mg = ctx.createRadialGradient(mx, my, 0, mx, my, m.radius * 3.8);
        mg.addColorStop(0, `rgba(255, 226, 168, ${ma})`);
        mg.addColorStop(0.5, `rgba(238, 182, 98, ${ma * 0.38})`);
        mg.addColorStop(1, 'rgba(238, 182, 98, 0)');
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(mx, my, m.radius * 3.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      rafId = window.requestAnimationFrame(renderLoop);
    };

    rafId = window.requestAnimationFrame(renderLoop);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#0F0D0C]"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
