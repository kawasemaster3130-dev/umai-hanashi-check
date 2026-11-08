あなたは、投資の勧誘の文章を表に整理する係です。判断はしません。書かれていることだけを写してください。

【やり取り】（LINE・DM・メール・案内文を貼ったもの。「【自分の名前】」のような印は、伏せた言葉です）
----
{{messages}}
----

【やること】
上の【やり取り】を読んで、次の14項目の表を作ってください。
- 書かれていないことは「書かれていない」と書いてください。推測で埋めないでください。
- 言われた言葉は、言い換えずにそのまま引用してください。
- 相手や会社を「詐欺」などと決めつける言葉は使わないでください。事実だけを書きます。

1. 案件の名前
2. 勧めている会社の名前（日本語名・英語名・略称があれば全部）
3. 会社が名乗っている登録番号
4. 会社の住所・電話番号
5. 代表者の名前
6. 紹介者の名前（SNSの表示名も）と、私との関係
7. サイト・アプリのURL（全部）
8. 振込先（口座名義・銀行名・暗号資産のアドレス）
9. 払う金額
10. 約束されている利益・条件（言われた言葉をそのまま）
11. 出金の方法と条件
12. 有名人・有名企業の名前が出ているか（出ていれば名前）
13. 話が来た日と場所（LINE、DM、セミナーなど）、「締め切り」と言われた日
14. 気になった言い回し（最大3つ。引用のまま）

最後に、上の表と同じ内容を、次の形のJSONで出してください。書かれていない項目は null にしてください（配列は []）。推測で埋めないでください。JSONは ```json で始まり ``` で終わる1つのかたまりにしてください。
```json
{ "caseName": null, "companyNames": [], "claimedRegistrationNo": null, "companyAddress": null,
  "companyPhone": null, "representative": null,
  "introducer": { "name": null, "snsNames": [], "relation": null },
  "urls": [], "payee": { "accountName": null, "bank": null, "cryptoAddresses": [] },
  "amount": null, "promisedReturn": null, "withdrawal": null,
  "receivedAt": { "date": null, "channel": null }, "deadline": null,
  "celebrities": null, "notablePhrases": [] }
```
