/**
 * LEADCHECK — Webhook planilha (Leads + Usuarios opcional)
 * Compatível com app v6.2 style: action=ping|write|list|auth
 *
 * DEPLOY:
 * 1) Extensões → Apps Script → cole este arquivo
 * 2) TOKEN = mesmo do Leadcheck / n8n
 * 3) Implantar → App da web → Eu → Qualquer pessoa → NOVA VERSÃO
 * 4) URL /exec no Leadcheck Configurações e no SyncCRM se usar
 *
 * Aba "Leads" — cabeçalho na linha 1 (criada automaticamente no 1º write).
 */

var TOKEN = "w1-fase1-2026";
var LEADS_SHEET = "Leads";
var HEADER_ROW = 1;

var DEFAULT_HEADERS = [
  "Id", "CriadoEm", "AtualizadoEm", "Fonte", "Status", "Consentimento",
  "Nome", "WhatsApp", "Telefone", "Email", "CPF", "Interesse", "Placa",
  "ValorBem", "Parcela", "DataContrato", "Cidade", "UF", "Score", "Tier",
  "Enriquecimento", "Responsavel", "Tags"
];

function norm(s) {
  return String(s || "").replace(/\s+/g, "").replace(/_/g, "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return out({ ok: true, pong: true, app: "leadcheck-sheets", v: "1.0" });
}

function doPost(e) {
  try {
    var body = JSON.parse((e.postData && e.postData.contents) || "{}");
    if (!body || body.token !== TOKEN) return out({ ok: false, error: "token invalido" });

    var action = String(body.action || body.op || "").toLowerCase();
    if (body.ping === true || action === "ping") {
      return out({ ok: true, pong: true, app: "leadcheck-sheets", v: "1.0" });
    }
    if (action === "write" || body.rows) {
      return out(writeRows(body.rows || [], body.sheetName || LEADS_SHEET));
    }
    if (action === "list") {
      return out(listRows(body.sheetName || LEADS_SHEET, body.limit || 500));
    }
    return out({ ok: false, error: "acao desconhecida: " + action });
  } catch (err) {
    return out({ ok: false, error: String(err.message || err).slice(0, 300) });
  }
}

function ensureSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var headers = sh.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h || "").trim();
  });
  var empty = headers.every(function (h) { return !h; });
  if (empty) {
    sh.getRange(1, 1, 1, DEFAULT_HEADERS.length).setValues([DEFAULT_HEADERS]);
    sh.setFrozenRows(1);
    headers = DEFAULT_HEADERS.slice();
  }
  return { sh: sh, headers: headers };
}

function writeRows(rows, sheetName) {
  var ctx = ensureSheet_(sheetName);
  var sh = ctx.sh;
  var headers = ctx.headers;
  var keyIdx = -1;
  for (var i = 0; i < headers.length; i++) {
    if (/^id$|protocolo|cpf|whatsapp/.test(norm(headers[i])) && keyIdx < 0) {
      if (norm(headers[i]) === "id") keyIdx = i;
    }
  }
  if (keyIdx < 0) keyIdx = 0;

  var data = sh.getDataRange().getValues();
  var index = {};
  for (var r = 1; r < data.length; r++) {
    var k = String(data[r][keyIdx] || "").trim();
    if (k) index[k] = r + 1;
  }

  var updated = 0, added = 0;
  (rows || []).forEach(function (rowObj) {
    if (!rowObj || typeof rowObj !== "object") return;
    var id = String(rowObj.Id || rowObj.id || "").trim();
    var line = headers.map(function (h) {
      var nk = norm(h);
      for (var key in rowObj) {
        if (norm(key) === nk) return rowObj[key];
      }
      return "";
    });
    if (id && index[id]) {
      // merge: não apaga células já preenchidas se novo valor vazio
      var rowNum = index[id];
      var cur = sh.getRange(rowNum, 1, rowNum, headers.length).getValues()[0];
      for (var c = 0; c < line.length; c++) {
        if (line[c] !== "" && line[c] != null) cur[c] = line[c];
      }
      sh.getRange(rowNum, 1, rowNum, headers.length).setValues([cur]);
      updated++;
    } else {
      sh.appendRow(line);
      added++;
    }
  });
  return { ok: true, updated: updated, added: added, sheet: sheetName };
}

function listRows(sheetName, limit) {
  var ctx = ensureSheet_(sheetName);
  var sh = ctx.sh;
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return { ok: true, rows: [], total: 0 };
  var headers = values[0].map(String);
  var rows = [];
  var max = Math.min(values.length - 1, limit || 500);
  for (var r = 1; r <= max; r++) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = values[r][i]; });
    rows.push(obj);
  }
  return { ok: true, rows: rows, total: values.length - 1 };
}
