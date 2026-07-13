'use strict';

(function registerDocumentEngine(global) {
  const platform = global.UniversalCPQ;
  if (!platform) return;

  const text = value => String(value ?? '').trim();
  const number = value => {
    const parsed = Number(String(value ?? '').replace(/[$,%\s,]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const round = value => Math.round((number(value) + Number.EPSILON) * 100) / 100;

  function quoteNumber(prefix = 'QUOTE') {
    const now = new Date();
    const date = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('');
    const suffix = String(now.getTime()).slice(-5);
    return `${text(prefix) || 'QUOTE'}-${date}-${suffix}`;
  }

  function buildQuote(context = {}) {
    const configuration = context.configuration || {};
    const items = Array.isArray(configuration.items) ? configuration.items : [];
    const totals = configuration.totals || {};
    const customer = context.customer || {};
    const dealer = context.dealer || {};
    const application = context.application || {};
    const brand = context.brand || {};
    const createdAt = new Date().toISOString();

    const quoteItems = items.map(item => ({
      productId: text(item.productId), sku: text(item.sku), model: text(item.model),
      name: text(item.name), category: text(item.category), quantity: number(item.quantity),
      unitPrice: round(item.unitPrice), productTotal: round(item.productTotal),
      components: (item.components || []).map(component => ({
        componentId: text(component.componentId), sku: text(component.sku), name: text(component.name),
        type: text(component.type), quantity: number(component.quantity), unitPrice: round(component.unitPrice),
        lineTotal: round(component.lineTotal)
      })),
      componentTotal: round(item.componentTotal), lineTotal: round(item.lineTotal)
    }));

    return {
      schemaVersion: '1.0',
      quoteNumber: text(context.quoteNumber) || quoteNumber(dealer.quotePrefix || dealer.QuotePrefix || application.quotePrefix || brand.quotePrefix || 'QUOTE'),
      createdAt,
      status: 'DRAFT',
      application: { name:text(application.name), version:text(application.version), currency:text(application.currency || 'USD'), locale:text(application.locale || 'en-US') },
      dealer: {
  name: text(
    dealer.dealerName ||
    dealer.name ||
    dealer.DealerName
  ),

  address: text(
    dealer.address ||
    dealer.Address
  ),

  city: text(
    dealer.city ||
    dealer.City
  ),

  state: text(
    dealer.state ||
    dealer.State
  ),

  zip: text(
    dealer.zip ||
    dealer.ZIP
  ),

  phone: text(
    dealer.phone ||
    dealer.Phone
  ),

  email: text(
    dealer.email ||
    dealer.Email
  ),

  website: text(
    dealer.website ||
    dealer.Website
  )
},

      brand: { id:text(brand.id || brand.brandId), name:text(brand.name || brand.BrandName) },
      preparedBy: text(context.preparedBy),
      customer: { name:text(customer.name), business:text(customer.business), phone:text(customer.phone), email:text(customer.email), address:text(customer.address), city:text(customer.city), state:text(customer.state), zip:text(customer.zip), notes:text(customer.notes) },
      items: quoteItems,
      promotions: configuration.promotions || null,
      freight: configuration.freight || null,
      finance: configuration.finance || null,
      rules: configuration.rules || null,
      totals: {
        productSubtotal:round(totals.productSubtotal), componentSubtotal:round(totals.componentSubtotal),
        subtotal:round(totals.subtotal), promotions:round(totals.promotions), freight:round(totals.freight),
        tax:round(totals.tax), total:round(totals.total)
      },
      terms: text(context.terms),
      validThrough: text(context.validThrough)
    };
  }

  platform.registry.registerEngine('documents', {
    name:'Universal Quote & Document Engine', version:'1.2.0', configured:true,
    buildQuote,
    saveQuoteSession(quote, key='universal-cpq-current-quote') {
      const payload = JSON.stringify(quote);
      global.localStorage.setItem(key, payload);
      return quote;
    },
    saveQuote(quote, key='universal-cpq-saved-quotes') {
      const saved = this.listQuotes(key);
      const record = { ...quote, updatedAt: new Date().toISOString() };
      const index = saved.findIndex(item => item.quoteNumber === record.quoteNumber);
      if (index >= 0) saved[index] = record;
      else saved.unshift(record);
      global.localStorage.setItem(key, JSON.stringify(saved.slice(0, 250)));
      return record;
    },
    listQuotes(key='universal-cpq-saved-quotes') {
      try {
        const parsed = JSON.parse(global.localStorage.getItem(key) || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        console.error('Unable to read saved quotes.', error);
        return [];
      }
    },
    getQuote(quoteNumber, key='universal-cpq-saved-quotes') {
      return this.listQuotes(key).find(item => item.quoteNumber === quoteNumber) || null;
    },
    deleteQuote(quoteNumber, key='universal-cpq-saved-quotes') {
      const saved = this.listQuotes(key).filter(item => item.quoteNumber !== quoteNumber);
      global.localStorage.setItem(key, JSON.stringify(saved));
      return saved;
    }
  });
})(window);
