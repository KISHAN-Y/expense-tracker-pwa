// Utility Functions
const Utils = {
    // Format currency — uses the currency stored in settings (or falls back to default)
    formatCurrency(amount, currency) {
        const cur = currency || CONFIG.DEFAULT_CURRENCY;
        const currencyInfo = CONFIG.CURRENCIES[cur] || CONFIG.CURRENCIES[CONFIG.DEFAULT_CURRENCY];
        const num = Number(amount) || 0;
        return `${currencyInfo.symbol}${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    },
    
    // Escape HTML to prevent XSS
    escapeHTML(str) {
        if (!str) return '';
        const p = document.createElement('p');
        p.appendChild(document.createTextNode(str));
        return p.innerHTML;
    },

    // Robust date parser that handles ISO, YYYY-MM-DD, DD-MM-YYYY, timestamps, Date objects
    parseDate(dateVal) {
        if (!dateVal) return new Date();
        if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? new Date() : dateVal;

        const str = String(dateVal).trim();
        if (!str || str === 'Invalid Date' || str === 'undefined' || str === 'null') return new Date();

        // 1. Try ISO / standard JS Date constructor
        const d1 = new Date(str);
        if (!isNaN(d1.getTime())) return d1;

        // 2. Try timestamp number
        if (!isNaN(str)) {
            const d2 = new Date(Number(str));
            if (!isNaN(d2.getTime())) return d2;
        }

        // 3. Try YYYY-MM-DD or DD-MM-YYYY or YYYY/MM/DD
        const parts = str.split(/[-/.]/);
        if (parts.length >= 3) {
            let y, m, d;
            if (parts[0].length === 4) { // YYYY-MM-DD
                y = parseInt(parts[0], 10);
                m = parseInt(parts[1], 10) - 1;
                d = parseInt(parts[2], 10);
            } else if (parts[2].length === 4) { // DD-MM-YYYY
                d = parseInt(parts[0], 10);
                m = parseInt(parts[1], 10) - 1;
                y = parseInt(parts[2], 10);
            } else {
                d = parseInt(parts[0], 10);
                m = parseInt(parts[1], 10) - 1;
                y = parseInt(parts[2], 10);
            }
            if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                const d3 = new Date(y, m, d);
                if (!isNaN(d3.getTime())) return d3;
            }
        }

        return new Date();
    },

    // Format date  e.g. "Jul 3, 2026"
    formatDate(dateStr) {
        const d = this.parseDate(dateStr);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    },

    // Format short date e.g. "Jul 3"
    formatShortDate(dateStr) {
        const d = this.parseDate(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },

    // Format time
    formatTime(date) {
        const d = this.parseDate(date);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    },

    // Get today's date in YYYY-MM-DD format
    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    },

    // Show success overlay modal ("Transaction has been successfully added")
    showSuccessModal(duration = 1500) {
        const modal = document.getElementById('successOverlay');
        if (!modal) return Promise.resolve();
        modal.classList.add('show');
        return new Promise(resolve => {
            setTimeout(() => {
                modal.classList.remove('show');
                resolve();
            }, duration);
        });
    },

    // Show toast notification — auto dismisses after `duration` ms (default 2.5s)
    showToast(message, duration = 2500) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        // Clear any existing timer so rapid calls reset properly
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => toast.classList.remove('show'), duration);
    },

    // Show / hide loading indicator
    showLoading(show = true) {
        const loader = document.getElementById('loadingIndicator');
        if (!loader) return;
        loader.classList.toggle('show', show);

        // Keep resetting the APP idle timer while loading is active to prevent auto logout during long operations
        if (show) {
            if (typeof APP !== 'undefined' && APP.resetIdleTimer) {
                APP.resetIdleTimer();
                if (this._loadingResetInterval) clearInterval(this._loadingResetInterval);
                this._loadingResetInterval = setInterval(() => {
                    if (typeof APP !== 'undefined' && APP.resetIdleTimer) {
                        APP.resetIdleTimer();
                    }
                }, 30000); // Reset every 30 seconds while loading
            }
        } else {
            if (this._loadingResetInterval) {
                clearInterval(this._loadingResetInterval);
                this._loadingResetInterval = null;
            }
            if (typeof APP !== 'undefined' && APP.resetIdleTimer) {
                APP.resetIdleTimer(); // Final reset when loading stops
            }
        }
    },

    // Validate email
    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    // Validate amount
    validateAmount(amount) {
        return !isNaN(amount) && amount > 0;
    },

    // Get category emoji icon
    getCategoryIcon(category, type) {
        const icons = {
            expense: {
                'Food': '🍜', 'Travel': '✈️', 'Fuel': '⛽',
                'Shopping': '🛒', 'Entertainment': '🎮', 'Bills': '🧾',
                'Health': '❤️', 'Education': '📚', 'Investment': '💼',
                'Subscription': '📋', 'Transport': '🚗', 'Utilities': '💡',
                'Other': '📦'
            },
            income: {
                'Salary': '💼', 'Freelance': '💻', 'Business': '🏢',
                'Investment': '📈', 'Gift': '🎁', 'Bonus': '🎉',
                'Other': '💰'
            }
        };
        return icons[type]?.[category] || (type === 'income' ? '💰' : '💸');
    },

    // Generate unique ID
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    // Debounce
    debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    // Throttle
    throttle(func, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Export to PDF Reconciled Statement
    exportToPDF(transactions, displayName, rangeLabel, lastReconciledDate) {
        if (!transactions || transactions.length === 0) {
            Utils.showToast('No transactions found for this period');
            return;
        }

        // Sort transactions chronologically
        const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

        // Format Account Holder Name
        const userName = displayName && displayName.trim() !== '' ? displayName.trim() : 'Spendlyst User';

        // Calculate Statement Period
        const dates = sortedTx.map(t => new Date(t.date));
        const earliestDate = new Date(Math.min(...dates));
        const latestDate = new Date(Math.max(...dates));
        
        const formatDateStr = (dateObj) => {
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return `${String(dateObj.getDate()).padStart(2, '0')} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
        };
        const periodStr = `${formatDateStr(earliestDate)} – ${formatDateStr(latestDate)}`;
        const generatedOnStr = formatDateStr(new Date());

        // Determine dynamic save title name (defines filename when saved as PDF)
        let titleName = 'Spendly_STMT';
        if (rangeLabel === 'All Time') {
            titleName += '_alltime';
        } else {
            const parts = rangeLabel.replace(',', '').trim().split(' ');
            if (parts.length === 2) {
                const monthShort = parts[0].substring(0, 3).toLowerCase();
                const year = parts[1];
                titleName += `_${monthShort}${year}`;
            } else {
                titleName += '_' + rangeLabel.toLowerCase().replace(/[^a-z0-9]/g, '');
            }
        }

        // Compute totals & running balances
        let runningBalance = 0;
        let totalIncome = 0;
        let totalExpense = 0;

        let rowsHtml = '';
        sortedTx.forEach(t => {
            const amt = parseFloat(t.amount) || 0;
            const isIncome = t.type === 'income';
            
            if (isIncome) {
                runningBalance += amt;
                totalIncome += amt;
            } else {
                runningBalance -= amt;
                totalExpense += amt;
            }

            const sign = isIncome ? '+' : '-';
            const amtClass = isIncome ? 'amt-income' : 'amt-expense';
            const typeLabel = isIncome ? 'Income' : 'Expense';

            rowsHtml += `
                <tr>
                    <td>${formatDateStr(new Date(t.date))}</td>
                    <td>${typeLabel}</td>
                    <td>${Utils.escapeHTML(t.category)}</td>
                    <td>${Utils.escapeHTML(t.description || '')}</td>
                    <td class="num ${amtClass}">${sign}${Utils.formatCurrency(amt)}</td>
                    <td class="num">${Utils.formatCurrency(runningBalance)}</td>
                </tr>
            `;
        });

        // Reconciled Row
        const reconciledRow = lastReconciledDate 
            ? `<tr><td>Reconciled Against</td><td>Bank Statement (Reconciled on ${lastReconciledDate})</td></tr>` 
            : '';

        // Build HTML document
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${titleName}</title>
<style>
  :root{
    --ink:#1F2430;
    --muted:#6B7280;
    --line:#E5E7EB;
    --accent:#2563EB;
    --green:#059669;
    --red:#DC2626;
    --bg-light:#F9FAFB;
  }

  * { box-sizing: border-box; }

  body{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: var(--ink);
    background: #EEF0F3;
    margin: 0;
    padding: 24px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .sheet{
    max-width: 800px;
    margin: 0 auto;
    background: #fff;
    padding: 40px 44px;
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    position: relative;
    overflow: hidden;
  }

  .watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    opacity: 0.05;
    z-index: 1;
    pointer-events: none;
    width: 380px;
    height: 380px;
    background-image: url('https://spendlyst.tech/assets/icon-192.png');
    background-repeat: no-repeat;
    background-position: center;
    background-size: contain;
  }

  .brand-title{
    font-size: 26px;
    font-weight: 700;
    margin: 0 0 2px 0;
  }

  .brand-subtitle{
    font-size: 13px;
    color: var(--muted);
    margin: 0 0 16px 0;
  }

  hr.divider{
    border: none;
    border-top: 2px solid var(--ink);
    margin: 0 0 20px 0;
  }

  .meta-table{
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
    position: relative;
    z-index: 5;
  }
  .meta-table td{
    padding: 5px 0;
    font-size: 13px;
  }
  .meta-table td:first-child{
    color: var(--muted);
    font-weight: 600;
    width: 200px;
  }

  h2.section{
    font-size: 15px;
    font-weight: 700;
    margin: 26px 0 10px 0;
    position: relative;
    z-index: 5;
  }

  .summary-grid{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border: 1px solid var(--line);
    border-radius: 6px;
    overflow: hidden;
    position: relative;
    z-index: 5;
  }
  .summary-cell{
    text-align: center;
    padding: 14px 8px;
    border-right: 1px solid var(--line);
  }
  .summary-cell:last-child{ border-right: none; }
  .summary-label{
    background: var(--ink);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: 8px;
    text-align: center;
  }
  .summary-value{
    font-size: 20px;
    font-weight: 700;
    padding-top: 12px;
    background: var(--bg-light);
  }
  .summary-value.income{ color: var(--green); }
  .summary-value.expense{ color: var(--red); }
  .summary-value.balance{ color: var(--accent); }

  table.tx-table{
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
    position: relative;
    z-index: 5;
  }
  table.tx-table thead th{
    background: var(--ink);
    color: #fff;
    text-align: left;
    padding: 8px 10px;
    font-weight: 700;
    font-size: 11.5px;
  }
  table.tx-table th.num, table.tx-table td.num{
    text-align: right;
  }
  table.tx-table tbody td{
    padding: 8px 10px;
    border-bottom: 1px solid var(--line);
  }
  table.tx-table tbody tr:nth-child(even){
    background: var(--bg-light);
  }
  .amt-income{ color: var(--green); font-weight: 600; }
  .amt-expense{ color: var(--red); font-weight: 600; }

  .footer{
    text-align: center;
    font-size: 10.5px;
    color: var(--muted);
    border-top: 1px solid var(--line);
    margin-top: 30px;
    padding-top: 12px;
    position: relative;
    z-index: 5;
  }

  .export-bar{
    max-width: 800px;
    margin: 0 auto 12px auto;
    text-align: right;
  }
  .export-bar button{
    background: var(--ink);
    color: #fff;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
  }
  .export-bar button:hover{ opacity: 0.9; }

  /* Print-specific: hides the export button, forces clean page */
  @media print{
    body{ background: #fff; padding: 0; }
    .export-bar{ display: none; }
    .sheet{ box-shadow: none; border-radius: 0; padding: 0; max-width: 100%; }
  }
</style>
</head>
<body>

  <div class="watermark"></div>

  <div class="export-bar">
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="sheet">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; position: relative; z-index: 5;">
        <div>
            <div class="brand-title">Spendlyst</div>
            <div class="brand-subtitle">Personal Expense Statement &bull; Reconciled Transaction Report (${Utils.escapeHTML(rangeLabel)})</div>
        </div>
        <img src="https://spendlyst.tech/assets/icon-192.png" alt="Spendlyst Logo" style="height: 48px; width: 48px; object-fit: contain; flex-shrink: 0; margin-left: 16px;">
    </div>
    <hr class="divider">

    <table class="meta-table">
      <tr><td>Account Holder</td><td>${Utils.escapeHTML(userName)}</td></tr>
      <tr><td>Statement Period</td><td>${periodStr}</td></tr>
      ${reconciledRow}
      <tr><td>Generated On</td><td>${generatedOnStr}</td></tr>
    </table>

    <h2 class="section">Summary</h2>
    <div class="summary-grid">
      <div>
        <div class="summary-label">Total Income</div>
        <div class="summary-cell summary-value income">${Utils.formatCurrency(totalIncome)}</div>
      </div>
      <div>
        <div class="summary-label">Total Expense</div>
        <div class="summary-cell summary-value expense">${Utils.formatCurrency(totalExpense)}</div>
      </div>
      <div>
        <div class="summary-label">Closing Balance</div>
        <div class="summary-cell summary-value balance">${Utils.formatCurrency(runningBalance)}</div>
      </div>
    </div>

    <h2 class="section">Reconciled Transactions</h2>
    <table class="tx-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Category</th>
          <th>Description</th>
          <th class="num">Amount</th>
          <th class="num">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="footer">
      Spendlyst &bull; Personal Expense Tracker &bull; Auto-generated statement, no signature required
    </div>
  </div>

  <script>
    window.onload = function() {
      document.title = "${titleName}";
      setTimeout(function() {
        window.print();
      }, 300);
    };
  <\/script>
</body>
</html>
        `;

        // Create HTML blob and URL
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        // Open print window
        const printWindow = window.open(url, '_blank');
        if (!printWindow) {
            alert('Popup blocker active. Please allow popups for Spendlyst to export statement.');
            return;
        }

        // Revoke the object URL after load to free memory
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 15000);
    },

    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            Utils.showToast('Copied to clipboard!');
            return true;
        } catch {
            return false;
        }
    },

    // Get query parameter
    getQueryParam(param) {
        return new URLSearchParams(window.location.search).get(param);
    },

    // Online check
    isOnline() {
        return navigator.onLine;
    },

    // Mobile check
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    // Storage estimate
    async getStorageSize() {
        if (!navigator.storage?.estimate) return null;
        const { usage, quota } = await navigator.storage.estimate();
        return { usage, quota, percentage: (usage / quota) * 100 };
    },

    // Trigger system notification (screen ON or OFF)
    async triggerSystemNotification(title, body) {
        title = title || 'Expense Tracker 💰';
        body = body || 'Time to add your recent income & expenses!';

        if (!('Notification' in window)) {
            this.showToast(body, 2500);
            return;
        }

        if (Notification.permission === 'default') {
            await Notification.requestPermission();
        }

        if (Notification.permission === 'granted') {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'SHOW_NOTIFICATION',
                    title,
                    body
                });
            } else if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.ready;
                if (reg) {
                    reg.showNotification(title, {
                        body,
                        icon: 'assets/icon-192.svg',
                        badge: 'assets/icon-192.svg',
                        vibrate: [200, 100, 200]
                    });
                }
            } else {
                new Notification(title, { body });
            }
        } else {
            this.showToast(body, 2500);
        }
    },

    // 3-Hour Reminder Scheduler
    init3HourReminder() {
        const THREE_HOURS = 3 * 60 * 60 * 1000;

        const checkAndNotify = () => {
            const lastTime = parseInt(localStorage.getItem('last3HourNotifTime') || '0', 10);
            const now = Date.now();

            if (now - lastTime >= THREE_HOURS) {
                this.triggerSystemNotification(
                    'Expense Tracker 💰',
                    'Time to track your money! Don\'t forget to add your recent income & expenses.'
                );
                localStorage.setItem('last3HourNotifTime', now.toString());
            }
        };

        checkAndNotify();
        setInterval(checkAndNotify, 15 * 60 * 1000);
    }
};

