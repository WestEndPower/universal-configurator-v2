'use strict';

(function initializeUniversalCPQPlatform(global) {
  const existing = global.UniversalCPQ || {};

  global.UniversalCPQ = Object.assign(existing, {
    platformVersion: '3.0.0',
    architectureVersion: '3.0',
    core: existing.core || {},
    business: existing.business || {},
    ui: existing.ui || {},
    registry: existing.registry || {
      engines: {},
      registerEngine(name, engine) {
        if (!name || !engine) return;
        this.engines[name] = engine;
      },
      getEngine(name) {
        return this.engines[name] || null;
      }
    }
  });
})(window);
