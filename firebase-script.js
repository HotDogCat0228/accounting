// Firebase 版本的錢包管理器
class FirebaseWalletManager {
    constructor() {
        this.user = null;
        this.wallets = [];
        this.currentEditingWallet = null;
        this.currentTransactionWallet = null;
        this.transactionType = null;
        this.unsubscribe = null;
        
        // 等待 Firebase 初始化完成
        this.waitForFirebase().then(() => {
            this.init();
        });
    }

    // 等待 Firebase 載入完成
    async waitForFirebase() {
        return new Promise((resolve) => {
            const checkFirebase = () => {
                if (window.db && window.auth) {
                    resolve();
                } else {
                    setTimeout(checkFirebase, 100);
                }
            };
            checkFirebase();
        });
    }

    // 初始化應用程式
    init() {
        this.bindEvents();
        this.setupAuthListener();
        
        // 隱藏錢包容器直到用戶登入
        document.getElementById('walletsContainer').style.display = 'none';
        document.getElementById('addWalletBtn').style.display = 'none';
    }

    // 設定驗證狀態監聽器
    async setupAuthListener() {
        try {
            // 載入 Firebase Auth 模組
            if (!window.authModule) {
                const authModule = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                window.authModule = authModule;
            }
            
            const { onAuthStateChanged, getRedirectResult } = window.authModule;
            
            // 先檢查是否有重定向結果（手機登入回來時）
            try {
                console.log('檢查重定向登入結果...');
                const redirectResult = await getRedirectResult(window.auth);
                if (redirectResult && redirectResult.user) {
                    console.log('發現重定向登入結果:', redirectResult.user.email);
                    this.showNotification(`歡迎回來，${redirectResult.user.displayName || redirectResult.user.email}！`, 'success');
                }
            } catch (redirectError) {
                console.warn('檢查重定向結果時出錯:', redirectError);
            }
            
            // 設定認證狀態監聽器
            onAuthStateChanged(window.auth, (user) => {
                this.handleAuthStateChange(user);
            });
        } catch (error) {
            console.error('載入 Firebase Auth 模組失敗:', error);
            this.showNotification('載入認證模組失敗，請重新整理頁面', 'error');
        }
    }

    // 處理驗證狀態變更
    handleAuthStateChange(user) {
        this.user = user;
        
        if (user) {
            // 用戶已登入
            this.showUserSection(user);
            this.hideLoginSection();
            this.showWalletSection();
            this.setupFirestoreListener();
        } else {
            // 用戶已登出
            this.showLoginSection();
            this.hideUserSection();
            this.hideWalletSection();
            this.clearFirestoreListener();
            this.wallets = [];
        }
    }

    // 顯示用戶資訊區域
    showUserSection(user) {
        const userSection = document.getElementById('userSection');
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        
        userAvatar.src = user.photoURL || 'https://via.placeholder.com/40/667eea/ffffff?text=用戶';
        userName.textContent = user.displayName || user.email;
        userSection.style.display = 'flex';
    }

    // 隱藏用戶資訊區域
    hideUserSection() {
        document.getElementById('userSection').style.display = 'none';
    }

    // 顯示登入區域
    showLoginSection() {
        document.getElementById('loginSection').style.display = 'block';
    }

    // 隱藏登入區域
    hideLoginSection() {
        document.getElementById('loginSection').style.display = 'none';
    }

    // 顯示錢包區域
    showWalletSection() {
        document.getElementById('walletsContainer').style.display = 'grid';
        document.getElementById('addWalletBtn').style.display = 'inline-block';
    }

    // 隱藏錢包區域
    hideWalletSection() {
        document.getElementById('walletsContainer').style.display = 'none';
        document.getElementById('addWalletBtn').style.display = 'none';
    }

    // 設定 Firestore 監聽器
    setupFirestoreListener() {
        if (!this.user) return;

        // 動態導入 Firestore 模組
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js')
            .then(({ collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc, deleteDoc, addDoc }) => {
                window.firestoreModule = { collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc, deleteDoc, addDoc };
                
                const walletsRef = collection(window.db, 'users', this.user.uid, 'wallets');
                const q = query(walletsRef, orderBy('createdAt', 'desc'));
                
                this.unsubscribe = onSnapshot(q, (snapshot) => {
                    this.wallets = [];
                    snapshot.forEach((doc) => {
                        this.wallets.push({
                            id: doc.id,
                            ...doc.data()
                        });
                    });
                    this.renderWallets();
                });
            });
    }

    // 清除 Firestore 監聽器
    clearFirestoreListener() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    // Google 登入
    async loginWithGoogle() {
        try {
            console.log('開始 Google 登入流程...');
            
            // 確保 Firebase Auth 模組已載入
            if (!window.authModule) {
                console.log('載入 Firebase Auth 模組...');
                const authModule = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                window.authModule = authModule;
            }
            
            const { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } = window.authModule;
            const provider = new GoogleAuthProvider();
            
            // 添加範圍和自訂參數
            provider.addScope('email');
            provider.addScope('profile');
            provider.setCustomParameters({
                'hd': '',
                'prompt': 'select_account'
            });
            
            // 檢查是否為手機設備
            const userAgent = navigator.userAgent;
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
            const isIOS = /iPad|iPhone|iPod/.test(userAgent);
            const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
            
            console.log(`設備檢測 - 手機: ${isMobile}, iOS: ${isIOS}, Safari: ${isSafari}, PWA: ${isStandalone}`);
            
            // 手機或 PWA 模式使用重定向
            if (isMobile || isStandalone || isIOS) {
                console.log('使用重定向登入方式');
                this.showNotification('正在導向 Google 登入頁面...', 'info');
                
                // 保存當前狀態（可選）
                sessionStorage.setItem('loginAttempt', Date.now().toString());
                
                // 使用重定向登入
                await signInWithRedirect(window.auth, provider);
                console.log('重定向請求已發送');
                
            } else {
                // 桌面端使用彈出視窗
                console.log('使用彈出視窗登入方式');
                this.showNotification('正在開啟 Google 登入視窗...', 'info');
                
                const result = await signInWithPopup(window.auth, provider);
                if (result && result.user) {
                    console.log('彈出視窗登入成功:', result.user.email);
                    this.showNotification(`登入成功！歡迎 ${result.user.displayName || result.user.email}`, 'success');
                }
            }
            
        } catch (error) {
            console.error('登入失敗詳情:', error);
            
            let errorMessage = '登入失敗';
            
            if (error.code) {
                switch (error.code) {
                    case 'auth/popup-blocked':
                        errorMessage = '彈出視窗被阻擋，請允許彈出視窗或重新整理頁面';
                        break;
                    case 'auth/popup-closed-by-user':
                        errorMessage = '登入流程被取消';
                        break;
                    case 'auth/network-request-failed':
                        errorMessage = '網路連線失敗，請檢查網路連線';
                        break;
                    case 'auth/operation-not-allowed':
                        errorMessage = 'Google 登入未啟用，請聯絡管理員';
                        break;
                    case 'auth/invalid-api-key':
                        errorMessage = 'Firebase 配置錯誤';
                        break;
                    case 'auth/app-not-authorized':
                        errorMessage = '應用程式未授權，請聯絡管理員';
                        break;
                    default:
                        errorMessage = `登入錯誤 (${error.code}): ${error.message}`;
                }
            } else {
                errorMessage = `登入失敗: ${error.message}`;
            }
            
            this.showNotification(errorMessage, 'error');
            
            // 如果是手機設備且重定向失敗，建議重新整理
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isMobile && error.code !== 'auth/popup-closed-by-user') {
                setTimeout(() => {
                    this.showNotification('手機登入失敗時，請嘗試重新整理頁面', 'info');
                }, 3000);
            }
        }
    }

    // 登出
    async logout() {
        try {
            // 確保 Firebase Auth 模組已載入
            if (!window.authModule) {
                const authModule = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                window.authModule = authModule;
            }
            
            const { signOut } = window.authModule;
            await signOut(window.auth);
            this.showNotification('已登出', 'info');
        } catch (error) {
            console.error('登出失敗:', error);
            this.showNotification('登出失敗', 'error');
        }
    }

    // 綁定事件監聽器
    bindEvents() {
        // 登入登出按鈕
        document.getElementById('loginBtn').addEventListener('click', () => {
            this.loginWithGoogle();
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // 新增錢包按鈕
        document.getElementById('addWalletBtn').addEventListener('click', () => {
            this.showAddWalletModal();
        });

        // 新增錢包相關事件
        document.getElementById('saveWalletBtn').addEventListener('click', () => {
            this.saveWallet();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.hideAddWalletModal();
        });

        // 交易相關事件
        document.getElementById('confirmTransactionBtn').addEventListener('click', () => {
            this.processTransaction();
        });

        document.getElementById('cancelTransactionBtn').addEventListener('click', () => {
            this.hideTransactionModal();
        });

        // 編輯錢包相關事件
        document.getElementById('saveEditBtn').addEventListener('click', () => {
            this.saveEditWallet();
        });

        document.getElementById('cancelEditBtn').addEventListener('click', () => {
            this.hideEditWalletModal();
        });

        document.getElementById('deleteWalletBtn').addEventListener('click', () => {
            this.deleteWallet();
        });

        // 關閉按鈕事件
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                modal.style.display = 'none';
            });
        });

        // 點擊背景關閉彈出視窗
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // 按 Enter 鍵確認
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const addModal = document.getElementById('addWalletModal');
                const transactionModal = document.getElementById('transactionModal');
                const editModal = document.getElementById('editWalletModal');
                
                if (addModal.style.display === 'block') {
                    this.saveWallet();
                } else if (transactionModal.style.display === 'block') {
                    this.processTransaction();
                } else if (editModal.style.display === 'block') {
                    this.saveEditWallet();
                }
            }
            
            // ESC 關閉彈出視窗
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.style.display = 'none';
                });
            }
        });
    }

    // 顯示空狀態
    showEmptyState() {
        const container = document.getElementById('walletsContainer');
        container.innerHTML = `
            <div class="empty-state">
                <h3>還沒有錢包</h3>
                <p>點擊上方的「新增錢包」按鈕來建立您的第一個錢包吧！</p>
            </div>
        `;
    }

    // 渲染所有錢包
    renderWallets() {
        const container = document.getElementById('walletsContainer');
        
        if (this.wallets.length === 0) {
            this.showEmptyState();
            return;
        }

        container.innerHTML = '';
        
        this.wallets.forEach(wallet => {
            const walletCard = this.createWalletCard(wallet);
            container.appendChild(walletCard);
        });
    }

    // 創建錢包卡片
    createWalletCard(wallet) {
        const card = document.createElement('div');
        card.className = 'wallet-card';
        card.dataset.walletId = wallet.id;

        const goalHtml = wallet.goal > 0 ? `
            <div class="wallet-goal">
                <div class="goal-progress">${this.formatCurrency(wallet.amount)} / ${this.formatCurrency(wallet.goal)}</div>
                <div class="goal-remaining">
                    ${wallet.amount >= wallet.goal ? 
                        '🎉 目標達成！' : 
                        `還需要 ${this.formatCurrency(wallet.goal - wallet.amount)}`
                    }
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min((wallet.amount / wallet.goal) * 100, 100)}%"></div>
                </div>
            </div>
        ` : '';

        card.innerHTML = `
            <div class="wallet-header">
                <h3 class="wallet-name">${wallet.name}</h3>
                <button class="edit-btn" onclick="firebaseWalletManager.showEditWalletModal('${wallet.id}')">⚙️</button>
            </div>
            <div class="wallet-amount">${this.formatCurrency(wallet.amount)}</div>
            ${goalHtml}
            <div class="wallet-actions">
                <button class="btn btn-success" onclick="firebaseWalletManager.showTransactionModal('${wallet.id}', 'add')">
                    ➕ 存入
                </button>
                <button class="btn btn-danger" onclick="firebaseWalletManager.showTransactionModal('${wallet.id}', 'subtract')">
                    ➖ 提取
                </button>
            </div>
        `;

        return card;
    }

    // 格式化貨幣顯示
    formatCurrency(amount) {
        return `NT$ ${amount.toLocaleString()}`;
    }

    // 顯示新增錢包彈出視窗
    showAddWalletModal() {
        document.getElementById('addWalletModal').style.display = 'block';
        document.getElementById('walletName').focus();
    }

    // 隱藏新增錢包彈出視窗
    hideAddWalletModal() {
        document.getElementById('addWalletModal').style.display = 'none';
        this.clearAddWalletForm();
    }

    // 清空新增錢包表單
    clearAddWalletForm() {
        document.getElementById('walletName').value = '';
        document.getElementById('walletGoal').value = '';
        document.getElementById('initialAmount').value = '';
    }

    // 儲存新錢包到 Firebase
    async saveWallet() {
        const name = document.getElementById('walletName').value.trim();
        const goal = parseFloat(document.getElementById('walletGoal').value) || 0;
        const amount = parseFloat(document.getElementById('initialAmount').value) || 0;

        if (!name) {
            alert('請輸入錢包名稱');
            return;
        }

        if (!this.user) {
            alert('請先登入');
            return;
        }

        if (amount < 0) {
            alert('初始金額不能為負數');
            return;
        }

        if (goal < 0) {
            alert('目標金額不能為負數');
            return;
        }

        try {
            const { collection, addDoc } = window.firestoreModule;
            const walletsRef = collection(window.db, 'users', this.user.uid, 'wallets');
            
            await addDoc(walletsRef, {
                name: name,
                amount: amount,
                goal: goal,
                createdAt: new Date(),
                transactions: []
            });

            this.hideAddWalletModal();
            this.showNotification(`錢包「${name}」創建成功！`, 'success');
        } catch (error) {
            console.error('儲存錢包失敗:', error);
            this.showNotification('儲存失敗，請重試', 'error');
        }
    }

    // 顯示交易彈出視窗
    showTransactionModal(walletId, type) {
        this.currentTransactionWallet = walletId;
        this.transactionType = type;
        
        const wallet = this.wallets.find(w => w.id === walletId);
        const title = type === 'add' ? `存入 - ${wallet.name}` : `提取 - ${wallet.name}`;
        
        document.getElementById('transactionTitle').textContent = title;
        document.getElementById('transactionModal').style.display = 'block';
        document.getElementById('transactionAmount').focus();
    }

    // 隱藏交易彈出視窗
    hideTransactionModal() {
        document.getElementById('transactionModal').style.display = 'none';
        document.getElementById('transactionAmount').value = '';
        document.getElementById('transactionNote').value = '';
        this.currentTransactionWallet = null;
        this.transactionType = null;
    }

    // 處理交易
    async processTransaction() {
        const amount = parseFloat(document.getElementById('transactionAmount').value);
        const note = document.getElementById('transactionNote').value.trim();

        if (!amount || amount <= 0) {
            alert('請輸入有效的金額');
            return;
        }

        if (!this.user) {
            alert('請先登入');
            return;
        }

        const wallet = this.wallets.find(w => w.id === this.currentTransactionWallet);
        if (!wallet) return;

        let newAmount = wallet.amount;
        
        if (this.transactionType === 'add') {
            newAmount += amount;
        } else {
            if (wallet.amount < amount) {
                if (!confirm(`餘額不足，目前餘額為 ${this.formatCurrency(wallet.amount)}，確定要透支嗎？`)) {
                    return;
                }
            }
            newAmount -= amount;
        }

        try {
            const { doc, updateDoc } = window.firestoreModule;
            const walletRef = doc(window.db, 'users', this.user.uid, 'wallets', wallet.id);
            
            const transaction = {
                id: Date.now().toString(),
                type: this.transactionType,
                amount: amount,
                note: note,
                date: new Date(),
                balance: newAmount
            };

            await updateDoc(walletRef, {
                amount: newAmount,
                transactions: [...(wallet.transactions || []), transaction]
            });

            const successMessage = this.transactionType === 'add' 
                ? `成功存入 ${this.formatCurrency(amount)}`
                : `成功提取 ${this.formatCurrency(amount)}`;
            
            this.showNotification(successMessage, 'success');
            this.hideTransactionModal();
        } catch (error) {
            console.error('交易失敗:', error);
            this.showNotification('交易失敗，請重試', 'error');
        }
    }

    // 顯示編輯錢包彈出視窗
    showEditWalletModal(walletId) {
        this.currentEditingWallet = walletId;
        const wallet = this.wallets.find(w => w.id === walletId);
        
        if (!wallet) return;
        
        document.getElementById('editWalletName').value = wallet.name;
        document.getElementById('editWalletGoal').value = wallet.goal || '';
        document.getElementById('editWalletModal').style.display = 'block';
        document.getElementById('editWalletName').focus();
    }

    // 隱藏編輯錢包彈出視窗
    hideEditWalletModal() {
        document.getElementById('editWalletModal').style.display = 'none';
        this.currentEditingWallet = null;
    }

    // 儲存編輯後的錢包
    async saveEditWallet() {
        const name = document.getElementById('editWalletName').value.trim();
        const goal = parseFloat(document.getElementById('editWalletGoal').value) || 0;

        if (!name) {
            alert('請輸入錢包名稱');
            return;
        }

        if (!this.user) {
            alert('請先登入');
            return;
        }

        if (goal < 0) {
            alert('目標金額不能為負數');
            return;
        }

        try {
            const { doc, updateDoc } = window.firestoreModule;
            const walletRef = doc(window.db, 'users', this.user.uid, 'wallets', this.currentEditingWallet);
            
            await updateDoc(walletRef, {
                name: name,
                goal: goal
            });

            this.hideEditWalletModal();
            this.showNotification('錢包資訊更新成功！', 'success');
        } catch (error) {
            console.error('更新錢包失敗:', error);
            this.showNotification('更新失敗，請重試', 'error');
        }
    }

    // 刪除錢包
    async deleteWallet() {
        const wallet = this.wallets.find(w => w.id === this.currentEditingWallet);
        if (!wallet) return;

        if (!this.user) {
            alert('請先登入');
            return;
        }

        const confirmMessage = `確定要刪除錢包「${wallet.name}」嗎？\n目前餘額：${this.formatCurrency(wallet.amount)}\n\n此操作無法復原！`;
        
        if (confirm(confirmMessage)) {
            try {
                const { doc, deleteDoc } = window.firestoreModule;
                const walletRef = doc(window.db, 'users', this.user.uid, 'wallets', wallet.id);
                
                await deleteDoc(walletRef);
                
                this.hideEditWalletModal();
                this.showNotification(`錢包「${wallet.name}」已刪除`, 'info');
            } catch (error) {
                console.error('刪除錢包失敗:', error);
                this.showNotification('刪除失敗，請重試', 'error');
            }
        }
    }

    // 顯示通知訊息
    showNotification(message, type = 'info') {
        // 創建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // 設定通知樣式
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px 25px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '600',
            zIndex: '9999',
            transform: 'translateX(400px)',
            transition: 'transform 0.3s ease',
            maxWidth: '350px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)'
        });

        // 根據類型設定背景色
        const colors = {
            success: 'linear-gradient(45deg, #4CAF50, #45a049)',
            error: 'linear-gradient(45deg, #f44336, #d32f2f)',
            info: 'linear-gradient(45deg, #2196F3, #1976D2)',
            warning: 'linear-gradient(45deg, #FF9800, #F57C00)'
        };
        
        notification.style.background = colors[type] || colors.info;
        
        document.body.appendChild(notification);
        
        // 動畫顯示
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // 自動隱藏
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// 初始化 Firebase 版本的應用程式
let firebaseWalletManager;

document.addEventListener('DOMContentLoaded', () => {
    firebaseWalletManager = new FirebaseWalletManager();
});
