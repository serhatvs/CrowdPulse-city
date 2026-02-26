import React, { useState, useCallback, useRef } from "react";

const categories = [
  { value: 1, label: "Kaldırım yüksekliği" },
  { value: 2, label: "Çukur / bozuk zemin" },
  { value: 3, label: "Rampa eksikliği" },
  { value: 4, label: "Merdiven" },
  { value: 5, label: "Kaygan zemin" }
];

  const [selectedCategory, setSelectedCategory] = useState(0);
  const [minRisk, setMinRisk] = useState(0);
  const [maxRisk, setMaxRisk] = useState(100);
  const [timeWindow, setTimeWindow] = useState(24); // saat

  // Debounce için timerRef bileşen seviyesinde
  const timerRef = useRef();

  // Otomatik filtre tetikleme (debounced)
  React.useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (minRisk > maxRisk) {
        alert('Minimum risk maksimumdan büyük olamaz.');
        return;
      }
      onFilter({
        category: selectedCategory,
        minRisk,
        maxRisk,
        timeWindow
      });
    }, 300);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, minRisk, maxRisk, timeWindow, onFilter]);

  return (
    <div style={{ padding: 8, background: "#f5f5f5", borderRadius: 8 }}>
      <label>Kategori:
        <select value={selectedCategory} onChange={e => setSelectedCategory(Number(e.target.value))}>
          <option value={0}>Tümü</option>
          {categories.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </label>
      <label>Risk Skoru:
        <input type="number" min={0} max={100} value={minRisk} onChange={e => setMinRisk(Number(e.target.value))} />
        -
        <input type="number" min={0} max={100} value={maxRisk} onChange={e => setMaxRisk(Number(e.target.value))} />
      </label>
      <label>Zaman Aralığı (saat):
        <input type="number" min={1} max={168} value={timeWindow} onChange={e => setTimeWindow(Number(e.target.value))} />
      </label>
      <button onClick={handleFilter}>Filtrele</button>
    </div>
  );
}
