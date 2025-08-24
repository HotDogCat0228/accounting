// 錢包數據管理
class WalletManager {
    constructor() {
        this.wallets = this.loadWallets();
        this.currentEditingWallet = null;
        this.currentTransactionWallet = null;
        this.currentViewingWallet = null;
        this.currentEditingTransaction = null;
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

        // 編輯交易相關事件
        document.getElementById('saveEditTransactionBtn').addEventListener('click', () => {
            this.saveEditTransaction();
        });

        document.getElementById('cancelEditTransactionBtn').addEventListener('click', () => {
            this.hideEditTransactionModal();
        });

        // 交易紀錄相關事件
        document.getElementById('closeHistoryBtn').addEventListener('click', () => {
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
            } else if (e.key === 'Escape') {
                // 按 ESC 鍵關閉彈出視窗
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

    // 從本地儲存載入錢包數據
    loadWallets() {
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
            <div class="wallet-actions-extended">
                <button class="btn btn-success" onclick="walletManager.showTransactionModal('${wallet.id}', 'add')">
                    ➕ 存入
                </button>
                <button class="btn btn-danger" onclick="walletManager.showTransactionModal('${wallet.id}', 'subtract')">
                    ➖ 提取
                </button>
                <button class="btn btn-info" onclick="walletManager.showTransactionHistory('${wallet.id}')">
                    📊 紀錄
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
        const sortedTransactions = transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
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
        
        const date = new Date(transaction.date);
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
        
        const transactions = wallet.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // 創建 CSV 格式的數據
        const headers = ['日期', '類型', '金額', '備註', '餘額'];
        const csvContent = [
            headers.join(','),
            ...transactions.map(t => [
                new Date(t.date).toLocaleString('zh-TW'),
                t.type === 'add' ? '存入' : '提取',
                t.amount,
                t.note || '',
                t.balance
            ].map(field => `"${field}"`).join(','))
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
    saveEditTransaction() {
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
        
        // 儲存更新
        this.saveWallets();
        this.renderWallets();
        
        // 更新交易歷史顯示
        this.showTransactionHistory(this.currentViewingWallet);
        
        // 隱藏編輯彈出視窗
        this.hideEditTransactionModal();
        
        this.showNotification('交易已更新！', 'success');
    }

    // 隱藏編輯交易彈出視窗
    hideEditTransactionModal() {
        document.getElementById('editTransactionModal').style.display = 'none';
        this.currentEditingTransaction = null;
    }

    // 刪除交易
    deleteTransaction(transactionId) {
        if (!confirm('確定要刪除這筆交易嗎？此操作無法撤銷。')) {
            return;
        }
        
        const wallet = this.wallets.find(w => w.id === this.currentViewingWallet);
        if (!wallet) return;
        
        // 移除交易
        wallet.transactions = wallet.transactions.filter(t => t.id !== transactionId);
        
        // 重新計算所有交易的餘額
        this.recalculateBalances(wallet);
        
        // 儲存更新
        this.saveWallets();
        this.renderWallets();
        
        // 更新交易歷史顯示
        this.showTransactionHistory(this.currentViewingWallet);
        
        this.showNotification('交易已刪除！', 'success');
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
