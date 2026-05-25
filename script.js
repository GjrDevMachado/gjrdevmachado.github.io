// ===================================================================================
// CONFIGURAÇÕES GLOBAIS E BANCO DE DADOS (SUPABASE)
// ===================================================================================
const supabaseUrl = 'https://rtshjmbfiivpyotnhynr.supabase.co';
const supabaseKey = 'sb_publishable_kOanAOaHTzdck06LzPAn_A_xB5OjeCT';

// MUDAMOS O NOME AQUI PARA NÃO DAR CONFLITO
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- DADOS EM MEMÓRIA ---
let products = [];
let customers = [];
let transactions = [];
let cashBalance = 0.00;
let rawMaterials = [];
let categories = [];
let cart = { items: [], generalDiscount: { type: 'fixed', value: 0 } };
let salesChart;
let currentReportPeriod = 'daily';
let confirmCallback = null;
let areEventListenersAdded = false;
let productSalesReportData = null;

let backupInterval = null;
const BACKUP_INTERVAL_MINUTES = 60;

// --- FUNÇÃO PARA CARREGAR MÁQUINAS, INSUMOS E ORÇAMENTOS DO SUPABASE ---
async function loadOrcamentoDataFromSupabase() {
    try {
        const { data: maquinasData } = await supabaseClient.from('maquinas').select('*');
        if (maquinasData && maquinasData.length > 0) {
            machines = maquinasData.map(m => ({
                id: m.id, name: m.nome, power: parseFloat(m.potencia),
                electricityPrice: parseFloat(m.preco_luz), machineValue: parseFloat(m.valor_maquina),
                yearsOfUse: parseFloat(m.anos_uso), hoursPerDay: parseFloat(m.horas_dia),
                depreciation: parseFloat(m.depreciacao) || 0, costPerHour: parseFloat(m.custo_hora)
            }));
        }

        const { data: insumosData } = await supabaseClient.from('insumos_orcamento').select('*');
        if (insumosData && insumosData.length > 0) {
            supplyCatalog = insumosData.map(s => ({
                id: s.id, name: s.nome, packagePrice: parseFloat(s.preco_pacote),
                packageQuantity: parseFloat(s.qtd_pacote), unitCost: parseFloat(s.custo_unitario)
            }));
        }

        const { data: orcamentosData } = await supabaseClient.from('orcamentos').select('*');
        if (orcamentosData && orcamentosData.length > 0) {
            savedBudgets = orcamentosData.map(b => ({
                id: b.id, date: b.data, clienteName: b.cliente_nome,
                clienteId: b.cliente_id ? String(b.cliente_id) : '',
                produto: b.produto, quantidade: parseFloat(b.quantidade),
                custoTotal: parseFloat(b.custo_total), precoSugerido: parseFloat(b.preco_sugerido),
                precoFinal: parseFloat(b.preco_final), lucro: parseFloat(b.lucro),
                margem: parseFloat(b.margem), taxa: parseFloat(b.taxa_plataforma),
                taxaFixa: parseFloat(b.taxa_fixa), tempoGasto: parseFloat(b.tempo_gasto),
                valorHora: parseFloat(b.valor_hora),
                materials: b.materiais_json ? JSON.parse(b.materiais_json) : [],
                machines: b.maquinas_json ? JSON.parse(b.maquinas_json) : [],
                custoMateriais: parseFloat(b.custo_materiais) || 0,
                custoMaquinas: parseFloat(b.custo_maquinas) || 0,
                custoMO: parseFloat(b.custo_mo) || 0,
                custoFixo: parseFloat(b.custo_fixo) || 0,
                modoCalculo: b.modo_calculo || 'grafica',
                peso: parseFloat(b.peso) || 0, filamentoId: b.filamento_id ? parseInt(b.filamento_id) : 0,
                tempoImpressao: parseFloat(b.tempo_impressao) || 0,
                falhas: parseFloat(b.falhas) || 10, acabamento: parseFloat(b.acabamento) || 10,
                fixacao: parseFloat(b.fixacao) || 0.10, roiMeses: parseFloat(b.roi_meses) || 12,
                maquinasAtivas: parseFloat(b.maquinas_ativas) || 1,
                aluguel: 0, internet: 0, mei: 0, outros: 0, horasDia: 1, diasMes: 1,
                status: b.status || 'rascunho', createdAt: b.created_at || b.data
            }));
            const fixosData = orcamentosData.map(b => {
                if (b.custos_fixos_json) {
                    try { return JSON.parse(b.custos_fixos_json); } catch(e) {}
                }
                return {};
            });
            savedBudgets.forEach((b, i) => {
                const f = fixosData[i] || {};
                b.aluguel = parseFloat(f.aluguel) || 0;
                b.internet = parseFloat(f.internet) || 0;
                b.mei = parseFloat(f.mei) || 0;
                b.outros = parseFloat(f.outros) || 0;
                b.horasDia = parseFloat(f.horas_dia) || 1;
                b.diasMes = parseFloat(f.dias_mes) || 1;
            });
        }
    } catch (error) {
        console.error("Erro ao carregar dados de orçamento do Supabase:", error);
    }
    saveOrcamentoData();
}

// --- FUNÇÃO PARA SALVAR LOCALMENTE (Para o Caixa e Tema) ---
function saveData() {
    try {
        localStorage.setItem('cashBalance', JSON.stringify(cashBalance));
        localStorage.setItem('theme', document.documentElement.getAttribute('data-theme'));
    } catch (error) {
        console.error("Erro ao guardar dados:", error);
    }
}

// --- CARREGAR DADOS DO SUPABASE ---
async function loadDataFromSupabase() {
    toggleLoading(true);
    try {
        const { data: categoriasData } = await supabaseClient.from('categorias').select('*');
        categories = (categoriasData && categoriasData.length > 0) ? categoriasData.map(c => ({ id: c.id, name: c.nome })) : [{ id: 1, name: 'Sem Categoria' }];

        const { data: produtosData } = await supabaseClient.from('produtos').select('*');
        products = (produtosData || []).map(p => ({ id: p.id, name: p.nome, price: parseFloat(p.preco), cost: parseFloat(p.custo), categoryId: p.categoria_id, barcode: p.codigo_barras }));

        const { data: clientesData } = await supabaseClient.from('clientes').select('*');
        customers = (clientesData && clientesData.length > 0) ? clientesData.map(c => ({ id: c.id, name: c.nome, contact: c.contato || '' })) : [{ id: 1, name: 'Cliente Balcão', contact: '' }];

        const { data: insumosData } = await supabaseClient.from('insumos').select('*');
        rawMaterials = (insumosData || []).map(rm => ({ id: rm.id, name: rm.nome, supplier: rm.fornecedor || '', stock: parseFloat(rm.estoque), unit: rm.unidade, totalCost: parseFloat(rm.custo_total), receiptDate: rm.data_recebimento ? rm.data_recebimento.split('T')[0] : '' }));

        const { data: transacoesData, error: transacoesError } = await supabaseClient.from('transacoes').select('*');
        const { data: itensData, error: itensError } = await supabaseClient.from('itens_transacao').select('*');
        if (transacoesError) console.error('Erro ao carregar transacoes:', transacoesError);
        if (itensError) console.error('Erro ao carregar itens_transacao:', itensError);

        transactions = (transacoesData || []).map(t => {
            let itensDestaTransacao = (itensData || []).filter(item => String(item.transacao_id) === String(t.id));
            
            let itemsFormatados;
            if (itensDestaTransacao.length > 0) {
                itemsFormatados = itensDestaTransacao.map(item => {
                    const produtoOriginal = products.find(p => String(p.id) === String(item.produto_id)) || {};
                    return { 
                        id: item.produto_id, 
                        name: produtoOriginal.name || 'Produto Excluído', 
                        price: parseFloat(item.preco_unitario), 
                        quantity: parseInt(item.quantidade), 
                        cost: parseFloat(produtoOriginal.cost || 0), 
                        discount: { type: 'fixed', value: parseFloat(item.desconto_item) || 0 } 
                    };
                });
            } else if (t.descricao && t.tipo === 'venda') {
                try {
                    const parsed = JSON.parse(t.descricao);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        itemsFormatados = parsed.map(item => ({
                            id: item.id,
                            name: item.name || 'Produto',
                            price: parseFloat(item.price),
                            quantity: parseInt(item.quantity),
                            cost: parseFloat(item.cost || 0),
                            discount: item.discount || { type: 'fixed', value: 0 }
                        }));
                    } else {
                        itemsFormatados = [];
                    }
                } catch (e) {
                    itemsFormatados = [];
                }
            } else {
                itemsFormatados = [];
            }
            
            const quantidadeTotal = itemsFormatados.reduce((sum, i) => sum + i.quantity, 0);

            return { 
                id: t.id, 
                type: t.tipo, 
                amount: parseFloat(t.valor_total), 
                cost: parseFloat(t.custo_total || 0), 
                discount: parseFloat(t.desconto_geral || 0), 
                description: t.tipo === 'venda' ? `Venda de ${quantidadeTotal} item(s)` : (t.descricao || t.tipo),
                date: new Date(t.data_venda).getTime(), 
                customerId: t.cliente_id, 
                method: t.metodo_pagamento, 
                installments: t.parcelas, 
                status: t.status, 
                reversed: t.estornada || false, 
                items: itemsFormatados 
            };
        });

        transactions.sort((a, b) => a.date - b.date);

        cashBalance = JSON.parse(localStorage.getItem('cashBalance')) || 0.00;
        const savedTheme = localStorage.getItem('theme') || 'light';
        applyTheme(savedTheme);

        await loadOrcamentoDataFromSupabase();

    } catch (error) {
        console.error("Erro ao conectar com o Supabase:", error);
    } finally {
        initializeAppUI();
        toggleLoading(false);
    }
}

// --- LÓGICA DE LOGIN E SESSÃO ---
window.onload = async function() {
    toggleLoading(true);
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        showApp();
    } else {
        showLogin();
    }
};

function showApp() {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('app-layout').style.display = 'block';
    loadDataFromSupabase();
}

function showLogin() {
    document.getElementById('login-view').style.display = 'flex';
    document.getElementById('app-layout').style.display = 'none';
    toggleLoading(false);
}

async function logout() {
    toggleLoading(true);
    await supabaseClient.auth.signOut();
    window.location.reload();
}

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    toggleLoading(true);
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        showToast("E-mail ou senha incorretos!", "error");
        toggleLoading(false);
    } else {
        showToast("Login efetuado com sucesso!", "success");
        showApp();
    }
});

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
    
    startBackupTimer();
}

// --- FUNÇÕES DE LÓGICA PRINCIPAL ---
async function addProduct(name, price, cost, categoryId, barcode) {
    if (products.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        showToast('Produto com este nome já está registado!', 'error');
        return;
    }
    if (barcode && products.some(p => p.barcode === barcode)) {
        showToast('Este código de barras já está associado a outro produto!', 'error');
        return;
    }

    toggleLoading(true);
    try {
        const novoProduto = {
            id: Date.now(),
            nome: name,
            preco: parseFloat(price),
            custo: parseFloat(cost),
            categoria_id: parseInt(categoryId) || 1,
            codigo_barras: barcode ? barcode.trim() : null
        };

        const { error } = await supabaseClient.from('produtos').insert([novoProduto]);
        if (error) throw error;

        showToast('Novo produto adicionado na nuvem!');
        await loadDataFromSupabase(); 
        
    } catch (error) {
        console.error("Erro ao salvar produto:", error);
        showToast('Erro ao salvar produto no banco.', 'error');
    } finally {
        toggleLoading(false);
    }
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

function getLocalDateAsString(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

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
        card.className = `product-card relative flex flex-col p-4 rounded-lg shadow cursor-pointer hover:bg-[var(--bg-secondary)]`;
        card.setAttribute('title', product.name);

        card.innerHTML = `
            <div class="flex flex-col flex-1" data-action="add-to-cart" data-id="${product.id}">
                <h3 class="font-bold truncate mb-1">${product.name}</h3>
                <div class="mt-auto">
                    <p class="text-[var(--primary-600)] font-semibold">${formatCurrency(product.price)}</p>
                    <p class="text-xs text-red-500/80">Custo: ${formatCurrency(product.cost)}</p>
                    ${product.cost > 0 ? `<p class="text-xs text-green-600">Margem: ${(((product.price - product.cost) / product.cost) * 100).toFixed(1)}%</p>` : ''}
                </div>
            </div>
            <div class="flex justify-end gap-1 pt-2 border-t border-[var(--border-color)]" data-no-action>
                <button data-id="${product.id}" class="edit-product-btn text-blue-500 hover:text-blue-700 p-1 transition-colors" title="Editar ${product.name}"><i class="fas fa-edit"></i></button>
                <button data-id="${product.id}" class="view-product-budget-btn text-yellow-600 hover:text-yellow-800 p-1 transition-colors" title="Detalhes"><i class="fas fa-clipboard-list"></i></button>
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
                <td class="p-2 text-center whitespace-nowrap">
                    <button data-id="${p.id}" class="edit-product-btn text-blue-500 p-1" title="Editar ${p.name}"><i class="fas fa-edit"></i></button>
                    <button data-id="${p.id}" class="view-product-budget-btn text-yellow-600 p-1" title="Detalhes"><i class="fas fa-clipboard-list"></i></button>
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

function getFilteredTransactions(period, month, year) {
    const now = new Date();
    let startDate;
    let endDate = new Date();

    if (period === 'annual') {
        const selectedYear = parseInt(year) || now.getFullYear();
        startDate = new Date(selectedYear, 0, 1);
        endDate = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
    } else if (period === 'monthly') {
        const selectedYear = parseInt(year) || now.getFullYear();
        const selectedMonth = parseInt(month) ?? now.getMonth();
        startDate = new Date(selectedYear, selectedMonth, 1);
        endDate = new Date(selectedYear, selectedMonth + 1, 0);
        endDate.setHours(23, 59, 59, 999);
    } else {
        switch(period) {
            case 'daily': 
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); 
                break;
            case 'weekly': 
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const dayOfWeek = startDate.getDay();
                const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                startDate.setDate(startDate.getDate() - daysToMonday);
                startDate.setHours(0, 0, 0, 0);
                
                endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + 6);
                endDate.setHours(23, 59, 59, 999);
                break;
            default: 
                startDate = new Date(); 
                startDate.setDate(startDate.getDate() - 7);
                startDate.setHours(0, 0, 0, 0);
                break;
        }
    }
    
    return transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= startDate && transactionDate <= endDate;
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    document.querySelector(`.tab-button[data-tab="${tabName}"]`).classList.add('active');
    
    if (tabName === 'vendas' || tabName === 'recebimentos' || tabName === 'vendas-cliente') {
        setReportPeriod(currentReportPeriod);
    } else if (tabName === 'desempenho-produtos') {
        renderProductPerformanceReport();
    } else if (tabName === 'vendas-produto') {
        initializeProductSalesReport();
    }
}

function renderReports(period = currentReportPeriod, month, year) {
    try {
        const filteredTransactions = getFilteredTransactions(period, month, year);
        const annualSummaryTable = document.getElementById('annual-summary-table');
        const transactionsList = document.getElementById('transactions-list');
        
        if(transactionsList) transactionsList.classList.toggle('hidden', period === 'annual');
        if(annualSummaryTable) annualSummaryTable.classList.toggle('hidden', period !== 'annual');

        const salesSummary = document.getElementById('sales-summary');
        const salesTransactions = filteredTransactions.filter(t => t.type === 'venda' && !t.reversed);

        const totalRevenue = salesTransactions.reduce((s, t) => s + t.amount, 0);
        const totalDiscounts = salesTransactions.reduce((s, t) => s + (t.discount || 0), 0);
        const grossRevenue = totalRevenue; 
        const totalCost = salesTransactions.reduce((s, t) => s + (t.cost || 0), 0);
        const profit = totalRevenue - totalCost;

        if(salesSummary) {
            salesSummary.className = "grid grid-cols-2 md:grid-cols-5 gap-4 text-center mb-4";
            salesSummary.innerHTML = `
                <div class="p-2 bg-[var(--bg-tertiary)] rounded-lg">
                    <p class="text-sm text-[var(--text-secondary)]">Faturamento Total</p>
                    <p class="text-lg font-bold">${formatCurrency(grossRevenue)}</p>
                </div>
                <div class="p-2 bg-[var(--bg-tertiary)] rounded-lg">
                    <p class="text-sm text-[var(--text-secondary)]">Total Descontos</p>
                    <p class="text-lg font-bold text-red-500">${formatCurrency(totalDiscounts)}</p>
                </div>
                <div class="p-2 bg-[var(--bg-tertiary)] rounded-lg">
                    <p class="text-sm text-[var(--text-secondary)]">Custo Produtos</p>
                    <p class="text-lg font-bold text-[var(--danger-600)]">${formatCurrency(totalCost)}</p>
                </div>
                <div class="p-2 bg-[var(--bg-tertiary)] rounded-lg">
                    <p class="text-sm text-[var(--text-secondary)]">Lucro Líquido</p>
                    <p class="text-lg font-bold text-[var(--secondary-600)]">${formatCurrency(profit)}</p>
                </div>
                <div class="p-2 bg-[var(--bg-tertiary)] rounded-lg">
                    <p class="text-sm text-[var(--text-secondary)]">Margem de Lucro</p>
                    <p class="text-lg font-bold text-[var(--secondary-600)]">${(grossRevenue > 0 ? (profit / grossRevenue) * 100 : 0).toFixed(2)}%</p>
                </div>
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
                annualSummaryTable.innerHTML = `<table class="w-full text-left text-sm"><thead><tr class="border-b border-[var(--border-color)]"><th class="p-2">Mês</th><th class="text-right">Faturamento</th><th class="text-right">Descontos</th><th class="text-right">Custo</th><th class="text-right">Lucro Líquido</th><th class="text-right">Margem %</th></tr></thead><tbody></tbody></table>`;
                const annualTbody = annualSummaryTable.querySelector('tbody');
                monthlyData.forEach((monthData, index) => {
                    const totalPaidAndUnpaid = monthData.paid + monthData.unpaid;
                    const grossMonthRevenue = totalPaidAndUnpaid; 
                    const profit = totalPaidAndUnpaid - monthData.cost;
                    const profitPercentage = grossMonthRevenue > 0 ? (profit / grossMonthRevenue) * 100 : 0;
                    
                    annualTbody.innerHTML += `<tr><td class="p-2 font-semibold">${monthNames[index]}</td><td class="text-right">${formatCurrency(grossMonthRevenue)}</td><td class="text-right text-red-600">${formatCurrency(monthData.discount)}</td><td class="text-right">${formatCurrency(monthData.cost)}</td><td class="text-right ${profit >= 0 ? 'text-green-600' : 'text-red-600'}">${formatCurrency(profit)}</td><td class="text-right ${profit >= 0 ? 'text-green-600' : 'text-red-600'}">${profitPercentage.toFixed(2)}%</td></tr>`;
                });
            }
        } else {
            const salesByDate = {};
            let startDateForLoop = new Date();
            let endDateForLoop = new Date();
            
            if (period === 'weekly') {
                startDateForLoop = new Date();
                const dayOfWeek = startDateForLoop.getDay();
                const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                startDateForLoop.setDate(startDateForLoop.getDate() - daysToMonday);
                startDateForLoop.setHours(0,0,0,0);
                
                endDateForLoop = new Date(startDateForLoop);
                endDateForLoop.setDate(endDateForLoop.getDate() + 6);
                endDateForLoop.setHours(23,59,59,999);
            } else if (period === 'daily') {
                startDateForLoop.setHours(0,0,0,0);
                endDateForLoop.setHours(23,59,59,999);
            } else if (period === 'monthly') {
                const selectedYear = parseInt(year) || new Date().getFullYear();
                const selectedMonth = parseInt(month) ?? new Date().getMonth();
                startDateForLoop = new Date(selectedYear, selectedMonth, 1);
                endDateForLoop = new Date(selectedYear, selectedMonth + 1, 0);
                endDateForLoop.setHours(23,59,59,999);
            }

            let loopDate = new Date(startDateForLoop);
            loopDate.setHours(0,0,0,0);

            while(loopDate <= endDateForLoop) {
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
                    let dateLabel = new Date(day + 'T00:00:00').toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'});
                    if (period === 'weekly') {
                        const dayName = new Date(day + 'T00:00:00').toLocaleDateString('pt-BR', {weekday: 'short'});
                        dateLabel = dayName + ' (' + dateLabel + ')';
                    }
                    salesData.labels.push(dateLabel);
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
        showToast("Ocorreu un erro ao Gerar o informe.", "error");
    }
}

function renderRecebimentosReport(period = currentReportPeriod, month, year) {
    const container = document.getElementById('tab-recebimentos');
    if (!container) return;

    const filteredTransactions = getFilteredTransactions(period, month, year);

    const paidLaterSaleIds = new Set();
    transactions.forEach(t => {
        if (t.type === 'recebimento' && t.description.includes('Recebimento da venda #')) {
            const saleId = parseInt(t.description.split('#')[1]);
            if (!isNaN(saleId)) {
                paidLaterSaleIds.add(saleId);
            }
        }
    });

    const recebimentos = filteredTransactions.filter(t => {
        if (t.type === 'recebimento') {
            return true;
        }
        if (t.type === 'venda' && t.status === 'Pago' && !t.reversed) {
            return !paidLaterSaleIds.has(t.id);
        }
        return false;
    });
    
    const totalsByMethod = { 'Dinheiro': 0, 'Pix': 0, 'Cartão de Crédito': 0, 'total': 0 };
    
    recebimentos.forEach(t => {
        const methods = parsePaymentMethods(t.method);
        if (methods.length > 1) {
            methods.forEach(m => {
                if (totalsByMethod.hasOwnProperty(m.method)) {
                    totalsByMethod[m.method] += m.amount;
                }
            });
        } else if (totalsByMethod.hasOwnProperty(t.method)) {
            totalsByMethod[t.method] += t.amount;
        }
        totalsByMethod.total += t.amount;
    });
    
    let summaryHtml = `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div class="p-4 bg-green-100 rounded-lg text-center shadow">
                <p class="text-sm font-medium text-green-800">Total Dinheiro</p>
                <p class="text-2xl font-bold text-green-900">${formatCurrency(totalsByMethod['Dinheiro'])}</p>
            </div>
            <div class="p-4 bg-cyan-100 rounded-lg text-center shadow">
                <p class="text-sm font-medium text-cyan-800">Total Pix</p>
                <p class="text-2xl font-bold text-cyan-900">${formatCurrency(totalsByMethod['Pix'])}</p>
            </div>
            <div class="p-4 bg-blue-100 rounded-lg text-center shadow">
                <p class="text-sm font-medium text-blue-800">Total Cartão</p>
                <p class="text-2xl font-bold text-blue-900">${formatCurrency(totalsByMethod['Cartão de Crédito'])}</p>
            </div>
            <div class="p-4 bg-gray-200 rounded-lg text-center shadow">
                <p class="text-sm font-medium text-gray-800">Total Geral Recebido</p>
                <p class="text-2xl font-bold text-gray-900">${formatCurrency(totalsByMethod.total)}</p>
            </div>
        </div>
    `;
    
    let tableHtml = `<div class="overflow-x-auto"><table class="w-full text-left text-sm">
        <thead>
            <tr class="border-b">
                <th class="p-2">Data</th>
                <th class="p-2">Descrição</th>
                <th class="p-2">Método</th>
                <th class="p-2 text-right">Valor</th>
            </tr>
        </thead>
        <tbody>`;
        
    if (recebimentos.length === 0) {
        tableHtml += '<tr><td colspan="4" class="text-center p-4 text-gray-500">Nenhum recebimento no período.</td></tr>';
    } else {
        recebimentos.sort((a, b) => b.date - a.date).forEach(t => {
            const methodDisplay = formatPaymentMethods(t.method, t.installments);
            let badgeClass = '';
            let methodText = methodDisplay;
            const methods = parsePaymentMethods(t.method);
            const firstMethod = methods.length > 0 ? methods[0].method : (t.method || '');
            switch (firstMethod) {
                case 'Dinheiro': badgeClass = 'badge-dinheiro'; break;
                case 'Pix': badgeClass = 'badge-pix'; break;
                case 'Cartão de Crédito': badgeClass = 'badge-credito'; break;
                default: badgeClass = ''; break;
            }

            tableHtml += `
                <tr class="border-b hover:bg-[var(--bg-tertiary)]">
                    <td class="p-2">${new Date(t.date).toLocaleString('pt-BR')}</td>
                    <td class="p-2">${t.description}</td>
                    <td class="p-2"><span class="payment-badge ${badgeClass}">${methodText}</span></td>
                    <td class="p-2 text-right font-semibold text-green-600">${formatCurrency(t.amount)}</td>
                </tr>
            `;
        });
    }

    tableHtml += `</tbody></table></div>`;
    container.innerHTML = summaryHtml + tableHtml;
}


function renderSalesByCustomerReport(period = currentReportPeriod, month, year) {
    const container = document.getElementById('sales-by-customer-container');
    if(!container) return;

    const filteredTransactions = getFilteredTransactions(period, month, year);

    const salesByCustomer = filteredTransactions.filter(t => t.type === 'venda' && !t.reversed).reduce((acc, sale) => {
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
        acc[customerId].total += sale.amount;
        acc[customerId].count++;
        if (sale.status === 'Não Pago') {
            acc[customerId].unpaid += sale.amount;
        } else {
            acc[customerId].paid += sale.amount;
        }
        return acc;
    }, {});

    let tableHtml = `<table class="w-full text-left mt-4"><thead><tr class="border-b"><th class="p-2">Cliente</th><th class="text-right">Total Comprado</th><th class="text-right">Total Pago</th><th class="text-right">Total Devido</th><th class="text-center">Nº de Vendas</th></tr></thead><tbody>`;
    
    if (Object.keys(salesByCustomer).length === 0) {
        tableHtml += '<tr><td colspan="5" class="text-center p-4 text-gray-500">Nenhuma venda para clientes neste período.</td></tr>';
    } else {
        Object.entries(salesByCustomer).sort(([,a],[,b]) => b.total - a.total).forEach(([customerId, data]) => {
            tableHtml += `<tr class="hover:bg-[var(--bg-secondary)] cursor-pointer customer-details-row" data-customer-id="${customerId}"><td class="p-2 font-semibold">${data.customerName}</td><td class="text-right">${formatCurrency(data.total)}</td><td class="text-right text-green-600">${formatCurrency(data.paid)}</td><td class="text-right text-red-600">${formatCurrency(data.unpaid)}</td><td class="text-center">${data.count}</td></tr>`;
        });
    }
    
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
        const methods = parsePaymentMethods(sale.method);
        if (methods.length > 1) {
            methods.forEach(m => { if (summary.byMethod.hasOwnProperty(m.method)) summary.byMethod[m.method] += m.amount; });
        } else if (sale.method && summary.byMethod.hasOwnProperty(sale.method)) {
            summary.byMethod[sale.method] += sale.amount;
        }
    });
    todaysTransactions.filter(t => t.type === 'recebimento').forEach(receipt => {
        summary.totalSales += receipt.amount;
        const methods = parsePaymentMethods(receipt.method);
        if (methods.length > 1) {
            methods.forEach(m => { if (summary.byMethod.hasOwnProperty(m.method)) summary.byMethod[m.method] += m.amount; });
        } else if (receipt.method && summary.byMethod.hasOwnProperty(receipt.method)) {
            summary.byMethod[receipt.method] += receipt.amount;
        }
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
    
    const activeTabButton = document.querySelector('.tab-button.active');
    if (!activeTabButton) return; 
    const activeTab = activeTabButton.dataset.tab;

    const monthYearSelector = document.getElementById('month-year-selector');
    const monthSelect = document.getElementById('report-month-select');
    const yearSelect = document.getElementById('report-year-select');

    if (monthYearSelector && monthSelect && yearSelect) {
        if (period === 'monthly') {
            monthYearSelector.classList.remove('hidden');
            monthSelect.classList.remove('hidden');
            yearSelect.classList.remove('hidden');
        } else if (period === 'annual') {
            monthYearSelector.classList.remove('hidden');
            monthSelect.classList.add('hidden'); 
            yearSelect.classList.remove('hidden'); 
        } else {
            monthYearSelector.classList.add('hidden');
        }
    }

    let month = monthSelect ? monthSelect.value : new Date().getMonth();
    let year = yearSelect ? yearSelect.value : new Date().getFullYear();
    
    if (activeTab === 'vendas') {
        renderReports(period, month, year);
    } else if (activeTab === 'recebimentos') {
        renderRecebimentosReport(period, month, year);
    } else if (activeTab === 'vendas-cliente') {
        renderSalesByCustomerReport(period, month, year);
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

async function processSale(paymentDetails) {
    if (cart.items.length === 0) return;
    
    toggleLoading(true);
    try {
        const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        let totalDiscount = cart.items.reduce((sum, item) => {
            const itemTotal = item.price * item.quantity;
            return sum + (item.discount.type === 'percentage' ? (itemTotal * item.discount.value / 100) : item.discount.value);
        }, 0);
        
        let generalDiscountAmount = 0;
        if (cart.generalDiscount.value > 0) {
            generalDiscountAmount = cart.generalDiscount.type === 'percentage' ? ((subtotal - totalDiscount) * cart.generalDiscount.value / 100) : cart.generalDiscount.value;
            totalDiscount += generalDiscountAmount;
        }
        
        const total = subtotal - totalDiscount;
        
        let totalCost = cart.items.reduce((sum, item) => sum + (item.cost * item.quantity), 0);

        if (paymentDetails.netReceived !== null && paymentDetails.netReceived !== undefined && !isNaN(paymentDetails.netReceived)) {
            if (paymentDetails.netReceived < total && paymentDetails.netReceived >= 0) {
                const taxaEmReais = total - paymentDetails.netReceived;
                totalCost += taxaEmReais;
            }
        }

        const customerId = document.getElementById('customer-select').value || 1;

        const saleDate = paymentDetails.isRetroactive && paymentDetails.date ? new Date(paymentDetails.date).toISOString() : new Date().toISOString();
        const transacaoId = Date.now(); 

        const itensParaDescricao = cart.items.map(item => ({
            id: item.id, name: item.name, price: item.price,
            quantity: item.quantity, cost: item.cost, discount: item.discount
        }));

        const methodsStr = JSON.stringify(paymentDetails.methods || [{ method: 'Dinheiro', amount: total, installments: 1 }]);
        const maxInstallments = (paymentDetails.methods || []).reduce((max, m) => Math.max(max, m.installments || 1), 1);

        const novaTransacao = {
            id: transacaoId, 
            tipo: 'venda',
            cliente_id: parseInt(customerId),
            valor_total: total,
            custo_total: totalCost,
            desconto_geral: generalDiscountAmount,
            descricao: JSON.stringify(itensParaDescricao),
            metodo_pagamento: methodsStr,
            parcelas: maxInstallments,
            status: paymentDetails.status,
            data_venda: saleDate
        };

        const { error: transacaoError } = await supabaseClient.from('transacoes').insert([novaTransacao]);
        if (transacaoError) throw transacaoError;

        const itensParaInserir = cart.items.map(item => {
            const itemTotal = item.price * item.quantity;
            const descontoItem = item.discount.value > 0 ? (item.discount.type === 'percentage' ? (itemTotal * item.discount.value / 100) : item.discount.value) : 0;
            return {
                transacao_id: transacaoId,
                produto_id: item.id,
                quantidade: item.quantity,
                preco_unitario: item.price,
                desconto_item: descontoItem
            };
        });

        const { error: itensError } = await supabaseClient.from('itens_transacao').insert(itensParaInserir);
        if (itensError) throw itensError;

        if (paymentDetails.status === 'Pago' && !paymentDetails.isRetroactive) {
            cashBalance += total;
            saveData(); 
        }

        showToast('Venda registada com sucesso na nuvem!', 'success');
        
        if (paymentDetails.status === 'Pago') {
            const transacaoRecibo = {
                id: transacaoId, amount: total, discount: totalDiscount, method: methodsStr,
                installments: maxInstallments, date: new Date(saleDate).getTime(), items: [...cart.items]
            };
            showReceipt(transacaoRecibo);
        }

        document.getElementById('customer-select').value = "";
        displayCustomerSummary(null);
        clearCart();
        
        await loadDataFromSupabase();

    } catch (error) {
        console.error("Erro ao processar venda:", error);
        showToast("Erro ao registar venda no banco.", "error");
    } finally {
        toggleLoading(false);
    }
}

function processPaidSale(e) {
    e.preventDefault();
    const form = document.getElementById('payment-form');
    const methods = collectPaymentMethods();
    const isRetroactive = form.elements.retroactiveSale.checked;
    const retroactiveDate = form.elements.retroactiveDate.value;
    const total = parseFloat(document.getElementById('payment-total').textContent.replace(/[^0-9,]/g, '').replace(',', '.')) || 0;

    if (methods.length === 0) { showToast('Adicione pelo menos uma forma de pagamento.', 'error'); return; }
    const sum = methods.reduce((s, m) => s + m.amount, 0);
    if (Math.abs(sum - total) > 0.01) { showToast('A soma dos valores não confere com o total da venda.', 'error'); return; }

    const netReceived = methods.some(m => m.method === 'Cartão de Crédito') ? total : null;

    processSale({ 
        methods: methods,
        status: 'Pago', 
        isRetroactive, 
        date: retroactiveDate,
        netReceived: netReceived 
    });
    closeModal('modal-payment');
}

function processSaleAsUnpaid() {
    const form = document.getElementById('payment-form');
    const customerId = document.getElementById('customer-select').value;
    if (!customerId || parseInt(customerId) === 1) { showToast('Selecione um cliente válido (não "Cliente Balcão") para guardar como não pago.', 'error'); return; }
    const isRetroactive = form.elements.retroactiveSale.checked;
    const retroactiveDate = form.elements.retroactiveDate.value;
    processSale({ methods: [{ method: 'A Prazo', amount: 0, installments: 1 }], status: 'Não Pago', isRetroactive, date: retroactiveDate });
    closeModal('modal-payment');
}

function addRawMaterial(name, stock, unit, totalCost, supplier, receiptDate) {
    if (rawMaterials.some(rm => rm.name.toLowerCase() === name.toLowerCase())) { showToast('Insumo já registado!', 'error'); return; }
    rawMaterials.push({ id: Date.now(), name, stock: parseFloat(stock), unit, totalCost: parseFloat(totalCost), supplier, receiptDate });
    renderRawMaterials(); showToast('Insumo adicionado!'); saveData();
}

async function addCustomer(name, contact) {
    if (customers.some(c => c.name.toLowerCase() === name.toLowerCase())) { 
        showToast('Cliente com este nome já existe.', 'error'); 
        return null;
    }
    
    toggleLoading(true);
    try {
        const { data, error } = await supabaseClient
            .from('clientes')
            .insert([{ 
                id: Date.now(), 
                nome: name, 
                contato: contact 
            }])
            .select();

        if (error) throw error;

        showToast('Novo cliente adicionado na nuvem!'); 
        await loadDataFromSupabase();
        return data[0];
    } catch (error) {
        console.error("Erro ao salvar cliente:", error);
        showToast('Erro ao salvar cliente no banco.', 'error');
        return null;
    } finally {
        toggleLoading(false);
    }
}

function handleCashFlow(type, amount, description) {
    if (type === 'saida' && amount > cashBalance) { showToast('Saldo insuficiente para esta saída!', 'error'); return; }
    cashBalance += (type === 'entrada' ? amount : -amount);
    transactions.push({ id: Date.now(), type, amount, description, date: Date.now() });
    showToast(`Movimentação registada.`); saveData();
}

function deleteProduct() {
    const productId = parseInt(document.getElementById('edit-product-form').elements.productId.value);
    openConfirmationModal('Excluir Produto', 'Tem a certeza de que deseja excluir este produto? Esta ação não pode ser desfeita.', async () => {
        toggleLoading(true);
        try {
            const { error } = await supabaseClient.from('produtos').delete().eq('id', productId);
            if (error) throw error;
            
            closeModal('modal-edit-produto'); 
            showToast('Produto excluído com sucesso na nuvem!', 'success'); 
            await loadDataFromSupabase(); 
        } catch (error) {
            console.error("Erro ao excluir produto:", error);
            showToast('Erro ao excluir produto no banco.', 'error');
        } finally {
            toggleLoading(false);
        }
    });
}

function deleteRawMaterial(materialId) {
    openConfirmationModal('Excluir Insumo', 'Tem a certeza de que deseja excluir este insumo?', async () => {
        toggleLoading(true);
        try {
            const { error } = await supabaseClient.from('insumos').delete().eq('id', materialId);
            if (error) throw error;
            
            showToast('Insumo excluído com sucesso na nuvem!', 'success'); 
            await loadDataFromSupabase();
        } catch (error) {
            console.error("Erro ao excluir insumo:", error);
            showToast('Erro ao excluir insumo no banco.', 'error');
        } finally {
            toggleLoading(false);
        }
    });
}

function deleteCustomer(customerId) {
    if (customerId === 1) { showToast('Não é possível excluir o cliente padrão.', 'error'); return; }
    if (transactions.some(t => t.customerId == customerId)) { showToast('Cliente não pode ser excluído pois está associado a vendas.', 'error'); return; }
    
    openConfirmationModal('Excluir Cliente', 'Tem a certeza de que deseja excluir este cliente?', async () => {
        toggleLoading(true);
        try {
            const { error } = await supabaseClient.from('clientes').delete().eq('id', customerId);
            if (error) throw error;
            
            showToast('Cliente excluído com sucesso na nuvem!', 'success'); 
            await loadDataFromSupabase();
        } catch (error) {
            console.error("Erro ao excluir cliente:", error);
            showToast('Erro ao excluir cliente no banco.', 'error');
        } finally {
            toggleLoading(false);
        }
    });
}

function deleteCategory(categoryId) {
    if (categoryId === 1) { showToast('Não pode excluir a categoria padrão.', 'error'); return; }
    
    openConfirmationModal('Excluir Categoria?', 'Os produtos nesta categoria serão movidos para "Sem Categoria". Deseja continuar?', async () => {
        toggleLoading(true);
        try {
            await supabaseClient.from('produtos').update({ categoria_id: 1 }).eq('categoria_id', categoryId);
            
            const { error } = await supabaseClient.from('categorias').delete().eq('id', categoryId);
            if (error) throw error;
            
            showToast('Categoria excluída com sucesso.', 'success');
            await loadDataFromSupabase();
        } catch (error) {
            console.error("Erro ao excluir categoria:", error);
            showToast('Erro ao excluir categoria no banco.', 'error');
        } finally {
            toggleLoading(false);
        }
    });
}

function cancelSale(transactionId) {
    const sale = transactions.find(t => t.id === transactionId);
    if (!sale || sale.reversed) return;
    
    openConfirmationModal('Estornar Venda', 'Tem a certeza de que deseja estornar esta venda?', async () => {
        toggleLoading(true);
        try {
            await supabaseClient.from('transacoes').update({ estornada: true }).eq('id', transactionId);

            await supabaseClient.from('transacoes').insert([{
                id: Date.now(),
                tipo: 'estorno',
                valor_total: -sale.amount,
                descricao: `Estorno da venda #${sale.id}`,
                status: 'Pago',
                data_venda: new Date().toISOString()
            }]);

            if (sale.status !== 'Não Pago') cashBalance -= sale.amount;
            saveData();
            showToast('Venda estornada com sucesso!'); 
            await loadDataFromSupabase();
        } catch (error) {
            showToast("Erro ao estornar no banco.", "error");
        } finally {
            toggleLoading(false);
        }
    });
}

function deleteTransaction(transactionId) {
    openConfirmationModal('Excluir Venda Permanentemente?', 'Esta ação é irreversível e não pode ser desfeita. A venda será apagada do histórico. Deseja continuar?', async () => {
        toggleLoading(true);
        try {
            const { error } = await supabaseClient.from('transacoes').delete().eq('id', transactionId);
            if (error) throw error;
            
            showToast('Venda excluída com sucesso.', 'success');
            closeModal('modal-cliente-detalhes');
            await loadDataFromSupabase();
        } catch (error) {
            showToast("Erro ao excluir no banco.", "error");
        } finally {
            toggleLoading(false);
        }
    });
}

function resetSystem() {
    openConfirmationModal('Zerar Todo o Sistema', 'Esta ação é irreversível e apagará TODOS os dados. Deseja continuar?', () => {
        localStorage.clear();
        products = []; rawMaterials = []; customers = [{ id: 1, name: 'Cliente Balcão', contact: '' }];
        categories = [{ id: 1, name: 'Sem Categoria' }];
        transactions = [];
        cashBalance = 0;
        initializeAppUI();
        showToast('Sistema zerado com sucesso!', 'success');
        closeModal('modal-settings');
        saveData();
    });
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.error(`Modal com ID "${modalId}" não encontrado.`);
        return;
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    if (modalId === 'modal-relatorios') {
        populateMonthYearSelectors();
        switchTab('vendas');
        setReportPeriod('daily');
    } else if (modalId === 'modal-contas-receber') {
        renderUnpaidSales();
    } else if (modalId === 'modal-materiaprima') {
        renderRawMaterials();
    } else if (modalId === 'modal-clientes') {
        renderCustomers();
    } else if (modalId === 'modal-categorias') {
        renderCategoriesManagement();
    } else if (modalId === 'modal-fechamento') {
        renderCashClosingReport();
    } else if (modalId === 'modal-produto' || modalId === 'modal-edit-produto') {
        populateCategoryDropdowns();
    } else if (modalId === 'modal-maquinas') {
        renderOrcamentoMachinesList();
    } else if (modalId === 'modal-insumos') {
        renderOrcamentoSuppliesList();
    } else if (modalId === 'modal-historico-orcamentos') {
        renderHistoricoOrcamentos();
    }
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

function parsePaymentMethods(method) {
    if (!method) return [];
    if (typeof method === 'string') {
        try { const parsed = JSON.parse(method); if (Array.isArray(parsed)) return parsed; } catch(e) {}
        const installmentsMatch = method.match(/^CRÉDITO\s*\((\d+)x\)$/);
        if (installmentsMatch) return [{ method: 'Cartão de Crédito', amount: 0, installments: parseInt(installmentsMatch[1]) }];
        return [{ method: method, amount: 0 }];
    }
    if (Array.isArray(method)) return method;
    return [];
}

function formatPaymentMethods(method, installments) {
    const methods = parsePaymentMethods(method);
    if (methods.length === 0) return method || 'N/A';
    if (methods.length === 1) {
        const m = methods[0];
        const inst = m.installments || installments || 1;
        if (m.method === 'Cartão de Crédito') return `CRÉDITO${inst > 1 ? ` (${inst}x)` : ''}`;
        return m.method;
    }
    return methods.map(m => {
        if (m.method === 'Cartão de Crédito') {
            const inst = m.installments || 1;
            return `CRÉDITO${inst > 1 ? ` (${inst}x)` : ''}`;
        }
        return m.method;
    }).join(' + ');
}

function addPaymentMethodRow(method, amount) {
    const container = document.getElementById('payment-methods-container');
    if (!container) return;
    const total = parseFloat(document.getElementById('payment-total').textContent.replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
    const idx = container.children.length;
    const row = document.createElement('div');
    row.className = 'payment-method-row flex gap-2 items-start';
    row.innerHTML = `
        <select class="pm-method flex-1 border rounded p-2 bg-[var(--bg-secondary)] text-sm">
            <option value="Dinheiro">Dinheiro</option>
            <option value="Pix">Pix</option>
            <option value="Cartão de Crédito">Cartão de Crédito</option>
        </select>
        <input type="text" inputmode="decimal" class="pm-amount w-24 border rounded p-2 bg-[var(--bg-secondary)] text-sm text-right" value="${amount.toFixed(2)}">
        <div class="pm-extras flex items-center gap-1">
            <input type="number" class="pm-installments w-14 border rounded p-2 bg-[var(--bg-secondary)] text-sm hidden" value="1" min="1" placeholder="Parcelas">
        </div>
        <button type="button" class="pm-remove text-red-500 hover:text-red-700 p-2" title="Remover"><i class="fas fa-times"></i></button>
    `;
    const select = row.querySelector('.pm-method');
    select.value = method || 'Dinheiro';
    const installmentsInput = row.querySelector('.pm-installments');
    const toggleExtras = () => {
        const isCredit = select.value === 'Cartão de Crédito';
        installmentsInput.classList.toggle('hidden', !isCredit);
        if (isCredit && !installmentsInput.value) installmentsInput.value = '1';
    };
    select.addEventListener('change', toggleExtras);
    toggleExtras();
    row.querySelector('.pm-amount').addEventListener('input', updatePaymentMethodsTotal);
    row.querySelector('.pm-installments').addEventListener('input', updatePaymentMethodsTotal);
    row.querySelector('.pm-remove').addEventListener('click', function() {
        row.remove();
        updatePaymentMethodsTotal();
        if (container.children.length === 0) addPaymentMethodRow('Dinheiro', total);
    });
    container.appendChild(row);
    updatePaymentMethodsTotal();
}

function updatePaymentMethodsTotal() {
    const total = parseFloat(document.getElementById('payment-total').textContent.replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
    const rows = document.querySelectorAll('.payment-method-row');
    const sum = Array.from(rows).reduce((s, row) => {
        const val = parseFloat(row.querySelector('.pm-amount').value.replace(',', '.')) || 0;
        return s + val;
    }, 0);
    const el = document.getElementById('payment-methods-total');
    if (el) {
        if (Math.abs(sum - total) > 0.01) {
            el.textContent = formatCurrency(sum) + ' (difere do total)';
            el.style.color = 'red';
        } else {
            el.textContent = formatCurrency(sum);
            el.style.color = '';
        }
    }
}

function collectPaymentMethods() {
    const rows = document.querySelectorAll('.payment-method-row');
    const methods = [];
    let totalCalculated = 0;
    rows.forEach(row => {
        const method = row.querySelector('.pm-method').value;
        const amount = parseFloat(row.querySelector('.pm-amount').value.replace(',', '.')) || 0;
        const installments = method === 'Cartão de Crédito' ? parseInt(row.querySelector('.pm-installments').value) || 1 : 1;
        if (amount > 0) {
            methods.push({ method, amount, installments });
            totalCalculated += amount;
        }
    });
    return methods;
}

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
    document.getElementById('retroactive-sale-toggle').checked = false;
    document.getElementById('retroactive-date-group').classList.add('hidden');
    document.getElementById('payment-retroactive-date').value = '';
    const container = document.getElementById('payment-methods-container');
    if (container) container.innerHTML = '';
    addPaymentMethodRow('Dinheiro', total);
    openModal('modal-payment');
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
    
    receiptDetails.innerHTML += `<div class="mt-2 pt-2 border-t flex justify-between"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>`;
    receiptDetails.innerHTML += `<div class="flex justify-between text-red-500"><span>Descontos</span><span>-${formatCurrency(transaction.discount)}</span></div>`;
    receiptDetails.innerHTML += `<div class="font-semibold mt-2 pt-2 border-t border-[var(--border-color)]"><span>Forma de Pagamento:</span><span> ${formatPaymentMethods(transaction.method, transaction.installments)}</span></div>`;
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

async function handleReceivedPayment(e) {
    e.preventDefault();
    const form = document.getElementById('receive-payment-form');
    const saleId = parseInt(form.elements.transactionId.value);
    const sale = transactions.find(t => t.id === saleId);
    
    if (!sale) return;

    toggleLoading(true);
    try {
        const novoMetodo = form.elements.paymentMethod.value;
        const novasParcelas = novoMetodo === 'Cartão de Crédito' ? parseInt(form.elements.paymentInstallments.value) : 1;
        const methodsStr = JSON.stringify([{ method: novoMetodo, amount: sale.amount, installments: novasParcelas }]);

        const { error: updateError } = await supabaseClient
            .from('transacoes')
            .update({ status: 'Pago', metodo_pagamento: methodsStr, parcelas: novasParcelas })
            .eq('id', saleId);
        if (updateError) throw updateError;

        const { error: insertError } = await supabaseClient
            .from('transacoes')
            .insert([{
                id: Date.now(),
                tipo: 'recebimento',
                cliente_id: sale.customerId || 1,
                valor_total: sale.amount,
                metodo_pagamento: methodsStr,
                parcelas: novasParcelas,
                status: 'Pago',
                descricao: `Recebimento da venda #${sale.id}`,
                data_venda: new Date().toISOString()
            }]);
        if (insertError) throw insertError;

        cashBalance += sale.amount;
        saveData();
        
        showToast('Pagamento recebido com sucesso!', 'success');
        closeModal('modal-receber-pagamento');
        await loadDataFromSupabase();

    } catch (error) {
        console.error("Erro ao receber pagamento:", error);
        showToast("Erro ao processar pagamento no banco.", "error");
    } finally {
        toggleLoading(false);
    }
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
                <td class="p-2 text-center">${item.quantity}</td>
                <td class="p-2 text-right">${formatCurrency(item.price)}</td>
                <td class="p-2 text-right">${formatCurrency(item.price * item.quantity)}</td>
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
                <div class="flex justify-between text-sm">
                    <span>Forma de Pagamento:</span>
                    <span>${formatPaymentMethods(sale.method, sale.installments)}</span>
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
    if (!monthSelect || !yearSelect) return;
    
    if (monthSelect.options.length === 0) {
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        monthSelect.innerHTML = monthNames.map((m, i) => `<option value="${i}">${m}</option>`).join('');
    }
    if (yearSelect.options.length === 0) {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear; y >= 2020; y--) {
            yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
        }
    }
    const now = new Date();
    monthSelect.value = now.getMonth();
    yearSelect.value = now.getFullYear();
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
                    const methodDisplay = formatPaymentMethods(t.method, t.installments);
                    let badgeClass = '';
                    const methods = parsePaymentMethods(t.method);
                    const firstMethod = methods.length > 0 ? methods[0].method : (t.method || '');
                    switch (firstMethod) {
                        case 'Dinheiro': badgeClass = 'badge-dinheiro'; break;
                        case 'Pix': badgeClass = 'badge-pix'; break;
                        case 'Cartão de Crédito': badgeClass = 'badge-credito'; break;
                    }
                    paymentInfo = `<span class="payment-badge ${badgeClass}">${methodDisplay}</span>`;
                }
            }
        }
        if (t.type === 'entrada' || t.type === 'recebimento') { color = 'text-blue-600'; icon = 'fa-arrow-down'; }
        if (t.type === 'saida') { color = 'text-red-600'; icon = 'fa-arrow-up'; }
        if (t.type === 'estorno') { color = 'text-yellow-600'; icon = 'fa-undo'; }
        container.innerHTML += `<div class="flex justify-between items-center p-2 border-b border-[var(--border-color)] ${rowClass}"><div class="flex items-center gap-3"><i class="fas ${icon} ${color}"></i><div><p class="font-semibold capitalize">${t.description}</p><p class="text-sm flex items-center">${new Date(t.date).toLocaleString('pt-BR')}${paymentInfo}</p></div></div><div class="text-right"><div><p class="font-bold ${color}">${formatCurrency(t.amount)}</p>${profitHtml}${discountHtml}</div><div class="mt-1">${actionsHtml}</div></div></div>`;
    });
}

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

async function handleEditCategory(e) {
    e.preventDefault();
    const form = e.target;
    const categoryId = parseInt(form.elements.categoryId.value);
    const newName = form.elements.categoryName.value;

    toggleLoading(true);
    try {
        const { error } = await supabaseClient
            .from('categorias')
            .update({ nome: newName })
            .eq('id', categoryId);
        
        if (error) throw error;
        
        showToast('Categoria atualizada na nuvem!', 'success');
        closeModal('modal-edit-categoria');
        await loadDataFromSupabase(); 
    } catch (error) {
        console.error("Erro ao editar categoria:", error);
        showToast("Erro ao atualizar categoria.", "error");
    } finally {
        toggleLoading(false);
    }
}

function exportAllData() {
    const allData = { products, customers, transactions, cashBalance, rawMaterials, categories, theme: document.documentElement.getAttribute('data-theme'), backupDate: new Date().toISOString() };
    const dataStr = JSON.stringify(allData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob); const a = document.createElement('a');
    a.href = url; a.download = `backup-sistema-papelaria-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url); showToast("Backup exportado com sucesso!", "success");
}

async function importAllData(event) {
    const file = event.target.files[0]; 
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            openConfirmationModal('Migrar para a Nuvem?', 'Isto pegará todos os dados do seu backup e enviará para o banco de dados online. Deseja continuar?', async () => {
                toggleLoading(true);
                
                try {
                    let cats = (importedData.categories || []).map(c => ({ id: c.id, nome: c.name }));
                    if (!cats.some(c => c.id === 1)) cats.push({ id: 1, nome: 'Sem Categoria' });
                    await supabaseClient.from('categorias').upsert(cats);

                    let clis = (importedData.customers || []).map(c => ({ id: c.id, nome: c.name, contato: c.contact || '' }));
                    if (!clis.some(c => c.id === 1)) clis.push({ id: 1, nome: 'Cliente Balcão', contato: '' });
                    await supabaseClient.from('clientes').upsert(clis);

                    if (importedData.products && importedData.products.length > 0) {
                        const prods = importedData.products.map(p => ({
                            id: p.id, nome: p.name, preco: p.price, custo: p.cost || 0,
                            categoria_id: p.categoryId || 1, codigo_barras: p.barcode || null
                        }));
                        await supabaseClient.from('produtos').upsert(prods);
                    }

                    if (importedData.rawMaterials && importedData.rawMaterials.length > 0) {
                        const ins = importedData.rawMaterials.map(r => ({
                            id: r.id, nome: r.name, fornecedor: r.supplier || '', estoque: r.stock,
                            unidade: r.unit, custo_total: r.totalCost, data_recebimento: r.receiptDate || null
                        }));
                        await supabaseClient.from('insumos').upsert(ins);
                    }

                    if (importedData.transactions && importedData.transactions.length > 0) {
                        const transacoes = [];
                        const itens = [];
                        
                        importedData.transactions.forEach(t => {
                            const descricaoItens = (t.items && t.items.length > 0)
                                ? JSON.stringify(t.items.map(item => ({
                                    id: item.id, name: item.name, price: item.price,
                                    quantity: item.quantity, cost: item.cost,
                                    discount: item.discount || { type: 'fixed', value: 0 }
                                  })))
                                : null;

                            transacoes.push({
                                id: t.id, tipo: t.type,
                                cliente_id: t.customerId || 1,
                                valor_total: t.amount, custo_total: t.cost || 0, desconto_geral: t.discount || 0,
                                descricao: t.type === 'venda' ? descricaoItens : t.description || null,
                                metodo_pagamento: t.method || null, parcelas: t.installments || 1, status: t.status || 'Pago',
                                data_venda: new Date(t.date).toISOString()
                            });
                            
                            if (t.items && t.items.length > 0) {
                                t.items.forEach(item => {
                                    itens.push({
                                        transacao_id: t.id, produto_id: item.id, quantidade: item.quantity, preco_unitario: item.price,
                                        desconto_item: item.discount ? (item.discount.type === 'fixed' ? item.discount.value : (item.price * item.quantity * item.discount.value / 100)) : 0
                                    });
                                });
                            }
                        });
                        
                        await supabaseClient.from('transacoes').upsert(transacoes);
                        if (itens.length > 0) await supabaseClient.from('itens_transacao').upsert(itens);
                    }

                    if (importedData.cashBalance) localStorage.setItem('cashBalance', JSON.stringify(importedData.cashBalance));

                    showToast("Backup migrado para a nuvem com sucesso!", "success");
                    closeModal('modal-settings');
                    
                    setTimeout(() => window.location.reload(), 2000);

                } catch (dbError) {
                    console.error("Erro na migração:", dbError);
                    showToast("Erro ao enviar dados: " + dbError.message, "error");
                } finally {
                    toggleLoading(false);
                }
            });
        } catch (error) { 
            showToast("Erro ao ler o ficheiro de backup.", "error"); 
        } finally { 
            event.target.value = ''; 
        }
    };
    reader.readAsText(file);
}

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
    const methodDisplay = formatPaymentMethods(sale.method, sale.installments);
    const parsed = parsePaymentMethods(sale.method);
    const firstMethod = parsed.length > 0 ? parsed[0].method : (sale.method || 'A Prazo');
    if (['A Prazo', 'Dinheiro', 'Pix', 'Cartão de Crédito'].includes(firstMethod)) {
        form.elements.paymentMethod.value = firstMethod;
    } else {
        form.elements.paymentMethod.value = 'A Prazo';
    }
    form.elements.paymentInstallments.value = sale.installments || 1;

    const installmentsGroup = document.getElementById('edit-installments-group');
    installmentsGroup.classList.toggle('hidden', form.elements.paymentMethod.value !== 'Cartão de Crédito');

    openModal('modal-edit-venda');
}

async function handleEditSale(e) {
    e.preventDefault();
    const form = document.getElementById('edit-sale-form');
    const transactionId = parseInt(form.elements.transactionId.value);
    const sale = transactions.find(t => t.id === transactionId);

    if (!sale) return;

    toggleLoading(true);
    try {
        const newStatus = form.elements.saleStatus.value;
        const newMethod = form.elements.paymentMethod.value;
        const newInstallments = parseInt(form.elements.paymentInstallments.value) || 1;
        const methodsStr = JSON.stringify([{ method: newMethod, amount: sale.amount, installments: newInstallments }]);

        const { error } = await supabaseClient
            .from('transacoes')
            .update({ status: newStatus, metodo_pagamento: methodsStr, parcelas: newInstallments })
            .eq('id', transactionId);

        if (error) throw error;

        if (sale.status === 'Não Pago' && newStatus === 'Pago') { cashBalance += sale.amount; } 
        else if (sale.status === 'Pago' && newStatus === 'Não Pago') { cashBalance -= sale.amount; }
        saveData();

        showToast("Venda atualizada com sucesso!", "success");
        closeModal('modal-edit-venda');
        await loadDataFromSupabase();
    } catch (error) {
        showToast("Erro ao editar venda no banco.", "error");
    } finally {
        toggleLoading(false);
    }
}

function switchView(viewId) {
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('pos-view').classList.add('hidden');
    document.getElementById('orcamento-view').classList.add('hidden');
    document.getElementById('maquinas-view').classList.add('hidden');
    document.getElementById('insumos-view').classList.add('hidden');
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
        renderProducts();
    }
    if (viewId === 'orcamento-view') {
        initOrcamentoModule();
    }
    if (viewId === 'maquinas-view') {
        renderMaquinasView();
    }
    if (viewId === 'insumos-view') {
        renderInsumosView();
    }
    if (viewId === 'filamentos-view') {
        renderFilamentosView();
    }
}

function renderDashboard() {
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

    safeAddListener('edit-product-form', 'submit', async function(e) {
        e.preventDefault();
        const productId = parseInt(this.elements.productId.value);
        const newName = this.elements.productName.value;
        const newPrice = parseFloat(this.elements.productPrice.value);
        const newCost = parseFloat(this.elements.productCost.value);
        const newCategoryId = parseInt(this.elements.editProductCategory.value);
        const newBarcode = this.elements.productBarcode.value.trim() || null;

        if (newBarcode && products.some(prod => prod.barcode === newBarcode && prod.id !== productId)) {
            showToast('Este código de barras já está associado a outro produto!', 'error');
            return;
        }

        toggleLoading(true);
        try {
            const { error } = await supabaseClient.from('produtos')
                .update({
                    nome: newName,
                    preco: newPrice,
                    custo: newCost,
                    categoria_id: newCategoryId,
                    codigo_barras: newBarcode
                })
                .eq('id', productId);
            
            if (error) throw error;
            
            showToast('Produto atualizado na nuvem!', 'success');
            closeModal('modal-edit-produto');
            await loadDataFromSupabase();
        } catch (error) {
            console.error("Erro ao editar produto:", error);
            showToast("Erro ao atualizar produto no banco.", "error");
        } finally {
            toggleLoading(false);
        }
    });

    safeAddListener('add-category-form', 'submit', function(e) { e.preventDefault(); addCategory(this.elements.categoryName.value); this.reset(); });
    safeAddListener('edit-category-form', 'submit', handleEditCategory);
    safeAddListener('add-raw-material-form', 'submit', function(e) { e.preventDefault(); addRawMaterial(this.elements.rawMaterialName.value, this.elements.rawMaterialStock.value, this.elements.rawMaterialUnit.value, this.elements.rawMaterialTotalCost.value, this.elements.rawMaterialSupplier.value, this.elements.rawMaterialReceiptDate.value); this.reset(); });
    
    safeAddListener('edit-raw-material-form', 'submit', async function(e) {
        e.preventDefault();
        const materialId = parseInt(this.elements.rawMaterialId.value);
        
        toggleLoading(true);
        try {
            const { error } = await supabaseClient.from('insumos')
                .update({
                    nome: this.elements.rawMaterialName.value,
                    fornecedor: this.elements.rawMaterialSupplier.value,
                    estoque: parseFloat(this.elements.rawMaterialStock.value),
                    unidade: this.elements.rawMaterialUnit.value,
                    custo_total: parseFloat(this.elements.rawMaterialTotalCost.value),
                    data_recebimento: this.elements.rawMaterialReceiptDate.value || null
                })
                .eq('id', materialId);
            
            if (error) throw error;
            
            showToast('Item de estoque atualizado!', 'success');
            closeModal('modal-edit-materiaprima');
            await loadDataFromSupabase();
        } catch (error) {
            console.error("Erro ao editar insumo:", error);
            showToast("Erro ao atualizar insumo no banco.", "error");
        } finally {
            toggleLoading(false);
        }
    });
    
    safeAddListener('add-customer-form', 'submit', function(e) { e.preventDefault(); addCustomer(this.elements.customerName.value, this.elements.customerContact.value); this.reset(); });
    
    safeAddListener('edit-customer-form', 'submit', async function(e) {
        e.preventDefault();
        const customerId = parseInt(this.elements.customerId.value);
        
        toggleLoading(true);
        try {
            const { error } = await supabaseClient.from('clientes')
                .update({ 
                    nome: this.elements.customerName.value, 
                    contato: this.elements.customerContact.value 
                })
                .eq('id', customerId);
            
            if (error) throw error;
            
            showToast('Cliente atualizado na nuvem!', 'success');
            closeModal('modal-edit-cliente');
            await loadDataFromSupabase();
        } catch (error) {
            console.error("Erro ao editar cliente:", error);
            showToast("Erro ao atualizar cliente no banco.", "error");
        } finally {
            toggleLoading(false);
        }
    });
    
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
        const detailsButton = target.closest('.view-product-budget-btn');
        if (detailsButton) {
            e.stopPropagation();
            const p = products.find(x => x.id === parseInt(detailsButton.dataset.id));
            if (p) showProductBudgetDetails(p);
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
    safeAddListener('sync-data-btn', 'click', syncAllToSupabase);
    
    safeAddListener('execute-backup-btn', 'click', () => {
        exportAllData();
        closeModal('modal-backup-reminder');
        startBackupTimer(); 
    });

    safeAddListener('add-payment-method-btn', 'click', function() {
        const total = parseFloat(document.getElementById('payment-total').textContent.replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
        addPaymentMethodRow('Pix', 0);
    });
    
    safeAddListener('receive-payment-method', 'change', function() { document.getElementById('receive-installments-group').classList.toggle('hidden', this.value !== 'Cartão de Crédito'); });
    safeAddListener('edit-sale-method', 'change', function() { document.getElementById('edit-installments-group').classList.toggle('hidden', this.value !== 'Cartão de Crédito'); });
    safeAddListener('process-unpaid-sale-btn', 'click', processSaleAsUnpaid);
    safeAddListener('apply-general-discount-btn', 'click', () => openDiscountModal());
    safeAddListener('retroactive-sale-toggle', 'change', function() { document.getElementById('retroactive-date-group').classList.toggle('hidden', !this.checked); });
    safeAddListener('print-receipt-btn', 'click', window.print);
    safeAddListener('print-details-btn', 'click', window.print);
    
    const handleMonthYearChange = () => {
        setReportPeriod(currentReportPeriod);
    };
    safeAddListener('report-month-select', 'change', handleMonthYearChange);
    safeAddListener('report-year-select', 'change', handleMonthYearChange);
    
    safeAddListener('sales-report-product-select', 'change', (e) => {
        document.getElementById('sales-report-customer-search').value = '';
        displayProductSalesReport(e.target.value);
    });
    safeAddListener('sales-report-customer-search', 'input', (e) => {
        const selectedProductId = document.getElementById('sales-report-product-select').value;
        displayProductSalesReport(selectedProductId, e.target.value);
    });

    document.body.addEventListener('click', e => {
        const target = e.target.closest('button, tr, div.sidebar-item');
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
        } else if (classList.contains('edit-maquina-btn')) {
            const id = parseInt(dataset.id);
            const m = machines.find(x => x.id === id);
            if (!m) return;
            const form = document.getElementById('edit-maquina-form');
            form.elements.maquinaId.value = m.id;
            form.elements.maquinaNome.value = m.name;
            form.elements.maquinaPotencia.value = m.power;
            form.elements.maquinaPrecoLuz.value = m.electricityPrice;
            form.elements.maquinaValor.value = m.machineValue;
            form.elements.maquinaAnos.value = m.yearsOfUse;
            form.elements.maquinaHorasDia.value = m.hoursPerDay;
            form.elements.maquinaDepreciacao.value = m.depreciation || '';
            openModal('modal-edit-maquina');
        } else if (classList.contains('delete-maquina-btn')) {
            deleteMachine(parseInt(dataset.id));
        } else if (classList.contains('edit-insumo-btn')) {
            const id = parseInt(dataset.id);
            const s = supplyCatalog.find(x => x.id === id);
            if (!s) return;
            const form = document.getElementById('edit-insumo-form');
            form.elements.insumoId.value = s.id;
            form.elements.insumoNome.value = s.name;
            form.elements.insumoPrecoPacote.value = s.packagePrice;
            form.elements.insumoQtdPacote.value = s.packageQuantity;
            openModal('modal-edit-insumo');
        } else if (classList.contains('delete-insumo-btn')) {
            deleteSupply(parseInt(dataset.id));
        } else if (classList.contains('remove-material-btn')) {
            currentBudgetMaterials.splice(parseInt(dataset.index), 1);
            renderOrcamentoMaterials();
            calculateBudget();
        } else if (classList.contains('remove-machine-btn')) {
            currentBudgetMachines.splice(parseInt(dataset.index), 1);
            renderOrcamentoMachines();
            calculateBudget();
        } else if (classList.contains('load-orcamento-btn')) {
            loadBudget(parseInt(dataset.id));
        } else if (classList.contains('edit-orcamento-btn')) {
            loadBudget(parseInt(dataset.id));
            editingBudgetId = parseInt(dataset.id);
            document.getElementById('salvar-orcamento-btn').textContent = 'Atualizar Orçamento';
        } else if (classList.contains('view-orcamento-btn')) {
            viewOrcamentoDetails(parseInt(dataset.id));
        } else if (classList.contains('delete-orcamento-btn')) {
            deleteBudget(parseInt(dataset.id));
        } else if (classList.contains('save-produto-btn')) {
            const b = savedBudgets.find(x => x.id === parseInt(dataset.id));
            if (b) {
                (async () => {
                    const exists = products.some(p => p.name.toLowerCase() === b.produto.toLowerCase());
                    if (exists) {
                        showToast('Produto "' + b.produto + '" já existe no catálogo!', 'error');
                        return;
                    }
                    await addProduct(b.produto, b.precoFinal, b.custoTotal, 1, '');
                    const novo = products.find(p => p.name.toLowerCase() === b.produto.toLowerCase());
                    if (novo) {
                        novo.budgetData = {
                            materiais: b.materials || [],
                            maquinas: b.machines || [],
                            tempoGasto: b.tempoGasto,
                            valorHora: b.valorHora,
                            margem: b.margem,
                            taxa: b.taxa,
                            taxaFixa: b.taxaFixa || 0,
                            custoMateriais: b.custoMateriais,
                            custoMaquinas: b.custoMaquinas,
                            custoMO: b.custoMO,
                            custoFixo: b.custoFixo,
                            quantidade: b.quantidade
                        };
                        localStorage.setItem('produtoBudgetData_' + novo.id, JSON.stringify(novo.budgetData));
                    }
                })();
            }
        } else if (classList.contains('view-product-budget-btn')) {
            const p = products.find(x => x.id === parseInt(dataset.id));
            if (p) showProductBudgetDetails(p);
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

    addOrcamentoEventListeners();
}

// ===================================================================================
// MÓDULO DE ORÇAMENTO E PRECIFICAÇÃO (CALCULADORA_PAPELARIA)
// ===================================================================================
let machines = [];
let supplyCatalog = [];
let filamentCatalog = [
    { id: 1, name: 'PLA', priceKg: 125 },
    { id: 2, name: 'PETG', priceKg: 75 },
    { id: 3, name: 'ABS', priceKg: 90 },
    { id: 4, name: 'ABS Comum', priceKg: 60 },
    { id: 5, name: 'ABS Barato', priceKg: 45 },
    { id: 6, name: 'Nylon', priceKg: 150 },
    { id: 7, name: 'ABS Wood', priceKg: 110 },
    { id: 8, name: 'PLA Silk', priceKg: 150 },
    { id: 9, name: 'TPU', priceKg: 160 },
    { id: 10, name: 'PC', priceKg: 180 },
    { id: 11, name: 'Outro...', priceKg: 0 }
];
let savedBudgets = [];
let currentBudgetMaterials = [];
let currentBudgetMachines = [];
let editingBudgetId = null;
let orcamentoSelectType = '';
let orcamentoSelectData = null;
let orcPrecoFinalChanged = false;

function loadOrcamentoData() {
    try {
        const saved = localStorage.getItem('orcamentoMachines');
        if (saved) machines = JSON.parse(saved);
        const saved2 = localStorage.getItem('orcamentoSupplies');
        if (saved2) supplyCatalog = JSON.parse(saved2);
        const saved3 = localStorage.getItem('orcamentoFilaments');
        if (saved3) filamentCatalog = JSON.parse(saved3);
        const saved4 = localStorage.getItem('orcamentoBudgets');
        if (saved4) savedBudgets = JSON.parse(saved4);
    } catch (e) { console.error(e); }
}

function saveOrcamentoFilaments() {
    try {
        localStorage.setItem('orcamentoFilaments', JSON.stringify(filamentCatalog));
    } catch (e) { console.error(e); }
}

function populateFilamentoSelect() {
    const select = document.getElementById('orc-filamento');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione...</option>';
    filamentCatalog.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = `${f.name} (R$ ${f.priceKg.toFixed(2)}/kg)`;
        select.appendChild(opt);
    });
}

function onFilamentoChange() {
    calculateBudget();
}

function getTempoImpressaoMin() {
    const h = parseFloat(document.getElementById('orc-tempo-impressao-h').value) || 0;
    const min = parseFloat(document.getElementById('orc-tempo-impressao-min').value) || 0;
    return h * 60 + min;
}

function addFilamento(name, priceKg) {
    if (!name || !priceKg) return;
    const maxId = filamentCatalog.reduce((max, f) => Math.max(max, f.id), 0);
    filamentCatalog.push({ id: maxId + 1, name, priceKg: parseFloat(priceKg) });
    saveOrcamentoFilaments();
    populateFilamentoSelect();
}

function editFilamento(id, name, priceKg) {
    const idx = filamentCatalog.findIndex(f => f.id === id);
    if (idx === -1) return;
    filamentCatalog[idx] = { id, name, priceKg: parseFloat(priceKg) };
    saveOrcamentoFilaments();
    populateFilamentoSelect();
}

function deleteFilamento(id) {
    filamentCatalog = filamentCatalog.filter(f => f.id !== id);
    saveOrcamentoFilaments();
    populateFilamentoSelect();
}

function saveOrcamentoData() {
    try {
        localStorage.setItem('orcamentoMachines', JSON.stringify(machines));
        localStorage.setItem('orcamentoSupplies', JSON.stringify(supplyCatalog));
        localStorage.setItem('orcamentoFilaments', JSON.stringify(filamentCatalog));
        localStorage.setItem('orcamentoBudgets', JSON.stringify(savedBudgets));
    } catch (e) { console.error(e); }
}

async function syncMachinesToSupabase() {
    try {
        const { error: delError } = await supabaseClient.from('maquinas').delete().neq('id', 0);
        if (delError) {
            showToast('Erro SQL (maquinas): ' + delError.message, 'error');
            return false;
        }
        for (const m of machines) {
            const { error } = await supabaseClient.from('maquinas').insert([{
                id: m.id,
                nome: m.name,
                potencia: m.power,
                preco_luz: m.electricityPrice,
                valor_maquina: m.machineValue,
                anos_uso: m.yearsOfUse,
                horas_dia: m.hoursPerDay,
                depreciacao: m.depreciation || null,
                custo_hora: m.costPerHour
            }]);
            if (error) {
                showToast('Erro SQL (maquinas insert): ' + error.message, 'error');
                return false;
            }
        }
        return true;
    } catch (e) {
        showToast('Erro sync maquinas: ' + e.message, 'error');
        return false;
    }
}

async function syncBudgetsToSupabase() {
    try {
        const { error: delError } = await supabaseClient.from('orcamentos').delete().neq('id', 0);
        if (delError) {
            showToast('Erro SQL (orcamentos): ' + delError.message, 'error');
            return false;
        }
        for (const b of savedBudgets) {
            const { error } = await supabaseClient.from('orcamentos').insert([{
                id: b.id,
                data: b.date,
                cliente_nome: b.clienteName,
                cliente_id: b.clienteId ? parseInt(b.clienteId) : null,
                produto: b.produto,
                quantidade: b.quantidade,
                custo_total: b.custoTotal,
                preco_sugerido: b.precoSugerido,
                preco_final: b.precoFinal,
                lucro: b.lucro,
                margem: b.margem,
                taxa_plataforma: b.taxa,
                taxa_fixa: b.taxaFixa || 0,
                tempo_gasto: b.tempoGasto,
                valor_hora: b.valorHora,
                materiais_json: JSON.stringify(b.materials || []),
                maquinas_json: JSON.stringify(b.machines || []),
                custos_fixos_json: JSON.stringify({
                    aluguel: b.aluguel, internet: b.internet, mei: b.mei, outros: b.outros,
                    horas_dia: b.horasDia, dias_mes: b.diasMes
                }),
                created_at: b.createdAt
            }]);
            if (error) {
                showToast('Erro SQL (orcamentos insert): ' + error.message, 'error');
                return false;
            }
        }
        return true;
    } catch (e) {
        showToast('Erro sync orcamentos: ' + e.message, 'error');
        return false;
    }
}

async function syncSuppliesToSupabase() {
    try {
        const { error: delError } = await supabaseClient.from('insumos_orcamento').delete().neq('id', 0);
        if (delError) {
            showToast('Erro SQL (insumos_orcamento): ' + delError.message, 'error');
            return false;
        }
        for (const s of supplyCatalog) {
            const { error } = await supabaseClient.from('insumos_orcamento').insert([{
                id: s.id, nome: s.name, preco_pacote: s.packagePrice,
                qtd_pacote: s.packageQuantity, custo_unitario: s.unitCost
            }]);
            if (error) {
                showToast('Erro SQL (insumos_orcamento insert): ' + error.message, 'error');
                return false;
            }
        }
        return true;
    } catch (e) {
        showToast('Erro sync insumos: ' + e.message, 'error');
        return false;
    }
}

async function syncAllToSupabase() {
    loadOrcamentoData();
    console.log('Máquinas para sync:', machines.length);
    console.log('Insumos para sync:', supplyCatalog.length);
    console.log('Orçamentos para sync:', savedBudgets.length);
    const machinesOk = await syncMachinesToSupabase();
    const suppliesOk = await syncSuppliesToSupabase();
    const budgetsOk = await syncBudgetsToSupabase();
    if (machinesOk && suppliesOk && budgetsOk) {
        showToast('Dados sincronizados com a nuvem!', 'success');
    } else {
        showToast('Sincronização parcial. Execute o SQL no Supabase primeiro.', 'error');
    }
}

function toggleOrcamentoMode() {
    const modo = document.getElementById('orc-modo-calculo');
    const fields3d = document.getElementById('orc-3d-fields');
    if (!modo || !fields3d) return;
    const moRow = document.getElementById('orc-result-mo');
    const is3d = modo.value === 'impressao3d' || modo.value === 'misto';
    const isPure3d = modo.value === 'impressao3d';
    if (is3d) {
        fields3d.classList.remove('hidden');
    } else {
        fields3d.classList.add('hidden');
    }
    if (moRow && moRow.parentElement) {
        moRow.parentElement.style.display = isPure3d ? 'none' : '';
    }
    calculateBudget();
}

function initOrcamentoModule() {
    loadOrcamentoData();
    populateFilamentoSelect();
    const clienteSelect = document.getElementById('orc-cliente');
    if (clienteSelect) {
        clienteSelect.innerHTML = '<option value="">Selecione um cliente</option>';
        customers.forEach(c => {
            clienteSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    }
    const dataInput = document.getElementById('orc-data');
    if (dataInput && !dataInput.value) {
        dataInput.value = new Date().toISOString().split('T')[0];
    }
    renderOrcamentoMaterials();
    renderOrcamentoMachines();
    toggleOrcamentoMode();
    calculateBudget();
}

function calculateMachineCostPerHour(m) {
    const energyCost = (m.power / 1000) * m.electricityPrice;
    const hoursLife = m.depreciation || (m.yearsOfUse * 12 * 22 * m.hoursPerDay);
    const depCost = hoursLife > 0 ? m.machineValue / hoursLife : 0;
    return energyCost + depCost;
}

async function addMachine(name, power, electricityPrice, machineValue, yearsOfUse, hoursPerDay, depreciation) {
    if (!name || !power || !machineValue) {
        showToast('Preencha os campos obrigatórios!', 'error');
        return;
    }
    const machine = {
        id: Date.now(),
        name, power: parseFloat(power),
        electricityPrice: parseFloat(electricityPrice),
        machineValue: parseFloat(machineValue),
        yearsOfUse: parseFloat(yearsOfUse),
        hoursPerDay: parseFloat(hoursPerDay),
        depreciation: depreciation ? parseFloat(depreciation) : 0
    };
    machine.costPerHour = calculateMachineCostPerHour(machine);
    machines.push(machine);
    saveOrcamentoData();
    const { error } = await supabaseClient.from('maquinas').insert([{
        id: machine.id, nome: machine.name, potencia: machine.power,
        preco_luz: machine.electricityPrice, valor_maquina: machine.machineValue,
        anos_uso: machine.yearsOfUse, horas_dia: machine.hoursPerDay,
        depreciacao: machine.depreciation || null, custo_hora: machine.costPerHour
    }]);
    if (error) console.error('Erro ao salvar máquina no Supabase:', error);
    renderOrcamentoMachinesList();
    showToast(`Máquina "${name}" adicionada!`);
}

async function editMachine(id, name, power, electricityPrice, machineValue, yearsOfUse, hoursPerDay, depreciation) {
    const idx = machines.findIndex(m => m.id === id);
    if (idx === -1) return;
    machines[idx] = {
        id, name, power: parseFloat(power),
        electricityPrice: parseFloat(electricityPrice),
        machineValue: parseFloat(machineValue),
        yearsOfUse: parseFloat(yearsOfUse),
        hoursPerDay: parseFloat(hoursPerDay),
        depreciation: depreciation ? parseFloat(depreciation) : 0
    };
    machines[idx].costPerHour = calculateMachineCostPerHour(machines[idx]);
    saveOrcamentoData();
    const { error } = await supabaseClient.from('maquinas').update({
        nome: name, potencia: parseFloat(power),
        preco_luz: parseFloat(electricityPrice), valor_maquina: parseFloat(machineValue),
        anos_uso: parseFloat(yearsOfUse), horas_dia: parseFloat(hoursPerDay),
        depreciacao: depreciation ? parseFloat(depreciation) : null,
        custo_hora: machines[idx].costPerHour
    }).eq('id', id);
    if (error) console.error('Erro ao atualizar máquina no Supabase:', error);
    renderOrcamentoMachinesList();
    showToast('Máquina atualizada!');
}

function deleteMachine(id) {
    openConfirmationModal('Excluir Máquina', 'Tem certeza?', () => {
        machines = machines.filter(m => m.id !== id);
        saveOrcamentoData();
        supabaseClient.from('maquinas').delete().eq('id', id)
            .then(({ error }) => { if (error) console.error('Erro ao excluir máquina no Supabase:', error); });
        renderOrcamentoMachinesList();
    });
}

async function addSupply(name, packagePrice, packageQuantity) {
    if (!name || !packagePrice || !packageQuantity) {
        showToast('Preencha todos os campos!', 'error');
        return;
    }
    const supply = {
        id: Date.now(),
        name,
        packagePrice: parseFloat(packagePrice),
        packageQuantity: parseFloat(packageQuantity),
        unitCost: parseFloat(packagePrice) / parseFloat(packageQuantity)
    };
    supplyCatalog.push(supply);
    saveOrcamentoData();
    const { error } = await supabaseClient.from('insumos_orcamento').insert([{
        id: supply.id, nome: supply.name, preco_pacote: supply.packagePrice,
        qtd_pacote: supply.packageQuantity, custo_unitario: supply.unitCost
    }]);
    if (error) console.error('Erro ao salvar insumo no Supabase:', error);
    renderOrcamentoSuppliesList();
    showToast(`Insumo "${name}" adicionado!`);
}

async function editSupply(id, name, packagePrice, packageQuantity) {
    const idx = supplyCatalog.findIndex(s => s.id === id);
    if (idx === -1) return;
    supplyCatalog[idx] = {
        id, name,
        packagePrice: parseFloat(packagePrice),
        packageQuantity: parseFloat(packageQuantity),
        unitCost: parseFloat(packagePrice) / parseFloat(packageQuantity)
    };
    saveOrcamentoData();
    const { error } = await supabaseClient.from('insumos_orcamento').update({
        nome: name, preco_pacote: parseFloat(packagePrice),
        qtd_pacote: parseFloat(packageQuantity), custo_unitario: parseFloat(packagePrice) / parseFloat(packageQuantity)
    }).eq('id', id);
    if (error) console.error('Erro ao atualizar insumo no Supabase:', error);
    renderOrcamentoSuppliesList();
    showToast('Insumo atualizado!');
}

function deleteSupply(id) {
    openConfirmationModal('Excluir Insumo', 'Tem certeza?', () => {
        supplyCatalog = supplyCatalog.filter(s => s.id !== id);
        saveOrcamentoData();
        supabaseClient.from('insumos_orcamento').delete().eq('id', id)
            .then(({ error }) => { if (error) console.error('Erro ao excluir insumo no Supabase:', error); });
        renderOrcamentoSuppliesList();
    });
}

function renderOrcamentoMachinesList() {
    const containers = ['maquinas-list', 'maquinas-list-view'];
    containers.forEach(id => {
        const list = document.getElementById(id);
        if (!list) return;
        list.innerHTML = '';
        if (machines.length === 0) {
            list.innerHTML = '<p class="text-center text-gray-500 py-4">Nenhuma máquina cadastrada.</p>';
            return;
        }
        let html = `<table class="w-full text-left text-sm"><thead><tr class="border-b">
            <th class="p-2">Máquina</th><th class="p-2 text-right">Potência</th>
            <th class="p-2 text-right">Valor</th><th class="p-2 text-right">Custo Hora</th>
            <th class="p-2 text-center">Ações</th></tr></thead><tbody>`;
        machines.forEach(m => {
            html += `<tr class="border-b hover:bg-[var(--bg-tertiary)]">
                <td class="p-2 font-medium">${m.name}</td>
                <td class="p-2 text-right">${m.power}W</td>
                <td class="p-2 text-right">${formatCurrency(m.machineValue)}</td>
                <td class="p-2 text-right font-bold text-blue-600">${formatCurrency(m.costPerHour)}</td>
                <td class="p-2 text-center">
                    <button data-id="${m.id}" class="edit-maquina-btn text-blue-500 hover:text-blue-700 p-1"><i class="fas fa-edit"></i></button>
                    <button data-id="${m.id}" class="delete-maquina-btn text-red-500 hover:text-red-700 p-1"><i class="fas fa-trash"></i></button>
                </td></tr>`;
        });
        html += '</tbody></table>';
        list.innerHTML = html;
    });
}

function renderOrcamentoSuppliesList() {
    const containers = ['insumos-list', 'insumos-list-view'];
    containers.forEach(id => {
        const list = document.getElementById(id);
        if (!list) return;
        list.innerHTML = '';
        if (supplyCatalog.length === 0) {
            list.innerHTML = '<p class="text-center text-gray-500 py-4">Nenhum insumo cadastrado.</p>';
            return;
        }
        let html = `<table class="w-full text-left text-sm"><thead><tr class="border-b">
            <th class="p-2">Insumo</th><th class="p-2 text-right">Preço Pacote</th>
            <th class="p-2 text-right">Qtd Pacote</th><th class="p-2 text-right">Custo Unit.</th>
            <th class="p-2 text-center">Ações</th></tr></thead><tbody>`;
        supplyCatalog.forEach(s => {
            html += `<tr class="border-b hover:bg-[var(--bg-tertiary)]">
                <td class="p-2 font-medium">${s.name}</td>
                <td class="p-2 text-right">${formatCurrency(s.packagePrice)}</td>
                <td class="p-2 text-right">${s.packageQuantity}</td>
                <td class="p-2 text-right font-semibold">${formatCurrency(s.unitCost)}</td>
                <td class="p-2 text-center">
                    <button data-id="${s.id}" class="edit-insumo-btn text-blue-500 hover:text-blue-700 p-1"><i class="fas fa-edit"></i></button>
                    <button data-id="${s.id}" class="delete-insumo-btn text-red-500 hover:text-red-700 p-1"><i class="fas fa-trash"></i></button>
                </td></tr>`;
        });
        html += '</tbody></table>';
        list.innerHTML = html;
    });
}

function renderOrcamentoMaterials() {
    const tbody = document.getElementById('orc-materiais-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (currentBudgetMaterials.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">Nenhum material adicionado.</td></tr>';
        document.getElementById('orc-total-materiais').textContent = formatCurrency(0);
        return;
    }
    let total = 0;
    currentBudgetMaterials.forEach((mat, i) => {
        const subtotal = mat.quantity * mat.unitCost;
        total += subtotal;
        tbody.innerHTML += `<tr>
            <td class="p-2">${mat.name}</td>
            <td class="p-2 text-center">
                <input type="number" value="${mat.quantity}" min="0.01" step="any"
                    data-index="${i}" data-type="material"
                    class="orc-qty-input w-16 text-center border rounded p-1 bg-[var(--bg-secondary)]">
            </td>
            <td class="p-2 text-right">${formatCurrency(mat.unitCost)}</td>
            <td class="p-2 text-right font-semibold orc-subtotal">${formatCurrency(subtotal)}</td>
            <td class="p-2 text-center">
                <button data-index="${i}" class="remove-material-btn text-red-500 hover:text-red-700"><i class="fas fa-times"></i></button>
            </td></tr>`;
    });
    document.getElementById('orc-total-materiais').textContent = formatCurrency(total);
    attachOrcamentoQtyListeners();
}

function renderOrcamentoMachines() {
    const tbody = document.getElementById('orc-maquinas-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (currentBudgetMachines.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">Nenhuma máquina adicionada.</td></tr>';
        document.getElementById('orc-total-maquinas').textContent = formatCurrency(0);
        return;
    }
    let total = 0;
    currentBudgetMachines.forEach((mac, i) => {
        const cost = (mac.timeMinutes / 60) * mac.costPerHour;
        total += cost;
        tbody.innerHTML += `<tr>
            <td class="p-2">${mac.name}</td>
            <td class="p-2 text-center">
                <input type="number" value="${mac.timeMinutes}" min="0.01" step="any"
                    data-index="${i}" data-type="machine"
                    class="orc-qty-input w-16 text-center border rounded p-1 bg-[var(--bg-secondary)]">
            </td>
            <td class="p-2 text-right">${formatCurrency(mac.costPerHour)}</td>
            <td class="p-2 text-right font-semibold orc-subtotal">${formatCurrency(cost)}</td>
            <td class="p-2 text-center">
                <button data-index="${i}" class="remove-machine-btn text-red-500 hover:text-red-700"><i class="fas fa-times"></i></button>
            </td></tr>`;
    });
    document.getElementById('orc-total-maquinas').textContent = formatCurrency(total);
    attachOrcamentoQtyListeners();
}

function updateOrcamentoTotals() {
    const totalMateriais = currentBudgetMaterials.reduce((s, m) => s + m.quantity * m.unitCost, 0);
    const totalMaquinas = currentBudgetMachines.reduce((s, m) => s + (m.timeMinutes / 60) * m.costPerHour, 0);
    document.getElementById('orc-total-materiais').textContent = formatCurrency(totalMateriais);
    document.getElementById('orc-total-maquinas').textContent = formatCurrency(totalMaquinas);
}

function attachOrcamentoQtyListeners() {
    document.querySelectorAll('.orc-qty-input').forEach(input => {
        input.removeEventListener('input', handleOrcamentoQtyChange);
        input.addEventListener('input', handleOrcamentoQtyChange);
    });
}

function handleOrcamentoQtyChange(e) {
    const input = e.target;
    const idx = parseInt(input.dataset.index);
    const type = input.dataset.type;
    const val = parseFloat(input.value);

    if (isNaN(val) || val <= 0) return;

    const row = input.closest('tr');
    if (!row) return;

    if (type === 'material' && currentBudgetMaterials[idx]) {
        currentBudgetMaterials[idx].quantity = val;
        const subtotal = val * currentBudgetMaterials[idx].unitCost;
        const subtotalCell = row.querySelector('.orc-subtotal');
        if (subtotalCell) subtotalCell.textContent = formatCurrency(subtotal);
    } else if (type === 'machine' && currentBudgetMachines[idx]) {
        currentBudgetMachines[idx].timeMinutes = val;
        const cost = (val / 60) * currentBudgetMachines[idx].costPerHour;
        const costCell = row.querySelector('.orc-subtotal');
        if (costCell) costCell.textContent = formatCurrency(cost);
    }
    updateOrcamentoTotals();
    calculateBudget();
}

function calculateBudget() {
    const qtd = parseFloat(document.getElementById('orc-quantidade').value) || 1;
    const tempoGasto = parseFloat(document.getElementById('orc-tempo-gasto').value) || 0;
    const valorHora = parseFloat(document.getElementById('orc-valor-hora').value) || 0;
    const margem = parseFloat(document.getElementById('orc-margem').value) || 0;
    const taxa = parseFloat(document.getElementById('orc-taxa-plataforma').value) || 0;
    const taxaFixa = parseFloat(document.getElementById('orc-taxa-fixa').value) || 0;
    const modo = document.getElementById('orc-modo-calculo').value;

    const aluguel = parseFloat(document.getElementById('orc-aluguel').value) || 0;
    const internet = parseFloat(document.getElementById('orc-internet').value) || 0;
    const mei = parseFloat(document.getElementById('orc-mei').value) || 0;
    const outros = parseFloat(document.getElementById('orc-outros').value) || 0;
    const horasDia = parseFloat(document.getElementById('orc-horas-dia').value) || 1;
    const diasMes = parseFloat(document.getElementById('orc-dias-mes').value) || 1;

    const totalFixos = aluguel + internet + mei + outros;
    const custoFixoHora = totalFixos / (horasDia * diasMes);
    const elTotal = document.getElementById('orc-total-custos-fixos');
    const elCustoHora = document.getElementById('orc-custo-fixo-hora');
    if (elTotal) elTotal.textContent = formatCurrency(totalFixos);
    if (elCustoHora) elCustoHora.textContent = formatCurrency(custoFixoHora);
    const modalTotal = document.getElementById('modal-total-custos-fixos');
    const modalCustoHora = document.getElementById('modal-custo-fixo-hora');
    if (modalTotal) modalTotal.textContent = formatCurrency(totalFixos);
    if (modalCustoHora) modalCustoHora.textContent = formatCurrency(custoFixoHora);

    const custoMaquinas = currentBudgetMachines.reduce((sum, m) => sum + (m.timeMinutes / 60) * m.costPerHour, 0);

    let custoMateriais, custoMO, custoTotal, precoSugerido, custoFixo;

    function calcGrafica() {
        custoMateriais = currentBudgetMaterials.reduce((sum, m) => sum + m.quantity * m.unitCost, 0);
        custoMO = (tempoGasto / 60) * valorHora;
        custoFixo = custoFixoHora * (tempoGasto / 60);
        return custoMateriais + custoMaquinas + custoMO;
    }

    function calc3d() {
        const peso = parseFloat(document.getElementById('orc-peso').value) || 0;
        const filamentoSelect = document.getElementById('orc-filamento');
        const selectedFilamento = filamentCatalog.find(f => f.id === parseInt(filamentoSelect.value));
        const precoFilamento = selectedFilamento ? selectedFilamento.priceKg : 0;
        const tempoImpressao = getTempoImpressaoMin();
        const taxaFalhas = parseFloat(document.getElementById('orc-falhas').value) || 0;
        const taxaAcabamento = parseFloat(document.getElementById('orc-acabamento').value) || 0;
        const custoFixacao = parseFloat(document.getElementById('orc-fixacao').value) || 0;
        const roiMeses = parseFloat(document.getElementById('orc-roi-meses').value) || 1;
        const maquinasAtivas = parseFloat(document.getElementById('orc-maquinas-ativas').value) || 1;

        const custoFilamento = (peso / 1000) * precoFilamento;
        const custoFalhas = custoFilamento * (taxaFalhas / 100);
        const custoAcabamento = custoFilamento * (taxaAcabamento / 100);
        const custoFixacaoTotal = custoFixacao;

        let custoROI = 0;
        const horasMes = horasDia * diasMes;
        if (roiMeses > 0 && maquinasAtivas > 0) {
            currentBudgetMachines.forEach(m => {
                const machineObj = m.machineIndex !== undefined ? machines[m.machineIndex] : machines.find(mac => mac.name === m.name);
                if (machineObj && machineObj.machineValue) {
                    const roiPorHora = machineObj.machineValue / (roiMeses * horasMes / maquinasAtivas);
                    custoROI += roiPorHora * (m.timeMinutes / 60);
                }
            });
        }

        custoMateriais = custoFilamento;
        custoMO = 0;
        custoFixo = custoFixoHora * (tempoImpressao / 60);
        return custoFilamento + custoMaquinas + custoFalhas + custoAcabamento + custoFixacaoTotal + custoROI + custoFixo;
    }

    if (modo === 'impressao3d') {
        const total3d = calc3d();
        custoTotal = total3d;
        precoSugerido = taxa >= 100 ? 0 : (total3d * (1 + margem / 100) + taxaFixa) / (1 - taxa / 100);
    } else if (modo === 'misto') {
        const custoMateriaisGrafica = currentBudgetMaterials.reduce((sum, m) => sum + m.quantity * m.unitCost, 0);
        const custoMOGrafica = (tempoGasto / 60) * valorHora;
        const totalGrafica = custoMateriaisGrafica + custoMOGrafica;

        const peso = parseFloat(document.getElementById('orc-peso').value) || 0;
        const filamentoSelect = document.getElementById('orc-filamento');
        const selectedFilamento = filamentCatalog.find(f => f.id === parseInt(filamentoSelect.value));
        const precoFilamento = selectedFilamento ? selectedFilamento.priceKg : 0;
        const tempoImpressao = getTempoImpressaoMin();
        const taxaFalhas = parseFloat(document.getElementById('orc-falhas').value) || 0;
        const taxaAcabamento = parseFloat(document.getElementById('orc-acabamento').value) || 0;
        const custoFixacao = parseFloat(document.getElementById('orc-fixacao').value) || 0;
        const roiMeses = parseFloat(document.getElementById('orc-roi-meses').value) || 1;
        const maquinasAtivas = parseFloat(document.getElementById('orc-maquinas-ativas').value) || 1;

        const custoFilamento = (peso / 1000) * precoFilamento;
        const custoFalhas = custoFilamento * (taxaFalhas / 100);
        const custoAcabamento = custoFilamento * (taxaAcabamento / 100);
        const custoFixacaoTotal = custoFixacao;

        let custoROI = 0;
        const horasMes = horasDia * diasMes;
        if (roiMeses > 0 && maquinasAtivas > 0) {
            currentBudgetMachines.forEach(m => {
                const machineObj = m.machineIndex !== undefined ? machines[m.machineIndex] : machines.find(mac => mac.name === m.name);
                if (machineObj && machineObj.machineValue) {
                    const roiPorHora = machineObj.machineValue / (roiMeses * horasMes / maquinasAtivas);
                    custoROI += roiPorHora * (m.timeMinutes / 60);
                }
            });
        }

        custoMateriais = custoFilamento + custoMateriaisGrafica;
        custoMO = custoMOGrafica;
        custoFixo = custoFixoHora * ((tempoImpressao + tempoGasto) / 2 / 60);
        const totalMisto = custoMateriaisGrafica + custoMOGrafica + custoFilamento + custoMaquinas + custoFalhas + custoAcabamento + custoFixacaoTotal + custoROI + custoFixo;
        custoTotal = totalMisto;
        precoSugerido = taxa >= 100 ? 0 : (totalMisto * (1 + margem / 100) + taxaFixa) / (1 - taxa / 100);
    } else {
        const totalGrafica = calcGrafica();
        custoTotal = totalGrafica;
        precoSugerido = taxa >= 100 ? 0 : ((custoMateriais + custoMaquinas) * (1 + margem / 100) + custoMO + taxaFixa) / (1 - taxa / 100);
    }

    const precoFinalInput = document.getElementById('orc-result-preco-final');
    const rawVal = precoFinalInput ? precoFinalInput.value.replace(',', '.') : '';
    if (orcPrecoFinalChanged && precoFinalInput && rawVal !== '' && !isNaN(parseFloat(rawVal))) {
        precoFinal = parseFloat(rawVal);
    } else {
        precoFinal = 0;
        if (precoFinalInput) precoFinalInput.value = '0';
    }
    const lucro = precoFinal - custoTotal;
    const custoUnidade = custoTotal / qtd;
    const vendaUnidade = precoFinal / qtd;
    const lucroUnidade = vendaUnidade - custoUnidade;
    const markupPercent = custoUnidade > 0 ? ((vendaUnidade - custoUnidade) / custoUnidade) * 100 : 0;
    const margemLucro = vendaUnidade > 0 ? ((vendaUnidade - custoUnidade) / vendaUnidade) * 100 : 0;

    document.getElementById('orc-result-materiais').textContent = formatCurrency(custoMateriais);
    document.getElementById('orc-result-maquinas').textContent = formatCurrency(custoMaquinas);
    document.getElementById('orc-result-mo').textContent = formatCurrency(custoMO);
    document.getElementById('orc-result-fixo').textContent = formatCurrency(custoFixo);
    document.getElementById('orc-result-custo-total').textContent = formatCurrency(custoTotal);
    document.getElementById('orc-result-preco-sugerido').textContent = formatCurrency(precoSugerido);
    document.getElementById('orc-result-lucro').textContent = formatCurrency(lucro);
    document.getElementById('orc-result-custo-unidade').textContent = formatCurrency(custoUnidade);
    document.getElementById('orc-result-venda-unidade').textContent = formatCurrency(vendaUnidade);
    document.getElementById('orc-result-lucro-unidade').textContent = formatCurrency(lucroUnidade);
    document.getElementById('orc-result-markup').textContent = markupPercent.toFixed(2) + '%';
    document.getElementById('orc-result-margem').textContent = margemLucro.toFixed(2) + '%';
}

function renderOrcamentoSelectList(filter) {
    const list = document.getElementById('orcamento-select-list');
    if (!list) return;
    list.innerHTML = '';

    const items = orcamentoSelectType === 'material' ? supplyCatalog : machines;

    const filtered = items.filter(item =>
        item.name.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
        list.innerHTML = '<p class="text-center text-gray-500 py-4">Nenhum item encontrado.</p>';
        return;
    }

    filtered.forEach(item => {
        const originalIdx = items.indexOf(item);
        const div = document.createElement('div');
        div.className = 'orcamento-select-item px-3 py-2 cursor-pointer border-b border-[var(--border-color)] hover:bg-[var(--bg-secondary)]';
        div.dataset.index = originalIdx;

        if (orcamentoSelectType === 'material') {
            div.textContent = `${item.name} (${formatCurrency(item.unitCost)}/un)`;
        } else {
            div.textContent = `${item.name} (${formatCurrency(item.costPerHour)}/h)`;
        }

        if (orcamentoSelectData && orcamentoSelectData.index === originalIdx) {
            div.style.backgroundColor = 'var(--primary-500)';
            div.style.color = 'white';
        }

        div.addEventListener('click', function() {
            document.querySelectorAll('.orcamento-select-item').forEach(el => {
                el.style.backgroundColor = '';
                el.style.color = '';
            });
            this.style.backgroundColor = 'var(--primary-500)';
            this.style.color = 'white';
            orcamentoSelectData = {
                index: parseInt(this.dataset.index),
                item: items[parseInt(this.dataset.index)]
            };
            const qtyGroup = document.getElementById('orcamento-qty-group');
            const confirmBtn = document.getElementById('orcamento-select-confirm');
            if (qtyGroup) qtyGroup.classList.remove('hidden');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.className = 'px-4 py-2 rounded bg-[var(--primary-600)] text-white';
            }
            const qtyInput = document.getElementById('orcamento-select-qty');
            if (qtyInput) setTimeout(() => qtyInput.focus(), 100);
        });

        list.appendChild(div);
    });
}

function openOrcamentoSelectModal(type) {
    const title = document.getElementById('orcamento-select-title');
    const label = document.getElementById('orcamento-select-label');
    const qtyLabel = document.getElementById('orcamento-select-qty-label');
    const qtyInput = document.getElementById('orcamento-select-qty');
    const searchInput = document.getElementById('orcamento-select-search');

    orcamentoSelectType = type;
    orcamentoSelectData = null;
    if (searchInput) searchInput.value = '';

    const qtyGroup = document.getElementById('orcamento-qty-group');
    const confirmBtn = document.getElementById('orcamento-select-confirm');
    if (qtyGroup) qtyGroup.classList.add('hidden');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.className = 'px-4 py-2 rounded bg-gray-400 text-white cursor-not-allowed';
    }

    if (type === 'material') {
        if (supplyCatalog.length === 0) {
            showToast('Cadastre insumos primeiro!', 'error');
            return;
        }
        title.textContent = 'Adicionar Material';
        label.textContent = 'Insumo';
        qtyLabel.textContent = 'Quantidade';
        qtyInput.value = '1';
    } else if (type === 'machine') {
        if (machines.length === 0) {
            showToast('Cadastre máquinas primeiro!', 'error');
            return;
        }
        title.textContent = 'Adicionar Máquina';
        label.textContent = 'Máquina';
        qtyLabel.textContent = 'Tempo (minutos)';
        qtyInput.value = '30';
    }

    renderOrcamentoSelectList('');
    openModal('modal-orcamento-select');
}

document.getElementById('orcamento-select-confirm').addEventListener('click', function() {
    const qtyInput = document.getElementById('orcamento-select-qty');
    const qty = parseFloat(qtyInput.value);

    if (!orcamentoSelectData || isNaN(qty) || qty <= 0) {
        showToast('Selecione um item e informe a quantidade!', 'error');
        return;
    }

    const idx = orcamentoSelectData.index;
    const item = orcamentoSelectData.item;

    if (orcamentoSelectType === 'material') {
        currentBudgetMaterials.push({
            supplyIndex: idx,
            name: item.name,
            quantity: qty,
            unitCost: item.unitCost,
            subtotal: qty * item.unitCost
        });
        renderOrcamentoMaterials();
        calculateBudget();
    } else if (orcamentoSelectType === 'machine') {
        currentBudgetMachines.push({
            machineIndex: idx,
            name: item.name,
            timeMinutes: qty,
            costPerHour: item.costPerHour,
            costTotal: (qty / 60) * item.costPerHour
        });
        renderOrcamentoMachines();
        calculateBudget();
    }

    closeModal('modal-orcamento-select');
});

function saveBudget() {
    const clienteSelect = document.getElementById('orc-cliente');
    const clienteName = clienteSelect.value ? clienteSelect.options[clienteSelect.selectedIndex]?.text : 'Sem cliente';
    const produto = document.getElementById('orc-produto').value.trim();
    if (!produto) { showToast('Informe o nome do produto/serviço!', 'error'); return; }

    const qtd = parseFloat(document.getElementById('orc-quantidade').value) || 1;
    const data = document.getElementById('orc-data').value || new Date().toISOString().split('T')[0];
    const tempoGasto = parseFloat(document.getElementById('orc-tempo-gasto').value) || 0;
    const valorHora = parseFloat(document.getElementById('orc-valor-hora').value) || 0;
    const margem = parseFloat(document.getElementById('orc-margem').value) || 0;
    const taxa = parseFloat(document.getElementById('orc-taxa-plataforma').value) || 0;
    const taxaFixa = parseFloat(document.getElementById('orc-taxa-fixa').value) || 0;
    const aluguel = parseFloat(document.getElementById('orc-aluguel').value) || 0;
    const internet = parseFloat(document.getElementById('orc-internet').value) || 0;
    const mei = parseFloat(document.getElementById('orc-mei').value) || 0;
    const outros = parseFloat(document.getElementById('orc-outros').value) || 0;
    const horasDia = parseFloat(document.getElementById('orc-horas-dia').value) || 1;
    const diasMes = parseFloat(document.getElementById('orc-dias-mes').value) || 1;

    const custoMateriais = currentBudgetMaterials.reduce((sum, m) => sum + m.quantity * m.unitCost, 0);
    const custoMaquinas = currentBudgetMachines.reduce((sum, m) => sum + (m.timeMinutes / 60) * m.costPerHour, 0);
    const custoMO = (tempoGasto / 60) * valorHora;
    const totalFixos = aluguel + internet + mei + outros;
    const custoFixoHora = totalFixos / (horasDia * diasMes);
    const custoFixo = custoFixoHora * (tempoGasto / 60);
    const custoTotal = custoMateriais + custoMaquinas + custoMO;
    const precoSugerido = taxa >= 100 ? 0 : ((custoMateriais + custoMaquinas) * (1 + margem / 100) + custoMO + taxaFixa) / (1 - taxa / 100);
    const precoFinalInput = document.getElementById('orc-result-preco-final');
    const rawVal = precoFinalInput ? precoFinalInput.value.replace(',', '.') : '';
    const precoFinal = precoFinalInput && rawVal !== '' && !isNaN(parseFloat(rawVal)) ? parseFloat(rawVal) : precoSugerido;
    const lucro = precoFinal - custoTotal;

    const budget = {
        id: Date.now(),
        date: data,
        clienteId: clienteSelect.value || '',
        clienteName,
        produto,
        quantidade: qtd,
        tempoGasto, valorHora, margem, taxa, taxaFixa,
        aluguel, internet, mei, outros, horasDia, diasMes,
        modoCalculo: document.getElementById('orc-modo-calculo').value,
        peso: parseFloat(document.getElementById('orc-peso').value) || 0,
        filamentoId: parseInt(document.getElementById('orc-filamento').value) || 0,
        tempoImpressao: getTempoImpressaoMin(),
        falhas: parseFloat(document.getElementById('orc-falhas').value) || 0,
        acabamento: parseFloat(document.getElementById('orc-acabamento').value) || 0,
        fixacao: parseFloat(document.getElementById('orc-fixacao').value) || 0,
        roiMeses: parseFloat(document.getElementById('orc-roi-meses').value) || 12,
        maquinasAtivas: parseFloat(document.getElementById('orc-maquinas-ativas').value) || 1,
        materials: JSON.parse(JSON.stringify(currentBudgetMaterials)),
        machines: JSON.parse(JSON.stringify(currentBudgetMachines)),
        custoMateriais, custoMaquinas, custoMO, custoFixo, custoTotal,
        precoSugerido, precoFinal, lucro,
        status: 'rascunho',
        createdAt: new Date().toISOString()
    };

    const isEditing = !!editingBudgetId;
    if (editingBudgetId) {
        const idx = savedBudgets.findIndex(b => b.id === editingBudgetId);
        if (idx !== -1) {
            budget.id = editingBudgetId;
            budget.createdAt = savedBudgets[idx].createdAt;
            savedBudgets[idx] = budget;
        }
        editingBudgetId = null;
        document.getElementById('salvar-orcamento-btn').textContent = 'Salvar Orçamento';
    } else {
        savedBudgets.push(budget);
    }
    saveOrcamentoData();

    const bId = budget.id;
    (async () => {
        const { error } = await supabaseClient.from('orcamentos').upsert([{
            id: bId, data: budget.date, cliente_nome: budget.clienteName,
            cliente_id: budget.clienteId ? parseInt(budget.clienteId) : null,
            produto: budget.produto, quantidade: budget.quantidade,
            custo_total: budget.custoTotal, preco_sugerido: budget.precoSugerido,
            preco_final: budget.precoFinal, lucro: budget.lucro, margem: budget.margem,
            taxa_plataforma: budget.taxa, taxa_fixa: budget.taxaFixa || 0,
            tempo_gasto: budget.tempoGasto, valor_hora: budget.valorHora,
            materiais_json: JSON.stringify(budget.materials || []),
            maquinas_json: JSON.stringify(budget.machines || []),
            custos_fixos_json: JSON.stringify({
                aluguel: budget.aluguel, internet: budget.internet, mei: budget.mei, outros: budget.outros,
                horas_dia: budget.horasDia, dias_mes: budget.diasMes
            }),
            modo_calculo: budget.modoCalculo || 'grafica',
            peso: budget.peso || 0, filamento_id: budget.filamentoId || null,
            tempo_impressao: budget.tempoImpressao || 0,
            falhas: budget.falhas || 10, acabamento: budget.acabamento || 10,
            fixacao: budget.fixacao || 0.10, roi_meses: budget.roiMeses || 12,
            maquinas_ativas: budget.maquinasAtivas || 1,
            custo_materiais: budget.custoMateriais, custo_maquinas: budget.custoMaquinas,
            custo_mo: budget.custoMO, custo_fixo: budget.custoFixo || 0,
            created_at: budget.createdAt || new Date().toISOString()
        }]);
        if (error) console.error('Erro ao salvar orçamento no Supabase:', error);
    })();

    showToast('Orçamento salvo com sucesso!');
    resetBudgetForm();
}

function resetBudgetForm() {
    document.getElementById('orc-produto').value = '';
    document.getElementById('orc-quantidade').value = '1';
    document.getElementById('orc-tempo-gasto').value = '20';
    document.getElementById('orc-cliente').value = '';
    const dataInput = document.getElementById('orc-data');
    if (dataInput) dataInput.value = new Date().toISOString().split('T')[0];
    document.getElementById('orc-taxa-fixa').value = '0';
    document.getElementById('orc-peso').value = '100';
    document.getElementById('orc-filamento').value = '';
    document.getElementById('orc-tempo-impressao-h').value = '0';
    document.getElementById('orc-tempo-impressao-min').value = '30';
    document.getElementById('orc-falhas').value = '10';
    document.getElementById('orc-acabamento').value = '10';
    document.getElementById('orc-fixacao').value = '0.10';
    document.getElementById('orc-roi-meses').value = '12';
    document.getElementById('orc-maquinas-ativas').value = '1';
    document.getElementById('orc-modo-calculo').value = 'grafica';
    currentBudgetMaterials = [];
    currentBudgetMachines = [];
    renderOrcamentoMaterials();
    renderOrcamentoMachines();
    const precoFinalInput = document.getElementById('orc-result-preco-final');
    if (precoFinalInput) precoFinalInput.value = '';
    orcPrecoFinalChanged = false;
    editingBudgetId = null;
    document.getElementById('salvar-orcamento-btn').textContent = 'Salvar Orçamento';
    toggleOrcamentoMode();
    calculateBudget();
    showToast('Novo orçamento iniciado!');
}

function loadBudget(id) {
    const budget = savedBudgets.find(b => b.id === id);
    if (!budget) { showToast('Orçamento não encontrado!', 'error'); return; }
    document.getElementById('orc-data').value = budget.date;
    const clienteSelect = document.getElementById('orc-cliente');
    if (clienteSelect) clienteSelect.value = budget.clienteId || '';
    document.getElementById('orc-produto').value = budget.produto;
    document.getElementById('orc-quantidade').value = budget.quantidade;
    document.getElementById('orc-tempo-gasto').value = budget.tempoGasto;
    document.getElementById('orc-valor-hora').value = budget.valorHora;
    document.getElementById('orc-margem').value = budget.margem;
    document.getElementById('orc-taxa-plataforma').value = budget.taxa;
    document.getElementById('orc-taxa-fixa').value = budget.taxaFixa || 0;
    document.getElementById('orc-aluguel').value = budget.aluguel;
    document.getElementById('orc-internet').value = budget.internet;
    document.getElementById('orc-mei').value = budget.mei;
    document.getElementById('orc-outros').value = budget.outros;
    document.getElementById('orc-horas-dia').value = budget.horasDia;
    document.getElementById('orc-dias-mes').value = budget.diasMes;
    const savedMode = budget.modoCalculo === 'geral' ? 'grafica' : (budget.modoCalculo || 'grafica');
    document.getElementById('orc-modo-calculo').value = savedMode;
    document.getElementById('orc-peso').value = budget.peso || 0;
    document.getElementById('orc-filamento').value = budget.filamentoId || '';
    const totalMin = budget.tempoImpressao || 0;
    document.getElementById('orc-tempo-impressao-h').value = Math.floor(totalMin / 60);
    document.getElementById('orc-tempo-impressao-min').value = Math.round(totalMin % 60);
    document.getElementById('orc-falhas').value = budget.falhas || 10;
    document.getElementById('orc-acabamento').value = budget.acabamento || 10;
    document.getElementById('orc-fixacao').value = budget.fixacao || 0.10;
    document.getElementById('orc-roi-meses').value = budget.roiMeses || 12;
    document.getElementById('orc-maquinas-ativas').value = budget.maquinasAtivas || 1;
    currentBudgetMaterials = budget.materials ? JSON.parse(JSON.stringify(budget.materials)) : [];
    currentBudgetMachines = budget.machines ? JSON.parse(JSON.stringify(budget.machines)) : [];
    renderOrcamentoMaterials();
    renderOrcamentoMachines();
    toggleOrcamentoMode();
    calculateBudget();
    const precoFinalInput = document.getElementById('orc-result-preco-final');
    if (precoFinalInput) {
        precoFinalInput.value = budget.precoFinal > 0 ? budget.precoFinal.toFixed(2) : '0';
        orcPrecoFinalChanged = budget.precoFinal > 0;
    }
    if (orcPrecoFinalChanged) calculateBudget();
    closeModal('modal-historico-orcamentos');
    showToast('Orçamento carregado!');
}

function deleteBudget(id) {
    openConfirmationModal('Excluir Orçamento', 'Tem certeza que deseja excluir este orçamento?', () => {
        savedBudgets = savedBudgets.filter(b => b.id !== id);
        saveOrcamentoData();
        supabaseClient.from('orcamentos').delete().eq('id', id)
            .then(({ error }) => { if (error) console.error('Erro ao excluir orçamento no Supabase:', error); });
        renderHistoricoOrcamentos();
    });
}

function populateHistoricoMonthYear() {
    const mesSelect = document.getElementById('historico-mes-select');
    const anoSelect = document.getElementById('historico-ano-select');
    if (!mesSelect || !anoSelect) return;
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    if (mesSelect.options.length === 0) {
        mesSelect.innerHTML = '<option value="-1">Todos</option>' + meses.map((m, i) => `<option value="${i}">${m}</option>`).join('');
        mesSelect.value = '-1';
    }
    if (anoSelect.options.length === 0) {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear; y >= 2024; y--) {
            anoSelect.innerHTML += `<option value="${y}">${y}</option>`;
        }
        anoSelect.value = currentYear;
    }
}

function renderHistoricoOrcamentos() {
    const container = document.getElementById('historico-orcamentos-list');
    const summaryDiv = document.getElementById('historico-orcamentos-summary');
    if (!container) return;

    populateHistoricoMonthYear();

    const mes = parseInt(document.getElementById('historico-mes-select').value);
    const ano = parseInt(document.getElementById('historico-ano-select').value);

    let filtered = [...savedBudgets];
    if (mes >= 0 && !isNaN(ano)) {
        filtered = filtered.filter(b => {
            const d = new Date(b.date + 'T00:00:00');
            return d.getMonth() === mes && d.getFullYear() === ano;
        });
    }
    filtered.sort((a, b) => new Date(b.date + 'T00:00:00') - new Date(a.date + 'T00:00:00'));

    container.innerHTML = '';
    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-8">Nenhum orçamento encontrado.</p>';
        if (summaryDiv) summaryDiv.innerHTML = '';
        return;
    }

    const totalCusto = filtered.reduce((s, b) => s + b.custoTotal, 0);
    const totalVenda = filtered.reduce((s, b) => s + b.precoFinal, 0);
    const totalLucro = filtered.reduce((s, b) => s + b.lucro, 0);

    let html = `<div class="overflow-x-auto"><table class="w-full text-left text-sm">
        <thead><tr class="border-b text-[var(--text-secondary)]">
            <th class="p-2 whitespace-nowrap">Data</th>
            <th class="p-2 whitespace-nowrap">Cliente</th>
            <th class="p-2 whitespace-nowrap">Produto</th>
            <th class="p-2 text-right whitespace-nowrap">Custo Total</th>
            <th class="p-2 text-right whitespace-nowrap">Venda Total</th>
            <th class="p-2 text-right whitespace-nowrap">Lucro Total</th>
            <th class="p-2 text-right whitespace-nowrap">Custo Unit</th>
            <th class="p-2 text-right whitespace-nowrap">Venda Unit</th>
            <th class="p-2 text-right whitespace-nowrap">Lucro Unit</th>
            <th class="p-2 text-right whitespace-nowrap">Markup %</th>
            <th class="p-2 text-right whitespace-nowrap">Margem %</th>
            <th class="p-2 text-right whitespace-nowrap">Taxa Total</th>
            <th class="p-2 text-center whitespace-nowrap">Ações</th>
        </tr></thead><tbody>`;

    filtered.forEach(b => {
        const qtd = b.quantidade || 1;
        const custoUnit = b.custoTotal / qtd;
        const vendaUnit = b.precoFinal / qtd;
        const lucroUnit = b.lucro / qtd;
        const markupPct = custoUnit > 0 ? ((vendaUnit - custoUnit) / custoUnit) * 100 : 0;
        const margemPct = custoUnit > 0 ? ((vendaUnit - custoUnit) / vendaUnit) * 100 : 0;
        const taxaTotal = (b.precoFinal * (b.taxa || 0) / 100) + (b.taxaFixa || 0);
        const lucroClass = b.lucro >= 0 ? 'text-green-600' : 'text-red-600';

        html += `<tr class="border-b hover:bg-[var(--bg-tertiary)]">
            <td class="p-2 whitespace-nowrap">${new Date(b.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
            <td class="p-2 whitespace-nowrap">${b.clienteName}</td>
            <td class="p-2 font-medium whitespace-nowrap">${b.produto}</td>
            <td class="p-2 text-right text-red-600">${formatCurrency(b.custoTotal)}</td>
            <td class="p-2 text-right text-green-600 font-semibold">${formatCurrency(b.precoFinal)}</td>
            <td class="p-2 text-right ${lucroClass} font-semibold">${formatCurrency(b.lucro)}</td>
            <td class="p-2 text-right">${formatCurrency(custoUnit)}</td>
            <td class="p-2 text-right">${formatCurrency(vendaUnit)}</td>
            <td class="p-2 text-right ${lucroClass}">${formatCurrency(lucroUnit)}</td>
            <td class="p-2 text-right">${markupPct.toFixed(2)}%</td>
            <td class="p-2 text-right">${margemPct.toFixed(2)}%</td>
            <td class="p-2 text-right text-purple-600">${formatCurrency(taxaTotal)}</td>
            <td class="p-2 text-center whitespace-nowrap">
                <button data-id="${b.id}" class="edit-orcamento-btn text-blue-500 hover:text-blue-700 p-1" title="Editar"><i class="fas fa-edit"></i></button>
                <button data-id="${b.id}" class="view-orcamento-btn text-green-500 hover:text-green-700 p-1" title="Detalhes"><i class="fas fa-eye"></i></button>
                <button data-id="${b.id}" class="save-produto-btn text-yellow-600 hover:text-yellow-800 p-1" title="Salvar como Produto"><i class="fas fa-box"></i></button>
                <button data-id="${b.id}" class="delete-orcamento-btn text-red-500 hover:text-red-700 p-1" title="Excluir"><i class="fas fa-trash"></i></button>
            </td></tr>`;
    });

    // Summary row at the bottom
    const totalTaxa = filtered.reduce((s, b) => s + (b.precoFinal * (b.taxa || 0) / 100) + (b.taxaFixa || 0), 0);
    const margemTotal = totalCusto > 0 ? ((totalVenda - totalCusto) / totalCusto) * 100 : 0;
    html += `</tbody>
        <tfoot>
            <tr class="border-t-2 border-[var(--text-secondary)] font-bold">
                <td class="p-2" colspan="3">Total (${filtered.length} orçamentos)</td>
                <td class="p-2 text-right text-red-600">${formatCurrency(totalCusto)}</td>
                <td class="p-2 text-right text-green-600">${formatCurrency(totalVenda)}</td>
                <td class="p-2 text-right ${totalLucro >= 0 ? 'text-green-600' : 'text-red-600'}">${formatCurrency(totalLucro)}</td>
                <td class="p-2"></td>
                <td class="p-2"></td>
                <td class="p-2"></td>
                <td class="p-2"></td>
                <td class="p-2 text-right">${margemTotal.toFixed(2)}%</td>
                <td class="p-2 text-right text-purple-600">${formatCurrency(totalTaxa)}</td>
                <td class="p-2 text-center"></td>
            </tr>
        </tfoot></table></div>`;
    container.innerHTML = html;
    if (summaryDiv) summaryDiv.innerHTML = '';
}

function viewOrcamentoDetails(id) {
    const b = savedBudgets.find(x => x.id === id);
    if (!b) return;
    const content = document.getElementById('orcamento-detalhes-content');
    let html = `
        <div class="border-b pb-3 mb-3">
            <div class="grid grid-cols-2 gap-2">
                <p><strong>Data:</strong> ${new Date(b.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                <p><strong>Cliente:</strong> ${b.clienteName}</p>
                <p><strong>Produto:</strong> ${b.produto}</p>
                <p><strong>Quantidade:</strong> ${b.quantidade}</p>
            </div>
        </div>`;
    if (b.materials && b.materials.length > 0) {
        html += `<h4 class="font-bold mt-3 mb-1">Materiais:</h4><table class="w-full text-xs"><thead><tr class="border-b"><th class="p-1">Material</th><th class="p-1 text-center">Qtd</th><th class="p-1 text-right">Unit.</th><th class="p-1 text-right">Subtotal</th></tr></thead><tbody>`;
        b.materials.forEach(m => {
            html += `<tr><td class="p-1">${m.name}</td><td class="p-1 text-center">${m.quantity}</td><td class="p-1 text-right">${formatCurrency(m.unitCost)}</td><td class="p-1 text-right">${formatCurrency(m.quantity * m.unitCost)}</td></tr>`;
        });
        html += '</tbody></table>';
    }
    if (b.machines && b.machines.length > 0) {
        html += `<h4 class="font-bold mt-3 mb-1">Máquinas:</h4><table class="w-full text-xs"><thead><tr class="border-b"><th class="p-1">Máquina</th><th class="p-1 text-center">Tempo</th><th class="p-1 text-right">Custo</th></tr></thead><tbody>`;
        b.machines.forEach(m => {
            html += `<tr><td class="p-1">${m.name}</td><td class="p-1 text-center">${m.timeMinutes}min</td><td class="p-1 text-right">${formatCurrency((m.timeMinutes/60)*m.costPerHour)}</td></tr>`;
        });
        html += '</tbody></table>';
    }
    html += `
        <div class="border-t pt-3 mt-3 space-y-1">
            <div class="flex justify-between"><span>Custo Materiais:</span><span>${formatCurrency(b.custoMateriais)}</span></div>
            <div class="flex justify-between"><span>Custo Máquinas:</span><span>${formatCurrency(b.custoMaquinas)}</span></div>
            <div class="flex justify-between"><span>Mão de Obra:</span><span>${formatCurrency(b.custoMO)}</span></div>
            <div class="flex justify-between"><span>Custo Fixo:</span><span>${formatCurrency(b.custoFixo)}</span></div>
            <div class="flex justify-between font-bold"><span>Custo Total:</span><span class="text-red-600">${formatCurrency(b.custoTotal)}</span></div>
            <div class="flex justify-between"><span>Taxa Plataforma:</span><span>${formatCurrency((b.precoFinal * (b.taxa||0) / 100) + (b.taxaFixa||0))}</span></div>
            <div class="flex justify-between font-bold text-lg text-green-600 border-t pt-2 mt-2"><span>PREÇO FINAL:</span><span>${formatCurrency(b.precoFinal)}</span></div>
            <div class="flex justify-between text-green-600"><span>Lucro:</span><span>${formatCurrency(b.lucro)}</span></div>
            <div class="flex justify-between"><span>Venda Unidade:</span><span>${formatCurrency(b.precoFinal/b.quantidade)}</span></div>
        </div>`;
    content.innerHTML = html;
    openModal('modal-orcamento-detalhes');
}

function showProductBudgetDetails(p) {
    let d = p.budgetData;
    if (!d) {
        const stored = localStorage.getItem('produtoBudgetData_' + p.id);
        if (stored) {
            try { d = JSON.parse(stored); } catch(e) {}
        }
    }
    let html = `
        <div class="border-b pb-3 mb-3">
            <h4 class="text-lg font-bold">${p.name}</h4>
            <p class="text-sm text-[var(--text-secondary)]">Preço: ${formatCurrency(p.price)} | Custo: ${formatCurrency(p.cost)}</p>
            ${p.barcode ? `<p class="text-xs text-[var(--text-secondary)]">Cód. Barras: ${p.barcode}</p>` : ''}
        </div>`;
    if (!d) {
        html += `<p class="text-center text-gray-500 py-4">Nenhum dado de orçamento disponível para este produto.</p>`;
        if (p.cost > 0) {
            const margem = ((p.price - p.cost) / p.cost) * 100;
            html += `<div class="border-t pt-3 mt-3 space-y-1 text-sm">
                <div class="flex justify-between"><span>Margem de Lucro:</span><span class="text-green-600">${margem.toFixed(2)}%</span></div>
                <div class="flex justify-between"><span>Lucro:</span><span class="text-green-600">${formatCurrency(p.price - p.cost)}</span></div>
            </div>`;
        }
        const content = document.getElementById('orcamento-detalhes-content');
        content.innerHTML = html;
        openModal('modal-orcamento-detalhes');
        return;
    }
    if (d.materiais && d.materiais.length > 0) {
        html += `<h4 class="font-bold mt-3 mb-1">Materiais:</h4><table class="w-full text-xs"><thead><tr class="border-b"><th class="p-1">Insumo</th><th class="p-1 text-center">Qtd</th><th class="p-1 text-right">Unit.</th><th class="p-1 text-right">Subtotal</th></tr></thead><tbody>`;
        d.materiais.forEach(m => {
            html += `<tr><td class="p-1">${m.name}</td><td class="p-1 text-center">${m.quantity}</td><td class="p-1 text-right">${formatCurrency(m.unitCost)}</td><td class="p-1 text-right">${formatCurrency(m.quantity * m.unitCost)}</td></tr>`;
        });
        html += '</tbody></table>';
    }
    if (d.maquinas && d.maquinas.length > 0) {
        html += `<h4 class="font-bold mt-3 mb-1">Máquinas:</h4><table class="w-full text-xs"><thead><tr class="border-b"><th class="p-1">Máquina</th><th class="p-1 text-center">Tempo</th><th class="p-1 text-right">Custo</th></tr></thead><tbody>`;
        d.maquinas.forEach(m => {
            html += `<tr><td class="p-1">${m.name}</td><td class="p-1 text-center">${m.timeMinutes}min</td><td class="p-1 text-right">${formatCurrency((m.timeMinutes/60)*m.costPerHour)}</td></tr>`;
        });
        html += '</tbody></table>';
    }
    const custoMO = (d.tempoGasto / 60) * d.valorHora;
    html += `
        <div class="border-t pt-3 mt-3 space-y-1 text-sm">
            <div class="flex justify-between"><span>Quantidade:</span><span>${d.quantidade || 1}</span></div>
            <div class="flex justify-between"><span>Tempo Gasto:</span><span>${d.tempoGasto || 0} min</span></div>
            <div class="flex justify-between"><span>Valor Hora MO:</span><span>${formatCurrency(d.valorHora || 0)}</span></div>
            <div class="flex justify-between"><span>Custo Materiais:</span><span>${formatCurrency(d.custoMateriais)}</span></div>
            <div class="flex justify-between"><span>Custo Máquinas:</span><span>${formatCurrency(d.custoMaquinas)}</span></div>
            <div class="flex justify-between"><span>Custo Mão de Obra:</span><span>${formatCurrency(custoMO)}</span></div>
            <div class="flex justify-between"><span>Custo Fixo:</span><span>${formatCurrency(d.custoFixo || 0)}</span></div>
            <div class="flex justify-between"><span>Margem:</span><span>${d.margem || 0}%</span></div>
            <div class="flex justify-between"><span>Taxa Plataforma:</span><span>${d.taxa || 0}% + ${formatCurrency(d.taxaFixa || 0)}</span></div>
        </div>`;
    const content = document.getElementById('orcamento-detalhes-content');
    content.innerHTML = html;
    openModal('modal-orcamento-detalhes');
}

function printBudget() {
    const content = document.getElementById('orcamento-detalhes-content');
    if (!content) return;
    const b = savedBudgets[savedBudgets.length - 1];
    if (b) viewOrcamentoDetails(b.id);
    setTimeout(() => window.print(), 500);
}

function addOrcamentoEventListeners() {
    const o = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };

    o('orc-quantidade', 'input', calculateBudget);
    o('orc-tempo-gasto', 'input', calculateBudget);
    o('orc-valor-hora', 'input', calculateBudget);
    o('orc-margem', 'input', calculateBudget);
    o('orc-taxa-plataforma', 'input', calculateBudget);
    o('orc-taxa-fixa', 'input', calculateBudget);
    o('orc-result-preco-final', 'input', function() {
        orcPrecoFinalChanged = true;
        calculateBudget();
    });
    o('orc-modo-calculo', 'change', toggleOrcamentoMode);
    o('orc-filamento', 'change', onFilamentoChange);
    o('orc-peso', 'input', calculateBudget);
    o('orc-tempo-impressao-h', 'input', calculateBudget);
    o('orc-tempo-impressao-min', 'input', calculateBudget);
    o('orc-falhas', 'input', calculateBudget);
    o('orc-acabamento', 'input', calculateBudget);
    o('orc-fixacao', 'input', calculateBudget);
    o('orc-roi-meses', 'input', calculateBudget);
    o('orc-maquinas-ativas', 'input', calculateBudget);

    ['orc-aluguel', 'orc-internet', 'orc-mei', 'orc-outros', 'orc-horas-dia', 'orc-dias-mes'].forEach(id => {
        o(id, 'input', calculateBudget);
    });

    o('add-material-btn', 'click', () => {
        openOrcamentoSelectModal('material');
    });

    o('add-maquina-btn', 'click', () => {
        openOrcamentoSelectModal('machine');
    });

    o('orcamento-select-search', 'input', function() {
        renderOrcamentoSelectList(this.value);
    });

    o('salvar-orcamento-btn', 'click', saveBudget);
    o('limpar-orcamento-btn', 'click', resetBudgetForm);
    o('imprimir-orcamento-btn', 'click', printBudget);
    o('imprimir-orcamento-detalhes-btn', 'click', () => window.print());
    o('historico-filtrar-btn', 'click', renderHistoricoOrcamentos);
    o('historico-todos-btn', 'click', () => {
        document.getElementById('historico-mes-select').value = '-1';
        document.getElementById('historico-ano-select').value = new Date().getFullYear();
        renderHistoricoOrcamentos();
    });

    const addMaquinaForm = document.getElementById('add-maquina-form');
    if (addMaquinaForm) {
        addMaquinaForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addMachine(
                this.elements.maquinaNome.value,
                this.elements.maquinaPotencia.value,
                this.elements.maquinaPrecoLuz.value,
                this.elements.maquinaValor.value,
                this.elements.maquinaAnos.value,
                this.elements.maquinaHorasDia.value,
                this.elements.maquinaDepreciacao.value
            );
            this.reset();
        });
    }

    const editMaquinaForm = document.getElementById('edit-maquina-form');
    if (editMaquinaForm) {
        editMaquinaForm.addEventListener('submit', function(e) {
            e.preventDefault();
            editMachine(
                parseInt(this.elements.maquinaId.value),
                this.elements.maquinaNome.value,
                this.elements.maquinaPotencia.value,
                this.elements.maquinaPrecoLuz.value,
                this.elements.maquinaValor.value,
                this.elements.maquinaAnos.value,
                this.elements.maquinaHorasDia.value,
                this.elements.maquinaDepreciacao.value
            );
            closeModal('modal-edit-maquina');
        });
    }

    const addInsumoForm = document.getElementById('add-insumo-form');
    if (addInsumoForm) {
        addInsumoForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addSupply(
                this.elements.insumoNome.value,
                this.elements.insumoPrecoPacote.value,
                this.elements.insumoQtdPacote.value
            );
            this.reset();
        });
    }

    const editInsumoForm = document.getElementById('edit-insumo-form');
    if (editInsumoForm) {
        editInsumoForm.addEventListener('submit', function(e) {
            e.preventDefault();
            editSupply(
                parseInt(this.elements.insumoId.value),
                this.elements.insumoNome.value,
                this.elements.insumoPrecoPacote.value,
                this.elements.insumoQtdPacote.value
            );
            closeModal('modal-edit-insumo');
        });
    }

    const addMaquinaFormView = document.getElementById('add-maquina-form-view');
    if (addMaquinaFormView) {
        addMaquinaFormView.addEventListener('submit', function(e) {
            e.preventDefault();
            addMachine(
                this.elements.maquinaNome.value,
                this.elements.maquinaPotencia.value,
                this.elements.maquinaPrecoLuz.value,
                this.elements.maquinaValor.value,
                this.elements.maquinaAnos.value,
                this.elements.maquinaHorasDia.value,
                this.elements.maquinaDepreciacao.value
            );
            this.reset();
        });
    }

    const addInsumoFormView = document.getElementById('add-insumo-form-view');
    if (addInsumoFormView) {
        addInsumoFormView.addEventListener('submit', function(e) {
            e.preventDefault();
            addSupply(
                this.elements.insumoNome.value,
                this.elements.insumoPrecoPacote.value,
                this.elements.insumoQtdPacote.value
            );
            this.reset();
        });
    }

    const addFilamentoFormView = document.getElementById('add-filamento-form-view');
    if (addFilamentoFormView) {
        addFilamentoFormView.addEventListener('submit', function(e) {
            e.preventDefault();
            addFilamento(
                this.elements.filamentoNome.value,
                this.elements.filamentoPreco.value
            );
            this.reset();
            renderFilamentosList();
        });
    }

    const editFilamentoForm = document.getElementById('edit-filamento-form');
    if (editFilamentoForm) {
        editFilamentoForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const id = parseInt(document.getElementById('edit-filamento-id').value);
            const nome = document.getElementById('edit-filamento-nome').value;
            const preco = document.getElementById('edit-filamento-preco').value;
            editFilamento(id, nome, preco);
            closeModal('modal-edit-filamento');
            renderFilamentosList();
        });
    }
}

function renderMaquinasView() {
    loadOrcamentoData();
    renderOrcamentoMachinesList();
}

function renderInsumosView() {
    loadOrcamentoData();
    renderOrcamentoSuppliesList();
}

function renderFilamentosView() {
    loadOrcamentoData();
    renderFilamentosList();
}

function renderFilamentosList() {
    const containers = ['filamentos-list', 'filamentos-list-view'];
    containers.forEach(id => {
        const list = document.getElementById(id);
        if (!list) return;
        list.innerHTML = '';
        if (filamentCatalog.length === 0) {
            list.innerHTML = '<p class="text-center text-gray-500 py-4">Nenhum filamento cadastrado.</p>';
            return;
        }
        let html = `<table class="w-full text-left text-sm"><thead><tr class="border-b">
            <th class="p-2">Filamento</th><th class="p-2 text-right">Preço/kg</th>
            <th class="p-2 text-center">Ações</th></tr></thead><tbody>`;
        filamentCatalog.forEach(f => {
            html += `<tr class="border-b hover:bg-[var(--bg-tertiary)]">
                <td class="p-2 font-medium">${f.name}</td>
                <td class="p-2 text-right font-semibold text-purple-600">${formatCurrency(f.priceKg)}</td>
                <td class="p-2 text-center">
                    <button data-id="${f.id}" class="edit-filamento-btn text-blue-500 hover:text-blue-700 p-1"><i class="fas fa-edit"></i></button>
                    <button data-id="${f.id}" class="delete-filamento-btn text-red-500 hover:text-red-700 p-1"><i class="fas fa-trash"></i></button>
                </td></tr>`;
        });
        html += '</tbody></table>';
        list.innerHTML = html;
    });

    document.querySelectorAll('.edit-filamento-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = parseInt(this.dataset.id);
            const f = filamentCatalog.find(fil => fil.id === id);
            if (!f) return;
            document.getElementById('edit-filamento-id').value = f.id;
            document.getElementById('edit-filamento-nome').value = f.name;
            document.getElementById('edit-filamento-preco').value = f.priceKg;
            openModal('modal-edit-filamento');
        });
    });

    document.querySelectorAll('.delete-filamento-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = parseInt(this.dataset.id);
            openConfirmationModal('Excluir Filamento', 'Tem certeza que deseja excluir este filamento?', () => {
                deleteFilamento(id);
                renderFilamentosList();
            });
        });
    });
}
