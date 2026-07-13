    'use strict';

    const APP_PATHS = Object.freeze({
      application: 'config/application.json',
      dealer: 'config/dealer.json',
      brand: 'config/brand.json',
      tax: 'config/tax.json'
    });

    const appState = {
      application: null,
      dealer: null,
      brand: null,
      tax: null,
      data: {
        products: [],
        components: [],
        compatibility: [],
        batteries: [],
        chargers: [],
        relationships: [],
        dealerRules: [],
        promotions: [],
        freightRules: [],
        financePrograms: [],
        locations: [],
        salespeople: []
      },
      filters: {
        keyword: '',
        category: '',
        powerType: '',
        system: '',
        series: ''
      },
      selection: {
        productId: '',
        quantity: 1,
        componentIds: [],
        componentQuantities: {}
      },
      cart: {},
      configuration: {
        schemaVersion: '1.0',
        applicationId: '',
        currency: 'USD',
        items: [],
        totals: {
          productSubtotal: 0,
          componentSubtotal: 0,
          subtotal: 0,
          total: 0
        }
      },
      startupErrors: [],
      quote: {
        customer: {},
        preparedBy: '',
        validThrough: '',
        terms: '',
        quoteNumber: '',
        locationId: ''
      },
      developer: {
        panelOpen: false,
        roundTestPrices: false,
        activeInspectorPane: 'configuration',
        performanceHistory: []
      }
    };

    function byId(id) {
      return document.getElementById(id);
    }

    function clean(value) {
      return String(value ?? '').trim();
    }

    function normalized(value) {
      return clean(value).toLowerCase();
    }

    function escapeHtml(value) {
      return clean(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function isTrue(value) {
      return ['true', 't', 'yes', 'y', '1'].includes(
        normalized(value)
      );
    }

    function money(value) {
      const number = Number(
        clean(value).replace(/[$,%\s,]/g, '')
      );

      return Number.isFinite(number) ? number : 0;
    }

    function positiveInteger(value, fallback = 1) {
      const number = Math.floor(Number(value));

      return Number.isFinite(number) && number > 0
        ? number
        : fallback;
    }

    function formatMoney(value) {
      const locale =
        clean(appState.application?.locale) || 'en-US';

      const currency =
        clean(appState.application?.currency) || 'USD';

      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency
      }).format(money(value));
    }

    function diagnosticUnitPrice(record, kind = '') {
      if (!appState.developer.roundTestPrices) {
        return null;
      }

      const normalizedKind = normalized(
        kind || record?.ComponentType || 'component'
      );

      if (normalizedKind === 'product') {
        return 1000;
      }

      if (normalizedKind === 'battery') {
        return 100;
      }

      if (normalizedKind === 'charger') {
        return 10;
      }

      return 1;
    }

    function componentUnitPrice(component) {
      const diagnosticPrice = diagnosticUnitPrice(
        component,
        component?.ComponentType
      );

      return diagnosticPrice === null
        ? money(component?.Price)
        : diagnosticPrice;
    }

    function productUnitPrice(product) {
      const diagnosticPrice = diagnosticUnitPrice(product, 'product');

      if (diagnosticPrice !== null) {
        return diagnosticPrice;
      }

      return money(product?.SalePrice) > 0
        ? money(product.SalePrice)
        : money(product?.MSRP);
    }

    function setStatus(type, message, statusClass) {
      const element = byId(`status-${type}`);

      if (!element) {
        return;
      }

      element.textContent = message;
      element.classList.remove(
        'loading',
        'success',
        'error'
      );

      element.classList.add(statusClass);
    }

    async function loadTextFile(path) {
      const response = await fetch(path, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(
          `${path} returned HTTP ${response.status}`
        );
      }

      return await response.text();
    }

    async function loadJsonFile(path) {
      const text = await loadTextFile(path);

      try {
        return JSON.parse(text);
      } catch (error) {
        throw new Error(
          `${path} contains invalid JSON`
        );
      }
    }

    function parseCsv(text) {
      const rows = [];
      let row = [];
      let field = '';
      let insideQuotes = false;

      const normalizedText =
        String(text ?? '').replace(/^\uFEFF/, '');

      for (let index = 0; index < normalizedText.length; index += 1) {
        const character = normalizedText[index];
        const nextCharacter = normalizedText[index + 1];

        if (insideQuotes) {
          if (
            character === '"' &&
            nextCharacter === '"'
          ) {
            field += '"';
            index += 1;
          } else if (character === '"') {
            insideQuotes = false;
          } else {
            field += character;
          }

          continue;
        }

        if (character === '"') {
          insideQuotes = true;
        } else if (character === ',') {
          row.push(field);
          field = '';
        } else if (character === '\n') {
          row.push(field);
          rows.push(row);
          row = [];
          field = '';
        } else if (character !== '\r') {
          field += character;
        }
      }

      if (field.length || row.length) {
        row.push(field);
        rows.push(row);
      }

      const nonEmptyRows = rows.filter(
        currentRow =>
          currentRow.some(
            cell => clean(cell) !== ''
          )
      );

      if (!nonEmptyRows.length) {
        return [];
      }

      const headers = nonEmptyRows[0].map(
        header => clean(header)
      );

      return nonEmptyRows.slice(1).map(
        values => {
          const record = {};

          headers.forEach((header, index) => {
            record[header] = values[index] ?? '';
          });

          return record;
        }
      );
    }

    async function loadCsvFile(path) {
      return parseCsv(
        await loadTextFile(path)
      );
    }

    async function loadDataFile(dataKey, path) {
      const records = await loadCsvFile(path);
      appState.data[dataKey] = records;
      return records;
    }

    function applyBrandTheme() {
      const brand = appState.brand || {};

      document.documentElement.style.setProperty(
        '--brand-primary',
        clean(brand.primaryColor) || '#333333'
      );

      document.documentElement.style.setProperty(
        '--brand-secondary',
        clean(brand.secondaryColor) || '#111111'
      );

      document.documentElement.style.setProperty(
        '--brand-accent',
        clean(brand.accentColor) || '#f4f4f4'
      );
    }

    function renderApplicationIdentity() {
      const application = appState.application || {};
      const dealer = effectiveDealer();
      const brand = appState.brand || {};

      const applicationName =
        clean(application.applicationName) ||
        'Universal Equipment Configurator';

      const applicationVersion =
        clean(application.applicationVersion) ||
        '2.0.0';

      const dealerName =
        clean(dealer.dealerName);

      const brandName =
        clean(brand.displayName) ||
        clean(brand.brandName);

      byId('app-title').textContent = applicationName;

      const subtitleParts = [];

      if (dealerName) {
        subtitleParts.push(dealerName);
      }

      if (brandName) {
        subtitleParts.push(brandName);
      }

      byId('app-subtitle').textContent =
        subtitleParts.length
          ? subtitleParts.join(' • ')
          : 'Brand-agnostic configuration template';

      byId('version-badge').textContent =
        `Version ${applicationVersion}`;
    }

    async function loadConfigurationFile(
      stateKey,
      statusKey,
      path
    ) {
      try {
        appState[stateKey] =
          await loadJsonFile(path);

        setStatus(
          statusKey,
          `Loaded: ${path}`,
          'success'
        );
      } catch (error) {
        appState[stateKey] = null;

        const message =
          error instanceof Error
            ? error.message
            : String(error);

        appState.startupErrors.push(message);

        setStatus(
          statusKey,
          message,
          'error'
        );
      }
    }

    function validateProducts(products) {
      const requiredColumns = [
        'ProductID',
        'BrandID',
        'SKU',
        'Model',
        'ProductName',
        'Category',
        'MSRP',
        'Active'
      ];

      if (!products.length) {
        return [
          'data/products.csv contains no product rows.'
        ];
      }

      const availableColumns =
        Object.keys(products[0]);

      const missingColumns =
        requiredColumns.filter(
          column =>
            !availableColumns.includes(column)
        );

      if (missingColumns.length) {
        return [
          `data/products.csv is missing required columns: ${missingColumns.join(', ')}`
        ];
      }

      return [];
    }


    function dealerSettingsEngine() {
      return window.UniversalCPQ?.registry?.getEngine('dealer-settings');
    }

    function effectiveDealer() {
      const engine = dealerSettingsEngine();
      return engine?.merge?.(appState.dealer || {}, engine.load?.()) || (appState.dealer || {});
    }

    function applyDealerOverrides() {
      appState.dealer = effectiveDealer();
      const dealer = appState.dealer || {};
      if (clean(dealer.primaryColor)) document.documentElement.style.setProperty('--brand-primary', clean(dealer.primaryColor));
      if (clean(dealer.secondaryColor)) document.documentElement.style.setProperty('--brand-secondary', clean(dealer.secondaryColor));
      if (clean(dealer.accentColor)) document.documentElement.style.setProperty('--brand-accent', clean(dealer.accentColor));
    }

    function defaultQuoteValidThrough() {
      const days = Math.max(0, Number(effectiveDealer().defaultQuoteValidDays || 14));
      const date = new Date();
      date.setDate(date.getDate() + days);
      return date.toISOString().slice(0,10);
    }

    function activeProducts() {
      return appState.data.products
        .filter(product => isTrue(product.Active))
        .sort(
          (first, second) =>
            money(first.SortOrder) -
            money(second.SortOrder)
        );
    }

    function selectedProduct() {
      return activeProducts().find(
        product =>
          clean(product.ProductID) ===
          clean(appState.selection.productId)
      ) || null;
    }

    function cartEntry(productId) {
      return appState.cart[clean(productId)] || null;
    }

    function configuredProductsCount() {
      return Object.keys(appState.cart).length;
    }

    function configuredUnitsCount() {
      return Object.values(appState.cart).reduce(
        (total, item) =>
          total + positiveInteger(item.quantity, 1),
        0
      );
    }

    function uniqueValues(products, fieldName) {
      return [
        ...new Set(
          products
            .map(product => clean(product[fieldName]))
            .filter(Boolean)
        )
      ].sort(
        (first, second) =>
          first.localeCompare(second)
      );
    }

    function populateSelect(
      selectId,
      values,
      defaultLabel
    ) {
      const select = byId(selectId);

      select.innerHTML = [
        `<option value="">${escapeHtml(defaultLabel)}</option>`,
        ...values.map(
          value => `
            <option value="${escapeHtml(value)}">
              ${escapeHtml(value)}
            </option>
          `
        )
      ].join('');
    }

    function populateProductFilters() {
      const products = activeProducts();

      populateSelect(
        'filter-category',
        uniqueValues(products, 'Category'),
        'All Categories'
      );

      populateSelect(
        'filter-power',
        uniqueValues(products, 'PowerType'),
        'All Power Types'
      );

      populateSelect(
        'filter-system',
        uniqueValues(products, 'System'),
        'All Systems'
      );

      populateSelect(
        'filter-series',
        uniqueValues(products, 'Series'),
        'All Series'
      );
    }

    function filteredProducts() {
      const {
        keyword,
        category,
        powerType,
        system,
        series
      } = appState.filters;

      return activeProducts().filter(product => {
        const searchableText = [
          product.ProductID,
          product.BrandID,
          product.SKU,
          product.Model,
          product.ProductName,
          product.Category,
          product.SubCategory,
          product.Series,
          product.PowerType,
          product.System,
          product.ShortDescription
        ].map(normalized).join(' ');

        return (
          (!keyword || searchableText.includes(normalized(keyword))) &&
          (!category || clean(product.Category) === category) &&
          (!powerType || clean(product.PowerType) === powerType) &&
          (!system || clean(product.System) === system) &&
          (!series || clean(product.Series) === series)
        );
      });
    }

    function selectedComponentsForCartItem(item) {
      if (!Array.isArray(item?.componentIds)) {
        return [];
      }

      return item.componentIds.map(componentId => {
        const component = componentById(componentId);

        if (!component) {
          return null;
        }

        const quantityPerProduct = positiveInteger(
          item.componentQuantities?.[clean(componentId)],
          1
        );

        const productQuantity = positiveInteger(
          item.quantity,
          1
        );

        const unitPrice = componentUnitPrice(component);
        const totalQuantity =
          quantityPerProduct * productQuantity;

        return {
          componentId: clean(component.ComponentID),
          sku: clean(component.SKU),
          name:
            clean(component.ComponentName) ||
            clean(component.SKU) ||
            clean(component.ComponentID),
          type: clean(component.ComponentType) || 'Component',
          system: clean(component.System),
          quantityPerProduct,
          quantity: totalQuantity,
          unitPrice,
          lineTotal: unitPrice * totalQuantity
        };
      }).filter(Boolean);
    }

    function priceLine({ type, id, name, sku, quantity, unitPrice }) {
      const normalizedQuantity = positiveInteger(quantity, 1);
      const normalizedUnitPrice = money(unitPrice);

      return {
        type,
        id: clean(id),
        name: clean(name),
        sku: clean(sku),
        quantity: normalizedQuantity,
        unitPrice: normalizedUnitPrice,
        lineTotal: normalizedUnitPrice * normalizedQuantity
      };
    }

    function activeRelationshipsForProduct(productId) {
      return appState.data.relationships.filter(row =>
        normalized(row.ParentProductID) === normalized(productId) &&
        !['false', 'f', '0', 'no', 'n'].includes(normalized(row.Active))
      );
    }

    function runUniversalRules(items, calculatedTotals = {}, promotionEvaluation = null, freightEvaluation = null, financeEvaluation = null) {
      const engineStarted = performance.now();
      const result = {
        engineVersion: '1.1',
        passed: true,
        errors: [],
        warnings: [],
        adjustments: [],
        stages: [],
        performance: { stages: [], totalMs: 0 }
      };

      const timeStage = (stage, callback) => {
        const started = performance.now();
        const stageResult = callback();
        const durationMs = performance.now() - started;
        stageResult.durationMs = durationMs;
        result.stages.push(stageResult);
        result.performance.stages.push({
          stage,
          durationMs
        });
        return stageResult;
      };

      timeStage('Validation', () => {
        const validationStage = {
          stage: 'Validation',
          status: 'PASS',
          messages: []
        };

        items.forEach(item => {
          const relationships = activeRelationshipsForProduct(item.productId);
          relationships.forEach(rule => {
            const relationshipType = normalized(rule.RelationshipType);
            if (relationshipType !== 'requires' && relationshipType !== 'included') return;

            const componentId = clean(rule.ChildComponentID);
            const component = item.components.find(line =>
              normalized(line.componentId) === normalized(componentId)
            );
            const minimumPerProduct = positiveInteger(rule.MinQty, 1);
            const requiredTotal = minimumPerProduct * item.quantity;
            const actualTotal = component ? component.quantity : 0;

            if (actualTotal < requiredTotal) {
              const message = `${item.name}: ${componentId} requires quantity ${requiredTotal}; configured ${actualTotal}.`;
              result.errors.push({ code: 'REQUIRED_COMPONENT_QUANTITY', productId: item.productId, componentId, message });
              validationStage.messages.push(`FAIL • ${message}`);
            } else {
              validationStage.messages.push(`PASS • ${item.name}: ${componentId} quantity ${actualTotal}/${requiredTotal}.`);
            }
          });
        });

        if (result.errors.length) {
          validationStage.status = 'FAIL';
          result.passed = false;
        } else if (!validationStage.messages.length) {
          validationStage.messages.push('PASS • No required-component violations.');
        }

        return validationStage;
      });

      [
        ['Compatibility', 'Relationship-driven compatibility already applied.'],
        ['Pricing', 'Shared Universal Pricing Engine completed.']
      ].forEach(([stage, message]) => {
        timeStage(stage, () => ({ stage, status: 'PASS', messages: [message] }));
      });

      timeStage('Promotions', () => {
        const evaluation = promotionEvaluation || {
          status: 'NOT_CONFIGURED',
          messages: ['Promotion Engine is unavailable.'],
          applied: [], rejected: [], adjustments: [], customerSavings: 0, dealerFunding: 0
        };
        result.adjustments.push(...(evaluation.adjustments || []));
        result.warnings.push(...(evaluation.warnings || []));
        result.errors.push(...(evaluation.errors || []));
        return {
          stage: 'Promotions',
          status: evaluation.status || 'PASS',
          messages: evaluation.messages || [],
          details: evaluation
        };
      });

      timeStage('Freight', () => {
        const evaluation = freightEvaluation || {
          status: 'NOT_CONFIGURED',
          messages: ['Freight Engine is unavailable.'],
          evaluated: [], applied: [], rejected: [], adjustments: [], charge: 0
        };
        result.adjustments.push(...(evaluation.adjustments || []));
        result.warnings.push(...(evaluation.warnings || []));
        result.errors.push(...(evaluation.errors || []));
        return {
          stage: 'Freight',
          status: evaluation.status || 'PASS',
          messages: evaluation.messages || [],
          details: evaluation
        };
      });

      timeStage('Dealer Rules', () => {
        const engine = window.UniversalCPQ?.registry?.getEngine('dealer-rules');
        if (!engine || typeof engine.evaluate !== 'function') {
          return { stage: 'Dealer Rules', status: 'NOT_CONFIGURED', messages: ['Dealer Rules Engine is unavailable.'] };
        }
        const evaluation = engine.evaluate({
          rules: appState.data.dealerRules,
          items,
          totals: {
            productSubtotal: items.reduce((sum, item) => sum + item.productTotal, 0),
            componentSubtotal: items.reduce((sum, item) => sum + item.componentTotal, 0),
            subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
            ...calculatedTotals
          },
          dealer: appState.dealer,
          brand: appState.brand,
          application: appState.application
        });
        result.errors.push(...(evaluation.errors || []));
        result.warnings.push(...(evaluation.warnings || []));
        result.adjustments.push(...(evaluation.adjustments || []));
        if (['FAIL', 'BLOCKED'].includes(evaluation.status)) result.passed = false;
        return {
          stage: 'Dealer Rules',
          status: evaluation.status || 'PASS',
          messages: evaluation.messages || [],
          details: evaluation
        };
      });

      timeStage('Finance', () => {
        const evaluation = financeEvaluation || {
          status: 'NOT_CONFIGURED',
          messages: ['Finance Engine is unavailable.'],
          eligible: [], rejected: [], selected: null, adjustments: []
        };
        result.adjustments.push(...(evaluation.adjustments || []));
        result.warnings.push(...(evaluation.warnings || []));
        result.errors.push(...(evaluation.errors || []));
        return {
          stage: 'Finance',
          status: evaluation.status || 'PASS',
          messages: evaluation.messages || [],
          details: evaluation
        };
      });

      result.performance.totalMs = performance.now() - engineStarted;
      result.statistics = {
        rulesExecuted: result.stages.length,
        rulesPassed: result.stages.filter(stage => ['PASS','APPLIED','AVAILABLE'].includes(stage.status)).length,
        rulesNotConfigured: result.stages.filter(stage => stage.status === 'NOT_CONFIGURED').length,
        rulesSkipped: result.stages.filter(stage => stage.status === 'SKIPPED').length,
        rulesFailed: result.stages.filter(stage => ['FAIL','BLOCKED'].includes(stage.status)).length,
        warnings: result.warnings.length,
        errors: result.errors.length
      };

      return result;
    }

    function calculateConfiguration() {
      const calculationStarted = performance.now();
      const buildStarted = performance.now();
      const items = Object.values(appState.cart).map(item => {
        const product = productById(item.productId);

        if (!product) {
          return null;
        }

        const quantity = positiveInteger(item.quantity, 1);
        const productLine = priceLine({
          type: 'Product',
          id: product.ProductID,
          name: product.ProductName,
          sku: product.SKU,
          quantity,
          unitPrice: money(item.unitPrice) || productUnitPrice(product)
        });
        const components = selectedComponentsForCartItem(item).map(component => ({
          ...component,
          lineTotal: priceLine({
            type: component.type,
            id: component.componentId,
            name: component.name,
            sku: component.sku,
            quantity: component.quantity,
            unitPrice: component.unitPrice
          }).lineTotal
        }));
        const componentTotal = components.reduce(
          (total, component) => total + component.lineTotal,
          0
        );

        return {
          productId: clean(product.ProductID),
          sku: clean(product.SKU),
          model: clean(product.Model),
          name: clean(product.ProductName),
          category: clean(product.Category),
          system: clean(product.System),
          freightGroup: clean(product.FreightGroup || product.DeliveryGroup || product.Category),
          financingGroup: clean(product.FinancingGroup),
          brandId: clean(product.BrandID || appState.brand?.brandId),
          quantity,
          unitPrice: productLine.unitPrice,
          productTotal: productLine.lineTotal,
          components,
          componentTotal,
          lineTotal: productLine.lineTotal + componentTotal,
          listTotal: (money(product.MSRP) || productLine.unitPrice) * quantity + components.reduce((sum, component) => sum + ((money(component.msrp) || component.unitPrice) * component.quantity), 0),
          dealerCostTotal: money(product.DealerCost) * quantity + components.reduce((sum, component) => sum + money(component.dealerCost) * component.quantity, 0)
        };
      }).filter(Boolean);

      const configurationBuildMs = performance.now() - buildStarted;
      const pricingStarted = performance.now();

      const productSubtotal = items.reduce(
        (total, item) => total + item.productTotal,
        0
      );

      const componentSubtotal = items.reduce(
        (total, item) => total + item.componentTotal,
        0
      );

      const subtotal = productSubtotal + componentSubtotal;
      const listSubtotal = items.reduce((total, item) => total + money(item.listTotal), 0);
      const dealerCostSubtotal = items.reduce((total, item) => total + money(item.dealerCostTotal), 0);
      const discountAmount = Math.max(0, listSubtotal - subtotal);
      const grossProfit = dealerCostSubtotal > 0 ? subtotal - dealerCostSubtotal : null;
      const grossMarginPercent = grossProfit === null || subtotal <= 0 ? null : (grossProfit / subtotal) * 100;
      const trace = [];

      items.forEach(item => {
        trace.push({
          type: 'Product',
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.productTotal
        });

        item.components.forEach(component => {
          trace.push({
            type: component.type || 'Component',
            name: component.name,
            sku: component.sku,
            quantity: component.quantity,
            unitPrice: component.unitPrice,
            amount: component.lineTotal
          });
        });
      });

      const promotionEngine = window.UniversalCPQ?.registry?.getEngine('promotions');
      const promotionEvaluation = promotionEngine && typeof promotionEngine.evaluate === 'function'
        ? promotionEngine.evaluate({
            promotions: appState.data.promotions,
            items,
            totals: { productSubtotal, componentSubtotal, subtotal },
            brand: appState.brand,
            dealer: appState.dealer,
            application: appState.application,
            financeSelected: false
          })
        : { status:'NOT_CONFIGURED', messages:['Promotion Engine is unavailable.'], applied:[], rejected:[], adjustments:[], customerSavings:0, dealerFunding:0 };
      const promotionSavings = Math.min(subtotal, money(promotionEvaluation.customerSavings));
      const adjustedSubtotal = Math.max(0, subtotal - promotionSavings);
      const adjustedGrossProfit = dealerCostSubtotal > 0 ? adjustedSubtotal - dealerCostSubtotal + money(promotionEvaluation.dealerFunding) : null;
      const adjustedGrossMarginPercent = adjustedGrossProfit === null || adjustedSubtotal <= 0 ? null : (adjustedGrossProfit / adjustedSubtotal) * 100;

      const freightEngine = window.UniversalCPQ?.registry?.getEngine('freight');
      const freightEvaluation = freightEngine && typeof freightEngine.evaluate === 'function'
        ? freightEngine.evaluate({
            freightRules: appState.data.freightRules,
            items,
            totals: { productSubtotal, componentSubtotal, subtotal: adjustedSubtotal },
            brand: appState.brand,
            dealer: appState.dealer,
            application: appState.application,
            deliveryMethod: clean(appState.deliveryMethod),
            specialOrder: Boolean(appState.specialOrder)
          })
        : { status:'NOT_CONFIGURED', messages:['Freight Engine is unavailable.'], evaluated:[], applied:[], rejected:[], adjustments:[], charge:0 };
      const freightCharge = Math.max(0, money(freightEvaluation.charge));
      const totalAfterFreight = adjustedSubtotal + freightCharge;

      const financeEngine = window.UniversalCPQ?.registry?.getEngine('financing');
      const selectedFinanceProgramId = clean(appState.financeSelection?.programId || appState.application?.defaultFinanceProgramID);
      const financeEvaluation = financeEngine && typeof financeEngine.evaluate === 'function'
        ? financeEngine.evaluate({
            financePrograms: appState.data.financePrograms,
            items,
            totals: { productSubtotal, componentSubtotal, subtotal: adjustedSubtotal, freight: freightCharge, total: totalAfterFreight },
            amountFinanced: totalAfterFreight,
            selectedProgramId: selectedFinanceProgramId,
            promotionApplied: Boolean(promotionEvaluation.applied?.length),
            brand: appState.brand,
            dealer: appState.dealer,
            application: appState.application
          })
        : { status:'NOT_CONFIGURED', messages:['Finance Engine is unavailable.'], eligible:[], rejected:[], selected:null, adjustments:[], dealerFee:0, applicationFee:0 };

      const pricingMs = performance.now() - pricingStarted;
      const rules = runUniversalRules(items, {
        listSubtotal,
        dealerCostSubtotal,
        discountAmount: discountAmount + promotionSavings,
        grossProfit: adjustedGrossProfit,
        grossMarginPercent: adjustedGrossMarginPercent,
        subtotal: totalAfterFreight,
        preFreightSubtotal: adjustedSubtotal,
        freight: freightCharge
      }, promotionEvaluation, freightEvaluation, financeEvaluation);

      appState.configuration = {
        schemaVersion: '1.3',
        applicationId:
          clean(appState.application?.applicationName),
        applicationVersion:
          clean(appState.application?.applicationVersion),
        brandId: clean(appState.brand?.brandId),
        dealerId: clean(appState.dealer?.dealerId),
        currency:
          clean(appState.application?.currency) || 'USD',
        items,
        pricing: {
          trace
        },
        promotions: promotionEvaluation,
        freight: freightEvaluation,
        finance: financeEvaluation,
        rules,
        totals: {
          productSubtotal,
          componentSubtotal,
          subtotal: adjustedSubtotal,
          prePromotionSubtotal: subtotal,
          freight: freightCharge,
          promotions: promotionSavings,
          dealerPromotionFunding: money(promotionEvaluation.dealerFunding),
          financeDealerFee: money(financeEvaluation.dealerFee),
          financeApplicationFee: money(financeEvaluation.applicationFee),
          tax: 0,
          total: totalAfterFreight,
          listSubtotal,
          dealerCostSubtotal,
          discountAmount: discountAmount + promotionSavings,
          grossProfit: adjustedGrossProfit,
          grossMarginPercent: adjustedGrossMarginPercent
        },
        performance: {
          configurationBuildMs,
          pricingMs,
          rulesMs: rules.performance.totalMs,
          totalMs: performance.now() - calculationStarted
        }
      };

      appState.developer.performanceHistory.push({
        timestamp: new Date().toISOString(),
        totalMs: appState.configuration.performance.totalMs,
        rulesMs: appState.configuration.performance.rulesMs
      });
      appState.developer.performanceHistory =
        appState.developer.performanceHistory.slice(-10);

      if (byId('developer-panel')) {
        renderDeveloperDiagnostics();
      }

      return appState.configuration;
    }

    function configurationSubtotal() {
      return calculateConfiguration().totals.subtotal;
    }

    function productById(productId) {
      return activeProducts().find(
        product =>
          clean(product.ProductID) === clean(productId)
      ) || null;
    }

    function componentById(componentId) {
      return allComponents().find(
        component =>
          clean(component.ComponentID) === clean(componentId)
      ) || null;
    }

    function groupedComponentsForCartItem(item) {
      const sourceComponents = Array.isArray(item?.components)
        ? item.components
        : selectedComponentsForCartItem(item);

      if (!sourceComponents.length) {
        return [];
      }

      const groups = new Map();

      sourceComponents.forEach(component => {
        const type = clean(component.type) || 'Component';
        const itemKey = [
          clean(component.componentId),
          clean(component.sku),
          clean(component.name)
        ].join('|');

        if (!groups.has(type)) {
          groups.set(type, new Map());
        }

        const typeItems = groups.get(type);
        const existing = typeItems.get(itemKey);

        if (existing) {
          existing.quantity += positiveInteger(component.quantity, 1);
          return;
        }

        typeItems.set(itemKey, {
          name: clean(component.name),
          sku: clean(component.sku),
          quantity: positiveInteger(component.quantity, 1),
          sortOrder: money(component.sortOrder)
        });
      });

      return Array.from(groups.entries())
        .map(([type, items]) => ({
          type,
          items: Array.from(items.values()).sort(
            (first, second) =>
              first.sortOrder - second.sortOrder ||
              first.name.localeCompare(second.name)
          )
        }))
        .sort((first, second) =>
          first.type.localeCompare(second.type)
        );
    }

    function renderCartItemComponentGroups(item) {
      const groups = groupedComponentsForCartItem(item);

      if (!groups.length) {
        return '';
      }

      return `
        <div class="configuration-component-groups">
          ${groups.map(group => `
            <div class="configuration-component-group">
              <span class="configuration-component-type">
                ${escapeHtml(group.type)}
              </span>
              <span class="configuration-component-items">
                ${group.items.map(component => {
                  const sku = component.sku
                    ? ` • ${escapeHtml(component.sku)}`
                    : '';

                  return `${escapeHtml(component.name)}${sku} ×${component.quantity}`;
                }).join(', ')}
              </span>
            </div>
          `).join('')}
        </div>
      `;
    }

    function renderCurrentConfiguration() {
      const configuration = calculateConfiguration();
      const entries = configuration.items;
      const card = byId('current-configuration-card');

      if (!entries.length) {
        card.hidden = true;
        byId('configuration-lines').innerHTML = '';
        return;
      }

      byId('configuration-product-count').textContent =
        String(configuredProductsCount());

      byId('configuration-unit-count').textContent =
        String(configuredUnitsCount());

      byId('configuration-subtotal').textContent =
        formatMoney(configuration.totals.subtotal);

      byId('configuration-total').textContent =
        formatMoney(configuration.totals.total);

      byId('configuration-lines').innerHTML =
        entries.map(item => {
          return `
            <article class="configuration-line">
              <div class="configuration-line-qty">
                Qty ${positiveInteger(item.quantity, 1)}
              </div>

              <div>
                <div class="configuration-line-name">
                  ${escapeHtml(item.name)}
                </div>

                <div class="configuration-line-meta">
                  ${[
                    item.model,
                    item.sku,
                    item.category
                  ].map(clean).filter(Boolean).map(escapeHtml).join(' • ')}
                </div>

                ${renderCartItemComponentGroups(item)}
              </div>

              <div class="configuration-line-total">
                ${formatMoney(item.lineTotal)}
              </div>

              <div class="configuration-line-actions">
                <button
                  class="button edit-configuration-line"
                  type="button"
                  data-product-id="${escapeHtml(item.productId)}"
                >
                  Edit
                </button>

                <button
                  class="button danger remove-configuration-line"
                  type="button"
                  data-product-id="${escapeHtml(item.productId)}"
                >
                  Remove
                </button>
              </div>
            </article>
          `;
        }).join('');

      card.hidden = false;
    }

    function renderProducts() {
      const allProducts =
        appState.data.products;

      const active =
        activeProducts();

      const products =
        filteredProducts();

      byId('products-loaded-count').textContent =
        String(allProducts.length);

      byId('products-active-count').textContent =
        String(active.length);

      byId('configured-products-count').textContent =
        String(configuredProductsCount());

      byId('configured-units-count').textContent =
        String(configuredUnitsCount());

      byId('result-count').textContent =
        `${products.length} product${products.length === 1 ? '' : 's'}`;

      byId('product-list').innerHTML =
        products.length
          ? products.map(product => {
              const saved = cartEntry(product.ProductID);

              return `
                <article class="product-row ${saved ? 'configured' : ''}">
                  <div>
                    <h3 class="product-name">
                      ${escapeHtml(product.ProductName)}
                    </h3>

                    <div class="product-meta">
                      ${[
                        product.BrandID,
                        product.Model,
                        product.SKU,
                        product.Category,
                        product.PowerType,
                        product.System,
                        product.Series
                      ].map(clean).filter(Boolean).map(escapeHtml).join(' • ')}
                    </div>

                    ${
                      clean(product.ShortDescription)
                        ? `
                          <div class="product-description">
                            ${escapeHtml(product.ShortDescription)}
                          </div>
                        `
                        : ''
                    }

                    ${
                      saved
                        ? `
                          <div class="configured-note">
                            Configured • Qty ${positiveInteger(saved.quantity, 1)} • ${formatMoney(saved.total)}
                          </div>
                          ${renderCartItemComponentGroups(saved)}
                        `
                        : ''
                    }
                  </div>

                  <div class="product-price">
                    ${formatMoney(productUnitPrice(product))}

                    ${
                      money(product.SalePrice) > 0
                        ? `<small>MSRP ${formatMoney(product.MSRP)}</small>`
                        : ''
                    }

                    <button
                      class="button ${saved ? 'success' : 'primary'} select-product"
                      type="button"
                      data-product-id="${escapeHtml(product.ProductID)}"
                      style="margin-top:10px;"
                    >
                      ${saved ? 'Edit Configuration' : 'Configure'}
                    </button>
                  </div>
                </article>
              `;
            }).join('')
          : `
              <div class="empty-state">
                No products match the selected filters.
              </div>
            `;

      byId('product-search-card').hidden = false;
      renderCurrentConfiguration();
    }

    function compatibilityRulesForProduct(product) {
      if (!product) {
        return [];
      }

      const productId = clean(product.ProductID);
      const productSKU = clean(product.SKU);
      const category = clean(product.Category);
      const system = clean(product.System);
      const series = clean(product.Series);

      return appState.data.compatibility
        .filter(rule => isTrue(rule.Active))
        .filter(rule => {
          const ruleProductId = clean(rule.ProductID);
          const ruleProductSKU = clean(rule.ProductSKU);
          const ruleCategory = clean(rule.ProductCategory);
          const ruleSystem = clean(rule.ProductSystem);
          const ruleSeries = clean(rule.ProductSeries);

          const hasAnyRule =
            ruleProductId ||
            ruleProductSKU ||
            ruleCategory ||
            ruleSystem ||
            ruleSeries;

          if (!hasAnyRule) {
            return false;
          }

          return (
            (!ruleProductId || ruleProductId === productId) &&
            (!ruleProductSKU || ruleProductSKU === productSKU) &&
            (!ruleCategory || ruleCategory === category) &&
            (!ruleSystem || ruleSystem === system) &&
            (!ruleSeries || ruleSeries === series)
          );
        });
    }

    function componentCompatibilityResult(product, component) {
      const rules =
        compatibilityRulesForProduct(product);

      const componentId =
        clean(component.ComponentID);

      const componentSKU =
        clean(component.SKU);

      const componentType =
        clean(component.ComponentType);

      const matchingRules =
        rules.filter(rule => (
          (!clean(rule.ComponentID) ||
            clean(rule.ComponentID) === componentId) &&
          (!clean(rule.ComponentSKU) ||
            clean(rule.ComponentSKU) === componentSKU) &&
          (!clean(rule.ComponentType) ||
            clean(rule.ComponentType) === componentType)
        ));

      if (matchingRules.length) {
        const explicitExclusion =
          matchingRules.find(
            rule => clean(rule.Compatible).toUpperCase() === 'F'
          );

        if (explicitExclusion) {
          return {
            compatible: false,
            reason:
              clean(explicitExclusion.Note) ||
              'Excluded by compatibility rule.'
          };
        }

        const explicitInclusion =
          matchingRules.find(
            rule => clean(rule.Compatible).toUpperCase() === 'T'
          );

        if (explicitInclusion) {
          return {
            compatible: true,
            reason:
              clean(explicitInclusion.Note) ||
              'Matched by compatibility rule.'
          };
        }
      }

      const appliesToProductId =
        clean(component.AppliesToProductID);

      const appliesToSKU =
        clean(component.AppliesToSKU);

      const appliesToCategory =
        clean(component.AppliesToCategory);

      const productId =
        clean(product.ProductID);

      const productSKU =
        clean(product.SKU);

      const productCategory =
        clean(product.Category);

      const productSystem =
        clean(product.System);

      const componentSystem =
        clean(component.System);

      const hasApplicability = Boolean(
        appliesToProductId ||
        appliesToSKU ||
        appliesToCategory
      );

      const applicabilityMatch = (
        (!hasApplicability) ||
        (appliesToProductId &&
          appliesToProductId === productId) ||
        (appliesToSKU &&
          appliesToSKU === productSKU) ||
        (appliesToCategory &&
          appliesToCategory === productCategory)
      );

      const systemMatch = (
        !productSystem ||
        !componentSystem ||
        productSystem === componentSystem
      );

      const compatible =
        applicabilityMatch && systemMatch;

      return {
        compatible,
        reason:
          !applicabilityMatch
            ? 'No compatible applicability rule found.'
            : !systemMatch
              ? 'Component system does not match the selected product.'
              : productSystem && componentSystem
                ? 'Matched by product system.'
                : 'Matched by component applicability.'
      };
    }

    function normalizedExternalComponent(
      row,
      componentType
    ) {
      return {
        ComponentID:
          clean(row.ComponentID) ||
          clean(row.BatteryID) ||
          clean(row.ChargerID),

        BrandID:
          clean(row.BrandID),

        ComponentType:
          componentType,

        SKU:
          clean(row.SKU),

        ComponentName:
          clean(row.ComponentName) ||
          clean(row.BatteryName) ||
          clean(row.ChargerName),

        Description:
          clean(row.Description),

        Price:
          clean(row.Price),

        DealerCost:
          clean(row.DealerCost),

        AppliesToProductID:
          clean(row.AppliesToProductID),

        AppliesToSKU:
          clean(row.AppliesToSKU),

        AppliesToCategory:
          clean(row.AppliesToCategory),

        Taxable:
          clean(row.Taxable),

        FinancingEligible:
          clean(row.FinancingEligible),

        SpecialFinancingEligible:
          clean(row.SpecialFinancingEligible),

        RebateEligible:
          clean(row.RebateEligible),

        DiscountEligible:
          clean(row.DiscountEligible),

        FleetEligible:
          clean(row.FleetEligible),

        BidEligible:
          clean(row.BidEligible),

        FreightEligible:
          clean(row.FreightEligible),

        FreightGroup:
          clean(row.FreightGroup),

        Required:
          clean(row.Required),

        Active:
          clean(row.Active),

        SortOrder:
          clean(row.SortOrder),

        System:
          clean(row.System),

        Ah:
          clean(row.Ah),

        Wh:
          clean(row.Wh),

        Output:
          clean(row.Output),

        _sourceType:
          componentType
      };
    }

    function allComponents() {
      return [
        ...appState.data.components,
        ...appState.data.batteries.map(
          row => normalizedExternalComponent(
            row,
            'Battery'
          )
        ),
        ...appState.data.chargers.map(
          row => normalizedExternalComponent(
            row,
            'Charger'
          )
        )
      ];
    }

    function relationshipRowsForParent(parentId) {
      const id = clean(parentId);

      return appState.data.relationships
        .filter(row => isTrue(row.Active))
        .filter(row => clean(row.ParentID) === id)
        .sort(
          (first, second) =>
            money(first.SortOrder) - money(second.SortOrder)
        );
    }

    function relationshipForProductComponent(
      product,
      component
    ) {
      if (!product || !component) {
        return null;
      }

      const productId =
        clean(product.ProductID);

      const componentId =
        clean(component.ComponentID);

      return relationshipRowsForParent(productId).find(
        row => clean(row.ChildID) === componentId
      ) || null;
    }

    function relationshipLabel(row) {
      const type =
        clean(row?.RelationshipType);

      if (!type) {
        return '';
      }

      const qtyMin =
        positiveInteger(row.MinQty, 1);

      const qtyMax =
        clean(row.MaxQty);

      const quantityText =
        qtyMax
          ? `Qty ${qtyMin}-${qtyMax}`
          : `Qty ${qtyMin}+`;

      return `${type} • ${quantityText}`;
    }

    function componentsForProduct(product) {
      if (!product) {
        return [];
      }

      const relationships =
        relationshipRowsForParent(product.ProductID);

      const allowedComponentIds =
        new Set(
          relationships
            .map(row => clean(row.ChildID))
            .filter(Boolean)
        );

      // A product with relationship rows uses those rows as the
      // authoritative allowed-component list. This prevents an
      // unrelated catalog component from being rendered merely
      // because a broad compatibility fallback matched it.
      if (allowedComponentIds.size) {
        return allComponents()
          .filter(component => isTrue(component.Active))
          .filter(component =>
            allowedComponentIds.has(
              clean(component.ComponentID)
            )
          )
          .map(component => ({
            ...component,
            _compatibility: {
              compatible: true,
              reason: 'Allowed by product relationship.'
            },
            _relationship:
              relationshipForProductComponent(
                product,
                component
              )
          }))
          .sort((first, second) => {
            const firstRelationshipOrder = money(
              first._relationship?.SortOrder
            );
            const secondRelationshipOrder = money(
              second._relationship?.SortOrder
            );

            return (
              firstRelationshipOrder -
              secondRelationshipOrder
            );
          });
      }

      // Products without relationship rows retain the universal,
      // data-driven compatibility fallback for legacy catalogs.
      return allComponents()
        .filter(component => isTrue(component.Active))
        .map(component => ({
          ...component,
          _compatibility:
            componentCompatibilityResult(product, component),
          _relationship: null
        }))
        .filter(component =>
          component._compatibility.compatible
        )
        .sort(
          (first, second) =>
            money(first.SortOrder) - money(second.SortOrder)
        );
    }

    function selectedComponentRecords() {
      const ids = new Set(
        appState.selection.componentIds.map(clean)
      );

      return allComponents().filter(
        component => ids.has(clean(component.ComponentID))
      );
    }

    function componentSelectedQuantity(componentId) {
      const component =
        allComponents().find(
          row =>
            clean(row.ComponentID) === clean(componentId)
        );

      const relationship =
        relationshipForProductComponent(
          selectedProduct(),
          component
        );

      const fallback =
        relationship
          ? positiveInteger(relationship.MinQty, 1)
          : 1;

      return positiveInteger(
        appState.selection.componentQuantities[
          clean(componentId)
        ],
        fallback
      );
    }

    function componentsUnitTotal() {
      return selectedComponentRecords().reduce(
        (total, component) =>
          total +
          (
            componentUnitPrice(component) *
            componentSelectedQuantity(component.ComponentID)
          ),
        0
      );
    }

    function configurationUnitTotal(product) {
      return productUnitPrice(product) + componentsUnitTotal();
    }

    function financingBreakdown(product) {
      const quantity =
        positiveInteger(appState.selection.quantity, 1);

      let specialEligible =
        isTrue(product.SpecialFinancingEligible)
          ? productUnitPrice(product) * quantity
          : 0;

      let standardOnly =
        !isTrue(product.SpecialFinancingEligible) &&
        isTrue(product.FinancingEligible)
          ? productUnitPrice(product) * quantity
          : 0;

      let nonFinanceable =
        !isTrue(product.FinancingEligible)
          ? productUnitPrice(product) * quantity
          : 0;

      selectedComponentRecords().forEach(component => {
        const lineAmount =
          componentUnitPrice(component) *
          componentSelectedQuantity(component.ComponentID) *
          quantity;

        if (isTrue(component.SpecialFinancingEligible)) {
          specialEligible += lineAmount;
        } else if (isTrue(component.FinancingEligible)) {
          standardOnly += lineAmount;
        } else {
          nonFinanceable += lineAmount;
        }
      });

      return {
        specialEligible,
        standardOnly,
        nonFinanceable
      };
    }

    function renderSelectedProduct() {
      const product = selectedProduct();

      if (!product) {
        return;
      }

      const quantity =
        positiveInteger(appState.selection.quantity, 1);

      appState.selection.quantity = quantity;

      byId('config-product-name').textContent =
        clean(product.ProductName);

      byId('config-product-meta').textContent =
        [
          clean(product.BrandID),
          clean(product.Model),
          clean(product.SKU),
          clean(product.Category),
          clean(product.PowerType),
          clean(product.System),
          clean(product.Series)
        ].filter(Boolean).join(' • ');

      byId('config-description').textContent =
        clean(product.ShortDescription) ||
        'No description provided.';

      const specs = [
        [product.Spec1Label, product.Spec1Value],
        [product.Spec2Label, product.Spec2Value],
        [product.Spec3Label, product.Spec3Value],
        ['Component Type', product.ComponentType],
        ['Subcategory', product.SubCategory],
        ['Assembly Available', isTrue(product.AssemblyOption) ? 'Yes' : 'No']
      ].filter(
        ([label, value]) =>
          clean(label) && clean(value)
      );

      byId('config-specs').innerHTML =
        specs.length
          ? specs.map(
              ([label, value]) => `
                <div class="spec-item">
                  <div class="spec-label">
                    ${escapeHtml(label)}
                  </div>

                  <div class="spec-value">
                    ${escapeHtml(value)}
                  </div>
                </div>
              `
            ).join('')
          : `
              <div class="empty-state">
                No specifications provided.
              </div>
            `;

      byId('config-msrp').textContent =
        formatMoney(product.MSRP);

      byId('config-unit-price').textContent =
        formatMoney(productUnitPrice(product));

      const availableComponents =
        componentsForProduct(product);

      byId('config-components').innerHTML =
        availableComponents.length
          ? availableComponents.map(component => {
              const componentId =
                clean(component.ComponentID);

              const checked =
                appState.selection.componentIds
                  .map(clean)
                  .includes(componentId);

              return `
                <label class="component-item">
                  <input
                    type="checkbox"
                    class="config-component-checkbox"
                    value="${escapeHtml(componentId)}"
                    ${checked ? 'checked' : ''}
                    ${
                      component._relationship &&
                      (
                        isTrue(component._relationship.Required) ||
                        ['Included', 'Requires'].includes(
                          clean(component._relationship.RelationshipType)
                        )
                      )
                        ? 'disabled'
                        : ''
                    }
                  >

                  <span>
                    <span class="component-name">
                      ${escapeHtml(component.ComponentName)}
                    </span>

                    <span class="component-meta">
                      ${[
                        component.ComponentType,
                        component.SKU,
                        component.System,
                        component.Ah ? `${component.Ah} Ah` : '',
                        component.Wh ? `${component.Wh} Wh` : '',
                        component.Output,
                        component.Description
                      ].map(clean).filter(Boolean).map(escapeHtml).join(' • ')}
                    </span>

                    <span class="component-badges">
                      <span class="component-badge">
                        ${escapeHtml(component.ComponentType)}
                      </span>

                      <span class="component-badge ${
                        isTrue(component.SpecialFinancingEligible)
                          ? 'eligible'
                          : 'excluded'
                      }">
                        ${
                          isTrue(component.SpecialFinancingEligible)
                            ? 'Special Financing'
                            : (
                                isTrue(component.FinancingEligible)
                                  ? 'Standard Financing Only'
                                  : 'Not Financeable'
                              )
                        }
                      </span>

                      ${
                        isTrue(component.RebateEligible)
                          ? '<span class="component-badge eligible">Rebate Eligible</span>'
                          : '<span class="component-badge excluded">No Rebate</span>'
                      }
                    </span>

                    ${
                      component._compatibility?.reason
                        ? `
                          <span class="compatibility-note">
                            ${escapeHtml(component._compatibility.reason)}
                          </span>
                        `
                        : ''
                    }


                    ${
                      component._relationship
                        ? `
                          <span class="relationship-note ${
                            clean(component._relationship.RelationshipType).toLowerCase()
                          }">
                            ${escapeHtml(
                              relationshipLabel(
                                component._relationship
                              )
                            )}
                          </span>
                        `
                        : ''
                    }
                  </span>

                  <input
                    class="component-quantity"
                    type="number"
                    min="${
                      component._relationship
                        ? positiveInteger(component._relationship.MinQty, 1)
                        : 1
                    }"
                    max="${
                      clean(component._relationship?.MaxQty) || ''
                    }"
                    step="1"
                    value="${
                      positiveInteger(
                        appState.selection.componentQuantities[
                          clean(component.ComponentID)
                        ],
                        component._relationship
                          ? positiveInteger(component._relationship.MinQty, 1)
                          : 1
                      )
                    }"
                    data-component-id="${escapeHtml(component.ComponentID)}"
                    ${
                      component._relationship &&
                      (
                        isTrue(component._relationship.Required) ||
                        ['Included', 'Requires'].includes(
                          clean(component._relationship.RelationshipType)
                        )
                      ) &&
                      clean(component._relationship.MaxQty) ===
                        clean(component._relationship.MinQty)
                        ? 'disabled'
                        : ''
                    }
                    aria-label="Component quantity"
                  >

                  <span class="component-price">
                    ${formatMoney(
                      componentUnitPrice(component) *
                      positiveInteger(
                        appState.selection.componentQuantities[
                          clean(component.ComponentID)
                        ],
                        component._relationship
                          ? positiveInteger(component._relationship.MinQty, 1)
                          : 1
                      )
                    )}
                  </span>
                </label>
              `;
            }).join('')
          : `
              <div class="component-empty">
                No components are available for this product.
              </div>
            `;

      byId('config-components-total').textContent =
        formatMoney(componentsUnitTotal());

      const financeTotals =
        financingBreakdown(product);

      byId('config-special-finance-total').textContent =
        formatMoney(financeTotals.specialEligible);

      byId('config-standard-finance-total').textContent =
        formatMoney(financeTotals.standardOnly);

      byId('config-nonfinance-total').textContent =
        formatMoney(financeTotals.nonFinanceable);

      byId('config-quantity').value =
        String(quantity);

      byId('config-total').textContent =
        formatMoney(
          configurationUnitTotal(product) * quantity
        );

      byId('remove-configuration').hidden =
        !cartEntry(product.ProductID);
    }

    function showProductConfiguration(productId) {
      const saved = cartEntry(productId);

      appState.selection.productId =
        clean(productId);

      appState.selection.quantity =
        saved
          ? positiveInteger(saved.quantity, 1)
          : 1;

      appState.selection.componentIds =
        saved && Array.isArray(saved.componentIds)
          ? [...saved.componentIds]
          : [];

      appState.selection.componentQuantities =
        saved && saved.componentQuantities
          ? { ...saved.componentQuantities }
          : {};

      relationshipRowsForParent(productId)
        .forEach(row => {
          const childId =
            clean(row.ChildID);

          if (!childId) {
            return;
          }

          const defaultQuantity =
            positiveInteger(row.MinQty, 1);

          if (
            !appState.selection.componentQuantities[childId]
          ) {
            appState.selection.componentQuantities[childId] =
              defaultQuantity;
          }

          if (
            !saved &&
            (
              isTrue(row.DefaultSelected) ||
              isTrue(row.Required) ||
              ['Included', 'Requires'].includes(
                clean(row.RelationshipType)
              )
            ) &&
            !appState.selection.componentIds.includes(childId)
          ) {
            appState.selection.componentIds.push(childId);
          }
        });

      renderSelectedProduct();

      byId('product-search-card').hidden = true;
      byId('product-config-card').hidden = false;

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }

    function showProductSearch() {
      renderProducts();

      byId('product-config-card').hidden = true;
      byId('product-search-card').hidden = false;

      window.scrollTo({
        top: byId('product-search-card').offsetTop - 12,
        behavior: 'smooth'
      });
    }

    function saveConfiguration() {
      const product = selectedProduct();

      if (!product) {
        return;
      }

      const quantity =
        positiveInteger(appState.selection.quantity, 1);

      appState.cart[clean(product.ProductID)] = {
        productId: clean(product.ProductID),
        quantity,
        unitPrice: productUnitPrice(product),
        componentIds: [...appState.selection.componentIds],
        componentQuantities: {
          ...appState.selection.componentQuantities
        },
        componentUnitTotal: componentsUnitTotal(),
        total: configurationUnitTotal(product) * quantity
      };

      calculateConfiguration();
      showProductSearch();
    }

    function removeConfiguration() {
      const product = selectedProduct();

      if (!product) {
        return;
      }

      delete appState.cart[clean(product.ProductID)];
      calculateConfiguration();

      appState.selection.quantity = 1;

      showProductSearch();
    }

    function readFiltersFromControls() {
      appState.filters.keyword =
        clean(byId('filter-keyword').value);

      appState.filters.category =
        clean(byId('filter-category').value);

      appState.filters.powerType =
        clean(byId('filter-power').value);

      appState.filters.system =
        clean(byId('filter-system').value);

      appState.filters.series =
        clean(byId('filter-series').value);
    }

    function handleFilterChange() {
      readFiltersFromControls();
      renderProducts();
    }

    function clearFilters() {
      byId('filter-keyword').value = '';
      byId('filter-category').value = '';
      byId('filter-power').value = '';
      byId('filter-system').value = '';
      byId('filter-series').value = '';

      readFiltersFromControls();
      renderProducts();
    }

    function changeQuantity(change) {
      appState.selection.quantity =
        Math.max(
          1,
          positiveInteger(appState.selection.quantity, 1) + change
        );

      renderSelectedProduct();
    }

    function removeCartProduct(productId) {
      delete appState.cart[clean(productId)];

      renderProducts();
      renderCurrentConfiguration();
    }

    function showConfigurationSummary() {
      renderCurrentConfiguration();

      if (!configuredProductsCount()) {
        return;
      }

      byId('current-configuration-card').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }


    function renderDeveloperDiagnostics() {
      const panel = byId('developer-panel');
      const banner = byId('round-test-banner');
      const toggleButton = byId('toggle-round-test-prices');

      panel.classList.toggle(
        'active',
        appState.developer.panelOpen
      );

      banner.classList.toggle(
        'active',
        appState.developer.roundTestPrices
      );

      toggleButton.textContent = appState.developer.roundTestPrices
        ? 'Disable Round Test Prices'
        : 'Enable Round Test Prices';

      document.querySelectorAll('.inspector-tab').forEach(button => {
        button.classList.toggle(
          'active',
          button.dataset.pane === appState.developer.activeInspectorPane
        );
      });
      document.querySelectorAll('.inspector-pane').forEach(pane => {
        pane.classList.toggle(
          'active',
          pane.dataset.paneContent === appState.developer.activeInspectorPane
        );
      });

      byId('diag-products').textContent = activeProducts().length;
      byId('diag-components').textContent = allComponents().length;
      byId('diag-relationships').textContent = appState.data.relationships.length;
      byId('diag-items').textContent = appState.configuration.items.length;

      const selected = selectedProduct();
      const diagnostics = {
        version: clean(appState.application?.applicationVersion),
        roundTestPrices: appState.developer.roundTestPrices,
        roundPriceReference: {
          product: 1000,
          battery: 100,
          charger: 10,
          otherComponent: 1
        },
        selectedProduct: selected ? {
          productId: clean(selected.ProductID),
          sku: clean(selected.SKU),
          name: clean(selected.ProductName),
          system: clean(selected.System),
          quantity: appState.selection.quantity,
          selectedComponentIds: [...appState.selection.componentIds],
          componentQuantities: {
            ...appState.selection.componentQuantities
          }
        } : null,
        configuration: appState.configuration,
        loadedRows: {
          products: appState.data.products.length,
          components: appState.data.components.length,
          batteries: appState.data.batteries.length,
          chargers: appState.data.chargers.length,
          compatibility: appState.data.compatibility.length,
          relationships: appState.data.relationships.length,
          dealerRules: appState.data.dealerRules.length,
          promotions: appState.data.promotions.length,
          freightRules: appState.data.freightRules.length,
          financePrograms: appState.data.financePrograms.length
        },
        startupErrors: [...appState.startupErrors]
      };

      const traceLines = [];
      const pricingTrace = appState.configuration?.pricing?.trace || [];

      if (!pricingTrace.length) {
        traceLines.push('No configured items.');
      } else {
        pricingTrace.forEach(line => {
          traceLines.push(
            `${line.type}: ${line.name}${line.sku ? ` • ${line.sku}` : ''}`
          );
          traceLines.push(
            `${line.quantity} × ${formatMoney(line.unitPrice)} = ${formatMoney(line.amount)}`
          );
          traceLines.push('');
        });

        traceLines.push(`Product Subtotal: ${formatMoney(appState.configuration.totals.productSubtotal)}`);
        traceLines.push(`Component Subtotal: ${formatMoney(appState.configuration.totals.componentSubtotal)}`);
        traceLines.push(`Freight: ${formatMoney(appState.configuration.totals.freight)}`);
        traceLines.push(`Promotions: ${formatMoney(appState.configuration.totals.promotions)}`);
        traceLines.push(`Tax: ${formatMoney(appState.configuration.totals.tax)}`);
        traceLines.push(`Final Total: ${formatMoney(appState.configuration.totals.total)}`);
      }

      byId('diagnostic-trace').textContent = traceLines.join('\n');

      byId('diagnostic-configuration').textContent = JSON.stringify(
        appState.configuration,
        null,
        2
      );

      const ruleLines = [];
      const rules = appState.configuration?.rules;
      if (!rules?.stages?.length) {
        ruleLines.push('No rules evaluated.');
      } else {
        ruleLines.push(`Overall: ${rules.passed ? 'PASS' : 'FAIL'}`);
        ruleLines.push('');
        rules.stages.forEach(stage => {
          ruleLines.push(`${stage.stage}: ${stage.status} • ${Number(stage.durationMs || 0).toFixed(3)} ms`);
          (stage.messages || []).forEach(message => ruleLines.push(`  ${message}`));
          ruleLines.push('');
        });
      }
      byId('diagnostic-rules').textContent = ruleLines.join('\n');
      byId('diagnostic-dealer-rules').textContent = JSON.stringify({ loadedRules: appState.data.dealerRules, evaluation: (appState.configuration?.rules?.stages || []).find(stage => stage.stage === 'Dealer Rules')?.details || null }, null, 2);
      byId('diagnostic-promotions').textContent = JSON.stringify({ loadedPromotions: appState.data.promotions, evaluation: appState.configuration?.promotions || null }, null, 2);
      byId('diagnostic-freight').textContent = JSON.stringify({ loadedFreightRules: appState.data.freightRules, evaluation: appState.configuration?.freight || null }, null, 2);
      byId('diagnostic-finance').textContent = JSON.stringify({ loadedFinancePrograms: appState.data.financePrograms, evaluation: appState.configuration?.finance || null }, null, 2);
      byId('diagnostic-dealer-settings').textContent = JSON.stringify({ effectiveDealer: effectiveDealer(), localOverrides: dealerSettingsEngine()?.load?.() || null, locations: appState.data.locations, salespeople: appState.data.salespeople }, null, 2);
      byId('diagnostic-documents').textContent = JSON.stringify({ engine: window.UniversalCPQ?.registry?.getEngine('documents')?.name || 'Unavailable', currentQuote: appState.configuration?.items?.length ? buildCurrentQuote() : null, savedQuotes: savedQuoteEngine()?.listQuotes?.() || [] }, null, 2);

      const performanceLines = [];
      const performanceData = appState.configuration?.performance;
      const rulePerformance = appState.configuration?.rules?.performance;
      const ruleStatistics = appState.configuration?.rules?.statistics;

      if (!performanceData) {
        performanceLines.push('No performance data.');
      } else {
        const speedLabel = ms => ms < 5 ? 'FAST' : ms < 15 ? 'MEDIUM' : 'SLOW';
        performanceLines.push(`Configuration Build: ${performanceData.configurationBuildMs.toFixed(3)} ms • ${speedLabel(performanceData.configurationBuildMs)}`);
        performanceLines.push(`Pricing Engine: ${performanceData.pricingMs.toFixed(3)} ms • ${speedLabel(performanceData.pricingMs)}`);
        performanceLines.push('');
        (rulePerformance?.stages || []).forEach(stage => {
          performanceLines.push(`${stage.stage}: ${stage.durationMs.toFixed(3)} ms • ${speedLabel(stage.durationMs)}`);
        });
        performanceLines.push('');
        performanceLines.push(`Rules Engine Total: ${performanceData.rulesMs.toFixed(3)} ms`);
        performanceLines.push(`Total CPQ Time: ${performanceData.totalMs.toFixed(3)} ms`);
        performanceLines.push('');
        performanceLines.push(`Rules Executed: ${ruleStatistics?.rulesExecuted || 0}`);
        performanceLines.push(`Rules Passed/Applied: ${ruleStatistics?.rulesPassed || 0}`);
        performanceLines.push(`Not Configured: ${ruleStatistics?.rulesNotConfigured || 0}`);
        performanceLines.push(`Skipped: ${ruleStatistics?.rulesSkipped || 0}`);
        performanceLines.push(`Failed/Blocked: ${ruleStatistics?.rulesFailed || 0}`);
        performanceLines.push(`Warnings: ${ruleStatistics?.warnings || 0}`);
        performanceLines.push(`Errors: ${ruleStatistics?.errors || 0}`);
        performanceLines.push('');
        performanceLines.push(`Products: ${appState.data.products.length}`);
        performanceLines.push(`Components: ${allComponents().length}`);
        performanceLines.push(`Relationships: ${appState.data.relationships.length}`);
        performanceLines.push(`Configured Items: ${appState.configuration.items.length}`);
        performanceLines.push('');
        const history = appState.developer.performanceHistory || [];
        if (history.length) {
          const values = history.map(run => Number(run.totalMs || 0)).sort((a,b) => a-b);
          const average = values.reduce((sum, value) => sum + value, 0) / values.length;
          const median = values.length % 2
            ? values[Math.floor(values.length / 2)]
            : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
          performanceLines.push(`Last ${history.length} Runs:`);
          history.forEach((run, index) => {
            performanceLines.push(`Run ${index + 1}: ${run.totalMs.toFixed(3)} ms`);
          });
          performanceLines.push(`Average: ${average.toFixed(3)} ms`);
          performanceLines.push(`Fastest: ${values[0].toFixed(3)} ms`);
          performanceLines.push(`Slowest: ${values[values.length - 1].toFixed(3)} ms`);
          performanceLines.push(`Median: ${median.toFixed(3)} ms`);
        }
      }
      byId('diagnostic-performance').textContent = performanceLines.join('\n');

      byId('diagnostic-relationships').textContent = JSON.stringify(
        appState.data.relationships,
        null,
        2
      );

      byId('diagnostic-data').textContent = JSON.stringify(
        diagnostics.loadedRows,
        null,
        2
      );

      byId('diagnostic-json').textContent = JSON.stringify(
        diagnostics,
        null,
        2
      );
    }

    function buildHealthReport() {
      const configuration = appState.configuration;
      const stages = configuration?.rules?.stages || [];
      const stageStatus = name => stages.find(stage => stage.stage === name)?.status || 'NOT_RUN';
      const totals = configuration?.totals || {};
      const expectedTotal = money(totals.subtotal) + money(totals.freight) + money(totals.tax);
      const pricingPass = Math.abs(expectedTotal - money(totals.total)) < 0.01;
      const errors = configuration?.rules?.errors?.length || 0;
      const startupErrors = appState.startupErrors.length;
      const categories = {
        configuration: configuration ? 'PASS' : 'NOT_RUN',
        pricing: pricingPass ? 'PASS' : 'FAIL',
        relationships: appState.data.relationships.length ? 'PASS' : 'NOT_CONFIGURED',
        compatibility: stageStatus('Compatibility'),
        promotions: stageStatus('Promotions'),
        freight: stageStatus('Freight'),
        dealerRules: stageStatus('Dealer Rules'),
        finance: stageStatus('Finance'),
        startup: startupErrors ? 'FAIL' : 'PASS'
      };
      const failing = Object.values(categories).filter(status => ['FAIL','BLOCKED'].includes(status)).length;
      const score = Math.max(0, 100 - failing * 20 - errors * 10 - startupErrors * 20);
      return {
        score,
        status: failing || errors || startupErrors ? 'FAIL' : 'PASS',
        readyForCommit: !(failing || errors || startupErrors),
        categories
      };
    }

    function buildDiagnosticSnapshot() {
      const selected = selectedProduct();
      const rules = appState.configuration?.rules || null;
      const performance = appState.configuration?.performance || null;
      const pricingTrace = appState.configuration?.pricing?.trace || [];

      return {
        exportFormat: 'universal-cpq-diagnostics',
        exportVersion: '1.0',
        exportedAt: new Date().toISOString(),
        application: {
          name: clean(appState.application?.applicationName),
          version: clean(appState.application?.applicationVersion),
          dataVersion: clean(appState.application?.dataVersion),
          cpqSchemaVersion: clean(
            appState.application?.cpq?.configurationSchemaVersion ||
            appState.configuration?.schemaVersion
          )
        },
        session: {
          roundTestPrices: appState.developer.roundTestPrices,
          activeInspectorPane: appState.developer.activeInspectorPane,
          pageUrl: window.location.href,
          userAgent: navigator.userAgent
        },
        selectedProduct: selected ? {
          productId: clean(selected.ProductID),
          sku: clean(selected.SKU),
          name: clean(selected.ProductName),
          system: clean(selected.System),
          quantity: positiveInteger(appState.selection.quantity, 1),
          selectedComponentIds: [...appState.selection.componentIds],
          componentQuantities: {
            ...appState.selection.componentQuantities
          }
        } : null,
        configuration: appState.configuration,
        calculationTrace: pricingTrace,
        promotions: appState.configuration?.promotions || null,
        freight: appState.configuration?.freight || null,
        finance: appState.configuration?.finance || null,
        quote: appState.configuration?.items?.length ? buildCurrentQuote() : null,
        dealerSettings: effectiveDealer(),
        locations: appState.data.locations,
        salespeople: appState.data.salespeople,
        health: buildHealthReport(),
        ruleTrace: rules,
        performance: {
          current: performance,
          rulePerformance: rules?.performance || null,
          ruleStatistics: rules?.statistics || null,
          history: [...(appState.developer.performanceHistory || [])]
        },
        catalogStatistics: {
          activeProducts: activeProducts().length,
          productsLoaded: appState.data.products.length,
          componentsLoaded: appState.data.components.length,
          batteriesLoaded: appState.data.batteries.length,
          chargersLoaded: appState.data.chargers.length,
          compatibilityRows: appState.data.compatibility.length,
          relationshipRows: appState.data.relationships.length,
          unifiedComponents: allComponents().length,
          configuredItems: appState.configuration?.items?.length || 0,
          dealerRuleRows: appState.data.dealerRules.length,
          promotionRows: appState.data.promotions.length,
          freightRuleRows: appState.data.freightRules.length,
          financeProgramRows: appState.data.financePrograms.length,
          savedQuoteCount: savedQuoteEngine()?.listQuotes?.().length || 0,
          locationRows: appState.data.locations.length,
          salespersonRows: appState.data.salespeople.length
        },
        startupErrors: [...appState.startupErrors]
      };
    }

    function exportDiagnostics() {
      try {
        const snapshot = buildDiagnosticSnapshot();
        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, '-')
          .replace('T', '_')
          .replace('Z', '');
        const version = clean(appState.application?.applicationVersion) || 'unknown';
        const filename = `universal-cpq-diagnostics-v${version}_${timestamp}.json`;
        const blob = new Blob(
          [JSON.stringify(snapshot, null, 2)],
          { type: 'application/json;charset=utf-8' }
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch (error) {
        appState.startupErrors.push(
          `Diagnostics export failed: ${error.message}`
        );
        renderDeveloperDiagnostics();
      }
    }

    function refreshAfterDiagnosticPriceChange() {
      calculateConfiguration();
      renderProducts();

      if (selectedProduct()) {
        renderSelectedProduct();
      }

      renderDeveloperDiagnostics();
    }


    function readQuoteForm() {
      const field = id => clean(byId(id)?.value);
      const existingQuoteNumber = clean(appState.quote?.quoteNumber);
      appState.quote = {
        customer: {
          name: field('quote-customer-name'),
          business: field('quote-business-name'),
          phone: field('quote-phone'),
          email: field('quote-email'),
          address: field('quote-address'),
          city: field('quote-city'),
          state: field('quote-state'),
          zip: field('quote-zip'),
          notes: field('quote-notes')
        },
        preparedBy: field('quote-prepared-by'),
        validThrough: field('quote-valid-through'),
        terms: field('quote-terms'),
        quoteNumber: existingQuoteNumber,
        locationId: field('quote-location')
      };
      return appState.quote;
    }

    function buildCurrentQuote() {
      const documentEngine = window.UniversalCPQ?.registry?.getEngine('documents');
      if (!documentEngine || typeof documentEngine.buildQuote !== 'function') {
        throw new Error('Universal Quote & Document Engine is unavailable.');
      }
      const form = readQuoteForm();
      return documentEngine.buildQuote({
        configuration: appState.configuration,
        customer: form.customer,
        preparedBy: form.preparedBy,
        validThrough: form.validThrough,
        terms: form.terms || effectiveDealer().defaultTerms,
        dealer: effectiveDealer(),
        brand: appState.brand,
        application: appState.application,
        quoteNumber: appState.quote.quoteNumber
      });
    }


    function writeQuoteForm(quote = {}) {
      const customer = quote.customer || {};
      const set = (id, value) => { const element = byId(id); if (element) element.value = clean(value); };
      set('quote-prepared-by', quote.preparedBy);
      set('quote-location', quote.locationId || appState.quote.locationId);
      set('quote-valid-through', quote.validThrough);
      set('quote-customer-name', customer.name);
      set('quote-business-name', customer.business);
      set('quote-phone', customer.phone);
      set('quote-email', customer.email);
      set('quote-address', customer.address);
      set('quote-city', customer.city);
      set('quote-state', customer.state);
      set('quote-zip', customer.zip);
      set('quote-notes', customer.notes);
      set('quote-terms', quote.terms);
    }

    function savedQuoteEngine() {
      return window.UniversalCPQ?.registry?.getEngine('documents');
    }

    function renderSavedQuotes() {
      const target = byId('saved-quotes-list');
      if (!target) return;
      const engine = savedQuoteEngine();
      const quotes = engine?.listQuotes?.() || [];
      if (!quotes.length) {
        target.className = 'saved-quote-empty';
        target.textContent = 'No saved quotes.';
        return;
      }
      target.className = '';
      target.innerHTML = `<table><thead><tr><th>Quote</th><th>Customer</th><th>Date</th><th class="num">Total</th><th></th></tr></thead><tbody>${quotes.map(quote => {
        const customer = clean(quote.customer?.business || quote.customer?.name) || 'Not provided';
        const date = quote.updatedAt || quote.createdAt;
        return `<tr><td><strong>${escapeHtml(quote.quoteNumber)}</strong></td><td>${escapeHtml(customer)}</td><td>${escapeHtml(date ? new Date(date).toLocaleDateString() : '')}</td><td class="num">${formatMoney(quote.totals?.total)}</td><td><div class="saved-quote-actions"><button class="button reopen-saved-quote" type="button" data-quote-number="${escapeHtml(quote.quoteNumber)}">Open</button><button class="button delete-saved-quote" type="button" data-quote-number="${escapeHtml(quote.quoteNumber)}">Delete</button></div></td></tr>`;
      }).join('')}</tbody></table>`;
    }

    function saveCurrentQuote() {
      calculateConfiguration();
      if (!appState.configuration?.items?.length) {
        window.alert('Add at least one configured product before saving a quote.');
        return;
      }
      try {
        const engine = savedQuoteEngine();
        const quote = buildCurrentQuote();
        const saved = engine.saveQuote(quote);
        appState.quote.quoteNumber = saved.quoteNumber;
        renderSavedQuotes();
        window.alert(`${saved.quoteNumber} saved.`);
      } catch (error) {
        console.error(error);
        window.alert(error instanceof Error ? error.message : String(error));
      }
    }

    function restoreSavedQuote(quoteNumber) {
      const engine = savedQuoteEngine();
      const quote = engine?.getQuote?.(quoteNumber);
      if (!quote) {
        window.alert('Saved quote could not be found.');
        return;
      }
      appState.cart = {};
      (quote.items || []).forEach(item => {
        const productId = clean(item.productId);
        if (!productId) return;
        const productQuantity = positiveInteger(item.quantity, 1);
        const componentIds = (item.components || []).map(component => clean(component.componentId)).filter(Boolean);
        const componentQuantities = {};
        (item.components || []).forEach(component => {
          const id = clean(component.componentId);
          if (!id) return;
          componentQuantities[id] = Math.max(1, Math.round(money(component.quantity) / productQuantity));
        });
        appState.cart[productId] = {
          productId,
          quantity: productQuantity,
          unitPrice: money(item.unitPrice),
          componentIds,
          componentQuantities,
          componentUnitTotal: productQuantity ? money(item.componentTotal) / productQuantity : 0,
          total: money(item.lineTotal)
        };
      });
      appState.quote = {
        customer: { ...(quote.customer || {}) },
        preparedBy: clean(quote.preparedBy),
        validThrough: clean(quote.validThrough),
        terms: clean(quote.terms),
        quoteNumber: clean(quote.quoteNumber)
      };
      writeQuoteForm(quote);
      calculateConfiguration();
      showProductSearch();
      renderSavedQuotes();
      byId('current-configuration-card')?.scrollIntoView({ behavior:'smooth', block:'start' });
    }

    function deleteSavedQuote(quoteNumber) {
      if (!window.confirm(`Delete saved quote ${quoteNumber}?`)) return;
      savedQuoteEngine()?.deleteQuote?.(quoteNumber);
      if (appState.quote.quoteNumber === quoteNumber) appState.quote.quoteNumber = '';
      renderSavedQuotes();
    }

    function newQuote() {
      appState.cart = {};
      appState.quote = { customer:{}, preparedBy:'', validThrough:defaultQuoteValidThrough(), terms:effectiveDealer().defaultTerms, quoteNumber:'', locationId:effectiveDealer().defaultLocationId };
      writeQuoteForm({});
      calculateConfiguration();
      showProductSearch();
    }

    function previewQuote() {
      calculateConfiguration();
      if (!appState.configuration?.items?.length) {
        window.alert('Add at least one configured product before creating a quote.');
        return;
      }
      try {
        const documentEngine = window.UniversalCPQ?.registry?.getEngine('documents');
        const quote = buildCurrentQuote();
        documentEngine.saveQuoteSession(quote);
        window.open('quote.html', '_blank', 'noopener');
      } catch (error) {
        console.error(error);
        window.alert(error instanceof Error ? error.message : String(error));
      }
    }

    function bindApplicationEvents() {
      byId('toggle-developer-panel').addEventListener(
        'click',
        () => {
          appState.developer.panelOpen =
            !appState.developer.panelOpen;
          renderDeveloperDiagnostics();
        }
      );

      byId('inspector-tabs').addEventListener('click', event => {
        const button = event.target.closest('.inspector-tab');
        if (!button) return;
        appState.developer.activeInspectorPane = button.dataset.pane;
        renderDeveloperDiagnostics();
      });

      byId('export-diagnostics').addEventListener(
        'click',
        exportDiagnostics
      );

      byId('toggle-round-test-prices').addEventListener(
        'click',
        () => {
          appState.developer.roundTestPrices =
            !appState.developer.roundTestPrices;
          refreshAfterDiagnosticPriceChange();
        }
      );

      [
        'filter-keyword',
        'filter-category',
        'filter-power',
        'filter-system',
        'filter-series'
      ].forEach(id => {
        byId(id).addEventListener(
          id === 'filter-keyword'
            ? 'input'
            : 'change',
          handleFilterChange
        );
      });

      byId('clear-filters').addEventListener(
        'click',
        clearFilters
      );

      byId('product-list').addEventListener(
        'click',
        event => {
          const button =
            event.target.closest('.select-product');

          if (!button) {
            return;
          }

          showProductConfiguration(
            button.dataset.productId
          );
        }
      );

      byId('back-to-products').addEventListener(
        'click',
        showProductSearch
      );

      byId('quantity-minus').addEventListener(
        'click',
        () => changeQuantity(-1)
      );

      byId('quantity-plus').addEventListener(
        'click',
        () => changeQuantity(1)
      );

      byId('config-quantity').addEventListener(
        'input',
        event => {
          appState.selection.quantity =
            positiveInteger(event.target.value, 1);

          renderSelectedProduct();
        }
      );

      byId('config-components').addEventListener(
        'change',
        event => {
          const checkbox =
            event.target.closest('.config-component-checkbox');

          if (!checkbox) {
            return;
          }

          const id = clean(checkbox.value);

          const product =
            selectedProduct();

          const component =
            allComponents().find(
              row =>
                clean(row.ComponentID) === id
            );

          const relationship =
            relationshipForProductComponent(
              product,
              component
            );

          const locked =
            relationship &&
            (
              isTrue(relationship.Required) ||
              ['Included', 'Requires'].includes(
                clean(relationship.RelationshipType)
              )
            );

          if (locked && !checkbox.checked) {
            checkbox.checked = true;
            return;
          }

          if (checkbox.checked) {
            if (!appState.selection.componentIds.includes(id)) {
              appState.selection.componentIds.push(id);
            }

            if (!appState.selection.componentQuantities[id]) {
              const minimum =
                relationship
                  ? positiveInteger(relationship.MinQty, 1)
                  : 1;

              appState.selection.componentQuantities[id] =
                minimum;
            }
          } else {
            appState.selection.componentIds =
              appState.selection.componentIds.filter(
                componentId => clean(componentId) !== id
              );
          }

          renderSelectedProduct();
        }
      );

      byId('config-components').addEventListener(
        'input',
        event => {
          const input =
            event.target.closest('.component-quantity');

          if (!input) {
            return;
          }

          const id =
            clean(input.dataset.componentId);

          const component =
            allComponents().find(
              row =>
                clean(row.ComponentID) === id
            );

          const relationship =
            relationshipForProductComponent(
              selectedProduct(),
              component
            );

          const minQty =
            relationship
              ? positiveInteger(relationship.MinQty, 1)
              : 1;

          const maxQty =
            positiveInteger(
              relationship?.MaxQty,
              Number.MAX_SAFE_INTEGER
            );

          const nextQty =
            Math.min(
              maxQty,
              Math.max(
                minQty,
                positiveInteger(input.value, minQty)
              )
            );

          appState.selection.componentQuantities[id] =
            nextQty;

          renderSelectedProduct();
        }
      );

      byId('save-configuration').addEventListener(
        'click',
        saveConfiguration
      );

      byId('remove-configuration').addEventListener(
        'click',
        removeConfiguration
      );

      byId('preview-quote').addEventListener('click', previewQuote);
      byId('save-quote').addEventListener('click', saveCurrentQuote);
      byId('new-quote').addEventListener('click', newQuote);
      const dealerSettingsToggle = byId('toggle-dealer-settings');
      const dealerSettingsCard = byId('dealer-settings-card');
      const saveDealerSettingsButton = byId('save-dealer-settings');
      const resetDealerSettingsButton = byId('reset-dealer-settings');

      if (dealerSettingsToggle && dealerSettingsCard) {
        dealerSettingsToggle.addEventListener('click', () => {
          dealerSettingsCard.hidden = !dealerSettingsCard.hidden;
          if (!dealerSettingsCard.hidden) writeDealerSettingsForm();
        });
      }

      if (saveDealerSettingsButton) {
        saveDealerSettingsButton.addEventListener('click', saveDealerSettings);
      }

      if (resetDealerSettingsButton) {
        resetDealerSettingsButton.addEventListener('click', resetDealerSettings);
      }
      byId('saved-quotes-list').addEventListener('click', event => {
        const openButton = event.target.closest('.reopen-saved-quote');
        if (openButton) { restoreSavedQuote(openButton.dataset.quoteNumber); return; }
        const deleteButton = event.target.closest('.delete-saved-quote');
        if (deleteButton) deleteSavedQuote(deleteButton.dataset.quoteNumber);
      });

      byId('continue-shopping').addEventListener(
        'click',
        () => {
          byId('product-search-card').scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      );

      byId('configuration-lines').addEventListener(
        'click',
        event => {
          const editButton =
            event.target.closest('.edit-configuration-line');

          if (editButton) {
            showProductConfiguration(
              editButton.dataset.productId
            );
            return;
          }

          const removeButton =
            event.target.closest('.remove-configuration-line');

          if (removeButton) {
            removeCartProduct(
              removeButton.dataset.productId
            );
          }
        }
      );
    }

    async function loadCompatibility() {
      const compatibilityPath =
        clean(appState.brand?.compatibilityDataPath) ||
        'data/compatibility.csv';

      try {
        const compatibility =
          await loadDataFile(
            'compatibility',
            compatibilityPath
          );

        setStatus(
          'compatibility',
          `Loaded ${compatibility.length} row(s): ${compatibilityPath}`,
          'success'
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        appState.startupErrors.push(message);

        setStatus(
          'compatibility',
          message,
          'error'
        );
      }
    }

    async function loadRelationships() {
      const path =
        clean(appState.brand?.relationshipDataPath) ||
        'data/relationships.csv';

      try {
        const rows =
          await loadDataFile(
            'relationships',
            path
          );

        setStatus(
          'relationships',
          `Loaded ${rows.length} row(s): ${path}`,
          'success'
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        appState.startupErrors.push(message);

        setStatus(
          'relationships',
          message,
          'error'
        );
      }
    }

    async function loadBatteries() {
      const path =
        clean(appState.brand?.batteryDataPath) ||
        'data/batteries.csv';

      try {
        const rows =
          await loadDataFile(
            'batteries',
            path
          );

        setStatus(
          'batteries',
          `Loaded ${rows.length} row(s): ${path}`,
          'success'
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        appState.startupErrors.push(message);

        setStatus(
          'batteries',
          message,
          'error'
        );
      }
    }

    async function loadChargers() {
      const path =
        clean(appState.brand?.chargerDataPath) ||
        'data/chargers.csv';

      try {
        const rows =
          await loadDataFile(
            'chargers',
            path
          );

        setStatus(
          'chargers',
          `Loaded ${rows.length} row(s): ${path}`,
          'success'
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        appState.startupErrors.push(message);

        setStatus(
          'chargers',
          message,
          'error'
        );
      }
    }

    async function loadComponents() {
      const componentPath =
        clean(appState.brand?.componentDataPath) ||
        'data/components.csv';

      try {
        const components =
          await loadDataFile(
            'components',
            componentPath
          );

        setStatus(
          'components',
          `Loaded ${components.length} row(s): ${componentPath}`,
          'success'
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        appState.startupErrors.push(message);

        setStatus(
          'components',
          message,
          'error'
        );
      }
    }




    async function loadFinancePrograms() {
      const path = clean(appState.application?.financeProgramsDataPath) || 'data/finance-programs.csv';
      try {
        const rows = await loadDataFile('financePrograms', path);
        console.log(`Loaded ${rows.length} finance program row(s): ${path}`);
      } catch (error) {
        appState.data.financePrograms = [];
        console.info(`Finance programs not configured: ${path}`);
      }
    }

    async function loadFreightRules() {
      const path = clean(appState.application?.freightRulesDataPath) || 'data/freight-rules.csv';
      try {
        const rows = await loadDataFile('freightRules', path);
        console.log(`Loaded ${rows.length} freight rule row(s): ${path}`);
      } catch (error) {
        appState.data.freightRules = [];
        console.info(`Freight rules not configured: ${path}`);
      }
    }

    async function loadPromotions() {
      const path = clean(appState.application?.promotionsDataPath) || 'data/promotions.csv';
      try {
        const rows = await loadDataFile('promotions', path);
        console.log(`Loaded ${rows.length} promotion row(s): ${path}`);
      } catch (error) {
        appState.data.promotions = [];
        console.info(`Promotions not configured: ${path}`);
      }
    }

    async function loadDealerRules() {
      const path = clean(appState.application?.dealerRulesDataPath) || 'data/dealer-rules.csv';
      try {
        const rows = await loadDataFile('dealerRules', path);
        console.log(`Loaded ${rows.length} dealer rule row(s): ${path}`);
      } catch (error) {
        appState.data.dealerRules = [];
        console.info(`Dealer rules not configured: ${path}`);
      }
    }

    async function loadProducts() {
      const productPath =
        clean(appState.brand?.productDataPath) ||
        'data/products.csv';

      try {
        const products =
          await loadDataFile(
            'products',
            productPath
          );

        const productErrors =
          validateProducts(products);

        if (productErrors.length) {
          throw new Error(
            productErrors.join('\n')
          );
        }

        setStatus(
          'products',
          `Loaded ${products.length} row(s): ${productPath}`,
          'success'
        );

        populateProductFilters();
        renderProducts();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        appState.startupErrors.push(message);

        setStatus(
          'products',
          message,
          'error'
        );
      }
    }


    async function loadLocations() {
      const path = clean(appState.application?.locationsDataPath) || 'data/locations.csv';
      try {
        appState.data.locations = await loadDataFile('locations', path);
      } catch (error) {
        appState.data.locations = [];
        console.info(`Optional locations data not loaded: ${path}`);
      }
    }

    async function loadSalespeople() {
      const path = clean(appState.application?.salespeopleDataPath) || 'data/salespeople.csv';
      try {
        appState.data.salespeople = await loadDataFile('salespeople', path);
      } catch (error) {
        appState.data.salespeople = [];
        console.info(`Optional salespeople data not loaded: ${path}`);
      }
    }

    function populateDealerSelections() {
      const dealer = effectiveDealer();
      const salesperson = byId('quote-prepared-by');
      if (salesperson) {
        const current = clean(salesperson.value);
        salesperson.innerHTML = '<option value="">Select Salesperson</option>' + appState.data.salespeople
          .filter(row => !clean(row.Active) || isTrue(row.Active))
          .sort((a,b) => Number(a.SortOrder||0)-Number(b.SortOrder||0))
          .map(row => `<option value="${escapeHtml(row.Name)}">${escapeHtml(row.Name)}</option>`).join('');
        if (current) salesperson.value = current;
      }
      const location = byId('quote-location');
      if (location) {
        const current = clean(location.value || appState.quote.locationId || dealer.defaultLocationId);
        location.innerHTML = '<option value="">Default Location</option>' + appState.data.locations
          .filter(row => !clean(row.Active) || isTrue(row.Active))
          .map(row => `<option value="${escapeHtml(row.LocationID)}">${escapeHtml(row.LocationName)}</option>`).join('');
        if (current) location.value = current;
      }
    }

    function writeDealerSettingsForm() {
      const dealer = effectiveDealer();
      const set = (id, value) => { const element = byId(id); if (element) element.value = clean(value); };
      set('dealer-name', dealer.dealerName); set('dealer-legal-name', dealer.legalName); set('dealer-address', dealer.address);
      set('dealer-city', dealer.city); set('dealer-state', dealer.state); set('dealer-zip', dealer.zip); set('dealer-phone', dealer.phone);
      set('dealer-email', dealer.email); set('dealer-website', dealer.website); set('dealer-logo-url', dealer.logoUrl);
      set('dealer-primary-color', dealer.primaryColor); set('dealer-secondary-color', dealer.secondaryColor); set('dealer-accent-color', dealer.accentColor);
      set('dealer-quote-prefix', dealer.quotePrefix); set('dealer-valid-days', dealer.defaultQuoteValidDays); set('dealer-tax-rate', dealer.defaultTaxRate);
      set('dealer-default-terms', dealer.defaultTerms); set('dealer-default-location', dealer.defaultLocationId);
    }

    function readDealerSettingsForm() {
      const value = id => clean(byId(id)?.value);
      return {
        ...effectiveDealer(), dealerName:value('dealer-name'), legalName:value('dealer-legal-name'), address:value('dealer-address'),
        city:value('dealer-city'), state:value('dealer-state'), zip:value('dealer-zip'), phone:value('dealer-phone'), email:value('dealer-email'),
        website:value('dealer-website'), logoUrl:value('dealer-logo-url'), primaryColor:value('dealer-primary-color'), secondaryColor:value('dealer-secondary-color'),
        accentColor:value('dealer-accent-color'), quotePrefix:value('dealer-quote-prefix') || 'QUOTE',
        defaultQuoteValidDays:Number(value('dealer-valid-days') || 14), defaultTaxRate:Number(value('dealer-tax-rate') || 0),
        defaultTerms:value('dealer-default-terms'), defaultLocationId:value('dealer-default-location')
      };
    }

    function saveDealerSettings() {
      const engine = dealerSettingsEngine();
      appState.dealer = engine.save(readDealerSettingsForm());
      applyDealerOverrides(); renderApplicationIdentity(); populateDealerSelections();
      window.alert('Dealer settings saved locally. Future platform updates will not overwrite them.');
      renderDeveloperDiagnostics();
    }

    function resetDealerSettings() {
      if (!window.confirm('Remove local dealer overrides and return to the original dealer configuration?')) return;
      dealerSettingsEngine()?.clear?.();
      window.location.reload();
    }

    function validateConfiguration() {
      const errors = [];

      if (!appState.application) {
        errors.push(
          'Application configuration did not load.'
        );
      }

      if (!appState.dealer) {
        errors.push(
          'Dealer configuration did not load.'
        );
      }

      if (!appState.brand) {
        errors.push(
          'Brand configuration did not load.'
        );
      }

      if (!appState.tax) {
        errors.push(
          'Tax configuration did not load.'
        );
      }

      return errors;
    }

    function renderStartupResult() {
      const allErrors = [
        ...appState.startupErrors,
        ...validateConfiguration()
      ];

      const errorPanel = byId('error-panel');
      const readyPanel = byId('app-ready-panel');

      if (allErrors.length) {
        errorPanel.style.display = 'block';
        readyPanel.style.display = 'none';

        errorPanel.textContent = [
          'Version 3 could not finish loading:',
          '',
          ...allErrors.map(
            error => `• ${error}`
          ),
          '',
          'Open this project through VS Code Live Server.',
          'Do not open index.html directly from File Explorer.'
        ].join('\n');

        return;
      }

      errorPanel.style.display = 'none';
      readyPanel.style.display = 'block';
    }

    async function initializeApplication() {
      bindApplicationEvents();

      await Promise.all([
        loadConfigurationFile(
          'application',
          'application',
          APP_PATHS.application
        ),

        loadConfigurationFile(
          'dealer',
          'dealer',
          APP_PATHS.dealer
        ),

        loadConfigurationFile(
          'brand',
          'brand',
          APP_PATHS.brand
        ),

        loadConfigurationFile(
          'tax',
          'tax',
          APP_PATHS.tax
        )
      ]);

      applyBrandTheme();
      applyDealerOverrides();
      renderApplicationIdentity();

      if (appState.brand) {
        await loadCompatibility();
        await loadComponents();
        await loadBatteries();
        await loadChargers();
        await loadRelationships();
        await loadFreightRules();
        await loadFinancePrograms();
        await loadPromotions();
        await loadDealerRules();
        await loadLocations();
        await loadSalespeople();
        await loadProducts();
      }

      applyDealerOverrides();
      renderApplicationIdentity();
      populateDealerSelections();
      writeDealerSettingsForm();
      if (!clean(byId('quote-valid-through')?.value)) byId('quote-valid-through').value = defaultQuoteValidThrough();
      if (!clean(byId('quote-terms')?.value)) byId('quote-terms').value = effectiveDealer().defaultTerms || '';
      renderStartupResult();
      renderSavedQuotes();
      renderDeveloperDiagnostics();

      console.log(
        'Universal Configurator Version 3 CPQ state:',
        appState
      );
    }

    document.addEventListener(
      'DOMContentLoaded',
      initializeApplication
    );
