// ===================================================================================
// CONFIGURAÇÃO OPCIONAL: BACKUP NA NUVEM (REMOVIDO)
// ===================================================================================

// --- DADOS EM MEMÓRIA ---
let products = [];
let customers = [];
let transactions = [];
let orders = [];
let cashBalance = 0.00;
let rawMaterials = [];
let categories = [];
let cart = {
    items: [],
    generalDiscount: { type: 'fixed', value: 0 }
};
let salesChart;
let currentReportPeriod = 'weekly';
let confirmCallback = null;
let areEventListenersAdded = false;
let calendarDate = new Date();
let productSalesReportData = null;

// Variáveis para o Backup Automático (Lembrete)
let backupInterval = null;
const BACKUP_INTERVAL_MINUTES = 60; // Lembrete a cada 60 minutos

// --- FUNÇÕES DE PERSISTÊNCIA E INICIALIZAÇÃO ---
function saveData() {
    try {
        localStorage.setItem('products', JSON.stringify(products));
        localStorage.setItem('customers', JSON.stringify(customers));
        localStorage.setItem('transactions', JSON.stringify(transactions));
        localStorage.setItem('orders', JSON.stringify(orders));
        localStorage.setItem('cashBalance', JSON.stringify(cashBalance));
        localStorage.setItem('rawMaterials', JSON.stringify(rawMaterials));
        localStorage.setItem('categories', JSON.stringify(categories));
        localStorage.setItem('theme', document.documentElement.getAttribute('data-theme'));
    } catch (error) {
        console.error("Erro ao guardar dados:", error);
        showToast("Não foi possível guardar os dados. O armazenamento pode estar cheio.", "error");
    }
}

function loadDataFromLocalStorage() {
    toggleLoading(true);
    try {
        categories = JSON.parse(localStorage.getItem('categories')) || [{ id: 1, name: 'Sem Categoria' }];
        products = JSON.parse(localStorage.getItem('products')) || [];
        rawMaterials = JSON.parse(localStorage.getItem('rawMaterials')) || [];
        customers = JSON.parse(localStorage.getItem('customers')) || [{ id: 1, name: 'Cliente Balcão', contact: '' }];
        transactions = JSON.parse(localStorage.getItem('transactions')) || [];
        orders = JSON.parse(localStorage.getItem('orders')) || [];
        cashBalance = JSON.parse(localStorage.getItem('cashBalance')) || 0.00;
        const savedTheme = localStorage.getItem('theme') || 'light';
        applyTheme(savedTheme);

        transactions.forEach(t => {
            if (t.customerid !== undefined) {
                t.customerId = t.customerid;
                delete t.customerid;
            }
        });

    } catch (error) {
        console.error("Erro ao carregar dados locais:", error);
        showToast("Erro ao carregar dados. A utilizar valores padrão.", "error");
    } finally {
        initializeAppUI();
        toggleLoading(false);
    }
}

function initializeAppUI() {
    switchView('dashboard-view');
    renderProducts();
    renderCart();
    updateCashBalance();
    renderCustomers();
    renderCategoryFilters();

    if (!areEventListenersAdded) {
        addEventListeners();
        areEventListenersAdded = true;
    }
    
    // Inicia o timer do backup
    startBackupTimer();
}

window.onload = function() {
    try {
        loadDataFromLocalStorage();
    } catch (e) {
        alert("Ocorreu um erro crítico ao iniciar a aplicação. Por favor, limpe o cache do seu navegador e tente novamente. Erro: " + e.message);
        console.error("Erro fatal no window.onload:", e);
    }
};

// --- FUNÇÕES DE LÓGICA PRINCIPAL (vendas, produtos, etc.) ---
function addProduct(name, price, cost, categoryId, barcode) {
    if (products.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        showToast('Produto com este nome já está registado!', 'error');
        return;
    }
    if (barcode && products.some(p => p.barcode === barcode)) {
        showToast('Este código de barras já está associado a outro produto!', 'error');
        return;
    }
    products.push({
        id: Date.now(),
        name,
        price: parseFloat(price),
        cost: parseFloat(cost),
        categoryId: parseInt(categoryId),
        barcode: barcode.trim()
    });
    renderProducts();
    showToast('Novo produto adicionado!');
    saveData();
}

function addByBarcode(barcode) {
    if (!barcode) return;
    const product = products.find(p => p.barcode && p.barcode === barcode);
    if (product) {
        addToCart(product.id);
    } else {
        showToast(`Produto com código de barras "${barcode}" não encontrado.`, 'error');
    }
}

// --- FUNÇÕES DE RENDERIZAÇÃO E UI ---
function formatCurrency(value) { return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

function toggleLoading(isLoading) { document.getElementById('loading-overlay').classList.toggle('hidden', !isLoading); }

function renderProducts(filter = '', categoryId = 'all') {
    const productGrid = document.getElementById('product-grid');
    if(!productGrid) return;
    productGrid.innerHTML = '';

    let filteredProducts = products.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
    if (categoryId !== 'all') {
        filteredProducts = filteredProducts.filter(p => p.categoryId == categoryId);
    }

    if (filteredProducts.length === 0) {
        productGrid.innerHTML = `<p class="col-span-full text-center text-gray-500 mt-8">Nenhum produto encontrado.</p>`;
        return;
    }

    filteredProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = `product-card relative p-4 rounded-lg shadow cursor-pointer hover:bg-[var(--bg-secondary)]`;
        card.setAttribute('title', product.name);

        card.innerHTML = `
            <button data-id="${product.id}" class="edit-product-btn absolute bottom-1 right-1 text-blue-500 hover:text-blue-700 p-1 transition-colors z-10" title="Editar ${product.name}">
                <i class="fas fa-edit"></i>
            </button>
            <div class="flex flex-col h-full" data-action="add-to-cart" data-id="${product.id}">
                <h3 class="font-bold truncate mb-1">${product.name}</h3>
                <div class="mt-auto">
                    <p class="text-[var(--primary-600)] font-semibold">${formatCurrency(product.price)}</p>
                    <p class="text-xs text-red-500/80">Custo: ${formatCurrency(product.cost)}</p>
                </div>
            </div>
        `;

        productGrid.appendChild(card);
    });
}

function renderProductEditList(filter = '') {
    const container = document.getElementById('edit-product-list-container');
    if(!container) return;
    container.innerHTML = '';

    const filtered = products.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));

    if (filtered.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 mt-4">Nenhum produto encontrado.</p>`;
        return;
    }

    let tableHTML = `<table class="w-full text-left text-sm">
        <thead>
            <tr class="border-b">
                <th class="p-2">Produto</th>
                <th class="p-2">Categoria</th>
                <th class="p-2 text-right">Preço</th>
                <th class="p-2 text-right">Custo</th>
                <th class="p-2 text-center">Ações</th>
            </tr>
        </thead>
        <tbody>`;

    filtered.forEach(p => {
        const categoryName = categories.find(c => c.id == p.categoryId)?.name || 'N/A';
        tableHTML += `
            <tr class="border-b hover:bg-[var(--bg-tertiary)]">
                <td class="p-2 font-medium">${p.name}</td>
                <td class="p-2">${categoryName}</td>
                <td class="p-2 text-right">${formatCurrency(p.price)}</td>
                <td class="p-2 text-right text-red-500">${formatCurrency(p.cost)}</td>
                <td class="p-2 text-center">
                    <button data-id="${p.id}" class="edit-product-btn text-blue-500 p-1" title="Editar ${p.name}">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>`;
    });

    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

function renderCart() {
    const cartItems = document.getElementById('cart-items');
    if (!cartItems) return;
    if (cart.items.length === 0) { cartItems.innerHTML = '<p class="text-center text-[var(--text-secondary)] mt-8">O caixa está vazio.</p>'; }
    else {
        cartItems.innerHTML = '';
        cart.items.forEach((item, index) => {
            const itemTotal = item.price * item.quantity;
            let discountText = '';
            if (item.discount.value > 0) {
                const discountValue = item.discount.type === 'percentage' ? (itemTotal * item.discount.value / 100) : item.discount.value;
                discountText = `<span class="text-xs text-red-500">(-${formatCurrency(discountValue)})</span>`;
            }
            cartItems.innerHTML += `<div class="flex justify-between items-center bg-[var(--bg-tertiary)] p-3 rounded-lg"><div><p class="font-semibold">${item.name} ${discountText}</p><p class="text-sm text-[var(--text-secondary)]">${item.quantity} x ${formatCurrency(item.price)}</p></div><div class="flex items-center gap-3"><button data-index="${index}" class="apply-item-discount-btn text-blue-500 hover:text-blue-700"><i class="fas fa-tag"></i></button><button data-index="${index}" class="decrease-qty-btn w-6 h-6 bg-gray-200 rounded-full font-bold">-</button><span>${item.quantity}</span><button data-index="${index}" class="increase-qty-btn w-6 h-6 bg-gray-200 rounded-full font-bold">+</button><button data-index="${index}" class="remove-from-cart-btn text-[var(--danger-500)] hover:text-[var(--danger-600)] ml-2"><i class="fas fa-trash-alt"></i></button></div></div>`;
        });
    }
    const checkoutButton = document.getElementById('checkout-button');
    if (checkoutButton) {
        checkoutButton.disabled = cart.items.length === 0;
    }
    updateTotals();
}

 function renderRawMaterials() {
        const list = document.getElementById('raw-materials-list');
        if(!list) return;
        list.innerHTML = '';
        if (rawMaterials.length === 0) { list.innerHTML = `<p class="text-center text-gray-500 mt-4">Nenhum item de estoque registado.</p>`; return; }
        list.innerHTML = `<div class="grid grid-cols-7 items-center p-2 border-b font-bold text-sm text-[var(--text-secondary)]"><p class="col-span-2">Nome</p><p>Fornecedor</p><p>Data</p><p>Qtd.</p><p>Custo Unit.</p><p class="text-right">Ações</p></div>`;
        rawMaterials.forEach(rm => {
            const unitCost = (rm.totalCost && rm.stock > 0) ? rm.totalCost / rm.stock : 0;
            list.innerHTML += `<div class="grid grid-cols-7 items-center p-2 border-b border-[var(--border-color)] text-sm"><p class="col-span-2 font-medium">${rm.name}</p><p>${rm.supplier || 'N/A'}</p><p>${rm.receiptDate ? new Date(rm.receiptDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</p><p>${rm.stock} ${rm.unit}</p><p class="font-semibold">${formatCurrency(unitCost)}</p><div class="justify-self-end"><button data-id="${rm.id}" class="edit-stock-item-btn text-blue-500 hover:text-blue-700 p-1"><i class="fas fa-edit"></i></button><button data-id="${rm.id}" class="delete-stock-item-btn text-red-500 hover:text-red-700 p-1"><i class="fas fa-trash"></i></button></div></div>`;
        });
    }

function renderCustomers() {
    const customersList = document.getElementById('customers-list');
    const customerSelect = document.getElementById('customer-select');
    if(!customersList || !customerSelect) return;
    customersList.innerHTML = '';
    customerSelect.innerHTML = '<option value="">Nenhum cliente selecionado</option>';
    customers.forEach(customer => {
        customersList.innerHTML += `<div class="flex justify-between items-center p-2 border-b border-[var(--border-color)]"><p>${customer.name} <span class="text-sm text-[var(--text-secondary)]">${customer.contact}</span></p><div><button data-id="${customer.id}" class="edit-customer-btn text-blue-500 hover:text-blue-700 p-1"><i class="fas fa-edit"></i></button><button data-id="${customer.id}" class="delete-customer-btn text-red-500 hover:text-red-700 p-1"><i class="fas fa-trash"></i></button></div></div>`;
        customerSelect.innerHTML += `<option value="${customer.id}">${customer.name}</option>`;
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    document.querySelector(`.tab-button[data-tab="${tabName}"]`).classList.add('active');

    if (tabName === 'vendas-cliente') renderSalesByCustomerReport();
    else if (tabName === 'desempenho-produtos') renderProductPerformanceReport();
    else if (tabName === 'vendas-produto') initializeProductSalesReport();
    else if (['vendas', 'estoque-materias'].includes(tabName)) {
        populateMonthYearSelectors();
        renderReports(currentReportPeriod);
    }
}

function renderReports(period = currentReportPeriod, month, year) {
        try {
            const now = new Date();
            const annualSummaryTable = document.getElementById('annual-summary-table');
            const transactionsList = document.getElementById('transactions-list');
            let filteredTransactions, startDate;

            const monthYearSelector = document.getElementById('month-year-selector');
            if(monthYearSelector) {
                monthYearSelector.classList.toggle('hidden', period !== 'monthly');
            }

            if (period === 'annual') {
                startDate = new Date(now.getFullYear(), 0, 1);
                filteredTransactions = transactions.filter(t => new Date(t.date) >= startDate);
            } else if (period === 'monthly') {
                const selectedYear = parseInt(year) || now.getFullYear();
                const selectedMonth = parseInt(month) ?? now.getMonth();
                startDate = new Date(selectedYear, selectedMonth, 1);
                const endDate = new Date(selectedYear, selectedMonth + 1, 0);
                endDate.setHours(23, 59, 59, 999);
                filteredTransactions = transactions.filter(t => {
                    const transactionDate = new Date(t.date);
                    return transactionDate >= startDate && transactionDate <= endDate;
                });
            } else {
                switch(period) {
                    case 'daily': startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
                    case 'weekly': default: startDate = new Date(); startDate.setDate(startDate.getDate() - 7); break;
                }
                   filteredTransactions = transactions.filter(t => new Date(t.date) >= startDate);
            }

            if(transactionsList) transactionsList.classList.toggle('hidden', period === 'annual');
            if(annualSummaryTable) annualSummaryTable.classList.toggle('hidden', period !== 'annual');

            const salesSummary = document.getElementById('sales-summary');
            const salesTransactions = filteredTransactions.filter(t => t.type === 'venda' && !t.reversed);

            const totalRevenue = salesTransactions.reduce((s, t) => s + t.amount, 0);
            const totalDiscounts = salesTransactions.reduce((s, t) => s + (t.discount || 0), 0);
            const grossRevenue = totalRevenue + totalDiscounts;
            const totalCost = salesTransactions.reduce((s, t) => s + (t.cost || 0), 0);
            const profit = totalRevenue - totalCost;

            if(salesSummary) {
                salesSummary.className = "grid grid-cols-2 md:grid-cols-5 gap-4 text-center mb-4";
                salesSummary.innerHTML = `
                    <div class="p-2 bg-[var(--bg-tertiary)] rounded-lg"><p class="text-sm text-[var(--text-secondary)]">Faturamento Bruto</p><p class="text-lg font-bold">${formatCurrency(grossRevenue)}</p></div>
                    <div class="p-2 bg-[var(--bg-tertiary)] rounded-lg"><p class="text-sm text-[var(--text-secondary)]">Total Descontos</p><p class="text-lg font-bold text-red-500">${formatCurrency(totalDiscounts)}</p></div>
                    <div class="p-2 bg-[var(--bg-tertiary)] rounded-lg"><p class="text-sm text-[var(--text-secondary)]">Custo Produtos</p><p class="text-lg font-bold text-[var(--danger-600)]">${formatCurrency(totalCost)}</p></div>
                    <div class="p-2 bg-[var(--bg-tertiary)] rounded-lg"><p class="text-sm text-[var(--text-secondary)]">Lucro Líquido</p><p class="text-lg font-bold text-[var(--secondary-600)]">${formatCurrency(profit)}</p></div>
                    <div class="p-2 bg-[var(--bg-tertiary)] rounded-lg"><p class="text-sm text-[var(--text-secondary)]">Margem de Lucro</p><p class="text-lg font-bold text-[var(--secondary-600)]">${(grossRevenue > 0 ? (profit / grossRevenue) * 100 : 0).toFixed(2)}%</p></div>
                `;
            }

            if (period !== 'annual') {
                renderTransactionList(transactionsList, filteredTransactions);
            }

            const salesData = { labels: [], datasets: [ { label: 'Vendas Pagas', data: [], backgroundColor: 'rgba(5, 150, 105, 0.6)' }, { label: 'Vendas Não Pagas', data: [], backgroundColor: 'rgba(220, 38, 38, 0.6)' } ] };
            if (period === 'annual') {
                const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                const monthlyData = Array(12).fill(0).map(() => ({ paid: 0, unpaid: 0, cost: 0, discount: 0 }));

                salesTransactions.forEach(t => {
                    const month = new Date(t.date).getMonth();
                    if (t.status === 'Não Pago') monthlyData[month].unpaid += t.amount;
                    else monthlyData[month].paid += t.amount;
                    monthlyData[month].cost += (t.cost || 0);
                    monthlyData[month].discount += (t.discount || 0);
                });

                salesData.labels = monthNames;
                salesData.datasets[0].data = monthlyData.map(m => m.paid);
                salesData.datasets[1].data = monthlyData.map(m => m.unpaid);

                if(annualSummaryTable) {
                    annualSummaryTable.innerHTML = `<table class="w-full text-left text-sm"><thead><tr class="border-b border-[var(--border-color)]"><th class="p-2">Mês</th><th class="text-right">Fat. Bruto</th><th class="text-right">Descontos</th><th class="text-right">Custo</th><th class="text-right">Lucro Líquido</th><th class="text-right">Margem %</th></tr></thead><tbody></tbody></table>`;
                    const annualTbody = annualSummaryTable.querySelector('tbody');
                    monthlyData.forEach((monthData, index) => {
                        const totalPaidAndUnpaid = monthData.paid + monthData.unpaid;
                        const grossMonthRevenue = totalPaidAndUnpaid + monthData.discount;
                        const profit = totalPaidAndUnpaid - monthData.cost;
                        const profitPercentage = grossMonthRevenue > 0 ? (profit / grossMonthRevenue) * 100 : 0;
                        annualTbody.innerHTML += `<tr><td class="p-2 font-semibold">${monthNames[index]}</td><td class="text-right">${formatCurrency(grossMonthRevenue)}</td><td class="text-right text-red-600">${formatCurrency(monthData.discount)}</td><td class="text-right">${formatCurrency(monthData.cost)}</td><td class="text-right ${profit >= 0 ? 'text-green-600' : 'text-red-600'}">${formatCurrency(profit)}</td><td class="text-right ${profit >= 0 ? 'text-green-600' : 'text-red-600'}">${profitPercentage.toFixed(2)}%</td></tr>`;
                    });
                }
            } else {
                const salesByDate = {};
                let loopDate = new Date(startDate);
                let endDate = (period === 'monthly') ? new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0) : new Date();

                while(loopDate <= endDate) {
                       salesByDate[loopDate.toISOString().split('T')[0]] = { paid: 0, unpaid: 0 };
                       loopDate.setDate(loopDate.getDate() + 1);
                }

                salesTransactions.forEach(t => {
                    const key = new Date(t.date).toISOString().split('T')[0];
                    if(salesByDate[key]) {
                        if (t.status === 'Não Pago') salesByDate[key].unpaid += t.amount;
                        else salesByDate[key].paid += t.amount;
                    }
                });

                if (period === 'daily') {
                    salesData.labels.push('Hoje');
                    const dailyTotals = Object.values(salesByDate).reduce((acc, curr) => ({ paid: acc.paid + curr.paid, unpaid: acc.unpaid + curr.unpaid }), { paid: 0, unpaid: 0 });
                    salesData.datasets[0].data.push(dailyTotals.paid);
                    salesData.datasets[1].data.push(dailyTotals.unpaid);
                } else {
                    for(const [day, totals] of Object.entries(salesByDate)) {
                        salesData.labels.push(new Date(day + 'T00:00:00').toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'}));
                        salesData.datasets[0].data.push(totals.paid);
                        salesData.datasets[1].data.push(totals.unpaid);
                    }
                }
            }

            const canvas = document.getElementById('salesChart');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (salesChart) salesChart.destroy();
                salesChart = new Chart(ctx, { type: 'bar', data: salesData, options: { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } } });
            }

        } catch (error) {
            console.error("Erro ao renderizar relatórios:", error);
            showToast("Ocorreu um erro ao gerar o relatório.", "error");
        }
    }

function renderSalesByCustomerReport() {
    const container = document.getElementById('tab-vendas-cliente');
    if(!container) return;
    const salesByCustomer = transactions.filter(t => t.type === 'venda' && !t.reversed).reduce((acc, sale) => {
        const customerId = sale.customerId || 'unknown';
        if (!acc[customerId]) {
            acc[customerId] = {
                paid: 0,
                unpaid: 0,
                total: 0,
                count: 0,
                customerName: customers.find(c => c.id == customerId)?.name || 'Cliente Não Identificado'
            };
        }
        acc[customerId].total += sale.amount; acc[customerId].count++;
        if (sale.status === 'Não Pago') acc[customerId].unpaid += sale.amount; else acc[customerId].paid += sale.amount;
        return acc;
    }, {});
    let tableHtml = `<table class="w-full text-left mt-4"><thead><tr class="border-b"><th class="p-2">Cliente</th><th class="text-right">Total Comprado</th><th class="text-right">Total Pago</th><th class="text-right">Total Devido</th><th class="text-center">Nº de Vendas</th></tr></thead><tbody>`;
    Object.entries(salesByCustomer).sort(([,a],[,b]) => b.total - a.total).forEach(([customerId, data]) => {
        tableHtml += `<tr class="hover:bg-[var(--bg-secondary)] cursor-pointer customer-details-row" data-customer-id="${customerId}"><td class="p-2 font-semibold">${data.customerName}</td><td class="text-right">${formatCurrency(data.total)}</td><td class="text-right text-green-600">${formatCurrency(data.paid)}</td><td class="text-right text-red-600">${formatCurrency(data.unpaid)}</td><td class="text-center">${data.count}</td></tr>`;
    });
    container.innerHTML = tableHtml + '</tbody></table>';
}

function renderCashClosingReport() {
    const cashClosingSummary = document.getElementById('cash-closing-summary');
    if(!cashClosingSummary) return;
    const today = new Date(); today.setHours(0,0,0,0);
    const todaysTransactions = transactions.filter(t => new Date(t.date) >= today);
    const summary = { totalSales: 0, totalCost: 0, byMethod: { 'Dinheiro': 0, 'Pix': 0, 'Cartão de Crédito': 0 } };
    todaysTransactions.filter(t => t.type === 'venda' && t.status !== 'Não Pago' && !t.reversed).forEach(sale => {
        summary.totalSales += sale.amount;
        summary.totalCost += sale.cost || 0;
        if (sale.method) summary.byMethod[sale.method] += sale.amount;
    });
    todaysTransactions.filter(t => t.type === 'recebimento').forEach(receipt => {
        summary.totalSales += receipt.amount;
        if (receipt.method) summary.byMethod[receipt.method] += receipt.amount;
    });
    cashClosingSummary.innerHTML = `<div class="flex justify-between border-b pb-2 border-[var(--border-color)]"><span class="font-semibold">Total de Vendas Pagas do Dia:</span><span class="font-bold text-[var(--primary-600)]">${formatCurrency(summary.totalSales)}</span></div><div class="flex justify-between"><span class="text-sm">Lucro Líquido (de vendas pagas hoje):</span><span class="text-sm font-semibold text-[var(--secondary-600)]">${formatCurrency(summary.totalSales - summary.totalCost)}</span></div><div class="pt-4 mt-4 border-t border-[var(--border-color)]"><h4 class="font-semibold mb-2">Recebimentos por Forma de Pagamento:</h4><div class="flex justify-between text-sm"><span>Dinheiro:</span><span>${formatCurrency(summary.byMethod['Dinheiro'])}</span></div><div class="flex justify-between text-sm"><span>Pix:</span><span>${formatCurrency(summary.byMethod['Pix'])}</span></div><div class="flex justify-between text-sm"><span>Cartão de Crédito:</span><span>${formatCurrency(summary.byMethod['Cartão de Crédito'])}</span></div></div>`;
}

function renderProductPerformanceReport() {
    const container = document.getElementById('tab-desempenho-produtos');
    if(!container) return;
    const productPerformance = {};

    transactions.filter(t => t.type === 'venda' && !t.reversed).forEach(sale => {
        sale.items.forEach(item => {
            if (!productPerformance[item.id]) {
                productPerformance[item.id] = {
                    name: item.name,
                    quantitySold: 0,
                    totalRevenue: 0,
                    totalCost: 0,
                    totalProfit: 0
                };
            }
            const performance = productPerformance[item.id];
            performance.quantitySold += item.quantity;
            const revenue = item.price * item.quantity;
            const cost = item.cost * item.quantity;
            performance.totalRevenue += revenue;
            performance.totalCost += cost;
            performance.totalProfit += revenue - cost;
        });
    });

    const performanceArray = Object.values(productPerformance);
    const allProducts = products.map(p => ({
        name: p.name,
        quantitySold: productPerformance[p.id]?.quantitySold || 0,
        totalRevenue: productPerformance[p.id]?.totalRevenue || 0,
        totalProfit: productPerformance[p.id]?.totalProfit || 0
    }));

    const mostSold = [...allProducts].sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 5);
    const mostProfitable = [...allProducts].sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 5);
    const unsold = products.filter(p => !productPerformance[p.id]).map(p => ({ name: p.name }));

    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
            <div>
                <h3 class="text-xl font-semibold mb-3">Top 5 Produtos Mais Vendidos</h3>
                ${createPerformanceTable(mostSold, ['#', 'Produto', 'Qtd. Vendida', 'Receita Total'], ['quantitySold', 'totalRevenue'])}
            </div>
            <div>
                <h3 class="text-xl font-semibold mb-3">Top 5 Produtos Mais Lucrativos</h3>
                ${createPerformanceTable(mostProfitable, ['#', 'Produto', 'Lucro Total', 'Receita Total'], ['totalProfit', 'totalRevenue'])}
            </div>
        </div>
        <div class="mt-8">
            <h3 class="text-xl font-semibold mb-3">Produtos Sem Vendas</h3>
            ${createPerformanceTable(unsold, ['Produto'], [], false)}
        </div>
    `;
}

function createPerformanceTable(data, headers, dataKeys, includeRank = true) {
    if (data.length === 0) return '<p class="text-gray-500">Nenhum dado disponível.</p>';
    let table = '<table class="w-full text-left text-sm"><thead><tr class="border-b">';
    headers.forEach(h => table += `<th class="p-2">${h}</th>`);
    table += '</tr></thead><tbody>';
    data.forEach((item, index) => {
        table += '<tr class="border-b">';
        if (includeRank) table += `<td class="p-2">${index + 1}</td>`;
        table += `<td class="p-2 font-medium">${item.name}</td>`;
        dataKeys.forEach(key => {
            table += `<td class="p-2">${typeof item[key] === 'number' ? formatCurrency(item[key]) : item[key]}</td>`;
        });
        table += '</tr>';
    });
    table += '</tbody></table>';
    return table;
}

function initializeProductSalesReport() {
    const select = document.getElementById('sales-report-product-select');
    const container = document.getElementById('sales-report-details-container');
    const searchInput = document.getElementById('sales-report-customer-search');
    if (!select || !container || !searchInput) return;

    container.innerHTML = `<p class="text-center text-gray-500">Selecione um produto para ver os detalhes das vendas.</p>`;
    searchInput.value = '';
    searchInput.disabled = true;

    if (products.length > 0) {
        select.innerHTML = '<option value="">Selecione um produto</option>';
        products.sort((a, b) => a.name.localeCompare(b.name)).forEach(product => {
            select.innerHTML += `<option value="${product.id}">${product.name}</option>`;
        });
    } else {
        select.innerHTML = '<option value="">Nenhum produto encontrado</option>';
        return;
    }

    productSalesReportData = generateClientSideSalesReport();
}

function generateClientSideSalesReport() {
    const salesReport = {};
    const customerMap = customers.reduce((map, customer) => {
        map[customer.id] = customer.name;
        return map;
    }, {});

    transactions.forEach(transaction => {
        if (transaction.type !== 'venda' || transaction.reversed === true) {
            return;
        }

        const customerName = customerMap[transaction.customerId] || 'Cliente Balcão';
        const items = transaction.items || [];

        items.forEach(item => {
            const productId = item.id;

            if (!salesReport[productId]) {
                salesReport[productId] = {
                    productName: item.name,
                    totalSold: 0,
                    salesDetails: []
                };
            }

            const reportProduct = salesReport[productId];
            const itemTotal = item.price * item.quantity;

            let itemDiscountValue = 0;
            if (item.discount && item.discount.value > 0) {
                   itemDiscountValue = item.discount.type === 'percentage'
                    ? (itemTotal * item.discount.value / 100)
                    : item.discount.value;
            }

            const totalItemDiscountsInTransaction = (transaction.items.reduce((sum, i) => {
                const iTotal = i.price * i.quantity;
                const dVal = (i.discount && i.discount.value > 0) ? (i.discount.type === 'percentage' ? (iTotal * i.discount.value / 100) : i.discount.value) : 0;
                return sum + dVal;
            }, 0));

            const generalDiscountAmount = (transaction.discount || 0) - totalItemDiscountsInTransaction;
            if (generalDiscountAmount > 0) {
                const transactionSubtotal = transaction.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                if (transactionSubtotal > 0) {
                    const itemProportion = itemTotal / transactionSubtotal;
                    itemDiscountValue += generalDiscountAmount * itemProportion;
                }
            }

            reportProduct.totalSold += item.quantity;
            reportProduct.salesDetails.push({
                customerName: customerName,
                quantity: item.quantity,
                date: new Date(transaction.date).toLocaleDateString('pt-BR'),
                totalValue: itemTotal,
                discountValue: itemDiscountValue,
                finalValue: itemTotal - itemDiscountValue
            });
        });
    });
    return salesReport;
}

function displayProductSalesReport(productId, customerFilter = '') {
    const container = document.getElementById('sales-report-details-container');
    const searchInput = document.getElementById('sales-report-customer-search');
    if (!container || !searchInput) return;

    searchInput.value = customerFilter;

    if (!productId) {
        container.innerHTML = `<p class="text-center text-gray-500">Selecione um produto para ver os detalhes das vendas.</p>`;
        searchInput.disabled = true;
        searchInput.value = '';
        return;
    }

    searchInput.disabled = false;

    if (productSalesReportData === null) {
        container.innerHTML = `<p class="text-center text-red-500 mt-4">Os dados do relatório não estão disponíveis. Tente reabrir a janela.</p>`;
        return;
    }

    const productData = productSalesReportData[productId];

    if (!productData || productData.salesDetails.length === 0) {
        const selectedProduct = products.find(p => p.id == productId);
        container.innerHTML = `
            <div class="bg-gray-100 p-4 rounded-lg mb-4">
                <h4 class="text-lg font-bold">${selectedProduct ? selectedProduct.name : 'Produto'}</h4>
                <p><strong>Total de Unidades Vendidas:</strong> 0</p>
            </div>
            <p class="text-center text-gray-500 mt-4">Nenhuma venda encontrada para este produto.</p>
        `;
        return;
    }

    const filteredSales = productData.salesDetails.filter(sale =>
        sale.customerName.toLowerCase().includes(customerFilter.toLowerCase())
    );

    if (filteredSales.length === 0) {
        container.innerHTML = `
             <div class="bg-gray-100 p-4 rounded-lg mb-4">
                <h4 class="text-lg font-bold">${productData.productName}</h4>
                <p><strong>Total de Unidades Vendidas:</strong> ${productData.totalSold}</p>
            </div>
            <p class="text-center text-gray-500 mt-4">Nenhuma venda encontrada para o cliente "${customerFilter}".</p>
        `;
        return;
    }

    let tableHtml = `
        <div class="bg-gray-100 p-4 rounded-lg mb-4">
            <h4 class="text-lg font-bold">${productData.productName}</h4>
            <p><strong>Total de Unidades Vendidas:</strong> ${productData.totalSold}</p>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
                <thead>
                    <tr class="border-b">
                        <th class="p-2">Data</th>
                        <th class="p-2">Cliente</th>
                        <th class="p-2 text-center">Qtd.</th>
                        <th class="p-2 text-right">Valor Bruto</th>
                        <th class="p-2 text-right">Descontos</th>
                        <th class="p-2 text-right">Valor Final</th>
                    </tr>
                </thead>
                <tbody>
    `;

    filteredSales.forEach(sale => {
        tableHtml += `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-2">${sale.date}</td>
                <td class="p-2 font-medium">${sale.customerName}</td>
                <td class="p-2 text-center">${sale.quantity}</td>
                <td class="p-2 text-right">${formatCurrency(sale.totalValue)}</td>
                <td class="p-2 text-right text-red-500">${sale.discountValue > 0 ? `-${formatCurrency(sale.discountValue)}` : formatCurrency(0)}</td>
                <td class="p-2 text-right font-semibold">${formatCurrency(sale.finalValue)}</td>
            </tr>
        `;
    });

    tableHtml += `</tbody></table></div>`;
    container.innerHTML = tableHtml;
}

function setReportPeriod(period) {
    currentReportPeriod = period;
    document.querySelectorAll('#report-period-buttons .period-button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`#report-period-buttons .period-button[data-period="${period}"]`).classList.add('active');

    if (period === 'monthly') {
        populateMonthYearSelectors();
        const now = new Date();
        renderReports(period, now.getMonth(), now.getFullYear());
    } else {
        renderReports(period);
    }
}
function updateTotals() {
    const subtotalEl = document.getElementById('subtotal');
    const discountsTotalEl = document.getElementById('discounts-total');
    const totalEl = document.getElementById('total');

    if (!subtotalEl || !discountsTotalEl || !totalEl) return;

    const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let totalDiscount = cart.items.reduce((sum, item) => {
        const itemTotal = item.price * item.quantity;
        if (item.discount.value > 0) {
            return sum + (item.discount.type === 'percentage' ? (itemTotal * item.discount.value / 100) : item.discount.value);
        }
        return sum;
    }, 0);
    if (cart.generalDiscount.value > 0) {
        totalDiscount += cart.generalDiscount.type === 'percentage' ? ((subtotal - totalDiscount) * cart.generalDiscount.value / 100) : cart.generalDiscount.value;
    }
    const total = subtotal - totalDiscount;

    subtotalEl.textContent = formatCurrency(subtotal);
    discountsTotalEl.textContent = formatCurrency(-totalDiscount);
    totalEl.textContent = formatCurrency(total);
}
function updateCashBalance() {
    const cashBalanceElement = document.getElementById('cash-balance');
    if (cashBalanceElement) {
        cashBalanceElement.textContent = formatCurrency(cashBalance);
    }
}
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
        const cartItem = cart.items.find(item => item.id === productId);
        if (cartItem) {
            cartItem.quantity++;
        } else {
            cart.items.push({ ...product, quantity: 1, discount: { type: 'fixed', value: 0 } });
        }
        renderCart();
        showToast(`'${product.name}' adicionado.`);
    }
}
function increaseCartItemQuantity(index) {
    cart.items[index].quantity++;
    renderCart();
}
function decreaseCartItemQuantity(index) {
    cart.items[index].quantity--;
    if (cart.items[index].quantity === 0) cart.items.splice(index, 1);
    renderCart();
}
function removeFromCart(index) {
    cart.items.splice(index, 1);
    renderCart();
}
function clearCart() {
    cart.items = [];
    cart.generalDiscount = { type: 'fixed', value: 0 };
    renderCart();
}
function processSale(paymentDetails) {
    if (cart.items.length === 0) return;
    const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let totalDiscount = cart.items.reduce((sum, item) => {
        const itemTotal = item.price * item.quantity;
        return sum + (item.discount.type === 'percentage' ? (itemTotal * item.discount.value / 100) : item.discount.value);
    }, 0);
    if (cart.generalDiscount.value > 0) {
        totalDiscount += cart.generalDiscount.type === 'percentage' ? ((subtotal - totalDiscount) * cart.generalDiscount.value / 100) : cart.generalDiscount.value;
    }
    const total = subtotal - totalDiscount;
    const totalCost = cart.items.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
    const customerId = document.getElementById('customer-select').value;

    const saleDate = paymentDetails.isRetroactive && paymentDetails.date ? new Date(paymentDetails.date).getTime() : Date.now();

    if (paymentDetails.status === 'Pago' && !paymentDetails.isRetroactive) {
        cashBalance += total;
    }

    const { date, ...otherPaymentDetails } = paymentDetails;
    const transaction = {
        id: Date.now(),
        type: 'venda',
        amount: total,
        cost: totalCost,
        description: `Venda de ${cart.items.reduce((s, i) => s + i.quantity, 0)} item(s)`,
        date: saleDate,
        items: [...cart.items],
        customerId: customerId ? parseInt(customerId) : null,
        ...otherPaymentDetails,
        reversed: false,
        discount: totalDiscount
    };

    transactions.push(transaction);
    transactions.sort((a,b) => new Date(a.date) - new Date(b.date));

    if (paymentDetails.status === 'Pago') {
        showReceipt(transaction);
    }
    document.getElementById('customer-select').value = "";
    displayCustomerSummary(null);
    clearCart();
    showToast('Venda registada com sucesso!', 'success');
    saveData();
}

function processPaidSale(e) {
    e.preventDefault();
    const form = document.getElementById('payment-form');
    const method = form.elements.paymentMethod.value;
    const isRetroactive = form.elements.retroactiveSale.checked;
    const retroactiveDate = form.elements.retroactiveDate.value;
    processSale({ method: method, installments: method === 'Cartão de Crédito' ? parseInt(form.elements.paymentInstallments.value) : 1, status: 'Pago', isRetroactive, date: retroactiveDate });
    closeModal('modal-payment');
}
function processSaleAsUnpaid() {
    const form = document.getElementById('payment-form');
    const customerId = document.getElementById('customer-select').value;
    if (!customerId || parseInt(customerId) === 1) { showToast('Selecione um cliente válido (não "Cliente Balcão") para guardar como não pago.', 'error'); return; }
    const isRetroactive = form.elements.retroactiveSale.checked;
    const retroactiveDate = form.elements.retroactiveDate.value;
    processSale({ method: 'A Prazo', installments: 1, status: 'Não Pago', isRetroactive, date: retroactiveDate });
    closeModal('modal-payment');
}
function addRawMaterial(name, stock, unit, totalCost, supplier, receiptDate) {
    if (rawMaterials.some(rm => rm.name.toLowerCase() === name.toLowerCase())) { showToast('Insumo já registado!', 'error'); return; }
    rawMaterials.push({ id: Date.now(), name, stock: parseFloat(stock), unit, totalCost: parseFloat(totalCost), supplier, receiptDate });
    renderRawMaterials(); showToast('Insumo adicionado!'); saveData();
}
function addCustomer(name, contact) {
    if (customers.some(c => c.name.toLowerCase() === name.toLowerCase())) { showToast('Cliente com este nome já existe.', 'error'); return; }
    customers.push({ id: Date.now(), name, contact });
    renderCustomers(); showToast('Novo cliente adicionado!'); saveData();
}
function handleCashFlow(type, amount, description) {
    if (type === 'saida' && amount > cashBalance) { showToast('Saldo insuficiente para esta saída!', 'error'); return; }
    cashBalance += (type === 'entrada' ? amount : -amount);
    transactions.push({ id: Date.now(), type, amount, description, date: Date.now() });
    showToast(`Movimentação registada.`); saveData();
}
function deleteProduct() {
    const productId = parseInt(document.getElementById('edit-product-form').elements.productId.value);
    openConfirmationModal('Excluir Produto', 'Tem a certeza de que deseja excluir este produto? Esta ação não pode ser desfeita.', () => {
        products = products.filter(p => p.id !== productId);
        renderProducts();
        closeModal('modal-edit-produto'); showToast('Produto excluído com sucesso!'); saveData();
    });
}
function deleteRawMaterial(materialId) {
    openConfirmationModal('Excluir Insumo', 'Tem a certeza de que deseja excluir este insumo?', () => {
        rawMaterials = rawMaterials.filter(rm => rm.id !== materialId);
        renderRawMaterials(); showToast('Insumo excluído com sucesso!'); saveData();
    });
}
function deleteCustomer(customerId) {
    if (customerId === 1) { showToast('Não é possível excluir o cliente padrão.', 'error'); return; }
    if (transactions.some(t => t.customerId == customerId)) { showToast('Cliente não pode ser excluído pois está associado a vendas.', 'error'); return; }
    openConfirmationModal('Excluir Cliente', 'Tem a certeza de que deseja excluir este cliente?', () => {
        customers = customers.filter(c => c.id !== customerId);
        renderCustomers(); showToast('Cliente excluído com sucesso!'); saveData();
    });
}
function cancelSale(transactionId) {
    const sale = transactions.find(t => t.id === transactionId);
    if (!sale || sale.reversed) return;
    openConfirmationModal('Estornar Venda', 'Tem a certeza de que deseja estornar esta venda?', () => {
        if (sale.status !== 'Não Pago') cashBalance -= sale.amount;
        sale.reversed = true;
        transactions.push({ id: Date.now(), type: 'estorno', amount: -sale.amount, description: `Estorno da venda #${sale.id}`, date: Date.now() });
        renderReports(currentReportPeriod);
        showToast('Venda estornada com sucesso!'); saveData();
    });
}
function deleteTransaction(transactionId) {
    openConfirmationModal('Excluir Venda Permanentemente?', 'Esta ação é irreversível e não pode ser desfeita. A venda será apagada do histórico. Deseja continuar?', () => {
        const saleIndex = transactions.findIndex(t => t.id === transactionId);
        if (saleIndex > -1) {
            transactions.splice(saleIndex, 1);
            showToast('Venda excluída com sucesso.', 'success');
            renderReports(currentReportPeriod);
            if (!document.getElementById('modal-cliente-detalhes').classList.contains('hidden')) {
                const customerId = document.getElementById('modal-cliente-detalhes').dataset.customerId;
                openCustomerDetailsModal(customerId);
            }
            saveData();
        } else {
            showToast('Venda não encontrada.', 'error');
        }
    });
}
function resetSystem() {
    openConfirmationModal('Zerar Todo o Sistema', 'Esta ação é irreversível e apagará TODOS os dados. Deseja continuar?', () => {
        localStorage.clear();
        products = []; rawMaterials = []; customers = [{ id: 1, name: 'Cliente Balcão', contact: '' }];
        categories = [{ id: 1, name: 'Sem Categoria' }];
        transactions = [];
        orders = [];
        cashBalance = 0;
        initializeAppUI();
        showToast('Sistema zerado com sucesso!', 'success');
        closeModal('modal-settings');
        saveData();
    });
}
function openModal(modalId) {
    if (modalId === 'modal-relatorios') {
      setReportPeriod('daily');
      switchTab('vendas');
    }
    if(modalId === 'modal-contas-receber') renderUnpaidSales();
    if (modalId === 'modal-materiaprima') renderRawMaterials();
    if (modalId === 'modal-clientes') renderCustomers();
    if (modalId === 'modal-categorias') renderCategoriesManagement();
    if (modalId === 'modal-fechamento') renderCashClosingReport();
    if (modalId === 'modal-produto' || modalId === 'modal-edit-produto') populateCategoryDropdowns();
    const modal = document.getElementById(modalId);
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}
function closeModal(modalId) { const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId; if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); } }
function openEditProductModal(productId) {
    const product = products.find(p => p.id === productId); if (!product) return;
    const form = document.getElementById('edit-product-form');
    form.elements.productId.value = product.id;
    form.elements.productName.value = product.name;
    form.elements.productPrice.value = product.price;
    form.elements.productCost.value = product.cost;
    form.elements.productBarcode.value = product.barcode || '';
    populateCategoryDropdowns();
    form.elements.editProductCategory.value = product.categoryId;
    openModal('modal-edit-produto');
}
function openEditRawMaterialModal(materialId) {
    const material = rawMaterials.find(rm => rm.id === materialId); if (!material) return;
    const form = document.getElementById('edit-raw-material-form');
    form.elements.rawMaterialId.value = material.id;
    form.elements.rawMaterialName.value = material.name;
    form.elements.rawMaterialSupplier.value = material.supplier || '';
    form.elements.rawMaterialStock.value = material.stock;
    form.elements.rawMaterialUnit.value = material.unit;
    form.elements.rawMaterialTotalCost.value = material.totalCost;
    form.elements.rawMaterialReceiptDate.value = material.receiptDate ? new Date(material.receiptDate).toISOString().slice(0, 10) : '';
    openModal('modal-edit-materiaprima');
}
function openEditCustomerModal(customerId) {
    const customer = customers.find(c => c.id === customerId); if (!customer) return;
    const form = document.getElementById('edit-customer-form');
    form.elements.customerId.value = customer.id; form.elements.customerName.value = customer.name; form.elements.customerContact.value = customer.contact;
    openModal('modal-edit-cliente');
}
function openConfirmationModal(title, message, onConfirm) { document.getElementById('confirm-title').textContent = title; document.getElementById('confirm-message').textContent = message; confirmCallback = onConfirm; openModal('modal-confirm'); }
function openPaymentModal() {
    const customerId = document.getElementById('customer-select').value;
    if (!customerId) { showToast('Por favor, selecione um cliente para continuar.', 'error'); return; }
    const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let totalDiscount = cart.items.reduce((sum, item) => {
        const itemTotal = item.price * item.quantity;
        return sum + (item.discount.type === 'percentage' ? (itemTotal * item.discount.value / 100) : item.discount.value);
    }, 0);
    if (cart.generalDiscount.value > 0) {
        totalDiscount += cart.generalDiscount.type === 'percentage' ? ((subtotal - totalDiscount) * cart.generalDiscount.value / 100) : cart.generalDiscount.value;
    }
    const total = subtotal - totalDiscount;
    document.getElementById('payment-total').textContent = formatCurrency(total);
    document.getElementById('payment-amount-paid').value = total.toFixed(2);
    document.getElementById('payment-method').value = 'Dinheiro';
    document.getElementById('installments-group').classList.add('hidden');
    document.getElementById('amount-paid-group').classList.remove('hidden');
    document.getElementById('retroactive-sale-toggle').checked = false;
    document.getElementById('retroactive-date-group').classList.add('hidden');
    document.getElementById('payment-retroactive-date').value = '';
    updateChange(); openModal('modal-payment');
}
function updateChange() {
    const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let totalDiscount = cart.items.reduce((sum, item) => {
        const itemTotal = item.price * item.quantity;
        return sum + (item.discount.type === 'percentage' ? (itemTotal * item.discount.value / 100) : item.discount.value);
    }, 0);
    if (cart.generalDiscount.value > 0) {
        totalDiscount += cart.generalDiscount.type === 'percentage' ? ((subtotal - totalDiscount) * cart.generalDiscount.value / 100) : cart.generalDiscount.value;
    }
    const total = subtotal - totalDiscount;
    const paid = parseFloat(document.getElementById('payment-amount-paid').value) || 0;
    document.getElementById('payment-change').textContent = formatCurrency(paid - total > 0 ? paid - total : 0);
}
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.children[0].textContent = message;
    toast.className = `fixed bottom-5 right-5 text-white px-6 py-3 rounded-lg shadow-lg transition-all duration-300 z-[200] ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`;
    toast.classList.remove('opacity-0', 'translate-y-10');
    setTimeout(() => { toast.classList.add('opacity-0', 'translate-y-10'); }, 3000);
}
function showReceipt(transaction) {
    const receiptDetails = document.getElementById('receipt-details');
    receiptDetails.innerHTML = '';
    let subtotal = 0;
    transaction.items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        receiptDetails.innerHTML += `<div class="flex justify-between"><span>${item.quantity}x ${item.name}</span><span>${formatCurrency(itemTotal)}</span></div>`;
        if (item.discount && item.discount.value > 0) {
            const discountValue = item.discount.type === 'percentage' ? (itemTotal * item.discount.value / 100) : item.discount.value;
            receiptDetails.innerHTML += `<div class="flex justify-between text-xs text-red-500 pl-4"><span>&nbsp;&nbsp;Desconto</span><span>-${formatCurrency(discountValue)}</span></div>`;
        }
    });
    if (transaction.discount > 0 && transaction.items.some(i => i.discount.value > 0)) {
    }
    receiptDetails.innerHTML += `<div class="mt-2 pt-2 border-t flex justify-between"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>`;
    receiptDetails.innerHTML += `<div class="flex justify-between text-red-500"><span>Descontos</span><span>-${formatCurrency(transaction.discount)}</span></div>`;
    receiptDetails.innerHTML += `<div class="font-semibold mt-2 pt-2 border-t border-[var(--border-color)]"><span>Forma de Pagamento:</span><span> ${transaction.method}${transaction.installments > 1 ? ` (${transaction.installments}x)` : ''}</span></div>`;
    document.getElementById('receipt-total').textContent = `TOTAL: ${formatCurrency(transaction.amount)}`;
    document.getElementById('receipt-date').textContent = new Date(transaction.date).toLocaleString('pt-BR');
    openModal('receipt-modal');
}
function applyTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('theme', themeName);
    document.querySelectorAll('#theme-selector .theme-button').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`#theme-selector .theme-button[data-theme="${themeName}"]`);
    if(activeBtn) activeBtn.classList.add('active');
}
function renderUnpaidSales() {
    const list = document.getElementById('unpaid-sales-list');
    const unpaidSales = transactions.filter(t => t.type === 'venda' && t.status === 'Não Pago' && !t.reversed);
    if (unpaidSales.length === 0) { list.innerHTML = '<p class="text-center text-[var(--text-secondary)] mt-4">Nenhuma conta pendente.</p>'; return; }
    list.innerHTML = '';
    unpaidSales.forEach(sale => {
        const customer = customers.find(c => c.id == sale.customerId);
        list.innerHTML += `<div class="flex justify-between items-center p-3 border-b border-[var(--border-color)]"><div><p class="font-bold">${customer ? customer.name : 'Cliente desconhecido'}</p><p class="text-sm text-[var(--text-secondary)]">Venda de ${new Date(sale.date).toLocaleDateString('pt-BR')}</p></div><div class="text-right"><p class="font-bold text-lg text-red-500">${formatCurrency(sale.amount)}</p><button data-id="${sale.id}" class="receive-payment-btn text-sm text-green-600 hover:underline">Receber Pagamento</button></div></div>`;
    });
}
function openReceivePaymentModal(transactionId) {
    const sale = transactions.find(t => t.id === transactionId); if (!sale) return;
    const form = document.getElementById('receive-payment-form');
    form.elements.transactionId.value = sale.id;
    document.getElementById('receive-payment-total').textContent = formatCurrency(sale.amount);
    openModal('modal-receber-pagamento');
}
function handleReceivedPayment(e) {
    e.preventDefault();
    const form = document.getElementById('receive-payment-form');
    const sale = transactions.find(t => t.id == form.elements.transactionId.value);
    if (!sale) return;

    sale.status = 'Pago';
    sale.method = form.elements.paymentMethod.value;
    sale.installments = sale.method === 'Cartão de Crédito' ? parseInt(form.elements.paymentInstallments.value) : 1;

    transactions.push({
        id: Date.now(),
        type: 'recebimento',
        amount: sale.amount,
        description: `Recebimento da venda #${sale.id}`,
        date: Date.now(),
        method: sale.method,
        installments: sale.installments
    });

    cashBalance += sale.amount;
    renderUnpaidSales();
    closeModal('modal-receber-pagamento');
    showToast('Pagamento recebido com sucesso!', 'success');
    saveData();
}
function handleImportSales(e) {
    e.preventDefault();
    const file = document.getElementById('csv-file-input').files[0]; const logDiv = document.getElementById('import-log');
    if (!file) { showToast('Por favor, selecione um ficheiro.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = function(event) {
        const rows = event.target.result.split('\n').filter(row => row.trim() !== ''); logDiv.innerHTML = '';
        let newTransactions = [];
        rows.forEach((row, index) => {
            const [dateStr, productIdStr, quantityStr, customerIdStr, paymentMethod, status] = row.split(',');
            const product = products.find(p => p.id == productIdStr); const customer = customers.find(c => c.id == customerIdStr);
            if (!dateStr || !product || !customer || !quantityStr || !paymentMethod || !status) { logDiv.innerHTML += `<p class="text-red-500">Linha ${index + 1}: Dados inválidos. (${row})</p>`; return; }

            const dateParts = dateStr.split(/[-T:]/);
            const year = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1;
            const day = parseInt(dateParts[2], 10);
            const hour = parseInt(dateParts[3], 10);
            const minute = parseInt(dateParts[4], 10);
            const localDate = new Date(year, month, day, hour, minute);

            newTransactions.push({ id: localDate.getTime() + index, type: 'venda', amount: product.price * parseInt(quantityStr), cost: product.cost * parseInt(quantityStr), description: `Venda importada`, date: localDate.getTime(), items: [{...product, quantity: parseInt(quantityStr)}], customerId: parseInt(customerIdStr), method: paymentMethod.trim(), installments: 1, status: status.trim(), reversed: false, discount: 0 });
        });
        transactions.push(...newTransactions);
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        showToast(`${newTransactions.length} vendas importadas!`, 'success');
        document.getElementById('csv-file-input').value = '';
        saveData();
    };
    reader.readAsText(file);
}

function openSaleDetailsModal(transactionId) {
    const sale = transactions.find(t => t.id === transactionId);
    if (!sale) {
        showToast("Venda não encontrada.", "error");
        return;
    }

    const contentDiv = document.getElementById('sale-details-content');
    if (!contentDiv) {
        console.error("Elemento 'sale-details-content' não foi encontrado no modal.");
        return;
    }

    let itemsHtml = `
        <table class="w-full text-sm my-4">
            <thead>
                <tr class="border-b">
                    <th class="text-left p-1">Item</th>
                    <th class="text-center p-1">Qtd.</th>
                    <th class="text-right p-1">Preço Unit.</th>
                    <th class="text-right p-1">Total</th>
                </tr>
            </thead>
            <tbody>
    `;
    sale.items.forEach(item => {
        itemsHtml += `
            <tr>
                <td class="p-1">${item.name}</td>
                <td class="text-center p-1">${item.quantity}</td>
                <td class="text-right p-1">${formatCurrency(item.price)}</td>
                <td class="text-right p-1">${formatCurrency(item.price * item.quantity)}</td>
            </tr>
        `;
    });
    itemsHtml += '</tbody></table>';

    const subtotal = sale.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const profit = sale.amount - sale.cost;
    const discountValue = subtotal - sale.amount;

    contentDiv.innerHTML = `
        <div class="space-y-2 text-sm mb-4">
            <p><strong>ID da Venda:</strong> ${sale.id}</p>
            <p><strong>Data:</strong> ${new Date(sale.date).toLocaleString('pt-BR')}</p>
            <p><strong>Cliente:</strong> ${customers.find(c => c.id == sale.customerId)?.name || 'Não identificado'}</p>
        </div>
        ${itemsHtml}
        <div class="space-y-1 text-sm border-t pt-2">
            <div class="flex justify-between">
                <span>Subtotal:</span>
                <span>${formatCurrency(subtotal)}</span>
            </div>
            <div class="flex justify-between text-red-600">
                <span>Descontos:</span>
                <span>-${formatCurrency(discountValue)}</span>
            </div>
            <div class="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                <span>TOTAL PAGO:</span>
                <span>${formatCurrency(sale.amount)}</span>
            </div>
            <div class="mt-4 pt-4 border-t border-[var(--border-color)] space-y-1 text-sm">
                <div class="flex justify-between">
                    <span>Custo Total:</span>
                    <span class="text-red-600">-${formatCurrency(sale.cost)}</span>
                </div>
                <div class="flex justify-between font-bold">
                    <span>Lucro Líquido:</span>
                    <span class="text-green-600">${formatCurrency(profit)}</span>
                </div>
            </div>
        </div>
    `;

    openModal('modal-venda-detalhes');
}
function openCustomerDetailsModal(customerId) {
    const customer = customers.find(c => c.id == customerId);
    if (!customer) { showToast("Cliente não encontrado.", "error"); return; }
    document.getElementById('modal-cliente-detalhes').dataset.customerId = customerId;
    document.getElementById('details-customer-name').textContent = customer.name;
    const customerSales = transactions.filter(t => t.customerId == customerId);
    const listContainer = document.getElementById('details-customer-sales-list');
    renderTransactionList(listContainer, customerSales);
    openModal('modal-cliente-detalhes');
}
function populateMonthYearSelectors() {
    const monthSelect = document.getElementById('report-month-select');
    const yearSelect = document.getElementById('report-year-select');
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    if (!monthSelect || !yearSelect) return;
    monthSelect.innerHTML = monthNames.map((m, i) => `<option value="${i}" ${i === currentMonth ? 'selected' : ''}>${m}</option>`).join('');
    yearSelect.innerHTML = '';
    for (let y = currentYear; y >= 2020; y--) {
        yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
    }
}
function renderTransactionList(container, transactionList) {
    if (!container) return;
    container.innerHTML = '';
    if (transactionList.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 mt-4">Nenhuma transação encontrada para este período.</p>`;
        return;
    }
    [...transactionList].reverse().forEach(t => {
        let color = '', icon = 'fa-question-circle', profitHtml = '', actionsHtml = '', paymentInfo = '', rowClass = '', discountHtml = '';
        if (t.type === 'venda') {
            icon = 'fa-shopping-cart';
            const profit = t.amount - (t.cost || 0);
            profitHtml = `<span class="text-xs ${profit >= 0 ? 'text-green-500' : 'text-red-500'}">Lucro: ${formatCurrency(profit)}</span>`;

            if (t.discount > 0) {
                discountHtml = `<div class="text-xs text-red-500">Desconto: ${formatCurrency(t.discount)}</div>`;
            }

            actionsHtml = `<button data-id="${t.id}" class="open-sale-details-btn text-xs text-blue-600 hover:underline mr-2">Detalhes</button>`;
            if (!t.reversed) {
                actionsHtml += `<button data-id="${t.id}" class="cancel-sale-btn text-xs text-yellow-600 hover:underline mr-2">Estornar</button>`;
            } else {
                actionsHtml += `<span class="text-xs text-gray-400 mr-2">Estornada</span>`;
            }
            actionsHtml += `<button data-id="${t.id}" class="edit-sale-btn text-xs text-purple-600 hover:underline">Editar</button>`;
            if (t.status === 'Não Pago') {
                paymentInfo = ` &middot; <span class="font-bold">NÃO PAGO</span>`;
                rowClass = 'bg-red-50 text-red-800';
                color = 'text-red-600';
            } else {
                color = 'text-[var(--secondary-600)]';
                if (t.method) {
                    let badgeClass = '', methodText = t.method;
                    switch (t.method) {
                        case 'Dinheiro': badgeClass = 'badge-dinheiro'; break;
                        case 'Pix': badgeClass = 'badge-pix'; break;
                        case 'Cartão de Crédito': badgeClass = 'badge-credito'; methodText = `CRÉDITO ${t.installments > 1 ? `(${t.installments}x)` : ''}`; break;
                    }
                    paymentInfo = `<span class="payment-badge ${badgeClass}">${methodText}</span>`;
                }
            }
        }
        if (t.type === 'entrada' || t.type === 'recebimento') { color = 'text-blue-600'; icon = 'fa-arrow-down'; }
        if (t.type === 'saida') { color = 'text-red-600'; icon = 'fa-arrow-up'; }
        if (t.type === 'estorno') { color = 'text-yellow-600'; icon = 'fa-undo'; }
        container.innerHTML += `<div class="flex justify-between items-center p-2 border-b border-[var(--border-color)] ${rowClass}"><div class="flex items-center gap-3"><i class="fas ${icon} ${color}"></i><div><p class="font-semibold capitalize">${t.description}</p><p class="text-sm flex items-center">${new Date(t.date).toLocaleString('pt-BR')}${paymentInfo}</p></div></div><div class="text-right"><div><p class="font-bold ${color}">${formatCurrency(t.amount)}</p>${profitHtml}${discountHtml}</div><div class="mt-1">${actionsHtml}</div></div></div>`;
    });
}

// --- FUNÇÕES DE CATEGORIA ---
function renderCategoryFilters() {
    const container = document.getElementById('category-filters');
    if (!container) return;
    container.innerHTML = `<button data-category-id="all" class="category-filter-btn active px-3 py-1 text-sm border rounded-full border-[var(--border-color)]">Todas</button>`;
    categories.forEach(cat => {
        container.innerHTML += `<button data-category-id="${cat.id}" class="category-filter-btn px-3 py-1 text-sm border rounded-full border-[var(--border-color)]">${cat.name}</button>`;
    });
}

function renderCategoriesManagement() {
    const list = document.getElementById('categories-list');
    if (!list) return;
    list.innerHTML = '';
    categories.forEach(cat => {
        const productCount = products.filter(p => p.categoryId === cat.id).length;
        list.innerHTML += `<div class="flex justify-between items-center p-2 border-b border-[var(--border-color)]"><p>${cat.name} <span class="text-sm text-[var(--text-secondary)]">(${productCount} produtos)</span></p><div><button data-id="${cat.id}" class="edit-category-btn text-blue-500 hover:text-blue-700 p-1"><i class="fas fa-edit"></i></button><button data-id="${cat.id}" class="delete-category-btn text-red-500 hover:text-red-700 p-1 ${cat.id === 1 ? 'hidden' : ''}"><i class="fas fa-trash"></i></button></div></div>`;
    });
}

function populateCategoryDropdowns() {
    const addSelect = document.getElementById('add-product-category');
    const editSelect = document.getElementById('edit-product-category');
    if (!addSelect || !editSelect) return;
    addSelect.innerHTML = '';
    editSelect.innerHTML = '';
    categories.forEach(cat => {
        addSelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        editSelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
}

function addCategory(name) {
    if (!name.trim()) { showToast('O nome da categoria não pode estar vazio.', 'error'); return; }
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) { showToast('Categoria já existe.', 'error'); return; }
    categories.push({ id: Date.now(), name });
    renderCategoriesManagement();
    renderCategoryFilters();
    showToast('Categoria adicionada!', 'success');
    saveData();
}

function openEditCategoryModal(categoryId) {
    const category = categories.find(c => c.id === categoryId); if (!category) return;
    const form = document.getElementById('edit-category-form');
    form.elements.categoryId.value = category.id;
    form.elements.categoryName.value = category.name;
    openModal('modal-edit-categoria');
}

function handleEditCategory(e) {
    e.preventDefault();
    const form = e.target;
    const categoryId = parseInt(form.elements.categoryId.value);
    const newName = form.elements.categoryName.value;
    const category = categories.find(c => c.id === categoryId);
    if (category) {
        category.name = newName;
        renderCategoriesManagement();
        renderCategoryFilters();
        closeModal('modal-edit-categoria');
        showToast('Categoria atualizada!', 'success');
        saveData();
    }
}

function deleteCategory(categoryId) {
    if (categoryId === 1) { showToast('Não pode excluir a categoria padrão.', 'error'); return; }
    openConfirmationModal('Excluir Categoria?', 'Os produtos nesta categoria serão movidos para "Sem Categoria". Deseja continuar?', () => {
        products.forEach(p => { if (p.categoryId === categoryId) p.categoryId = 1; });
        categories = categories.filter(c => c.id !== categoryId);
        renderCategoriesManagement();
        renderCategoryFilters();
        renderProducts();
        showToast('Categoria excluída.', 'success');
        saveData();
    });
}

// --- FUNÇÕES DE BACKUP E RESTAURAÇÃO (Manual Local) ---
function exportAllData() {
    const allData = { products, customers, transactions, orders, cashBalance, rawMaterials, categories, theme: document.documentElement.getAttribute('data-theme'), backupDate: new Date().toISOString() };
    const dataStr = JSON.stringify(allData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob); const a = document.createElement('a');
    a.href = url; a.download = `backup-sistema-papelaria-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url); showToast("Backup exportado com sucesso!", "success");
}
function importAllData(event) {
    const file = event.target.files[0]; if (!file) { showToast("Nenhum ficheiro selecionado.", "error"); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (importedData.products && importedData.transactions && importedData.customers) {
                openConfirmationModal('Restaurar Backup?', 'Isto substituirá TODOS os dados atuais. Esta ação é irreversível. Deseja continuar?', () => {
                    products = importedData.products || []; customers = importedData.customers || []; transactions = importedData.transactions || [];
                    orders = importedData.orders || [];
                    cashBalance = importedData.cashBalance || 0; rawMaterials = importedData.rawMaterials || []; categories = importedData.categories || [{ id: 1, name: 'Sem Categoria' }];
                    if (importedData.theme) applyTheme(importedData.theme);
                    saveData(); initializeAppUI();
                    showToast("Backup restaurado com sucesso!", "success"); closeModal('modal-settings');
                });
            } else { showToast("O ficheiro selecionado não parece ser um backup válido.", "error"); }
        } catch (error) { showToast("Erro ao ler o ficheiro de backup.", "error"); }
        finally { event.target.value = ''; }
    };
    reader.readAsText(file);
}

// --- LÓGICA DE EDIÇÃO DE VENDA ---
function openEditSaleModal(transactionId) {
    const sale = transactions.find(t => t.id === transactionId);
    if (!sale) {
        showToast("Venda não encontrada.", "error");
        return;
    }

    const form = document.getElementById('edit-sale-form');
    form.elements.transactionId.value = sale.id;
    document.getElementById('edit-sale-total').textContent = formatCurrency(sale.amount);
    form.elements.saleStatus.value = sale.status;
    form.elements.paymentMethod.value = sale.method || 'A Prazo';
    form.elements.paymentInstallments.value = sale.installments || 1;

    const installmentsGroup = document.getElementById('edit-installments-group');
    installmentsGroup.classList.toggle('hidden', form.elements.paymentMethod.value !== 'Cartão de Crédito');

    openModal('modal-edit-venda');
}

function handleEditSale(e) {
    e.preventDefault();
    const form = document.getElementById('edit-sale-form');
    const transactionId = parseInt(form.elements.transactionId.value);
    const sale = transactions.find(t => t.id === transactionId);

    if (!sale) {
        showToast("Erro: Venda não encontrada.", "error");
        closeModal('modal-edit-venda');
        return;
    }

    const oldStatus = sale.status;
    const newStatus = form.elements.saleStatus.value;
    const newMethod = form.elements.paymentMethod.value;
    const newInstallments = parseInt(form.elements.paymentInstallments.value) || 1;

    if (oldStatus === 'Não Pago' && newStatus === 'Pago') {
        cashBalance += sale.amount;
    } else if (oldStatus === 'Pago' && newStatus === 'Não Pago') {
        cashBalance -= sale.amount;
    }

    sale.status = newStatus;
    sale.method = newMethod;
    sale.installments = newInstallments;

    updateCashBalance();
    showToast("Venda atualizada com sucesso!", "success");
    closeModal('modal-edit-venda');

    if (!document.getElementById('modal-relatorios').classList.contains('hidden')) {
        renderReports(currentReportPeriod);
    }
    if (!document.getElementById('modal-cliente-detalhes').classList.contains('hidden')) {
        const customerId = document.getElementById('modal-cliente-detalhes').dataset.customerId;
        openCustomerDetailsModal(customerId);
    }
     if (!document.getElementById('modal-contas-receber').classList.contains('hidden')) {
         renderUnpaidSales();
    }

    saveData();
}

function switchView(viewId) {
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('pos-view').classList.add('hidden');
    document.getElementById('schedule-view').classList.add('hidden');
    document.getElementById(viewId).classList.remove('hidden');
    document.querySelectorAll('.sidebar-item').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === viewId) {
            btn.classList.add('active');
        }
    });
    if (viewId === 'dashboard-view') {
        renderDashboard();
    }
    if (viewId === 'pos-view') {
        renderCategoryFilters();
    }
    if (viewId === 'schedule-view') {
        renderOrderScheduleView();
    }
}

function renderDashboard() {
    renderDashboardAlerts();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const todaysTransactions = transactions.filter(t =>
        t.date >= startOfToday.getTime() &&
        t.date <= endOfToday.getTime() &&
        t.type === 'venda' && !t.reversed
    );

    const salesToday = todaysTransactions.reduce((sum, t) => sum + t.amount, 0);
    const profitToday = todaysTransactions.reduce((sum, t) => sum + (t.amount - (t.cost || 0)), 0);
    const unpaidAmount = transactions.filter(t => t.status === 'Não Pago' && !t.reversed).reduce((sum, t) => sum + t.amount, 0);

    const salesCountToday = todaysTransactions.length;
    const averageTicket = salesCountToday > 0 ? salesToday / salesCountToday : 0;

    document.getElementById('kpi-sales-today').textContent = formatCurrency(salesToday);
    document.getElementById('kpi-profit-today').textContent = formatCurrency(profitToday);
    document.getElementById('kpi-unpaid').textContent = formatCurrency(unpaidAmount);
    document.getElementById('kpi-avg-ticket').textContent = formatCurrency(averageTicket);

    const recentTransactionsList = document.getElementById('recent-transactions-list');
    renderTransactionList(recentTransactionsList, transactions.slice(-5));
}

function openDiscountModal(itemIndex) {
    const form = document.getElementById('discount-form');
    form.reset();
    const title = document.getElementById('discount-modal-title');
    form.elements.itemIndex.value = itemIndex !== undefined ? itemIndex : '';
    if (itemIndex !== undefined) {
        title.textContent = `Desconto em ${cart.items[itemIndex].name}`;
        const currentDiscount = cart.items[itemIndex].discount;
        form.elements.discountType.value = currentDiscount.type;
        form.elements.discountValue.value = currentDiscount.value > 0 ? currentDiscount.value : '';
    } else {
        title.textContent = 'Desconto Geral na Venda';
        const currentDiscount = cart.generalDiscount;
        form.elements.discountType.value = currentDiscount.type;
        form.elements.discountValue.value = currentDiscount.value > 0 ? currentDiscount.value : '';
    }
    openModal('modal-desconto');
}

function handleDiscountForm(e) {
    e.preventDefault();
    const form = e.target;
    const itemIndex = form.elements.itemIndex.value;
    const type = form.elements.discountType.value;
    const value = parseFloat(form.elements.discountValue.value) || 0;

    if (itemIndex !== '') {
        cart.items[parseInt(itemIndex)].discount = { type, value };
    } else {
        cart.generalDiscount = { type, value };
    }
    renderCart();
    closeModal('modal-desconto');
}

function displayCustomerSummary(customerId) {
    const summaryDiv = document.getElementById('customer-info-summary');
    if (!customerId) {
        summaryDiv.classList.add('hidden');
        return;
    }
    const customer = customers.find(c => c.id == customerId);
    if (!customer || customer.id === 1) {
        summaryDiv.classList.add('hidden');
        return;
    }
    const customerSales = transactions.filter(t => t.customerId == customerId && !t.reversed);
    const totalSpent = customerSales.reduce((sum, t) => sum + t.amount, 0);
    const totalUnpaid = customerSales.filter(t => t.status === 'Não Pago').reduce((sum, t) => sum + t.amount, 0);

    summaryDiv.innerHTML = `
        <p><strong>Cliente:</strong> ${customer.name}</p>
        <p><strong>Total Comprado:</strong> ${formatCurrency(totalSpent)}</p>
        <p class="font-bold ${totalUnpaid > 0 ? 'text-red-600' : 'text-green-600'}"><strong>Saldo Devedor:</strong> ${formatCurrency(totalUnpaid)}</p>
    `;
    summaryDiv.classList.remove('hidden');
}

// --- FUNÇÕES DA AGENDA E DASHBOARD ALERT---
function renderDashboardAlerts() {
    const container = document.getElementById('dashboard-alerts-container');
    if (!container) return;

    const today = new Date().toISOString().split('T')[0];
    const dueOrders = orders.filter(o => o.deliveryDate === today && o.status !== 'finalizado');

    if (dueOrders.length === 0) {
        container.innerHTML = `
            <div class="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-lg shadow-md" role="alert">
                <p class="font-bold">Tudo em dia!</p>
                <p>Não há entregas de pedidos agendadas para hoje.</p>
            </div>
        `;
        return;
    }

    let ordersHtml = dueOrders.map(order => {
        const customer = customers.find(c => c.id === order.customerId);
        return `<li class="border-b border-yellow-300 py-2">${customer ? customer.name : 'Cliente desconhecido'} - ${order.description.substring(0, 30)}...</li>`;
    }).join('');

    container.innerHTML = `
        <div class="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-lg shadow-md" role="alert">
            <p class="font-bold">Atenção: Entregas para Hoje!</p>
            <ul class="list-disc list-inside mt-2">${ordersHtml}</ul>
        </div>
    `;
}

function renderOrderScheduleView() {
    renderOrderCalendar(calendarDate);
    renderOrderList();
}

function renderOrderCalendar(date) {
    const grid = document.getElementById('calendar-grid');
    const monthYearLabel = document.getElementById('calendar-month-year');
    if (!grid || !monthYearLabel) return;

    grid.innerHTML = '';
    const month = date.getMonth();
    const year = date.getFullYear();

    monthYearLabel.textContent = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].forEach(day => {
        grid.innerHTML += `<div class="font-bold text-[var(--text-secondary)]">${day}</div>`;
    });

    for (let i = 0; i < firstDayOfMonth; i++) {
        grid.innerHTML += `<div></div>`;
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const dayDate = new Date(year, month, i);
        const dateString = dayDate.toISOString().split('T')[0];
        const ordersForDay = orders.filter(order => order.deliveryDate === dateString);

        const dayElement = document.createElement('div');
        dayElement.className = `calendar-day cursor-pointer w-8 h-8 flex items-center justify-center`;
        dayElement.textContent = i;
        dayElement.dataset.date = dateString;

        if (ordersForDay.length > 0) {
            if (ordersForDay.some(o => o.status === 'em espera')) {
                dayElement.classList.add('has-order-espera');
            } else if (ordersForDay.some(o => o.status === 'em producao')) {
                dayElement.classList.add('has-order-producao');
            } else {
                dayElement.classList.add('has-order-finalizado');
            }
        }
        grid.appendChild(dayElement);
    }
}

function renderOrderList(filterDate = null) {
    const container = document.getElementById('order-list-container');
    if (!container) return;

    let ordersToDisplay = filterDate
        ? orders.filter(o => o.deliveryDate === filterDate)
        : [...orders];

    ordersToDisplay.sort((a, b) => new Date(a.deliveryDate) - new Date(b.deliveryDate));

    if (ordersToDisplay.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 mt-8">${filterDate ? 'Nenhum pedido para esta data.' : 'Nenhum pedido agendado.'}</p>`;
        return;
    }

    container.innerHTML = '';
    ordersToDisplay.forEach(order => {
        const customer = customers.find(c => c.id === order.customerId);
        let cardStatusClass = '', statusTextClass = '', statusText = '';

        switch (order.status) {
            case 'em espera':
                cardStatusClass = 'order-card-espera';
                statusTextClass = 'status-text-espera';
                statusText = 'Em Espera';
                break;
            case 'em producao':
                cardStatusClass = 'order-card-producao';
                statusTextClass = 'status-text-producao';
                statusText = 'Em Produção';
                break;
            case 'finalizado':
                cardStatusClass = 'order-card-finalizado';
                statusTextClass = 'status-text-finalizado';
                statusText = 'Finalizado';
                break;
        }

        container.innerHTML += `
            <div class="p-4 border rounded-lg ${cardStatusClass}">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-bold">${customer ? customer.name : 'Cliente não encontrado'}</p>
                        <p class="text-sm text-[var(--text-secondary)]">Entrega: ${new Date(order.deliveryDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                        <p class="text-sm mt-2">${order.description}</p>
                    </div>
                    <div class="text-right flex-shrink-0 ml-4">
                        <p class="font-bold text-lg text-[var(--primary-600)]">${formatCurrency(order.value)}</p>
                        <p class="status-text-lg ${statusTextClass}">${statusText}</p>
                    </div>
                </div>
                <div class="text-right mt-2">
                    <button data-id="${order.id}" class="edit-order-btn text-sm text-blue-600 hover:underline">Editar</button>
                </div>
            </div>
        `;
    });
}

function toggleOrderValueField(status, valueWrapperId, valueInputId) {
    const wrapper = document.getElementById(valueWrapperId);
    const input = document.getElementById(valueInputId);
    if (!wrapper || !input) return;

    if (status === 'em espera') {
        wrapper.classList.add('hidden');
        input.required = false;
        input.value = '';
    } else {
        wrapper.classList.remove('hidden');
        input.required = true;
    }
}

function openAddOrderModal() {
    const form = document.getElementById('add-order-form');
    form.reset();
    const customerSelect = document.getElementById('order-customer-select');
    customerSelect.innerHTML = '';
    customers.forEach(customer => {
        customerSelect.innerHTML += `<option value="${customer.id}">${customer.name}</option>`;
    });
    toggleOrderValueField('em espera', 'add-order-value-wrapper', 'add-order-value');
    openModal('modal-add-order');
}

function handleAddOrder(e) {
    e.preventDefault();
    const form = e.target;
    const status = form.elements.orderStatus.value;
    const value = status === 'em espera' ? 0 : parseFloat(form.elements.orderValue.value);

    const newOrder = {
        id: Date.now(),
        customerId: parseInt(form.elements.orderCustomer.value),
        orderDate: form.elements.orderOrderDate.value,
        deliveryDate: form.elements.orderDeliveryDate.value,
        description: form.elements.orderDescription.value,
        value: value,
        status: status
    };
    orders.push(newOrder);
    saveData();
    showToast('Pedido adicionado com sucesso!', 'success');
    closeModal('modal-add-order');
    renderOrderScheduleView();
}

function openEditOrderModal(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const form = document.getElementById('edit-order-form');
    const customer = customers.find(c => c.id === order.customerId);

    form.elements.orderId.value = order.id;
    document.getElementById('edit-order-customer-name').textContent = customer ? customer.name : 'Cliente não encontrado';
    form.elements.orderOrderDate.value = order.orderDate;
    form.elements.orderDeliveryDate.value = order.deliveryDate;
    form.elements.orderDescription.value = order.description;
    form.elements.orderValue.value = order.value;
    form.elements.orderStatus.value = order.status;

    toggleOrderValueField(order.status, 'edit-order-value-wrapper', 'edit-order-value');
    openModal('modal-edit-order');
}

function handleEditOrder(e) {
    e.preventDefault();
    const form = e.target;
    const orderId = parseInt(form.elements.orderId.value);
    const orderIndex = orders.findIndex(o => o.id === orderId);

    if (orderIndex === -1) {
        showToast('Erro: Pedido não encontrado.', 'error');
        return;
    }
    const status = form.elements.orderStatus.value;
    const value = status === 'em espera' ? 0 : parseFloat(form.elements.orderValue.value);

    orders[orderIndex] = {
        ...orders[orderIndex],
        orderDate: form.elements.orderOrderDate.value,
        deliveryDate: form.elements.orderDeliveryDate.value,
        description: form.elements.orderDescription.value,
        value: value,
        status: status
    };

    saveData();
    showToast('Pedido atualizado com sucesso!', 'success');
    closeModal('modal-edit-order');
    renderOrderScheduleView();
}

function deleteOrder() {
    const orderId = parseInt(document.getElementById('edit-order-form').elements.orderId.value);
    openConfirmationModal('Excluir Pedido?', 'Tem certeza que deseja excluir este pedido/orçamento? Esta ação não pode ser desfeita.', () => {
        orders = orders.filter(o => o.id !== orderId);
        saveData();
        showToast('Pedido excluído!', 'success');
        closeModal('modal-edit-order');
        renderOrderScheduleView();
    });
}

// --- FUNÇÕES DE BACKUP AUTOMÁTICO (LEMBRETE) ---
function showBackupReminder() {
    console.log("Mostrando lembrete de backup...");
    openModal('modal-backup-reminder');
}

function startBackupTimer() {
    if (backupInterval) {
        clearInterval(backupInterval);
    }
    const intervalMilliseconds = BACKUP_INTERVAL_MINUTES * 60 * 1000;
    backupInterval = setInterval(showBackupReminder, intervalMilliseconds);
    console.log(`Lembrete de backup configurado para cada ${BACKUP_INTERVAL_MINUTES} minutos.`);
}

// --- CENTRAL DE EVENT LISTENERS ---
function addEventListeners() {
    const safeAddListener = (id, event, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Elemento com ID "${id}" não encontrado para adicionar evento.`);
        }
    };

    safeAddListener('customer-select', 'change', (e) => {
        displayCustomerSummary(e.target.value);
    });
    safeAddListener('add-product-form', 'submit', function(e) {
        e.preventDefault();
        addProduct(this.elements.productName.value, this.elements.productPrice.value, this.elements.productCost.value, this.elements.productCategory.value, this.elements.productBarcode.value);
        this.reset();
        closeModal('modal-produto');
    });

    safeAddListener('edit-product-form', 'submit', function(e) {
        e.preventDefault();
        const p = products.find(p => p.id == this.elements.productId.value);
        if (p) {
            const newBarcode = this.elements.productBarcode.value.trim();
            if (newBarcode && products.some(prod => prod.barcode === newBarcode && prod.id != p.id)) {
                showToast('Este código de barras já está associado a outro produto!', 'error');
                return;
            }
            Object.assign(p, { name: this.elements.productName.value, price: parseFloat(this.elements.productPrice.value), cost: parseFloat(this.elements.productCost.value), categoryId: parseInt(this.elements.editProductCategory.value), barcode: newBarcode });
            renderProducts();
            const editProductListModal = document.getElementById('modal-edit-product-list');
            if (editProductListModal && !editProductListModal.classList.contains('hidden')) {
                renderProductEditList();
            }
            closeModal('modal-edit-produto');
            showToast('Produto atualizado!');
            saveData();
        }
    });

    safeAddListener('add-category-form', 'submit', function(e) { e.preventDefault(); addCategory(this.elements.categoryName.value); this.reset(); });
    safeAddListener('edit-category-form', 'submit', handleEditCategory);
    safeAddListener('add-raw-material-form', 'submit', function(e) { e.preventDefault(); addRawMaterial(this.elements.rawMaterialName.value, this.elements.rawMaterialStock.value, this.elements.rawMaterialUnit.value, this.elements.rawMaterialTotalCost.value, this.elements.rawMaterialSupplier.value, this.elements.rawMaterialReceiptDate.value); this.reset(); });
    safeAddListener('edit-raw-material-form', 'submit', function(e) { e.preventDefault(); const item = rawMaterials.find(rm => rm.id == this.elements.rawMaterialId.value); if(item) { Object.assign(item, { name: this.elements.rawMaterialName.value, supplier: this.elements.rawMaterialSupplier.value, stock: parseFloat(this.elements.rawMaterialStock.value), unit: this.elements.rawMaterialUnit.value, totalCost: parseFloat(this.elements.rawMaterialTotalCost.value), receiptDate: this.elements.rawMaterialReceiptDate.value }); renderRawMaterials(); closeModal('modal-edit-materiaprima'); showToast('Item de estoque atualizado!'); saveData(); } });
    safeAddListener('add-customer-form', 'submit', function(e) { e.preventDefault(); addCustomer(this.elements.customerName.value, this.elements.customerContact.value); this.reset(); });
    safeAddListener('edit-customer-form', 'submit', function(e) { e.preventDefault(); const c = customers.find(c => c.id == this.elements.customerId.value); if(c) { Object.assign(c, { name: this.elements.customerName.value, contact: this.elements.customerContact.value }); renderCustomers(); closeModal('modal-edit-cliente'); showToast('Cliente atualizado!'); saveData(); } });
    safeAddListener('payment-form', 'submit', processPaidSale);
    safeAddListener('receive-payment-form', 'submit', handleReceivedPayment);
    safeAddListener('edit-sale-form', 'submit', handleEditSale);
    safeAddListener('discount-form', 'submit', handleDiscountForm);
    safeAddListener('import-sales-form', 'submit', handleImportSales);

    safeAddListener('search-barcode', 'change', function(e) {
        const barcode = e.target.value.trim();
        addByBarcode(barcode);
        e.target.value = '';
    });
    safeAddListener('checkout-button', 'click', openPaymentModal);
    safeAddListener('clear-cart-button', 'click', clearCart);
    safeAddListener('search-product', 'input', (e) => {
        const activeCategory = document.querySelector('.category-filter-btn.active');
        renderProducts(e.target.value, activeCategory ? activeCategory.dataset.categoryId : 'all');
    });
    safeAddListener('open-settings-modal-btn', 'click', () => openModal('modal-settings'));
    safeAddListener('kpi-card-unpaid', 'click', () => openModal('modal-contas-receber'));
    safeAddListener('search-edit-product', 'input', function(e) { renderProductEditList(e.target.value); });

    safeAddListener('product-grid', 'click', function(e) {
        const target = e.target;
        const editButton = target.closest('.edit-product-btn');
        if (editButton) {
            e.stopPropagation();
            const productId = parseInt(editButton.dataset.id);
            if (productId) openEditProductModal(productId);
            return;
        }
        const cardAction = target.closest('[data-action="add-to-cart"]');
        if (cardAction) {
            const productId = parseInt(cardAction.dataset.id);
            if (productId) addToCart(productId);
        }
    });

    document.querySelectorAll('.open-modal-btn').forEach(btn => btn.addEventListener('click', () => openModal(btn.dataset.modalId)));
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeModal(backdrop.id);
        });
    });
    document.querySelectorAll('.close-modal-btn').forEach(btn => btn.addEventListener('click', (e) => closeModal(e.target.closest('.modal-backdrop').id)));

    safeAddListener('confirm-cancel-btn', 'click', () => closeModal('modal-confirm'));
    safeAddListener('confirm-confirm-btn', 'click', () => { if (typeof confirmCallback === 'function') confirmCallback(); closeModal('modal-confirm'); });
    safeAddListener('reset-system-btn', 'click', resetSystem);
    safeAddListener('theme-selector', 'click', (e) => { const btn = e.target.closest('.theme-button'); if (btn) applyTheme(btn.dataset.theme); });
    safeAddListener('export-data-btn', 'click', exportAllData);
    safeAddListener('import-file-input', 'change', importAllData);
    
    safeAddListener('execute-backup-btn', 'click', () => {
        exportAllData();
        closeModal('modal-backup-reminder');
        startBackupTimer(); 
    });

    safeAddListener('payment-method', 'change', function() { document.getElementById('installments-group').classList.toggle('hidden', this.value !== 'Cartão de Crédito'); document.getElementById('amount-paid-group').classList.toggle('hidden', this.value === 'Cartão de Crédito'); });
    safeAddListener('receive-payment-method', 'change', function() { document.getElementById('receive-installments-group').classList.toggle('hidden', this.value !== 'Cartão de Crédito'); });
    safeAddListener('edit-sale-method', 'change', function() { document.getElementById('edit-installments-group').classList.toggle('hidden', this.value !== 'Cartão de Crédito'); });
    safeAddListener('payment-amount-paid', 'input', updateChange);
    safeAddListener('process-unpaid-sale-btn', 'click', processSaleAsUnpaid);
    safeAddListener('apply-general-discount-btn', 'click', () => openDiscountModal());
    safeAddListener('retroactive-sale-toggle', 'change', function() { document.getElementById('retroactive-date-group').classList.toggle('hidden', !this.checked); });
    safeAddListener('print-receipt-btn', 'click', window.print);
    safeAddListener('print-details-btn', 'click', window.print);
    safeAddListener('report-month-select', 'change', () => renderReports('monthly', document.getElementById('report-month-select').value, document.getElementById('report-year-select').value));
    safeAddListener('report-year-select', 'change', () => renderReports('monthly', document.getElementById('report-month-select').value, document.getElementById('report-year-select').value));
    safeAddListener('sales-report-product-select', 'change', (e) => {
        document.getElementById('sales-report-customer-search').value = '';
        displayProductSalesReport(e.target.value);
    });
    safeAddListener('sales-report-customer-search', 'input', (e) => {
        const selectedProductId = document.getElementById('sales-report-product-select').value;
        displayProductSalesReport(selectedProductId, e.target.value);
    });

    safeAddListener('open-add-order-modal-btn', 'click', openAddOrderModal);
    safeAddListener('add-order-form', 'submit', handleAddOrder);
    safeAddListener('edit-order-form', 'submit', handleEditOrder);
    safeAddListener('delete-order-btn', 'click', deleteOrder);
    safeAddListener('add-order-status', 'change', (e) => toggleOrderValueField(e.target.value, 'add-order-value-wrapper', 'add-order-value'));
    safeAddListener('edit-order-status', 'change', (e) => toggleOrderValueField(e.target.value, 'edit-order-value-wrapper', 'edit-order-value'));
    safeAddListener('prev-month-btn', 'click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderOrderCalendar(calendarDate); });
    safeAddListener('next-month-btn', 'click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderOrderCalendar(calendarDate); });
    safeAddListener('show-all-orders-btn', 'click', () => { renderOrderList(); document.querySelectorAll('.calendar-day.selected').forEach(el => el.classList.remove('selected')); });
    safeAddListener('calendar-grid', 'click', e => {
        const dayElement = e.target.closest('.calendar-day');
        if (dayElement && dayElement.dataset.date) {
            document.querySelectorAll('.calendar-day.selected').forEach(el => el.classList.remove('selected'));
            dayElement.classList.add('selected');
            renderOrderList(dayElement.dataset.date);
        }
    });

    document.body.addEventListener('click', e => {
        const target = e.target.closest('button, tr');
        if (!target) return;

        const classList = target.classList;
        const dataset = target.dataset;

        if (classList.contains('edit-product-btn') && !target.closest('.product-card')) {
            openEditProductModal(parseInt(dataset.id));
        } else if (classList.contains('increase-qty-btn')) {
            increaseCartItemQuantity(dataset.index);
        } else if (classList.contains('decrease-qty-btn')) {
            decreaseCartItemQuantity(dataset.index);
        } else if (classList.contains('remove-from-cart-btn')) {
            removeFromCart(dataset.index);
        } else if (target.id === 'delete-product-btn') {
            deleteProduct();
        } else if (classList.contains('edit-category-btn')) {
            openEditCategoryModal(parseInt(dataset.id));
        } else if (classList.contains('delete-category-btn')) {
            deleteCategory(parseInt(dataset.id));
        } else if (classList.contains('edit-stock-item-btn')) {
            openEditRawMaterialModal(parseInt(dataset.id));
        } else if (classList.contains('delete-stock-item-btn')) {
            deleteRawMaterial(parseInt(dataset.id));
        } else if (classList.contains('edit-customer-btn')) {
            openEditCustomerModal(parseInt(dataset.id));
        } else if (classList.contains('delete-customer-btn')) {
            deleteCustomer(parseInt(dataset.id));
        } else if (classList.contains('open-sale-details-btn')) {
            openSaleDetailsModal(parseInt(dataset.id));
        } else if (classList.contains('cancel-sale-btn')) {
            cancelSale(parseInt(dataset.id));
        } else if (classList.contains('delete-sale-btn')) {
            deleteTransaction(parseInt(dataset.id));
        } else if (classList.contains('edit-sale-btn')) {
            openEditSaleModal(parseInt(dataset.id));
        } else if (classList.contains('receive-payment-btn')) {
            openReceivePaymentModal(parseInt(dataset.id));
        } else if (classList.contains('tab-button')) {
            switchTab(dataset.tab);
        } else if (classList.contains('period-button')) {
            setReportPeriod(dataset.period);
        } else if (classList.contains('customer-details-row')) {
            openCustomerDetailsModal(dataset.customerId);
        } else if (classList.contains('sidebar-item') || classList.contains('quick-action-btn')) {
            switchView(dataset.view);
        } else if (classList.contains('apply-item-discount-btn')) {
            openDiscountModal(parseInt(dataset.index));
        } else if (classList.contains('category-filter-btn')) {
            document.querySelectorAll('.category-filter-btn').forEach(btn => btn.classList.remove('active'));
            target.classList.add('active');
            renderProducts(document.getElementById('search-product').value, dataset.categoryId);
        } else if (classList.contains('edit-order-btn')) {
            openEditOrderModal(parseInt(dataset.id));
        }
    });

    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    const openSidebar = () => {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    };

    const closeSidebar = () => {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    };

    safeAddListener('hamburger-btn', 'click', openSidebar);
    safeAddListener('sidebar-overlay', 'click', closeSidebar);

    sidebar.addEventListener('click', (e) => {
        if (e.target.closest('.sidebar-item')) {
            if (!overlay.classList.contains('hidden')) {
                closeSidebar();
            }
        }
    });
}