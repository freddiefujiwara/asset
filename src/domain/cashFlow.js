const UNCATEGORIZED = "未分類";
const CATEGORY_DELIMITER = "/";

const CONFIG = {
  FIXED: [
    "住宅/ローン返済",
    "住宅/管理費",
    "水道・光熱費",
    "教養・教育/学費",
    "保険/",
    "通信費/",
  ],
  EXCLUDE: ["カード引き落とし", "ATM引き出し", "電子マネー", "使途不明金"],
};

/**
 * カテゴリ文字列から分類を返す (fixed | variable | exclude)
 * @param {string} category
 */
export const getExpenseType = (category) => {
  if (CONFIG.EXCLUDE.some((k) => category.includes(k))) return "exclude";
  if (CONFIG.FIXED.some((k) => category.includes(k))) return "fixed";
  return "variable"; // それ以外はすべて変動費
};

function getCategoryLabel(item) {
  return item.category || UNCATEGORIZED;
}

function getCategoryParts(item) {
  const [large = UNCATEGORIZED, small = ""] = getCategoryLabel(item).split(CATEGORY_DELIMITER);
  return { large, small };
}

function getMonthKey(item) {
  const month = item.date?.substring(0, 7) || "";
  return month.length === 7 ? month : "";
}

export function filterCashFlow(
  cashFlow,
  { month, category, largeCategory, smallCategory, includeTransfers, search, type } = {},
) {
  const normalizedSearch = search?.toLowerCase();

  return cashFlow.filter((item) => {
    const categoryLabel = getCategoryLabel(item);

    if (month && !item.date?.startsWith(month)) {
      return false;
    }

    if (type && getExpenseType(categoryLabel) !== type) {
      return false;
    }

    // Backward compatibility or exact match
    if (category && categoryLabel !== category) {
      return false;
    }

    // New large/small category filter
    if (largeCategory) {
      const { large, small } = getCategoryParts(item);
      if (large !== largeCategory) {
        return false;
      }
      if (smallCategory && small !== smallCategory) {
        return false;
      }
    }

    if (includeTransfers === false && item.isTransfer) {
      return false;
    }

    if (normalizedSearch) {
      const name = item.name.toLowerCase();
      const searchableCategory = categoryLabel.toLowerCase();
      if (!name.includes(normalizedSearch) && !searchableCategory.includes(normalizedSearch)) {
        return false;
      }
    }

    return true;
  });
}

export function sortCashFlow(cashFlow, sortKey, sortOrder = "asc") {
  if (!sortKey) return cashFlow;

  return [...cashFlow].sort((a, b) => {
    let valA = a[sortKey];
    let valB = b[sortKey];

    if (sortKey === "category") {
      valA = valA || UNCATEGORIZED;
      valB = valB || UNCATEGORIZED;
    }

    const comparison = Number(valA > valB) - Number(valA < valB);
    return sortOrder === "asc" ? comparison : -comparison;
  });
}

export function getKPIs(cashFlow) {
  let income = 0;
  let expense = 0;
  let transfers = 0;

  cashFlow.forEach((item) => {
    if (item.isTransfer) {
      transfers += item.amount;
    } else {
      if (item.amount > 0) {
        income += item.amount;
      } else {
        expense += item.amount;
      }
    }
  });

  return {
    income,
    expense,
    net: income + expense,
    transfers,
  };
}

export function aggregateByMonth(cashFlow, { includeNet = true } = {}) {
  const months = {};
  cashFlow.forEach((item) => {
    if (item.isTransfer) {
      return;
    }
    const month = getMonthKey(item);
    if (!month) {
      return;
    }
    if (!months[month]) {
      months[month] = { month, income: 0, expense: 0, net: 0 };
    }
    if (item.amount > 0) {
      months[month].income += item.amount;
    } else {
      months[month].expense += Math.abs(item.amount);
    }
    if (includeNet) {
      months[month].net += item.amount;
    }
  });

  return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
}


export function getSixMonthAverages(monthlyData, months = 6) {
  if (!monthlyData.length) {
    return { income: 0, expense: 0, net: 0, count: 0 };
  }

  const recent = monthlyData.slice(-months);
  const totals = recent.reduce(
    (acc, item) => ({
      income: acc.income + item.income,
      expense: acc.expense + item.expense,
      net: acc.net + item.net,
    }),
    { income: 0, expense: 0, net: 0 },
  );

  const count = recent.length;
  return {
    income: totals.income / count,
    expense: totals.expense / count,
    net: totals.net / count,
    count,
  };
}

export function aggregateByCategory(cashFlow, { averageMonths = 0, excludeCurrentMonth = false } = {}) {
  const targetCashFlow = (() => {
    if (averageMonths <= 0) {
      return cashFlow;
    }

    const expenseRows = cashFlow.filter((item) => !item.isTransfer && item.amount < 0);
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const recentMonths = Array.from(new Set(expenseRows.map((item) => getMonthKey(item)).filter(Boolean)))
      .filter((month) => !(excludeCurrentMonth && month === currentMonthKey))
      .sort((a, b) => a.localeCompare(b))
      .slice(-averageMonths);

    if (!recentMonths.length) {
      return [];
    }

    const monthSet = new Set(recentMonths);
    return expenseRows.filter((item) => monthSet.has(getMonthKey(item)));
  })();

  const categories = {};
  targetCashFlow.forEach((item) => {
    if (item.isTransfer || item.amount >= 0) {
      return;
    }
    const categoryLabel = getCategoryLabel(item);
    if (!categories[categoryLabel]) {
      categories[categoryLabel] = { label: categoryLabel, value: 0 };
    }
    categories[categoryLabel].value += Math.abs(item.amount);
  });
  const items = Object.values(categories);
  if (averageMonths > 0) {
    const availableMonths = new Set(targetCashFlow.map((item) => getMonthKey(item)).filter(Boolean)).size;
    if (availableMonths > 0) {
      items.forEach((item) => {
        item.value /= availableMonths;
      });
    }
  }

  return items.sort((a, b) => b.value - a.value);
}

export function getUniqueMonths(cashFlow) {
  const months = new Set();
  cashFlow.forEach((item) => {
    const month = getMonthKey(item);
    if (month) {
      months.add(month);
    }
  });
  return Array.from(months).sort((a, b) => b.localeCompare(a));
}

export function getUniqueCategories(cashFlow) {
  const categories = new Set();
  cashFlow.forEach((item) => {
    categories.add(getCategoryLabel(item));
  });
  return Array.from(categories).sort();
}

export function getUniqueLargeCategories(cashFlow) {
  const categories = new Set();
  cashFlow.forEach((item) => {
    const { large } = getCategoryParts(item);
    categories.add(large);
  });
  return Array.from(categories).sort();
}

export function getUniqueSmallCategories(cashFlow, largeCategory) {
  if (!largeCategory) {
    return [];
  }
  const categories = new Set();
  cashFlow.forEach((item) => {
    const { large, small } = getCategoryParts(item);
    if (large === largeCategory && small) {
      categories.add(small);
    }
  });
  return Array.from(categories).sort();
}
