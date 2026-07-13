'use strict';

(function registerDealerSettingsEngine(global) {
  const platform = global.UniversalCPQ;
  if (!platform) return;

  const STORAGE_KEY = 'universal-cpq-dealer-settings';
  const text = value => String(value ?? '').trim();

  function normalize(raw = {}) {
    return {
      dealerId: text(raw.dealerId || raw.DealerID),
      dealerName: text(raw.dealerName || raw.DealerName),
      legalName: text(raw.legalName || raw.LegalName),
      address: text(raw.address || raw.Address),
      city: text(raw.city || raw.City),
      state: text(raw.state || raw.State),
      zip: text(raw.zip || raw.ZIP),
      phone: text(raw.phone || raw.Phone),
      email: text(raw.email || raw.Email),
      website: text(raw.website || raw.Website),
      logoUrl: text(raw.logoUrl || raw.LogoURL),
      primaryColor: text(raw.primaryColor || raw.PrimaryColor),
      secondaryColor: text(raw.secondaryColor || raw.SecondaryColor),
      accentColor: text(raw.accentColor || raw.AccentColor),
      quotePrefix: text(raw.quotePrefix || raw.QuotePrefix || 'QUOTE'),
      defaultQuoteValidDays: Number(raw.defaultQuoteValidDays || raw.DefaultQuoteValidDays || 14),
      defaultTaxRate: Number(raw.defaultTaxRate || raw.DefaultTaxRate || 0),
      defaultTerms: text(raw.defaultTerms || raw.DefaultTerms),
      defaultLocationId: text(raw.defaultLocationId || raw.DefaultLocationID)
    };
  }

  function load() {
    try {
      const parsed = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || 'null');
      return parsed ? normalize(parsed) : null;
    } catch (error) {
      console.error('Unable to read dealer settings.', error);
      return null;
    }
  }

  function save(settings) {
    const normalized = normalize(settings);
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function clear() {
    global.localStorage.removeItem(STORAGE_KEY);
  }

  function merge(defaults = {}, overrides = null) {
    return normalize({ ...normalize(defaults), ...(overrides ? normalize(overrides) : {}) });
  }

  platform.registry.registerEngine('dealer-settings', {
    name: 'Universal Dealer Identity & Settings',
    version: '1.0.0',
    configured: true,
    storageKey: STORAGE_KEY,
    normalize, load, save, clear, merge
  });
})(window);
