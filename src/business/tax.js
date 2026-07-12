'use strict';

(function registerTaxExtension(global) {
  const platform = global.UniversalCPQ;
  if (!platform) return;

  platform.registry.registerEngine('tax', {
    name: 'Tax',
    version: '0.1.0',
    configured: false,
    evaluate(context) {
      return {
        status: 'NOT_CONFIGURED',
        messages: ['No data-driven tax rules configured.'],
        adjustments: [],
        context
      };
    }
  });
})(window);
