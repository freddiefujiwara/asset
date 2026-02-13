const DEFAULT_CATEGORY = "未分類";

const normalizeCategory = (category) => category || DEFAULT_CATEGORY;
const splitCategory = (category) => normalizeCategory(category).split("/");
const getYearMonth = (date) => date.substring(0, 7);

const compareValues = (a, b) => Number(a > b) - Number(a < b);

export function filterCashFlow(
  cashFlow,
  { month, category, largeCategory, smallCategory, includeTransfers, search } = {},
) {
  const normalizedSearch = search?.toLowerCase();

  return cashFlow.filter((item) => {
    if (month && !item.date.startsWith(month)) {
      return false;
    }

    const itemCategory = normalizeCategory(item.category);
    if (category && itemCategory !== category) {
      return false;
    }

    if (largeCategory) {
      const [large, small = ""] = splitCategory(item.category);
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
      const categoryText = itemCategory.toLowerCase();
      if (!name.includes(normalizedSearch) && !categoryText.includes(normalizedSearch)) {
        return false;
      }
    }

    return true;
  });
}

export function sortCashFlow(cashFlow, sortKey, sortOrder = "asc") {
  if (!sortKey) {
    return cashFlow;
  }

  const direction = sortOrder === "asc" ? 1 : -1;

  return [...cashFlow].sort((a, b) => {
    const rawA = sortKey === "category" ? normalizeCategory(a[sortKey]) : a[sortKey];
    const rawB = sortKey === "category" ? normalizeCategory(b[sortKey]) : b[sortKey];
    return compareValues(rawA, rawB) * direction;
  });
}

export function getKPIs(cashFlow) {
  const totals = cashFlow.reduce((acc, item) => {
    if (item.isTransfer) {
      acc.transfers += item.amount;
      return acc;
    }

    if (item.amount > 0) {
      acc.income += item.amount;
    } else {
      acc.expense += item.amount;
    }

    return acc;
  }, {
    income: 0,
    expense: 0,
    transfers: 0,
  });

  return {
    income: totals.income,
    expense: totals.expense,
    net: totals.income + totals.expense,
    transfers: totals.transfers,
  };
}

export function aggregateByMonth(cashFlow, { includeNet = true } = {}) {
  const months = {};

  cashFlow.forEach((item) => {
    if (item.isTransfer) {
      return;
    }

    const month = getYearMonth(item.date);
    if (!month || month.length < 7) {
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

export function aggregateByCategory(cashFlow) {
  const categories = {};

  cashFlow.forEach((item) => {
    if (item.isTransfer || item.amount >= 0) {
      return;
    }

    const category = normalizeCategory(item.category);
    if (!categories[category]) {
      categories[category] = { label: category, value: 0 };
    }

    categories[category].value += Math.abs(item.amount);
  });

  return Object.values(categories).sort((a, b) => b.value - a.value);
}

export function getUniqueMonths(cashFlow) {
  const months = new Set();

  cashFlow.forEach((item) => {
    const month = getYearMonth(item.date);
    if (month && month.length === 7) {
      months.add(month);
    }
  });

  return Array.from(months).sort((a, b) => b.localeCompare(a));
}

export function getUniqueCategories(cashFlow) {
  const categories = new Set();
  cashFlow.forEach((item) => {
    categories.add(normalizeCategory(item.category));
  });
  return Array.from(categories).sort();
}

export function getUniqueLargeCategories(cashFlow) {
  const categories = new Set();

  cashFlow.forEach((item) => {
    const [large] = splitCategory(item.category);
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
    const [large, small] = splitCategory(item.category);
    if (large === largeCategory && small) {
      categories.add(small);
    }
  });

  return Array.from(categories).sort();
}
