# -*- coding: utf-8 -*-
"""Excel 02_KPI実績入力 から 50期 月次実績(縦持ち)を生成 → data/actuals.json"""
import openpyxl, io, json, os
XLSX = r"C:\Users\tatsuma.m\Downloads\50期生産本部KPIマスタ(0526最終）.xlsx"
OUT = os.path.join(os.path.dirname(__file__), "data")
wb = openpyxl.load_workbook(XLSX, data_only=True)
ws = wb["02_KPI実績入力"]
rows = list(ws.iter_rows(values_only=True))
# ヘッダ行(KPI_ID で始まる)を探す
hdr_idx = next(i for i,r in enumerate(rows) if r and r[0]=="KPI_ID")
hdr = rows[hdr_idx]
# 月カラムの列インデックスを特定(8月..7月)
month_labels = ["8月","9月","10月","11月","12月","1月","2月","3月","4月","5月","6月","7月"]
col = {}
for ci,h in enumerate(hdr):
    if h in month_labels and h not in col:
        col[h] = ci
# 会計月序: 8月=1..7月=12
fm_of = {lbl:i+1 for i,lbl in enumerate(month_labels)}
# 対象年月(50期=2025-08開始)
def ym(fm):
    monthnum = ((fm-1+7)%12)+1
    year = 2025 if fm<=5 else 2026
    return f"{year}-{monthnum:02d}"

actuals = []
for r in rows[hdr_idx+1:]:
    if not r or not r[0] or not str(r[0]).startswith("M-"): continue
    kpi = str(r[0]).strip()
    for lbl,ci in col.items():
        v = r[ci] if ci < len(r) else None
        if v is None or (isinstance(v,str) and v.strip()==""): continue
        try: val = float(v)
        except: continue
        fm = fm_of[lbl]
        actuals.append({"実績コード":f"50-{kpi.replace('-','')}-{ym(fm).replace('-','')}",
                        "期":50,"KPIコード":kpi,"対象年月":ym(fm),"会計月序":fm,"実績値":val})
with io.open(os.path.join(OUT,"actuals.json"),"w",encoding="utf-8") as f:
    json.dump(actuals,f,ensure_ascii=False,indent=2)
print("actuals.json:", len(actuals), "件")
# KPI数と月分布
from collections import Counter
print("KPI数:", len(set(a["KPIコード"] for a in actuals)))
