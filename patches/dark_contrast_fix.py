import io, re, sys

PATH = "index.html"
START_MARK = "    /* ===== ダークモード"
END_MARK = "  </style>"

NEW_CSS = """    /* ===== ダークモード（.dark / data-theme="dark"） ===== */
    html.dark, html[data-theme="dark"] { color-scheme: dark; }
    html.dark body, html[data-theme="dark"] body {
      background-color: #0b1120 !important;
      color: #e2e8f0 !important;
    }

    /* --- 面（背景） --- */
    html.dark [class~="bg-white"], html.dark [class*="bg-white/"],
    html.dark [class~="bg-slate-50"], html.dark [class*="bg-slate-50/"] {
      background-color: #1e293b !important;
    }
    html.dark [class~="bg-slate-100"], html.dark [class*="bg-slate-100/"] {
      background-color: #334155 !important;
    }
    html.dark [class~="bg-slate-200"], html.dark [class*="bg-slate-200/"] {
      background-color: #263449 !important;
    }
    html.dark [class~="bg-emerald-50"], html.dark [class*="bg-emerald-50/"] { background-color: rgba(16,185,129,0.18) !important; }
    html.dark [class~="bg-emerald-100"], html.dark [class*="bg-emerald-100/"] { background-color: rgba(16,185,129,0.28) !important; }
    html.dark [class~="bg-emerald-200"], html.dark [class*="bg-emerald-200/"] { background-color: rgba(16,185,129,0.34) !important; }
    html.dark [class~="bg-amber-50"], html.dark [class*="bg-amber-50/"] { background-color: rgba(217,119,6,0.20) !important; }
    html.dark [class~="bg-amber-100"], html.dark [class*="bg-amber-100/"] { background-color: rgba(217,119,6,0.30) !important; }
    html.dark [class~="bg-rose-50"], html.dark [class*="bg-rose-50/"] { background-color: rgba(225,29,72,0.20) !important; }
    html.dark [class~="bg-rose-100"], html.dark [class*="bg-rose-100/"] { background-color: rgba(225,29,72,0.30) !important; }
    html.dark [class~="bg-red-50"], html.dark [class*="bg-red-50/"] { background-color: rgba(220,38,38,0.20) !important; }
    html.dark [class~="bg-red-100"], html.dark [class*="bg-red-100/"] { background-color: rgba(220,38,38,0.30) !important; }
    html.dark [class~="bg-sky-50"], html.dark [class*="bg-sky-50/"] { background-color: rgba(2,132,199,0.20) !important; }
    html.dark [class~="bg-sky-100"], html.dark [class*="bg-sky-100/"] { background-color: rgba(2,132,199,0.30) !important; }
    html.dark [class~="bg-indigo-50"], html.dark [class*="bg-indigo-50/"] { background-color: rgba(79,70,229,0.22) !important; }
    html.dark [class~="bg-indigo-100"], html.dark [class*="bg-indigo-100/"] { background-color: rgba(79,70,229,0.32) !important; }
    html.dark [class~="bg-orange-50"], html.dark [class*="bg-orange-50/"] { background-color: rgba(234,88,12,0.20) !important; }
    html.dark [class~="bg-orange-100"], html.dark [class*="bg-orange-100/"] { background-color: rgba(234,88,12,0.30) !important; }
    html.dark [class~="bg-yellow-50"], html.dark [class*="bg-yellow-50/"] { background-color: rgba(202,138,4,0.20) !important; }
    html.dark [class~="bg-yellow-100"], html.dark [class*="bg-yellow-100/"] { background-color: rgba(202,138,4,0.30) !important; }
    html.dark [class~="bg-purple-100"], html.dark [class*="bg-purple-100/"] { background-color: rgba(147,51,234,0.30) !important; }
    html.dark [class~="bg-teal-100"], html.dark [class*="bg-teal-100/"] { background-color: rgba(13,148,136,0.30) !important; }
    /* 白文字を乗せる強い緑は少し濃くしてコントラストを確保 */
    html.dark [class~="bg-emerald-400"], html.dark [class~="bg-emerald-500"] { background-color: #047857 !important; }
    html.dark [class~="bg-amber-400"], html.dark [class~="bg-amber-500"] { background-color: #b45309 !important; }
    html.dark [class~="bg-rose-500"], html.dark [class~="bg-rose-600"] { background-color: #be123c !important; }

    /* --- 文字色 --- */
    html.dark [class~="text-slate-900"], html.dark [class~="text-slate-800"] { color: #f8fafc !important; }
    html.dark [class~="text-slate-700"], html.dark [class~="text-slate-600"] { color: #dbe4ef !important; }
    html.dark [class~="text-slate-500"] { color: #b6c3d4 !important; }
    html.dark [class~="text-slate-400"] { color: #cbd5e1 !important; }
    html.dark [class~="text-emerald-600"], html.dark [class~="text-emerald-700"] { color: #6ee7b7 !important; }
    html.dark [class~="text-emerald-800"], html.dark [class~="text-emerald-900"] { color: #a7f3d0 !important; }
    html.dark [class~="text-amber-600"], html.dark [class~="text-amber-700"],
    html.dark [class~="text-amber-800"], html.dark [class~="text-amber-900"] { color: #fcd34d !important; }
    html.dark [class~="text-rose-600"], html.dark [class~="text-rose-700"],
    html.dark [class~="text-rose-800"] { color: #fda4af !important; }
    html.dark [class~="text-red-600"], html.dark [class~="text-red-700"] { color: #fca5a5 !important; }
    html.dark [class~="text-sky-600"], html.dark [class~="text-sky-700"] { color: #7dd3fc !important; }
    html.dark [class~="text-indigo-600"], html.dark [class~="text-indigo-700"] { color: #a5b4fc !important; }
    html.dark [class~="text-orange-600"], html.dark [class~="text-orange-700"] { color: #fdba74 !important; }
    html.dark [class~="text-yellow-600"], html.dark [class~="text-yellow-700"] { color: #fde68a !important; }
    html.dark [class~="text-purple-600"] { color: #d8b4fe !important; }
    html.dark [class~="text-teal-600"], html.dark [class~="text-teal-700"] { color: #5eead4 !important; }
    html.dark [class~="text-slate-300"] { color: #e2e8f0 !important; }

    /* --- 枠線 --- */
    html.dark [class~="border-slate-100"], html.dark [class~="border-slate-200"],
    html.dark [class~="border-slate-300"], html.dark [class*="border-slate-200/"] {
      border-color: #334155 !important;
    }
    html.dark [class~="border-emerald-200"], html.dark [class~="border-emerald-300"] { border-color: rgba(16,185,129,0.45) !important; }
    html.dark [class~="border-amber-200"], html.dark [class~="border-amber-300"] { border-color: rgba(217,119,6,0.45) !important; }
    html.dark [class~="border-rose-200"] { border-color: rgba(225,29,72,0.45) !important; }
    html.dark [class~="border-slate-700"] { border-color: #334155 !important; }

    /* --- フォーム・その他 --- */
    html.dark input, html.dark select, html.dark textarea {
      background-color: #1e293b !important;
      color: #f8fafc !important;
      border-color: #475569 !important;
    }
    html.dark input::placeholder, html.dark textarea::placeholder { color: #94a3b8 !important; }
    html.dark header { border-color: #334155 !important; }
    html.dark footer { color: #94a3b8 !important; }
    html.dark #toast { background-color: #f8fafc !important; color: #0f172a !important; }
    /* 進行バー・選択状態などが沈まないように */
    html.dark .bg-emerald-200\\/60 { background-color: rgba(16,185,129,0.35) !important; }
"""

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    s = f.read()

start = s.find(START_MARK)
if start < 0:
    sys.exit("start marker not found")
end = s.find(END_MARK, start)
if end < 0:
    sys.exit("end marker not found")

# 既存ブロックを置換（改行はそのまま維持）
s = s[:start] + NEW_CSS + s[end:]

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(s)

print("dark css replaced:", len(NEW_CSS), "chars")
