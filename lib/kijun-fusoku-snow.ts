/**
 * 標高依存地域の垂直積雪量(cm)を、標高(m)から算出する。
 *
 * 元データ「積雪算出方法(W)」は自治体ごとの自由記述で数十フォーマット混在する。
 * ここでは **自己完結し機械判定が確実なパターンのみ** を自動算出し、それ以外は
 * 算出不能(manual)として原文表示にフォールバックする（誤算出を出さない方針）。
 *
 * 対応パターン:
 *   A. 告示式型   : 「標高N m以下;X cm / 超は 標高*0.06+21 を切り捨て(cm)」
 *   D. しきい+式型: 「標高N m以下;X cm / 超は d=a*標高+b（mで算出）」
 *   C. 一次式型   : 「d=(h-b)*a+c」「d=a*標高+c」「標高*a+c」（mで算出）
 *   B. 階段型     : 「300m未満 0.4m / 300m以上400m未満 0.5m / …」等の標高区分テーブル
 *
 * 外部参照型（α・基準積雪量・役場標高 lso/h0/do 等、別マスタが必要）は manual に倒す。
 * 算定値が妥当域(5〜1500cm)を外れた場合も manual。
 */

export interface SnowInput {
  sign: string; // 標高符号 T 例 "<="
  base: number | null; // 基準標高 U (m)
  method: string; // 積雪算出方法 W（原文）
  note: string; // 備考
}

export interface SnowResult {
  /** 算出された垂直積雪量(cm)。null=自動算出不可(原文を参照) */
  cm: number | null;
  /** auto=式から算出 / manual=自動算出不可 */
  kind: "auto" | "manual";
  /** 適用した算定式の説明（autoのとき）または空 */
  basis: string;
}

/** 全角英数記号・単位表記を半角/標準形に正規化 */
export function normalizeMethod(s: string): string {
  if (!s) return "";
  // 全角ASCII(！-～ = U+FF01–FF5E) → 半角（ｍ→m, ０→0, ；→; 等）
  let t = s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  t = t.replace(/　/g, " "); // 全角スペース
  // 単位表記を先に統一（長音ーをマイナス化する前に処理する）
  t = t.replace(/センチメートル/g, "cm").replace(/メートル/g, "m");
  // 記号統一（長音/各種マイナスは式の減算記号として - に寄せる）
  t = t
    .replace(/×/g, "*")
    .replace(/[ー−–—]/g, "-")
    .replace(/[〜～]/g, "~")
    .replace(/[；]/g, ";")
    .replace(/[：]/g, ":")
    .replace(/[，]/g, ",");
  // 桁区切りカンマ除去（1,000 → 1000。区分上限の誤読を防ぐ）
  t = t.replace(/(\d),(\d)/g, "$1$2").replace(/(\d),(\d)/g, "$1$2");
  return t.replace(/\s+/g, " ").trim();
}

/** 外部マスタ参照が必要＝自動算出不可と判定するトークン */
const EXTERNAL_REF = /α|lso|ls0|h0|ho\b|do\b|別表|細則|基準積雪量|役場|支所|市役所|旧市町村|団体コード/;

const plausible = (cm: number | null): cm is number => cm != null && Number.isFinite(cm) && cm >= 5 && cm <= 1500;
const manual = (): SnowResult => ({ cm: null, kind: "manual", basis: "" });
const auto = (cm: number, basis: string): SnowResult =>
  plausible(Math.round(cm)) ? { cm: Math.round(cm), kind: "auto", basis } : manual();

const toCm = (v: number, unit?: string) => (unit === "m" ? v * 100 : v);

/**
 * 一次式を解析し、標高h(m)→積雪d(m) の関数を返す。解析不能なら null。
 * 対応: d=(h-b)*a±c / a*(h-b)±c / a*var±c / var*a±c  （var = h/標高/ls/l）
 * （α 等の記号係数=外部参照型は数値に一致せず対象外）
 */
function parseLinear(text: string): ((h: number) => number) | null {
  const v = "(?:標高|h|ls|l)";
  let r = text.match(new RegExp(`d\\s*=\\s*\\(\\s*${v}\\s*-\\s*(\\d+(?:\\.\\d+)?)\\s*\\)\\s*\\*\\s*(\\d+(?:\\.\\d+)?)\\s*([+\\-])\\s*(\\d+(?:\\.\\d+)?)`));
  if (r) { const b = +r[1], a = +r[2], sg = r[3] === "-" ? -1 : 1, c = +r[4]; return (h) => a * (h - b) + sg * c; }
  r = text.match(new RegExp(`d\\s*=\\s*(\\d+(?:\\.\\d+)?)\\s*\\*\\s*\\(\\s*${v}\\s*-\\s*(\\d+(?:\\.\\d+)?)\\s*\\)\\s*([+\\-])\\s*(\\d+(?:\\.\\d+)?)`));
  if (r) { const a = +r[1], b = +r[2], sg = r[3] === "-" ? -1 : 1, c = +r[4]; return (h) => a * (h - b) + sg * c; }
  r = text.match(new RegExp(`(?:d\\s*=\\s*)?(\\d+(?:\\.\\d+)?)\\s*\\*\\s*\\(?\\s*${v}\\s*\\)?\\s*([+\\-])\\s*(\\d+(?:\\.\\d+)?)`));
  if (r) { const a = +r[1], sg = r[2] === "-" ? -1 : 1, c = +r[3]; return (h) => a * h + sg * c; }
  r = text.match(new RegExp(`(?:d\\s*=\\s*)?${v}\\s*\\*\\s*(\\d+(?:\\.\\d+)?)\\s*([+\\-])\\s*(\\d+(?:\\.\\d+)?)`));
  if (r) { const a = +r[1], sg = r[2] === "-" ? -1 : 1, c = +r[3]; return (h) => a * h + sg * c; }
  return null;
}

/** 告示式: 標高に a を乗じ b を加えた数値(1未満切り捨て) cm */
function parseKokujiAbove(text: string): ((h: number) => number) | null {
  const r = text.match(/(\d+(?:\.\d+)?)\s*を乗じて得た数値に\s*(\d+(?:\.\d+)?)\s*を加えて/);
  if (!r) return null;
  const a = +r[1], b = +r[2];
  return (h) => Math.floor(h * a + b);
}

/** 「標高 N m 以下;X cm」の (しきい値N, 値Xcm) を抽出 */
function parseBelowCm(text: string): { n: number; xcm: number } | null {
  const r = text.match(/(\d+(?:\.\d+)?)\s*m\s*以下\s*;?\s*(\d+(?:\.\d+)?)\s*cm/);
  if (!r) return null;
  return { n: +r[1], xcm: +r[2] };
}

interface Band { lo: number; hi: number; cm: number } // [lo, hi) m, 値cm

/**
 * 階段型（標高区分テーブル）を解析。範囲節→単一節の順に消費して重複を防ぐ。
 * 2区分以上が取れ、評価時に該当区間が一意に決まる場合のみ採用。
 */
function parseBands(text: string): ((h: number) => number) | null {
  const bands: Band[] = [];
  let work = ` ${text} `;
  const consume = (re: RegExp, fn: (m: RegExpMatchArray) => Band) => {
    work = work.replace(re, (...args) => {
      bands.push(fn(args as unknown as RegExpMatchArray));
      return " ";
    });
  };
  // A m 以上 B m 未満 [=:;]? V (cm|m)?  /  A ~ B m [=:;]? V  /  A 超 B 以下 V
  consume(/(\d+(?:\.\d+)?)\s*m?\s*以上\s*(\d+(?:\.\d+)?)\s*m?\s*未満\s*[=:;]?\s*(\d+(?:\.\d+)?)\s*(cm|m)?/g,
    (m) => ({ lo: +m[1], hi: +m[2], cm: toCm(+m[3], m[4]) }));
  consume(/(\d+(?:\.\d+)?)\s*m?\s*(?:超|を超え)\s*(\d+(?:\.\d+)?)\s*m?\s*以下\s*(?:の区域)?\s*[=:;]?\s*(\d+(?:\.\d+)?)\s*(cm|m)?/g,
    (m) => ({ lo: +m[1], hi: +m[2], cm: toCm(+m[3], m[4]) }));
  consume(/(\d+(?:\.\d+)?)\s*~\s*(\d+(?:\.\d+)?)\s*m?\s*[=:;]?\s*(\d+(?:\.\d+)?)\s*(cm|m)?/g,
    (m) => ({ lo: +m[1], hi: +m[2], cm: toCm(+m[3], m[4]) }));
  // 残りの単一節: 未満/以下/より小さい（上限）
  consume(/(\d+(?:\.\d+)?)\s*m?\s*(?:未満|以下|より小さい)\s*(?:の区域)?\s*[=:;]?\s*(\d+(?:\.\d+)?)\s*(cm|m)?/g,
    (m) => ({ lo: -Infinity, hi: +m[1], cm: toCm(+m[2], m[3]) }));
  // 以上/超/より大きい/より高い（下限・上方開放）
  consume(/(\d+(?:\.\d+)?)\s*m?\s*(?:以上|超|を超え|より大きい|より高い)\s*(?:の区域)?\s*[=:;]?\s*(\d+(?:\.\d+)?)\s*(cm|m)?/g,
    (m) => ({ lo: +m[1], hi: Infinity, cm: toCm(+m[2], m[3]) }));

  if (bands.length < 2) return null;
  // 評価: 該当区間の値を返す。境界は安全側（大きい積雪）に倒す。
  const f = (h: number): number => {
    const hit = bands.filter((b) => h >= b.lo && h <= b.hi).map((b) => b.cm);
    if (hit.length) return Math.max(...hit);
    // 開放端の補完（最大loの上方/最小hiの下方）
    const upper = bands.filter((b) => b.hi === Infinity).sort((a, b) => b.lo - a.lo)[0];
    if (upper && h >= upper.lo) return upper.cm;
    const lower = bands.filter((b) => b.lo === -Infinity).sort((a, b) => a.hi - b.hi)[0];
    if (lower && h <= lower.hi) return lower.cm;
    return NaN; // 区間外
  };
  // 安全網: 0〜1500m を走査し、全域被覆かつ単調非減少でなければ採用しない（誤読の自動棄却）
  let prev = -Infinity;
  for (let hh = 0; hh <= 1500; hh += 10) {
    const y = f(hh);
    if (!Number.isFinite(y) || y < prev - 0.001) return null;
    prev = y;
  }
  return f;
}

/**
 * 標高(m)から垂直積雪量(cm)を算出する。
 * @param input 標高符号/基準標高/算出方法/備考
 * @param elevationM 入力標高(m)
 */
export function computeSnow(input: SnowInput, elevationM: number): SnowResult {
  if (!Number.isFinite(elevationM) || elevationM < 0) return manual();
  const m = normalizeMethod(input.method);
  if (!m) return manual();
  if (EXTERNAL_REF.test(m)) return manual(); // 外部マスタ参照型は自動算出しない
  const h = elevationM;

  const below = parseBelowCm(m);
  const kokuji = parseKokujiAbove(m);

  // A. 告示式型（標高N以下;Xcm / 超は a*標高+b 切り捨て(cm)）
  if (below && kokuji) {
    const cm = h <= below.n ? below.xcm : kokuji(h);
    return auto(cm, `標高${below.n}m以下は${below.xcm}cm、超は告示式（標高×係数＋定数を切り捨て）`);
  }

  const lin = parseLinear(m);

  // D. しきい+一次式型（標高N以下;Xcm / 超は d=…(mで算出)）
  if (below && lin) {
    const cm = h <= below.n ? below.xcm : lin(h) * 100;
    return auto(cm, `標高${below.n}m以下は${below.xcm}cm、超は一次式`);
  }

  // C. 一次式型のみ（d=…(m)）
  if (lin && !below) {
    return auto(lin(h) * 100, "一次式（m単位を100倍してcm化）");
  }

  // B. 階段型（標高区分テーブル）
  const band = parseBands(m);
  if (band && !kokuji && !lin) {
    return auto(band(h), "標高区分テーブル");
  }

  return manual();
}
