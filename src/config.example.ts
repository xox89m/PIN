/**
 * ไฟล์ตัวอย่างการตั้งค่า (Configuration)
 */

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
   * หากเป็นค่าว่าง ระบบจะแสดงภาพวาดเส้น SVG แบบ Placeholder ที่เปลี่ยนแทนได้ทันที
   */
  customVisualAssets: {
    deskBackgroundUrl: string;
    envelopeClosedUrl: string;
    envelopeOpenUrl: string;
    handDrawnPenUrl: string;
    letterPaperTextureUrl: string;
  };
  /**
   * (ตัวเลือกเสริม) หากต้องการใช้ไฟล์เพลง MP3 ของตัวเอง ให้วางไฟล์ในโฟลเดอร์ public/ เช่น public/bgm.mp3
   * แล้วใส่ค่า './bgm.mp3' ที่นี่ หากปล่อยว่าง ระบบจะเล่นเสียงเปียโนอุ่น ๆ และเสียงฝนในตัวอัตโนมัติ
   */
  customBgmUrl: string;
}

export const EXAMPLE_CONFIG: AppConfig = {
  gasWebAppUrl:
    'https://script.google.com/macros/s/AKfycbz-_981ryzMDjbf8nwtNN2L1RcvnyhR2rqS7hoeMO8C7-gKZEV9LpQhdARed4OTMLn4lA/exec',
  autosaveDebounceMs: 1500,
  maxBodyLength: 5000,
  maxTitleLength: 120,
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
  customBgmUrl: '',
};
