'use strict';

(function registerDealerRulesEngine(global) {
  const platform = global.UniversalCPQ;
  if (!platform) return;

  const text = value => String(value ?? '').trim();
  const norm = value => text(value).toLowerCase();
  const number = value => {
    const parsed = Number(text(value).replace(/[$,%\s,]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const active = value => !text(value) || ['true','t','yes','y','1'].includes(norm(value));
  const statusRank = { PASS:0, SKIPPED:0, WARNING:1, APPROVAL_REQUIRED:2, FAIL:3, BLOCKED:4 };

  function inDateWindow(rule, now = new Date()) {
    const start = text(rule.StartDate) ? new Date(rule.StartDate) : null;
    const end = text(rule.EndDate) ? new Date(rule.EndDate) : null;
    return (!start || now >= start) && (!end || now <= end);
  }

  function applies(rule, context) {
    if (!active(rule.Active) || !inDateWindow(rule)) return false;
    const dealerId = text(context.dealer?.dealerId);
    const locationId = text(context.dealer?.locationId);
    const brandId = text(context.brand?.brandId);
    if (text(rule.DealerID) && norm(rule.DealerID) !== norm(dealerId)) return false;
    if (text(rule.LocationID) && norm(rule.LocationID) !== norm(locationId)) return false;
    if (text(rule.BrandID) && norm(rule.BrandID) !== norm(brandId)) return false;
    const filters = [
      ['ProductID','productId'], ['SKU','sku'], ['Category','category']
    ];
    return filters.every(([ruleField,itemField]) => {
      if (!text(rule[ruleField])) return true;
      return (context.items || []).some(item => norm(item[itemField]) === norm(rule[ruleField]));
    });
  }

  function outcome(rule, status, actual, expected, fallback) {
    return {
      ruleId: text(rule.RuleID),
      type: text(rule.RuleType).toUpperCase(),
      status,
      actual,
      expected,
      message: text(rule.Message) || fallback
    };
  }

  function evaluateRule(rule, context) {
    const type = text(rule.RuleType).toUpperCase();
    const threshold = number(rule.Value);
    const totals = context.totals || {};
    const fullTotals = context.totals || {};
    const subtotal = number(totals.subtotal);
    const profit = fullTotals.grossProfit;
    const margin = fullTotals.grossMarginPercent;
    const discount = number(fullTotals.discountAmount);
    const severity = text(rule.Severity).toUpperCase();
    const failStatus = severity || 'WARNING';

    if (['MINIMUM_PROFIT_AMOUNT','APPROVAL_BELOW_PROFIT','MINIMUM_MARGIN_PERCENT'].includes(type) && profit === null) {
      return outcome(rule, 'SKIPPED', null, threshold, 'Skipped because dealer cost data is unavailable.');
    }
    if (type === 'MINIMUM_PROFIT_AMOUNT') return outcome(rule, profit >= threshold ? 'PASS' : failStatus, profit, threshold, `Gross profit must be at least $${threshold.toFixed(2)}.`);
    if (type === 'APPROVAL_BELOW_PROFIT') return outcome(rule, profit >= threshold ? 'PASS' : 'APPROVAL_REQUIRED', profit, threshold, `Manager approval required below $${threshold.toFixed(2)} profit.`);
    if (type === 'MINIMUM_MARGIN_PERCENT') return outcome(rule, margin >= threshold ? 'PASS' : failStatus, margin, threshold, `Gross margin must be at least ${threshold.toFixed(2)}%.`);
    if (type === 'MAXIMUM_DISCOUNT_AMOUNT') return outcome(rule, discount <= threshold ? 'PASS' : failStatus, discount, threshold, `Discount cannot exceed $${threshold.toFixed(2)}.`);
    if (type === 'MINIMUM_SELLING_PRICE') return outcome(rule, subtotal >= threshold ? 'PASS' : failStatus, subtotal, threshold, `Selling price must be at least $${threshold.toFixed(2)}.`);
    if (type === 'MAXIMUM_SELLING_PRICE') return outcome(rule, subtotal <= threshold ? 'PASS' : failStatus, subtotal, threshold, `Selling price cannot exceed $${threshold.toFixed(2)}.`);
    if (type === 'BLOCK_PRODUCT') return outcome(rule, 'BLOCKED', true, false, 'This product is blocked by dealer policy.');
    if (type === 'WARN_PRODUCT') return outcome(rule, 'WARNING', true, false, 'Dealer policy warning applies to this product.');
    return outcome(rule, 'SKIPPED', null, threshold, `Unsupported dealer rule type: ${type || '(blank)'}.`);
  }

  platform.registry.registerEngine('dealer-rules', {
    name: 'Universal Dealer Rules Engine',
    version: '1.0.0',
    configured: true,
    evaluate(context = {}) {
      const rules = (context.rules || []).filter(rule => applies(rule, context));
      if (!rules.length) return { status:'NOT_CONFIGURED', messages:['No applicable dealer rules configured.'], results:[], errors:[], warnings:[], adjustments:[] };
      const results = rules.sort((a,b) => number(a.Priority)-number(b.Priority)).map(rule => evaluateRule(rule, context));
      let status = 'PASS';
      results.forEach(result => { if ((statusRank[result.status] || 0) > (statusRank[status] || 0)) status = result.status; });
      const errors = results.filter(r => ['FAIL','BLOCKED'].includes(r.status));
      const warnings = results.filter(r => ['WARNING','APPROVAL_REQUIRED'].includes(r.status));
      return {
        status,
        messages: results.map(r => `${r.status} • ${r.ruleId || r.type} • ${r.message}`),
        results,
        errors,
        warnings,
        adjustments: []
      };
    }
  });
})(window);
