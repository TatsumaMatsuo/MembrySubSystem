// 棚卸 読取入力の専用フルスクリーンレイアウト（MainLayout を使わない）。
// モバイル片手操作でカメラ＋品目＋テンキーを1画面に収めるため、ヘッダ・サイドバーを外す。
// 認証は middleware（JWT cookie）で担保される。
export const metadata = {
  title: "棚卸入力",
};

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 flex flex-col bg-gray-900 text-white">{children}</div>;
}
