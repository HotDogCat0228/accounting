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
        
        // 檢查是否剛從 Google 登入重定向回來
        this.checkForRedirectLogin();
    }
    
    // 檢查重定向登入結果
    async checkForRedirectLogin() {
        try {
            // 等待 Firebase Auth 模組載入
            if (!window.authModule) {
                const authModule = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                window.authModule = authModule;
            }
            
            const { getRedirectResult } = window.authModule;
            console.log('檢查重定向登入結果...');
            
            const result = await getRedirectResult(window.auth);
            const loginAttempt = sessionStorage.getItem('loginAttempt');
            
            if (result && result.user) {
                // 重定向成功
                console.log('重定向登入成功:', result.user.email);
                this.showNotification(`登入成功！歡迎 ${result.user.displayName || result.user.email}`, 'success');
                
                // 清除登入嘗試標記
                sessionStorage.removeItem('loginAttempt');
                
            } else if (loginAttempt) {
                // 有登入嘗試但沒有結果
                const attemptData = JSON.parse(loginAttempt);
                const timeSinceAttempt = Date.now() - attemptData.timestamp;
                
                console.log(`登入嘗試時間: ${timeSinceAttempt}ms 前`);
                
                if (timeSinceAttempt < 60000) { // 60秒內
                    console.log('最近有登入嘗試但沒有結果，可能被阻擋');
                    
                    // 清除嘗試標記
                    sessionStorage.removeItem('loginAttempt');
                    
                    // 顯示用戶友好的錯誤訊息
                    this.showNotification('登入過程可能被中斷。手機用戶建議：1) 確保允許彈出視窗 2) 重新整理頁面再試', 'warning');
                    
                    // 提供重試建議
                    setTimeout(() => {
                        this.showNotification('如果問題持續，請嘗試使用其他瀏覽器或更新您的瀏覽器', 'info');
                    }, 5000);
                }
            } else {
                console.log('沒有重定向結果');
            }
        } catch (error) {
            console.error('檢查重定向結果時出錯:', error);
            
            // 清除登入狀態
            sessionStorage.removeItem('loginAttempt');
            
            if (error.code === 'auth/network-request-failed') {
                this.showNotification('網路連線問題，請檢查網路後重試', 'error');
            } else if (error.code === 'auth/unauthorized-domain') {
                this.showNotification('網域授權問題，請聯繫管理員', 'error');
            } else if (error.code !== 'auth/no-auth-event') {
                this.showNotification('登入驗證失敗，請重新嘗試', 'error');
                console.error('重定向錯誤詳細信息:', error);
            }
        }
    }

    // 設定驗證狀態監聽器
    async setupAuthListener() {
        try {
            // 載入 Firebase Auth 模組
            if (!window.authModule) {
                const authModule = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                window.authModule = authModule;
            }
            
            const { onAuthStateChanged } = window.authModule;
            
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
        console.log('顯示錢包區域');
        document.getElementById('walletsContainer').style.display = 'grid';
        document.getElementById('addWalletBtn').style.display = 'inline-block';
        
        // 確保事件監聽器正確綁定
        this.ensureEventListeners();
    }

    // 確保事件監聽器已綁定
    ensureEventListeners() {
        console.log('檢查事件監聽器綁定狀態');
        
        // 檢查主要按鈕是否有事件監聽器
        const addWalletBtn = document.getElementById('addWalletBtn');
        if (addWalletBtn && !addWalletBtn.hasAttribute('data-event-bound')) {
            console.log('重新綁定新增錢包按鈕事件');
            addWalletBtn.addEventListener('click', () => {
                console.log('新增錢包按鈕被點擊');
                this.showAddWalletModal();
            });
            addWalletBtn.setAttribute('data-event-bound', 'true');
        }

        // 檢查模態視窗按鈕
        const saveWalletBtn = document.getElementById('saveWalletBtn');
        if (saveWalletBtn && !saveWalletBtn.hasAttribute('data-event-bound')) {
            console.log('重新綁定儲存錢包按鈕事件');
            saveWalletBtn.addEventListener('click', () => {
                console.log('儲存錢包按鈕被點擊');
                this.saveWallet();
            });
            saveWalletBtn.setAttribute('data-event-bound', 'true');
        }

        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn && !cancelBtn.hasAttribute('data-event-bound')) {
            console.log('重新綁定取消按鈕事件');
            cancelBtn.addEventListener('click', () => {
                console.log('取消按鈕被點擊');
                this.hideAddWalletModal();
            });
            cancelBtn.setAttribute('data-event-bound', 'true');
        }

        // 檢查交易模態視窗按鈕
        const confirmTransactionBtn = document.getElementById('confirmTransactionBtn');
        if (confirmTransactionBtn && !confirmTransactionBtn.hasAttribute('data-event-bound')) {
            console.log('重新綁定確認交易按鈕事件');
            confirmTransactionBtn.addEventListener('click', () => {
                console.log('確認交易按鈕被點擊');
                this.processTransaction();
            });
            confirmTransactionBtn.setAttribute('data-event-bound', 'true');
        }

        const cancelTransactionBtn = document.getElementById('cancelTransactionBtn');
        if (cancelTransactionBtn && !cancelTransactionBtn.hasAttribute('data-event-bound')) {
            console.log('重新綁定取消交易按鈕事件');
            cancelTransactionBtn.addEventListener('click', () => {
                console.log('取消交易按鈕被點擊');
                this.hideTransactionModal();
            });
            cancelTransactionBtn.setAttribute('data-event-bound', 'true');
        }

        // 檢查編輯模態視窗按鈕
        const saveEditBtn = document.getElementById('saveEditBtn');
        if (saveEditBtn && !saveEditBtn.hasAttribute('data-event-bound')) {
            console.log('重新綁定儲存編輯按鈕事件');
            saveEditBtn.addEventListener('click', () => {
                console.log('儲存編輯按鈕被點擊');
                this.saveEditedWallet();
            });
            saveEditBtn.setAttribute('data-event-bound', 'true');
        }

        const cancelEditBtn = document.getElementById('cancelEditBtn');
        if (cancelEditBtn && !cancelEditBtn.hasAttribute('data-event-bound')) {
            console.log('重新綁定取消編輯按鈕事件');
            cancelEditBtn.addEventListener('click', () => {
                console.log('取消編輯按鈕被點擊');
                this.hideEditWalletModal();
            });
            cancelEditBtn.setAttribute('data-event-bound', 'true');
        }

        const deleteWalletBtn = document.getElementById('deleteWalletBtn');
        if (deleteWalletBtn && !deleteWalletBtn.hasAttribute('data-event-bound')) {
            console.log('重新綁定刪除錢包按鈕事件');
            deleteWalletBtn.addEventListener('click', () => {
                console.log('刪除錢包按鈕被點擊');
                this.deleteCurrentWallet();
            });
            deleteWalletBtn.setAttribute('data-event-bound', 'true');
        }
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
            
            const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = window.authModule;
            const provider = new GoogleAuthProvider();
            
            // 設定 provider
            provider.addScope('email');
            provider.addScope('profile');
            provider.setCustomParameters({
                'prompt': 'select_account'
            });
            
            // 檢查設備類型
            const userAgent = navigator.userAgent;
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
            const isIOS = /iPad|iPhone|iPod/.test(userAgent);
            const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
            
            console.log(`設備檢測: 手機=${isMobile}, iOS=${isIOS}, Safari=${isSafari}, PWA=${isStandalone}`);
            
            if (isMobile || isStandalone) {
                // 手機或 PWA：智能登入策略
                console.log('手機設備：使用智能登入策略');
                
                try {
                    // 先嘗試彈出視窗 (某些手機瀏覽器支援)
                    console.log('嘗試手機彈出視窗登入...');
                    this.showNotification('正在嘗試最佳登入方式...', 'info');
                    
                    const result = await signInWithPopup(window.auth, provider);
                    if (result && result.user) {
                        console.log('手機彈出視窗登入成功:', result.user.email);
                        this.showNotification(`登入成功！歡迎 ${result.user.displayName || result.user.email}`, 'success');
                        return;
                    }
                    
                } catch (popupError) {
                    console.log('手機彈出視窗失敗，降級為重定向:', popupError.code);
                    
                    // 彈出視窗失敗，使用重定向
                    if (popupError.code === 'auth/popup-blocked' || 
                        popupError.code === 'auth/cancelled-popup-request' ||
                        popupError.code === 'auth/popup-closed-by-user') {
                        
                        console.log('執行降級重定向登入...');
                        this.showNotification('正在跳轉到 Google 登入頁面...', 'info');
                        
                        // 確保這是用戶手勢觸發的
                        if (window.event && window.event.isTrusted) {
                            console.log('用戶手勢確認，執行重定向');
                            
                            // 標記登入嘗試
                            sessionStorage.setItem('loginAttempt', JSON.stringify({
                                timestamp: Date.now(),
                                method: 'redirect_fallback',
                                userAgent: navigator.userAgent
                            }));
                            
                            await signInWithRedirect(window.auth, provider);
                            console.log('重定向已執行');
                            
                        } else {
                            throw new Error('需要真實的用戶點擊才能進行重定向登入');
                        }
                    } else {
                        throw popupError;
                    }
                }
                
            } else {
                // 桌面：優先使用彈出視窗
                console.log('桌面設備：使用彈出視窗登入');
                this.showNotification('正在開啟登入視窗...', 'info');
                
                const result = await signInWithPopup(window.auth, provider);
                if (result && result.user) {
                    console.log('桌面彈出視窗登入成功:', result.user.email);
                    this.showNotification(`登入成功！歡迎 ${result.user.displayName || result.user.email}`, 'success');
                }
            }
            
        } catch (error) {
            console.error('登入失敗:', error);
            
            // 清除登入狀態標記
            sessionStorage.removeItem('loginAttempt');
            
            let errorMessage = '登入失敗';
            
            switch (error.code) {
                case 'auth/popup-blocked':
                    errorMessage = '彈出視窗被阻擋，請允許彈出視窗後重試';
                    break;
                case 'auth/popup-closed-by-user':
                    errorMessage = '登入視窗被關閉';
                    return; // 用戶主動關閉，不顯示錯誤
                case 'auth/cancelled-popup-request':
                    errorMessage = '登入請求被取消，請重試';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = '網路連線失敗，請檢查網路後重試';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'Google 登入未啟用';
                    break;
                case 'auth/unauthorized-domain':
                    errorMessage = '此網域未授權進行 Google 登入';
                    break;
                default:
                    if (error.message.includes('用戶點擊')) {
                        errorMessage = '請直接點擊登入按鈕進行登入';
                    } else {
                        errorMessage = `登入錯誤: ${error.message}`;
                    }
                    console.error('詳細錯誤:', error);
            }
            
            this.showNotification(errorMessage, 'error');
            
            // 對於手機用戶提供額外建議
            if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                setTimeout(() => {
                    this.showNotification('手機登入提示：請確保允許彈出視窗，或嘗試重新整理頁面', 'info');
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
        console.log('渲染錢包列表，錢包數量:', this.wallets.length);
        const container = document.getElementById('walletsContainer');
        
        if (this.wallets.length === 0) {
            console.log('沒有錢包，顯示空狀態');
            this.showEmptyState();
            return;
        }

        container.innerHTML = '';
        
        this.wallets.forEach((wallet, index) => {
            console.log(`渲染錢包 ${index + 1}:`, wallet.name);
            const walletCard = this.createWalletCard(wallet);
            container.appendChild(walletCard);
        });
        
        console.log('錢包渲染完成');
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
        console.log('準備顯示新增錢包彈出視窗');
        const modal = document.getElementById('addWalletModal');
        const walletNameInput = document.getElementById('walletName');
        
        if (!modal) {
            console.error('找不到新增錢包模態視窗元素');
            this.showNotification('介面載入錯誤，請重新整理頁面', 'error');
            return;
        }
        
        if (!walletNameInput) {
            console.error('找不到錢包名稱輸入框');
            this.showNotification('介面載入錯誤，請重新整理頁面', 'error');
            return;
        }
        
        console.log('顯示新增錢包模態視窗');
        modal.style.display = 'block';
        walletNameInput.focus();
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
        console.log(`顯示交易模態視窗 - 錢包ID: ${walletId}, 類型: ${type}`);
        this.currentTransactionWallet = walletId;
        this.transactionType = type;
        
        const wallet = this.wallets.find(w => w.id === walletId);
        if (!wallet) {
            console.error('找不到指定的錢包');
            this.showNotification('錢包不存在，請重新整理頁面', 'error');
            return;
        }
        
        const title = type === 'add' ? `存入 - ${wallet.name}` : `提取 - ${wallet.name}`;
        
        const modal = document.getElementById('transactionModal');
        const titleElement = document.getElementById('transactionTitle');
        const amountInput = document.getElementById('transactionAmount');
        
        if (!modal || !titleElement || !amountInput) {
            console.error('交易模態視窗元素缺失');
            this.showNotification('介面載入錯誤，請重新整理頁面', 'error');
            return;
        }
        
        console.log('顯示交易模態視窗');
        titleElement.textContent = title;
        modal.style.display = 'block';
        amountInput.focus();
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
    
    // 檢測設備類型並顯示對應提示
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const mobileHint = document.getElementById('mobileHint');
    const desktopHint = document.getElementById('desktopHint');
    
    if (isMobile) {
        mobileHint.style.display = 'block';
        desktopHint.style.display = 'none';
    } else {
        mobileHint.style.display = 'none';
        desktopHint.style.display = 'block';
    }
    
    // 為登入按鈕添加用戶手勢追蹤
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', (event) => {
            // 標記這是真實的用戶點擊
            window.event = event;
            console.log('用戶手勢檢測:', event.isTrusted ? '真實點擊' : '程式觸發');
            
            if (!event.isTrusted && isMobile) {
                firebaseWalletManager.showNotification('請直接點擊登入按鈕', 'warning');
                return false;
            }
        });
    }
});
