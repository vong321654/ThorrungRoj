export type PRODUCT = {
  id: number; //PK
  name: string;
  brandId: number; //FK
  size: number;
  typeId: number; //FK
  unitId: number; //FK
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string; //FK
  updateBy?: string; //FK
  sellPrice: string;
  exchangePrice?: string;
  refillPrice?: string;
  isActive?: boolean;
};

export type PRODUCTINPUT = Omit<PRODUCT, "id" | "createdAt" | "updatedAt">;
