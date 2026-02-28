import React, { useEffect, useState } from "react";
import Modal from "react-modal";

type ReportPayload = {
  lat: number;
  lon: number;
  category: number;
  severity: number;
  noteURI: string;
  otherDetail?: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: ReportPayload) => Promise<boolean | void> | boolean | void;
  initialLat?: number | null;
  initialLon?: number | null;
};

export default function HazardReportModal({
  isOpen,
  onClose,
  onSubmit,
  initialLat = null,
  initialLon = null,
}: Props) {
  const [lat, setLat] = useState<number | null>(initialLat);
  const [lon, setLon] = useState<number | null>(initialLon);
  const [category, setCategory] = useState(1);
  const [severity, setSeverity] = useState(3);
  const [noteURI, setNoteURI] = useState("");
  const [otherDetail, setOtherDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const appRoot = document.getElementById("root") ?? document.getElementById("__next");
      if (appRoot) {
        Modal.setAppElement(appRoot);
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setLat(initialLat);
      setLon(initialLon);
      setError(null);
      return;
    }
    setLat(initialLat);
    setLon(initialLon);
    setCategory(1);
    setSeverity(3);
    setNoteURI("");
    setOtherDetail("");
    setError(null);
    setIsSubmitting(false);
  }, [isOpen, initialLat, initialLon]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lat == null || lon == null) {
      setError("Lutfen koordinat seciniz.");
      return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setError("Koordinatlar gecerli bir sayi olmali.");
      return;
    }
    if (!Number.isInteger(severity) || severity < 1 || severity > 5) {
      setError("Siddet 1-5 arasinda olmali.");
      return;
    }
    if (category === 255 && otherDetail.trim().length < 3) {
      setError("Other seciliyse lutfen kategori aciklamasi yazin.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const shouldClose = await onSubmit({ lat, lon, category, severity, noteURI, otherDetail: otherDetail.trim() });
      if (shouldClose !== false) {
        onClose();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Rapor gonderilemedi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Hazard Report"
      className="hazard-modal"
      overlayClassName="hazard-modal-overlay"
      shouldCloseOnEsc={!isSubmitting}
      shouldCloseOnOverlayClick={!isSubmitting}
    >
      <h2>Engel Raporla</h2>
      <form onSubmit={handleSubmit} className="hazard-form">
        <label>
          Enlem (lat):
          <input
            type="number"
            value={lat ?? ""}
            onChange={(e) => setLat(e.target.value === "" ? null : Number(e.target.value))}
            placeholder="Haritadan secin veya girin"
            disabled={isSubmitting}
            required
          />
        </label>
        <label>
          Boylam (lon):
          <input
            type="number"
            value={lon ?? ""}
            onChange={(e) => setLon(e.target.value === "" ? null : Number(e.target.value))}
            placeholder="Haritadan secin veya girin"
            disabled={isSubmitting}
            required
          />
        </label>
        <label>
          Kategori:
          <select value={category} onChange={(e) => setCategory(Number(e.target.value))} disabled={isSubmitting}>
            <option value={1}>Kaldirim yuksekligi</option>
            <option value={2}>Cukur / bozuk zemin</option>
            <option value={3}>Rampa eksikligi</option>
            <option value={4}>Merdiven</option>
            <option value={5}>Kaygan zemin</option>
            <option value={255}>Other</option>
          </select>
        </label>
        {category === 255 ? (
          <label>
            Other Kategori Aciklamasi:
            <input
              type="text"
              value={otherDetail}
              onChange={(e) => setOtherDetail(e.target.value)}
              placeholder="Orn: gecici insaat engeli"
              disabled={isSubmitting}
              required
            />
          </label>
        ) : null}
        <label>
          Siddet (1-5):
          <input
            type="number"
            min={1}
            max={5}
            value={severity}
            onChange={(e) => setSeverity(Number(e.target.value))}
            disabled={isSubmitting}
            required
          />
        </label>
        <label>
          Not/Fotograf URI:
          <input type="text" value={noteURI} onChange={(e) => setNoteURI(e.target.value)} disabled={isSubmitting} />
        </label>
        {error ? <div style={{ color: "red" }}>{error}</div> : null}
        <div className="hazard-modal-actions">
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Gonderiliyor..." : "Raporla"}
          </button>
          <button type="button" onClick={onClose} disabled={isSubmitting}>
            Iptal
          </button>
        </div>
      </form>
    </Modal>
  );
}
