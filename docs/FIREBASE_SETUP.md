# 🔥 Firebase 設定完整指南

## 步驟 1：創建 Firebase 專案

### 1.1 前往 Firebase Console
- 開啟瀏覽器，前往：https://console.firebase.google.com/
- 使用您的 Google 帳號登入

### 1.2 建立新專案
1. 點擊「建立專案」或「新增專案」
2. 輸入專案名稱：`my-wallet-app`（或您喜歡的名稱）
3. 專案 ID 會自動產生，例如：`my-wallet-app-12345`
4. 選擇是否啟用 Google Analytics（建議啟用）
5. 如果啟用 Analytics，選擇或創建 Analytics 帳戶
6. 點擊「建立專案」並等待完成

## 步驟 2：設定 Web 應用程式

### 2.1 註冊 Web 應用程式
1. 在專案概覽頁面，點擊「Web」圖示（</>）
2. 輸入應用程式暱稱：`錢包管理 App`
3. 勾選「同時為此應用程式設定 Firebase Hosting」（可選）
4. 點擊「註冊應用程式」

### 2.2 取得配置代碼
註冊完成後，會顯示類似以下的配置代碼：
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",
  authDomain: "my-wallet-app-12345.firebaseapp.com",
  projectId: "my-wallet-app-12345",
  storageBucket: "my-wallet-app-12345.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```
**重要：複製這段配置代碼，稍後需要使用！**

## 步驟 3：啟用 Authentication（驗證）

### 3.1 設定 Authentication
1. 在左側選單點擊「Authentication」
2. 點擊「開始使用」
3. 切換到「Sign-in method」頁籤

### 3.2 啟用 Google 登入
1. 在提供者清單中找到「Google」
2. 點擊「Google」進入設定
3. 切換「啟用」開關
4. 設定專案的公開名稱：`我的錢包管理`
5. 輸入專案支援電子郵件（您的 Gmail 地址）
6. 點擊「儲存」

### 3.3 設定授權網域
1. 在 Authentication 設定中找到「授權網域」
2. 預設會包含 localhost 和您的 Firebase 網域
3. 新增您的 GitHub Pages 網域：`hotdogcat0228.github.io`
4. 點擊「新增網域」並輸入完整網域

## 步驟 4：設定 Firestore Database

### 4.1 建立 Firestore 資料庫
1. 在左側選單點擊「Firestore Database」
2. 點擊「建立資料庫」
3. 選擇「以測試模式啟動」
4. 選擇資料庫位置，建議選擇：
   - `asia-east1` (台灣)
   - `asia-northeast1` (日本)
   - `asia-southeast1` (新加坡)
5. 點擊「完成」

### 4.2 設定安全規則
1. 在 Firestore 中點擊「規則」頁籤
2. 將預設規則替換為以下內容：
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 允許已驗證使用者存取自己的錢包資料
    match /users/{userId}/wallets/{walletId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // 允許使用者建立自己的使用者文件
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
3. 點擊「發布」

## 步驟 5：更新程式碼配置

### 5.1 替換 Firebase 配置
將步驟 2.2 取得的配置代碼替換到 `index.html` 中的：
```javascript
// 找到這個區塊並替換
const firebaseConfig = {
  // 將您的實際配置貼在這裡
};
```

### 5.2 測試配置
1. 儲存檔案
2. 用瀏覽器開啟 `index.html`
3. 檢查瀏覽器開發者工具的 Console 是否有錯誤訊息

## 步驟 6：部署與測試

### 6.1 推送到 GitHub
```bash
git add .
git commit -m "更新 Firebase 專案配置"
git push
```

### 6.2 測試功能
1. 前往您的 GitHub Pages 網址：
   `https://hotdogcat0228.github.io/accounting/`
2. 點擊「Google 登入」
3. 測試建立錢包、存取資料等功能

## � 安全檢查清單

- ✅ Firebase 專案已建立
- ✅ Authentication 已啟用 Google 登入
- ✅ Firestore 資料庫已建立
- ✅ 安全規則已設定
- ✅ 授權網域已設定
- ✅ 配置代碼已更新
- ✅ 功能測試通過

## � 常見問題

### Q1: 登入時出現「unauthorized_client」錯誤
**A:** 檢查 Authentication 設定中的授權網域是否包含您的網站網域

### Q2: 無法讀取/寫入 Firestore 資料
**A:** 檢查 Firestore 安全規則是否正確設定

### Q3: Firebase 配置錯誤
**A:** 確認配置代碼中的專案 ID、API Key 等資訊是否正確

### Q4: 本地測試正常但線上版本有問題
**A:** 檢查授權網域是否包含 GitHub Pages 網域

## 💡 最佳實踐

1. **定期備份資料**：考慮定期導出 Firestore 資料
2. **監控使用量**：定期檢查 Firebase 使用量避免超出免費額度
3. **安全規則測試**：使用 Firebase Console 的規則模擬器測試安全規則
4. **錯誤監控**：啟用 Firebase Crashlytics 監控應用程式錯誤

## � 需要協助？

如果您在設定過程中遇到問題：
1. 檢查 Firebase Console 中的狀態
2. 查看瀏覽器開發者工具的 Console 錯誤訊息
3. 確認所有步驟都已正確完成
