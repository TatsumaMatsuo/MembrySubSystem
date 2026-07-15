// F2-10 外注業者向け(認証不要)ページのレイアウト。
// 社内用の MainLayout/セッションUIを挟まず、素の children のみ描画する。
export const metadata = {
  title: "現場作業日報",
};

export default function GenbaPublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
