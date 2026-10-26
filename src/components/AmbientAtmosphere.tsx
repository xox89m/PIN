import React, { useEffect, useState } from 'react';
import rainyWindowBg from '../assets/images/rainy_window_candle_desk_1792837371636.jpg';
import nightPorchBg from '../assets/images/rainy_night_house_porch_1792837373495.jpg';
import warmDeskBg from '../assets/images/warm_wooden_desk_candlelight_1792837373650.jpg';

export type LivingSceneId = 'rainy_window' | 'night_porch' | 'warm_desk';

interface AmbientAtmosphereProps {
  sceneId: LivingSceneId;
  customBgUrl?: string;
}

interface SceneLayerConfig {
  id: LivingSceneId;
  src: string;
  objectPositionClass: string;
}

const SCENE_LAYERS: SceneLayerConfig[] = [
  {
    id: 'rainy_window',
    src: rainyWindowBg,
    objectPositionClass: 'object-center md:object-[center_62%]',
  },
  {
    id: 'night_porch',
    src: nightPorchBg,
    objectPositionClass: 'object-[center_48%]',
  },
  {
    id: 'warm_desk',
    src: warmDeskBg,
    objectPositionClass: 'object-[70%_center] md:object-center',
  },
];

export function AmbientAtmosphere({
  sceneId,
  customBgUrl,
}: AmbientAtmosphereProps) {
  const [customBgFailed, setCustomBgFailed] = useState(false);

  useEffect(() => {
    setCustomBgFailed(false);
  }, [customBgUrl]);

  const showCustomBg = Boolean(customBgUrl && !customBgFailed);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none bg-[#0F0D0C]"
    >
      {/* พื้นหลังภาพวาดต้นฉบับทั้ง 3 ฉาก แสดงผลทันทีผ่าน DOM <img> แบบนุ่มนวลและไม่มีเอฟเฟกต์ฝน */}
      {showCustomBg ? (
        <img
          src={customBgUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setCustomBgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover object-center animate-ken-burns"
        />
      ) : (
        SCENE_LAYERS.map((layer) => {
          const isActive = sceneId === layer.id;
          return (
            <img
              key={layer.id}
              src={layer.src}
              alt=""
              referrerPolicy="no-referrer"
              decoding="async"
              fetchPriority={layer.id === 'rainy_window' ? 'high' : 'auto'}
              className={`absolute inset-0 w-full h-full object-cover ${layer.objectPositionClass} animate-ken-burns transition-opacity duration-700 ease-out ${
                isActive ? 'opacity-100' : 'opacity-0'
              }`}
            />
          );
        })
      )}

      {/* แสงเทียนอุ่นนุ่มนวลแบบเดิมตามตำแหน่งเทียนในแต่ละฉาก */}
      {sceneId === 'rainy_window' && (
        <>
          <div className="candle-ambient-glow absolute -bottom-16 -left-16 w-[26rem] h-[26rem] sm:w-[34rem] sm:h-[34rem] rounded-full" />
          <div className="candle-ambient-glow-delayed absolute top-1/4 right-6 w-[18rem] h-[18rem] sm:w-[24rem] sm:h-[24rem] rounded-full" />
        </>
      )}

      {sceneId === 'night_porch' && (
        <div className="candle-ambient-glow absolute top-[18%] left-1/2 -translate-x-1/2 w-[24rem] h-[24rem] sm:w-[32rem] sm:h-[32rem] rounded-full" />
      )}

      {sceneId === 'warm_desk' && (
        <>
          <div className="candle-ambient-glow absolute -top-10 -right-12 w-[26rem] h-[26rem] sm:w-[36rem] sm:h-[36rem] rounded-full" />
          <div className="candle-ambient-glow-delayed absolute bottom-4 left-4 w-[20rem] h-[20rem] sm:w-[28rem] sm:h-[28rem] rounded-full" />
        </>
      )}

      {/* เงาไล่ระดับบางเบาเพื่อให้เห็นรายละเอียดภาพวาดต้นฉบับชัดเจนและอ่านตัวอักษรสบายตา */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/15 to-black/50" />
    </div>
  );
}
