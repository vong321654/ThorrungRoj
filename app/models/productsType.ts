export type PRODUCTTYPE = {
  id?: number; //PK
  name: string;
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string; //FK
  updateBy?: string; //FK
};
export type PRODUCTBAND = {
  id?: number; //PK
  name: string;
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string; //FK
  updateBy?: string; //FK
};
export type PRODUCTUNIT = {
  id?: number; //PK
  name: string;
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string; //FK
  updateBy?: string; //FK
};
