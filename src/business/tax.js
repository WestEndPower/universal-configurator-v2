'use strict';

(function registerTaxExtension(global) {
  const platform = global.UniversalCPQ;

  if (!platform) {
    return;
  }

  const clean = value =>
    String(value ?? '').trim();

  const number = value => {
    const parsed = Number(
      clean(value).replace(/[$,%\s,]/g, '')
    );

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  };

  const roundMoney = value =>
    Math.round(
      (number(value) + Number.EPSILON) * 100
    ) / 100;

  platform.registry.registerEngine('tax', {
    name: 'Universal Tax Engine',
    version: '1.0.0',
    configured: true,

    evaluate(context = {}) {
      const dealer = context.dealer || {};
      const taxConfiguration =
        context.taxConfiguration || {};

      const taxableSubtotal = Math.max(
        0,
        number(context.taxableSubtotal)
      );

      const taxExempt =
        context.taxExempt === true;

      const ratePercent =
        number(
          dealer.defaultTaxRate ??
          dealer.DefaultTaxRate ??
          taxConfiguration.defaultTaxRate ??
          taxConfiguration.taxRate ??
          taxConfiguration.rate
        );

      const rateDecimal =
        ratePercent > 1
          ? ratePercent / 100
          : ratePercent;

      const tax =
        taxExempt
          ? 0
          : roundMoney(
              taxableSubtotal * rateDecimal
            );

      return {
        status: taxExempt
          ? 'EXEMPT'
          : rateDecimal > 0
            ? 'APPLIED'
            : 'NOT_CONFIGURED',

        configured: rateDecimal > 0,

        taxableSubtotal:
          roundMoney(taxableSubtotal),

        ratePercent:
          roundMoney(rateDecimal * 100),

        rateDecimal,

        tax,

        adjustments:
          tax > 0
            ? [{
                type: 'TAX',
                label: 'Sales Tax',
                amount: tax
              }]
            : [],

        messages: [
          taxExempt
            ? 'Tax exemption applied.'
            : rateDecimal > 0
              ? `Sales tax calculated at ${roundMoney(rateDecimal * 100)}%.`
              : 'No sales-tax rate is configured.'
        ]
      };
    }
  });
})(window);