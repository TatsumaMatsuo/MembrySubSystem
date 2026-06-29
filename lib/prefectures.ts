/**
 * 都道府県を都道府県コード（JIS X 0401, 北海道=01 … 沖縄県=47）の昇順に並べた一覧。
 *
 * 出典: 都道府県マスタ.xlsx（都道府県コード T01〜T47 / 都道府県名）。
 * コードは国の固定標準のため定数として保持し、プルダウン等の並び順に用いる。
 */
export const PREFECTURE_ORDER: readonly string[] = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県",
  "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県",
  "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県", "鳥取県", "島根県",
  "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県",
  "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

/** 都道府県名 → 並び順インデックス（未知名は末尾扱い） */
const PREFECTURE_RANK = new Map(PREFECTURE_ORDER.map((name, i) => [name, i]));

/** 都道府県名 → 都道府県コード（JIS X 0401, 北海道=1 … 沖縄県=47）。未知名は null。 */
function prefectureCode(ken: string): number | null {
  const i = PREFECTURE_RANK.get(ken);
  return i == null ? null : i + 1;
}

/**
 * 不動産情報ライブラリ（国土交通省）の地図ビューアを、当該都道府県・住所検索モードで開くURLを返す。
 * 用途地域レイヤを備えた公式地図で、利用者が実敷地を住所検索・クリックして用途地域を確認する。
 * （旧 landzone.sengine.xyz への暫定リンクを公式ソースへ置換。パラメータは公式トップが生成する形式に準拠。）
 * 未知の県名は null。
 */
export function youtoChikiMapUrlForPrefecture(ken: string): string | null {
  const code = prefectureCode(ken);
  return code == null
    ? null
    : `https://www.reinfolib.mlit.go.jp/map/?initialState=areaOpen&areaOption=address&kCode=${code}&sCode=0`;
}

/**
 * 都道府県名の配列を都道府県コード昇順に並べ替える。
 * マスタに無い名称（想定外）は末尾に五十音順で寄せる。
 */
export function sortByPrefectureCode(names: string[]): string[] {
  return [...names].sort((a, b) => {
    const ra = PREFECTURE_RANK.get(a);
    const rb = PREFECTURE_RANK.get(b);
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return a.localeCompare(b, "ja");
  });
}
