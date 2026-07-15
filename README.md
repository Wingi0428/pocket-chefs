# 混亂小廚房：口袋主廚

一款可直接部署到 GitHub Pages、支援手機橫向觸控操作的原創料理動作遊戲。

> 本專案的玩法受到多人料理動作遊戲類型啟發，但名稱、程式、美術、介面與內容皆為原創，未使用《Overcooked! 2》的官方素材、角色、商標或關卡。

## 遊戲內容

- 手機虛擬搖桿
- 拿取／放下、切菜、衝刺操作
- 番茄、洋蔥、蘑菇三種湯品
- 切菜、下鍋、烹煮、燒焦、裝盤、出餐
- 訂單倒數、連擊獎勵、星級評分
- AI 助手定期準備切好的食材
- 自動儲存最高分
- PWA 支援，可加入手機主畫面
- 桌機鍵盤操作

## 操作方式

### 手機

- 左側搖桿：移動
- 「拿」：拿取、放下、裝盤、送餐
- 「切」：在砧板切菜；鍋子燒焦或配方錯誤時清鍋
- 「衝」：短距離加速

### 桌機

- WASD／方向鍵：移動
- E：拿取／放下／互動
- 空白鍵：切菜／清鍋
- Shift：衝刺
- Esc：暫停

## GitHub Pages 部署

1. 在 GitHub 建立一個新的公開 Repository，例如 `pocket-chefs`。
2. 將本資料夾內的所有檔案上傳到 Repository 根目錄。
3. 開啟 Repository 的 **Settings**。
4. 左側選擇 **Pages**。
5. 在 **Build and deployment** 的 Source 選擇 **Deploy from a branch**。
6. Branch 選擇 `main`，資料夾選擇 `/ (root)`，按下 **Save**。
7. 等候 GitHub 完成部署後，頁面會顯示遊戲網址。

網址通常會是：

```text
https://你的GitHub帳號.github.io/pocket-chefs/
```

## 手機安裝成 App

部署後用手機瀏覽器開啟網址：

- iPhone Safari：分享 → 加入主畫面
- Android Chrome：選單 → 安裝應用程式／加到主畫面

## 專案結構

```text
.
├── index.html
├── style.css
├── game.js
├── manifest.webmanifest
├── service-worker.js
├── LICENSE
└── assets/
    ├── icon-192.png
    └── icon-512.png
```

## 授權與聲明

本專案程式碼採 MIT License。遊戲由使用者提出需求，並由 OpenAI GPT-5.6 Thinking 協助設計與產生第一版程式碼。
