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
 POST /api/leads-ingest  ──ou──  formulário Leadcheck
        │
        ▼
 Score + fila acionável (só com consentAt + telefone)
        │
        ├─► Google Sheets (Apps Script /exec)  ← SyncCRM / Offline pattern
        ├─► CSV export
        └─► WhatsApp template oficial (n8n) — opcional
```

## Enriquecimento (opcional, pago, com base legal)
- BigDataCorp: CPF × telefone via operadoras (contrato + hipótese legal)
- APIBrasil: dados veiculares públicos (placa) — não entrega WhatsApp de dono
- Credify: KYC quando o lead está em onboarding

Sem `consentAt` → status `bloqueado_lgpd`.

## Integração SyncCRM + Offline Lexis
1. Mesma planilha Google com aba **Leads**
2. Mesmo webhook Apps Script (`LEADCHECK-SHEETS-AppsScript.gs`)
3. SyncCRM lê a planilha (sheet-explorer)
4. Offline Lexis: se quiser unificar carteira jurídica, mapeie CPF/Protocolo depois — **não misture** lead comercial frio com processo judicial sem critério

## Fontes que geram lead “de verdade”
1. Funil Parcela Justa (já existe) — cliente preenche WhatsApp
2. Meta Lead Ads → n8n → `/api/leads-ingest`
3. EasyCrédito / Creditas (CaaS) — lead consentido no simulador
4. Formulário de parceiro (despachante, loja) com checkbox LGPD

## Variáveis Vercel
```
LEADCHECK_INGEST_TOKEN=w1-fase1-2026
LEADCHECK_SHEETS_WEBHOOK=https://script.google.com/macros/s/XXX/exec
LEADCHECK_SHEETS_TOKEN=w1-fase1-2026
```
