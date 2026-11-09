"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  isInDeliveryArea,
  isInThailand,
  MAX_DELIVERY_RADIUS_KM,
  OUT_OF_AREA_MESSAGE,
  SHOP_LOCATION,
  type DELIVERYLOCATION,
} from "@/app/util/deliveryLocation";
import { createClient } from "@/app/api/util/supabase/client";
import type { APIRESULT } from "@/app/api/response";

type Props = {
  value: DELIVERYLOCATION | null;
  onChange: (location: DELIVERYLOCATION | null) => void;
  // ที่อยู่ที่ลูกค้ากรอก ใช้ค้นหาตำแหน่งเพื่อปักหมุดให้อัตโนมัติ
  address: string;
  disabled?: boolean;
};

// ไม่มีระดับ "ตรงบ้าน" เพราะ OSM แทบไม่มีเลขที่บ้านในไทย ผลจากที่อยู่จึงเป็นตำแหน่งโดยประมาณเสมอ
type GeocodePrecision = "street" | "area" | "district";
type GeocodeResult = DELIVERYLOCATION & { displayName: string; precision: GeocodePrecision; matchedQuery: string };

// ยิ่งหยาบ ยิ่งซูมออก ให้ลูกค้าเห็นบริเวณรอบ ๆ แล้วลากหมุดเข้าหาบ้านเอง
const PRECISION_ZOOM: Record<GeocodePrecision, number> = { street: 17, area: 15, district: 13 };
const PRECISION_LABEL: Record<GeocodePrecision, string> = {
  street: "ระดับถนน/ซอย",
  area: "ระดับหมู่บ้าน/ตำบล",
  district: "ระดับอำเภอ",
};

const DEFAULT_ZOOM = 13;
const PINNED_ZOOM = 17;
// GPS ในอาคารมักคลาดหลายสิบเมตร เกินค่านี้จะเตือนให้ลากหมุดเอง
const LOW_ACCURACY_METERS = 100;

// ใช้หมุด SVG แทนรูปไอคอนเริ่มต้นของ Leaflet ซึ่งหา path รูปไม่เจอเมื่อผ่าน bundler
const PIN_HTML = `<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M16 0C7.2 0 0 7.1 0 15.9 0 27.8 16 42 16 42s16-14.2 16-26.1C32 7.1 24.8 0 16 0z" fill="#d32f2f"/>
  <circle cx="16" cy="16" r="6" fill="#fff"/>
</svg>`;

function geolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง กรุณาเปิดสิทธิ์ตำแหน่งให้ LINE ในการตั้งค่าโทรศัพท์ หรือแตะบนแผนที่เพื่อปักหมุดเอง";
  }
  if (error.code === error.TIMEOUT) return "หาตำแหน่งไม่ทันเวลา ลองใหม่อีกครั้ง หรือแตะบนแผนที่เพื่อปักหมุดเอง";
  return "หาตำแหน่งปัจจุบันไม่ได้ กรุณาแตะบนแผนที่เพื่อปักหมุดเอง";
}

export default function DeliveryLocationPicker({ value, onChange, address, disabled = false }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  // เก็บค่าล่าสุดไว้ใน ref เพื่อให้ event ของ Leaflet ที่ผูกครั้งเดียวเรียกค่าปัจจุบันได้
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);
  const initialValueRef = useRef(value);
  const addressRef = useRef(address);
  // เพิ่มทุกครั้งที่ลูกค้าย้ายหมุดเอง ใช้ตรวจว่าผลค้นหาที่มาช้าจะทับหมุดที่ลูกค้าเพิ่งปักหรือไม่
  const pinVersionRef = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<{ severity: "info" | "warning" | "error"; text: string } | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
    disabledRef.current = disabled;
    addressRef.current = address;
  }, [onChange, disabled, address]);

  // ทุกทางที่ย้ายหมุด (แตะ ลาก GPS ลบ ค้นจากที่อยู่) ต้องผ่านฟังก์ชันนี้
  function setPin(location: DELIVERYLOCATION | null) {
    pinVersionRef.current += 1;
    onChangeRef.current(location);
  }

  // สร้างแผนที่ครั้งเดียว Leaflet แตะ window ตอน import จึงต้องโหลดในเบราว์เซอร์เท่านั้น
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const L = await import("leaflet");
        if (cancelled || !containerRef.current) return;
        leafletRef.current = L;

        const start = initialValueRef.current;
        const map = L.map(containerRef.current, {
          center: start ?? SHOP_LOCATION,
          zoom: start ? PINNED_ZOOM : DEFAULT_ZOOM,
          // ซูมด้วยลูกกลิ้งเมาส์โดยยึดตำแหน่งเคอร์เซอร์เป็นจุดศูนย์กลาง (บนมือถือใช้สองนิ้วซูมตามปกติ)
          scrollWheelZoom: true,
        });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
        }).addTo(map);

        // วงรัศมีจัดส่ง ให้ลูกค้าเห็นก่อนปักว่าร้านส่งถึงแค่ไหน (interactive: false เพื่อให้แตะในวงแล้วปักหมุดได้)
        L.circle(SHOP_LOCATION, {
          radius: MAX_DELIVERY_RADIUS_KM * 1000,
          color: "#2e7d32",
          weight: 2,
          fillOpacity: 0.06,
          interactive: false,
        }).addTo(map);

        map.on("click", (event) => {
          if (disabledRef.current) return;
          pinVersionRef.current += 1;
          onChangeRef.current({ lat: event.latlng.lat, lng: event.latlng.lng });
        });

        mapRef.current = map;
        setMapReady(true);
      } catch {
        if (!cancelled) setMapError("โหลดแผนที่ไม่สำเร็จ กรุณากด \"ใช้ตำแหน่งปัจจุบัน\" เพื่อปักหมุด หรือปิดแล้วเปิดหน้านี้ใหม่");
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      setMapReady(false);
    };
  }, []);

  // ให้หมุดบนแผนที่ตรงกับค่า value เสมอ ไม่ว่าจะมาจากการแตะ ลาก หรือปุ่ม GPS
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!mapReady || !L || !map) return;

    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      const marker = L.marker(value, {
        draggable: !disabled,
        autoPan: true,
        keyboard: true,
        title: "หมุดจัดส่ง ลากเพื่อปรับตำแหน่ง",
        icon: L.divIcon({ html: PIN_HTML, className: "deliveryPin", iconSize: [32, 42], iconAnchor: [16, 42] }),
      }).addTo(map);
      marker.on("dragend", () => {
        const position = marker.getLatLng();
        pinVersionRef.current += 1;
        onChangeRef.current({ lat: position.lat, lng: position.lng });
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(value);
    }

    if (!map.getBounds().contains(value)) map.panTo(value);
  }, [value, mapReady, disabled]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker?.dragging) return;
    if (disabled) marker.dragging.disable();
    else marker.dragging.enable();
  }, [disabled, value]);

  function locateCurrentPosition() {
    if (!("geolocation" in navigator)) {
      setGpsMessage({ severity: "error", text: "อุปกรณ์นี้ไม่รองรับการหาตำแหน่ง กรุณาแตะบนแผนที่เพื่อปักหมุดเอง" });
      return;
    }
    setLocating(true);
    setGpsMessage(null);
    const versionAtStart = pinVersionRef.current;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        // ระหว่างรอ GPS ลูกค้ากดยืนยันคำสั่งซื้อหรือปักหมุดเองไปแล้ว ห้ามย้ายหมุดทับ
        if (disabledRef.current || pinVersionRef.current !== versionAtStart) return;
        const location = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (!isInThailand(location)) {
          setGpsMessage({ severity: "error", text: "ตำแหน่งที่ได้อยู่นอกประเทศไทย กรุณาแตะบนแผนที่เพื่อปักหมุดเอง" });
          return;
        }
        setPin(location);
        mapRef.current?.setView(location, PINNED_ZOOM);
        const accuracy = Math.round(position.coords.accuracy);
        if (accuracy > LOW_ACCURACY_METERS) {
          setGpsMessage({
            severity: "warning",
            text: `ตำแหน่งอาจคลาดเคลื่อนประมาณ ${accuracy.toLocaleString("th-TH")} เมตร กรุณาลากหมุดไปยังจุดส่งของที่ถูกต้อง`,
          });
        }
      },
      (error) => {
        setLocating(false);
        setGpsMessage({ severity: "error", text: geolocationErrorMessage(error) });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function pinFromAddress() {
    const query = address.trim();
    if (!query) {
      setGpsMessage({ severity: "warning", text: "กรุณากรอกที่อยู่จัดส่งก่อน" });
      return;
    }
    setGeocoding(true);
    setGpsMessage(null);
    const versionAtStart = pinVersionRef.current;
    try {
      const { data } = await createClient().auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("กรุณาเข้าสู่ระบบอีกครั้ง");
      const response = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ address: query }),
      });
      // หน้า error ของโฮสต์อาจไม่ใช่ JSON ไม่ให้ลูกค้าเห็นข้อความ parser ภาษาอังกฤษ
      const result = (await response.json().catch(() => null)) as APIRESULT<GeocodeResult | null> | null;
      if (!result) throw new Error("ค้นหาที่อยู่ไม่สำเร็จ กรุณาลองใหม่");
      if (!response.ok || result.status === "error") throw new Error(result.message);
      // ระหว่างรอผล ลูกค้ากดยืนยันคำสั่งซื้อ ปักหมุดเอง หรือแก้ที่อยู่ไปแล้ว ผลนี้ล้าสมัย ไม่ต้องย้ายหมุด
      if (disabledRef.current || pinVersionRef.current !== versionAtStart || addressRef.current.trim() !== query) return;

      const found = result.results;
      if (!found) {
        setGpsMessage({
          severity: "warning",
          text: "ไม่พบที่อยู่นี้บนแผนที่ กรุณาแตะบนแผนที่ ลากหมุด หรือกดใช้ตำแหน่งปัจจุบันแทน",
        });
        return;
      }
      const location = { lat: found.lat, lng: found.lng };
      setPin(location);
      mapRef.current?.setView(location, PRECISION_ZOOM[found.precision]);
      setGpsMessage({
        severity: "warning",
        text: `ปักหมุดโดยประมาณ${PRECISION_LABEL[found.precision]} จาก “${found.matchedQuery}” กรุณาลากหมุดไปที่บ้านหรือร้านของคุณให้ตรง`,
      });
    } catch (error) {
      // fetch ล้มเพราะเน็ตหลุดจะได้ TypeError ข้อความอังกฤษ ("Failed to fetch") แสดงข้อความไทยแทน
      const isNetworkError = error instanceof TypeError;
      setGpsMessage({
        severity: "error",
        text: !isNetworkError && error instanceof Error && error.message
          ? error.message
          : "ค้นหาที่อยู่ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่",
      });
    } finally {
      setGeocoding(false);
    }
  }

  const outsideArea = value !== null && !isInDeliveryArea(value);

  return (
    <Stack spacing={1.25}>
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          ปักหมุดจุดส่งของ <Box component="span" sx={{ color: "error.main" }}>*</Box>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          กดใช้ตำแหน่งปัจจุบัน หรือแตะบนแผนที่ แล้วลากหมุดให้ตรงหน้าบ้านหรือร้าน (ต้องปักหมุดก่อนสั่งซื้อ)
        </Typography>
        <Typography variant="body2" color="success.main">
          วงสีเขียวคือพื้นที่จัดส่ง (รัศมี {MAX_DELIVERY_RADIUS_KM} กม. จากร้าน)
        </Typography>
      </Box>

      {mapError ? (
        <Alert severity="warning">{mapError}</Alert>
      ) : (
        <Box
          ref={containerRef}
          role="application"
          aria-label="แผนที่สำหรับปักหมุดจุดส่งของ"
          sx={{
            height: { xs: 260, sm: 320 },
            width: "100%",
            borderRadius: 1,
            overflow: "hidden",
            border: 1,
            borderColor: "divider",
            bgcolor: "action.hover",
            // แผนที่อยู่ใต้แถบเมนูและลิ้นชักตะกร้าของ MUI เสมอ
            position: "relative",
            zIndex: 0,
            opacity: disabled ? 0.6 : 1,
            "& .deliveryPin": { background: "transparent", border: "none" },
          }}
        />
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap>
        <Button
          type="button"
          variant="outlined"
          onClick={() => void pinFromAddress()}
          disabled={disabled || geocoding || locating || !address.trim()}
        >
          {geocoding ? "กำลังค้นหาที่อยู่..." : "ปักหมุดจากที่อยู่ที่กรอก"}
        </Button>
        <Button type="button" variant="contained" color="success" onClick={locateCurrentPosition} disabled={disabled || locating || geocoding}>
          {locating ? "กำลังหาตำแหน่ง..." : "ใช้ตำแหน่งปัจจุบัน"}
        </Button>
        {value && (
          <Button type="button" color="error" onClick={() => { setGpsMessage(null); setPin(null); }} disabled={disabled}>
            ลบหมุด
          </Button>
        )}
      </Stack>

      {gpsMessage && <Alert severity={gpsMessage.severity}>{gpsMessage.text}</Alert>}
      {outsideArea && <Alert severity="error">{OUT_OF_AREA_MESSAGE} กรุณาปักหมุดใหม่</Alert>}
      {value && !outsideArea && (
        <Typography variant="caption" color="text.secondary">
          ปักหมุดแล้ว: {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
        </Typography>
      )}
    </Stack>
  );
}
