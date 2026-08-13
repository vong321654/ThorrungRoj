import { IMAGEKIND } from "@/app/enums/image";

export { IMAGEKIND };

export type AUTHIDENTITYUSER = {
  app_metadata?: { provider?: string };
  identities?: Array<{ provider?: string }>;
};

export type PAYMENTORDEROWNER = { userId?: string } | null;

export type { AUTHIDENTITYUSER as AuthIdentityUser, PAYMENTORDEROWNER as PaymentOrderOwner };
