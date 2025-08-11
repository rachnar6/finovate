// Global variables to store application data
let currentUser = null;
let transactions = [];
let budgets = [];
let goals = [];
let expenseChart = null;
let incomeExpenseChart = null;

// Initialize app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    checkLoginStatus();
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
 * Handles user signup. Stores user credentials in localStorage.
 */
function signup() {
    const username = document.getElementById('signupUsername').value;
    const password = document.getElementById('signupPassword').value;
    const email = document.getElementById('signupEmail').value;

    if (!username || !password || !email) {
        showPopup('Please fill in all fields', 'error');
        return;
    }

    // Check if user already exists
    const existingUsers = JSON.parse(localStorage.getItem('finovate_users') || '{}');
    if (existingUsers[username]) {
        showPopup('Username already exists', 'error');
        return;
    }

    // Create new user object
    existingUsers[username] = {
        password: password,
        email: email,
        createdAt: new Date().toISOString()
    };

    localStorage.setItem('finovate_users', JSON.stringify(existingUsers));
    showPopup('Account created successfully! Please sign in.', 'success');
    showLogin();
}

/**
 * Handles user login. Authenticates against localStorage.
 */
function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        showPopup('Please enter username and password', 'error');
        return;
    }

    const users = JSON.parse(localStorage.getItem('finovate_users') || '{}');
    if (users[username] && users[username].password === password) {
        currentUser = username;
        localStorage.setItem('finovate_current_user', username);
        showApp();
    } else {
        showPopup('Invalid username or password', 'error');
    }
}

/**
 * Logs out the current user and returns to the login screen.
 */
function logout() {
    currentUser = null;
    localStorage.removeItem('finovate_current_user');
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
    showLogin();
    showPopup('Logged out successfully!', 'success');
}

/**
 * Checks if a user is already logged in from a previous session.
 */
function checkLoginStatus() {
    const savedUser = localStorage.getItem('finovate_current_user');
    if (savedUser) {
        currentUser = savedUser;
        showApp();
    }
}

/**
 * Displays the main application interface after successful login.
 * Loads user data and updates all sections.
 */
function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('currentUser').textContent = currentUser;
    loadUserData();
    updateDashboard();
    updateTransactionsList();
    updateBudgetsList();
    updateGoalsList();
    
    // Initialize charts with a slight delay to ensure DOM elements are rendered
    setTimeout(() => {
        initializeCharts();
    }, 100);
}

// --- Navigation Functions ---

/**
 * Displays the selected content section and updates the active navigation link.
 * @param {string} sectionName - The ID of the section to display.
 * @param {Event} event - The click event object.
 */
function showSection(sectionName, event) {
    if (event) {
        event.preventDefault(); // Prevent default link behavior
    }

    // Hide all content sections
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => section.classList.remove('active'));

    // Show the selected section
    document.getElementById(sectionName).classList.add('active');

    // Update active navigation link styling
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => link.classList.remove('active'));
    if (event) {
        event.target.closest('.nav-link').classList.add('active');
    } else {
        // Fallback if event is not provided (e.g., initial load)
        document.querySelector(`.nav-link[onclick*='${sectionName}']`).classList.add('active');
    }

    // Close mobile menu if open
    closeMobileMenu();

    // Refresh charts when reports section is activated
    if (sectionName === 'reports') {
        setTimeout(() => {
            refreshCharts();
        }, 200);
    }
}

// --- Data Management Functions ---

/**
 * Loads user-specific financial data from localStorage.
 */
function loadUserData() {
    const userKey = `finovate_${currentUser}`;
    const userData = JSON.parse(localStorage.getItem(userKey) || '{}');
    
    transactions = userData.transactions || [];
    budgets = userData.budgets || [];
    goals = userData.goals || [];
}

/**
 * Saves current user's financial data to localStorage.
 */
function saveUserData() {
    const userKey = `finovate_${currentUser}`;
    const userData = {
        transactions: transactions,
        budgets: budgets,
        goals: goals
    };
    localStorage.setItem(userKey, JSON.stringify(userData));
}

/**
 * Displays a temporary notification pop-up.
 * @param {string} message - The message to display.
 * @param {string} type - 'success' or 'error' to control styling.
 */
function showPopup(message, type = 'success') {
    const popup = document.getElementById('popupNotification');
    const messageElement = document.getElementById('popupMessage');
    
    messageElement.textContent = message;
    popup.classList.remove('success', 'error'); // Remove previous types
    popup.classList.add(type, 'show'); // Add current type and show class

    setTimeout(() => {
        popup.classList.remove('show'); // Hide after 3 seconds
    }, 3000); 
}

// --- Transaction Functions ---

/**
 * Adds a new quick transaction (income or expense).
 */
function addQuickTransaction() {
    const description = document.getElementById('quickDescription').value;
    const amount = parseFloat(document.getElementById('quickAmount').value);
    const type = document.getElementById('quickType').value;
    const category = document.getElementById('quickCategory').value;

    if (!description || isNaN(amount) || amount <= 0) {
        showPopup('Please enter a valid description and amount.', 'error');
        return;
    }

    const transaction = {
        id: Date.now(), // Unique ID for the transaction
        description: description,
        amount: amount,
        type: type,
        category: category,
        date: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    };

    transactions.unshift(transaction); // Add to the beginning of the array
    saveUserData();
    updateDashboard();
    updateTransactionsList();
    refreshCharts();

    // Clear form fields
    document.getElementById('quickDescription').value = '';
    document.getElementById('quickAmount').value = '';

    showPopup(`Transaction '${description}' added successfully!`, 'success');
}

/**
 * Deletes a transaction by its ID.
 * @param {number} id - The ID of the transaction to delete.
 */
function deleteTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    saveUserData();
    updateDashboard();
    updateTransactionsList();
    refreshCharts();
    showPopup('Transaction deleted successfully.', 'success');
}

// --- Budget Functions ---

/**
 * Adds or updates a monthly budget for a specific category.
 */
function addBudget() {
    const category = document.getElementById('budgetCategory').value;
    const amount = parseFloat(document.getElementById('budgetAmount').value);

    if (isNaN(amount) || amount <= 0) {
        showPopup('Please enter a valid budget amount.', 'error');
        return;
    }

    // Remove existing budget for this category to allow updates
    budgets = budgets.filter(b => b.category !== category);

    const budget = {
        id: Date.now(),
        category: category,
        amount: amount,
        month: new Date().getMonth(),
        year: new Date().getFullYear()
    };

    budgets.push(budget);
    saveUserData();
    updateBudgetsList();

    // Clear form field
    document.getElementById('budgetAmount').value = '';

    showPopup(`Budget for ${category} set to $${amount.toFixed(2)} successfully!`, 'success');
}

/**
 * Deletes a budget by its ID.
 * @param {number} id - The ID of the budget to delete.
 */
function deleteBudget(id) {
    budgets = budgets.filter(b => b.id !== id);
    saveUserData();
    updateBudgetsList();
    showPopup('Budget deleted successfully.', 'success');
}

// --- Goal Functions ---

/**
 * Adds a new savings goal.
 */
function addGoal() {
    const name = document.getElementById('goalName').value;
    const amount = parseFloat(document.getElementById('goalAmount').value);
    const deadline = document.getElementById('goalDeadline').value;

    if (!name || isNaN(amount) || amount <= 0 || !deadline) {
        showPopup('Please fill in all goal fields correctly.', 'error');
        return;
    }

    const goal = {
        id: Date.now(),
        name: name,
        targetAmount: amount,
        currentAmount: 0, // Starts at 0
        deadline: deadline,
        createdAt: new Date().toISOString()
    };

    goals.push(goal);
    saveUserData();
    updateGoalsList();

    // Clear form fields
    document.getElementById('goalName').value = '';
    document.getElementById('goalAmount').value = '';
    document.getElementById('goalDeadline').value = '';

    showPopup(`Savings goal for '${name}' created successfully!`, 'success');
}

/**
 * Deletes a savings goal by its ID.
 * @param {number} id - The ID of the goal to delete.
 */
function deleteGoal(id) {
    goals = goals.filter(g => g.id !== id);
    saveUserData();
    updateGoalsList();
    showPopup('Goal deleted successfully.', 'success');
}

/**
 * Adds an amount to a specific savings goal.
 * @param {number} id - The ID of the goal to update.
 * @param {number} amount - The amount to add to the goal.
 */
function addToGoal(id, amount) {
    if (isNaN(amount) || amount <= 0) {
        showPopup('Please enter a valid amount to add to the goal.', 'error');
        return;
    }

    const goal = goals.find(g => g.id === id);
    if (goal) {
        goal.currentAmount += amount;
        saveUserData();
        updateGoalsList();
        showPopup(`Added $${amount.toFixed(2)} to goal '${goal.name}'.`, 'success');
    } else {
        showPopup('Goal not found.', 'error');
    }
}

// --- Income Addition Function (Specific to Dashboard) ---

/**
 * Adds a new income transaction.
 */
function addIncome() {
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

    const transaction = {
        id: Date.now(),
        description: source,
        amount: amount,
        type: 'income',
        category: 'Income', // Default category for income
        date: new Date().toISOString().split('T')[0]
    };

    transactions.unshift(transaction);
    saveUserData();
    updateDashboard();
    updateTransactionsList();
    refreshCharts();

    // Clear form fields
    document.getElementById('incomeAmount').value = '';
    document.getElementById('incomeSource').value = '';

    showPopup(`Income of $${amount.toFixed(2)} added successfully!`, 'success');
}

// --- UI Update Functions ---

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
        recentContainer.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">No transactions yet. Add your first transaction above!</p>';
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
                <button class="delete-btn" onclick="deleteTransaction(${transaction.id})">Delete</button>
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
        container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">No transactions yet.</p>';
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
                <button class="delete-btn" onclick="deleteTransaction(${transaction.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

/**
 * Populates the "Monthly Budgets" list and calculates progress.
 */
function updateBudgetsList() {
    const container = document.getElementById('budgetsList');
    // Note: Current month/year filtering is not applied here,
    // budgets are shown regardless of the month they were set for simplicity.
    // You might want to enhance this to show only current month's budgets.

    if (budgets.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">No budgets set yet.</p>';
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
                    <button class="delete-btn" onclick="deleteBudget(${budget.id})">Delete</button>
                </div>
                <p>Budget: $${budget.amount.toFixed(2)} | Spent: $${spent.toFixed(2)} | Remaining: $${remaining.toFixed(2)}</p>
                <div class="goal-progress">
                    <div class="goal-progress-bar" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <p style="font-size: 14px; color: ${percentage > 100 ? '#ef4444' : '#64748b'};">
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
        container.innerHTML = '<div class="section-card"><p style="text-align: center; color: #64748b;">No goals set yet.</p></div>';
        return;
    }

    container.innerHTML = goals.map(goal => {
        const percentage = (goal.currentAmount / goal.targetAmount) * 100;
        const remaining = goal.targetAmount - goal.currentAmount;

        return `
            <div class="goal-card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3>${goal.name}</h3>
                    <button class="delete-btn" onclick="deleteGoal(${goal.id})">Delete</button>
                </div>
                <p>Target: $${goal.targetAmount.toFixed(2)} | Saved: $${goal.currentAmount.toFixed(2)}</p>
                <p>Deadline: ${goal.deadline}</p>
                <div class="goal-progress">
                    <div class="goal-progress-bar" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <p style="font-size: 14px; color: #64748b;">${percentage.toFixed(1)}% complete</p>
                <div style="margin-top: 15px;">
                    <input type="number" id="goalAdd${goal.id}" placeholder="Add amount" step="0.01" style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; margin-right: 10px;">
                    <button class="btn-primary" style="padding: 8px 16px; font-size: 14px;" onclick="addToGoal(${goal.id}, parseFloat(document.getElementById('goalAdd${goal.id}').value) || 0); document.getElementById('goalAdd${goal.id}').value = '';">Add</button>
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
                        '#667eea', '#764ba2', '#f093fb', '#f5576c',
                        '#4facfe', '#00f2fe', '#43e97b', '#38f9d7'
                    ],
                    borderWidth: 3,
                    borderColor: '#ffffff',
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
                            }
                        }
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#667eea',
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
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 3,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    borderWidth: 4,
                    data: incomeData
                }, {
                    label: 'Expenses',
                    data: expenseData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#ffffff',
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
                            }
                        }
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#667eea',
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
                            color: 'rgba(0,0,0,0.1)',
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
                            color: '#64748b'
                        },
                        title: {
                            display: true,
                            text: 'Amount ($)',
                            font: {
                                size: 14,
                                weight: '600'
                            },
                            color: '#1e293b'
                        }
                    },
                    x: {
                        display: true,
                        grid: {
                            display: true,
                            color: 'rgba(0,0,0,0.1)',
                            drawBorder: true,
                            lineWidth: 1
                        },
                        ticks: {
                            display: true,
                            font: {
                                size: 12
                            },
                            color: '#64748b'
                        },
                        title: {
                            display: true,
                            text: 'Month',
                            font: {
                                size: 14,
                                weight: '600'
                            },
                            color: '#1e293b'
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
    // Select elements that should have the parallax effect
    const parallaxElements = document.querySelectorAll('.login-form, .stat-card, .section-card, .goal-card');

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    parallaxElements.forEach(element => {
        // Calculate offset relative to the center of the element itself
        // This makes the movement relative to the element's position, not the whole window
        const rect = element.getBoundingClientRect();
        const elementCenterX = rect.left + rect.width / 2;
        const elementCenterY = rect.top + rect.height / 2;

        const offsetX = (mouseX - elementCenterX) * 0.01; // Adjust multiplier for intensity
        const offsetY = (mouseY - elementCenterY) * 0.01; // Adjust multiplier for intensity

        element.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    });
});

// Removed body style manipulation as it's now handled by CSS and individual elements
// document.body.style.width = '100vw';
// document.body.style.height = '100vh';
// document.body.style.overflow = 'hidden';
