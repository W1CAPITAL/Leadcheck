# Leadcheck — Scanner de leads de verdade (LGPD)

## O que NÃO fazer
- Scraping de compradores de veículo + WhatsApp sem consentimento
- Compra de listas frias de CPF/telefone para disparo
- Emular DETRAN/gov.br com senha de terceiros sem autorização

Risco: multa ANPD (até 2% faturamento / R$ 50 mi), bloqueio WhatsApp, dano reputacional.

## O que o scanner faz (lícito)

```
[Meta Lead Ads / Site / Parceiro CaaS / WhatsApp inbound]
        │  consentimento no formulário
        ▼
 POST /api/leads-ingest  ──ou──  funil Parcela Justa (pago)
        │
        ▼
 Score + fila acionável (só com consentAt + telefone)
        │
        ├─► Google Sheets (Apps Script /exec)  ← SyncCRM / Offline pattern
        ├─► CSV export
        └─► Enriquecimento opcional via /api/enrich (BigDataCorp) — só com consentimento
```

## Integração SyncCRM + Offline LexisPredict
1. Uma planilha Google com aba **Leads**
2. Cole `apps-script/LEADCHECK-SHEETS-AppsScript.gs` → Implantar como app da web (Qualquer pessoa) → URL `/exec`
3. No Leadcheck `#backoffice` → **Scanner de leads** → cole URL + token → Testar → Enviar leads
4. SyncCRM: use o mesmo webhook/planilha (sheet-explorer)
5. Offline Lexis: CSV ou webhook 2 vias — **não misture** lead comercial frio com processo judicial sem critério

## Fontes que geram lead “de verdade”
1. Funil Parcela Justa — ao clicar “Já paguei” → `bridgeFunnelLeadToScanner`
2. Meta Lead Ads → n8n → `/api/leads-ingest` (ou Worker Cloudflare)
3. EasyCrédito / Creditas (CaaS) — consentimento no simulador
4. Formulário parceiro com checkbox LGPD

## Variáveis
### Vercel
```
LEADCHECK_INGEST_TOKEN=...
LEADCHECK_SHEETS_WEBHOOK=https://script.google.com/macros/s/XXX/exec
LEADCHECK_SHEETS_TOKEN=...
BIGDATACORP_TOKEN=...          # opcional
BIGDATACORP_TOKEN_ID=...       # opcional
BACKOFFICE_PASSWORD=...
```

### Cloudflare Pages + Worker
- Pages: build `npm run build`, output `dist`
- Worker `leadcheck-ingest` com secrets acima
- Frontend pode apontar ingest para a URL do Worker se não usar Vercel Functions
