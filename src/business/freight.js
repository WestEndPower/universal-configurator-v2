'use strict';

(function registerFreightExtension(global) {
  const platform = global.UniversalCPQ;
  if (!platform) return;

  platform.registry.registerEngine('freight', {
    name: 'Freight',
    version: '0.1.0',
    configured: false,
    evaluate(context) {
      return {
        status: 'NOT_CONFIGURED',
        messages: ['No data-driven freight rules configured.'],
        adjustments: [],
        context
      };
    }
  });
})(window);
