import React, { useEffect, useRef, useState } from "react";

type FilterValue = {
  category: number;
  minRisk: number;
  maxRisk: number;
  timeWindow: number;
  includeClosed: boolean;
  sort: "recent" | "risk" | "votes";
};

type Props = {
  onFilter: (value: FilterValue) => void;
};

const categories = [
  { value: 1, label: "Kaldirim yuksekligi" },
  { value: 2, label: "Cukur / bozuk zemin" },
  { value: 3, label: "Rampa eksikligi" },
  { value: 4, label: "Merdiven" },
  { value: 5, label: "Kaygan zemin" },
];

export default function HazardFilter({ onFilter }: Props) {
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [minRisk, setMinRisk] = useState(0);
  const [maxRisk, setMaxRisk] = useState(100);
  const [timeWindow, setTimeWindow] = useState(24);
  const [includeClosed, setIncludeClosed] = useState(true);
  const [sort, setSort] = useState<"recent" | "risk" | "votes">("recent");
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushFilter(): void {
    if (minRisk > maxRisk) {
      setError("Minimum risk, maksimum riski gecemez.");
      return;
    }
    setError(null);
    onFilter({ category: selectedCategory, minRisk, maxRisk, timeWindow, includeClosed, sort });
  }

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(pushFilter, 300);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [selectedCategory, minRisk, maxRisk, timeWindow, includeClosed, sort, onFilter]);

  return (
    <div style={{ padding: 8, background: "#f5f5f5", borderRadius: 8, display: "grid", gap: 8 }}>
      <label>
        Kategori:
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(Number(e.target.value))}>
          <option value={0}>Tumu</option>
          {categories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Risk Skoru:
        <input
          type="number"
          min={0}
          max={100}
          value={minRisk}
          onChange={(e) => setMinRisk(Number(e.target.value))}
        />
        {" - "}
        <input
          type="number"
          min={0}
          max={100}
          value={maxRisk}
          onChange={(e) => setMaxRisk(Number(e.target.value))}
        />
      </label>
      <label>
        Zaman Araligi (saat):
        <input
          type="number"
          min={1}
          max={168}
          value={timeWindow}
          onChange={(e) => setTimeWindow(Number(e.target.value))}
        />
      </label>
      <label>
        Siralama:
        <select value={sort} onChange={(e) => setSort(e.target.value as "recent" | "risk" | "votes")}>
          <option value="recent">En yeni aktivite</option>
          <option value="risk">En yuksek risk</option>
          <option value="votes">En cok oy</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={includeClosed}
          onChange={(e) => setIncludeClosed(e.target.checked)}
          style={{ width: "auto", marginRight: 8 }}
        />
        Kapali hazardlari da goster
      </label>
      {error ? <div style={{ color: "red" }}>{error}</div> : null}
      <button onClick={pushFilter} type="button">
        Filtrele
      </button>
    </div>
  );
}
