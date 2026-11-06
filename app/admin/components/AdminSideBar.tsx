"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Collapse,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import { useAdminSession } from "../AdminSessionContext";
import { ADMINROLE } from "@/app/models/admin";

type MenuGroup = {
  title: string;
  items: { name: string; link: string }[];
};

// หน้ากลุ่มนี้เปิดได้เฉพาะ superAdmin จึงไม่แสดงให้บทบาทอื่นเห็น
const MASTER_MENU: MenuGroup = {
  title: "ระบบหลัก",
  items: [
    { name: "ผู้ดูแลระบบ", link: "/admin#admins" },
    { name: "หน่วยสินค้า", link: "/admin/product/unit" },
    { name: "ประเภทสินค้า", link: "/admin/product/type" },
    { name: "แบรนด์สินค้า", link: "/admin/product/brand" },
  ],
};

const ADMIN_MENU: MenuGroup[] = [
  {
    title: "รายการสินค้า",
    items: [
      { name: "สินค้า", link: "/admin/product" },
      { name: "คลังสินค้า", link: "/admin/inventory" },
      { name: "ประกาศ/โปรโมชั่น", link: "/admin/announcements" },
    ],
  },
  {
    title: "รายการคำสั่งซื้อ",
    items: [
      { name: "คำสั่งซื้อ", link: "/admin/orders" },
      { name: "งานจัดส่ง", link: "/admin/deliveries" },
      { name: "หนี้ค้าง", link: "/admin/debts" },
    ],
  },
  {
    title: "ลูกค้าและผู้ใช้งาน",
    items: [
      { name: "ลูกค้า", link: "/admin/users" },
      { name: "เวลาทำงาน", link: "/admin/attendance" },
    ],
  },
];

const STAFF_MENU: MenuGroup[] = [
  {
    title: "Order",
    items: [{ name: "งานจัดส่ง", link: "/admin/deliveries" }],
  },
  {
    title: "User",
    items: [{ name: "เวลาทำงาน", link: "/admin/attendance" }],
  },
];

function getMenuGroups(role: ADMINROLE | undefined): MenuGroup[] {
  // ระหว่างรอโหลด session ยังไม่รู้บทบาท จึงไม่แสดงเมนู กันพนักงานเห็นเมนูแอดมินแวบหนึ่ง
  if (!role) return [];
  if (role === ADMINROLE.EMPLOYEE) return STAFF_MENU;
  if (role === ADMINROLE.SUPER_ADMIN) return [MASTER_MENU, ...ADMIN_MENU];
  return ADMIN_MENU;
}

const pillButtonSx = {
  bgcolor: "#FFFFFF",
  borderRadius: 5,
  color: "#000000",
  textTransform: "none",
  py: 0.25,
};

export default function AdminSideBar() {
  const router = useRouter();
  const { admin, signOut } = useAdminSession();
  const [closedGroups, setClosedGroups] = useState<string[]>([]);

  function toggleGroup(title: string) {
    setClosedGroups((current) =>
      current.includes(title)
        ? current.filter((group) => group !== title)
        : [...current, title],
    );
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <Box
      component="aside"
      sx={{
        width: 250,
        flexShrink: 0,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#D3D3D3",
        color: "#000000",
      }}
    >
      <Box sx={{ px: 2, py: 4, borderBottom: "3px solid #FFFFFF" }}>
        <Typography
          component={Link}
          href="/admin"
          variant="h5"
          sx={{
            display: "block",
            color: "#000000",
            textAlign: "center",
            textDecoration: "none",
          }}
        >
          Admin Dashboard
        </Typography>
      </Box>

      <List component="nav" disablePadding>
        {getMenuGroups(admin?.role).map((group) => {
          const isOpen = !closedGroups.includes(group.title);

          return (
            <Box key={group.title}>
              <ListItemButton
                onClick={() => toggleGroup(group.title)}
                aria-expanded={isOpen}
                sx={{
                  bgcolor: "#00DCE6",
                  "&:hover": { bgcolor: "#00C4CE" },
                }}
              >
                <Box component="span" aria-hidden sx={{ mr: 1 }}>
                  •
                </Box>
                <ListItemText primary={group.title} />
                {isOpen ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>

              <Collapse in={isOpen} unmountOnExit>
                <List disablePadding sx={{ bgcolor: "#C8F7F5" }}>
                  {group.items.map((item) => (
                    <ListItemButton
                      key={item.link}
                      component={Link}
                      href={item.link}
                      sx={{
                        pl: 5,
                        py: 0.25,
                        color: "inherit",
                        "&:hover": { bgcolor: "#AEEFEC" },
                      }}
                    >
                      <Box component="span" aria-hidden sx={{ mr: 1 }}>
                        •
                      </Box>
                      <ListItemText primary={item.name} />
                    </ListItemButton>
                  ))}
                </List>
              </Collapse>
            </Box>
          );
        })}
      </List>

      {admin && (
        <Box
          sx={{
            mt: "auto",
            p: 3,
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          <Typography sx={{ textAlign: "center" }}>{admin.name}</Typography>
          <Button
            component={Link}
            href={`/admin/editAdmin/${admin.id}`}
            variant="contained"
            color="warning"
            fullWidth
          >
            แก้ไขโปรไฟล์
          </Button>
          <Button
            variant="contained"
            color="error"
            fullWidth
            onClick={() => void handleSignOut()}
          >
            ออกจากระบบ
          </Button>
        </Box>
      )}
    </Box>
  );
}
