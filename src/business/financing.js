'use strict';

(function registerFinancingExtension(global) {
  const platform = global.UniversalCPQ;
  if (!platform) return;

  platform.registry.registerEngine('financing', {
    name: 'Finance',
    version: '0.1.0',
    configured: false,
    evaluate(context) {
      return {
        status: 'NOT_CONFIGURED',
        messages: ['No data-driven finance rules configured.'],
        adjustments: [],
        context
      };
    }
  });
})(window);
