🏙️ CrowdPulse City

Kitle kaynaklı, zincir tabanlı, dinamik şehir erişilebilirlik haritası.

🚀 Proje Özeti

CrowdPulse City, şehir içindeki fiziksel erişilebilirlik risklerini topluluk tarafından raporlanan verilerle haritalayan, doğrulayan ve zaman içinde güncelleyen bir sistemdir.

Kullanıcılar:

- Kaldırım yüksekliği
- Çukur / bozuk zemin
- Rampa eksikliği
- Merdiven
- Kaygan zemin

gibi erişilebilirlik engellerini raporlar ve doğrular.

Sistem:

- Zincir üstü event’leri indexler
- Kanıt sayısı + tazelik + oy güveni ile risk skoru üretir
- Heatmap üretir
- Filtrelenebilir ve modlu rota önerisi sunar

Amaç: Özellikle tekerlekli sandalye kullanıcıları ve hareket kısıtlı bireyler için güvenli navigasyon.

🧠 Problem

Şehirlerde erişilebilirlik verisi:

- Statik
- Güncel değil
- Merkezi
- Denetlenemiyor

CrowdPulse:

- Canlı
- Topluluk doğrulamalı
- Şeffaf
- Zamanla evrilen

bir altyapı sunar.

🏗 Sistem Mimarisi

Frontend

- Next.js
- Leaflet veya Mapbox
- Heatmap + grid layer
- Real-time fetch / SSE

Smart Contract

- CityPulse.sol
- Fonksiyonlar:
	- reportHazard(latE6, lonE6, category, severity, noteURI)
	- voteHazard(hazardId, up)
	- closeHazard(hazardId)
- Event’ler:
	- HazardReported
	- HazardVoted
	- HazardClosed

Indexer

- Event listener
- Risk skoru hesaplama
- Grid aggregation
- REST API

Database

- PostgreSQL + PostGIS (ideal)
- veya
- SQLite + grid aggregation (hackathon)

📊 Risk Skoru Modeli

Risk = f(Severity × Evidence × Freshness)

- Severity (1–5)
- Evidence = log tabanlı oy ağırlığı
- Freshness = exponential decay (72 saat yarı ömür)
- Trust (opsiyonel)

0–100 arası normalize edilir.

🗺 Heatmap

- 100m grid hücre
- Hücre risk ortalaması
- Renk skalası:
	- Yeşil → Sarı → Kırmızı

♿ Wheelchair Mode

Rota hesaplanırken:

- Rampalara bonus
- Merdivenlere ağır ceza
- Riskli hücrelerden kaçınma
- Basit A* grid algoritması ile uygulanır.

📁 Repo Yapısı

crowdpulse-city/
	apps/
		web/
		api/
	packages/
		contracts/
		indexer/
		shared/
	docs/
		pitch.md
		dataset.md

🧪 Demo Senaryosu

Kayseri merkez bbox seçilir

Script ile:

- 1000 hazard
- 2000 vote

Harita canlı güncellenir

Filtre → “Son 24 saat”

Wheelchair mode → farklı rota

🔮 Gelecek Özellikler

- Sensör tabanlı pasif veri
- DAO governance
- Reputation sistemi
- IPFS kanıt fotoğrafı
- Belediye API entegrasyonu
- ML anomaly detection

🧠 AI-Driven Development Roadmap

Bu proje AI destekli geliştirilecek şekilde planlandı.

Phase 1 — Contract Generation

AI görevleri:

- Solidity contract yaz
- Gas optimize et
- Unit test üret
- Edge-case test üret

AI Prompt Örneği:

Write a gas-efficient Solidity contract named CityPulse.
It should allow users to:
- report hazards
- vote hazards
- close hazards

Use events for indexing.
Prevent double voting.
Use int32 for coordinates (E6 format).
Include unit tests.

Phase 2 — Indexer AI Assistance

AI görevleri:

- Event listener kodu üret
- Risk scoring modülü yaz
- Aggregation fonksiyonu üret
- SQL schema tasarla

Prompt:

Design a PostgreSQL schema for a geospatial hazard reporting system.
Include:
- hazards
- votes
- aggregated grid cells
- risk score field

Optimize for heatmap queries within bounding box.

Phase 3 — Frontend AI Assistance

AI görevleri:

- Leaflet heatmap layer yaz
- Bounding box fetch logic
- Modal form
- Filter system

Prompt:

Create a React Leaflet map component that:
- Fetches hazards within bbox
- Displays markers
- Displays heatmap layer
- Includes filter by category and time

Phase 4 — AI Assisted Routing

Prompt:

Implement A* pathfinding on a grid.
Each cell has a risk score (0–100).
Avoid cells above risk threshold.
Add wheelchair mode weighting.

🤖 MASTER PROMPT PACK (Kopyala Kullan)

1️⃣ Contract Generator Prompt
You are a senior blockchain engineer.

Design a production-ready Solidity contract for a decentralized hazard reporting system.

Requirements:
- int32 latE6, lonE6
- uint8 category
- uint8 severity (1–5)
- Prevent double voting
- Events for indexer
- Close hazard via community threshold

Include comments and gas optimization.

2️⃣ Risk Engine Prompt
You are a backend engineer.

Write a TypeScript module that calculates a dynamic risk score based on:
- severity (1–5)
- upvotes
- downvotes
- lastActivity timestamp

Use exponential decay for freshness.
Return normalized 0–100 score.

3️⃣ Heatmap Aggregation Prompt
Implement a function that:
- Takes hazards list
- Groups them into 100m grid cells
- Calculates average risk per cell
- Returns heatmap-ready JSON

4️⃣ Seed Script Prompt
Generate a Node.js script that:
- Randomly generates 1000 hazards inside a bounding box
- Randomly assigns categories and severity
- Simulates 2000 votes
- Sends transactions to contract

5️⃣ Full System Architect Prompt
Design a scalable architecture for a decentralized geospatial hazard mapping system.
Include:
- smart contracts
- indexer
- database
- frontend
- routing engine
- scaling considerations

🏆 Hackathon Winning Angle

Bu projeyi kazandıracak şey:

- Canlı event akışı
- Riskin zamanla düşmesi
- Toplulukla kapanan hazard
- Wheelchair rota farkı

İstersen bir sonraki mesajda:

📄 Tam pitch deck metni

🧮 Risk matematiğinin akademik versiyonu

🗳 DAO + token modeli

🌍 Gerçek şehir ölçeği için mimari

hazırlayabilirim.
# CrowdPulse-city