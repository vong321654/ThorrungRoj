"use client";
import React from "react";

export default function AdminSideBar({
  HeaderName,
  menuItems,
}: {
  HeaderName: string;
  menuItems: { name: string; link: string }[];
}) {
  return (
    <div
      className="admin-sidebar"
      style={{ width: "250px", backgroundColor: "#f0f0f0", padding: "20px" }}
    >
      <div>
        <a
          href="/admin"
          style={{
            textDecoration: "none",
            color: "inherit",
            fontWeight: "bold",
            fontSize: "1.2em",
          }}
        >
          {HeaderName}
        </a>
      </div>
      <ul style={{ listStyleType: "none", padding: 0 }}>
        {menuItems.map((item, index) => (
          <li key={index}>
            <a
              href={item.link}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              {item.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
