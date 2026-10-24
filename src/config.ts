import { EXAMPLE_CONFIG, AppConfig } from './config.example';

export const APP_CONFIG: AppConfig = {
  ...EXAMPLE_CONFIG,
  gasWebAppUrl:
    (import.meta.env.VITE_GAS_WEB_APP_URL as string | undefined)?.trim() ||
    EXAMPLE_CONFIG.gasWebAppUrl,
};

/**
 * วันเกิดที่ใช้เป็นด่านประสบการณ์ใช้งาน (Experience Gate เท่านั้น)
 */
export const TARGET_BIRTHDAY = {
  day: 28,
  month: 10, // ตุลาคม (1-12)
  year: 2012, // ค.ศ. 2012
  minYear: 1950,
  maxYear: 2200,
};
