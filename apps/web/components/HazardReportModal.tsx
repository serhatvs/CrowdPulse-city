import React, { useState } from "react";
import Modal from "react-modal";

Modal.setAppElement("#root"); // Next.js'de _app.js'de root id olmalı

export default function HazardReportModal({ isOpen, onClose, onSubmit, initialLat = null, initialLon = null }) {
  const [lat, setLat] = useState(initialLat);
  const [lon, setLon] = useState(initialLon);
  const [category, setCategory] = useState(1);
  const [severity, setSeverity] = useState(3);
  const [noteURI, setNoteURI] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (lat == null || lon == null) {
      alert('Lütfen koordinat seçiniz.');
      return;
    }
    onSubmit({ lat, lon, category, severity, noteURI });
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onRequestClose={onClose} contentLabel="Hazard Report">
      <h2>Engel Raporla</h2>
      <form onSubmit={handleSubmit}>
        <label>Enlem (lat):
          <input type="number" value={lat} onChange={e => setLat(Number(e.target.value))} required />
        </label>
        <label>Boylam (lon):
          <input type="number" value={lon} onChange={e => setLon(Number(e.target.value))} required />
        </label>
        <label>Kategori:
          <select value={category} onChange={e => setCategory(Number(e.target.value))}>
            <option value={1}>Kaldırım yüksekliği</option>
            <option value={2}>Çukur / bozuk zemin</option>
            <option value={3}>Rampa eksikliği</option>
            <option value={4}>Merdiven</option>
            <option value={5}>Kaygan zemin</option>
          </select>
        </label>
        <label>Şiddet (1-5):
          <input type="number" min={1} max={5} value={severity} onChange={e => setSeverity(Number(e.target.value))} required />
        </label>
        <label>Not/Fotoğraf URI:
          <input type="text" value={noteURI} onChange={e => setNoteURI(e.target.value)} />
        </label>
        <button type="submit">Raporla</button>
        <button type="button" onClick={onClose}>İptal</button>
      </form>
    </Modal>
  );
}
