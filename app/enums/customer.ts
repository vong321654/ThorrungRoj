export enum CUSTOMERTYPE {
  INDIVIDUAL = "individual",
  SHOP = "shop",
}

// สถานะคำขอเป็นร้านค้าที่ลูกค้าเลือกเองตอนเข้าใช้ครั้งแรก รอแอดมินยืนยัน
export enum SHOPREQUESTSTATUS {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}
