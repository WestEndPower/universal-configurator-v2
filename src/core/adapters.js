'use strict';

(function exposeV3Adapters(global) {
  const platform = global.UniversalCPQ;
  if (!platform) return;

  platform.core.state = global.appState || null;
  platform.core.configuration = {
    calculate: typeof global.calculateConfiguration === 'function'
      ? global.calculateConfiguration
      : null
  };
  platform.core.rules = {
    run: typeof global.runRulesEngine === 'function'
      ? global.runRulesEngine
      : null
  };
  platform.core.diagnostics = {
    export: typeof global.exportDiagnostics === 'function'
      ? global.exportDiagnostics
      : null
  };
})(window);
