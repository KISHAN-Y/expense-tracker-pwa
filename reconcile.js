// ═══════════════════════════════════════════════════════════════════════
// Reconciliation Module — Bank Statement vs App Transactions
// Requires pdf.js loaded globally (see index.html snippet below)
// ═══════════════════════════════════════════════════════════════════════

const Reconcile = {

    // ─── Step 1: Extract raw text from the uploaded bank statement PDF ─────
    async extractPdfText(file) {
        console.log("=== STEP 1: PDF TEXT EXTRACTION ===");
        console.log("Loading PDF: " + file.name + " (" + Math.round(file.size / 1024) + " KB)");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        console.log("PDF document parsed successfully. Total Pages: " + pdf.numPages);

        let fullText = '';
        let isScanned = false;

        // First pass: try standard text layer extraction
        for (let i = 1; i <= pdf.numPages; i++) {
            console.log("Attempting vector text extraction on page " + i + "...");
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            if (content.items.length === 0) {
                console.log("Page " + i + " has no vector text. Flagging as scanned PDF.");
                isScanned = true;
                break;
            }
            // Join items with a space; pdf.js splits text into fragments
            // that don't always preserve line breaks, so we rebuild lines
            // using each item's vertical position (transform[5]) as a proxy.
            let lastY = null;
            let line = '';
            const lines = [];
            content.items.forEach(item => {
                const y = item.transform[5];
                if (lastY !== null && Math.abs(y - lastY) > 2) {
                    lines.push(line.trim());
                    line = '';
                }
                line += item.str + ' ';
                lastY = y;
            });
            if (line.trim()) lines.push(line.trim());
            fullText += lines.join('\n') + '\n';
        }

        // Fallback: If PDF has no text layer or extracted text is too sparse, run Tesseract OCR
        if (isScanned || fullText.trim().length < 50) {
            console.log("Standard text extraction failed or yielded too little text (" + fullText.trim().length + " chars). Running in-browser OCR with Tesseract.js...");
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('Scanned PDF detected. Running OCR scanner (takes a few seconds)...');
            }

            fullText = '';
            console.log("Initializing Tesseract.js English OCR worker thread...");
            const worker = await Tesseract.createWorker('eng');

            for (let i = 1; i <= pdf.numPages; i++) {
                console.log("Running Tesseract OCR on Page " + i + "/" + pdf.numPages + "...");
                const page = await pdf.getPage(i);
                
                // Render page to canvas at 2x scale for higher OCR precision
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };

                await page.render(renderContext).promise;

                // Run OCR character recognition
                const { data: { text } } = await worker.recognize(canvas);
                console.log("Page " + i + " OCR completed. Length: " + text.length + " chars.");
                fullText += text + '\n';
            }

            await worker.terminate();
            console.log("Tesseract OCR worker terminated cleanly. Total extracted text size: " + fullText.length + " chars.");
        } else {
            console.log("Standard vector text extraction successful. Total extracted text size: " + fullText.length + " chars.");
        }

        return fullText;
    },

    // ─── Bank Detection ──────────────────────────────────────────────────────
    // Identifies which bank issued the statement by scanning for its name
    // near the top of the document. Used only for display/logging — the
    // parser below works generically across formats, this just tells the
    // user which bank was detected so they can sanity-check the results.
    BANK_SIGNATURES: [
        { name: 'State Bank of India',   pattern: /STATE BANK OF INDIA|\bSBI\b/i },
        { name: 'HDFC Bank',             pattern: /HDFC BANK/i },
        { name: 'ICICI Bank',            pattern: /ICICI BANK/i },
        { name: 'Axis Bank',             pattern: /AXIS BANK/i },
        { name: 'IDFC FIRST Bank',       pattern: /IDFC FIRST BANK/i },
        { name: 'Kotak Mahindra Bank',   pattern: /KOTAK MAHINDRA BANK/i },
        { name: 'Punjab National Bank',  pattern: /PUNJAB NATIONAL BANK|\bPNB\b/i },
        { name: 'Bank of Baroda',        pattern: /BANK OF BARODA/i },
        { name: 'Canara Bank',           pattern: /CANARA BANK/i },
        { name: 'Yes Bank',              pattern: /YES BANK/i },
        { name: 'IndusInd Bank',         pattern: /INDUSIND BANK/i },
    ],

    detectBank(rawText) {
        console.log("=== STEP 2: BANK SIGNATURE DETECTION ===");
        for (const sig of this.BANK_SIGNATURES) {
            if (sig.pattern.test(rawText)) {
                console.log("Bank Signature Matched: " + sig.name);
                return sig.name;
            }
        }
        console.log("No matching bank signatures found. Defaulting to: Generic Bank Parser");
        return 'Unknown (generic parser used)';
    },

    // ─── Date Format Detection ───────────────────────────────────────────────
    // Different banks print dates differently:
    //   IDFC FIRST / Axis / Yes Bank : DD-Mon-YYYY   (e.g. 03-Jul-2026)
    //   SBI / PNB / Canara           : DD/MM/YYYY    or DD-MM-YYYY
    //   HDFC / ICICI                 : DD/MM/YY      (2-digit year, sometimes)
    // Rather than assume one format, try each pattern against the document
    // and use whichever one actually matches the most lines.
    DATE_PATTERNS: [
        { name: 'DD-Mon-YYYY', regex: /\d{2}-[A-Za-z]{3}-\d{4}/g,     parse: (s) => Reconcile._parseDDMonYYYY(s) },
        { name: 'DD/MM/YYYY',  regex: /\d{2}\/\d{2}\/\d{4}/g,          parse: (s) => Reconcile._parseSlashDate(s, 4) },
        { name: 'DD-MM-YYYY',  regex: /\d{2}-\d{2}-\d{4}/g,            parse: (s) => Reconcile._parseDashDate(s, 4) },
        { name: 'DD/MM/YY',    regex: /\d{2}\/\d{2}\/\d{2}(?!\d)/g,    parse: (s) => Reconcile._parseSlashDate(s, 2) },
    ],

    _parseDDMonYYYY(s) {
        const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
        const [d, mon, y] = s.split('-');
        return new Date(parseInt(y), months[mon], parseInt(d));
    },

    _parseSlashDate(s, yearLen) {
        const [d, m, y] = s.split('/');
        const fullYear = yearLen === 2 ? (parseInt(y) > 50 ? 1900 + parseInt(y) : 2000 + parseInt(y)) : parseInt(y);
        return new Date(fullYear, parseInt(m) - 1, parseInt(d));
    },

    _parseDashDate(s, yearLen) {
        const [d, m, y] = s.split('-');
        return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    },

    detectDateFormat(rawText) {
        console.log("=== STEP 3: DATE FORMAT DETECTION ===");
        let best = { name: null, count: 0, pattern: null };
        for (const dp of this.DATE_PATTERNS) {
            const matches = rawText.match(dp.regex) || [];
            console.log("Format: " + dp.name + " -> Matches count: " + matches.length);
            if (matches.length > best.count) {
                best = { name: dp.name, count: matches.length, pattern: dp };
            }
        }
        const selected = best.pattern || this.DATE_PATTERNS[0];
        console.log("Selected date format for parsing: " + selected.name);
        return selected;
    },

    // ─── Step 2: Parse bank transaction rows out of the raw text ───────────
    // Generic across Indian bank layouts: looks for the detected date format
    // appearing (usually twice — Txn Date + Value Date) per line, followed
    // by narration text and one or more trailing amounts (debit/credit/balance).
    parseBankStatement(rawText) {
        const dateFormat = this.detectDateFormat(rawText);
        const amountRe = /[\d,]+\.\d{2}/g;

        const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
        const transactions = [];

        console.log("=== STEP 4: STATEMENT ROW PARSING ===");
        console.log("Scanning " + lines.length + " lines from PDF text dump...");

        const creditHints = /REFUND|SALARY|CR\/|onscreenpayment|cashback|NEFT-CR|IMPS-CR|RTGS-CR|CREDIT INTEREST|DIVIDEND|REVERSAL/i;
        const debitHints  = /NEFT-DR|IMPS-DR|RTGS-DR|ATM-CASH|POS |CHQ PAID|DEBIT CARD|AUTO DEBIT|EMI/i;

        let currentTx = null;
        let prevBalance = null;

        for (let idx = 0; idx < lines.length; idx++) {
            const line = lines[idx];
            
            // Check if this line starts a new transaction by matching dates
            const dateMatches = [...line.matchAll(new RegExp(dateFormat.regex, 'g'))];
            
            if (dateMatches.length >= 1) {
                // If we were already building a transaction, but it didn't get amounts, discard or push it
                if (currentTx) {
                    console.log("  -> Warning: Discarding incomplete transaction without amount: " + currentTx.particulars);
                }
                
                const txDateStr = dateMatches[0][0];
                
                // Find where the date ends to isolate the start of particulars
                const lastDateMatch = dateMatches[dateMatches.length - 1];
                const lastDateIdx = lastDateMatch.index + lastDateMatch[0].length;
                const lineParticulars = line.slice(lastDateIdx).trim();
                
                currentTx = {
                    date: txDateStr,
                    particulars: lineParticulars,
                    dateFormatUsed: dateFormat.name,
                    rawLines: [line]
                };
                
                // Check if this line also happens to contain the amounts on the same line
                const amounts = [...lineParticulars.matchAll(amountRe)].map(m => parseFloat(m[0].replace(/,/g, '')));
                if (amounts.length >= 2) {
                    // This row is on a single line!
                    const balance = amounts[amounts.length - 1];
                    const moneyFields = amounts.slice(0, -1);
                    
                    let debit = null, credit = null;
                    const cleanParticulars = lineParticulars.replace(amountRe, '').trim();
                    currentTx.particulars = cleanParticulars;
                    
                    // Determine debit/credit
                    if (prevBalance !== null) {
                        if (balance > prevBalance) credit = moneyFields[0];
                        else debit = moneyFields[0];
                    } else {
                        const isLikelyCredit = creditHints.test(cleanParticulars);
                        const isLikelyDebit = debitHints.test(cleanParticulars);
                        if (isLikelyCredit && !isLikelyDebit) credit = moneyFields[0];
                        else if (isLikelyDebit && !isLikelyCredit) debit = moneyFields[0];
                        else if (balance === moneyFields[0]) credit = moneyFields[0];
                        else debit = moneyFields[0];
                    }
                    
                    currentTx.debit = debit;
                    currentTx.credit = credit;
                    currentTx.balance = balance;
                    currentTx.raw = currentTx.rawLines.join(' ');
                    
                    prevBalance = balance;
                    transactions.push(currentTx);
                    console.log(`Parsed Row (Single Line) -> Date: ${currentTx.date} | Particulars: "${currentTx.particulars.substring(0, 30)}..." | Debit: ${debit || '-'} | Credit: ${credit || '-'} | Balance: ${balance}`);
                    currentTx = null;
                }
            } else if (currentTx) {
                // We are in the middle of parsing a multi-line transaction
                currentTx.rawLines.push(line);
                
                // Check if this line contains the amounts
                const amounts = [...line.matchAll(amountRe)].map(m => parseFloat(m[0].replace(/,/g, '')));
                if (amounts.length >= 1) {
                    // Found the amounts line! This completes the transaction.
                    const balance = amounts[amounts.length - 1];
                    const moneyFields = amounts.slice(0, -1);
                    
                    let debit = null, credit = null;
                    
                    // The particulars (description) is everything accumulated so far plus any non-amount text on this line
                    const lineTextWithoutAmounts = line.replace(amountRe, '').trim();
                    if (lineTextWithoutAmounts) {
                        currentTx.particulars += " " + lineTextWithoutAmounts;
                    }
                    
                    // Clean up double spaces in particulars
                    currentTx.particulars = currentTx.particulars.replace(/\s+/g, ' ').trim();
                    
                    if (moneyFields.length >= 1) {
                        // Determine debit/credit
                        if (prevBalance !== null) {
                            if (balance > prevBalance) credit = moneyFields[0];
                            else debit = moneyFields[0];
                        } else {
                            const isLikelyCredit = creditHints.test(currentTx.particulars);
                            const isLikelyDebit = debitHints.test(currentTx.particulars);
                            if (isLikelyCredit && !isLikelyDebit) credit = moneyFields[0];
                            else if (isLikelyDebit && !isLikelyCredit) debit = moneyFields[0];
                            else if (balance === moneyFields[0]) credit = moneyFields[0];
                            else debit = moneyFields[0];
                        }
                    } else {
                        // Only 1 amount on the line (which is the balance), and no transaction amount.
                        console.log("  -> Warning: Line had only one amount which was treated as balance, skipping transaction: " + currentTx.particulars);
                        currentTx = null;
                        continue;
                    }
                    
                    currentTx.debit = debit;
                    currentTx.credit = credit;
                    currentTx.balance = balance;
                    currentTx.raw = currentTx.rawLines.join(' ');
                    
                    prevBalance = balance;
                    transactions.push(currentTx);
                    console.log(`Parsed Row (Multi Line) -> Date: ${currentTx.date} | Particulars: "${currentTx.particulars.substring(0, 30)}..." | Debit: ${debit || '-'} | Credit: ${credit || '-'} | Balance: ${balance}`);
                    currentTx = null;
                } else {
                    // Just more description text, append it
                    currentTx.particulars += " " + line;
                }
            } else {
                // No active transaction and no date matched.
                // Check if this line is the "Opening Balance" line to initialize prevBalance!
                if (line.toLowerCase().includes("opening balance")) {
                    const amounts = [...line.matchAll(amountRe)].map(m => parseFloat(m[0].replace(/,/g, '')));
                    if (amounts.length >= 1) {
                        prevBalance = amounts[0];
                        console.log("Initialized Opening Balance: " + prevBalance);
                    }
                }
            }
        }

        console.log("Statement row parsing complete. Successfully extracted " + transactions.length + " transactions.");
        console.log("[DEBUG] All extracted transactions from PDF:", transactions);
        return transactions;
    },

    // ─── Step 3: Normalize any detected date format → "YYYY-MM-DD" ─────────
    normalizeBankDate(bankDateStr, dateFormatName) {
        const fmt = this.DATE_PATTERNS.find(dp => dp.name === dateFormatName) || this.detectDateFormat(bankDateStr);
        const dateObj = fmt.parse(bankDateStr);
        const yy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
    },

    // ─── Step 4: Match bank transactions against app transactions ──────────
    // Matching key: same normalized date (±1 day tolerance) + same amount + same type.
    // Returns: { missingInApp, extraInApp, dateMismatches, matchedCount }
    matchTransactions(bankTx, appTx) {
        console.log("=== STEP 5: TRANSACTION MATCHING ENGINE ===");
        console.log("Comparing bank entries against local app transaction ledger...");

        const dayMs = 24 * 60 * 60 * 1000;
        const usedAppIds = new Set();
        const missingInApp = [];
        const dateMismatches = [];
        let matchedCount = 0;

        const toDate = (s) => new Date(s);

        for (let idx = 0; idx < bankTx.length; idx++) {
            const b = bankTx[idx];
            const bDateNorm = this.normalizeBankDate(b.date, b.dateFormatUsed);
            const bAmount = b.debit || b.credit;
            const bType = b.debit ? 'expense' : 'income';
            if (!bAmount) continue;

            let match = null;

            console.log(`Matching bank transaction [${idx + 1}]: Date=${bDateNorm} | Type=${bType} | Amount=${bAmount}`);

            // Pass 1: exact date + exact amount + exact type
            match = appTx.find(a =>
                !usedAppIds.has(a.id) &&
                a.date === bDateNorm &&
                a.type === bType &&
                Math.abs(parseFloat(a.amount) - bAmount) < 0.01
            );

            if (match) {
                console.log(`  -> Exact Match found in App (ID: ${match.id})`);
            }

            // Pass 2: amount + type match, date within ±2 days (catches date adjustments or delay offsets)
            if (!match) {
                match = appTx.find(a => {
                    if (usedAppIds.has(a.id) || a.type !== bType) return false;
                    if (Math.abs(parseFloat(a.amount) - bAmount) >= 0.01) return false;
                    const diffDays = Math.abs(toDate(a.date) - toDate(bDateNorm)) / dayMs;
                    return diffDays <= 2;
                });
                if (match) {
                    console.log(`  -> Near Match (Date offset match within 2 days) in App (ID: ${match.id}, App Date: ${match.date})`);
                    dateMismatches.push({
                        bank: b, app: match,
                        bankDate: bDateNorm, appDate: match.date,
                    });
                }
            }

            if (match) {
                usedAppIds.add(match.id);
                matchedCount++;
            } else {
                console.log("  -> No match found. Added to Missing from App ledger.");
                missingInApp.push({
                    date: bDateNorm,
                    type: bType,
                    amount: bAmount,
                    description: b.particulars,
                    bankRaw: b.raw,
                });
            }
        }

        // Anything in appTx within the statement's date range that was never
        // matched is a candidate duplicate or a manually-added entry with no
        // bank counterpart.
        const bankDates = bankTx.map(b => this.normalizeBankDate(b.date, b.dateFormatUsed));
        const minDate = bankDates.reduce((a, b) => a < b ? a : b);
        const maxDate = bankDates.reduce((a, b) => a > b ? a : b);

        console.log("Evaluating unmatched local transactions within statement date bounds: " + minDate + " to " + maxDate);

        const extraInApp = appTx.filter(a =>
            !usedAppIds.has(a.id) &&
            a.date >= minDate && a.date <= maxDate
        );

        console.log(`Unmatched app ledger entries within date range: ${extraInApp.length}`);
        extraInApp.forEach(a => console.log(`  -> Extra app transaction (ID: ${a.id}, Date: ${a.date}, Amount: ${a.amount})`));

        console.log("=== MATCHING LOGS COMPLETED ===");
        console.log(`Result summary: Matches=${matchedCount} | Date Mismatches=${dateMismatches.length} | Missing in App=${missingInApp.length} | Unmatched in App=${extraInApp.length}`);
        console.log("[DEBUG] All missing entries identified:", missingInApp);

        return { missingInApp, extraInApp, dateMismatches, matchedCount };
    },

    // ─── Step 5: Full pipeline — call this from the UI ─────────────────────
    async reconcile(file, appTransactions) {
        console.log("==================================================");
        console.log("🚀 STARTING BANK RECONCILIATION FOR: " + file.name);
        console.log("==================================================");

        const rawText = await this.extractPdfText(file);
        const detectedBank = this.detectBank(rawText);
        const bankTx = this.parseBankStatement(rawText);

        if (bankTx.length === 0) {
            console.error("Reconciliation failed: Could not extract any valid transactions.");
            throw new Error(`Could not detect any transaction rows in this PDF (bank detected: ${detectedBank}). The statement format may differ from what this parser expects — manual review recommended.`);
        }

        const result = this.matchTransactions(bankTx, appTransactions);
        console.log("==================================================");
        console.log("🎉 RECONCILIATION PIPELINE COMPLETED SUCCESSFULLY!");
        console.log("==================================================");
        return { ...result, bankTransactionCount: bankTx.length, bankTx, detectedBank };
    },
};

window.Reconcile = Reconcile;