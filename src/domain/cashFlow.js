export function filterCashFlow(
  cashFlow,
  { month, category, largeCategory, smallCategory, includeTransfers, search } = {},
) {
  return cashFlow.filter((item) => {
    if (month && !item.date.startsWith(month)) {
      return false;
    }
    // Backward compatibility or exact match
    if (category) {
      const itemCat = item.category || "未分類";
      if (itemCat !== category) {
        return false;
      }
    }
    // New large/small category filter
    if (largeCategory) {
      const itemCat = item.category || "未分類";
      const parts = itemCat.split("/");
      const large = parts[0];
      if (large !== largeCategory) {
        return false;
      }
      if (smallCategory) {
        const small = parts.length > 1 ? parts[1] : "";
        if (small !== smallCategory) {
          return false;
        }
      }
    }
    if (includeTransfers === false && item.isTransfer) {
      return false;
    }
    if (search) {
      const s = search.toLowerCase();
      const name = item.name.toLowerCase();
      const cat = (item.category || "未分類").toLowerCase();
      if (!name.includes(s) && !cat.includes(s)) {
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
      valA = valA || "未分類";
      valB = valB || "未分類";
    }

    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
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
    const m = item.date.substring(0, 7);
    if (!m || m.length < 7) {
      return;
    }
    if (!months[m]) {
      months[m] = { month: m, income: 0, expense: 0, net: 0 };
    }
    if (item.amount > 0) {
      months[m].income += item.amount;
    } else {
      months[m].expense += Math.abs(item.amount);
    }
    if (includeNet) {
      months[m].net += item.amount;
    }
  });

  return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
}

export function aggregateByCategory(cashFlow) {
  const categories = {};
  cashFlow.forEach((item) => {
    if (item.isTransfer || item.amount >= 0) {
      return;
    }
    const cat = item.category || "未分類";
    if (!categories[cat]) {
      categories[cat] = { label: cat, value: 0 };
    }
    categories[cat].value += Math.abs(item.amount);
  });
  return Object.values(categories).sort((a, b) => b.value - a.value);
}

export function getUniqueMonths(cashFlow) {
  const months = new Set();
  cashFlow.forEach((item) => {
    const m = item.date.substring(0, 7);
    if (m && m.length === 7) {
      months.add(m);
    }
  });
  return Array.from(months).sort((a, b) => b.localeCompare(a));
}

export function getUniqueCategories(cashFlow) {
  const categories = new Set();
  cashFlow.forEach((item) => {
    categories.add(item.category || "未分類");
  });
  return Array.from(categories).sort();
}

export function getUniqueLargeCategories(cashFlow) {
  const categories = new Set();
  cashFlow.forEach((item) => {
    const cat = item.category || "未分類";
    const parts = cat.split("/");
    categories.add(parts[0]);
  });
  return Array.from(categories).sort();
}

export function getUniqueSmallCategories(cashFlow, largeCategory) {
  if (!largeCategory) {
    return [];
  }
  const categories = new Set();
  cashFlow.forEach((item) => {
    const cat = item.category || "未分類";
    const parts = cat.split("/");
    if (parts[0] === largeCategory && parts.length > 1) {
      categories.add(parts[1]);
    }
  });
  return Array.from(categories).sort();
}
