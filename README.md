# 聖經真理

以 Google 試算表保存影音、影音類型與管理者名單的簡化版影音收集 Web App。前端參考 `https://notemaker.github.io/youtube/` 的收藏清單概念，但只保留搜尋、影音類型篩選、Google 管理者登入與必要的新增按鈕。

## 本機預覽

```bash
npm start
```

開啟 `http://localhost:3000`。未設定 Apps Script 時，畫面會顯示示範資料；示範管理者模式只用於預覽，不是正式權限驗證。

## Google 試算表設定

1. 建立一份專用 Google 試算表，開啟「擴充功能 → Apps Script」。
2. 將 `apps-script/Code.gs` 的全部內容貼到 `Code.gs`。
3. 在 `Code.gs` 的 `CONFIG` 設定 `SPREADSHEET_ID` 與 `GOOGLE_CLIENT_ID`。試算表 ID 只放在 Apps Script，不放公開前端。
4. 執行 `setup()` 並完成 Google 授權。它會建立 `Media`、`Types`、`Admins` 三張工作表。
5. 在 `Admins` 第一筆資料填入管理者 Google 帳號 email，`active` 填 `TRUE`。
6. 在 Google Cloud Console 建立 Web application OAuth Client ID，把網站來源加入 Authorized JavaScript origins。
7. Apps Script 選擇「部署 → 新增部署 → 網頁應用程式」，執行身分選「我」，誰可以存取選「任何人」，使用正式 `/exec` 網址。
8. 回到網站，點選「管理者登入」，在連線設定填入 `/exec` 網址與 Google OAuth Client ID。

## 試算表欄位

- `Media`: `id | title | url | type | description | createdAt | createdBy | thumbnail`
- `Types`: `id | name | createdAt`
- `Admins`: `email | displayName | active`

Apps Script 會在伺服器端驗證 Google Identity Services 的 ID token，再比對 `Admins` 工作表；前端不自行決定正式管理權限。正式資料驗收需要使用者部署自己的 `/exec` 並連接自己的試算表，本專案不宣稱已完成真實雲端讀寫驗收。

## YouTube 分享收藏

網站另外提供 PWA 分享目標：`manifest.json` 將 `/ytc/share-target.html` 登記為分享接收頁。Android Chrome 安裝此 PWA 後，可從 YouTube「分享」選單選擇「聖經真理」；影片資料會寫入同一份試算表的 `YouTube收藏` 分頁，並在首頁的「YouTube 分享收藏」區顯示。此資料流使用獨立 Apps Script endpoint，不取代既有 `Media`、`Types`、`Admins` 工作表或管理者 API。

## 重要安全提醒

YouTube 分享功能的 Apps Script `/exec` 網址會出現在公開前端，因為 GitHub Pages 靜態網站沒有可隱藏的伺服器端秘密；知道網址的人可呼叫清單讀取與新增功能。請只用於可公開的影片收藏，不要存放敏感資料。原管理者 API 的驗證仍由 Apps Script 伺服器端執行；若要限制 YouTube 收藏的讀取或寫入權限，需把該 API 移到有身分驗證的後端代理。試算表本身不必公開。
