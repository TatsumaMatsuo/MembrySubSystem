/**
 * 標高依存地域の垂直積雪量(cm)を、標高(m)と地域の計算パターンから確定的に算出する。
 *
 * 旧方式（積雪算出方法Wの自由記述を正規表現でパース）を廃し、元Excelで集約された
 * 計算式テンプレート（K001〜K077, lib/kijun-fusoku-patterns.ts）を評価する方式に刷新。
 * 各地域は「計算パターンID＋定数1〜6＋基準値＋積雪量」を持ち、標高を入れれば式が一意に
 * 決まる。式は Excel の限定サブセット（IF / MAX / MIN / ABS / ROUNDUP / ROUNDDOWN ＋
 * 四則・比較・ネスト）で、ここでは安全な再帰下降パーサで評価する（eval 不使用）。
 */

import { PATTERN_FORMULAS } from "./kijun-fusoku-patterns";

/** 式で参照しうる定数の最大個数（Excel 定数1〜19） */
export const MAX_CONSTS = 19;

export interface SnowInput {
  /** 計算パターンID（例 "K025"）。Excel「計算パターンID」列 */
  patternId: string;
  /** 定数1〜19（Excel 定数1..19）。未設定は null。配列長は可変 */
  consts: (number | null)[];
  /** 基準値（Excel 基準値＝しきい標高 m）。式の「基準値」変数 */
  base: number | null;
  /** 固定積雪量(cm)（Excel 積雪量R）。式の「積雪量」変数 */
  snow: number | null;
}

export interface SnowResult {
  /** 算出された垂直積雪量(cm)。null=算出不可 */
  cm: number | null;
  /** auto=式から確定算出 / manual=算出不可（パターン未割当・定数欠落・式エラー） */
  kind: "auto" | "manual";
  /** 適用したパターンID（autoのとき）。トレース用 */
  patternId: string;
}

const manual = (patternId = ""): SnowResult => ({ cm: null, kind: "manual", patternId });

/* ============================== トークナイザ ============================== */

type Tok =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "id"; v: string }
  | { t: "op"; v: string }
  | { t: "lp" }
  | { t: "rp" }
  | { t: "comma" };

const OP_CHARS = new Set(["+", "-", "*", "/"]);
const CMP_START = new Set(["<", ">", "="]);
// 識別子の区切り文字（ここに該当しない連続文字を識別子とみなす：日本語変数名・関数名）
const DELIM = new Set([" ", "\t", "\n", "(", ")", ",", "+", "-", "*", "/", "<", ">", "=", '"']);

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n") { i++; continue; }
    if (c === "(") { toks.push({ t: "lp" }); i++; continue; }
    if (c === ")") { toks.push({ t: "rp" }); i++; continue; }
    if (c === ",") { toks.push({ t: "comma" }); i++; continue; }
    if (c === '"') {
      let j = i + 1;
      let s = "";
      while (j < n && src[j] !== '"') s += src[j++];
      i = j + 1; // 閉じ " を消費
      toks.push({ t: "str", v: s });
      continue;
    }
    if ((c >= "0" && c <= "9") || (c === "." && /[0-9]/.test(src[i + 1] || ""))) {
      let j = i;
      while (j < n && /[0-9.]/.test(src[j])) j++;
      toks.push({ t: "num", v: parseFloat(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (OP_CHARS.has(c)) { toks.push({ t: "op", v: c }); i++; continue; }
    if (CMP_START.has(c)) {
      // <=, >=, <>, <, >, =
      const two = src.slice(i, i + 2);
      if (two === "<=" || two === ">=" || two === "<>") { toks.push({ t: "op", v: two }); i += 2; continue; }
      toks.push({ t: "op", v: c }); i++; continue;
    }
    // 識別子（日本語変数名・関数名）。区切りに当たるまで読む
    let j = i;
    while (j < n && !DELIM.has(src[j])) j++;
    const id = src.slice(i, j).trim();
    if (id) toks.push({ t: "id", v: id });
    i = j;
  }
  return toks;
}

/* ============================== パーサ / 評価器 ============================== */
/**
 * 文法（優先順位低→高）:
 *   expr    := compare
 *   compare := add (("<="|">="|"<>"|"<"|">"|"=") add)?
 *   add     := mul (("+"|"-") mul)*
 *   mul     := unary (("*"|"/") unary)*
 *   unary   := "-" unary | primary
 *   primary := num | str | id | func "(" args ")" | "(" expr ")"
 * 評価値は number | boolean | string。IF 条件は boolean（数値は !=0 を真）。
 */

/** 変数名 → 値（標高変数 / 定数1..19 / 基準値 / 積雪量） */
type Scope = Record<string, number | null>;

class Parser {
  private p = 0;
  constructor(private toks: Tok[], private scope: Scope) {}

  parse(): number | boolean | string {
    const v = this.expr();
    if (this.p !== this.toks.length) throw new Error("余分なトークン");
    return v;
  }

  private peek(): Tok | undefined { return this.toks[this.p]; }
  private next(): Tok { const t = this.toks[this.p++]; if (!t) throw new Error("式が途中で終了"); return t; }

  private expr(): number | boolean | string { return this.compare(); }

  private compare(): number | boolean | string {
    let left = this.add();
    const t = this.peek();
    if (t && t.t === "op" && ["<=", ">=", "<>", "<", ">", "="].includes(t.v)) {
      this.p++;
      const right = this.add();
      const a = num(left), b = num(right);
      switch (t.v) {
        case "<=": return a <= b;
        case ">=": return a >= b;
        case "<": return a < b;
        case ">": return a > b;
        case "=": return a === b;
        case "<>": return a !== b;
      }
    }
    return left;
  }

  private add(): number | boolean | string {
    let left = this.mul();
    while (true) {
      const t = this.peek();
      if (t && t.t === "op" && (t.v === "+" || t.v === "-")) {
        this.p++;
        const right = this.mul();
        left = t.v === "+" ? num(left) + num(right) : num(left) - num(right);
      } else break;
    }
    return left;
  }

  private mul(): number | boolean | string {
    let left = this.unary();
    while (true) {
      const t = this.peek();
      if (t && t.t === "op" && (t.v === "*" || t.v === "/")) {
        this.p++;
        const right = this.unary();
        left = t.v === "*" ? num(left) * num(right) : num(left) / num(right);
      } else break;
    }
    return left;
  }

  private unary(): number | boolean | string {
    const t = this.peek();
    if (t && t.t === "op" && t.v === "-") { this.p++; return -num(this.unary()); }
    return this.primary();
  }

  private primary(): number | boolean | string {
    const t = this.next();
    if (t.t === "num") return t.v;
    if (t.t === "str") return t.v;
    if (t.t === "lp") {
      const v = this.expr();
      const r = this.next();
      if (r.t !== "rp") throw new Error("括弧が閉じていない");
      return v;
    }
    if (t.t === "id") {
      const nx = this.peek();
      if (nx && nx.t === "lp") return this.func(t.v);
      return this.variable(t.v);
    }
    throw new Error(`想定外トークン: ${JSON.stringify(t)}`);
  }

  private args(): (number | boolean | string)[] {
    const open = this.next();
    if (open.t !== "lp") throw new Error("関数の引数 ( がない");
    const out: (number | boolean | string)[] = [];
    if (this.peek()?.t === "rp") { this.p++; return out; }
    while (true) {
      out.push(this.expr());
      const t = this.next();
      if (t.t === "rp") break;
      if (t.t !== "comma") throw new Error("引数の区切りが不正");
    }
    return out;
  }

  private func(name: string): number | boolean | string {
    const a = this.args();
    switch (name) {
      case "IF": {
        if (a.length !== 3) throw new Error("IF の引数は3つ");
        const cond = a[0];
        const truthy = typeof cond === "boolean" ? cond : num(cond) !== 0;
        return truthy ? a[1] : a[2];
      }
      case "MAX": return Math.max(...a.map(num));
      case "MIN": return Math.min(...a.map(num));
      case "ABS": return Math.abs(num(a[0]));
      case "ROUNDUP": return roundUp(num(a[0]), a.length > 1 ? num(a[1]) : 0);
      case "ROUNDDOWN": return roundDown(num(a[0]), a.length > 1 ? num(a[1]) : 0);
      case "ROUND": { const d = a.length > 1 ? num(a[1]) : 0; const f = Math.pow(10, d); return Math.round(num(a[0]) * f) / f; }
      default: throw new Error(`未対応の関数: ${name}`);
    }
  }

  private variable(name: string): number {
    if (!(name in this.scope)) throw new Error(`未知の変数: ${name}`);
    const v = this.scope[name];
    if (v == null || !Number.isFinite(v)) throw new Error(`変数 ${name} が未設定`);
    return v as number;
  }
}

function num(v: number | boolean | string): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n)) throw new Error(`数値化できない値: ${v}`);
  return n;
}

/** Excel ROUNDUP: 0から遠い側へ d桁に丸める */
function roundUp(x: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.sign(x) * Math.ceil(Math.abs(x) * f) / f;
}
/** Excel ROUNDDOWN: 0に近い側へ d桁に丸める（切り捨て） */
function roundDown(x: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.sign(x) * Math.floor(Math.abs(x) * f) / f;
}

/* ============================== 公開 API ============================== */

/**
 * 標高(m)から垂直積雪量(cm)を確定算出する。
 * @param input 計算パターンID・定数1〜6・基準値・積雪量
 * @param elevationM 入力標高(m)
 */
export function computeSnow(input: SnowInput, elevationM: number): SnowResult {
  const pid = (input.patternId || "").trim();
  if (!pid) return manual();
  if (!Number.isFinite(elevationM) || elevationM < 0) return manual(pid);
  const formula = PATTERN_FORMULAS[pid];
  if (!formula) return manual(pid);

  const c = input.consts || [];
  const scope: Scope = {
    標高変数: elevationM,
    基準値: input.base ?? null,
    積雪量: input.snow ?? null,
  };
  for (let i = 1; i <= MAX_CONSTS; i++) scope[`定数${i}`] = c[i - 1] ?? null;

  try {
    const toks = tokenize(formula);
    const raw = new Parser(toks, scope).parse();
    const cm = num(raw);
    if (!Number.isFinite(cm) || cm < 0 || cm > 3000) return manual(pid); // 妥当域ガード
    // 浮動小数点ノイズを除去（小数1桁）
    return { cm: Math.round(cm * 10) / 10, kind: "auto", patternId: pid };
  } catch {
    return manual(pid);
  }
}
