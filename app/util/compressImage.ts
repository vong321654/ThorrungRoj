// ย่อรูปในเบราว์เซอร์ก่อนอัปโหลด เพราะ Vercel รับ request ได้ไม่เกินประมาณ 4.5 MB
// แต่รูปจากกล้องมือถือมักใหญ่กว่านั้น เพดานนี้ต้องตรงกับ MAX_FILE_SIZE ใน app/api/images/route.ts
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const UPLOAD_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// ไฟล์ต้นฉบับใหญ่เกินนี้ ไม่เปิดเลย กันมือถือหน่วยความจำไม่พอ
const MAX_SOURCE_BYTES = 30 * 1024 * 1024;
// ไฟล์เล็กและภาพไม่ใหญ่อยู่แล้ว ส่งไฟล์เดิม จะได้ไม่เสียคุณภาพโดยไม่จำเป็น
const KEEP_ORIGINAL_BYTES = 1024 * 1024;
const MAX_DIMENSION = 2000;
// ลองจากคุณภาพดีไปหาเล็กลง จนกว่าไฟล์จะไม่เกินเพดาน
const COMPRESSION_STEPS = [
  { dimension: MAX_DIMENSION, quality: 0.85 },
  { dimension: 1600, quality: 0.75 },
  { dimension: 1200, quality: 0.65 },
  { dimension: 1000, quality: 0.55 },
];

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("เปิดไฟล์รูปไม่ได้ ไฟล์อาจเสียหาย กรุณาเลือกรูปอื่น"));
    };
    image.src = url;
  });
}

function renderJpeg(image: HTMLImageElement, dimension: number, quality: number) {
  const scale = Math.min(1, dimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve<Blob | null>(null);

  // JPEG ไม่มีพื้นโปร่งใส ถ้าไม่ปูสีขาวก่อน ส่วนโปร่งใสของ PNG จะกลายเป็นสีดำ
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** คืนไฟล์ที่พร้อมอัปโหลด (ไม่เกิน MAX_UPLOAD_BYTES) หรือ throw พร้อมข้อความภาษาไทยที่แสดงให้ผู้ใช้ได้ */
export async function compressImage(file: File): Promise<File> {
  if (!UPLOAD_IMAGE_TYPES.includes(file.type)) {
    throw new Error("รูปต้องเป็นไฟล์ JPG, PNG หรือ WebP เท่านั้น");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("ไฟล์รูปใหญ่เกิน 30 MB กรุณาเลือกรูปอื่น");
  }

  const image = await loadImage(file);
  const fitsDimension = Math.max(image.naturalWidth, image.naturalHeight) <= MAX_DIMENSION;
  if (file.size <= KEEP_ORIGINAL_BYTES && fitsDimension) return file;

  for (const { dimension, quality } of COMPRESSION_STEPS) {
    const blob = await renderJpeg(image, dimension, quality);
    if (!blob) break;
    if (blob.size > MAX_UPLOAD_BYTES) continue;
    // ไฟล์ที่ย่อแล้วใหญ่กว่าเดิมได้ เช่น PNG ภาพเรียบๆ ถ้าต้นฉบับใช้ได้ก็ส่งต้นฉบับ
    if (fitsDimension && blob.size >= file.size) return file;
    const name = `${file.name.replace(/\.[^.]+$/, "")}.jpg`;
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  }

  // เครื่องเก่าที่ย่อรูปไม่สำเร็จ ยังส่งต้นฉบับได้ถ้าไม่เกินเพดาน
  if (file.size <= MAX_UPLOAD_BYTES) return file;
  throw new Error("ย่อรูปไม่สำเร็จ กรุณาเลือกรูปที่เล็กลงหรือแคปหน้าจอแทน");
}
