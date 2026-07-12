'use strict';

(function registerDealerrulesExtension(global) {
  const platform = global.UniversalCPQ;
  if (!platform) return;

  platform.registry.registerEngine('dealer-rules', {
    name: 'Dealer Rules',
    version: '0.1.0',
    configured: false,
    evaluate(context) {
      return {
        status: 'NOT_CONFIGURED',
        messages: ['No data-driven dealer rules rules configured.'],
        adjustments: [],
        context
      };
    }
  });
})(window);
