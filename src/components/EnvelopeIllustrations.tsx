import React from 'react';
import { APP_CONFIG } from '../config';

/**
 * ภาพวาดประกอบบนโต๊ะจดหมาย:
 * 1. ปากกาหมึกซึมน้ำเงินเข้มขลิบทอง
 * 2. ซองจดหมายสีเหลืองทอง (จดหมายขอโทษ)
 * 3. แก้วกาแฟอุ่น ๆ คู่กับซองจดหมายวันเกิด (H.B.D. 28/10/2026)
 * 4. กล่องไม้ใส่จดหมายด้านข้าง และไอคอนซองจดหมายขนาดเล็กในรายการ
 */

export function HandDrawnPenIllustration({ className = '' }: { className?: string }) {
  const customUrl = APP_CONFIG.customVisualAssets.handDrawnPenUrl;

  if (customUrl) {
    return (
      <img
        src={customUrl}
        alt="ปากกาวาดมือบนโต๊ะจดหมาย"
        referrerPolicy="no-referrer"
        className={`object-contain select-none ${className}`}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 240 54"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${className}`}
      aria-label="ปากกาหมึกซึมวาดมือ"
    >
      <path
        d="M24 44 C82 47, 174 45, 228 42"
        stroke="rgba(0, 0, 0, 0.45)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M52 21 C105 19.5, 174 20.5, 224 22.5 C231 23, 234 26.5, 233.5 30 C233 34, 229 36.5, 222 37 C171 38, 104 37.5, 52 35.5 Z"
        fill="#1F2C4C"
        stroke="#120E0B"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M168 19.5 C188 15, 210 15.5, 218 19.5"
        stroke="#E5B968"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M44 22 L53 21 L53 35.5 L44 34.5 Z"
        fill="#E5B968"
        stroke="#120E0B"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M44 22.5 L15 28.5 L44 34 Z"
        fill="#F2D594"
        stroke="#120E0B"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M15 28.5 L31 28.5"
        stroke="#120E0B"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="32" cy="28.5" r="1.7" fill="#120E0B" />
    </svg>
  );
}

interface GoldenEnvelopeProps {
  isOpen: boolean;
  isLetterPulledOut: boolean;
  isFoldingBack?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export function GoldenEnvelopeIllustration({
  isOpen,
  isLetterPulledOut,
  isFoldingBack = false,
  onClick,
  disabled = false,
}: GoldenEnvelopeProps) {
  const closedCustomUrl = APP_CONFIG.customVisualAssets.envelopeClosedUrl;
  const openCustomUrl = APP_CONFIG.customVisualAssets.envelopeOpenUrl;

  if (closedCustomUrl && !isOpen) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="group relative block w-full max-w-[290px] mx-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F4EBE1] rounded-2xl cursor-pointer transition-transform duration-200 hover:-translate-y-1"
        aria-label="เปิดซองจดหมายขอโทษ"
      >
        <img
          src={closedCustomUrl}
          alt="ซองจดหมายสีเหลืองทองปิดอยู่"
          referrerPolicy="no-referrer"
          className="w-full h-auto object-contain"
        />
      </button>
    );
  }

  if (openCustomUrl && isOpen) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="group relative block w-full max-w-[290px] mx-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F4EBE1] rounded-2xl cursor-pointer"
        aria-label="ซองจดหมายเปิดอยู่"
      >
        <img
          src={openCustomUrl}
          alt="ซองจดหมายสีเหลืองทองเปิดออก"
          referrerPolicy="no-referrer"
          className="w-full h-auto object-contain"
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isOpen ? 'ซองจดหมายขอโทษเปิดอยู่' : 'แตะเพื่อเปิดอ่านจดหมายขอโทษ'}
      className={`group relative block w-full max-w-[290px] mx-auto select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F4EBE1] rounded-2xl ${
        disabled ? 'cursor-default' : 'cursor-pointer'
      }`}
    >
      <div className="relative pt-10 pb-2 -rotate-2 transition-transform duration-300 ease-out group-hover:-translate-y-1.5 group-hover:rotate-0">
        <svg
          viewBox="0 0 380 270"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto overflow-visible drop-shadow-[0_18px_32px_rgba(0,0,0,0.68)]"
        >
          {/* ด้านในซองสีน้ำตาลทองอบอุ่น */}
          <path
            d="M24 86 C135 84, 245 85, 356 86 L354 248 C245 251, 132 250, 26 248 Z"
            fill="#A87632"
            stroke="#24170E"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />

          {/* ฝาซองเมื่อเปิดออก */}
          <g
            className="transition-all duration-500 ease-out origin-[190px_86px]"
            style={{
              opacity: isOpen ? 1 : 0,
              transform: isOpen ? 'scaleY(1)' : 'scaleY(0.1)',
            }}
          >
            <path
              d="M24 86 L186 12 C190 9, 194 9, 198 12 L356 86 Z"
              fill="#E5B664"
              stroke="#24170E"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
          </g>

          {/* กระดาษด้านในซอง */}
          <g
            className="transition-transform duration-700 ease-out"
            style={{
              transform: isFoldingBack
                ? 'translateY(30px) scale(0.94)'
                : isLetterPulledOut
                ? 'translateY(-44px)'
                : isOpen
                ? 'translateY(-20px)'
                : 'translateY(26px)',
              opacity: isOpen || isFoldingBack ? 1 : 0,
            }}
          >
            <path
              d="M54 52 L322 46 L326 220 L58 222 Z"
              fill="#DCE6EE"
              stroke="#24170E"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path
              d="M80 82 L212 79 M80 104 L292 100 M80 124 L276 121 M80 144 L236 142"
              stroke="#8A9FB2"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </g>

          {/* ตัวซองจดหมายสีเหลืองทองแอมเบอร์ */}
          <path
            d="M24 86 L190 180 L356 86 L354 248 C246 251, 134 250, 26 248 Z"
            fill="#D8A24A"
            stroke="#24170E"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />

          {/* เส้นรอยพับซอง */}
          <path
            d="M26 247 L156 161 M354 247 L224 161"
            stroke="#24170E"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.7"
          />

          {/* ฝาซองปิดสนิทพร้อมหัวใจตรงกลาง */}
          <g
            className="transition-opacity duration-300 ease-out"
            style={{
              opacity: isOpen ? 0 : 1,
              pointerEvents: isOpen ? 'none' : 'auto',
            }}
          >
            <path
              d="M24 86 L184 186 C188 189, 192 189, 196 186 L356 86 Z"
              fill="#E7B866"
              stroke="#24170E"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <path
              d="M190 194 C190 194, 177 185, 177 177.5 C177 173, 181 170.5, 185 172.5 C187.5 173.8, 189 175.8, 190 177.5 C191 175.8, 192.5 173.8, 195 172.5 C199 170.5, 203 173, 203 177.5 C203 185, 190 194, 190 194 Z"
              fill="#B35C44"
              stroke="#24170E"
              strokeWidth="2"
            />
          </g>
        </svg>
      </div>
    </button>
  );
}

interface BirthdayEnvelopeNearCoffeeProps {
  isOpen: boolean;
  isLetterPulledOut: boolean;
  onClick?: () => void;
}

/**
 * ซองจดหมายวันเกิดสีครีมอบอุ่นผูกริบบิ้นทองและผนึกหัวใจสีขาว วางคู่กับแก้วกาแฟอุ่น ๆ บนโต๊ะไม้
 */
export function CoffeeAndBirthdayEnvelopeIllustration({
  isOpen,
  isLetterPulledOut,
  onClick,
}: BirthdayEnvelopeNearCoffeeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="แตะเพื่อเปิดอ่านจดหมายสุขสันต์วันเกิด H.B.D. 28/10/2026 ที่วางอยู่ใกล้แก้วกาแฟ"
      className="group relative block w-full max-w-[320px] mx-auto select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F4EBE1] rounded-2xl cursor-pointer"
    >
      <div className="relative pt-8 pb-2 rotate-1 transition-transform duration-300 ease-out group-hover:-translate-y-1.5 group-hover:rotate-0">
        <svg
          viewBox="0 0 420 265"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto overflow-visible drop-shadow-[0_18px_30px_rgba(0,0,0,0.68)]"
        >
          {/* แก้วกาแฟเซรามิกสีน้ำตาลครีมอุ่น ๆ ด้านซ้ายมือ พร้อมไอร้อนบางเบา */}
          <g aria-hidden="true">
            {/* ไอร้อนเหนือแก้วกาแฟ */}
            <path
              d="M58 64 C52 50, 66 42, 60 28"
              stroke="#F4EBE1"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.55"
            />
            <path
              d="M78 58 C72 44, 86 35, 80 20"
              stroke="#F4EBE1"
              strokeWidth="2.2"
              strokeLinecap="round"
              opacity="0.65"
            />
            <path
              d="M97 66 C92 54, 103 46, 98 34"
              stroke="#F4EBE1"
              strokeWidth="1.8"
              strokeLinecap="round"
              opacity="0.45"
            />

            {/* จานรองแก้วไม้/เซรามิก */}
            <ellipse
              cx="76"
              cy="176"
              rx="64"
              ry="20"
              fill="#6E4E35"
              stroke="#24170E"
              strokeWidth="2.4"
            />
            <ellipse
              cx="76"
              cy="173"
              rx="46"
              ry="12"
              fill="#533925"
              opacity="0.65"
            />

            {/* หูจับแก้วกาแฟ */}
            <path
              d="M25 112 C6 112, 5 148, 28 150"
              stroke="#D8C3AC"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <path
              d="M25 112 C6 112, 5 148, 28 150"
              stroke="#24170E"
              strokeWidth="2.4"
              strokeLinecap="round"
            />

            {/* ตัวแก้วเซรามิก */}
            <path
              d="M26 98 L126 98 C126 142, 114 170, 76 170 C38 170, 26 142, 26 98 Z"
              fill="#DFCBB5"
              stroke="#24170E"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {/* ขอบปากแก้วและผิวกาแฟร้อน */}
            <ellipse
              cx="76"
              cy="98"
              rx="50"
              ry="15"
              fill="#EFE3D3"
              stroke="#24170E"
              strokeWidth="2.4"
            />
            <ellipse cx="76" cy="99" rx="42" ry="10.5" fill="#4B2E1B" />
            {/* ฟองนมลาเต้อ่อน ๆ */}
            <path
              d="M54 98 C64 94, 88 94, 98 99"
              stroke="#C89F74"
              strokeWidth="2.2"
              strokeLinecap="round"
              opacity="0.75"
            />
          </g>

          {/* ซองจดหมายวันเกิดวางพิงอยู่ข้างแก้วกาแฟ (ขวาของแก้ว) */}
          <g transform="translate(116, 18)">
            {/* ด้านในซองสีน้ำตาลคาราเมล */}
            <path
              d="M18 78 C108 76, 198 77, 288 78 L286 222 C196 225, 108 224, 20 222 Z"
              fill="#B5895A"
              stroke="#24170E"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />

            {/* ฝาซองเมื่อเปิดออก */}
            <g
              className="transition-all duration-500 ease-out origin-[153px_78px]"
              style={{
                opacity: isOpen ? 1 : 0,
                transform: isOpen ? 'scaleY(1)' : 'scaleY(0.1)',
              }}
            >
              <path
                d="M18 78 L149 12 C153 9, 157 9, 161 12 L288 78 Z"
                fill="#F0E2CE"
                stroke="#24170E"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            </g>

            {/* กระดาษการ์ดวันเกิดด้านใน */}
            <g
              className="transition-transform duration-700 ease-out"
              style={{
                transform: isLetterPulledOut
                  ? 'translateY(-38px)'
                  : isOpen
                  ? 'translateY(-18px)'
                  : 'translateY(22px)',
                opacity: isOpen ? 1 : 0,
              }}
            >
              <path
                d="M42 46 L262 42 L265 198 L45 200 Z"
                fill="#FFF9F0"
                stroke="#24170E"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M66 74 L188 72 M66 94 L238 92 M66 114 L218 112"
                stroke="#C9A882"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>

            {/* ตัวซองสีครีมงาช้างขอบทองอบอุ่น */}
            <path
              d="M18 78 L153 160 L288 78 L286 222 C198 225, 108 224, 20 222 Z"
              fill="#EAD7BE"
              stroke="#24170E"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />

            {/* รอยพับซอง */}
            <path
              d="M20 221 L126 146 M286 221 L180 146"
              stroke="#5A422E"
              strokeWidth="1.8"
              strokeLinecap="round"
              opacity="0.55"
            />

            {/* สายคาดริบบิ้นสีทองแชมเปญสำหรับของขวัญวันเกิด */}
            <path
              d="M18 194 L286 194"
              stroke="#C99648"
              strokeWidth="4"
              opacity="0.7"
            />

            {/* ข้อความ H.B.D. 28/10/2026 มุมซ้ายล่างหน้าซอง */}
            <text
              x="36"
              y="212"
              fill="#3A281B"
              fontSize="13.5"
              fontWeight="600"
              fontFamily="Mali, Sarabun, sans-serif"
            >
              H.B.D. 28/10/2026 🎂
            </text>

            {/* ฝาซองปิดสนิทพร้อมตราประทับหัวใจสีขาวบริสุทธิ์ 🤍 */}
            <g
              className="transition-opacity duration-300 ease-out"
              style={{
                opacity: isOpen ? 0 : 1,
                pointerEvents: isOpen ? 'none' : 'auto',
              }}
            >
              <path
                d="M18 78 L148 164 C151 166, 155 166, 158 164 L288 78 Z"
                fill="#F4E6D3"
                stroke="#24170E"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              {/* เหรียญครั่งสีทองอ่อนและหัวใจสีขาวตรงกลางซองวันเกิด */}
              <circle
                cx="153"
                cy="160"
                r="20"
                fill="#D4A359"
                stroke="#24170E"
                strokeWidth="2"
              />
              <path
                d="M153 170 C153 170, 141 162, 141 155 C141 151, 144.5 148.5, 148.2 150.2 C150.5 151.3, 152 153.2, 153 154.8 C154 153.2, 155.5 151.3, 157.8 150.2 C161.5 148.5, 165 151, 165 155 C165 162, 153 170, 153 170 Z"
                fill="#FFFDF9"
                stroke="#24170E"
                strokeWidth="1.8"
              />
            </g>
          </g>
        </svg>
      </div>
    </button>
  );
}

/**
 * ไอคอนกล่องไม้ใส่จดหมายแบบวินเทจสำหรับหัวกล่องจดหมายด้านข้าง
 */
export function WoodenLetterboxIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${className}`}
      aria-hidden="true"
    >
      {/* ตัวกล่องไม้ด้านหลัง */}
      <path
        d="M8 20 L56 20 L54 50 C39 51, 25 51, 10 50 Z"
        fill="#6A482E"
        stroke="#24170E"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* ซองจดหมายที่เสียบเรียงอยู่ในกล่อง */}
      <rect
        x="14"
        y="9"
        width="26"
        height="20"
        rx="2"
        transform="rotate(-5 14 9)"
        fill="#EAD7BE"
        stroke="#24170E"
        strokeWidth="1.8"
      />
      <rect
        x="24"
        y="12"
        width="26"
        height="20"
        rx="2"
        transform="rotate(4 24 12)"
        fill="#DFA855"
        stroke="#24170E"
        strokeWidth="1.8"
      />
      {/* แผ่นไม้ด้านหน้ากล่อง */}
      <path
        d="M8 26 L24 26 C26 31, 38 31, 40 26 L56 26 L54 50 L10 50 Z"
        fill="#8A603E"
        stroke="#24170E"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* ป้ายทองเหลืองเล็ก ๆ หน้ากล่อง */}
      <rect
        x="23"
        y="36"
        width="18"
        height="7"
        rx="1.5"
        fill="#D8A756"
        stroke="#24170E"
        strokeWidth="1.4"
      />
    </svg>
  );
}

/**
 * ไอคอนซองจดหมายขนาดเล็กในแต่ละแถวของกล่องจดหมาย (ตามภาพช่องที่ 5)
 */
export function MiniEnvelopeIcon({
  variant = 'gold',
  className = '',
}: {
  variant?: 'gold' | 'birthday' | 'reply';
  className?: string;
}) {
  const bodyFill =
    variant === 'birthday'
      ? '#EFE0CB'
      : variant === 'reply'
      ? '#D6B68A'
      : '#DFA855';
  const flapFill =
    variant === 'birthday'
      ? '#FAF1E4'
      : variant === 'reply'
      ? '#E5CAA3'
      : '#ECC074';
  const heartFill =
    variant === 'birthday'
      ? '#FFFFFF'
      : variant === 'reply'
      ? '#6D4C3D'
      : '#B35C44';

  return (
    <svg
      viewBox="0 0 44 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${className}`}
      aria-hidden="true"
    >
      <rect
        x="2"
        y="4"
        width="40"
        height="24"
        rx="3"
        fill={bodyFill}
        stroke="#2B1F16"
        strokeWidth="2"
      />
      <path
        d="M3 5 L22 18 L41 5"
        fill={flapFill}
        stroke="#2B1F16"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M22 21.5 C22 21.5, 18.2 18.8, 18.2 16.6 C18.2 15.2, 19.4 14.5, 20.6 15.1 C21.3 15.5, 21.7 16.1, 22 16.6 C22.3 16.1, 22.7 15.5, 23.4 15.1 C24.6 14.5, 25.8 15.2, 25.8 16.6 C25.8 18.8, 22 21.5, 22 21.5 Z"
        fill={heartFill}
        stroke="#2B1F16"
        strokeWidth="1.3"
      />
    </svg>
  );
}
