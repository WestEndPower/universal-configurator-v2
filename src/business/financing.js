
'use strict';

(function registerFinanceEngine(global) {
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
  const integer = (value, fallback = 0) => {
    const parsed = Math.trunc(number(value));
    return parsed > 0 ? parsed : fallback;
  };
  const matches = (
    ruleValue,
    itemValue
  ) => {
    const expected =
      norm(ruleValue);

    const actual =
      norm(itemValue);

    if (
      !expected ||
      expected === 'all' ||
      expected === 'all-products' ||
      expected === '*' ||
      expected === 'any'
    ) {
      return true;
    }

    return expected === actual;
  };

  function parseDate(value, endOfDay = false) {
    if (!text(value)) return null;
    const date = new Date(`${text(value)}T${endOfDay ? '23:59:59' : '00:00:00'}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function monthlyPayment(principal, apr, months) {
    const amount = Math.max(0, number(principal));
    const term = integer(months, 0);
    if (!term || amount <= 0) return 0;
    const monthlyRate = Math.max(0, number(apr)) / 100 / 12;
    if (monthlyRate === 0) return amount / term;
    const factor = Math.pow(1 + monthlyRate, term);
    return amount * monthlyRate * factor / (factor - 1);
  }

  function itemMatches(program, item) {
    return (
      matches(
        program.BrandID ||
        program.Brand,
        item.brandId
      ) &&
      matches(
        program.ProductID,
        item.productId
      ) &&
      matches(
        program.SKU,
        item.sku
      ) &&
      matches(
        program.Category,
        item.category
      ) &&
      matches(
        program.System,
        item.system
      ) &&
      matches(
        program.FinancingGroup ||
        program.FinanceGroup,
        item.financingGroup
      )
    );
  }

  function evaluateProgram(program, context, now) {
    const id =
      text(program.ProgramID) ||
      text(program.Label) ||
      text(program.ProgramName) ||
      '(unnamed)';
    if (!active(program.Active)) return { programId:id, status:'REJECTED', reason:'Program is inactive.' };

    const start = parseDate(program.StartDate);
    const end = parseDate(program.EndDate, true);
    if (start && now < start) return { programId:id, status:'REJECTED', reason:'Program has not started.' };
    if (end && now > end) return { programId:id, status:'REJECTED', reason:'Program has expired.' };

    const amount = number(context.amountFinanced);
    const minAmount = number(program.MinAmount);
    const maxAmount = number(program.MaxAmount);
    if (minAmount > 0 && amount < minAmount) return { programId:id, status:'REJECTED', reason:`Minimum financed amount is $${minAmount.toFixed(2)}.` };
    if (maxAmount > 0 && amount > maxAmount) return { programId:id, status:'REJECTED', reason:`Maximum financed amount is $${maxAmount.toFixed(2)}.` };

    const items = Array.isArray(context.items) ? context.items : [];
    if (items.length && !items.some(item => itemMatches(program, item))) {
      return { programId:id, status:'REJECTED', reason:'Program does not apply to the configured products.' };
    }

    if (
      truthy(program.RequiresPromotion) &&
      !truthy(context.promotionApplied)
    ) {
      return {
        programId: id,
        status: 'REJECTED',
        reason: 'Required promotion is not applied.'
      };
    }

    const minimumDown = Math.max(0, number(program.MinimumDown));
    const applicationFee = Math.max(0, number(program.ApplicationFee));
    const dealerFeePercent = Math.max(0, number(program.DealerFeePercent));
    const termMonths = integer(program.TermMonths, 0);
    const apr = Math.max(0, number(program.APR));
    const financedPrincipal = Math.max(0, amount - minimumDown) + applicationFee;
    const monthly = monthlyPayment(financedPrincipal, apr, termMonths);
    const dealerFee = financedPrincipal * dealerFeePercent / 100;

    return {
      programId:id,
      label:
        text(program.Label) ||
        text(program.ProgramName) ||
        text(program.CustomerText) ||
        id,
      status:'ELIGIBLE',
      type:text(program.Type) || 'Finance',
      apr,
      termMonths,
      minimumDown,
      applicationFee,
      dealerFeePercent,
      financedPrincipal,
      estimatedMonthlyPayment:monthly,
      estimatedTotalPayments:monthly * termMonths,
      dealerFee,
      priority:number(program.Priority),
      financingGroup:
        text(
          program.FinancingGroup ||
          program.FinanceGroup
        ),
      rebateEligible:!text(program.RebateEligible) || truthy(program.RebateEligible),
      customerText:text(program.CustomerText),
      notes:text(program.Notes)
    };
  }

  platform.registry.registerEngine('financing', {
    name: 'Universal Finance Engine',
    version: '1.0.0',
    configured: true,
    evaluate(context = {}) {
      const programs = Array.isArray(context.financePrograms) ? context.financePrograms : [];
      if (!programs.length) {
        return { status:'NOT_CONFIGURED', messages:['No finance program data configured.'], eligible:[], rejected:[], selected:null, adjustments:[], dealerFee:0, applicationFee:0 };
      }

      const now = context.now instanceof Date ? context.now : new Date();
      const evaluated = programs.map(program => evaluateProgram(program, context, now));
      const eligible = evaluated.filter(row => row.status === 'ELIGIBLE')
        .sort((a,b) => a.priority - b.priority || a.apr - b.apr || a.termMonths - b.termMonths);
      const rejected = evaluated.filter(row => row.status !== 'ELIGIBLE');
      const selectedId = text(context.selectedProgramId);
      const selected = selectedId ? eligible.find(row => norm(row.programId) === norm(selectedId)) || null : null;

      return {
        status: selected ? 'APPLIED' : eligible.length ? 'AVAILABLE' : 'PASS',
        messages: selected
          ? [`APPLIED • ${selected.label} • ${selected.apr.toFixed(2)}% for ${selected.termMonths} months.`]
          : eligible.length
            ? [`${eligible.length} eligible finance program(s) available.`]
            : ['No finance programs apply to this configuration.'],
        eligible,
        rejected,
        selected,
        adjustments:selected ? [{ type:'FINANCE_DEALER_FEE', programId:selected.programId, amount:selected.dealerFee }] : [],
        dealerFee:selected?.dealerFee || 0,
        applicationFee:selected?.applicationFee || 0,
        amountFinanced:number(context.amountFinanced)
      };
    }
  });
})(window);
