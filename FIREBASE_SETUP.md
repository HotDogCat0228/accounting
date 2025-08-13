# Firebase 設定指南

## 🔥 如何設定 Firebase

### 步驟 1：創建 Firebase 專案
1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 點擊「建立專案」
3. 輸入專案名稱（例如：my-wallet-app）
4. 依照指示完成專案設定

### 步驟 2：啟用驗證功能
1. 在 Firebase 控制台左側選單點擊「Authentication」
2. 點擊「開始使用」
3. 進入「Sign-in method」頁籤
4. 啟用「Google」登入方式
5. 輸入您的專案支援電子郵件地址

### 步驟 3：設定 Firestore 資料庫
1. 在左側選單點擊「Firestore Database」
2. 點擊「建立資料庫」
3. 選擇「以測試模式啟動」（稍後可以調整安全規則）
4. 選擇資料庫位置（建議選擇 asia-east1）

### 步驟 4：獲取專案配置
1. 點擊專案設定（齒輪圖示）
2. 向下捲動到「您的應用程式」區段
3. 點擊「Web 應用程式」圖示 (</>)
4. 註冊應用程式名稱
5. 複製提供的配置物件

### 步驟 5：更新程式碼
將您的 Firebase 配置貼到 `index.html` 中：

```html
const firebaseConfig = {
    apiKey: "您的-api-key",
    authDomain: "您的專案.firebaseapp.com",
    projectId: "您的專案-id",
    storageBucket: "您的專案.appspot.com",
    messagingSenderId: "您的-sender-id",
    appId: "您的-app-id"
};
```

### 步驟 6：設定 Firestore 安全規則（重要！）
1. 在 Firestore Database 中點擊「規則」頁籤
2. 將規則更新為：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 允許用戶只能存取自己的錢包資料
    match /users/{userId}/wallets/{walletId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 🌐 啟用 GitHub Pages 的 Firebase 功能

### 設定授權域名
1. 在 Firebase Console 中進入「Authentication」
2. 點擊「Settings」頁籤
3. 在「授權網域」區段點擊「新增網域」
4. 添加您的 GitHub Pages 網域：`您的用戶名.github.io`

## 🚀 完成！

設定完成後，您的程式將具備以下功能：
- ✅ Google 帳號登入
- ✅ 雲端同步錢包資料
- ✅ 多裝置存取
- ✅ 即時資料更新

## 🔒 安全注意事項

1. **永遠不要將 Firebase API 金鑰推送到公開的 GitHub repository**
2. **正確設定 Firestore 安全規則**
3. **定期檢查 Firebase 使用量**

## 💡 測試建議

在正式上線前，建議：
1. 在不同裝置上測試登入功能
2. 測試錢包資料的同步
3. 確認離線時的行為
4. 檢查網路連線中斷後的資料恢復
