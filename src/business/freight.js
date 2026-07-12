
'use strict';

(function registerFreightEngine(global) {
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
  const integer = (value, fallback) => {
    const parsed = Math.trunc(number(value));
    return parsed > 0 ? parsed : fallback;
  };

  function matches(ruleValue, itemValue) {
    return !text(ruleValue) || norm(ruleValue) === norm(itemValue);
  }

  function applicable(rule, item, context) {
    if (!active(rule.Active)) return false;
    if (!matches(rule.BrandID, item.brandId || context.brand?.brandId)) return false;
    if (!matches(rule.ProductID, item.productId)) return false;
    if (!matches(rule.SKU, item.sku)) return false;
    if (!matches(rule.Category, item.category)) return false;
    if (!matches(rule.System, item.system)) return false;
    if (!matches(rule.FreightGroup, item.freightGroup)) return false;

    const minQty = integer(rule.MinQty, 1);
    const maxQty = integer(rule.MaxQty, Number.MAX_SAFE_INTEGER);
    if (item.quantity < minQty || item.quantity > maxQty) return false;

    const deliveryMethod = text(context.deliveryMethod);
    if (text(rule.DeliveryMethod) && norm(rule.DeliveryMethod) !== 'all' && norm(rule.DeliveryMethod) !== norm(deliveryMethod)) return false;

    if (text(rule.SpecialOrder)) {
      const required = truthy(rule.SpecialOrder);
      if (required !== Boolean(context.specialOrder)) return false;
    }
    return true;
  }

  function basisAmount(rule, item) {
    const basis = norm(rule.Basis || 'selling_price').replace(/[\s-]+/g, '_');
    if (['msrp','list_price','list'].includes(basis)) return number(item.listTotal);
    if (['dealer_cost','cost'].includes(basis)) return number(item.dealerCostTotal);
    if (['sale_price','selling_price','current_selling_price','current_price'].includes(basis)) return number(item.lineTotal);
    return number(item.lineTotal);
  }

  function calculate(rule, item) {
    const type = norm(rule.ChargeType || 'fixed').replace(/[\s-]+/g, '_');
    const basis = basisAmount(rule, item);
    const amount = number(rule.Amount);
    const percent = number(rule.Percent);
    const applyPer = norm(rule.ApplyPer || 'line').replace(/[\s-]+/g, '_');
    const multiplier = ['unit','per_unit'].includes(applyPer) ? item.quantity : 1;
    let charge = 0;

    if (['none','no_charge','zero'].includes(type)) charge = 0;
    else if (['fixed','flat'].includes(type)) charge = amount * multiplier;
    else if (['percent','percentage'].includes(type)) charge = basis * percent / 100;
    else if (['fixed_plus_percent','fixedpercent'].includes(type)) charge = amount * multiplier + basis * percent / 100;
    else return { supported:false, charge:0, basis, type, applyPer };

    const minimum = number(rule.MinimumCharge);
    const maximum = number(rule.MaximumCharge);
    if (minimum > 0) charge = Math.max(charge, minimum);
    if (maximum > 0) charge = Math.min(charge, maximum);
    return { supported:true, charge:Math.max(0, charge), basis, type, applyPer };
  }

  platform.registry.registerEngine('freight', {
    name: 'Universal Freight Engine',
    version: '1.0.0',
    configured: true,
    evaluate(context = {}) {
      const source = Array.isArray(context.freightRules) ? context.freightRules : [];
      const items = Array.isArray(context.items) ? context.items : [];
      if (!source.length) {
        return { status:'NOT_CONFIGURED', messages:['No freight data configured.'], evaluated:[], applied:[], rejected:[], adjustments:[], charge:0 };
      }

      const evaluated = [];
      const applied = [];
      const rejected = [];

      items.forEach(item => {
        const candidates = source
          .filter(rule => applicable(rule, item, context))
          .sort((a,b) => number(a.Priority) - number(b.Priority));

        if (!candidates.length) {
          evaluated.push({ productId:item.productId, sku:item.sku, status:'NO_MATCH' });
          return;
        }

        const rule = candidates[0];
        const ruleId = text(rule.RuleID) || text(rule.DisplayLabel) || '(unnamed)';
        const calculation = calculate(rule, item);
        if (!calculation.supported) {
          const result = { ruleId, productId:item.productId, sku:item.sku, status:'SKIPPED', reason:`Unsupported charge type: ${text(rule.ChargeType) || '(blank)'}.` };
          evaluated.push(result); rejected.push(result); return;
        }

        const result = {
          ruleId,
          productId:item.productId,
          sku:item.sku,
          status:'APPLIED',
          charge:calculation.charge,
          basis:calculation.basis,
          chargeType:text(rule.ChargeType),
          calculationBasis:text(rule.Basis) || 'SellingPrice',
          applyPer:text(rule.ApplyPer) || 'Line',
          displayLabel:text(rule.DisplayLabel) || 'Freight',
          notes:text(rule.Notes)
        };
        evaluated.push(result); applied.push(result);

        candidates.slice(1).forEach(other => {
          rejected.push({
            ruleId:text(other.RuleID) || '(unnamed)',
            productId:item.productId,
            sku:item.sku,
            status:'REJECTED',
            reason:`Higher-priority rule ${ruleId} was selected.`
          });
        });
      });

      const charge = applied.reduce((sum, row) => sum + number(row.charge), 0);
      return {
        status: applied.length ? 'APPLIED' : 'PASS',
        messages: applied.length
          ? applied.map(row => `APPLIED • ${row.ruleId} • $${row.charge.toFixed(2)}`)
          : ['No freight rules apply to this configuration.'],
        evaluated,
        applied,
        rejected,
        adjustments: applied.map(row => ({ type:'FREIGHT', ruleId:row.ruleId, amount:row.charge })),
        charge
      };
    }
  });
})(window);
