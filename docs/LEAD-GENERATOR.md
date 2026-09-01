# Lead Generator + CRM do proprietário

## O que foi adicionado
- `/api/leads/crud`: CRUD server-side usando Supabase REST e service role.
- `/api/leads/public-scan`: scanner limitado a uma URL pública fornecida pelo operador; extrai título, e-mails e telefones publicados na própria página e links de contato.
- `src/lib/LeadGeneratorPanel.tsx`: painel de proprietário com métricas, scanner, CSV e CRM.
- `supabase/001_owner_leads.sql`: banco completo.
- `.env.example`: variáveis para Vercel.

## Como ligar ao Backoffice existente
No `src/App.tsx` do repositório base, importe:

`import { LeadGeneratorPanel } from "./lib/LeadGeneratorPanel";`

Na área `Backoffice`, adicione a aba `"gerador"` e renderize `<LeadGeneratorPanel />` quando ela estiver selecionada. O arquivo é independente do restante do funil.

## Banco gratuito
1. Crie um projeto gratuito no Supabase.
2. SQL Editor → New query.
3. Cole integralmente `supabase/001_owner_leads.sql` e execute.
4. Em Vercel → Settings → Environment Variables, configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `OWNER_ADMIN_KEY`.
5. Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` em `VITE_*`, `NEXT_PUBLIC_*` ou no navegador.

## Scanner
O scanner não faz crawling de toda a internet. Ele consulta a URL que o proprietário informar, bloqueia hosts locais/privados e só retorna contatos encontrados na página pública. Isso reduz SSRF e evita transformar o produto em uma ferramenta de coleta massiva de dados pessoais.

Para geração em escala, prefira:
- formulário do próprio site;
- Meta/Google Lead Ads com consentimento;
- parceiros que enviam leads;
- CSV de empresas B2B com origem documentada;
- fontes públicas de empresas, respeitando termos e base legal.

## CSV
Cabeçalho recomendado:
`nome,empresa,email,telefone,fonte,url,status,score,observacoes`

## Google Sheets
O CRM de leads pode continuar exportando/espelhando para a aba `Leads` pelo Apps Script do pacote original. O banco passa a ser a fonte operacional do proprietário; a planilha vira exportação/integração.
