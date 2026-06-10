# -*- coding: utf-8 -*-
"""Excel(50期生産本部KPIマスタ)から移行用JSONを生成する。
出力: scripts/migrate-seisan-kpi/data/*.json
対象: 期 / KPIマスタ(63) / グループ+所属 / 過去実績
"""
import openpyxl, io, json, os

XLSX = r"C:\Users\tatsuma.m\Downloads\50期生産本部KPIマスタ(0526最終）.xlsx"
OUT = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(OUT, exist_ok=True)

def dump(name, obj):
    with io.open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    print(f"  {name}: {len(obj) if isinstance(obj,list) else 'ok'}")

wb = openpyxl.load_workbook(XLSX, data_only=True)

# ---- 1) 期マスタ ----
period = [{
    "期": 50, "期間開始日": "2025-08-01", "期間終了日": "2026-07-31",
    "経過月数": 9, "当期フラグ": True, "備考": "50期(令和7年8月〜令和8年7月)"
}]
dump("period.json", period)

# ---- 2) KPIマスタ(07_KPIマスタ) ----
ws = wb["07_KPIマスタ"]
rows = list(ws.iter_rows(values_only=True))
# ヘッダ行を探す
hdr_idx = next(i for i,r in enumerate(rows) if r and r[0]=="KPI_ID")
kpis = []
for r in rows[hdr_idx+1:]:
    if not r or not r[0] or not str(r[0]).startswith("M-"):
        continue
    def g(i): return r[i] if i < len(r) else None
    kpis.append({
        "KPIコード": str(g(0)).strip(),
        "階層": g(1), "部門": g(2), "部署": g(3), "カテゴリ": g(4),
        "KPI名称": g(5), "単位": g(6), "集計タイプ": g(7), "良い方向": g(8),
        "49期実績": g(9), "年間目標": g(10), "月次目標換算": g(11),
        "KPIオーナー": g(12), "データソース": g(13), "入力タイミング": g(14),
        "備考": g(15),
        "期": 50, "並び順": int(str(g(0)).replace("M-","")) if str(g(0)).replace("M-","").isdigit() else 0,
        "有効フラグ": True,
    })
dump("kpi-master.json", kpis)

# ---- 3) グループ + 所属(M:N) ----
groups = [
    {"グループコード":"G-鉄工課","グループ名":"鉄工課グループ","グループ種別":"機能別","期":50,"並び順":10,"有効フラグ":True},
    {"グループコード":"G-縫製課","グループ名":"縫製課グループ","グループ種別":"機能別","期":50,"並び順":20,"有効フラグ":True},
    {"グループコード":"G-北関東工場","グループ名":"北関東工場グループ","グループ種別":"拠点別","期":50,"並び順":30,"有効フラグ":True},
    {"グループコード":"G-生産管理","グループ名":"生産管理部グループ","グループ種別":"機能別","期":50,"並び順":40,"有効フラグ":True},
]
members_def = {
    "G-鉄工課": ["本社鉄工課","第2工場鉄工課","北関東鉄工課"],
    "G-縫製課": ["本社縫製課","北多久縫製課","北関東縫製課"],
    "G-北関東工場": ["北関東鉄工課","北関東縫製課"],
    "G-生産管理": ["調達課","生産管理課","検査課"],
}
members = []
for gid, depts in members_def.items():
    for i, d in enumerate(depts):
        members.append({"所属コード":f"{gid}-{d}","グループコード":gid,"部署":d,"部署コード":"","期":50,"並び順":(i+1)*10})
dump("groups.json", {"groups": groups, "members": members})

# ---- 4) 過去実績(06_過去実績) Excel実値 ----
P = [43,44,45,46,47,48,49]
hist_src = [
    ("鉄工全体生産量","t/年",[1377,1189,1237,1379,1437,1504,1362],1505,"部門"),
    ("鉄工一人当たり生産量","t/人",[4.8,3.5,4.3,4.4,4.0,4.4,3.9],4.1,"部門"),
    ("縫製全体生産量","㎡/年",[347194,388614,370312,373379,408000,343936,420581],447058,"部門"),
    ("クレーム件数","件/年",[40,30,20,18,14,10,16],6,"全社"),
    ("社内不具合件数","件/年",[115,89,81,76,84,65,64],51,"全社"),
    ("粗利率","%",[None,None,None,None,None,None,34.8],35,"全社"),
    ("総資産回転率","回",[None,None,None,None,1.04,1.04,1.16],1.25,"全社"),
]
history = []
for name, unit, vals, tgt, lvl in hist_src:
    for p, v in zip(P, vals):
        if v is None: continue
        history.append({"履歴コード":f"{name}-{p}","指標名":name,"単位":unit,"期":p,"実績値":v,"50期目標":tgt,"集計レベル":lvl})
dump("history.json", history)

print("DONE")
