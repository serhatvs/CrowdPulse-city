# CrowdPulse-city Commit Özeti

Bu dosya, son yapılan altyapı/deploy odaklı değişikliklerin GitHub üzerinde anlaşılır şekilde takip edilmesi için eklenmiştir.

## Neler eklendi?

- Monorepo workspace yapısı (`package.json`) ve ortak scriptler
- API (`apps/api`) için health + heatmap endpointleri
- Contracts (`packages/contracts`) için Hardhat konfigürasyonu ve test çalışma yapısı
- Indexer (`packages/indexer`) için çalıştırma/derleme paket konfigürasyonu
- Lokal orkestrasyon için `docker-compose.yml`
- Ortam değişkeni örneği (`.env.example`)
- Zorin OS 18 için tek komut deploy scripti (`scripts/deploy_zorin18.sh`)

## Amaç

Bu commit özeti, katkı verenlerin:

1. Hangi bileşenlerin deploya hazır hale getirildiğini,
2. Yerelde nasıl ayağa kaldırılacağını,
3. Hangi dosyaların operasyonel öneme sahip olduğunu

hızlıca görmesini sağlar.
