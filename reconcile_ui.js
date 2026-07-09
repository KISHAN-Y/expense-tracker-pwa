// ═══════════════════════════════════════════════════════════════════════
// Add these methods to your UI object in ui.js, and wire the button/input
// in index.html as shown at the bottom of this file.
// ═══════════════════════════════════════════════════════════════════════

// ─── Add to UI object in ui.js ───────────────────────────────────────────
const ReconcileUI = {

    async openReconcileSheet() {
        UI.openCustomSheet('reconcileSheet');
        document.getElementById('reconcileResults').innerHTML = '';
        document.getElementById('reconcileUploadState').style.display = 'block';
        document.getElementById('reconcileLoadingState').style.display = 'none';
    },

    async handleStatementUpload(fileInput) {
        const file = fileInput.files[0];
        if (!file) return;

        document.getElementById('reconcileUploadState').style.display = 'none';
        document.getElementById('reconcileLoadingState').style.display = 'block';

        try {
            const appTransactions = await DB.getTransactionsForUser(DB.getCurrentUserIdSync());
            const result = await Reconcile.reconcile(file, appTransactions);
            this._lastResult = result; // keep for "Add All Missing" action
            this.renderReconcileResults(result);
        } catch (err) {
            Utils.showToast(err.message || 'Failed to read statement');
            document.getElementById('reconcileUploadState').style.display = 'block';
        } finally {
            document.getElementById('reconcileLoadingState').style.display = 'none';
            fileInput.value = ''; // allow re-uploading the same file if needed
        }
    },

    renderReconcileResults(result) {
        const { missingInApp, extraInApp, dateMismatches, matchedCount, bankTransactionCount, detectedBank } = result;
        const container = document.getElementById('reconcileResults');

        let html = `
            <div class="reconcile-bank-detected">Detected: <b>${Utils.escapeHTML(detectedBank)}</b> · ${bankTransactionCount} transactions found in statement</div>
            <div class="reconcile-summary">
                <div class="reconcile-stat">
                    <span class="reconcile-stat-num" style="color:#17A672;">${matchedCount}</span>
                    <span class="reconcile-stat-label">Matched</span>
                </div>
                <div class="reconcile-stat">
                    <span class="reconcile-stat-num" style="color:#E5484D;">${missingInApp.length}</span>
                    <span class="reconcile-stat-label">Missing</span>
                </div>
                <div class="reconcile-stat">
                    <span class="reconcile-stat-num" style="color:#F5A623;">${extraInApp.length}</span>
                    <span class="reconcile-stat-label">Unmatched in App</span>
                </div>
            </div>
        `;

        if (missingInApp.length > 0) {
            html += `<div class="reconcile-section-title">Missing from your app (${missingInApp.length})</div>`;
            missingInApp.forEach((m, i) => {
                const sign = m.type === 'income' ? '+' : '-';
                const color = m.type === 'income' ? '#17A672' : '#E5484D';
                html += `
                    <div class="reconcile-item">
                        <div class="reconcile-item-info">
                            <div class="reconcile-item-date">${Utils.formatDate(m.date)}</div>
                            <div class="reconcile-item-desc">${Utils.escapeHTML(m.description)}</div>
                        </div>
                        <div class="reconcile-item-amt" style="color:${color};">${sign}${Utils.formatCurrency(m.amount)}</div>
                        <button class="reconcile-add-btn" onclick="ReconcileUI.addMissingEntry(${i})">Add</button>
                    </div>`;
            });
            html += `<button class="reconcile-add-all-btn" onclick="ReconcileUI.addAllMissing()">Add All ${missingInApp.length} Missing Entries</button>`;
        }

        if (dateMismatches.length > 0) {
            html += `<div class="reconcile-section-title">Date mismatches (${dateMismatches.length})</div>`;
            dateMismatches.forEach(dm => {
                html += `
                    <div class="reconcile-item">
                        <div class="reconcile-item-info">
                            <div class="reconcile-item-desc">${Utils.escapeHTML(dm.app.description || dm.app.category)}</div>
                            <div class="reconcile-item-date" style="color:#F5A623;">App: ${dm.appDate} → Bank: ${dm.bankDate}</div>
                        </div>
                        <button class="reconcile-add-btn" onclick="ReconcileUI.fixDate('${dm.app.id}', '${dm.bankDate}')">Fix Date</button>
                    </div>`;
            });
        }

        if (extraInApp.length > 0) {
            html += `<div class="reconcile-section-title">In your app but not in the bank statement (${extraInApp.length})</div>`;
            html += `<div class="reconcile-hint">These may be duplicates, or transactions the bank hasn't cleared yet. Review before deleting.</div>`;
            extraInApp.forEach(a => {
                const sign = a.type === 'income' ? '+' : '-';
                const color = a.type === 'income' ? '#17A672' : '#E5484D';
                html += `
                    <div class="reconcile-item">
                        <div class="reconcile-item-info">
                            <div class="reconcile-item-date">${Utils.formatDate(a.date)}</div>
                            <div class="reconcile-item-desc">${Utils.escapeHTML(a.description || a.category)}</div>
                        </div>
                        <div class="reconcile-item-amt" style="color:${color};">${sign}${Utils.formatCurrency(a.amount)}</div>
                        <button class="reconcile-delete-btn" onclick="ReconcileUI.deleteExtra('${a.id}')">Delete</button>
                    </div>`;
            });
        }

        if (missingInApp.length === 0 && extraInApp.length === 0 && dateMismatches.length === 0) {
            html += `<div class="reconcile-all-clear">✅ Everything matches — your app is fully reconciled with this statement.</div>`;
        }

        container.innerHTML = html;
    },

    async addMissingEntry(index) {
        const entry = this._lastResult.missingInApp[index];
        await DB.addTransaction({
            date: entry.date,
            type: entry.type,
            category: entry.type === 'income' ? 'Other' : 'Other', // user can recategorize after
            amount: entry.amount,
            description: entry.description,
        });
        Utils.showToast('Transaction added');
        this._lastResult.missingInApp.splice(index, 1);
        this.renderReconcileResults(this._lastResult);
        await UI.updateDashboardStats();
    },

    async addAllMissing() {
        const entries = [...this._lastResult.missingInApp];
        for (const entry of entries) {
            await DB.addTransaction({
                date: entry.date,
                type: entry.type,
                category: 'Other',
                amount: entry.amount,
                description: entry.description,
            });
        }
        Utils.showToast(`Added ${entries.length} transactions`);
        this._lastResult.missingInApp = [];
        this.renderReconcileResults(this._lastResult);
        await UI.updateDashboardStats();
    },

    async fixDate(transactionId, correctDate) {
        const all = await DB.getAllTransactions();
        const tx = all.find(t => t.id === transactionId);
        if (!tx) return;
        tx.date = correctDate;
        await DB.updateTransaction(tx);
        Utils.showToast('Date corrected');
        this._lastResult.dateMismatches = this._lastResult.dateMismatches.filter(dm => dm.app.id !== transactionId);
        this.renderReconcileResults(this._lastResult);
        await UI.updateDashboardStats();
    },

    async deleteExtra(transactionId) {
        await DB.deleteTransaction(transactionId);
        Utils.showToast('Transaction deleted');
        this._lastResult.extraInApp = this._lastResult.extraInApp.filter(a => a.id !== transactionId);
        this.renderReconcileResults(this._lastResult);
        await UI.updateDashboardStats();
    },
};

window.ReconcileUI = ReconcileUI;

/* ═══════════════════════════════════════════════════════════════════════
   HTML to add in index.html (inside your Settings/Profile section, and
   as a new custom sheet alongside your other sheets):
   ═══════════════════════════════════════════════════════════════════════

   <!-- Trigger button, e.g. next to your existing Export button -->
   <div class="settings-row" id="reconcileBtn" onclick="ReconcileUI.openReconcileSheet()">
       <span>Reconcile with Bank Statement</span>
       <span class="settings-row-desc">Upload a PDF to find missing or duplicate entries</span>
   </div>

   <!-- New bottom sheet -->
   <div class="custom-sheet" id="reconcileSheet">
       <div class="sheet-title">Bank Reconciliation</div>

       <div id="reconcileUploadState">
           <p style="font-size:13px;color:#7A7690;margin-bottom:16px;">
               Upload your bank statement PDF and we'll compare it against your
               logged transactions to find anything missing or duplicated.
           </p>
           <input type="file" id="statementFileInput" accept="application/pdf"
                  style="display:none"
                  onchange="ReconcileUI.handleStatementUpload(this)">
           <button onclick="document.getElementById('statementFileInput').click()"
                   style="width:100%;padding:14px;background:#5B3DE0;color:#fff;border:none;border-radius:12px;font-weight:600;">
               Choose PDF
           </button>
       </div>

       <div id="reconcileLoadingState" style="display:none;text-align:center;padding:30px 0;">
           <p style="font-size:13px;color:#7A7690;">Reading your statement…</p>
       </div>

       <div id="reconcileResults"></div>
   </div>

   ═══════════════════════════════════════════════════════════════════════
   Add this to index.html's <head>, BEFORE your other app scripts, so
   pdfjsLib is available when reconcile.js loads:
   ═══════════════════════════════════════════════════════════════════════

   <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
   <script>
       pdfjsLib.GlobalWorkerOptions.workerSrc =
           'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
   </script>
   <script src="reconcile.js"></script>

   ═══════════════════════════════════════════════════════════════════════ */