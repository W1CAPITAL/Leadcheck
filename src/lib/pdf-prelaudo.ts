import { formatBRL, formatRate, maskCpfHidden, monthLabel } from "./br";
import type { Lead } from "./leads";
import type { SavingsEstimate } from "./simulate";
import { scoreLead, tierLabel } from "./score";
import { annualEffectiveFromMonthly, formatCet } from "./cet";

function esc(s: string) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildHtml(lead: Lead, savings: SavingsEstimate | null) {
  const score = scoreLead(lead);
  const flags = [
    lead.flags?.quitacao ? "Quitação" : null,
    lead.flags?.prestamista ? "Seguro prestamista" : null,
    lead.flags?.reduzir ? "Reduzir parcela" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pré-laudo ${esc(lead.nome || "cliente")}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; color: #1b1916; max-width: 720px; margin: 24px auto; padding: 0 16px 48px; line-height: 1.45; background: #fff; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #1e3d32; margin: 24px 0 8px; }
    .muted { color: #6f6a62; font-size: 13px; }
    .card { border: 1px solid #e5e1da; border-radius: 12px; padding: 14px 16px; margin: 10px 0; background: #faf9f7; }
    .alert { background: #f4e6e2; border-color: #e8cfc9; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    td { padding: 6px 0; vertical-align: top; }
    td:first-child { color: #6f6a62; width: 42%; }
    .footer { margin-top: 28px; font-size: 11px; color: #9a948a; border-top: 1px solid #e5e1da; padding-top: 12px; }
    .wm { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; opacity: 0.06; font-size: 48px; font-weight: 700; letter-spacing: 0.12em; transform: rotate(-28deg); color: #1e3d32; z-index: 0; }
    .content { position: relative; z-index: 1; }
    .toolbar { position: sticky; top: 0; background: #fff; padding: 12px 0; margin-bottom: 8px; border-bottom: 1px solid #e5e1da; display: flex; gap: 8px; flex-wrap: wrap; z-index: 2; }
    .toolbar button, .toolbar a { padding: 10px 16px; font-size: 14px; cursor: pointer; border-radius: 8px; border: 1px solid #e5e1da; background: #1e3d32; color: #fff; text-decoration: none; font-family: inherit; }
    .toolbar a.secondary { background: #fff; color: #1b1916; }
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
      .wm { opacity: 0.08; }
    }
  </style>
</head>
<body>
  <div class="wm" aria-hidden="true">W1 CAPITAL</div>
  <div class="content">
  <div class="toolbar no-print">
    <button type="button" onclick="window.print()">Imprimir / salvar PDF</button>
    <a class="secondary" href="#" id="dl-html">Baixar HTML</a>
  </div>
  <p class="muted">W1 Capital · Pré-laudo de orientação · Parcela Justa / Leadcheck</p>
  <h1>Pré-laudo — revisão de juros (veículos)</h1>
  <p class="muted">Protocolo: ${esc((lead.id || "").slice(0, 8).toUpperCase())} · Gerado em ${esc(new Date().toLocaleString("pt-BR"))}</p>

  <h2>Cliente</h2>
  <div class="card">
    <table>
      <tr><td>Nome</td><td>${esc(lead.nome)}</td></tr>
      <tr><td>WhatsApp</td><td>${esc(lead.whatsapp)}</td></tr>
      <tr><td>CPF</td><td>${esc(maskCpfHidden(lead.cpf || ""))}</td></tr>
      <tr><td>Contrato</td><td>${esc(monthLabel(lead.contractDate) || lead.contractDate || "—")}</td></tr>
      <tr><td>Parcela informada</td><td>${esc(formatBRL(lead.parcela || 0))}</td></tr>
      <tr><td>Interesses / análise</td><td>${esc(flags || "Análise automática revisional")}</td></tr>
      <tr><td>Score interno</td><td>${esc(String(score.points))} pts · ${esc(tierLabel(score.tier))}</td></tr>
      <tr><td>Contrato anexado</td><td>${esc(lead.fileName ? "Sim — " + lead.fileName : "Não")}</td></tr>
    </table>
  </div>

  <h2>Bacen (referência)</h2>
  <div class="card ${lead.bacenMonthly != null ? "alert" : ""}">
    ${
      lead.bacenMonthly != null
        ? `<p style="margin:0">Taxa média na competência <strong>${esc(lead.bacenPeriod || "—")}</strong>:
           <strong>${esc(formatRate(lead.bacenMonthly))} a.m.</strong>
           ${lead.bacenAnnual != null ? `(${esc(formatRate(lead.bacenAnnual))} a.a.)` : ""}</p>
           <p class="muted" style="margin:8px 0 0">O contrato pode estar acima da média de mercado — base clássica de ação revisional.</p>`
        : `<p style="margin:0" class="muted">Média Bacen ainda não disponível neste pré-laudo.</p>`
    }
  </div>

  ${
    savings
      ? `<h2>Estimativa ilustrativa</h2>
  <div class="card">
    <table>
      <tr><td>Parcela atual</td><td><strong>${esc(formatBRL(savings.currentInstallment))}</strong></td></tr>
      <tr><td>Parcela na média Bacen (proxy)</td><td><strong>${esc(formatBRL(savings.bacenInstallment))}</strong></td></tr>
      <tr><td>Economia mensal estimada</td><td><strong>${esc(formatBRL(savings.monthlySavings))}</strong></td></tr>
      <tr><td>Em ${savings.months} meses</td><td><strong>${esc(formatBRL(savings.totalSavings))}</strong></td></tr>
    </table>
    <p class="muted" style="margin:10px 0 0">Estimativa com base na parcela informada e na média Bacen. Não substitui cálculo pericial com o contrato completo.</p>
  </div>`
      : ""
  }

  ${
    lead.bacenMonthly != null
      ? `<h2>CET / taxa efetiva (aprox.)</h2>
  <div class="card">
    <p style="margin:0">Referência a partir da média Bacen: <strong>${esc(
      formatCet(lead.bacenMonthly, annualEffectiveFromMonthly(lead.bacenMonthly)),
    )}</strong></p>
    <p class="muted" style="margin:8px 0 0">CET oficial exige o fluxo completo do contrato (tarifas, IOF, prestamista). Este valor é só referência de mercado.</p>
  </div>`
      : ""
  }

  <h2>Próximos passos</h2>
  <div class="card">
    <ol style="margin:0; padding-left:18px">
      <li>Conferir contrato (taxa, CET, prestamista, IOF).</li>
      <li>Confrontar com a série SGS da modalidade e competência.</li>
      <li>Elaborar laudo / parecer se houver indício de abusividade.</li>
    </ol>
  </div>

  <div class="footer">
    Documento orientativo gerado automaticamente. Não constitui aconselhamento jurídico nem laudo pericial.
    Dados pessoais tratados apenas para atendimento da solicitação (LGPD).
    © W1 Capital Assessoria · Leadcheck / Parcela Justa.
  </div>
  </div>
  <script>
    (function () {
      var a = document.getElementById("dl-html");
      if (a) {
        a.addEventListener("click", function (e) {
          e.preventDefault();
          var blob = new Blob([document.documentElement.outerHTML], { type: "text/html;charset=utf-8" });
          var url = URL.createObjectURL(blob);
          var link = document.createElement("a");
          link.href = url;
          link.download = "pre-laudo-${esc((lead.id || "lead").slice(0, 8))}.html";
          link.click();
          setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        });
      }
      // Auto-print só se a página carregou de fato (evita aba em branco)
      window.addEventListener("load", function () {
        setTimeout(function () {
          try { window.focus(); } catch (e) {}
        }, 100);
      });
    })();
  </script>
</body>
</html>`;
}

/**
 * Abre o pré-laudo de forma confiável (Blob URL).
 * window.open("") + document.write costuma falhar (noopener / bloqueio / aba vazia).
 */
export function openPrelaudoPrint(lead: Lead, savings: SavingsEstimate | null) {
  const html = buildHtml(lead, savings);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const w = window.open(url, "_blank");
  if (!w) {
    // Fallback: download direto se pop-up bloqueado
    const a = document.createElement("a");
    a.href = url;
    a.download = `pre-laudo-${(lead.id || "lead").slice(0, 8)}.html`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    alert("Pop-up bloqueado. Baixamos o pré-laudo em HTML — abra o arquivo e use Imprimir → Salvar como PDF.");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  // Revoga depois de a aba carregar
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }, 60_000);
}
