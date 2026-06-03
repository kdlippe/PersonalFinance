'use client';

import { useEffect, useState, useMemo } from 'react';
import { Account } from '@/lib/types';
import {
  PlanningSettings,
  TaxType,
  FilingStatus,
  DEFAULT_SETTINGS,
  getCurrentAge,
  getRmdStartAge,
  projectNetWorth,
  yearsToTarget,
  sensitivityAnalysis,
  projectRmds,
  getBracketInfo,
  safeWithdrawalAmount,
  TaxBuckets,
  analyzeRothConversions,
  computeTax,
  ConversionScenario,
  ScenarioYearRow,
} from '@/lib/planningService';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
} from 'recharts';
import {
  Target,
  TrendingUp,
  Settings,
  AlertCircle,
  CheckCircle,
  Info,
  Calculator,
  ShieldCheck,
  Landmark,
  ArrowRight,
  X,
} from 'lucide-react';

type PlanningTab = 'overview' | 'rmd' | 'roth' | 'settings';
type DetailScenario = ConversionScenario | null;

const fmt = (n: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtCompact = (n: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n);

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

function guessAccountTaxType(account: Account): TaxType {
  const name = account.name.toLowerCase();
  if (name.includes('roth')) return 'roth';
  if (name.includes('hsa')) return 'hsa';
  if (account.type === 'retirement') return 'traditional';
  if (account.type === 'brokerage' || account.type === 'investment' || account.type === 'crypto') return 'taxable';
  return 'exclude';
}

const TAX_TYPE_LABELS: Record<TaxType, string> = {
  traditional: 'Pre-Tax (Traditional IRA / 401k)',
  roth: 'Tax-Free (Roth)',
  taxable: 'Taxable Brokerage',
  hsa: 'HSA',
  exclude: 'Exclude from Planning',
};

const TAX_TYPE_COLORS: Record<TaxType, string> = {
  traditional: '#3b82f6',
  roth: '#10b981',
  taxable: '#f59e0b',
  hsa: '#8b5cf6',
  exclude: '#9ca3af',
};

export default function PlanningPage() {
  const [activeTab, setActiveTab] = useState<PlanningTab>('overview');
  const [detailScenario, setDetailScenario] = useState<DetailScenario>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [settings, setSettings] = useState<PlanningSettings>(DEFAULT_SETTINGS);
  const [draftSettings, setDraftSettings] = useState<PlanningSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [accountsRes, settingsRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/planning/settings'),
      ]);
      const accountsData: Account[] = await accountsRes.json();
      const settingsData: PlanningSettings = await settingsRes.json();

      // Fill in any missing account tax type guesses
      const merged = { ...settingsData };
      accountsData.forEach(acc => {
        const key = acc.id.toString();
        if (!merged.accountTaxTypes[key]) {
          merged.accountTaxTypes[key] = guessAccountTaxType(acc);
        }
      });

      setAccounts(accountsData);
      setSettings(merged);
      setDraftSettings(merged);
    } catch (err) {
      console.error('Failed to load planning data', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/planning/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftSettings),
      });
      if (res.ok) {
        const saved = await res.json();
        setSettings(saved);
        setDraftSettings(saved);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────────

  const currentNetWorth = useMemo(
    () => accounts.reduce((sum, acc) => sum + acc.balance, 0),
    [accounts],
  );

  const taxBuckets = useMemo<TaxBuckets>(() => {
    const b = { traditional: 0, roth: 0, taxable: 0, hsa: 0 };
    accounts.forEach(acc => {
      if (acc.balance <= 0) return;
      const type = settings.accountTaxTypes[acc.id.toString()] ?? 'exclude';
      if (type !== 'exclude') b[type] += acc.balance;
    });
    return b;
  }, [accounts, settings.accountTaxTypes]);

  const currentAge = useMemo(() => getCurrentAge(settings.birthYear), [settings.birthYear]);
  const rmdStartAge = useMemo(() => getRmdStartAge(settings.birthYear), [settings.birthYear]);
  const yearsUntilRmd = Math.max(0, rmdStartAge - currentAge);
  const retirementYear = settings.birthYear + settings.retirementAge;
  const yearsToRetirement = Math.max(0, retirementYear - new Date().getFullYear());

  const projectionData = useMemo(
    () =>
      projectNetWorth(
        currentNetWorth,
        settings.annualGrowthRate,
        settings.annualContribution,
        settings.birthYear,
        settings.retirementTarget,
        Math.min(50, Math.max(yearsToRetirement + 10, 20)),
        settings.retirementAge,
        settings.annualIncome,
      ),
    [currentNetWorth, settings, yearsToRetirement],
  );

  const chartData = useMemo(
    () => projectionData.filter((_, i) => i % 2 === 0 || i === 0),
    [projectionData],
  );

  const sensData = useMemo(
    () => sensitivityAnalysis(currentNetWorth, settings.annualContribution, settings.retirementTarget),
    [currentNetWorth, settings.annualContribution, settings.retirementTarget],
  );

  const rmdProjections = useMemo(
    () => projectRmds(taxBuckets.traditional, currentAge, settings.birthYear, settings.annualGrowthRate),
    [taxBuckets.traditional, currentAge, settings.birthYear, settings.annualGrowthRate],
  );

  const bracketInfo = useMemo(
    () => getBracketInfo(settings.annualIncome, settings.taxFilingStatus),
    [settings.annualIncome, settings.taxFilingStatus],
  );

  const conversionScenarios = useMemo(
    () =>
      taxBuckets.traditional > 0
        ? analyzeRothConversions(
            taxBuckets.traditional,
            taxBuckets.roth,
            taxBuckets.taxable,
            currentAge,
            settings.birthYear,
            settings.retirementAge,
            settings.annualGrowthRate,
            settings.annualIncome,
            settings.taxFilingStatus,
          )
        : [],
    [taxBuckets.traditional, taxBuckets.roth, currentAge, settings],
  );

  const progressPct = Math.min(100, (currentNetWorth / settings.retirementTarget) * 100);
  const yearsToGoal = yearsToTarget(
    currentNetWorth,
    settings.annualGrowthRate,
    settings.annualContribution,
    settings.retirementTarget,
  );
  const swrIncome = safeWithdrawalAmount(currentNetWorth);
  const taxBucketTotal = taxBuckets.traditional + taxBuckets.roth + taxBuckets.taxable + taxBuckets.hsa;

  const tabClass = (tab: PlanningTab) =>
    `py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
      activeTab === tab
        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
    }`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Target className="text-blue-600 dark:text-blue-400" size={32} />
          Financial Planning
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Retirement projections, RMD planning, and Roth conversion strategy
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
          <Info size={12} /> Educational projections only — not financial advice. Consult a financial advisor for personalized guidance.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Current Net Worth</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmtCompact(currentNetWorth)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">All accounts</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Retirement Target</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmtCompact(settings.retirementTarget)}</p>
          <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
            <div
              className="h-2 rounded-full bg-blue-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{progressPct.toFixed(1)}% of goal</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Years to Target</p>
          {yearsToGoal === 0 ? (
            <div className="flex items-center gap-2 mt-1">
              <CheckCircle className="text-green-500" size={24} />
              <span className="text-xl font-bold text-green-600 dark:text-green-400">Already there!</span>
            </div>
          ) : yearsToGoal === null ? (
            <p className="text-2xl font-bold text-red-500">Not on track</p>
          ) : (
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{yearsToGoal} yrs</p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">At {pct(settings.annualGrowthRate)} + {fmtCompact(settings.annualContribution)}/yr</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">4% SWR Income</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmtCompact(swrIncome)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Annual safe withdrawal today</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button onClick={() => setActiveTab('overview')} className={tabClass('overview')}>
            <TrendingUp size={16} /> Overview
          </button>
          <button onClick={() => setActiveTab('rmd')} className={tabClass('rmd')}>
            <Calculator size={16} /> RMD Planning
          </button>
          <button onClick={() => setActiveTab('roth')} className={tabClass('roth')}>
            <ShieldCheck size={16} /> Roth Strategy
          </button>
          <button onClick={() => setActiveTab('settings')} className={tabClass('settings')}>
            <Settings size={16} /> Settings
          </button>
        </nav>
      </div>

      {/* ── Overview Tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Projection Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Net Worth Projection</h2>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#6b7280" opacity={0.3} />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={v => fmtCompact(v)}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [fmt(value), name]}
                  labelFormatter={label => `Year ${label} (Age ${chartData.find(p => p.year === label)?.age ?? ''})`}
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                  labelStyle={{ color: '#f9fafb' }}
                  itemStyle={{ color: '#d1d5db' }}
                />
                <Legend />
                <ReferenceLine
                  y={settings.retirementTarget}
                  stroke="#ef4444"
                  strokeDasharray="6 3"
                  label={{ value: 'Target', position: 'right', fill: '#ef4444', fontSize: 11 }}
                />
                <Line
                  type="monotone"
                  dataKey="netWorth"
                  name="Growth Only"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="withContributions"
                  name={`Growth + ${fmtCompact(settings.annualContribution)}/yr`}
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Sensitivity Analysis */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Sensitivity Analysis</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Years to reach {fmt(settings.retirementTarget)} target at different growth rates
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 pr-6">Growth Rate</th>
                    <th className="pb-2 pr-6">Years (growth only)</th>
                    <th className="pb-2 pr-6">Years (+ contributions)</th>
                    <th className="pb-2">Balance in 20 years</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {sensData.map(row => {
                    const isSelected = Math.abs(row.growthRate - settings.annualGrowthRate) < 0.001;
                    return (
                      <tr
                        key={row.growthRate}
                        className={`transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                      >
                        <td className="py-2 pr-6 font-medium text-gray-900 dark:text-white">
                          {pct(row.growthRate)}
                          {isSelected && (
                            <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded">
                              current
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-6 text-gray-700 dark:text-gray-300">
                          {row.yearsGrowthOnly === 0
                            ? '✓ Now'
                            : row.yearsGrowthOnly === null
                            ? '—'
                            : `${row.yearsGrowthOnly} yrs`}
                        </td>
                        <td className="py-2 pr-6 text-gray-700 dark:text-gray-300">
                          {row.yearsWithContrib === 0
                            ? '✓ Now'
                            : row.yearsWithContrib === null
                            ? '—'
                            : `${row.yearsWithContrib} yrs`}
                        </td>
                        <td className="py-2 text-gray-700 dark:text-gray-300">{fmt(row.balanceAt20Years)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Retirement Year</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{retirementYear}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Age {settings.retirementAge} · {yearsToRetirement} years away</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Projected NW at Retirement</p>
              {(() => {
                const pt = projectionData.find(p => p.year === retirementYear);
                return (
                  <>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {pt ? fmtCompact(pt.withContributions) : '—'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      At {pct(settings.annualGrowthRate)} with contributions
                    </p>
                  </>
                );
              })()}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Annual Contributions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(settings.annualContribution)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Configured estimate</p>
            </div>
          </div>
        </div>
      )}

      {/* ── RMD Planning Tab ───────────────────────────────────────────────────── */}
      {activeTab === 'rmd' && (
        <div className="space-y-6">
          {/* RMD Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">RMD Start Age</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{rmdStartAge}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {settings.birthYear >= 1960 ? 'SECURE 2.0 (born ≥1960)' : 'SECURE 2.0 (born 1951–1959)'}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">RMD Start Year</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {new Date().getFullYear() + yearsUntilRmd}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{yearsUntilRmd} years from now</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Traditional Balance Today</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmtCompact(taxBuckets.traditional)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Pre-tax accounts</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">First Year RMD (est.)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {rmdProjections.length > 0 ? fmtCompact(rmdProjections[0].rmdAmount) : '—'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Projected balance: {rmdProjections.length > 0 ? fmtCompact(rmdProjections[0].projectedBalance) : '—'}
              </p>
            </div>
          </div>

          {/* RMD Chart */}
          {rmdProjections.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Projected Annual RMDs by Age
              </h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={rmdProjections.slice(0, 20)} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#6b7280" opacity={0.3} />
                  <XAxis dataKey="age" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} label={{ value: 'Age', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis tickFormatter={v => fmtCompact(v)} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value: number) => [fmt(value), 'RMD']}
                    labelFormatter={label => `Age ${label}`}
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                    labelStyle={{ color: '#f9fafb' }}
                    itemStyle={{ color: '#d1d5db' }}
                    cursor={{ fill: 'rgba(107, 114, 128, 0.15)' }}
                  />
                  <Bar dataKey="rmdAmount" name="Required Minimum Distribution" fill="#3b82f6" radius={[4, 4, 0, 0]} activeBar={{ fill: '#2563eb', radius: 4 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* RMD Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Year-by-Year RMD Schedule</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 pr-4">Age</th>
                    <th className="pb-2 pr-4">Year</th>
                    <th className="pb-2 pr-4">Pre-Tax Balance (projected)</th>
                    <th className="pb-2 pr-4">RMD Amount</th>
                    <th className="pb-2">Withdrawal %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {rmdProjections.slice(0, 20).map(row => (
                    <tr key={row.age} className="text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="py-2 pr-4 font-medium">{row.age}</td>
                      <td className="py-2 pr-4">{row.year}</td>
                      <td className="py-2 pr-4">{fmt(row.projectedBalance)}</td>
                      <td className="py-2 pr-4 font-medium text-blue-600 dark:text-blue-400">{fmt(row.rmdAmount)}</td>
                      <td className="py-2 text-gray-500 dark:text-gray-400">{row.withdrawalRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
              Based on IRS Uniform Lifetime Table (SECURE 2.0). Assumes pre-tax accounts grow at {pct(settings.annualGrowthRate)}/yr. Does not include spouse accounts in RMD calculation.
            </p>
          </div>
        </div>
      )}

      {/* ── Roth Strategy Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'roth' && (
        <div className="space-y-6">
          {/* Tax Bucket Breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tax Bucket Allocation</h2>
            <div className="space-y-3">
              {(
                [
                  { key: 'traditional', label: 'Pre-Tax (Traditional IRA / 401k)', color: 'bg-blue-500' },
                  { key: 'roth', label: 'Tax-Free (Roth)', color: 'bg-emerald-500' },
                  { key: 'taxable', label: 'Taxable Brokerage', color: 'bg-amber-500' },
                  { key: 'hsa', label: 'HSA', color: 'bg-purple-500' },
                ] as const
              ).map(({ key, label, color }) => {
                const val = taxBuckets[key];
                const bucketPct = taxBucketTotal > 0 ? (val / taxBucketTotal) * 100 : 0;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 dark:text-gray-300 font-medium">{label}</span>
                      <span className="text-gray-900 dark:text-white font-semibold">
                        {fmt(val)} <span className="text-gray-400 font-normal">({bucketPct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full">
                      <div className={`h-3 rounded-full ${color}`} style={{ width: `${bucketPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Total classified</span>
              <span className="font-semibold text-gray-900 dark:text-white">{fmt(taxBucketTotal)}</span>
            </div>
          </div>

          {/* Roth Conversion Opportunity */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <ArrowRight size={18} className="text-emerald-500" />
              Roth Conversion Opportunity
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Converting pre-tax funds to Roth before RMDs begin can reduce future forced withdrawals and long-term tax burden.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <p className="text-sm text-gray-500 dark:text-gray-400">Current Tax Bracket</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{pct(bracketInfo.currentRate)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {settings.taxFilingStatus === 'married_filing_jointly' ? 'Married Filing Jointly' : 'Single'}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <p className="text-sm text-gray-500 dark:text-gray-400">Headroom in Current Bracket</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {bracketInfo.headroomInCurrentBracket > 0 ? fmt(bracketInfo.headroomInCurrentBracket) : 'None'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {bracketInfo.headroomInCurrentBracket > 0
                    ? `Before hitting ${bracketInfo.nextRate ? pct(bracketInfo.nextRate) : 'top'} bracket`
                    : 'Already at top of bracket'}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <p className="text-sm text-gray-500 dark:text-gray-400">Est. Tax on Max Conversion</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {bracketInfo.headroomInCurrentBracket > 0
                    ? fmt(bracketInfo.headroomInCurrentBracket * bracketInfo.currentRate)
                    : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-1">At {pct(bracketInfo.currentRate)} rate</p>
              </div>
            </div>

            {taxBuckets.traditional > 0 && yearsUntilRmd > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-300 mb-1">
                      You have {yearsUntilRmd} years before RMDs begin
                    </p>
                    <p className="text-amber-700 dark:text-amber-400">
                      Your pre-tax balance of {fmt(taxBuckets.traditional)} is projected to be{' '}
                      <strong>{rmdProjections.length > 0 ? fmt(rmdProjections[0].projectedBalance) : '—'}</strong>{' '}
                      at age {rmdStartAge}, resulting in a first-year RMD of{' '}
                      <strong>{rmdProjections.length > 0 ? fmt(rmdProjections[0].rmdAmount) : '—'}</strong>.
                      This mandatory income could push you into a higher bracket. Roth conversions during lower-income years
                      (sabbaticals, early retirement, etc.) can reduce this exposure.
                    </p>
                  </div>
                </div>
              </div>
            )}


          </div>

          {/* Roth Conversion Comparison Table */}
          {conversionScenarios.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Convert Now vs. Wait for RMDs
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                Compares converting pre-tax money to Roth each year from now until age {rmdStartAge} (RMD start) at your{' '}
                <strong>current tax rate</strong>, versus doing nothing and paying taxes on forced RMDs in retirement.
                <strong> Tax opportunity cost</strong> compounds each year&apos;s tax bill to age {rmdStartAge} — reflecting what those dollars would have grown to if not paid.
                RMD tax assumes the RMD is your only income in retirement. All figures nominal (not inflation-adjusted).
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="pb-3 pr-4 font-medium">Scenario</th>
                      <th className="pb-3 pr-4 font-medium text-right">Conversion<br/>Tax Rate</th>
                      <th className="pb-3 pr-4 font-medium text-right">Tax Opportunity<br/>Cost (FV)</th>
                      <th className="pb-3 pr-4 font-medium text-right">Trad. at<br/>Age {rmdStartAge}</th>
                      <th className="pb-3 pr-4 font-medium text-right">Roth at<br/>Age {rmdStartAge}</th>
                      <th className="pb-3 pr-4 font-medium text-right">First<br/>RMD</th>
                      <th className="pb-3 pr-4 font-medium text-right">RMD Tax<br/><span className="font-normal text-xs">(eff / marg)</span></th>
                      <th className="pb-3 font-medium text-right">Lifetime RMD<br/>Tax (PV)</th>
                      <th className="pb-3 pl-4 font-medium text-right">Net Savings<br/>vs Baseline</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                    {conversionScenarios.map((s) => {
                      const isPositive = s.netSavings > 0;
                      return (
                        <tr
                          key={s.annualConversion}
                          onClick={() => setDetailScenario(s)}
                          className={`transition-colors cursor-pointer ${
                            s.isBaseline
                              ? 'bg-gray-50 dark:bg-gray-700/30 font-medium'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <td className="py-3 pr-4 text-gray-900 dark:text-white whitespace-nowrap">{s.label}</td>
                          <td className="py-3 pr-4 text-right text-gray-700 dark:text-gray-300">
                            {s.annualConversion === 0 ? '—' : pct(s.conversionTaxRate)}
                          </td>
                          <td className="py-3 pr-4 text-right text-gray-700 dark:text-gray-300">
                            {s.totalConversionTaxFV === 0 ? '—' : fmt(s.totalConversionTaxFV)}
                          </td>
                          <td className="py-3 pr-4 text-right text-gray-700 dark:text-gray-300">
                            {fmtCompact(s.traditionalAtRmd)}
                          </td>
                          <td className="py-3 pr-4 text-right text-gray-700 dark:text-gray-300">
                            {fmtCompact(s.rothAtRmd)}
                          </td>
                          <td className="py-3 pr-4 text-right font-medium text-blue-600 dark:text-blue-400">
                            {fmt(s.firstRmd)}
                          </td>
                          <td className="py-3 pr-4 text-right text-gray-700 dark:text-gray-300">
                            <span>{pct(s.firstRmdEffectiveRate)}</span>
                            <span className="text-gray-400 dark:text-gray-500"> / {pct(s.firstRmdMarginalRate)}</span>
                          </td>
                          <td className="py-3 text-right text-gray-700 dark:text-gray-300">
                            {fmt(s.lifeRmdTaxPV)}
                          </td>
                          <td className="py-3 pl-4 text-right font-semibold">
                            {s.isBaseline ? (
                              <span className="text-gray-400 dark:text-gray-500">baseline</span>
                            ) : (
                              <span className={isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}>
                                {isPositive ? '+' : ''}{fmt(s.netSavings)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-start gap-1.5">
                  <Info size={12} className="mt-0.5 flex-shrink-0" />
                  <span><strong>Net Savings</strong> = lifetime RMD tax saved vs baseline (PV at age {rmdStartAge}, discounted at your growth rate through age 100) minus the <em>future value</em> of all conversion taxes paid (compounded to age {rmdStartAge}). Both are valued at the same point in time. Positive means converting wins after accounting for the full compounding cost.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <Info size={12} className="mt-0.5 flex-shrink-0" />
                  <span><strong>RMD tax rate (eff / marg)</strong>: Tax is computed on the full RMD as total income. Effective = total tax ÷ RMD. Marginal = rate on the last dollar. Your annual income setting is your estimated spending — if your RMD exceeds it, the surplus is saved/reinvested.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Settings Tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {saveSuccess && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2 text-green-700 dark:text-green-300 text-sm">
              <CheckCircle size={16} /> Settings saved successfully.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personal */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Personal Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Birth Year</label>
                  <input
                    type="number"
                    min={1930}
                    max={2010}
                    value={draftSettings.birthYear}
                    onChange={e => setDraftSettings(s => ({ ...s, birthYear: parseInt(e.target.value) || s.birthYear }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Current age: {getCurrentAge(draftSettings.birthYear)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Retirement Age</label>
                  <input
                    type="number"
                    min={50}
                    max={80}
                    value={draftSettings.retirementAge}
                    onChange={e => setDraftSettings(s => ({ ...s, retirementAge: parseInt(e.target.value) || s.retirementAge }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Retirement year: {draftSettings.birthYear + draftSettings.retirementAge}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tax Filing Status</label>
                  <select
                    value={draftSettings.taxFilingStatus}
                    onChange={e => setDraftSettings(s => ({ ...s, taxFilingStatus: e.target.value as FilingStatus }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="married_filing_jointly">Married Filing Jointly</option>
                    <option value="single">Single</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Financial Goals */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Financial Goals</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Retirement Target ($)</label>
                  <input
                    type="number"
                    min={100000}
                    step={100000}
                    value={draftSettings.retirementTarget}
                    onChange={e => setDraftSettings(s => ({ ...s, retirementTarget: parseFloat(e.target.value) || s.retirementTarget }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Annual Growth Rate (%) — e.g. 7 for 7%
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={0.5}
                    value={(draftSettings.annualGrowthRate * 100).toFixed(1)}
                    onChange={e => setDraftSettings(s => ({ ...s, annualGrowthRate: parseFloat(e.target.value) / 100 || s.annualGrowthRate }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Annual Contribution ($)</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={draftSettings.annualContribution}
                    onChange={e => setDraftSettings(s => ({ ...s, annualContribution: parseFloat(e.target.value) || 0 }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Total household new savings per year</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estimated Annual Income ($)</label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={draftSettings.annualIncome}
                    onChange={e => setDraftSettings(s => ({ ...s, annualIncome: parseFloat(e.target.value) || 0 }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Used for Roth conversion bracket headroom calculations. Your RMD is modeled as total retirement income — spending comes out of it.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Account Tax Classifications */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Account Tax Classifications</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Classify each account to enable accurate tax bucket breakdowns and Roth strategy calculations.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 pr-4">Account</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4">Balance</th>
                    <th className="pb-2">Tax Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {accounts
                    .filter(acc => acc.type !== 'credit_card' && acc.type !== 'loan')
                    .map(acc => {
                      const key = acc.id.toString();
                      const current = draftSettings.accountTaxTypes[key] ?? 'exclude';
                      return (
                        <tr key={acc.id} className="text-gray-700 dark:text-gray-300">
                          <td className="py-2 pr-4 font-medium">{acc.name}</td>
                          <td className="py-2 pr-4 capitalize text-gray-500 dark:text-gray-400">{acc.type.replace('_', ' ')}</td>
                          <td className="py-2 pr-4">{fmt(acc.balance)}</td>
                          <td className="py-2">
                            <select
                              value={current}
                              onChange={e =>
                                setDraftSettings(s => ({
                                  ...s,
                                  accountTaxTypes: { ...s.accountTaxTypes, [key]: e.target.value as TaxType },
                                }))
                              }
                              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {(Object.entries(TAX_TYPE_LABELS) as [TaxType, string][]).map(([val, label]) => (
                                <option key={val} value={val}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}

      {/* ── Year-by-Year Detail Modal ───────────────────────────────────────── */}
      {detailScenario && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setDetailScenario(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">{detailScenario.label}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Year-by-year balances — end of year, after growth and spending. Tax Paid = conversion or RMD income tax only; capital gains on taxable draws not modeled.</p>
              </div>
              <button
                onClick={() => setDetailScenario(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            {/* Table */}
            <div className="overflow-auto flex-1 px-6 py-4">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-gray-800">
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 pr-4 font-medium">Age</th>
                    <th className="pb-2 pr-4 font-medium">Phase</th>
                    <th className="pb-2 pr-4 font-medium text-right">Traditional</th>
                    <th className="pb-2 pr-4 font-medium text-right">Roth</th>
                    <th className="pb-2 pr-4 font-medium text-right">Taxable</th>
                    <th className="pb-2 pr-4 font-medium text-right">Combined</th>
                    <th className="pb-2 pr-4 font-medium text-right">Conv / RMD</th>
                    <th className="pb-2 pr-4 font-medium text-right">Spending</th>
                    <th className="pb-2 font-medium text-right">Tax Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {detailScenario.yearRows.map((row: ScenarioYearRow) => (
                    <tr
                      key={`${row.phase}-${row.age}`}
                      className={row.phase === 'rmd'
                        ? 'bg-blue-50/50 dark:bg-blue-900/10'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'}
                    >
                      <td className="py-2 pr-4 font-medium text-gray-900 dark:text-white">{row.age}</td>
                      <td className="py-2 pr-4">
                        {row.phase === 'rmd'
                          ? <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">RMD</span>
                          : <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">Convert</span>
                        }
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-700 dark:text-gray-300">{fmtCompact(row.traditional)}</td>
                      <td className="py-2 pr-4 text-right text-gray-700 dark:text-gray-300">{fmtCompact(row.roth)}</td>
                      <td className="py-2 pr-4 text-right text-gray-700 dark:text-gray-300">{fmtCompact(row.taxable)}</td>
                      <td className="py-2 pr-4 text-right font-medium text-gray-900 dark:text-white">{fmtCompact(row.traditional + row.roth + row.taxable)}</td>
                      <td className="py-2 pr-4 text-right text-gray-500 dark:text-gray-400">{row.conversionOrRmd > 0 ? fmtCompact(row.conversionOrRmd) : '—'}</td>
                      <td className="py-2 pr-4 text-right text-gray-500 dark:text-gray-400">{row.spending > 0 ? fmtCompact(row.spending) : '—'}</td>
                      <td className="py-2 text-right text-red-600 dark:text-red-400">{row.taxPaid > 0 ? fmt(row.taxPaid) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-semibold text-gray-900 dark:text-white">
                    <td className="pt-3 pr-4" colSpan={2}>Total</td>
                    <td className="pt-3 pr-4" colSpan={4} />
                    <td className="pt-3 pr-4 text-right text-gray-500 dark:text-gray-400">
                      {fmtCompact(detailScenario.yearRows.reduce((s, r) => s + r.conversionOrRmd, 0))}
                    </td>
                    <td className="pt-3 pr-4 text-right text-gray-500 dark:text-gray-400">
                      {fmtCompact(detailScenario.yearRows.reduce((s, r) => s + r.spending, 0))}
                    </td>
                    <td className="pt-3 text-right text-red-600 dark:text-red-400">
                      {fmt(detailScenario.yearRows.reduce((s, r) => s + r.taxPaid, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
