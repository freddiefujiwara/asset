import { describe, it, expect } from "vitest";
import { runMonteCarloSimulation } from "./fire";

describe("Monte Carlo Simulation", () => {
  const baseParams = {
    initialAssets: 10000000,
    riskAssets: 5000000,
    annualReturnRate: 0.05,
    monthlyExpense: 200000,
    monthlyIncome: 300000,
    currentAge: 40,
    withdrawalRate: 0.04,
    retirementLumpSumAtFire: 5000000,
  };

  it("produces different results for P10, P50, and P90 when risk assets > 0", () => {
    const result = runMonteCarloSimulation(baseParams, {
      trials: 100,
      annualVolatility: 0.2,
      seed: 42
    });

    expect(result.p10).toBeLessThan(result.p50);
    expect(result.p50).toBeLessThan(result.p90);
    expect(result.p10Path[result.p10Path.length - 1]).toBeLessThan(result.p90Path[result.p90Path.length - 1]);
  });

  it("produces identical results for P10, P50, and P90 when risk assets = 0", () => {
    const paramsNoRisk = { ...baseParams, riskAssets: 0 };
    const result = runMonteCarloSimulation(paramsNoRisk, {
      trials: 10,
      annualVolatility: 0.2,
      seed: 42
    });

    expect(result.p10).toBe(result.p50);
    expect(result.p50).toBe(result.p90);
  });

  it("is reproducible with the same seed", () => {
    const result1 = runMonteCarloSimulation(baseParams, {
      trials: 50,
      annualVolatility: 0.15,
      seed: 123
    });
    const result2 = runMonteCarloSimulation(baseParams, {
      trials: 50,
      annualVolatility: 0.15,
      seed: 123
    });

    expect(result1.p50).toBe(result2.p50);
    expect(result1.successRate).toBe(result2.successRate);
  });

  it("produces different results with different seeds", () => {
    const result1 = runMonteCarloSimulation(baseParams, {
      trials: 50,
      annualVolatility: 0.15,
      seed: 123
    });
    const result2 = runMonteCarloSimulation(baseParams, {
      trials: 50,
      annualVolatility: 0.15,
      seed: 456
    });

    expect(result1.p50).not.toBe(result2.p50);
  });
});
