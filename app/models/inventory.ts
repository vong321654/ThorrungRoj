export type INVENTORY = {
  id: string;
  productId: number;
  stockStatus: "full" | "empty" | "damaged" | null;
  itemCondition: "new" | "old" | "normal";
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  minimumStock: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  createdBy: string | null;
};

export type CREATEINVENTORYPAYLOAD = {
  productId?: unknown;
  stockStatus?: unknown;
  itemCondition?: unknown;
  quantityOnHand?: unknown;
  minimumStock?: unknown;
  note?: unknown;
};
