import { handleLineEvents, verifyLineSignature, type LineEvent } from "@/app/api/services/lineBotService";

// LINE ส่ง webhook มาที่นี่ ต้องอ่าน body แบบ raw text เพื่อตรวจลายเซ็นก่อน parse JSON
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyLineSignature(rawBody, request.headers.get("x-line-signature"))) {
    return Response.json({ message: "Invalid signature" }, { status: 401 });
  }

  let events: LineEvent[] = [];
  try {
    const parsed = JSON.parse(rawBody) as { events?: LineEvent[] };
    events = Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    return Response.json({ message: "Invalid JSON payload" }, { status: 400 });
  }

  // ปุ่ม Verify ใน LINE Console ส่ง events ว่างมา ตอบ 200 ได้เลย
  // ต้องรอจนตอบ LINE เสร็จก่อนคืน response เพราะ Vercel อาจหยุด function ทันทีหลังคืน response
  await handleLineEvents(events);
  return Response.json({ ok: true });
}
