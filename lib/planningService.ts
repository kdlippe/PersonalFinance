export type TaxType = 'traditional' | 'roth' | 'taxable' | 'hsa' | 'exclude';
export type FilingStatus = 'single' | 'married_filing_jointly';

export interface PlanningSettings {
  retirementTarget: number;
  annualGrowthRate: number;
  birthYear: number;
  retirementAge: number;
  annualContribution: number;
  annualIncome: number;
  taxFilingStatus: FilingStatus;
  accountTaxTypes: Record<string, TaxType>;
}

export const DEFAULT_SETTINGS: PlanningSettings = {
  retirementTarget: 5000000,
  annualGrowthRate: 0.07,
  birthYear: 1978,
  retirementAge: 65,
  annualContribution: 50000,
  annualIncome: 300000,
  taxFilingStatus: 'married_filing_jointly',
  accountTaxTypes: {},
};

// IRS Uniform Lifetime Table (SECURE 2.0, effective 2022)
export const RMD_TABLE: Record<number, number> = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7,
  77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4,
  82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2,
  87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5,
  92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4,
  97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4,
};

export function getRmdStartAge(birthYear: number): number {
  if (birthYear >= 1960) return 75;
  if (birthYear >= 1951) return 73;
  return 72;
}

export function getCurrentAge(birthYear: number): number {
  return new Date().getFullYear() - birthYear;
}

export interface ProjectionPoint {
  year: number;
  age: number;
  netWorth: number;
  withContributions: number;
  target: number;
}

export function projectNetWorth(
  currentNetWorth: number,
  annualGrowthRate: number,
  annualContribution: number,
  birthYear: number,
  retirementTarget: number,
  yearsOut: number,
  retirementAge?: number,
  annualSpending?: number,
): ProjectionPoint[] {
  const currentYear = new Date().getFullYear();
  const currentAge = getCurrentAge(birthYear);
  const points: ProjectionPoint[] = [];

  let nwGrowthOnly = currentNetWorth;
  let nwWithContrib = currentNetWorth;

  points.push({
    year: currentYear,
    age: currentAge,
    netWorth: Math.round(currentNetWorth),
    withContributions: Math.round(currentNetWorth),
    target: retirementTarget,
  });

  for (let i = 1; i <= yearsOut; i++) {
    const age = currentAge + i;
    const isRetired = retirementAge != null && age > retirementAge;
    const spending = isRetired ? (annualSpending ?? 0) : 0;
    const yearlyFlow = isRetired ? -spending : annualContribution;
    nwGrowthOnly = nwGrowthOnly * (1 + annualGrowthRate) - spending;
    nwWithContrib = nwWithContrib * (1 + annualGrowthRate) + yearlyFlow;
    points.push({
      year: currentYear + i,
      age,
      netWorth: Math.round(nwGrowthOnly),
      withContributions: Math.round(Math.max(0, nwWithContrib)),
      target: retirementTarget,
    });
  }

  return points;
}

export function yearsToTarget(
  currentNetWorth: number,
  annualGrowthRate: number,
  annualContribution: number,
  target: number,
): number | null {
  if (currentNetWorth >= target) return 0;
  let nw = currentNetWorth;
  for (let i = 1; i <= 100; i++) {
    nw = nw * (1 + annualGrowthRate) + annualContribution;
    if (nw >= target) return i;
  }
  return null;
}

export interface SensitivityRow {
  growthRate: number;
  yearsGrowthOnly: number | null;
  yearsWithContrib: number | null;
  balanceAt20Years: number;
}

export function sensitivityAnalysis(
  currentNetWorth: number,
  annualContribution: number,
  target: number,
  rates: number[] = [0.03, 0.05, 0.07, 0.09, 0.11],
): SensitivityRow[] {
  return rates.map(rate => {
    let bal20 = currentNetWorth;
    for (let i = 0; i < 20; i++) {
      bal20 = bal20 * (1 + rate) + annualContribution;
    }
    return {
      growthRate: rate,
      yearsGrowthOnly: yearsToTarget(currentNetWorth, rate, 0, target),
      yearsWithContrib: yearsToTarget(currentNetWorth, rate, annualContribution, target),
      balanceAt20Years: Math.round(bal20),
    };
  });
}

export interface RmdProjection {
  age: number;
  year: number;
  projectedBalance: number;
  rmdAmount: number;
  withdrawalRate: number;
}

export function projectRmds(
  currentTraditionalBalance: number,
  currentAge: number,
  birthYear: number,
  annualGrowthRate: number,
): RmdProjection[] {
  const rmdStartAge = getRmdStartAge(birthYear);
  const currentYear = new Date().getFullYear();
  const projections: RmdProjection[] = [];

  const yearsToRmd = Math.max(0, rmdStartAge - currentAge);
  let balance = currentTraditionalBalance * Math.pow(1 + annualGrowthRate, yearsToRmd);

  for (let age = rmdStartAge; age <= 95; age++) {
    const factor = RMD_TABLE[age];
    if (!factor) break;
    const year = currentYear + (age - currentAge);
    const rmd = balance / factor;
    projections.push({
      age,
      year,
      projectedBalance: Math.round(balance),
      rmdAmount: Math.round(rmd),
      withdrawalRate: Math.round((1 / factor) * 1000) / 10,
    });
    balance = (balance - rmd) * (1 + annualGrowthRate);
  }

  return projections;
}

export interface TaxBuckets {
  traditional: number;
  roth: number;
  taxable: number;
  hsa: number;
}

// 2025 tax brackets (approximate — for educational planning purposes only)
const BRACKETS: Record<FilingStatus, Array<{ rate: number; upTo: number }>> = {
  married_filing_jointly: [
    { rate: 0.10, upTo: 23850 },
    { rate: 0.12, upTo: 96950 },
    { rate: 0.22, upTo: 206700 },
    { rate: 0.24, upTo: 394600 },
    { rate: 0.32, upTo: 501050 },
    { rate: 0.35, upTo: 751600 },
    { rate: 0.37, upTo: Infinity },
  ],
  single: [
    { rate: 0.10, upTo: 11925 },
    { rate: 0.12, upTo: 48475 },
    { rate: 0.22, upTo: 103350 },
    { rate: 0.24, upTo: 197300 },
    { rate: 0.32, upTo: 250525 },
    { rate: 0.35, upTo: 626350 },
    { rate: 0.37, upTo: Infinity },
  ],
};

export interface BracketInfo {
  currentRate: number;
  nextRate: number | null;
  headroomInCurrentBracket: number;
  topOfCurrentBracket: number;
}

export function getBracketInfo(annualIncome: number, filingStatus: FilingStatus): BracketInfo {
  const brackets = BRACKETS[filingStatus];
  for (let i = 0; i < brackets.length; i++) {
    if (annualIncome <= brackets[i].upTo) {
      return {
        currentRate: brackets[i].rate,
        nextRate: brackets[i + 1]?.rate ?? null,
        headroomInCurrentBracket: Math.max(0, brackets[i].upTo - annualIncome),
        topOfCurrentBracket: brackets[i].upTo,
      };
    }
  }
  return {
    currentRate: 0.37,
    nextRate: null,
    headroomInCurrentBracket: 0,
    topOfCurrentBracket: Infinity,
  };
}

export function safeWithdrawalAmount(netWorth: number, rate: number = 0.04): number {
  return netWorth * rate;
}

// ── Roth Conversion Analysis ──────────────────────────────────────────────────

// 2025 standard deductions
const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  married_filing_jointly: 30000,
  single: 15000,
};

/** Compute total income tax owed on a given income level (2025 brackets + standard deduction). */
export function computeTax(income: number, filingStatus: FilingStatus): number {
  const taxableIncome = Math.max(0, income - STANDARD_DEDUCTION[filingStatus]);
  if (taxableIncome <= 0) return 0;
  const brackets = BRACKETS[filingStatus];
  let tax = 0;
  let prevCeiling = 0;
  for (const bracket of brackets) {
    if (taxableIncome <= prevCeiling) break;
    const ceiling = bracket.upTo === Infinity ? taxableIncome : Math.min(taxableIncome, bracket.upTo);
    const width = ceiling - prevCeiling;
    if (width <= 0) break;
    tax += width * bracket.rate;
    prevCeiling = bracket.upTo === Infinity ? taxableIncome : bracket.upTo;
    if (taxableIncome <= bracket.upTo) break;
  }
  return tax;
}

/** Effective marginal rate on the conversion dollars on top of base income. */
export function conversionMarginalRate(
  baseIncome: number,
  conversionAmount: number,
  filingStatus: FilingStatus,
): number {
  if (conversionAmount <= 0) return 0;
  const without = computeTax(baseIncome, filingStatus);
  const with_ = computeTax(baseIncome + conversionAmount, filingStatus);
  return (with_ - without) / conversionAmount;
}

export interface ScenarioYearRow {
  age: number;
  phase: 'conversion' | 'rmd';
  traditional: number;
  roth: number;
  taxable: number;
  conversionOrRmd: number;  // annual conversion or RMD amount
  taxPaid: number;
  spending: number;         // retirement spending drawn this year
}

export interface ConversionScenario {
  label: string;
  annualConversion: number;
  conversionTaxRate: number;       // effective rate on the conversion portion
  yearsConverting: number;
  totalConversionTax: number;      // nominal taxes paid during conversion years
  totalConversionTaxFV: number;   // FV of those taxes at RMD start (true opportunity cost)
  traditionalAtRmd: number;
  rothAtRmd: number;               // existing Roth + conversions, all grown to RMD age
  firstRmd: number;
  firstRmdEffectiveRate: number;   // effective rate (total tax / RMD)
  firstRmdMarginalRate: number;    // marginal rate on the last dollar of the RMD
  firstRmdTax: number;
  lifeRmdTaxPV: number;            // PV (at RMD start) of all lifetime RMD taxes — discounted at growth rate
  netSavings: number;              // lifetime RMD tax savings (PV) vs baseline minus FV opportunity cost of conversion taxes
  isBaseline: boolean;
  yearRows: ScenarioYearRow[];     // year-by-year trad/roth balances through full simulation
}

/**
 * For each conversion amount, simulate from today to RMD start:
 * - Subtract annual conversion from traditional, grow both balances
 * - At RMD age, compute first RMD and 10-year RMD tax burden
 * - Compare to no-conversion baseline
 */
export function analyzeRothConversions(
  currentTraditionalBalance: number,
  currentRothBalance: number,
  currentTaxableBalance: number,
  currentAge: number,
  birthYear: number,
  retirementAge: number,
  annualGrowthRate: number,
  annualIncome: number,   // retirement spending target ($/yr)
  filingStatus: FilingStatus,
): ConversionScenario[] {
  const rmdStartAge = getRmdStartAge(birthYear);
  const yearsToRmd = Math.max(0, rmdStartAge - currentAge);
  const rmdFactor = RMD_TABLE[rmdStartAge] ?? 26.5;

  // Build scenarios: $0 baseline + several conversion levels
  // Bracket headroom for conversion scenarios: conversions happen in retirement with $0 earned income
  const bracketInfo = getBracketInfo(annualIncome, filingStatus);  // used for display on Roth tab cards
  const retirementBracketInfo = getBracketInfo(0, filingStatus);
  const headroom = Math.round(retirementBracketInfo.headroomInCurrentBracket / 1000) * 1000;
  const scenarioAmounts: Array<{ amount: number; label: string }> = [
    { amount: 0, label: 'No conversion (baseline)' },
    { amount: 50_000, label: '$50k / year' },
    { amount: 100_000, label: '$100k / year' },
  ];
  if (headroom > 10_000 && headroom < 200_000 && ![50_000, 100_000].includes(headroom)) {
    scenarioAmounts.splice(
      scenarioAmounts.findIndex(s => s.amount >= headroom) === -1
        ? scenarioAmounts.length
        : scenarioAmounts.findIndex(s => s.amount >= headroom),
      0,
      { amount: headroom, label: `${fmt$(headroom)} / year (fill bracket)` },
    );
  }
  scenarioAmounts.push({ amount: 150_000, label: '$150k / year' });
  scenarioAmounts.push({ amount: 200_000, label: '$200k / year' });

  // Sort by amount
  scenarioAmounts.sort((a, b) => a.amount - b.amount);

  function simulate(annualConversion: number) {
    let trad = currentTraditionalBalance;
    let roth = currentRothBalance;
    let taxable = currentTaxableBalance;
    let totalConversionTax = 0;
    let totalConversionTaxFV = 0;
    const yearRows: ScenarioYearRow[] = [];

    for (let y = 0; y < yearsToRmd; y++) {
      const age = currentAge + y;
      const isRetired = age >= retirementAge;

      // --- Grow all balances first (start of year growth) ---
      trad *= (1 + annualGrowthRate);
      roth *= (1 + annualGrowthRate);
      taxable *= (1 + annualGrowthRate);

      // --- Roth conversion (only after retirement — no earned income during conversions) ---
      const actual = isRetired ? Math.min(annualConversion, trad) : 0;
      const taxOnConversion = actual > 0 ? computeTax(actual, filingStatus) : 0;
      totalConversionTax += taxOnConversion;
      const yearsRemaining = yearsToRmd - y;
      totalConversionTaxFV += taxOnConversion * Math.pow(1 + annualGrowthRate, yearsRemaining);
      trad -= actual;
      roth += actual - taxOnConversion;

      // --- Retirement spending draw (taxable → Roth → traditional) ---
      let spending = 0;
      if (isRetired) {
        spending = annualIncome;
        const fromTaxable = Math.min(spending, taxable);
        taxable -= fromTaxable;
        spending -= fromTaxable;
        const fromRoth = Math.min(spending, roth);
        roth -= fromRoth;
        spending -= fromRoth;
        const fromTrad = Math.min(spending, trad);
        trad -= fromTrad;
        spending -= fromTrad;
        spending = annualIncome - spending; // actual spent (may be less if funds run out)
      }

      yearRows.push({
        age: age + 1,
        phase: 'conversion',
        traditional: trad,
        roth,
        taxable,
        conversionOrRmd: actual,
        taxPaid: taxOnConversion,
        spending,
      });
    }

    // Lifetime RMD simulation — runs through all available IRS table entries (up to age 100)
    // The RMD is total retirement income. Tax is on the full RMD.
    // Each year's RMD tax is discounted back to RMD start age (PV) so it's
    // comparable to totalConversionTaxFV which is also valued at RMD start.
    let tradRmd = trad;
    let rothRmd = roth;
    let taxableRmd = taxable;
    let lifeRmdTaxPV = 0;
    let firstRmd = 0;
    let firstRmdTax = 0;
    let firstRmdRate = 0;
    let firstRmdMarginalRateVal = 0;
    for (let i = 0; ; i++) {
      const age = rmdStartAge + i;
      if (age > 95) break;
      const factor = RMD_TABLE[age];
      if (!factor) break;
      const rmd = tradRmd / factor;
      const tax = computeTax(rmd, filingStatus);
      lifeRmdTaxPV += tax / Math.pow(1 + annualGrowthRate, i);
      if (i === 0) {
        firstRmd = rmd;
        firstRmdTax = tax;
        firstRmdRate = rmd > 0 ? tax / rmd : 0;
        firstRmdMarginalRateVal = computeTax(rmd + 1, filingStatus) - tax;
      }
      // After-tax RMD: spend annualIncome, reinvest surplus into taxable
      const afterTaxRmd = rmd - tax;
      const surplus = Math.max(0, afterTaxRmd - annualIncome);
      tradRmd = (tradRmd - rmd) * (1 + annualGrowthRate);
      rothRmd = rothRmd * (1 + annualGrowthRate);
      taxableRmd = (taxableRmd + surplus) * (1 + annualGrowthRate);
      yearRows.push({ age: age + 1, phase: 'rmd', traditional: tradRmd, roth: rothRmd, taxable: taxableRmd, conversionOrRmd: rmd, taxPaid: tax, spending: annualIncome });
    }

    return { trad, roth, taxable, totalConversionTax, totalConversionTaxFV, firstRmd, firstRmdTax, firstRmdRate, firstRmdMarginalRate: firstRmdMarginalRateVal, lifeRmdTaxPV, yearRows };
  }

  const baseline = simulate(0);

  return scenarioAmounts.map(({ amount, label }) => {
    const r = simulate(amount);
    // Conversion tax rate display: conversions happen in retirement with no earned income
    const convRate = amount > 0 ? computeTax(amount, filingStatus) / amount : 0;
    return {
      label,
      annualConversion: amount,
      conversionTaxRate: convRate,
      yearsConverting: yearsToRmd,
      totalConversionTax: r.totalConversionTax,
      totalConversionTaxFV: r.totalConversionTaxFV,
      traditionalAtRmd: r.trad,
      rothAtRmd: r.roth,
      firstRmd: r.firstRmd,
      firstRmdEffectiveRate: r.firstRmdRate,
      firstRmdMarginalRate: r.firstRmdMarginalRate,
      firstRmdTax: r.firstRmdTax,
      lifeRmdTaxPV: r.lifeRmdTaxPV,
      netSavings: (baseline.lifeRmdTaxPV - r.lifeRmdTaxPV) - r.totalConversionTaxFV,
      isBaseline: amount === 0,
      yearRows: r.yearRows,
    };
  });
}

/** Simple currency formatter used inside the service for label generation only. */
function fmt$(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
