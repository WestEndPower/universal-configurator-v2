'use strict';

(function registerPromotionsEngine(global) {
  const platform = global.UniversalCPQ;
  if (!platform) return;

  const text = value => String(value ?? '').trim();
  const norm = value => text(value).toLowerCase();
  const number = value => {
    const parsed = Number(text(value).replace(/[$,%\s,]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const truthy = value => ['true','t','yes','y','1'].includes(norm(value));
  const active = value => !text(value) || truthy(value);

  function dateValue(value, endOfDay = false) {
    if (!text(value)) return null;
    const parsed = new Date(text(value));
    if (Number.isNaN(parsed.getTime())) return null;
    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(text(value))) {
      parsed.setHours(23, 59, 59, 999);
    }
    return parsed;
  }

  function inDateWindow(rule, now) {
    const start = dateValue(rule.StartDate);
    const end = dateValue(rule.EndDate, true);
    return (!start || now >= start) && (!end || now <= end);
  }

  function matchingItems(rule, context) {
    const fields = [
      ['ProductID', 'productId'],
      ['SKU', 'sku'],
      ['Category', 'category'],
      ['System', 'system']
    ];
    return (context.items || []).filter(item => fields.every(([ruleField, itemField]) => {
      return !text(rule[ruleField]) || norm(rule[ruleField]) === norm(item[itemField]);
    }));
  }

  function applies(rule, context, now) {
    if (!active(rule.Active) || !inDateWindow(rule, now)) return false;
    if (text(rule.BrandID) && norm(rule.BrandID) !== norm(context.brand?.brandId)) return false;
    return matchingItems(rule, context).length > 0;
  }

  function calculateAmount(rule, context, items) {
    const type = norm(rule.PromotionType).replace(/[\s-]+/g, '_');
    const value = number(rule.Value);
    const basis = norm(rule.DiscountBasis || 'matching_items');
    const base = basis === 'configuration_subtotal'
      ? number(context.totals?.subtotal)
      : items.reduce((sum, item) => sum + number(item.lineTotal), 0);
    let amount = 0;

    if (['dollar_rebate','fixed_discount','rebate'].includes(type)) amount = value;
    else if (['percent_discount','percentage_discount'].includes(type)) amount = base * value / 100;
    else if (type === 'fixed_price') amount = Math.max(0, base - value);
    else return { supported:false, amount:0, base, type };

    const maximum = number(rule.MaximumDiscount);
    if (maximum > 0) amount = Math.min(amount, maximum);
    amount = Math.max(0, Math.min(amount, number(context.totals?.subtotal)));
    return { supported:true, amount, base, type };
  }

  platform.registry.registerEngine('promotions', {
    name: 'Universal Promotion Engine',
    version: '1.0.0',
    configured: true,
    evaluate(context = {}) {
      const now = context.now instanceof Date ? context.now : new Date();
      const source = Array.isArray(context.promotions) ? context.promotions : [];
      const evaluated = [];
      const applicable = source
        .filter(rule => applies(rule, context, now))
        .sort((a, b) => number(a.Priority) - number(b.Priority));

      if (!source.length) {
        return { status:'NOT_CONFIGURED', messages:['No promotion data configured.'], evaluated:[], applied:[], rejected:[], adjustments:[], customerSavings:0, dealerFunding:0 };
      }
      if (!applicable.length) {
        return { status:'PASS', messages:['No active promotions apply to this configuration.'], evaluated:source.map(rule => ({ promotionId:text(rule.PromotionID), status:'NOT_APPLICABLE' })), applied:[], rejected:[], adjustments:[], customerSavings:0, dealerFunding:0 };
      }

      const applied = [];
      const rejected = [];
      let blockedByNonStackable = false;

      applicable.forEach(rule => {
        const promotionId = text(rule.PromotionID) || text(rule.PromotionName) || '(unnamed)';
        const financeRequired = truthy(rule.RequiresFinance);
        const matching = matchingItems(rule, context);
        let result;

        if (blockedByNonStackable) {
          result = { promotionId, status:'REJECTED', reason:'A higher-priority non-stackable promotion was applied.' };
          rejected.push(result); evaluated.push(result); return;
        }
        if (financeRequired && !context.financeSelected) {
          result = { promotionId, status:'REJECTED', reason:'Required financing is not selected.' };
          rejected.push(result); evaluated.push(result); return;
        }

        const calculation = calculateAmount(rule, context, matching);
        if (!calculation.supported) {
          result = { promotionId, status:'SKIPPED', reason:`Unsupported promotion type: ${text(rule.PromotionType) || '(blank)'}.` };
          rejected.push(result); evaluated.push(result); return;
        }
        if (calculation.amount <= 0) {
          result = { promotionId, status:'REJECTED', reason:'Calculated promotion amount is zero.' };
          rejected.push(result); evaluated.push(result); return;
        }

        const dealerFunding = norm(rule.DealerFundingType) === 'percent'
          ? calculation.amount * number(rule.DealerFundingValue) / 100
          : number(rule.DealerFundingValue);
        const promotionName =
  text(rule.PromotionName);

const customerText =
  text(rule.CustomerText);

const displayName =
  customerText ||
  promotionName ||
  'Factory Promotion';

result = {
  promotionId,

  name:
    promotionName ||
    'Factory Promotion',

  displayName,

  type:
    text(rule.PromotionType),

  status:
    'APPLIED',

  amount:
    calculation.amount,

  dealerFunding:
    Math.max(
      0,
      dealerFunding
    ),

  stackable:
    truthy(rule.Stackable),

  customerText,

  matchingProductIds:
    matching.map(
      item => item.productId
    )
};

        applied.push(result); evaluated.push(result);
        if (!result.stackable) blockedByNonStackable = true;
      });

      const customerSavings = applied.reduce((sum, item) => sum + number(item.amount), 0);
      const dealerFunding = applied.reduce((sum, item) => sum + number(item.dealerFunding), 0);
      return {
        status: applied.length ? 'APPLIED' : 'PASS',
        messages: applied.length
  ? applied.map(
      item =>
        `APPLIED • ${item.displayName || 'Factory Promotion'} • -$${item.amount.toFixed(2)}`
    )
  : [
      'No promotions were applied.'
    ],
    
        evaluated,
        applied,
        rejected,
        adjustments: applied.map(item => ({ type:'PROMOTION', promotionId:item.promotionId, amount:-item.amount })),
        customerSavings,
        dealerFunding
      };
    }
  });
})(window);
