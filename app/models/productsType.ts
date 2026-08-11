export type PRODUCTTYPE = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string | null;
  createdBy: string;
  updatedBy: string | null;
};

export type PRODUCTBAND = PRODUCTTYPE;

export type PRODUCTUNIT = {
  id: number;
  unit: string;
  createdAt: string;
  updatedAt: string | null;
  createdBy: string;
  updatedBy: string | null;
};
