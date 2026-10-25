import { EXAMPLE_CONFIG, AppConfig } from './config.example';

export const APP_CONFIG: AppConfig = {
  ...EXAMPLE_CONFIG,
  gasWebAppUrl:
    (import.meta.env.VITE_GAS_WEB_APP_URL as string | undefined)?.trim() ||
    EXAMPLE_CONFIG.gasWebAppUrl,
};

/**
 * วันเกิดสำหรับผู้รับคนสำคัญ (28 ตุลาคม 2012)
 */
export const TARGET_BIRTHDAY = {
  day: 28,
  month: 10, // ตุลาคม (1-12)
  year: 2012, // ค.ศ. 2012
  minYear: 1950,
  maxYear: 2200,
};

/**
 * รหัสวันเกิดสำหรับเข้าโหมดแอดมิน/ผู้สร้างเว็บไซต์ (28 สิงหาคม 2111)
 */
export const ADMIN_BIRTHDAY_GATE = {
  day: 28,
  month: 8, // สิงหาคม (1-12)
  year: 2111, // ค.ศ. 2111
};
