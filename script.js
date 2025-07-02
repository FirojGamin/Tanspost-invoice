
// Global variables
let invoiceData = {
    items: [],
    invoiceNumber: 'INV-001',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
};

// Google Maps variables
let map;
let directionsService;
let directionsRenderer;
let currentRoute = null;
let userLocation = null;
let placesService;

let savedInvoices = JSON.parse(localStorage.getItem('transportInvoices')) || [];
let savedExpenses = JSON.parse(localStorage.getItem('transportExpenses')) || [];
let currentInvoiceId = null;
let currentExpenseId = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    loadDefaultValues();
    updateStatusBar();
    registerServiceWorker();
});

function initializeApp() {
    // Set default dates
    document.getElementById('invoiceDate').value = invoiceData.date;
    document.getElementById('dueDate').value = invoiceData.dueDate;
    
    // Add initial transport item
    addTransportItem();
    
    // Setup event listeners
    setupEventListeners();
    
    showNotification('Transport Invoice System Loaded', 'success');
}

function setupEventListeners() {
    // Auto-save functionality
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('change', autoSave);
    });
    
    // Real-time calculations
    document.getElementById('taxRate').addEventListener('input', calculateTotals);
    document.getElementById('discountRate').addEventListener('input', calculateTotals);
}

function loadDefaultValues() {
    document.getElementById('companyName').value = 'Premium Transport Services';
    document.getElementById('companyAddress').value = '123 Transport Avenue\nLogistics City, LC 12345';
    document.getElementById('companyPhone').value = '+1-555-TRANS';
    document.getElementById('companyEmail').value = 'billing@premiumtransport.com';
}

// Transport item management
function addTransportItem() {
    const tableBody = document.getElementById('itemsTableBody');
    const rowCount = tableBody.children.length;
    
    const row = document.createElement('tr');
    row.className = 'fade-in';
    row.innerHTML = `
        <td><input type="text" placeholder="Transport service description" onchange="calculateTotals()"></td>
        <td><input type="text" placeholder="Origin location" onchange="calculateTotals()"></td>
        <td><input type="text" placeholder="Destination location" onchange="calculateTotals()"></td>
        <td><input type="number" placeholder="0" step="0.1" onchange="calculateTotals()"></td>
        <td><input type="number" placeholder="0.00" step="0.01" onchange="calculateTotals()"></td>
        <td><input type="number" placeholder="1" min="1" onchange="calculateTotals()"></td>
        <td class="amount">$0.00</td>
        <td><button class="remove-btn" onclick="removeTransportItem(this)"><i class="fas fa-trash"></i></button></td>
    `;
    
    tableBody.appendChild(row);
    calculateTotals();
}

function removeTransportItem(button) {
    const row = button.closest('tr');
    row.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => {
        row.remove();
        calculateTotals();
    }, 300);
}

// Calculations
function calculateTotals() {
    const rows = document.querySelectorAll('#itemsTableBody tr');
    let subtotal = 0;
    
    rows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        const distance = parseFloat(inputs[3].value) || 0;
        const rate = parseFloat(inputs[4].value) || 0;
        const quantity = parseFloat(inputs[5].value) || 1;
        
        const amount = distance * rate * quantity;
        row.querySelector('.amount').textContent = `$${amount.toFixed(2)}`;
        subtotal += amount;
    });
    
    const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
    const discountRate = parseFloat(document.getElementById('discountRate').value) || 0;
    
    const taxAmount = subtotal * (taxRate / 100);
    const discountAmount = subtotal * (discountRate / 100);
    const total = subtotal + taxAmount - discountAmount;
    
    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('taxAmount').textContent = `$${taxAmount.toFixed(2)}`;
    document.getElementById('discountAmount').textContent = `$${discountAmount.toFixed(2)}`;
    document.getElementById('totalAmount').textContent = `$${total.toFixed(2)}`;
    
    updateStatusBar();
}

// Invoice management
function createNewInvoice() {
    if (confirm('Create a new invoice? Any unsaved changes will be lost.')) {
        // Reset form
        document.querySelector('.invoice-form').reset();
        document.getElementById('itemsTableBody').innerHTML = '';
        
        // Generate new invoice number
        const newNumber = 'INV-' + String(Date.now()).slice(-6);
        document.getElementById('invoiceNumber').value = newNumber;
        
        // Set dates
        document.getElementById('invoiceDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('dueDate').value = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        addTransportItem();
        currentInvoiceId = null;
        
        showNotification('New invoice created', 'success');
    }
}

function saveInvoice() {
    const invoiceData = collectInvoiceData();
    
    if (!invoiceData.companyName || !invoiceData.customerName) {
        showNotification('Please fill in company and customer information', 'error');
        return;
    }
    
    if (currentInvoiceId) {
        // Update existing invoice
        const index = savedInvoices.findIndex(inv => inv.id === currentInvoiceId);
        if (index !== -1) {
            savedInvoices[index] = { ...invoiceData, id: currentInvoiceId };
        }
    } else {
        // Create new invoice
        const newInvoice = {
            ...invoiceData,
            id: Date.now(),
            createdAt: new Date().toISOString()
        };
        savedInvoices.push(newInvoice);
        currentInvoiceId = newInvoice.id;
    }
    
    localStorage.setItem('transportInvoices', JSON.stringify(savedInvoices));
    document.getElementById('lastSaved').textContent = `Last Saved: ${new Date().toLocaleTimeString()}`;
    
    showNotification('Invoice saved successfully', 'success');
    updateStatusBar();
}

function loadInvoice() {
    if (savedInvoices.length === 0) {
        showNotification('No saved invoices found', 'warning');
        return;
    }
    
    const invoiceList = savedInvoices.map(inv => 
        `${inv.invoiceNumber} - ${inv.customerName} - $${inv.total || '0.00'}`
    );
    
    const selection = prompt('Select an invoice to load:\n' + 
        invoiceList.map((item, index) => `${index + 1}. ${item}`).join('\n') +
        '\n\nEnter the number:'
    );
    
    const index = parseInt(selection) - 1;
    if (index >= 0 && index < savedInvoices.length) {
        loadInvoiceData(savedInvoices[index]);
        currentInvoiceId = savedInvoices[index].id;
        showNotification('Invoice loaded successfully', 'success');
    }
}

function loadInvoiceData(invoice) {
    // Load basic information
    Object.keys(invoice).forEach(key => {
        const element = document.getElementById(key);
        if (element && key !== 'items') {
            element.value = invoice[key];
        }
    });
    
    // Load items
    const tableBody = document.getElementById('itemsTableBody');
    tableBody.innerHTML = '';
    
    if (invoice.items && invoice.items.length > 0) {
        invoice.items.forEach(item => {
            addTransportItem();
            const lastRow = tableBody.lastElementChild;
            const inputs = lastRow.querySelectorAll('input');
            inputs[0].value = item.description || '';
            inputs[1].value = item.from || '';
            inputs[2].value = item.to || '';
            inputs[3].value = item.distance || '';
            inputs[4].value = item.rate || '';
            inputs[5].value = item.quantity || '';
        });
    } else {
        addTransportItem();
    }
    
    calculateTotals();
}

function collectInvoiceData() {
    const items = [];
    const rows = document.querySelectorAll('#itemsTableBody tr');
    
    rows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        items.push({
            description: inputs[0].value,
            from: inputs[1].value,
            to: inputs[2].value,
            distance: inputs[3].value,
            rate: inputs[4].value,
            quantity: inputs[5].value
        });
    });
    
    return {
        invoiceNumber: document.getElementById('invoiceNumber').value,
        invoiceDate: document.getElementById('invoiceDate').value,
        dueDate: document.getElementById('dueDate').value,
        invoiceStatus: document.getElementById('invoiceStatus').value,
        companyName: document.getElementById('companyName').value,
        companyAddress: document.getElementById('companyAddress').value,
        companyPhone: document.getElementById('companyPhone').value,
        companyEmail: document.getElementById('companyEmail').value,
        customerName: document.getElementById('customerName').value,
        customerAddress: document.getElementById('customerAddress').value,
        customerPhone: document.getElementById('customerPhone').value,
        customerEmail: document.getElementById('customerEmail').value,
        taxRate: document.getElementById('taxRate').value,
        discountRate: document.getElementById('discountRate').value,
        invoiceNotes: document.getElementById('invoiceNotes').value,
        paymentTerms: document.getElementById('paymentTerms').value,
        items: items,
        subtotal: document.getElementById('subtotal').textContent,
        taxAmount: document.getElementById('taxAmount').textContent,
        discountAmount: document.getElementById('discountAmount').textContent,
        total: document.getElementById('totalAmount').textContent
    };
}

function autoSave() {
    // Auto-save to sessionStorage every 30 seconds
    const autoSaveData = collectInvoiceData();
    sessionStorage.setItem('autoSaveInvoice', JSON.stringify(autoSaveData));
}

// Preview functionality
function previewInvoice() {
    const invoiceData = collectInvoiceData();
    const previewHTML = generateInvoiceHTML(invoiceData);
    
    document.getElementById('invoicePreview').innerHTML = previewHTML;
    document.getElementById('previewModal').style.display = 'block';
}

function closePreview() {
    document.getElementById('previewModal').style.display = 'none';
}

function generateInvoiceHTML(data) {
    const itemsHTML = data.items.map(item => {
        const amount = (parseFloat(item.distance) || 0) * (parseFloat(item.rate) || 0) * (parseFloat(item.quantity) || 1);
        return `
            <tr>
                <td>${item.description}</td>
                <td>${item.from}</td>
                <td>${item.to}</td>
                <td>${item.distance} km</td>
                <td>$${parseFloat(item.rate || 0).toFixed(2)}</td>
                <td>${item.quantity}</td>
                <td>$${amount.toFixed(2)}</td>
            </tr>
        `;
    }).join('');
    
    return `
        <div class="invoice-header">
            <h1 style="color: #2c3e50; text-align: center;">TRANSPORT INVOICE</h1>
            <div style="text-align: center; color: #7f8c8d;">
                <p>Invoice #: ${data.invoiceNumber}</p>
                <p>Date: ${formatDate(data.invoiceDate)}</p>
                <p>Due Date: ${formatDate(data.dueDate)}</p>
                <p>Status: <span style="text-transform: uppercase; font-weight: bold;">${data.invoiceStatus}</span></p>
            </div>
        </div>
        
        <div class="company-info">
            <div>
                <h3>From:</h3>
                <strong>${data.companyName}</strong><br>
                ${data.companyAddress.replace(/\n/g, '<br>')}<br>
                Phone: ${data.companyPhone}<br>
                Email: ${data.companyEmail}
            </div>
            <div>
                <h3>Bill To:</h3>
                <strong>${data.customerName}</strong><br>
                ${data.customerAddress.replace(/\n/g, '<br>')}<br>
                Phone: ${data.customerPhone}<br>
                Email: ${data.customerEmail}
            </div>
        </div>
        
        <div class="invoice-details">
            <h3>Transportation Services</h3>
            <table>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Distance</th>
                        <th>Rate/km</th>
                        <th>Quantity</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
            </table>
        </div>
        
        <div style="text-align: right; margin-top: 2rem;">
            <table style="margin-left: auto; width: 300px;">
                <tr><td>Subtotal:</td><td>${data.subtotal}</td></tr>
                <tr><td>Tax (${data.taxRate}%):</td><td>${data.taxAmount}</td></tr>
                <tr><td>Discount (${data.discountRate}%):</td><td>-${data.discountAmount}</td></tr>
                <tr style="font-weight: bold; font-size: 1.2rem; border-top: 2px solid #2c3e50;">
                    <td>Total:</td><td>${data.total}</td>
                </tr>
            </table>
        </div>
        
        ${data.invoiceNotes ? `
            <div style="margin-top: 2rem;">
                <h4>Notes:</h4>
                <p>${data.invoiceNotes}</p>
            </div>
        ` : ''}
        
        <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd; text-align: center; color: #7f8c8d;">
            <p>Payment Terms: ${data.paymentTerms.replace(/_/g, ' ').toUpperCase()}</p>
            <p>Thank you for your business!</p>
        </div>
    `;
}

// PDF Generation
function generatePDF() {
    const invoiceData = collectInvoiceData();
    const { jsPDF } = window.jspdf;
    
    if (!jsPDF) {
        showNotification('PDF library not loaded', 'error');
        return;
    }
    
    showLoader();
    
    setTimeout(() => {
        try {
            const pdf = new jsPDF();
            
            // Header
            pdf.setFontSize(24);
            pdf.setTextColor(44, 62, 80);
            pdf.text('TRANSPORT INVOICE', 105, 30, { align: 'center' });
            
            // Invoice details
            pdf.setFontSize(12);
            pdf.setTextColor(0, 0, 0);
            pdf.text(`Invoice #: ${invoiceData.invoiceNumber}`, 20, 50);
            pdf.text(`Date: ${formatDate(invoiceData.invoiceDate)}`, 20, 60);
            pdf.text(`Due Date: ${formatDate(invoiceData.dueDate)}`, 20, 70);
            pdf.text(`Status: ${invoiceData.invoiceStatus.toUpperCase()}`, 20, 80);
            
            // Company info
            pdf.setFontSize(14);
            pdf.text('From:', 20, 100);
            pdf.setFontSize(12);
            pdf.text(invoiceData.companyName, 20, 110);
            const companyLines = invoiceData.companyAddress.split('\n');
            companyLines.forEach((line, index) => {
                pdf.text(line, 20, 120 + (index * 10));
            });
            pdf.text(`Phone: ${invoiceData.companyPhone}`, 20, 140 + (companyLines.length * 10));
            pdf.text(`Email: ${invoiceData.companyEmail}`, 20, 150 + (companyLines.length * 10));
            
            // Customer info
            pdf.setFontSize(14);
            pdf.text('Bill To:', 110, 100);
            pdf.setFontSize(12);
            pdf.text(invoiceData.customerName, 110, 110);
            const customerLines = invoiceData.customerAddress.split('\n');
            customerLines.forEach((line, index) => {
                pdf.text(line, 110, 120 + (index * 10));
            });
            pdf.text(`Phone: ${invoiceData.customerPhone}`, 110, 140 + (customerLines.length * 10));
            pdf.text(`Email: ${invoiceData.customerEmail}`, 110, 150 + (customerLines.length * 10));
            
            // Items table
            let yPos = 180;
            pdf.setFontSize(14);
            pdf.text('Transportation Services:', 20, yPos);
            yPos += 20;
            
            // Table headers
            pdf.setFontSize(10);
            pdf.text('Description', 20, yPos);
            pdf.text('From', 60, yPos);
            pdf.text('To', 90, yPos);
            pdf.text('Distance', 120, yPos);
            pdf.text('Rate', 145, yPos);
            pdf.text('Qty', 165, yPos);
            pdf.text('Amount', 180, yPos);
            
            pdf.line(20, yPos + 2, 200, yPos + 2);
            yPos += 15;
            
            // Table rows
            invoiceData.items.forEach(item => {
                const amount = (parseFloat(item.distance) || 0) * (parseFloat(item.rate) || 0) * (parseFloat(item.quantity) || 1);
                pdf.text(item.description.substring(0, 20), 20, yPos);
                pdf.text(item.from.substring(0, 15), 60, yPos);
                pdf.text(item.to.substring(0, 15), 90, yPos);
                pdf.text(`${item.distance} km`, 120, yPos);
                pdf.text(`$${parseFloat(item.rate || 0).toFixed(2)}`, 145, yPos);
                pdf.text(item.quantity, 165, yPos);
                pdf.text(`$${amount.toFixed(2)}`, 180, yPos);
                yPos += 12;
            });
            
            // Totals
            yPos += 10;
            pdf.line(140, yPos, 200, yPos);
            yPos += 15;
            
            pdf.text('Subtotal:', 150, yPos);
            pdf.text(invoiceData.subtotal, 180, yPos);
            yPos += 12;
            
            pdf.text(`Tax (${invoiceData.taxRate}%):`, 150, yPos);
            pdf.text(invoiceData.taxAmount, 180, yPos);
            yPos += 12;
            
            pdf.text(`Discount (${invoiceData.discountRate}%):`, 150, yPos);
            pdf.text(`-${invoiceData.discountAmount}`, 180, yPos);
            yPos += 12;
            
            pdf.setFontSize(12);
            pdf.text('Total:', 150, yPos);
            pdf.text(invoiceData.total, 180, yPos);
            
            // Notes
            if (invoiceData.invoiceNotes) {
                yPos += 20;
                pdf.setFontSize(12);
                pdf.text('Notes:', 20, yPos);
                yPos += 10;
                pdf.setFontSize(10);
                const noteLines = pdf.splitTextToSize(invoiceData.invoiceNotes, 170);
                pdf.text(noteLines, 20, yPos);
            }
            
            // Footer
            pdf.setFontSize(10);
            pdf.setTextColor(127, 140, 141);
            pdf.text(`Payment Terms: ${invoiceData.paymentTerms.replace(/_/g, ' ').toUpperCase()}`, 105, 280, { align: 'center' });
            pdf.text('Thank you for your business!', 105, 290, { align: 'center' });
            
            hideLoader();
            
            // Store PDF for later use
            window.currentPDF = pdf;
            
            showNotification('PDF generated successfully', 'success');
            
        } catch (error) {
            hideLoader();
            console.error('PDF generation error:', error);
            showNotification('Error generating PDF', 'error');
        }
    }, 500);
}

function downloadPDF() {
    if (window.currentPDF) {
        const invoiceNumber = document.getElementById('invoiceNumber').value || 'invoice';
        window.currentPDF.save(`${invoiceNumber}.pdf`);
        showNotification('PDF downloaded successfully', 'success');
    } else {
        generatePDF();
        setTimeout(() => {
            if (window.currentPDF) {
                downloadPDF();
            }
        }, 1000);
    }
}

// Excel Export
function exportToExcel() {
    const invoiceData = collectInvoiceData();
    
    const workbook = XLSX.utils.book_new();
    
    // Create invoice data sheet
    const invoiceSheet = XLSX.utils.aoa_to_sheet([
        ['Transport Invoice'],
        [],
        ['Invoice Number:', invoiceData.invoiceNumber],
        ['Date:', invoiceData.invoiceDate],
        ['Due Date:', invoiceData.dueDate],
        ['Status:', invoiceData.invoiceStatus],
        [],
        ['Company Information:'],
        ['Name:', invoiceData.companyName],
        ['Address:', invoiceData.companyAddress],
        ['Phone:', invoiceData.companyPhone],
        ['Email:', invoiceData.companyEmail],
        [],
        ['Customer Information:'],
        ['Name:', invoiceData.customerName],
        ['Address:', invoiceData.customerAddress],
        ['Phone:', invoiceData.customerPhone],
        ['Email:', invoiceData.customerEmail],
        [],
        ['Transportation Services:'],
        ['Description', 'From', 'To', 'Distance (km)', 'Rate/km', 'Quantity', 'Amount']
    ]);
    
    // Add items
    invoiceData.items.forEach(item => {
        const amount = (parseFloat(item.distance) || 0) * (parseFloat(item.rate) || 0) * (parseFloat(item.quantity) || 1);
        XLSX.utils.sheet_add_aoa(invoiceSheet, [[
            item.description,
            item.from,
            item.to,
            item.distance,
            item.rate,
            item.quantity,
            amount.toFixed(2)
        ]], { origin: -1 });
    });
    
    // Add totals
    XLSX.utils.sheet_add_aoa(invoiceSheet, [
        [],
        ['Subtotal:', '', '', '', '', '', invoiceData.subtotal],
        [`Tax (${invoiceData.taxRate}%):`, '', '', '', '', '', invoiceData.taxAmount],
        [`Discount (${invoiceData.discountRate}%):`, '', '', '', '', '', `-${invoiceData.discountAmount}`],
        ['Total:', '', '', '', '', '', invoiceData.total]
    ], { origin: -1 });
    
    XLSX.utils.book_append_sheet(workbook, invoiceSheet, 'Invoice');
    
    // Create summary sheet
    const summaryData = savedInvoices.map(inv => [
        inv.invoiceNumber,
        inv.customerName,
        inv.invoiceDate,
        inv.invoiceStatus,
        inv.total
    ]);
    
    const summarySheet = XLSX.utils.aoa_to_sheet([
        ['Invoice Summary'],
        [],
        ['Invoice Number', 'Customer', 'Date', 'Status', 'Total'],
        ...summaryData
    ]);
    
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    
    const fileName = `Transport_Invoice_${invoiceData.invoiceNumber}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    showNotification('Excel file exported successfully', 'success');
}

// Email functionality
function emailInvoice() {
    const invoiceData = collectInvoiceData();
    const customerEmail = invoiceData.customerEmail;
    
    if (!customerEmail) {
        showNotification('Customer email is required', 'error');
        return;
    }
    
    const subject = encodeURIComponent(`Transport Invoice ${invoiceData.invoiceNumber}`);
    const body = encodeURIComponent(`Dear ${invoiceData.customerName},

Please find attached your transport invoice ${invoiceData.invoiceNumber} for the amount of ${invoiceData.total}.

Invoice Details:
- Date: ${formatDate(invoiceData.invoiceDate)}
- Due Date: ${formatDate(invoiceData.dueDate)}
- Total Amount: ${invoiceData.total}

Payment Terms: ${invoiceData.paymentTerms.replace(/_/g, ' ')}

Thank you for your business!

Best regards,
${invoiceData.companyName}`);
    
    const mailtoLink = `mailto:${customerEmail}?subject=${subject}&body=${body}`;
    window.open(mailtoLink);
    
    showNotification('Email client opened', 'success');
}

// Print functionality
function printInvoice() {
    const invoiceData = collectInvoiceData();
    const printWindow = window.open('', '_blank');
    
    const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Transport Invoice ${invoiceData.invoiceNumber}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { text-align: center; border-bottom: 3px solid #3498db; padding-bottom: 20px; margin-bottom: 30px; }
                .company-info { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                th { background: #f8f9fa; }
                .totals { text-align: right; margin-top: 20px; }
                .total-row { font-weight: bold; font-size: 1.2em; border-top: 2px solid #333; }
                @media print { body { margin: 0; } }
            </style>
        </head>
        <body>
            ${generateInvoiceHTML(invoiceData)}
        </body>
        </html>
    `;
    
    printWindow.document.write(printHTML);
    printWindow.document.close();
    printWindow.print();
    
    showNotification('Print dialog opened', 'success');
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function updateStatusBar() {
    document.getElementById('invoiceCount').textContent = `Invoices: ${savedInvoices.length}`;
    
    const totalRevenue = savedInvoices.reduce((sum, inv) => {
        const amount = parseFloat(inv.total?.replace('$', '') || 0);
        return sum + amount;
    }, 0);
    
    document.getElementById('totalRevenue').textContent = `Total Revenue: $${totalRevenue.toFixed(2)}`;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} fade-in`;
    notification.textContent = message;
    
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '9999';
    notification.style.minWidth = '300px';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.5s ease-out';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 500);
    }, 3000);
}

function showLoader() {
    const loader = document.createElement('div');
    loader.innerHTML = '<div class="spinner"></div><p>Processing...</p>';
    loader.style.position = 'fixed';
    loader.style.top = '50%';
    loader.style.left = '50%';
    loader.style.transform = 'translate(-50%, -50%)';
    loader.style.background = 'white';
    loader.style.padding = '20px';
    loader.style.borderRadius = '10px';
    loader.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
    loader.style.zIndex = '10000';
    loader.style.textAlign = 'center';
    loader.id = 'loader';
    
    document.body.appendChild(loader);
}

function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        document.body.removeChild(loader);
    }
}

// Advanced features
function duplicateInvoice() {
    const invoiceData = collectInvoiceData();
    const newNumber = 'INV-' + String(Date.now()).slice(-6);
    
    loadInvoiceData({
        ...invoiceData,
        invoiceNumber: newNumber,
        invoiceDate: new Date().toISOString().split('T')[0],
        invoiceStatus: 'draft'
    });
    
    currentInvoiceId = null;
    showNotification('Invoice duplicated', 'success');
}

function exportAllInvoices() {
    if (savedInvoices.length === 0) {
        showNotification('No invoices to export', 'warning');
        return;
    }
    
    const dataStr = JSON.stringify(savedInvoices, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `transport_invoices_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showNotification('All invoices exported', 'success');
}

function importInvoices() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedInvoices = JSON.parse(e.target.result);
                    if (Array.isArray(importedInvoices)) {
                        savedInvoices.push(...importedInvoices);
                        localStorage.setItem('transportInvoices', JSON.stringify(savedInvoices));
                        updateStatusBar();
                        showNotification(`${importedInvoices.length} invoices imported`, 'success');
                    } else {
                        showNotification('Invalid file format', 'error');
                    }
                } catch (error) {
                    showNotification('Error reading file', 'error');
                }
            };
            reader.readAsText(file);
        }
    };
    
    input.click();
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 'n':
                e.preventDefault();
                createNewInvoice();
                break;
            case 's':
                e.preventDefault();
                saveInvoice();
                break;
            case 'p':
                e.preventDefault();
                printInvoice();
                break;
            case 'e':
                e.preventDefault();
                exportToExcel();
                break;
        }
    }
});

// PWA Service Worker Registration
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('Service Worker registered:', registration);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    }
}

// WhatsApp Sharing
function shareViaWhatsApp() {
    const invoiceData = collectInvoiceData();
    const message = encodeURIComponent(`Transport Invoice ${invoiceData.invoiceNumber}

Customer: ${invoiceData.customerName}
Date: ${formatDate(invoiceData.invoiceDate)}
Total Amount: ${invoiceData.total}

Payment Terms: ${invoiceData.paymentTerms.replace(/_/g, ' ')}

Generated with Transport Invoice App`);
    
    const whatsappUrl = `https://wa.me/?text=${message}`;
    window.open(whatsappUrl, '_blank');
    
    showNotification('WhatsApp sharing opened', 'success');
}

// Enhanced Email with WhatsApp option
function shareInvoice() {
    const invoiceData = collectInvoiceData();
    
    const options = [
        { text: 'Email', action: () => emailInvoice() },
        { text: 'WhatsApp', action: () => shareViaWhatsApp() },
        { text: 'Copy Link', action: () => copyInvoiceLink() }
    ];
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h2>Share Invoice</h2>
                <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    ${options.map(option => `
                        <button class="btn btn-primary" onclick="${option.action.toString().slice(6, -1)}; this.closest('.modal').remove();">
                            ${option.text}
                        </button>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function copyInvoiceLink() {
    const invoiceData = collectInvoiceData();
    const link = `${window.location.origin}?invoice=${encodeURIComponent(JSON.stringify(invoiceData))}`;
    
    navigator.clipboard.writeText(link).then(() => {
        showNotification('Invoice link copied to clipboard', 'success');
    }).catch(() => {
        showNotification('Failed to copy link', 'error');
    });
}

// Tab Management
function showTab(tabId) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab and mark button as active
    document.getElementById(tabId).style.display = 'block';
    event.target.classList.add('active');
    
    // Initialize specific tab content
    if (tabId === 'expenses-tab') {
        loadExpenses();
        updateExpenseSummary();
    } else if (tabId === 'reports-tab') {
        updateReportsOverview();
    }
}

// Expenses Management
function addExpense() {
    const expenseData = {
        id: Date.now(),
        date: document.getElementById('expenseDate').value,
        category: document.getElementById('expenseCategory').value,
        description: document.getElementById('expenseDescription').value,
        amount: parseFloat(document.getElementById('expenseAmount').value) || 0,
        vehicle: document.getElementById('expenseVehicle').value,
        payment: document.getElementById('expensePayment').value,
        notes: document.getElementById('expenseNotes').value,
        createdAt: new Date().toISOString()
    };
    
    if (!expenseData.date || !expenseData.description || expenseData.amount <= 0) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    savedExpenses.push(expenseData);
    localStorage.setItem('transportExpenses', JSON.stringify(savedExpenses));
    
    clearExpenseForm();
    loadExpenses();
    updateExpenseSummary();
    
    showNotification('Expense added successfully', 'success');
}

function clearExpenseForm() {
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('expenseCategory').value = 'fuel';
    document.getElementById('expenseDescription').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseVehicle').value = '';
    document.getElementById('expensePayment').value = 'cash';
    document.getElementById('expenseNotes').value = '';
    currentExpenseId = null;
}

function loadExpenses() {
    const tableBody = document.getElementById('expensesTableBody');
    tableBody.innerHTML = '';
    
    const filteredExpenses = getFilteredExpenses();
    
    filteredExpenses.forEach(expense => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(expense.date)}</td>
            <td><span class="category-badge category-${expense.category}">${expense.category.charAt(0).toUpperCase() + expense.category.slice(1)}</span></td>
            <td>${expense.description}</td>
            <td>$${expense.amount.toFixed(2)}</td>
            <td>${expense.vehicle || '-'}</td>
            <td>${expense.payment.charAt(0).toUpperCase() + expense.payment.slice(1)}</td>
            <td>
                <button class="edit-btn" onclick="editExpense(${expense.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-btn" onclick="deleteExpense(${expense.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function getFilteredExpenses() {
    let filtered = [...savedExpenses];
    
    const categoryFilter = document.getElementById('expenseFilter').value;
    const fromDate = document.getElementById('expenseFromDate').value;
    const toDate = document.getElementById('expenseToDate').value;
    
    if (categoryFilter && categoryFilter !== 'all') {
        filtered = filtered.filter(expense => expense.category === categoryFilter);
    }
    
    if (fromDate) {
        filtered = filtered.filter(expense => expense.date >= fromDate);
    }
    
    if (toDate) {
        filtered = filtered.filter(expense => expense.date <= toDate);
    }
    
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function filterExpenses() {
    loadExpenses();
    updateExpenseSummary();
}

function editExpense(id) {
    const expense = savedExpenses.find(exp => exp.id === id);
    if (!expense) return;
    
    document.getElementById('expenseDate').value = expense.date;
    document.getElementById('expenseCategory').value = expense.category;
    document.getElementById('expenseDescription').value = expense.description;
    document.getElementById('expenseAmount').value = expense.amount;
    document.getElementById('expenseVehicle').value = expense.vehicle;
    document.getElementById('expensePayment').value = expense.payment;
    document.getElementById('expenseNotes').value = expense.notes;
    
    currentExpenseId = id;
    
    // Change add button to update button
    const addBtn = document.querySelector('.expense-actions .btn-primary');
    addBtn.innerHTML = '<i class="fas fa-save"></i> Update Expense';
    addBtn.onclick = updateExpense;
    
    showNotification('Expense loaded for editing', 'info');
}

function updateExpense() {
    if (!currentExpenseId) return;
    
    const expenseIndex = savedExpenses.findIndex(exp => exp.id === currentExpenseId);
    if (expenseIndex === -1) return;
    
    savedExpenses[expenseIndex] = {
        ...savedExpenses[expenseIndex],
        date: document.getElementById('expenseDate').value,
        category: document.getElementById('expenseCategory').value,
        description: document.getElementById('expenseDescription').value,
        amount: parseFloat(document.getElementById('expenseAmount').value) || 0,
        vehicle: document.getElementById('expenseVehicle').value,
        payment: document.getElementById('expensePayment').value,
        notes: document.getElementById('expenseNotes').value,
        updatedAt: new Date().toISOString()
    };
    
    localStorage.setItem('transportExpenses', JSON.stringify(savedExpenses));
    
    // Reset form and button
    clearExpenseForm();
    const addBtn = document.querySelector('.expense-actions .btn-primary');
    addBtn.innerHTML = '<i class="fas fa-plus"></i> Add Expense';
    addBtn.onclick = addExpense;
    
    loadExpenses();
    updateExpenseSummary();
    
    showNotification('Expense updated successfully', 'success');
}

function deleteExpense(id) {
    if (confirm('Are you sure you want to delete this expense?')) {
        savedExpenses = savedExpenses.filter(exp => exp.id !== id);
        localStorage.setItem('transportExpenses', JSON.stringify(savedExpenses));
        
        loadExpenses();
        updateExpenseSummary();
        
        showNotification('Expense deleted successfully', 'success');
    }
}

function updateExpenseSummary() {
    const filteredExpenses = getFilteredExpenses();
    const total = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    // Calculate monthly expenses (current month)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyExpenses = savedExpenses
        .filter(exp => {
            const expDate = new Date(exp.date);
            return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
        })
        .reduce((sum, exp) => sum + exp.amount, 0);
    
    // Calculate average per day (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentExpenses = savedExpenses
        .filter(exp => new Date(exp.date) >= thirtyDaysAgo)
        .reduce((sum, exp) => sum + exp.amount, 0);
    const averagePerDay = recentExpenses / 30;
    
    document.getElementById('totalExpenses').textContent = `$${total.toFixed(2)}`;
    document.getElementById('monthlyExpenses').textContent = `$${monthlyExpenses.toFixed(2)}`;
    document.getElementById('averageExpenses').textContent = `$${averagePerDay.toFixed(2)}`;
}

// Reports and Analytics
function updateReportsOverview() {
    const totalRevenue = savedInvoices.reduce((sum, inv) => {
        const amount = parseFloat(inv.total?.replace('$', '') || 0);
        return sum + amount;
    }, 0);
    
    const totalExpenses = savedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    
    document.getElementById('totalRevenueStat').textContent = `$${totalRevenue.toFixed(2)}`;
    document.getElementById('totalExpensesStat').textContent = `$${totalExpenses.toFixed(2)}`;
    document.getElementById('netProfitStat').textContent = `$${netProfit.toFixed(2)}`;
    document.getElementById('profitMarginStat').textContent = `${profitMargin.toFixed(1)}%`;
    
    // Color code profit
    const profitElement = document.getElementById('netProfitStat');
    profitElement.style.color = netProfit >= 0 ? '#27ae60' : '#e74c3c';
}

function generateExpenseReport() {
    const filteredExpenses = getFilteredExpenses();
    
    if (filteredExpenses.length === 0) {
        showNotification('No expenses found for the selected criteria', 'warning');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    // Header
    pdf.setFontSize(20);
    pdf.text('Expense Report', 105, 30, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.text(`Generated on: ${formatDate(new Date().toISOString().split('T')[0])}`, 20, 50);
    pdf.text(`Total Expenses: $${filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2)}`, 20, 60);
    
    // Table headers
    let yPos = 80;
    pdf.setFontSize(10);
    pdf.text('Date', 20, yPos);
    pdf.text('Category', 50, yPos);
    pdf.text('Description', 80, yPos);
    pdf.text('Amount', 140, yPos);
    pdf.text('Payment', 170, yPos);
    
    pdf.line(20, yPos + 2, 190, yPos + 2);
    yPos += 15;
    
    // Table rows
    filteredExpenses.forEach(expense => {
        if (yPos > 270) {
            pdf.addPage();
            yPos = 30;
        }
        
        pdf.text(formatDate(expense.date), 20, yPos);
        pdf.text(expense.category.substring(0, 15), 50, yPos);
        pdf.text(expense.description.substring(0, 25), 80, yPos);
        pdf.text(`$${expense.amount.toFixed(2)}`, 140, yPos);
        pdf.text(expense.payment.substring(0, 10), 170, yPos);
        yPos += 12;
    });
    
    pdf.save(`expense_report_${new Date().toISOString().split('T')[0]}.pdf`);
    showNotification('Expense report generated successfully', 'success');
}

function generateProfitLossReport() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    const totalRevenue = savedInvoices.reduce((sum, inv) => {
        const amount = parseFloat(inv.total?.replace('$', '') || 0);
        return sum + amount;
    }, 0);
    
    const totalExpenses = savedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const netProfit = totalRevenue - totalExpenses;
    
    // Group expenses by category
    const expensesByCategory = {};
    savedExpenses.forEach(expense => {
        expensesByCategory[expense.category] = (expensesByCategory[expense.category] || 0) + expense.amount;
    });
    
    // Header
    pdf.setFontSize(20);
    pdf.text('Profit & Loss Statement', 105, 30, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.text(`Report Period: All Time`, 105, 50, { align: 'center' });
    pdf.text(`Generated on: ${formatDate(new Date().toISOString().split('T')[0])}`, 105, 60, { align: 'center' });
    
    let yPos = 80;
    
    // Revenue Section
    pdf.setFontSize(14);
    pdf.text('REVENUE', 20, yPos);
    yPos += 15;
    
    pdf.setFontSize(12);
    pdf.text('Total Invoice Revenue:', 30, yPos);
    pdf.text(`$${totalRevenue.toFixed(2)}`, 150, yPos);
    yPos += 20;
    
    // Expenses Section
    pdf.setFontSize(14);
    pdf.text('EXPENSES', 20, yPos);
    yPos += 15;
    
    pdf.setFontSize(12);
    Object.entries(expensesByCategory).forEach(([category, amount]) => {
        pdf.text(`${category.charAt(0).toUpperCase() + category.slice(1)}:`, 30, yPos);
        pdf.text(`$${amount.toFixed(2)}`, 150, yPos);
        yPos += 10;
    });
    
    yPos += 10;
    pdf.text('Total Expenses:', 30, yPos);
    pdf.text(`$${totalExpenses.toFixed(2)}`, 150, yPos);
    yPos += 20;
    
    // Net Profit
    pdf.line(30, yPos - 5, 170, yPos - 5);
    pdf.setFontSize(14);
    pdf.text('NET PROFIT:', 30, yPos);
    pdf.text(`$${netProfit.toFixed(2)}`, 150, yPos);
    
    if (netProfit < 0) {
        pdf.setTextColor(255, 0, 0);
        pdf.text('(LOSS)', 120, yPos);
    }
    
    pdf.save(`profit_loss_report_${new Date().toISOString().split('T')[0]}.pdf`);
    showNotification('Profit & Loss report generated successfully', 'success');
}

function generateCategoryReport() {
    const expensesByCategory = {};
    savedExpenses.forEach(expense => {
        expensesByCategory[expense.category] = (expensesByCategory[expense.category] || 0) + expense.amount;
    });
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    // Header
    pdf.setFontSize(20);
    pdf.text('Expense Category Breakdown', 105, 30, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.text(`Generated on: ${formatDate(new Date().toISOString().split('T')[0])}`, 105, 50, { align: 'center' });
    
    let yPos = 80;
    const totalExpenses = Object.values(expensesByCategory).reduce((sum, amount) => sum + amount, 0);
    
    pdf.setFontSize(14);
    pdf.text('Category Breakdown:', 20, yPos);
    yPos += 20;
    
    pdf.setFontSize(12);
    Object.entries(expensesByCategory)
        .sort(([,a], [,b]) => b - a)
        .forEach(([category, amount]) => {
            const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
            pdf.text(`${category.charAt(0).toUpperCase() + category.slice(1)}:`, 30, yPos);
            pdf.text(`$${amount.toFixed(2)} (${percentage.toFixed(1)}%)`, 120, yPos);
            yPos += 15;
        });
    
    yPos += 10;
    pdf.line(30, yPos, 170, yPos);
    yPos += 10;
    pdf.text('Total:', 30, yPos);
    pdf.text(`$${totalExpenses.toFixed(2)}`, 120, yPos);
    
    pdf.save(`category_breakdown_${new Date().toISOString().split('T')[0]}.pdf`);
    showNotification('Category breakdown report generated successfully', 'success');
}

function exportExpensesToExcel() {
    if (savedExpenses.length === 0) {
        showNotification('No expenses to export', 'warning');
        return;
    }
    
    const workbook = XLSX.utils.book_new();
    
    // Expenses data
    const expensesData = [
        ['Date', 'Category', 'Description', 'Amount', 'Vehicle/Trip', 'Payment Method', 'Notes'],
        ...savedExpenses.map(expense => [
            expense.date,
            expense.category,
            expense.description,
            expense.amount,
            expense.vehicle || '',
            expense.payment,
            expense.notes || ''
        ])
    ];
    
    const expensesSheet = XLSX.utils.aoa_to_sheet(expensesData);
    XLSX.utils.book_append_sheet(workbook, expensesSheet, 'Expenses');
    
    // Summary data
    const expensesByCategory = {};
    savedExpenses.forEach(expense => {
        expensesByCategory[expense.category] = (expensesByCategory[expense.category] || 0) + expense.amount;
    });
    
    const summaryData = [
        ['Expense Category Summary'],
        ['Category', 'Total Amount'],
        ...Object.entries(expensesByCategory).map(([category, amount]) => [category, amount])
    ];
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    
    const fileName = `transport_expenses_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    showNotification('Expenses exported to Excel successfully', 'success');
}

// Initialize expenses tab
document.addEventListener('DOMContentLoaded', function() {
    // Set default expense date
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
    
    // Set default date range filters
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const lastDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];
    
    document.getElementById('expenseFromDate').value = firstDayOfMonth;
    document.getElementById('expenseToDate').value = lastDayOfMonth;
});

// Add category badge styles
const expenseStyle = document.createElement('style');
expenseStyle.textContent = `
    .category-badge {
        padding: 0.25rem 0.5rem;
        border-radius: 12px;
        color: white;
        font-size: 0.8rem;
        font-weight: 500;
        text-transform: capitalize;
    }
`;
document.head.appendChild(expenseStyle);

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-20px); }
    }
    
    .map-controls {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        margin-bottom: 1rem;
    }
    
    .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        padding: 1rem;
        background: #f8f9fa;
        border-radius: 8px;
    }
    
    .info-item {
        text-align: center;
    }
    
    .info-item strong {
        display: block;
        color: #2c3e50;
        margin-bottom: 0.5rem;
    }
    
    .route-info {
        border: 2px solid #3498db;
        border-radius: 8px;
        padding: 1rem;
        background: white;
    }
`;
document.head.appendChild(style);

// Google Maps Integration
function initializeMap() {
    if (typeof google === 'undefined') {
        showNotification('Google Maps API not loaded', 'error');
        return;
    }
    
    const mapOptions = {
        zoom: 10,
        center: { lat: 40.7128, lng: -74.0060 }, // Default to New York
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    
    map = new google.maps.Map(document.getElementById('map'), mapOptions);
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        draggable: true,
        panel: null
    });
    directionsRenderer.setMap(map);
    placesService = new google.maps.places.PlacesService(map);
    
    // Add click listener for adding waypoints
    map.addListener('click', function(e) {
        addMapMarker(e.latLng);
    });
    
    // Get user's location if available
    getCurrentLocationForMap();
}

function getCurrentLocation() {
    if (!navigator.geolocation) {
        showNotification('Geolocation is not supported by this browser', 'error');
        return;
    }
    
    showLoader();
    navigator.geolocation.getCurrentPosition(
        function(position) {
            hideLoader();
            userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            // Reverse geocode to get address
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: userLocation }, function(results, status) {
                if (status === 'OK' && results[0]) {
                    const address = results[0].formatted_address;
                    
                    // Fill in the first available "From" field
                    const fromInputs = document.querySelectorAll('#itemsTableBody tr input:nth-child(2)');
                    for (let input of fromInputs) {
                        if (!input.value) {
                            input.value = address;
                            break;
                        }
                    }
                    
                    showNotification(`Current location: ${address}`, 'success');
                } else {
                    showNotification('Unable to get address from GPS coordinates', 'warning');
                }
            });
        },
        function(error) {
            hideLoader();
            let message = 'Unable to get location: ';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    message += 'Location access denied by user';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message += 'Location information unavailable';
                    break;
                case error.TIMEOUT:
                    message += 'Location request timed out';
                    break;
                default:
                    message += 'Unknown error occurred';
                    break;
            }
            showNotification(message, 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        }
    );
}

function getCurrentLocationForMap() {
    if (!navigator.geolocation || !map) return;
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            map.setCenter(pos);
            map.setZoom(15);
            
            new google.maps.Marker({
                position: pos,
                map: map,
                title: 'Your Location',
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#3498db">
                            <circle cx="12" cy="12" r="8"/>
                            <circle cx="12" cy="12" r="3" fill="white"/>
                        </svg>
                    `),
                    scaledSize: new google.maps.Size(24, 24)
                }
            });
            
            userLocation = pos;
            showNotification('Location found and centered on map', 'success');
        },
        function() {
            showNotification('Unable to get your location for map', 'warning');
        }
    );
}

function showRouteMap() {
    document.getElementById('mapModal').style.display = 'block';
    
    // Initialize map if not already done
    setTimeout(() => {
        if (!map) {
            initializeMap();
        } else {
            google.maps.event.trigger(map, 'resize');
        }
    }, 100);
}

function closeMapModal() {
    document.getElementById('mapModal').style.display = 'none';
}

function calculateRoute() {
    if (!directionsService || !directionsRenderer) {
        showNotification('Maps service not initialized', 'error');
        return;
    }
    
    // Get route points from current invoice items
    const rows = document.querySelectorAll('#itemsTableBody tr');
    let waypoints = [];
    let origin = null;
    let destination = null;
    
    rows.forEach((row, index) => {
        const inputs = row.querySelectorAll('input');
        const from = inputs[1].value.trim();
        const to = inputs[2].value.trim();
        
        if (from && to) {
            if (!origin) origin = from;
            if (from !== origin && !waypoints.find(w => w.location === from)) {
                waypoints.push({ location: from, stopover: true });
            }
            if (to !== from && !waypoints.find(w => w.location === to)) {
                waypoints.push({ location: to, stopover: true });
            }
            destination = to;
        }
    });
    
    if (!origin || !destination) {
        showNotification('Please fill in origin and destination locations first', 'warning');
        return;
    }
    
    const request = {
        origin: origin,
        destination: destination,
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false
    };
    
    showLoader();
    directionsService.route(request, function(result, status) {
        hideLoader();
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
            currentRoute = result;
            displayRouteInfo(result);
            document.getElementById('routeInfo').style.display = 'block';
            showNotification('Route calculated successfully', 'success');
        } else {
            showNotification('Could not calculate route: ' + status, 'error');
        }
    });
}

function displayRouteInfo(result) {
    const route = result.routes[0];
    const leg = route.legs[0];
    
    let totalDistance = 0;
    let totalDuration = 0;
    
    route.legs.forEach(leg => {
        totalDistance += leg.distance.value;
        totalDuration += leg.duration.value;
    });
    
    const distanceKm = (totalDistance / 1000).toFixed(2);
    const durationHours = Math.floor(totalDuration / 3600);
    const durationMinutes = Math.floor((totalDuration % 3600) / 60);
    
    // Calculate estimated cost (assuming $2 per km)
    const estimatedCost = (distanceKm * 2).toFixed(2);
    
    document.getElementById('routeDistance').textContent = `${distanceKm} km`;
    document.getElementById('routeDuration').textContent = `${durationHours}h ${durationMinutes}m`;
    document.getElementById('routeCost').textContent = `$${estimatedCost}`;
}

function clearRoute() {
    if (directionsRenderer) {
        directionsRenderer.setDirections({ routes: [] });
    }
    currentRoute = null;
    document.getElementById('routeInfo').style.display = 'none';
    showNotification('Route cleared', 'info');
}

function useRouteData() {
    if (!currentRoute) {
        showNotification('No route data available', 'error');
        return;
    }
    
    const route = currentRoute.routes[0];
    let totalDistance = 0;
    
    route.legs.forEach(leg => {
        totalDistance += leg.distance.value;
    });
    
    const distanceKm = (totalDistance / 1000).toFixed(2);
    
    // Update the first empty distance field
    const rows = document.querySelectorAll('#itemsTableBody tr');
    for (let row of rows) {
        const distanceInput = row.querySelectorAll('input')[3];
        if (!distanceInput.value) {
            distanceInput.value = distanceKm;
            calculateTotals();
            break;
        }
    }
    
    closeMapModal();
    showNotification(`Route distance (${distanceKm} km) added to invoice`, 'success');
}

function addMapMarker(location) {
    new google.maps.Marker({
        position: location,
        map: map,
        title: 'Route Point'
    });
}

// Enhanced transport item with autocomplete
function addTransportItem() {
    const tableBody = document.getElementById('itemsTableBody');
    const rowCount = tableBody.children.length;
    
    const row = document.createElement('tr');
    row.className = 'fade-in';
    row.innerHTML = `
        <td><input type="text" placeholder="Transport service description" onchange="calculateTotals()"></td>
        <td><input type="text" class="places-input" placeholder="Origin location" onchange="calculateTotals()"></td>
        <td><input type="text" class="places-input" placeholder="Destination location" onchange="calculateTotals()"></td>
        <td>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <input type="number" placeholder="0" step="0.1" onchange="calculateTotals()">
                <button type="button" class="btn btn-sm btn-info" onclick="calculateDistanceForRow(this)" title="Calculate Distance">
                    <i class="fas fa-route"></i>
                </button>
            </div>
        </td>
        <td><input type="number" placeholder="0.00" step="0.01" onchange="calculateTotals()"></td>
        <td><input type="number" placeholder="1" min="1" onchange="calculateTotals()"></td>
        <td class="amount">$0.00</td>
        <td><button class="remove-btn" onclick="removeTransportItem(this)"><i class="fas fa-trash"></i></button></td>
    `;
    
    tableBody.appendChild(row);
    
    // Add autocomplete to location inputs
    if (typeof google !== 'undefined') {
        const fromInput = row.querySelector('input:nth-of-type(2)');
        const toInput = row.querySelector('input:nth-of-type(3)');
        
        new google.maps.places.Autocomplete(fromInput);
        new google.maps.places.Autocomplete(toInput);
    }
    
    calculateTotals();
}

function calculateDistanceForRow(button) {
    const row = button.closest('tr');
    const inputs = row.querySelectorAll('input');
    const fromLocation = inputs[1].value.trim();
    const toLocation = inputs[2].value.trim();
    const distanceInput = inputs[3];
    
    if (!fromLocation || !toLocation) {
        showNotification('Please enter both origin and destination', 'warning');
        return;
    }
    
    if (!directionsService) {
        directionsService = new google.maps.DirectionsService();
    }
    
    const request = {
        origin: fromLocation,
        destination: toLocation,
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC
    };
    
    showLoader();
    directionsService.route(request, function(result, status) {
        hideLoader();
        if (status === 'OK') {
            const distance = result.routes[0].legs[0].distance.value;
            const distanceKm = (distance / 1000).toFixed(2);
            distanceInput.value = distanceKm;
            calculateTotals();
            showNotification(`Distance calculated: ${distanceKm} km`, 'success');
        } else {
            showNotification('Could not calculate distance between locations', 'error');
        }
    });
}
