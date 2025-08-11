// Global variables for Firebase instances and app data
let firebaseApp;
let firebaseAuth;
let firebaseDb;
let currentUserId = null; // Stores Firebase User ID
let currentDisplayName = "User"; // Stores user's chosen display name
let transactions = [];
let budgets = [];
let goals = [];
let expenseChart = null;
let incomeExpenseChart = null;

// --- Firebase Initialization and Authentication Setup ---

// This code runs after the DOM is loaded and Firebase SDKs are imported
document.addEventListener('DOMContentLoaded', function() {
    // Access Firebase instances made available by the <script type="module"> in index.html
    firebaseApp = window.firebaseApp;
    firebaseAuth = window.firebaseAuth;
    firebaseDb = window.firebaseDb;
    const initialAuthToken = window.initialAuthToken;
    const appId = window.appId; // Access the global appId

    // Listen for authentication state changes
    window.onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
            // User is signed in.
            currentUserId = user.uid;
            // Fetch display name from Firestore or use email if not set
            const userDocRef = window.doc(firebaseDb, `artifacts/${appId}/users/${currentUserId}/data/profile`);
            const userDocSnap = await window.getDoc(userDocRef);
            if (userDocSnap.exists()) {
                currentDisplayName = userDocSnap.data().displayName || user.email;
            } else {
                currentDisplayName = user.email || "User";
            }
            showApp();
        } else {
            // User is signed out.
            currentUserId = null;
            currentDisplayName = "User";
            showLoginScreen();

            // Attempt anonymous sign-in if in Canvas environment and token is available
            if (initialAuthToken) {
                try {
                    await window.signInWithCustomToken(firebaseAuth, initialAuthToken);
                    console.log("Signed in anonymously with custom token.");
                } catch (error) {
                    console.error("Error signing in anonymously with custom token:", error);
                    // Fallback to anonymous sign-in if custom token fails or is not provided
                    try {
                        await window.signInAnonymously(firebaseAuth);
                        console.log("Signed in anonymously.");
                    } catch (anonError) {
                        console.error("Error signing in anonymously:", anonError);
                        showPopup("Authentication failed. Please try again.", "error");
                    }
                }
            } else {
                // Regular anonymous sign-in for non-Canvas environments or if token is absent
                try {
                    await window.signInAnonymously(firebaseAuth);
                    console.log("Signed in anonymously.");
                } catch (anonError) {
                    console.error("Error signing in anonymously:", anonError);
                    showPopup("Authentication failed. Please try again.", "error");
                }
            }
        }
    });
});

// --- Authentication Functions ---

/**
 * Displays the signup form and hides the login form.
 */
function showSignup() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
}

/**
 * Displays the login form and hides the signup form.
 */
function showLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
}

/**
 * Shows the login screen and hides the app container.
 */
function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
}

/**
 * Handles user signup using Firebase Email/Password Authentication.
 * Stores user's display name in Firestore.
 */
async function signup() {
    const displayName = document.getElementById('signupUsername').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;

    if (!displayName || !email || !password) {
        showPopup('Please fill in all fields', 'error');
        return;
    }

    try {
        const userCredential = await window.createUserWithEmailAndPassword(firebaseAuth, email, password);
        const user = userCredential.user;

        // Save display name to Firestore
        const userProfileRef = window.doc(firebaseDb, `artifacts/${window.appId}/users/${user.uid}/data/profile`);
        await window.setDoc(userProfileRef, {
            displayName: displayName,
            email: email,
            createdAt: new Date().toISOString()
        });

        showPopup('Account created successfully! Please sign in.', 'success');
        showLogin();
    } catch (error) {
        console.error("Signup error:", error);
        let errorMessage = "Failed to create account.";
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = "Email already in use. Try logging in or reset password.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Invalid email address.";
        } else if (error.code === 'auth/weak-password') {
            errorMessage = "Password is too weak (min 6 characters).";
        }
        showPopup(errorMessage, 'error');
    }
}

/**
 * Handles user login using Firebase Email/Password Authentication.
 */
async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showPopup('Please enter email and password', 'error');
        return;
    }

    try {
        await window.signInWithEmailAndPassword(firebaseAuth, email, password);
        // onAuthStateChanged listener will handle showing the app
        showPopup('Logged in successfully!', 'success');
    } catch (error) {
        console.error("Login error:", error);
        let errorMessage = "Login failed. Invalid credentials.";
        if (error.code === 'auth/invalid-email' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = "Invalid email or password.";
        }
        showPopup(errorMessage, 'error');
    }
}

/**
 * Logs out the current user using Firebase signOut.
 */
async function logout() {
    try {
        await window.signOut(firebaseAuth);
        // onAuthStateChanged listener will handle showing login screen
        showPopup('Logged out successfully!', 'success');
    } catch (error) {
        console.error("Logout error:", error);
        showPopup("Failed to log out. Please try again.", "error");
    }
}

/**
 * Displays the main application interface after successful login.
 * Sets up Firestore real-time listeners for user data.
 */
function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('currentUser').textContent = currentDisplayName;

    // Clear previous data and listeners to avoid duplicates if user logs out/in
    transactions = [];
    budgets = [];
    goals = [];
    if (expenseChart) expenseChart.destroy();
    if (incomeExpenseChart) incomeExpenseChart.destroy();

    // Set up real-time listeners for user-specific data
    setupFirestoreListeners();

    // Initial UI updates (data will be populated by listeners)
    updateDashboard();
    updateTransactionsList();
    updateBudgetsList();
    updateGoalsList();
    
    // Initialize charts with a slight delay to ensure DOM is ready
    setTimeout(() => {
        initializeCharts();
    }, 100);
}

// --- Firestore Data Listeners ---

/**
 * Sets up real-time Firestore listeners for transactions, budgets, and goals.
 * Data changes in the database will automatically update the local arrays and UI.
 */
function setupFirestoreListeners() {
    if (!currentUserId) {
        console.warn("No authenticated user to set up listeners for.");
        return;
    }

    const userBaseRef = `artifacts/${window.appId}/users/${currentUserId}/data`;

    // Transactions Listener
    window.onSnapshot(window.collection(firebaseDb, `${userBaseRef}/transactions`), (snapshot) => {
        const fetchedTransactions = [];
        snapshot.forEach(doc => {
            fetchedTransactions.push({ id: doc.id, ...doc.data() });
        });
        // Sort by date (most recent first) and then by ID (for stable order if dates are same)
        transactions = fetchedTransactions.sort((a, b) => {
            if (a.date < b.date) return 1;
            if (a.date > b.date) return -1;
            return b.id - a.id; // Secondary sort for stable order
        });
        console.log("Transactions updated:", transactions);
        updateDashboard();
        updateTransactionsList();
        refreshCharts();
    }, (error) => {
        console.error("Error fetching transactions:", error);
        showPopup("Failed to load transactions.", "error");
    });

    // Budgets Listener
    window.onSnapshot(window.collection(firebaseDb, `${userBaseRef}/budgets`), (snapshot) => {
        const fetchedBudgets = [];
        snapshot.forEach(doc => {
            fetchedBudgets.push({ id: doc.id, ...doc.data() });
        });
        budgets = fetchedBudgets;
        console.log("Budgets updated:", budgets);
        updateBudgetsList();
    }, (error) => {
        console.error("Error fetching budgets:", error);
        showPopup("Failed to load budgets.", "error");
    });

    // Goals Listener
    window.onSnapshot(window.collection(firebaseDb, `${userBaseRef}/goals`), (snapshot) => {
        const fetchedGoals = [];
        snapshot.forEach(doc => {
            fetchedGoals.push({ id: doc.id, ...doc.data() });
        });
        goals = fetchedGoals;
        console.log("Goals updated:", goals);
        updateGoalsList();
    }, (error) => {
        console.error("Error fetching goals:", error);
        showPopup("Failed to load goals.", "error");
    });
}

// --- Data Operations (CRUD) with Firestore ---

/**
 * Adds a new quick transaction (income or expense) to Firestore.
 */
async function addQuickTransaction() {
    if (!currentUserId) { showPopup("Please log in to add transactions.", "error"); return; }

    const description = document.getElementById('quickDescription').value;
    const amount = parseFloat(document.getElementById('quickAmount').value);
    const type = document.getElementById('quickType').value;
    const category = document.getElementById('quickCategory').value;

    if (!description || isNaN(amount) || amount <= 0) {
        showPopup('Please enter a valid description and amount.', 'error');
        return;
    }

    const transactionData = {
        description: description,
        amount: amount,
        type: type,
        category: category,
        date: new Date().toISOString().split('T')[0],
        timestamp: window.serverTimestamp ? window.serverTimestamp() : new Date() // Use server timestamp if available
    };

    try {
        await window.addDoc(window.collection(firebaseDb, `artifacts/${window.appId}/users/${currentUserId}/data/transactions`), transactionData);
        showPopup(`Transaction '${description}' added successfully!`, 'success');
        // Clear form fields after successful add
        document.getElementById('quickDescription').value = '';
        document.getElementById('quickAmount').value = '';
    } catch (error) {
        console.error("Error adding transaction:", error);
        showPopup("Failed to add transaction.", "error");
    }
}

/**
 * Deletes a transaction from Firestore by its ID.
 * @param {string} id - The Firestore document ID of the transaction to delete.
 */
async function deleteTransaction(id) {
    if (!currentUserId) { showPopup("Please log in to delete transactions.", "error"); return; }
    
    try {
        await window.deleteDoc(window.doc(firebaseDb, `artifacts/${window.appId}/users/${currentUserId}/data/transactions`, id));
        showPopup('Transaction deleted successfully.', 'success');
    } catch (error) {
        console.error("Error deleting transaction:", error);
        showPopup("Failed to delete transaction.", "error");
    }
}

/**
 * Adds or updates a monthly budget for a specific category in Firestore.
 */
async function addBudget() {
    if (!currentUserId) { showPopup("Please log in to set budgets.", "error"); return; }

    const category = document.getElementById('budgetCategory').value;
    const amount = parseFloat(document.getElementById('budgetAmount').value);

    if (isNaN(amount) || amount <= 0) {
        showPopup('Please enter a valid budget amount.', 'error');
        return;
    }

    const budgetData = {
        category: category,
        amount: amount,
        month: new Date().getMonth(),
        year: new Date().getFullYear(),
        updatedAt: window.serverTimestamp ? window.serverTimestamp() : new Date()
    };

    try {
        // Use setDoc with a specific ID to overwrite if budget for category already exists
        // For simplicity, we'll use category name as doc ID (or a hash of it)
        // A better approach might be to query and then update/add. For now, we'll use category as ID.
        const budgetDocRef = window.doc(firebaseDb, `artifacts/${window.appId}/users/${currentUserId}/data/budgets`, category);
        await window.setDoc(budgetDocRef, budgetData);
        showPopup(`Budget for ${category} set to $${amount.toFixed(2)} successfully!`, 'success');
        document.getElementById('budgetAmount').value = '';
    } catch (error) {
        console.error("Error setting budget:", error);
        showPopup("Failed to set budget.", "error");
    }
}

/**
 * Deletes a budget from Firestore by its ID (which is the category name).
 * @param {string} id - The Firestore document ID (category name) of the budget to delete.
 */
async function deleteBudget(id) {
    if (!currentUserId) { showPopup("Please log in to delete budgets.", "error"); return; }
    
    try {
        await window.deleteDoc(window.doc(firebaseDb, `artifacts/${window.appId}/users/${currentUserId}/data/budgets`, id));
        showPopup('Budget deleted successfully.', 'success');
    } catch (error) {
        console.error("Error deleting budget:", error);
        showPopup("Failed to delete budget.", "error");
    }
}

/**
 * Adds a new savings goal to Firestore.
 */
async function addGoal() {
    if (!currentUserId) { showPopup("Please log in to create goals.", "error"); return; }

    const name = document.getElementById('goalName').value;
    const amount = parseFloat(document.getElementById('goalAmount').value);
    const deadline = document.getElementById('goalDeadline').value;

    if (!name || isNaN(amount) || amount <= 0 || !deadline) {
        showPopup('Please fill in all goal fields correctly.', 'error');
        return;
    }

    const goalData = {
        name: name,
        targetAmount: amount,
        currentAmount: 0, // Starts at 0
        deadline: deadline,
        createdAt: new Date().toISOString(),
        updatedAt: window.serverTimestamp ? window.serverTimestamp() : new Date()
    };

    try {
        await window.addDoc(window.collection(firebaseDb, `artifacts/${window.appId}/users/${currentUserId}/data/goals`), goalData);
        showPopup(`Savings goal for '${name}' created successfully!`, 'success');
        document.getElementById('goalName').value = '';
        document.getElementById('goalAmount').value = '';
        document.getElementById('goalDeadline').value = '';
    } catch (error) {
        console.error("Error adding goal:", error);
        showPopup("Failed to create goal.", "error");
    }
}

/**
 * Deletes a savings goal from Firestore by its ID.
 * @param {string} id - The Firestore document ID of the goal to delete.
 */
async function deleteGoal(id) {
    if (!currentUserId) { showPopup("Please log in to delete goals.", "error"); return; }
    
    try {
        await window.deleteDoc(window.doc(firebaseDb, `artifacts/${window.appId}/users/${currentUserId}/data/goals`, id));
        showPopup('Goal deleted successfully.', 'success');
    } catch (error) {
        console.error("Error deleting goal:", error);
        showPopup("Failed to delete goal.", "error");
    }
}

/**
 * Adds an amount to a specific savings goal in Firestore.
 * @param {string} id - The Firestore document ID of the goal to update.
 * @param {number} amount - The amount to add to the goal.
 */
async function addToGoal(id, amount) {
    if (!currentUserId) { showPopup("Please log in to update goals.", "error"); return; }

    if (isNaN(amount) || amount <= 0) {
        showPopup('Please enter a valid amount to add to the goal.', 'error');
        return;
    }

    try {
        const goalRef = window.doc(firebaseDb, `artifacts/${window.appId}/users/${currentUserId}/data/goals`, id);
        const goalSnap = await window.getDoc(goalRef);

        if (goalSnap.exists()) {
            const currentAmount = goalSnap.data().currentAmount || 0;
            await window.updateDoc(goalRef, {
                currentAmount: currentAmount + amount,
                updatedAt: window.serverTimestamp ? window.serverTimestamp() : new Date()
            });
            showPopup(`Added $${amount.toFixed(2)} to goal '${goalSnap.data().name}'.`, 'success');
        } else {
            showPopup('Goal not found.', 'error');
        }
    } catch (error) {
        console.error("Error adding to goal:", error);
        showPopup("Failed to update goal.", "error");
    }
}

/**
 * Adds a new income transaction to Firestore.
 */
async function addIncome() {
    if (!currentUserId) { showPopup("Please log in to add income.", "error"); return; }

    const amount = parseFloat(document.getElementById('incomeAmount').value);
    const source = document.getElementById('incomeSource').value;

    if (isNaN(amount) || amount <= 0) {
        showPopup('Please enter a valid income amount.', 'error');
        return;
    }

    if (!source) {
        showPopup('Please specify the income source.', 'error');
        return;
    }

    const transactionData = {
        description: source,
        amount: amount,
        type: 'income',
        category: 'Income', // Default category for income
        date: new Date().toISOString().split('T')[0],
        timestamp: window.serverTimestamp ? window.serverTimestamp() : new Date()
    };

    try {
        await window.addDoc(window.collection(firebaseDb, `artifacts/${window.appId}/users/${currentUserId}/data/transactions`), transactionData);
        showPopup(`Income of $${amount.toFixed(2)} added successfully!`, 'success');
        document.getElementById('incomeAmount').value = '';
        document.getElementById('incomeSource').value = '';
    } catch (error) {
        console.error("Error adding income:", error);
        showPopup("Failed to add income.", "error");
    }
}

// --- UI Update Functions (mostly triggered by Firestore listeners now) ---

/**
 * Updates the dashboard with current balance, income, and expenses.
 */
function updateDashboard() {
    const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    const balance = totalIncome - totalExpenses;

    document.getElementById('totalBalance').textContent = `$${balance.toFixed(2)}`;
    document.getElementById('totalIncome').textContent = `$${totalIncome.toFixed(2)}`;
    document.getElementById('totalExpenses').textContent = `$${totalExpenses.toFixed(2)}`;

    updateRecentTransactions();
}

/**
 * Populates the "Recent Transactions" list on the dashboard.
 */
function updateRecentTransactions() {
    const recentContainer = document.getElementById('recentTransactions');
    const recent = transactions.slice(0, 5); // Show only the 5 most recent

    if (recent.length === 0) {
        recentContainer.innerHTML = '<p style="text-align: center; color: #bdc3c7; padding: 20px;">No transactions yet. Add your first transaction above!</p>';
        return;
    }

    recentContainer.innerHTML = recent.map(transaction => `
        <div class="transaction-item">
            <div class="transaction-info">
                <h4>${transaction.description}</h4>
                <p>${transaction.category} • ${transaction.date}</p>
            </div>
            <div class="transaction-amount ${transaction.type}">
                ${transaction.type === 'income' ? '+' : '-'}$${transaction.amount.toFixed(2)}
                <button class="delete-btn" onclick="deleteTransaction('${transaction.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

/**
 * Populates the "All Transactions" list.
 */
function updateTransactionsList() {
    const container = document.getElementById('allTransactions');
    
    if (transactions.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #bdc3c7; padding: 20px;">No transactions yet.</p>';
        return;
    }

    container.innerHTML = transactions.map(transaction => `
        <div class="transaction-item">
            <div class="transaction-info">
                <h4>${transaction.description}</h4>
                <p>${transaction.category} • ${transaction.date}</p>
            </div>
            <div class="transaction-amount ${transaction.type}">
                ${transaction.type === 'income' ? '+' : '-'}$${transaction.amount.toFixed(2)}
                <button class="delete-btn" onclick="deleteTransaction('${transaction.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

/**
 * Populates the "Monthly Budgets" list and calculates progress.
 */
function updateBudgetsList() {
    const container = document.getElementById('budgetsList');

    if (budgets.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #bdc3c7; padding: 20px;">No budgets set yet.</p>';
        return;
    }

    container.innerHTML = budgets.map(budget => {
        // Calculate spent amount for the budget's category across all expenses
        const spent = transactions
            .filter(t => t.type === 'expense' && t.category === budget.category)
            .reduce((sum, t) => sum + t.amount, 0);

        const percentage = (spent / budget.amount) * 100;
        const remaining = budget.amount - spent;

        return `
            <div class="goal-card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3>${budget.category}</h3>
                    <button class="delete-btn" onclick="deleteBudget('${budget.id}')">Delete</button>
                </div>
                <p>Budget: $${budget.amount.toFixed(2)} | Spent: $${spent.toFixed(2)} | Remaining: $${remaining.toFixed(2)}</p>
                <div class="goal-progress">
                    <div class="goal-progress-bar" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <p style="font-size: 14px; color: ${percentage > 100 ? '#e74c3c' : '#bdc3c7'};">
                    ${percentage.toFixed(1)}% used
                </p>
            </div>
        `;
    }).join('');
}

/**
 * Populates the "Savings Goals" list and calculates progress.
 */
function updateGoalsList() {
    const container = document.getElementById('goalsList');

    if (goals.length === 0) {
        container.innerHTML = '<div class="section-card"><p style="text-align: center; color: #bdc3c7;">No goals set yet.</p></div>';
        return;
    }

    container.innerHTML = goals.map(goal => {
        const percentage = (goal.currentAmount / goal.targetAmount) * 100;
        const remaining = goal.targetAmount - goal.currentAmount;

        return `
            <div class="goal-card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3>${goal.name}</h3>
                    <button class="delete-btn" onclick="deleteGoal('${goal.id}')">Delete</button>
                </div>
                <p>Target: $${goal.targetAmount.toFixed(2)} | Saved: $${goal.currentAmount.toFixed(2)}</p>
                <p>Deadline: ${goal.deadline}</p>
                <div class="goal-progress">
                    <div class="goal-progress-bar" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <p style="font-size: 14px; color: #bdc3c7;">${percentage.toFixed(1)}% complete</p>
                <div style="margin-top: 15px;">
                    <input type="number" id="goalAdd${goal.id}" placeholder="Add amount" step="0.01" style="padding: 8px; border: 1px solid #34495e; border-radius: 6px; margin-right: 10px; background-color: #1a1a2e; color: #ecf0f1;">
                    <button class="btn-primary" style="padding: 8px 16px; font-size: 14px;" onclick="addToGoal('${goal.id}', parseFloat(document.getElementById('goalAdd${goal.id}').value) || 0); document.getElementById('goalAdd${goal.id}').value = '';">Add</button>
                </div>
            </div>
        `;
    }).join('');
}

// --- Chart Functions ---

/**
 * Initializes both expense and income/expense charts.
 */
function initializeCharts() {
    console.log('Initializing charts...');
    createExpenseChart();
    createIncomeExpenseChart();
}

/**
 * Destroys existing charts and recreates them to reflect updated data.
 */
function refreshCharts() {
    console.log('Refreshing charts...');
    if (expenseChart) {
        expenseChart.destroy();
        expenseChart = null;
    }
    if (incomeExpenseChart) {
        incomeExpenseChart.destroy();
        incomeExpenseChart = null;
    }
    
    // Recreate charts after a short delay
    setTimeout(() => {
        createExpenseChart();
        createIncomeExpenseChart();
    }, 100);
}

/**
 * Creates or updates the Doughnut chart for expense categories.
 */
function createExpenseChart() {
    const canvas = document.getElementById('expenseChart');
    if (!canvas) {
        console.error('Expense chart canvas not found');
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Could not get 2D context for expense chart');
        return;
    }

    // Calculate expenses by category
    const expensesByCategory = {};
    transactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
            expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
        });

    let labels = Object.keys(expensesByCategory);
    let data = Object.values(expensesByCategory);

    // Use sample data if no expenses exist for better visualization initially
    if (labels.length === 0) {
        labels = ['Food', 'Transportation', 'Entertainment', 'Bills', 'Shopping'];
        data = [450, 280, 150, 600, 320]; // Sample data
    }

    try {
        expenseChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#9b59b6', '#8e44ad', '#6c5ce7', '#e74c3c',
                        '#3498db', '#1abc9c', '#f1c40f', '#95a5a6'
                    ],
                    borderWidth: 3,
                    borderColor: '#2c2c4a', /* Card background color */
                    hoverBorderWidth: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: {
                                size: 14,
                                weight: '500'
                            },
                            color: '#ecf0f1' /* Light text for legend */
                        }
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#9b59b6',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: $${context.parsed.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '60%',
                animation: {
                    animateRotate: true,
                    duration: 1000
                }
            }
        });
        console.log('Expense chart created successfully');
    } catch (error) {
        console.error('Error creating expense chart:', error);
    }
}

/**
 * Creates or updates the Line chart for income vs. expenses over time.
 */
function createIncomeExpenseChart() {
    const canvas = document.getElementById('incomeExpenseChart');
    if (!canvas) {
        console.error('Income expense chart canvas not found');
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Could not get 2D context for income expense chart');
        return;
    }

    // Prepare data for the last 6 months
    const months = [];
    const incomeData = [];
    const expenseData = [];

    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        months.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
        
        const monthIncome = transactions
            .filter(t => t.type === 'income' && t.date.startsWith(monthYear))
            .reduce((sum, t) => sum + t.amount, 0);
        
        const monthExpense = transactions
            .filter(t => t.type === 'expense' && t.date.startsWith(monthYear))
            .reduce((sum, t) => sum + t.amount, 0);
        
        incomeData.push(monthIncome);
        expenseData.push(monthExpense);
    }

    // Use sample data if no transactions exist for better visualization initially
    if (incomeData.every(val => val === 0) && expenseData.every(val => val === 0)) {
        const sampleIncome = [2800, 3200, 2900, 3100, 3000, 3300];
        const sampleExpenses = [2200, 2400, 2100, 2600, 2300, 2500];
        incomeData.splice(0, 6, ...sampleIncome);
        expenseData.splice(0, 6, ...sampleExpenses);
    }

    try {
        incomeExpenseChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Income',
                    borderColor: '#2ecc71', /* Brighter green */
                    backgroundColor: 'rgba(46, 204, 113, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#2ecc71',
                    pointBorderColor: '#2c2c4a', /* Card background color */
                    pointBorderWidth: 3,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    borderWidth: 4,
                    data: incomeData
                }, {
                    label: 'Expenses',
                    data: expenseData,
                    borderColor: '#e74c3c', /* Brighter red */
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#e74c3c',
                    pointBorderColor: '#2c2c4a', /* Card background color */
                    pointBorderWidth: 3,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    borderWidth: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: {
                                size: 14,
                                weight: '600'
                            },
                            color: '#ecf0f1' /* Light text for legend */
                        }
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#9b59b6',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        display: true,
                        grid: {
                            display: true,
                            color: 'rgba(255,255,255,0.1)', /* Lighter grid lines */
                            drawBorder: true,
                            lineWidth: 1
                        },
                        ticks: {
                            display: true,
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            },
                            font: {
                                size: 12
                            },
                            color: '#bdc3c7' /* Light grey tick labels */
                        },
                        title: {
                            display: true,
                            text: 'Amount ($)',
                            font: {
                                size: 14,
                                weight: '600'
                            },
                            color: '#ecf0f1' /* Light text for axis title */
                        }
                    },
                    x: {
                        display: true,
                        grid: {
                            display: true,
                            color: 'rgba(255,255,255,0.1)', /* Lighter grid lines */
                            drawBorder: true,
                            lineWidth: 1
                        },
                        ticks: {
                            display: true,
                            font: {
                                size: 12
                            },
                            color: '#bdc3c7' /* Light grey tick labels */
                        },
                        title: {
                            display: true,
                            text: 'Month',
                            font: {
                                size: 14,
                                weight: '600'
                            },
                            color: '#ecf0f1' /* Light text for axis title */
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                }
            }
        });
        console.log('Income expense chart created successfully');
    } catch (error) {
        console.error('Error creating income expense chart:', error);
    }
}

// --- Mobile Menu Functions ---

/**
 * Toggles the visibility of the mobile sidebar menu and its overlay.
 */
function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    sidebar.classList.toggle('mobile-open');
    
    if (sidebar.classList.contains('mobile-open')) {
        overlay.style.display = 'block';
    } else {
        overlay.style.display = 'none';
    }
}

/**
 * Closes the mobile sidebar menu and its overlay.
 */
function closeMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    sidebar.classList.remove('mobile-open');
    overlay.style.display = 'none';
}

// --- Parallax Effect for Mouse Movement ---
document.addEventListener('mousemove', (e) => {
    // Select only buttons and the sidebar for the parallax effect
    const parallaxElements = document.querySelectorAll('.btn, .btn-secondary, .btn-primary, .logout-btn, .mobile-menu-btn, .sidebar');

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    parallaxElements.forEach(element => {
        // Get the element's position and dimensions relative to the viewport
        const rect = element.getBoundingClientRect();
        const elementCenterX = rect.left + rect.width / 2;
        const elementCenterY = rect.top + rect.height / 2;

        // Calculate distance from mouse to center of the element
        const distanceX = mouseX - elementCenterX;
        const distanceY = mouseY - elementCenterY;

        // Apply a small translation. Adjust the multiplier (e.g., 0.005 to 0.02) for intensity.
        // Smaller multiplier for less movement.
        const intensity = 0.005; // Adjust this value for desired effect strength
        const offsetX = distanceX * intensity; 
        const offsetY = distanceY * intensity; 

        // Apply the transform
        element.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    });
});

// No need for body style manipulation for this type of parallax effect
// document.body.style.width = '100vw';
// document.body.style.height = '100vh';
// document.body.style.overflow = 'hidden';
