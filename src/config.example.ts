/**
 * ไฟล์ตัวอย่างการตั้งค่า (Configuration)
 */

export interface BgmTrack {
  id: string;
  title: string;
  url: string;
}

export interface AppConfig {
  /** URL ของ Google Apps Script Web App (/exec) เพื่อให้ผู้รับบันทึกจดหมายได้ทันทีโดยไม่ต้องล็อกอิน */
  gasWebAppUrl: string;
  /** ช่วงเวลาหน่วงก่อนส่งข้อมูลอัตโนมัติ (มิลลิวินาที) แนะนำ 1500ms */
  autosaveDebounceMs: number;
  /** ขนาดเนื้อหาจดหมายสูงสุด (ตัวอักษร) */
  maxBodyLength: number;
  /** ขนาดชื่อจดหมายสูงสุด */
  maxTitleLength: number;
  /** ขนาดชื่อผู้เขียนสูงสุด */
  maxAuthorLength: number;
  /** จำนวนครั้งสูงสุดในการลองส่งซ้ำอัตโนมัติเมื่อเกิดข้อผิดพลาด */
  maxRetryAttempts: number;
  /** รหัสโฟลเดอร์ Google Drive ปลายทางของเจ้าของเว็บไซต์สำหรับเก็บข้อมูลจดหมาย */
  targetDriveFolderId: string;
  /**
   * ระบุภาพอ้างอิงต้นฉบับ (หากผู้สร้างอัปโหลดไว้ใน public/assets/)
   */
  customVisualAssets: {
    deskBackgroundUrl: string;
    envelopeClosedUrl: string;
    envelopeOpenUrl: string;
    handDrawnPenUrl: string;
    letterPaperTextureUrl: string;
  };
  /** รายการเพลงประกอบในเว็บไซต์ (เล่นต่อเนื่องอัตโนมัติและกดเปลี่ยนเพลงได้) */
  bgmTracks: BgmTrack[];
}

export const EXAMPLE_CONFIG: AppConfig = {
  gasWebAppUrl:
    'https://script.google.com/macros/s/AKfycbz-_981ryzMDjbf8nwtNN2L1RcvnyhR2rqS7hoeMO8C7-gKZEV9LpQhdARed4OTMLn4lA/exec',
  autosaveDebounceMs: 1500,
  maxBodyLength: 8000,
  maxTitleLength: 140,
  maxAuthorLength: 80,
  maxRetryAttempts: 4,
  targetDriveFolderId: '1UAt0ShaC67RVu1_4Ec58evFAUV4nTEGd',
  customVisualAssets: {
    deskBackgroundUrl: '',
    envelopeClosedUrl: '',
    envelopeOpenUrl: '',
    handDrawnPenUrl: '',
    letterPaperTextureUrl: '',
  },
  bgmTracks: [
    {
      id: 'track_maxmillor',
      title: 'MaxMillor x ize so cold x PORZAX',
      url: 'assets/aistudio/Y2Mate.st_-_MaxMillor_x_ize_so_cold_x_PORZAX_-__Official_MV_454c64b5.mp3',
    },
    {
      id: 'track_unfriend',
      title: 'Unfriend',
      url: 'assets/aistudio/Y2Mate.st_-_Unfriend_caf2af8e.mp3',
    },
    {
      id: 'track_cornboi',
      title: 'ขอโทษที่ทำให้เสียใจ — CORNBOI',
      url: 'assets/aistudio/Y2Mate.st_-__-_CORNBOIOfficial_Visualizer_d2f88adc.mp3',
    },
  ],
};
