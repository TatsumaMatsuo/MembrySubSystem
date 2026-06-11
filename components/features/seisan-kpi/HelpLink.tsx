"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";

/**
 * 文脈ヘルプ導線。各画面ヘッダに置き、ヘルプ運用ガイドの該当セクション(#anchor)へ遷移。
 * section: help ページ内のアンカーID(overview/flow/timing/judge/star/features/map/terms)
 */
export function HelpLink({ section, label = "ヘルプ" }: { section?: string; label?: string }) {
  const href = section ? `/seisan-kpi/help#${section}` : "/seisan-kpi/help";
  return (
    <Link
      href={href}
      title="運用ガイドを開く"
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px",
        background: "#fff", color: "#1f3864", fontSize: 13, fontWeight: 600,
        textDecoration: "none", cursor: "pointer",
      }}
    >
      <HelpCircle size={14} /> {label}
    </Link>
  );
}
