// 錢包數據管理
class WalletManager {
    constructor() {
        this.wallets = this.loadWallets();
        this.currentEditingWallet = null;
        this.currentTransactionWallet = null;
        this.transactionType = null;
        this.init();
    }

    // 初始化應用程式
    init() {
        this.renderWallets();
        this.bindEvents();
        
        // 如果沒有錢包，顯示空狀態
        if (this.wallets.length === 0) {
            this.showEmptyState();
        }
    }

    // 綁定事件監聽器
    bindEvents() {
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
        });
    }

    // 從本地儲存載入錢包數據
    loadWallets() {
        const saved = localStorage.getItem('wallets');
        return saved ? JSON.parse(saved) : [];
    }

    // 儲存錢包數據到本地儲存
    saveWallets() {
        localStorage.setItem('wallets', JSON.stringify(this.wallets));
    }

    // 生成唯一ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
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
                <button class="edit-btn" onclick="walletManager.showEditWalletModal('${wallet.id}')">⚙️</button>
            </div>
            <div class="wallet-amount">${this.formatCurrency(wallet.amount)}</div>
            ${goalHtml}
            <div class="wallet-actions">
                <button class="btn btn-success" onclick="walletManager.showTransactionModal('${wallet.id}', 'add')">
                    ➕ 存入
                </button>
                <button class="btn btn-danger" onclick="walletManager.showTransactionModal('${wallet.id}', 'subtract')">
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

    // 儲存新錢包
    saveWallet() {
        const name = document.getElementById('walletName').value.trim();
        const goal = parseFloat(document.getElementById('walletGoal').value) || 0;
        const amount = parseFloat(document.getElementById('initialAmount').value) || 0;

        if (!name) {
            alert('請輸入錢包名稱');
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

        const wallet = {
            id: this.generateId(),
            name: name,
            amount: amount,
            goal: goal,
            createdAt: new Date().toISOString()
        };

        this.wallets.push(wallet);
        this.saveWallets();
        this.renderWallets();
        this.hideAddWalletModal();
        
        // 顯示成功訊息
        this.showNotification(`錢包「${name}」創建成功！`, 'success');
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
    processTransaction() {
        const amount = parseFloat(document.getElementById('transactionAmount').value);
        const note = document.getElementById('transactionNote').value.trim();

        if (!amount || amount <= 0) {
            alert('請輸入有效的金額');
            return;
        }

        const wallet = this.wallets.find(w => w.id === this.currentTransactionWallet);
        if (!wallet) return;

        if (this.transactionType === 'add') {
            wallet.amount += amount;
            this.showNotification(`成功存入 ${this.formatCurrency(amount)}`, 'success');
        } else {
            if (wallet.amount < amount) {
                if (!confirm(`餘額不足，目前餘額為 ${this.formatCurrency(wallet.amount)}，確定要透支嗎？`)) {
                    return;
                }
            }
            wallet.amount -= amount;
            this.showNotification(`成功提取 ${this.formatCurrency(amount)}`, 'success');
        }

        // 記錄交易歷史（可以在未來擴展）
        if (!wallet.transactions) {
            wallet.transactions = [];
        }
        
        wallet.transactions.push({
            id: this.generateId(),
            type: this.transactionType,
            amount: amount,
            note: note,
            date: new Date().toISOString(),
            balance: wallet.amount
        });

        this.saveWallets();
        this.renderWallets();
        this.hideTransactionModal();
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
    saveEditWallet() {
        const name = document.getElementById('editWalletName').value.trim();
        const goal = parseFloat(document.getElementById('editWalletGoal').value) || 0;

        if (!name) {
            alert('請輸入錢包名稱');
            return;
        }

        if (goal < 0) {
            alert('目標金額不能為負數');
            return;
        }

        const wallet = this.wallets.find(w => w.id === this.currentEditingWallet);
        if (!wallet) return;

        wallet.name = name;
        wallet.goal = goal;

        this.saveWallets();
        this.renderWallets();
        this.hideEditWalletModal();
        
        this.showNotification('錢包資訊更新成功！', 'success');
    }

    // 刪除錢包
    deleteWallet() {
        const wallet = this.wallets.find(w => w.id === this.currentEditingWallet);
        if (!wallet) return;

        const confirmMessage = `確定要刪除錢包「${wallet.name}」嗎？\n目前餘額：${this.formatCurrency(wallet.amount)}\n\n此操作無法復原！`;
        
        if (confirm(confirmMessage)) {
            this.wallets = this.wallets.filter(w => w.id !== this.currentEditingWallet);
            this.saveWallets();
            this.renderWallets();
            this.hideEditWalletModal();
            
            this.showNotification(`錢包「${wallet.name}」已刪除`, 'info');
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

    // 導出數據（未來可以用來備份）
    exportData() {
        const data = {
            wallets: this.wallets,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `wallet-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 匯入數據（未來可以用來恢復備份）
    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.wallets && Array.isArray(data.wallets)) {
                    if (confirm('匯入數據將覆蓋現有的所有錢包，確定要繼續嗎？')) {
                        this.wallets = data.wallets;
                        this.saveWallets();
                        this.renderWallets();
                        this.showNotification('數據匯入成功！', 'success');
                    }
                } else {
                    throw new Error('無效的數據格式');
                }
            } catch (error) {
                alert('匯入失敗：無效的數據格式');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
    }
}

// 初始化應用程式
let walletManager;

document.addEventListener('DOMContentLoaded', () => {
    walletManager = new WalletManager();
    
    // 添加一些鍵盤快捷鍵
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + N 新增錢包
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            walletManager.showAddWalletModal();
        }
        
        // ESC 關閉彈出視窗
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        }
    });
});
