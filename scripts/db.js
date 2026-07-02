// Firebase Database and Authentication Management
const DB = {
    app: null,
    db: null,
    auth: null,
    user: null,

    // Initialize Firebase
    async init() {
        return new Promise((resolve, reject) => {
            try {
                if (!firebase.apps.length) {
                    this.app = firebase.initializeApp(CONFIG.FIREBASE_CONFIG);
                } else {
                    this.app = firebase.app();
                }
                this.db = firebase.firestore();
                this.auth = firebase.auth();
                resolve();
            } catch (error) {
                console.error("Firebase init error:", error);
                reject(error);
            }
        });
    },

    // --- Authentication ---

    async signInWithGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            // Reverting to popup as redirect fails in iframe simulators due to sessionStorage blocking
            const result = await this.auth.signInWithPopup(provider);
            this.user = result.user;
            return this.user;
        } catch (error) {
            console.error("Google Sign-In Error:", error);
            throw error;
        }
    },

    async signOut() {
        try {
            await this.auth.signOut();
            this.user = null;
        } catch (error) {
            console.error("Sign-Out Error:", error);
            throw error;
        }
    },

    onAuthStateChanged(callback) {
        this.auth.onAuthStateChanged((user) => {
            this.user = user;
            callback(user);
        });
    },

    // --- Firestore CRUD ---

    // Get current user ID
    get uid() {
        return this.user ? this.user.uid : null;
    },

    // TRANSACTIONS

    async addTransaction(transaction) {
        if (!this.uid) throw new Error("User not authenticated");
        transaction.uid = this.uid;
        transaction.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        
        try {
            const docRef = await this.db.collection(CONFIG.STORES.TRANSACTIONS).add(transaction);
            transaction.id = docRef.id;
            return transaction;
        } catch (error) {
            console.error("Error adding transaction:", error);
            throw error;
        }
    },

    async getAllTransactions() {
        if (!this.uid) throw new Error("User not authenticated");
        try {
            const querySnapshot = await this.db.collection(CONFIG.STORES.TRANSACTIONS)
                                                .where("uid", "==", this.uid)
                                                .get();
            const transactions = [];
            querySnapshot.forEach((doc) => {
                transactions.push({ id: doc.id, ...doc.data() });
            });
            
            // Sort by createdAt descending on the client side to avoid Firebase Index requirement
            transactions.sort((a, b) => {
                const timeA = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
                const timeB = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
                return timeB - timeA;
            });
            
            return transactions;
        } catch (error) {
            console.error("Error getting transactions:", error);
            throw error;
        }
    },

    async deleteTransaction(id) {
        if (!this.uid) throw new Error("User not authenticated");
        try {
            await this.db.collection(CONFIG.STORES.TRANSACTIONS).doc(id).delete();
            return true;
        } catch (error) {
            console.error("Error deleting transaction:", error);
            throw error;
        }
    },

    // ACCOUNTS

    async addAccount(account) {
        if (!this.uid) throw new Error("User not authenticated");
        account.uid = this.uid;
        account.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        
        try {
            const docRef = await this.db.collection("accounts").add(account);
            account.id = docRef.id;
            return account;
        } catch (error) {
            console.error("Error adding account:", error);
            throw error;
        }
    },

    async getAllAccounts() {
        if (!this.uid) return [];
        try {
            const querySnapshot = await this.db.collection("accounts")
                                                .where("uid", "==", this.uid)
                                                .get();
            const accounts = [];
            querySnapshot.forEach((doc) => {
                accounts.push({ id: doc.id, ...doc.data() });
            });
            return accounts;
        } catch (error) {
            console.error("Error getting accounts:", error);
            throw error;
        }
    },
    
    // UTILS
    async ensureDefaultAccount() {
        const accounts = await this.getAllAccounts();
        if (accounts.length === 0 && this.uid) {
            await this.addAccount({
                name: "Wallet",
                type: "wallet",
                balance: 0,
                bank: null
            });
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DB;
}
