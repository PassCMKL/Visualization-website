// Main JavaScript for Personal Finance Dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Show loading overlay
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.style.display = 'flex';
    
    // Load transaction data
    loadTransactionData()
        .then(data => {
            // Store data globally for filtering
            window.transactionData = data;
            
            // Initial data processing
            processData(data);
            
            // Add event listener for time period filter
            document.getElementById('date-range').addEventListener('change', function() {
                // Show loading indicator
                loadingOverlay.style.display = 'flex';
                
                // Small delay to allow UI to update
                setTimeout(() => {
                    const filteredData = filterDataByTimeRange(window.transactionData, this.value);
                    processData(filteredData);
                    
                    // Hide loading indicator
                    loadingOverlay.style.display = 'none';
                }, 300);
            });
            
            // Set up refresh button
            document.getElementById('refresh-data').addEventListener('click', function() {
                this.classList.add('rotating');
                loadingOverlay.style.display = 'flex';
                
                setTimeout(() => {
                    processData(window.transactionData);
                    this.classList.remove('rotating');
                    loadingOverlay.style.display = 'none';
                }, 800);
            });
            
            // Set up download buttons
            setupDownloadButtons();
            
            // Hide loading overlay
            loadingOverlay.style.display = 'none';
        })
        .catch(error => {
            console.error("Error loading transaction data:", error);
            displayErrorMessage("Error loading data. Please try again later.");
            loadingOverlay.style.display = 'none';
        });
});

// Function to load transaction data
async function loadTransactionData() {
    try {
        const response = await fetch('data/transactions.json');
        const data = await response.json();
        return data.transactions;
    } catch (error) {
        console.error("Error fetching transaction data:", error);
        throw error;
    }
}

// Function to filter data by time range
function filterDataByTimeRange(data, timeRange) {
    const today = new Date();
    let startDate = new Date();
    
    // Set the start date based on the selected time range
    switch(timeRange) {
        case '1m': // Last month
            startDate.setMonth(today.getMonth() - 1);
            break;
        case '3m': // Last 3 months
            startDate.setMonth(today.getMonth() - 3);
            break;
        case '6m': // Last 6 months
            startDate.setMonth(today.getMonth() - 6);
            break;
        case '1y': // Last year
            startDate.setFullYear(today.getFullYear() - 1);
            break;
        case 'all': // All time
        default:
            startDate = new Date(0); // Beginning of time
            break;
    }
    
    // Filter transactions after the start date
    return data.filter(transaction => new Date(transaction.date) >= startDate);
}

// Function to process and display data
function processData(data) {
    // Calculate comparison with previous period for trends
    const previousPeriodData = calculatePreviousPeriodData(data);
    
    // Update summary metrics
    updateSummaryMetrics(data, previousPeriodData);
    
    // Create visualizations
    createBarChart(data, 'bar-chart');
    createSpendingMap(data, 'spending-map');
    createWordCloud(data, 'word-cloud');
    
    // Update recent transactions list
    updateRecentTransactions(data);
}

// Function to calculate data for the previous period (for trend comparison)
function calculatePreviousPeriodData(currentData) {
    // Get current date range
    const dates = currentData.map(t => new Date(t.date));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    // Calculate the duration of the current period in milliseconds
    const currentPeriodDuration = maxDate - minDate;
    
    // Calculate the previous period date range
    const previousPeriodEnd = new Date(minDate);
    const previousPeriodStart = new Date(minDate);
    previousPeriodStart.setTime(minDate.getTime() - currentPeriodDuration);
    
    // Get transactions from the previous period
    return window.transactionData.filter(t => {
        const date = new Date(t.date);
        return date >= previousPeriodStart && date < minDate;
    });
}

// Function to update summary metrics
function updateSummaryMetrics(data, previousPeriodData) {
    // Calculate total income (positive amounts)
    const totalIncome = data
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
        
    // Calculate total expenses (negative amounts)
    const totalExpenses = data
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
    // Calculate net savings
    const netSavings = totalIncome - totalExpenses;
    
    // Calculate previous period metrics for comparison
    const previousIncome = previousPeriodData
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
        
    const previousExpenses = previousPeriodData
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
    const previousSavings = previousIncome - previousExpenses;
    
    // Calculate percentage changes
    const incomeChange = previousIncome > 0 
        ? ((totalIncome - previousIncome) / previousIncome * 100).toFixed(1)
        : 0;
        
    const expensesChange = previousExpenses > 0 
        ? ((totalExpenses - previousExpenses) / previousExpenses * 100).toFixed(1)
        : 0;
        
    const savingsChange = previousSavings !== 0
        ? ((netSavings - previousSavings) / Math.abs(previousSavings) * 100).toFixed(1)
        : 0;
    
    // Find top spending category
    const expensesByCategory = {};
    data.filter(t => t.amount < 0).forEach(t => {
        if (!expensesByCategory[t.category]) {
            expensesByCategory[t.category] = 0;
        }
        expensesByCategory[t.category] += Math.abs(t.amount);
    });
    
    let topCategory = { category: "None", amount: 0 };
    Object.entries(expensesByCategory).forEach(([category, amount]) => {
        if (amount > topCategory.amount) {
            topCategory = { category, amount };
        }
    });
    
    // Update the DOM
    document.querySelector('#total-income .amount').textContent = `${totalIncome.toFixed(2)}`;
    document.querySelector('#total-expenses .amount').textContent = `${totalExpenses.toFixed(2)}`;
    document.querySelector('#savings .amount').textContent = `${netSavings.toFixed(2)}`;
    document.querySelector('#top-category .category').textContent = topCategory.category;
    document.querySelector('#top-category .category-amount').textContent = `${topCategory.amount.toFixed(2)}`;
    
    // Update trend indicators with icons
    updateTrendIndicator('#total-income .trend', incomeChange);
    updateTrendIndicator('#total-expenses .trend', expensesChange, true); // For expenses, positive change is negative
    updateTrendIndicator('#savings .trend', savingsChange);
    
    // Add color coding for savings (green for positive, red for negative)
    const savingsElement = document.querySelector('#savings .amount');
    if (netSavings >= 0) {
        savingsElement.style.color = 'var(--positive-color)';
    } else {
        savingsElement.style.color = 'var(--negative-color)';
    }
}

// Function to update trend indicators
function updateTrendIndicator(selector, changePercent, invertColors = false) {
    const element = document.querySelector(selector);
    const absChange = Math.abs(changePercent);
    let icon, colorClass;
    
    if (changePercent > 0) {
        icon = '<i class="fas fa-arrow-up"></i>';
        colorClass = invertColors ? 'negative' : 'positive';
    } else if (changePercent < 0) {
        icon = '<i class="fas fa-arrow-down"></i>';
        colorClass = invertColors ? 'positive' : 'negative';
    } else {
        icon = '<i class="fas fa-equals"></i>';
        colorClass = 'neutral';
    }
    
    element.innerHTML = `<span class="${colorClass}">${icon} ${absChange}%</span> vs previous period`;
}

// Function to setup download buttons
function setupDownloadButtons() {
    document.querySelectorAll('.download-btn').forEach(button => {
        button.addEventListener('click', function() {
            const chartId = this.getAttribute('data-chart');
            downloadChart(chartId);
        });
    });
}

// Function to download chart as SVG
function downloadChart(chartId) {
    const svgElement = document.querySelector(`#${chartId} svg`);
    
    if (!svgElement) {
        alert('Chart not available for download.');
        return;
    }
    
    // Get the SVG source
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgElement);
    
    // Add namespaces
    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    // Add CSS
    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
    
    // Convert SVG source to a Blob object
    const svgBlob = new Blob([source], {type:"image/svg+xml;charset=utf-8"});
    const svgUrl = URL.createObjectURL(svgBlob);
    
    // Create download link
    const downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = `finance-dashboard-${chartId}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

// Function to display error messages
function displayErrorMessage(message) {
    const containers = [
        document.getElementById('bar-chart'),
        document.getElementById('spending-map'),
        document.getElementById('word-cloud')
    ];
    
    containers.forEach(container => {
        container.innerHTML = `
            <div class="error-message" style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                text-align: center;
                padding: 20px;
            ">
                <i class="fas fa-exclamation-triangle" style="
                    font-size: 2rem;
                    color: var(--negative-color);
                    margin-bottom: 10px;
                "></i>
                <p style="color: var(--negative-color);">${message}</p>
            </div>
        `;
    });
    
    // Reset summary cards
    document.querySelector('#total-income .amount').textContent = '$0.00';
    document.querySelector('#total-expenses .amount').textContent = '$0.00';
    document.querySelector('#savings .amount').textContent = '$0.00';
    document.querySelector('#top-category .category').textContent = 'None';
    document.querySelector('#top-category .category-amount').textContent = '$0.00';
    
    // Reset trend indicators
    document.querySelectorAll('.trend').forEach(el => {
        el.innerHTML = '<span class="neutral"><i class="fas fa-equals"></i> 0%</span> vs previous period';
    });
    
    // Clear recent transactions
    document.getElementById('recent-transactions').innerHTML = `
        <div class="transaction-item">
            <p style="text-align: center; width: 100%; padding: 1rem; color: var(--negative-color);">
                ${message}
            </p>
        </div>
    `;
}

// Function to update recent transactions
function updateRecentTransactions(data) {
    const transactionsContainer = document.getElementById('recent-transactions');
    
    // Clear existing transactions
    transactionsContainer.innerHTML = '';
    
    if (data.length === 0) {
        transactionsContainer.innerHTML = `
            <div class="transaction-item">
                <p style="text-align: center; width: 100%; padding: 1rem; color: #95a5a6;">
                    No transactions available for the selected period
                </p>
            </div>
        `;
        return;
    }
    
    // Sort transactions by date (newest first)
    const sortedTransactions = [...data].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    
    // Take only the 10 most recent transactions
    const recentTransactions = sortedTransactions.slice(0, 10);
    
    // Create transaction elements
    recentTransactions.forEach(transaction => {
        const isPositive = transaction.amount > 0;
        const amountClass = isPositive ? 'positive' : 'negative';
        const formattedAmount = isPositive 
            ? `+${Math.abs(transaction.amount).toFixed(2)}` 
            : `-${Math.abs(transaction.amount).toFixed(2)}`;
        
        const transactionElement = document.createElement('div');
        transactionElement.className = 'transaction-item';
        transactionElement.innerHTML = `
            <div class="transaction-date">${transaction.date}</div>
            <div class="transaction-details">
                <div class="transaction-merchant">${transaction.merchant}</div>
                <div class="transaction-category">${transaction.category}</div>
            </div>
            <div class="transaction-amount ${amountClass}">${formattedAmount}</div>
        `;
        
        transactionsContainer.appendChild(transactionElement);
    });
}