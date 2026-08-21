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
};

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
