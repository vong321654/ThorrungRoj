import { ANNOUNCEMENTTYPE } from "@/app/enums/announcement";

export { ANNOUNCEMENTTYPE };

export function ISANNOUNCEMENTTYPE(value: unknown): value is ANNOUNCEMENTTYPE {
  return Object.values(ANNOUNCEMENTTYPE).includes(value as ANNOUNCEMENTTYPE);
}

export type ANNOUNCEMENT = {
  id: string;
  postedBy: string;
  title: string;
  content: string | null;
  imageUrl: string | null;
  type: ANNOUNCEMENTTYPE;
  isPublished: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  /** เวลาที่ส่งประกาศเข้าแชท LINE แล้ว อ่านได้เฉพาะ API ฝั่งแอดมิน (หน้าลูกค้าไม่ได้ select คอลัมน์นี้) */
  lineNotifiedAt?: string | null;
};

/** ผลบันทึกประกาศของแอดมิน lineNotifyError = เหตุที่ส่งเข้า LINE ไม่สำเร็จ (ประกาศบันทึกแล้ว) */
export type ANNOUNCEMENTSAVERESULT = ANNOUNCEMENT & { lineNotifyError: string | null };

type ANNOUNCEMENTEDITABLEFIELDS = Pick<
  ANNOUNCEMENT,
  "title" | "content" | "imageUrl" | "type" | "isPublished" | "expiresAt"
>;

export type ANNOUNCEMENTPAYLOAD = Partial<
  Record<keyof ANNOUNCEMENTEDITABLEFIELDS, unknown>
>;

export type ANNOUNCEMENTWRITEVALUES = Partial<ANNOUNCEMENTEDITABLEFIELDS>;

export type ANNOUNCEMENTUPDATEVALUES = ANNOUNCEMENTWRITEVALUES &
  Partial<Pick<ANNOUNCEMENT, "publishedAt">>;
