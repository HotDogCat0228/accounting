// Firebase 版本的錢包管理器
class FirebaseWalletManager {
    constructor() {
        this.user = null;
        this.wallets = [];
        this.currentEditingWallet = null;
        this.currentTransactionWallet = null;
        this.currentViewingWallet = null;
        this.currentEditingTransaction = null;
        this.transactionType = null;
        this.unsubscribe = null;
        this.isOfflineMode = false;
        
        // 檢測 iPhone PWA 並提供早期提示
        const isIPhone = /iPhone|iPod/i.test(navigator.userAgent);
        const isPWA = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
        
        if (isIPhone && isPWA) {
            console.log('檢測到 iPhone PWA 模式，將優化體驗');
            this.isIPhonePWA = true;
            
            // 設置標記，在 DOM 準備好後自動啟用離線模式
            this.autoEnableOffline = true;
        } else {
            this.isIPhonePWA = false;
            this.autoEnableOffline = false;
        }
        
        // 等待 Firebase 初始化完成
        this.waitForFirebase().then(() => {
            this.init();
        }).catch(() => {
            // Firebase 初始化失敗，啟用離線模式
            console.warn('Firebase 初始化失敗，自動切換到離線模式');
            this.enableOfflineMode();
        });
    }

    // 等待 Firebase 載入完成
    async waitForFirebase() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 100; // 10秒
            
            const checkFirebase = () => {
                console.log(`Firebase檢查嘗試 ${attempts + 1}/${maxAttempts}`);
                
                if (window.db && window.auth) {
                    console.log('Firebase初始化成功');
                    
                    // 測試Firebase連接
                    this.testFirebaseConnection()
                        .then(() => {
                            console.log('Firebase連接測試成功');
                            resolve();
                        })
                        .catch((error) => {
                            console.error('Firebase連接測試失敗:', error);
                            // 即使連接測試失敗，也繼續初始化，讓用戶可以嘗試登入
                            resolve();
                        });
                } else if (attempts >= maxAttempts) {
                    console.error('Firebase載入超時');
                    reject(new Error('Firebase 載入超時'));
                } else {
                    attempts++;
                    setTimeout(checkFirebase, 100);
                }
            };
            
            checkFirebase();
        });
    }
    
    // 測試Firebase連接
    async testFirebaseConnection() {
        try {
            // 嘗試獲取當前認證狀態
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Firebase連接超時'));
                }, 5000);
                
                const unsubscribe = window.auth.onAuthStateChanged((user) => {
                    clearTimeout(timeout);
                    unsubscribe();
                    resolve(user);
                });
            });
        } catch (error) {
            throw new Error('Firebase服務無法訪問: ' + error.message);
        }
    }

    // 初始化應用程式
    init() {
        this.bindEvents();
        this.setupAuthListener();
        
        // 隱藏錢包容器直到用戶登入
        document.getElementById('walletsContainer').style.display = 'none';
        document.getElementById('addWalletBtn').style.display = 'none';
        
        // 檢測手機端並優化體驗
        this.optimizeForMobile();
        
        // iPhone PWA 自動離線模式
        if (this.autoEnableOffline) {
            setTimeout(() => {
                if (!this.user && !this.isOfflineMode) {
                    console.log('iPhone PWA 自動啟用離線模式');
                    this.showNotification('iPhone PWA：自動啟用離線模式！', 'success');
                    this.enableOfflineMode();
                }
            }, 1000);
        }
    }
    
    // 手機端優化
    optimizeForMobile() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            // 為手機端添加特殊樣式類
            document.body.classList.add('mobile-device');
            
            // 3秒後如果還沒登入，提示使用離線模式
            setTimeout(() => {
                if (!this.user && !this.isOfflineMode) {
                    const offlineBtn = document.getElementById('offlineBtn');
                    offlineBtn.style.animation = 'pulse 2s infinite';
                    
                    // 添加脈衝動畫
                    const style = document.createElement('style');
                    style.textContent = `
                        @keyframes pulse {
                            0% { transform: scale(1); }
                            50% { transform: scale(1.05); }
                            100% { transform: scale(1); }
                        }
                    `;
                    document.head.appendChild(style);
                    
                    this.showNotification('手機端建議使用離線模式獲得最佳體驗', 'info');
                }
            }, 3000);
        }
    }

    // 設定驗證狀態監聽器
    setupAuthListener() {
        console.log('設定Firebase Auth監聽器...');
        
        // 使用動態導入來載入 Firebase Auth 模組
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js')
            .then(({ onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut }) => {
                console.log('Firebase Auth模組載入成功');
                
                window.authModule = { 
                    onAuthStateChanged, 
                    GoogleAuthProvider, 
                    signInWithPopup, 
                    signInWithRedirect, 
                    getRedirectResult, 
                    signOut 
                };
                
                // 先檢查重定向結果 (用於手機端)
                getRedirectResult(window.auth).then((result) => {
                    if (result && result.user) {
                        console.log('重定向登入成功:', result.user.displayName);
                        this.showNotification('登入成功！', 'success');
                    }
                }).catch((error) => {
                    if (error.code && error.code !== 'auth/no-redirect-operation') {
                        console.error('重定向登入失敗:', error);
                        // 不自動切換到離線模式，讓用戶選擇
                    }
                });
                
                // 設定認證狀態監聽器
                onAuthStateChanged(window.auth, (user) => {
                    console.log('認證狀態變更:', user ? '已登入' : '未登入');
                    this.handleAuthStateChange(user);
                });
                
                console.log('Firebase Auth設定完成');
            })
            .catch((error) => {
                console.error('Firebase Auth 模組載入失敗:', error);
                this.showNotification('Firebase載入失敗，建議使用離線模式', 'warning');
                
                // 延遲5秒後提示，給用戶時間看到錯誤信息
                setTimeout(() => {
                    if (!this.user && !this.isOfflineMode) {
                        const useOffline = confirm('Firebase服務無法連接，是否使用離線模式？\n\n離線模式提供完整的記帳功能，資料儲存在您的設備上。');
                        if (useOffline) {
                            this.enableOfflineMode();
                        }
                    }
                }, 5000);
            });
    }

    // 處理驗證狀態變更
    handleAuthStateChange(user) {
        this.user = user;
        
        if (user) {
            // 用戶已登入
            this.showUserSection(user);
            this.hideLoginSection();
            this.hideOfflineSection();
            this.showWalletSection();
            this.setupFirestoreListener();
        } else {
            // 用戶已登出
            if (!this.isOfflineMode) {
                this.showLoginSection();
            }
            this.hideUserSection();
            this.hideOfflineSection();
            
            if (!this.isOfflineMode) {
                this.hideWalletSection();
                this.clearFirestoreListener();
                this.wallets = [];
            }
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

    // 顯示離線區域
    showOfflineSection() {
        console.log('顯示離線區域');
        const offlineSection = document.getElementById('offlineSection');
        if (offlineSection) {
            offlineSection.style.display = 'flex';
            console.log('離線區域已設置為顯示');
        } else {
            console.error('找不到離線區域元素');
        }
    }

    // 隱藏離線區域
    hideOfflineSection() {
        document.getElementById('offlineSection').style.display = 'none';
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
            console.log('開始Google登入流程...');
            
            // 檢查Firebase是否正確初始化
            if (!window.auth) {
                throw new Error('Firebase Auth 尚未初始化');
            }
            
            if (!window.authModule) {
                throw new Error('Firebase Auth 模組尚未載入');
            }
            
            // 檢查是否為移動設備和PWA
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent);
            const isPWA = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
            const isSafari = /Safari/i.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);
            
            console.log(`設備環境: 手機=${isMobile}, iOS=${isIOS}, PWA=${isPWA}, Safari=${isSafari}`);
            
            const { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } = window.authModule;
            const provider = new GoogleAuthProvider();
            
            // 設定OAuth範圍
            provider.addScope('profile');
            provider.addScope('email');
            
            // iPhone PWA 有特殊限制，需要特別處理
            if (isIOS && isPWA) {
                console.log('檢測到 iPhone PWA 模式');
                this.showNotification('iPhone PWA 模式：登入功能受限，建議使用離線模式', 'warning');
                
                // 提供用戶選擇
                setTimeout(() => {
                    if (confirm('iPhone PWA 模式下 Google 登入可能無法正常工作。\n\n建議使用離線模式，離線模式提供完整功能且資料安全。\n\n是否改用離線模式？')) {
                        this.enableOfflineMode();
                        return;
                    }
                }, 1000);
                
                // 如果用戶堅持要嘗試登入，使用特殊處理
                try {
                    console.log('iPhone PWA 嘗試登入...');
                    const result = await signInWithPopup(window.auth, provider);
                    console.log('意外成功!', result.user.displayName);
                    this.showNotification('登入成功！', 'success');
                } catch (pwaError) {
                    console.error('iPhone PWA 登入失敗:', pwaError);
                    throw new Error('iPhone PWA 登入限制: ' + pwaError.message);
                }
            } else if (isMobile || isIOS) {
                console.log('使用重定向登入...');
                // 手機端使用重定向
                await signInWithRedirect(window.auth, provider);
                // 重定向後會自動處理，不需要等待結果
            } else {
                console.log('使用彈出視窗登入...');
                // 桌面端使用彈出視窗
                const result = await signInWithPopup(window.auth, provider);
                console.log('登入成功:', result.user.displayName);
                this.showNotification('登入成功！', 'success');
            }
        } catch (error) {
            console.error('登入錯誤詳細信息:', error);
            
            let errorMessage = '登入失敗：';
            let shouldOfferOffline = false;
            
            // 根據錯誤類型提供具體的錯誤信息
            switch (error.code) {
                case 'auth/popup-blocked':
                    errorMessage += 'iPhone Safari/PWA 阻擋了彈出視窗';
                    shouldOfferOffline = true;
                    break;
                case 'auth/popup-closed-by-user':
                    errorMessage += '登入視窗被關閉';
                    shouldOfferOffline = true;
                    break;
                case 'auth/unauthorized-domain':
                    errorMessage += 'GitHub Pages 域名未在 Firebase 中授權';
                    shouldOfferOffline = true;
                    break;
                case 'auth/network-request-failed':
                    errorMessage += '網路連線問題';
                    shouldOfferOffline = true;
                    break;
                case 'auth/too-many-requests':
                    errorMessage += '嘗試次數過多，請稍後再試';
                    break;
                default:
                    if (error.message.includes('iPhone PWA 登入限制')) {
                        errorMessage += 'iPhone PWA 模式限制，建議使用離線模式';
                        shouldOfferOffline = true;
                    } else if (error.message.includes('Firebase Auth')) {
                        errorMessage += 'Firebase服務問題';
                        shouldOfferOffline = true;
                    } else {
                        errorMessage += error.message || '未知錯誤';
                        shouldOfferOffline = true;
                    }
            }
            
            this.showNotification(errorMessage, 'error');
            
            // 顯示診斷按鈕供用戶檢查連線問題
            document.getElementById('diagnosBtn').style.display = 'inline-block';
            
            // 如果適合，自動提供離線模式選項
            if (shouldOfferOffline) {
                setTimeout(() => {
                    if (confirm(errorMessage + '\n\n是否改用離線模式？離線模式提供完整功能。')) {
                        this.enableOfflineMode();
                    }
                }, 2000);
            }
        }
    }

    // 登出
    async logout() {
        try {
            const { signOut } = window.authModule;
            await signOut(window.auth);
            this.showNotification('已登出', 'info');
        } catch (error) {
            console.error('登出失敗:', error);
            this.showNotification('登出失敗', 'error');
        }
    }

    // 啟用離線模式
    enableOfflineMode() {
        console.log('開始啟用離線模式');
        this.isOfflineMode = true;
        
        // 隱藏登入區域和用戶區域
        console.log('隱藏登入和用戶區域');
        this.hideLoginSection();
        this.hideUserSection();
        
        // 顯示離線狀態區域
        console.log('顯示離線狀態區域');
        this.showOfflineSection();
        
        // 顯示錢包區域
        console.log('顯示錢包區域');
        this.showWalletSection();
        
        // 從本地儲存載入錢包資料
        this.wallets = this.loadWalletsFromLocal();
        this.renderWallets();
        
        // 顯示離線模式通知
        this.showNotification('已切換到離線模式', 'info');
        
        console.log('離線模式啟用完成');
    }
    
    // 刷新離線模式
    refreshOfflineMode() {
        // 重新載入錢包資料
        this.wallets = this.loadWalletsFromLocal();
        this.renderWallets();
        
        // 提供選項讓用戶選擇是否嘗試重新連線
        const choice = confirm('離線模式刷新完成！\n\n是否要嘗試重新連接線上模式？\n\n注意：如果連接失敗，將繼續使用離線模式。');
        
        if (choice) {
            this.showNotification('嘗試重新連接...', 'info');
            
            // 重置狀態
            this.isOfflineMode = false;
            
            // 隱藏離線區域
            document.getElementById('offlineSection').style.display = 'none';
            
            // 顯示登入區域
            document.getElementById('loginSection').style.display = 'block';
            
            // 嘗試重新初始化 Firebase
            this.waitForFirebase().then(() => {
                this.init();
                this.showNotification('已重新初始化，可嘗試登入', 'success');
            }).catch(error => {
                console.error('重新連接失敗:', error);
                this.showNotification('連接失敗，返回離線模式', 'warning');
                this.enableOfflineMode();
            });
        } else {
            this.showNotification('離線資料已刷新', 'success');
        }
    }
    
    // 顯示診斷信息
    showDiagnostics() {
        const diagnostics = [];
        
        // 檢查Firebase狀態
        diagnostics.push('=== Firebase 診斷報告 ===');
        diagnostics.push(`Firebase App: ${window.firebaseApp ? '✅ 已載入' : '❌ 未載入'}`);
        diagnostics.push(`Firebase Auth: ${window.auth ? '✅ 已載入' : '❌ 未載入'}`);
        diagnostics.push(`Firebase DB: ${window.db ? '✅ 已載入' : '❌ 未載入'}`);
        diagnostics.push(`Auth Module: ${window.authModule ? '✅ 已載入' : '❌ 未載入'}`);
        
        // 檢查網路狀態
        diagnostics.push('');
        diagnostics.push('=== 網路狀態 ===');
        diagnostics.push(`線上狀態: ${navigator.onLine ? '✅ 在線' : '❌ 離線'}`);
        diagnostics.push(`用戶代理: ${navigator.userAgent.slice(0, 50)}...`);
        
        // 檢查設備類型
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isIPhone = /iPhone|iPod/i.test(navigator.userAgent);
        const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent);
        const isPWA = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
        
        diagnostics.push(`設備類型: ${isMobile ? '📱 手機' : '💻 桌面'}`);
        diagnostics.push(`iOS 設備: ${isIOS ? '✅ 是' : '❌ 否'}`);
        diagnostics.push(`iPhone: ${isIPhone ? '✅ 是' : '❌ 否'}`);
        diagnostics.push(`PWA 模式: ${isPWA ? '✅ 是' : '❌ 否'}`);
        diagnostics.push(`Safari 版本: ${navigator.userAgent.match(/Version\/([0-9._]+)/)?.[1] || '未知'}`);
        
        // 檢查當前域名
        diagnostics.push('');
        diagnostics.push('=== 域名信息 ===');
        diagnostics.push(`當前域名: ${window.location.hostname}`);
        diagnostics.push(`完整URL: ${window.location.href}`);
        diagnostics.push(`協議: ${window.location.protocol}`);
        diagnostics.push(`端口: ${window.location.port || '默認端口'}`);
        
        // 檢查localStorage
        diagnostics.push('');
        diagnostics.push('=== 存儲狀態 ===');
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            diagnostics.push('LocalStorage: ✅ 可用');
        } catch (e) {
            diagnostics.push('LocalStorage: ❌ 不可用');
        }
        
        // 顯示離線錢包數量
        const offlineWallets = this.loadWalletsFromLocal();
        diagnostics.push(`離線錢包數量: ${offlineWallets.length}`);
        
        // iPhone PWA 特殊說明
        if (isIPhone && isPWA) {
            diagnostics.push('');
            diagnostics.push('=== iPhone PWA 特別說明 ===');
            diagnostics.push('⚠️  iPhone PWA 模式限制:');
            diagnostics.push('• Safari PWA 模式限制第三方登入');
            diagnostics.push('• Google OAuth 彈出視窗被阻擋');
            diagnostics.push('• 建議使用離線模式獲得完整體驗');
            diagnostics.push('• 離線模式資料安全且功能完整');
        }
        
        // 顯示結果
        const message = diagnostics.join('\n');
        console.log(message);
        
        // 創建診斷結果彈出視窗
        const diagModal = document.createElement('div');
        diagModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;
        
        diagModal.innerHTML = `
            <div style="
                background: white;
                padding: 20px;
                border-radius: 10px;
                max-width: 500px;
                max-height: 80vh;
                overflow-y: auto;
                font-family: monospace;
                font-size: 12px;
                line-height: 1.4;
            ">
                <h3 style="margin-top: 0;">Firebase 連接診斷</h3>
                <pre style="white-space: pre-wrap; margin: 10px 0;">${message}</pre>
                <div style="text-align: center; margin-top: 20px;">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                            style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        關閉
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(diagModal);
        
        // 點擊背景關閉
        diagModal.addEventListener('click', (e) => {
            if (e.target === diagModal) {
                diagModal.remove();
            }
        });
    }

    // 從本地儲存載入錢包
    loadWalletsFromLocal() {
        const saved = localStorage.getItem('wallets');
        const wallets = saved ? JSON.parse(saved) : [];
        
        // 遷移舊數據：為沒有ID的交易添加ID
        wallets.forEach(wallet => {
            if (wallet.transactions) {
                wallet.transactions.forEach(transaction => {
                    if (!transaction.id) {
                        transaction.id = this.generateId();
                    }
                });
            }
        });
        
        return wallets;
    }

    // 儲存錢包到本地儲存
    saveWalletsToLocal() {
        localStorage.setItem('wallets', JSON.stringify(this.wallets));
    }

    // 生成唯一ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // 綁定事件監聽器
    bindEvents() {
        // 登入登出按鈕
        document.getElementById('loginBtn').addEventListener('click', () => {
            this.loginWithGoogle();
        });
        
        // 離線模式按鈕
        document.getElementById('offlineBtn').addEventListener('click', () => {
            this.enableOfflineMode();
        });
        
        // 添加觸控支援
        document.getElementById('loginBtn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.loginWithGoogle();
        });
        
        document.getElementById('offlineBtn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.enableOfflineMode();
        });
        
        // 診斷按鈕
        document.getElementById('diagnosBtn').addEventListener('click', () => {
            this.showDiagnostics();
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });
        
        document.getElementById('logoutBtn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.logout();
        });

        // 新增錢包按鈕
        document.getElementById('addWalletBtn').addEventListener('click', () => {
            this.showAddWalletModal();
        });
        
        document.getElementById('addWalletBtn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.showAddWalletModal();
        });

        // 新增錢包相關事件
        document.getElementById('saveWalletBtn').addEventListener('click', () => {
            this.saveWallet();
        });
        
        document.getElementById('saveWalletBtn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.saveWallet();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.hideAddWalletModal();
        });
        
        document.getElementById('cancelBtn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.hideAddWalletModal();
        });

        // 交易相關事件
        document.getElementById('confirmTransactionBtn').addEventListener('click', () => {
            this.processTransaction();
        });
        
        document.getElementById('confirmTransactionBtn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.processTransaction();
        });

        document.getElementById('cancelTransactionBtn').addEventListener('click', () => {
            this.hideTransactionModal();
        });
        
        document.getElementById('cancelTransactionBtn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.hideTransactionModal();
        });

        // 編輯錢包相關事件
        document.getElementById('saveEditBtn').addEventListener('click', () => {
            this.saveEditWallet();
        });
        
        document.getElementById('saveEditBtn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.saveEditWallet();
        });

        document.getElementById('cancelEditBtn').addEventListener('click', () => {
            this.hideEditWalletModal();
        });
        
        document.getElementById('cancelEditBtn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.hideEditWalletModal();
        });

        document.getElementById('deleteWalletBtn').addEventListener('click', () => {
            this.deleteWallet();
        });
        
        document.getElementById('deleteWalletBtn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.deleteWallet();
        });

        // 編輯交易相關事件
        document.getElementById('saveEditTransactionBtn').addEventListener('click', () => {
            this.saveEditTransaction();
        });

        document.getElementById('cancelEditTransactionBtn').addEventListener('click', () => {
            this.hideEditTransactionModal();
        });

        // 事件委託處理交易編輯和刪除按鈕
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-transaction')) {
                const transactionId = e.target.getAttribute('data-transaction-id');
                this.editTransaction(transactionId);
            } else if (e.target.classList.contains('delete-transaction')) {
                const transactionId = e.target.getAttribute('data-transaction-id');
                this.deleteTransaction(transactionId);
            }
        });

        // 交易紀錄相關事件
        document.getElementById('closeHistoryBtn').addEventListener('click', () => {
            this.hideTransactionHistory();
        });
        
        document.getElementById('closeHistoryBtn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.hideTransactionHistory();
        });

        document.getElementById('exportTransactions').addEventListener('click', () => {
            this.exportTransactionHistory();
        });

        // 交易紀錄篩選器
        document.getElementById('filterAll').addEventListener('click', () => {
            this.filterTransactions('all');
        });

        document.getElementById('filterDeposits').addEventListener('click', () => {
            this.filterTransactions('add');
        });

        document.getElementById('filterWithdrawals').addEventListener('click', () => {
            this.filterTransactions('subtract');
        });

        // 關閉按鈕事件
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                modal.style.display = 'none';
            });
            
            // 添加觸控支援
            closeBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
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
            
            // 添加觸控支援
            modal.addEventListener('touchend', (e) => {
                if (e.target === modal) {
                    e.preventDefault();
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
                const editTransactionModal = document.getElementById('editTransactionModal');
                
                if (addModal.style.display === 'block') {
                    this.saveWallet();
                } else if (transactionModal.style.display === 'block') {
                    this.processTransaction();
                } else if (editModal.style.display === 'block') {
                    this.saveEditWallet();
                } else if (editTransactionModal.style.display === 'block') {
                    this.saveEditTransaction();
                }
            }
            
            // ESC 關閉彈出視窗
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(modal => {
                    if (modal.style.display === 'block') {
                        modal.style.display = 'none';
                        
                        // 清理狀態
                        if (modal.id === 'editTransactionModal') {
                            this.currentEditingTransaction = null;
                        }
                    }
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
                <button class="edit-btn" data-wallet-id="${wallet.id}" data-action="edit">⚙️</button>
            </div>
            <div class="wallet-amount">${this.formatCurrency(wallet.amount)}</div>
            ${goalHtml}
            <div class="wallet-actions-extended">
                <button class="btn btn-success" data-wallet-id="${wallet.id}" data-action="add">
                    ➕ 存入
                </button>
                <button class="btn btn-danger" data-wallet-id="${wallet.id}" data-action="subtract">
                    ➖ 提取
                </button>
                <button class="btn btn-info" data-wallet-id="${wallet.id}" data-action="history">
                    📊 紀錄
                </button>
            </div>
        `;
        
        // 添加事件監聽器
        this.addWalletCardEvents(card, wallet.id);

        return card;
    }
    
    // 添加錢包卡片事件
    addWalletCardEvents(card, walletId) {
        const editBtn = card.querySelector('.edit-btn');
        const addBtn = card.querySelector('[data-action="add"]');
        const subtractBtn = card.querySelector('[data-action="subtract"]');
        const historyBtn = card.querySelector('[data-action="history"]');
        
        // 編輯按鈕
        const handleEdit = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showEditWalletModal(walletId);
        };
        editBtn.addEventListener('click', handleEdit);
        editBtn.addEventListener('touchend', handleEdit);
        
        // 存入按鈕
        const handleAdd = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showTransactionModal(walletId, 'add');
        };
        addBtn.addEventListener('click', handleAdd);
        addBtn.addEventListener('touchend', handleAdd);
        
        // 提取按鈕
        const handleSubtract = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showTransactionModal(walletId, 'subtract');
        };
        subtractBtn.addEventListener('click', handleSubtract);
        subtractBtn.addEventListener('touchend', handleSubtract);
        
        // 記錄按鈕
        const handleHistory = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showTransactionHistory(walletId);
        };
        historyBtn.addEventListener('click', handleHistory);
        historyBtn.addEventListener('touchend', handleHistory);
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

        if (!this.user && !this.isOfflineMode) {
            alert('請先登入或使用離線模式');
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
            if (this.isOfflineMode) {
                // 離線模式：儲存到本地
                const newWallet = {
                    id: this.generateId(),
                    name: name,
                    amount: amount,
                    initialAmount: amount,
                    goal: goal,
                    createdAt: new Date().toISOString(),
                    transactions: []
                };
                
                this.wallets.unshift(newWallet);
                this.saveWalletsToLocal();
                this.renderWallets();
            } else {
                // 線上模式：儲存到Firebase
                const { collection, addDoc } = window.firestoreModule;
                const walletsRef = collection(window.db, 'users', this.user.uid, 'wallets');
                
                await addDoc(walletsRef, {
                    name: name,
                    amount: amount,
                    initialAmount: amount,
                    goal: goal,
                    createdAt: new Date(),
                    transactions: []
                });
            }

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

        if (!this.user && !this.isOfflineMode) {
            alert('請先登入或使用離線模式');
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
            const transaction = {
                id: this.generateId(),
                type: this.transactionType,
                amount: amount,
                note: note,
                date: new Date().toISOString(),
                balance: newAmount
            };

            if (this.isOfflineMode) {
                // 離線模式：更新本地資料
                wallet.amount = newAmount;
                if (!wallet.transactions) {
                    wallet.transactions = [];
                }
                wallet.transactions.push(transaction);
                this.saveWalletsToLocal();
                this.renderWallets();
            } else {
                // 線上模式：更新Firebase
                const { doc, updateDoc } = window.firestoreModule;
                const walletRef = doc(window.db, 'users', this.user.uid, 'wallets', wallet.id);
                
                await updateDoc(walletRef, {
                    amount: newAmount,
                    transactions: [...(wallet.transactions || []), transaction]
                });
            }

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

    // 顯示交易紀錄
    showTransactionHistory(walletId) {
        this.currentViewingWallet = walletId;
        const wallet = this.wallets.find(w => w.id === walletId);
        
        if (!wallet) return;
        
        document.getElementById('historyTitle').textContent = `${wallet.name} - 交易紀錄`;
        
        // 計算統計資訊
        const transactions = wallet.transactions || [];
        let totalDeposits = 0;
        let totalWithdrawals = 0;
        
        transactions.forEach(transaction => {
            if (transaction.type === 'add') {
                totalDeposits += transaction.amount;
            } else {
                totalWithdrawals += transaction.amount;
            }
        });
        
        document.getElementById('totalDeposits').textContent = this.formatCurrency(totalDeposits);
        document.getElementById('totalWithdrawals').textContent = this.formatCurrency(totalWithdrawals);
        document.getElementById('totalTransactions').textContent = `${transactions.length} 筆`;
        
        // 顯示交易列表
        this.renderTransactionList(transactions);
        
        // 重設篩選器
        this.setActiveFilter('filterAll');
        
        document.getElementById('transactionHistoryModal').style.display = 'block';
    }

    // 隱藏交易紀錄
    hideTransactionHistory() {
        document.getElementById('transactionHistoryModal').style.display = 'none';
        this.currentViewingWallet = null;
    }

    // 渲染交易列表
    renderTransactionList(transactions) {
        const container = document.getElementById('transactionList');
        
        if (!transactions || transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-transactions">
                    <h4>還沒有交易紀錄</h4>
                    <p>開始使用存入或提取功能來記錄您的交易吧！</p>
                </div>
            `;
            return;
        }
        
        // 按日期排序（最新的在前面）
        const sortedTransactions = transactions.sort((a, b) => {
            const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
            const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
            return dateB - dateA;
        });
        
        container.innerHTML = '';
        
        sortedTransactions.forEach(transaction => {
            const item = this.createTransactionItem(transaction);
            container.appendChild(item);
        });
    }

    // 創建交易項目
    createTransactionItem(transaction) {
        const item = document.createElement('div');
        item.className = `transaction-item ${transaction.type === 'add' ? 'deposit' : 'withdrawal'}`;
        item.dataset.type = transaction.type;
        item.dataset.transactionId = transaction.id;
        
        // 處理 Firebase Timestamp 或普通 Date
        const date = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
        const formattedDate = date.toLocaleString('zh-TW');
        
        const typeText = transaction.type === 'add' ? '存入' : '提取';
        const amountClass = transaction.type === 'add' ? 'positive' : 'negative';
        const amountPrefix = transaction.type === 'add' ? '+' : '-';
        
        item.innerHTML = `
            <div class="transaction-info">
                <div class="transaction-type ${transaction.type === 'add' ? 'deposit' : 'withdrawal'}">
                    ${typeText}
                </div>
                ${transaction.note ? `<div class="transaction-note">${transaction.note}</div>` : ''}
                <div class="transaction-date">${formattedDate}</div>
            </div>
            <div class="transaction-amount-info">
                <div class="transaction-amount ${amountClass}">
                    ${amountPrefix}${this.formatCurrency(transaction.amount)}
                </div>
                <div class="transaction-balance">
                    餘額: ${this.formatCurrency(transaction.balance)}
                </div>
            </div>
            <div class="transaction-actions">
                <button class="btn-icon edit-transaction" data-transaction-id="${transaction.id}" title="編輯">
                    ✏️
                </button>
                <button class="btn-icon delete-transaction" data-transaction-id="${transaction.id}" title="刪除">
                    🗑️
                </button>
            </div>
        `;
        
        return item;
    }

    // 篩選交易紀錄
    filterTransactions(type) {
        const wallet = this.wallets.find(w => w.id === this.currentViewingWallet);
        if (!wallet) return;
        
        const transactions = wallet.transactions || [];
        let filteredTransactions;
        
        if (type === 'all') {
            filteredTransactions = transactions;
        } else {
            filteredTransactions = transactions.filter(t => t.type === type);
        }
        
        this.renderTransactionList(filteredTransactions);
        this.setActiveFilter(`filter${type === 'all' ? 'All' : type === 'add' ? 'Deposits' : 'Withdrawals'}`);
    }

    // 設定啟用的篩選器
    setActiveFilter(activeId) {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(activeId).classList.add('active');
    }

    // 匯出交易紀錄
    exportTransactionHistory() {
        const wallet = this.wallets.find(w => w.id === this.currentViewingWallet);
        if (!wallet || !wallet.transactions) return;
        
        const transactions = wallet.transactions.sort((a, b) => {
            const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
            const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
            return dateB - dateA;
        });
        
        // 創建 CSV 格式的數據
        const headers = ['日期', '類型', '金額', '備註', '餘額'];
        const csvContent = [
            headers.join(','),
            ...transactions.map(t => {
                const date = t.date?.toDate ? t.date.toDate() : new Date(t.date);
                return [
                    date.toLocaleString('zh-TW'),
                    t.type === 'add' ? '存入' : '提取',
                    t.amount,
                    t.note || '',
                    t.balance
                ].map(field => `"${field}"`).join(',');
            })
        ].join('\n');
        
        // 下載檔案
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${wallet.name}-交易紀錄-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('交易紀錄已匯出！', 'success');
    }

    // 編輯交易
    editTransaction(transactionId) {
        const wallet = this.wallets.find(w => w.id === this.currentViewingWallet);
        if (!wallet) return;
        
        const transaction = wallet.transactions.find(t => t.id === transactionId);
        if (!transaction) return;
        
        // 將交易資料填入編輯表單
        document.getElementById('editTransactionType').value = transaction.type;
        document.getElementById('editTransactionAmount').value = transaction.amount;
        document.getElementById('editTransactionNote').value = transaction.note || '';
        
        // 格式化日期時間用於 datetime-local 輸入
        const date = new Date(transaction.date);
        const formattedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
            .toISOString().slice(0, -1);
        document.getElementById('editTransactionDate').value = formattedDate;
        
        // 記錄正在編輯的交易ID
        this.currentEditingTransaction = transactionId;
        
        // 顯示編輯彈出視窗
        document.getElementById('editTransactionModal').style.display = 'block';
    }

    // 儲存編輯後的交易
    async saveEditTransaction() {
        const type = document.getElementById('editTransactionType').value;
        const amount = parseFloat(document.getElementById('editTransactionAmount').value);
        const note = document.getElementById('editTransactionNote').value.trim();
        const dateStr = document.getElementById('editTransactionDate').value;
        
        if (!amount || amount <= 0) {
            this.showNotification('請輸入有效的金額', 'error');
            return;
        }
        
        if (!dateStr) {
            this.showNotification('請選擇日期', 'error');
            return;
        }
        
        const wallet = this.wallets.find(w => w.id === this.currentViewingWallet);
        if (!wallet) return;
        
        const transactionIndex = wallet.transactions.findIndex(t => t.id === this.currentEditingTransaction);
        if (transactionIndex === -1) return;
        
        const oldTransaction = wallet.transactions[transactionIndex];
        const newDate = new Date(dateStr);
        
        // 更新交易資料
        wallet.transactions[transactionIndex] = {
            ...oldTransaction,
            type: type,
            amount: amount,
            note: note,
            date: newDate.toISOString()
        };
        
        // 重新計算所有交易的餘額
        this.recalculateBalances(wallet);
        
        try {
            if (this.isOfflineMode) {
                // 離線模式：儲存到本地
                this.saveWalletsToLocal();
                this.renderWallets();
            } else {
                // 線上模式：更新Firebase
                const { doc, updateDoc } = window.firestoreModule;
                const walletRef = doc(window.db, 'users', this.user.uid, 'wallets', wallet.id);
                
                await updateDoc(walletRef, {
                    amount: wallet.amount,
                    transactions: wallet.transactions
                });
            }
            
            // 更新交易歷史顯示
            this.showTransactionHistory(this.currentViewingWallet);
            
            // 隱藏編輯彈出視窗
            this.hideEditTransactionModal();
            
            this.showNotification('交易已更新！', 'success');
        } catch (error) {
            console.error('更新交易失敗:', error);
            this.showNotification('更新失敗，請重試', 'error');
        }
    }

    // 隱藏編輯交易彈出視窗
    hideEditTransactionModal() {
        document.getElementById('editTransactionModal').style.display = 'none';
        this.currentEditingTransaction = null;
    }

    // 刪除交易
    async deleteTransaction(transactionId) {
        if (!confirm('確定要刪除這筆交易嗎？此操作無法撤銷。')) {
            return;
        }
        
        const wallet = this.wallets.find(w => w.id === this.currentViewingWallet);
        if (!wallet) return;
        
        // 移除交易
        wallet.transactions = wallet.transactions.filter(t => t.id !== transactionId);
        
        // 重新計算所有交易的餘額
        this.recalculateBalances(wallet);
        
        try {
            if (this.isOfflineMode) {
                // 離線模式：儲存到本地
                this.saveWalletsToLocal();
                this.renderWallets();
            } else {
                // 線上模式：更新Firebase
                const { doc, updateDoc } = window.firestoreModule;
                const walletRef = doc(window.db, 'users', this.user.uid, 'wallets', wallet.id);
                
                await updateDoc(walletRef, {
                    amount: wallet.amount,
                    transactions: wallet.transactions
                });
            }
            
            // 更新交易歷史顯示
            this.showTransactionHistory(this.currentViewingWallet);
            
            this.showNotification('交易已刪除！', 'success');
        } catch (error) {
            console.error('刪除交易失敗:', error);
            this.showNotification('刪除失敗，請重試', 'error');
        }
    }

    // 重新計算錢包餘額
    recalculateBalances(wallet) {
        if (!wallet.transactions || wallet.transactions.length === 0) {
            wallet.amount = wallet.initialAmount || 0;
            return;
        }
        
        // 按日期排序交易
        wallet.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let currentBalance = wallet.initialAmount || 0;
        
        // 重新計算每筆交易的餘額
        wallet.transactions.forEach(transaction => {
            if (transaction.type === 'add') {
                currentBalance += transaction.amount;
            } else {
                currentBalance -= transaction.amount;
            }
            transaction.balance = currentBalance;
        });
        
        // 更新錢包當前金額
        wallet.amount = currentBalance;
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
    window.firebaseWalletManager = firebaseWalletManager; // 設定全域變數以供 onclick 使用
    
    // 設置按鈕事件監聽器
    document.getElementById('loginBtn').addEventListener('click', () => {
        firebaseWalletManager.loginWithGoogle();
    });
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
        firebaseWalletManager.logout();
    });
    
    document.getElementById('offlineBtn').addEventListener('click', () => {
        firebaseWalletManager.enableOfflineMode();
    });
    
    // 診斷按鈕監聽器（離線區域中的）
    document.getElementById('diagnosBtn2').addEventListener('click', () => {
        firebaseWalletManager.showDiagnostics();
    });
    
    // 重新整理按鈕監聽器
    document.getElementById('refreshBtn').addEventListener('click', () => {
        firebaseWalletManager.refreshOfflineMode();
    });
});
