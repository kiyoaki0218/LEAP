import io, sys

P = "index.html"
s = io.open(P, encoding="utf-8", newline="").read().replace("\r\n", "\n").replace("\r", "\n")


def rep(old, new):
    global s
    if old not in s:
        sys.exit("ANCHOR NOT FOUND:\n" + old[:160])
    s = s.replace(old, new, 1)


# 1) カスタムJSON読み込み
rep('          } else { alert("配列形式のJSONを指定してください。"); }\n        } catch (err) { alert("JSONのパースに失敗しました。"); }',
'''          } else {
            showAlert({ title: "読み込みエラー", message: "配列形式のJSONを指定してください。", icon: "📄" });
          }
        } catch (err) {
          showAlert({ title: "読み込みエラー", message: "JSONのパースに失敗しました。", icon: "⚠️" });
        }''')

# 2) 開始ID > 終了ID
rep('        if (start > end) { alert("開始IDは終了ID以下にしてください。"); return; }',
'''        if (start > end) {
          showAlert({ title: "範囲の指定を確認", message: "開始IDは終了ID以下にしてください。", icon: "🔢" });
          return;
        }''')

# 3) Part未選択
rep('        alert("出題するPartを1つ以上選択してください。\\n「全選択」で利用可能なPartをまとめて選べます。");\n        return;',
'''        showAlert({
          title: "Partを選択してください",
          message: "出題するPartを1つ以上選択してください。\\n「全選択」で利用可能なPartをまとめて選べます。",
          icon: "📚"
        });
        return;''')

# 4) 苦手単語なし
rep('        alert(currentSubject === "kobun" ? "このゾーンで間違えた苦手単語はまだありません！" : "間違えた苦手単語はまだありません！");\n        return;',
'''        showAlert({
          title: "苦手単語がありません",
          message: currentSubject === "kobun" ? "このゾーンで間違えた苦手単語はまだありません！" : "間違えた苦手単語はまだありません！",
          icon: "🧠"
        });
        return;''')

# 5) 範囲に単語がない
rep('''        alert(`指定された範囲（ID: ${selectedRange.start}〜${selectedRange.end}）に単語が存在しません。\\n※ 現在はID: ${range.start}〜${range.end}に対応しています。`);
        return;''',
'''        showAlert({
          title: "単語が見つかりません",
          message: `指定された範囲（ID: ${selectedRange.start}〜${selectedRange.end}）に単語が存在しません。\\n※ 現在はID: ${range.start}〜${range.end}に対応しています。`,
          icon: "🔍"
        });
        return;''')

# 6) 学習状況に該当なし
rep('''          alert(`学習状況「${labelText}」に該当する単語がありません。\\n条件を「すべて」に戻すか、範囲を広げてください。`);
          return;''',
'''          showAlert({
            title: "該当する単語がありません",
            message: `学習状況「${labelText}」に該当する単語がありません。\\n条件を「すべて」に戻すか、範囲を広げてください。`,
            icon: "🎯"
          });
          return;''')

# 7) 単語データ未読込（デイリー）
rep('''        alert("単語データが読み込まれていません。");
        return;''',
'''        showAlert({ title: "単語データがありません", message: "単語データが読み込まれていません。", icon: "📥" });
        return;''')

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("patched ok")
