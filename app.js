/**
 * Buildman Inc. — static invoice & quote editor (GitHub Pages–ready)
 */
(function () {
  "use strict";

  var TAX_RATE_DEFAULT = "0.13";

  var DEFAULT_INVOICE = {
    invoiceNumber: "",
    date: "",
    salesperson: "",
    orderNo: "",
    toLines: ["", "", ""],
    items: [],
    terms: "",
    subtotal: "",
    hst: "",
    pst: "",
    total: "",
    skipAutoTotals: false,
  };

  var DEFAULT_QUOTE = {
    quoteDate: "",
    quoteNumber: "",
    customer: {
      name: "",
      address: "",
      phone: "",
      email: "",
    },
    rep: {
      name: "",
      phone: "",
      email: "",
    },
    sectionTitle: "",
    scopeLines: [],
    noteInclusion: "",
    noteTiming: "",
    noteLandscape: "",
    transferEmail: "",
    acceptHeading: "",
    acceptLegal: "",
    acceptName: "",
    acceptDate: "",
    netTotal: "",
    hst: "",
    payable: "",
    skipAutoTotals: false,
  };

  var INVOICE_LINE_COUNT = 15;
  var QUOTE_SCOPE_LINE_COUNT = 10;

  function buildDefaultInvoiceItems() {
    var rows = [];
    var i;
    for (i = 0; i < INVOICE_LINE_COUNT; i++)
      rows.push({ q: "", d: "", p: "", a: "" });
    return rows;
  }

  function buildDefaultQuoteScope() {
    var rows = [];
    var i;
    for (i = 0; i < QUOTE_SCOPE_LINE_COUNT; i++)
      rows.push({ desc: "", amt: "" });
    return rows;
  }

  var BUILDMAN_STATE_FILENAME = "buildman-state.json";

  function strVal(v) {
    return v == null ? "" : String(v);
  }

  function normalizeImportedInvoice(inv) {
    var out = freshInvoice();
    if (!inv || typeof inv !== "object") return out;
    out.invoiceNumber = strVal(inv.invoiceNumber);
    out.date = strVal(inv.date);
    out.salesperson = strVal(inv.salesperson);
    out.orderNo = strVal(inv.orderNo);
    out.terms = strVal(inv.terms);
    out.subtotal = strVal(inv.subtotal);
    out.hst = strVal(inv.hst);
    out.pst = strVal(inv.pst);
    out.total = strVal(inv.total);
    out.skipAutoTotals = !!inv.skipAutoTotals;
    if (Array.isArray(inv.toLines)) {
      out.toLines = [0, 1, 2].map(function (i) {
        return strVal(inv.toLines[i]);
      });
    }
    if (Array.isArray(inv.items) && inv.items.length) {
      out.items = inv.items.map(function (r) {
        return {
          q: strVal(r.q),
          d: strVal(r.d),
          p: strVal(r.p),
          a: strVal(r.a),
        };
      });
    }
    return out;
  }

  function normalizeImportedQuote(q) {
    var out = freshQuote();
    if (!q || typeof q !== "object") return out;
    out.quoteDate = strVal(q.quoteDate);
    out.quoteNumber = strVal(q.quoteNumber);
    out.sectionTitle = strVal(q.sectionTitle);
    out.noteInclusion = strVal(q.noteInclusion);
    out.noteTiming = strVal(q.noteTiming);
    out.noteLandscape = strVal(q.noteLandscape);
    out.transferEmail = strVal(q.transferEmail);
    out.acceptHeading = strVal(q.acceptHeading);
    out.acceptLegal = strVal(q.acceptLegal);
    out.acceptName = strVal(q.acceptName);
    out.acceptDate = strVal(q.acceptDate);
    out.netTotal = strVal(q.netTotal);
    out.hst = strVal(q.hst);
    out.payable = strVal(q.payable);
    out.skipAutoTotals = !!q.skipAutoTotals;
    if (q.customer && typeof q.customer === "object") {
      out.customer.name = strVal(q.customer.name);
      out.customer.address = strVal(q.customer.address);
      out.customer.phone = strVal(q.customer.phone);
      out.customer.email = strVal(q.customer.email);
    }
    if (q.rep && typeof q.rep === "object") {
      out.rep.name = strVal(q.rep.name);
      out.rep.phone = strVal(q.rep.phone);
      out.rep.email = strVal(q.rep.email);
    }
    if (Array.isArray(q.scopeLines) && q.scopeLines.length) {
      out.scopeLines = q.scopeLines.map(function (r) {
        return { desc: strVal(r.desc), amt: strVal(r.amt) };
      });
    }
    return out;
  }

  function buildStatePayload() {
    return {
      buildmanExportVersion: 1,
      mode: state.mode,
      autoTotals: state.autoTotals,
      taxRate: state.taxRate,
      invoice: deepClone(state.invoice),
      quote: deepClone(state.quote),
    };
  }

  function applyImportedPayload(data) {
    if (!data || data.buildmanExportVersion !== 1) {
      throw new Error("Invalid Buildman data");
    }
    if (data.invoice) state.invoice = normalizeImportedInvoice(data.invoice);
    if (data.quote) state.quote = normalizeImportedQuote(data.quote);
    if (typeof data.autoTotals === "boolean") state.autoTotals = data.autoTotals;
    if (data.taxRate != null) state.taxRate = String(data.taxRate);
    document.getElementById("auto-totals").checked = state.autoTotals;
    document.getElementById("tax-rate").value = state.taxRate;
    if (data.mode === "invoice" || data.mode === "quote") setMode(data.mode);
    else setMode(state.mode);
  }

  async function exportPdfFile() {
    if (typeof html2pdf === "undefined") {
      showToast("PDF export library did not load. Check your connection.");
      return;
    }
    if (typeof PDFLib === "undefined") {
      showToast("PDF library did not load. Check your connection.");
      return;
    }
    if (state.mode === "invoice") readInvoiceFromEditors();
    else readQuoteFromEditors();
    renderPreview();

    var el = document.querySelector("#print-root .doc");
    if (!el) {
      showToast("Nothing to export.");
      return;
    }

    showToast("Building PDF…");

    var payload = buildStatePayload();
    var jsonBytes = new TextEncoder().encode(JSON.stringify(payload));

    var opt = {
      margin: [0.4, 0.4, 0.4, 0.4],
      image: { type: "jpeg", quality: 0.92 },
      html2canvas: {
        scale: Math.min(2, window.devicePixelRatio || 2),
        useCORS: true,
        logging: false,
        letterRendering: true,
      },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    };

    try {
      var pdfArrayBuffer = await html2pdf()
        .set(opt)
        .from(el)
        .outputPdf("arraybuffer");

      var pdfDoc = await PDFLib.PDFDocument.load(pdfArrayBuffer);
      try {
        await pdfDoc.attach(jsonBytes, BUILDMAN_STATE_FILENAME, {
          mimeType: "application/json",
          description: "Buildman Inc. editable document",
        });
      } catch (attachErr) {
        console.warn(attachErr);
      }

      var outBytes = await pdfDoc.save();
      var blob = new Blob([outBytes], { type: "application/pdf" });
      var a = document.createElement("a");
      var stamp = new Date().toISOString().slice(0, 10);
      a.href = URL.createObjectURL(blob);
      a.download = "buildman-" + state.mode + "-" + stamp + ".pdf";
      a.click();
      URL.revokeObjectURL(a.href);
      showToast("PDF downloaded. Re-import here to edit again.");
    } catch (err) {
      console.error(err);
      showToast("PDF export failed. Try Print PDF instead.");
    }
  }

  async function importPdfFile(file) {
    if (typeof pdfjsLib === "undefined") {
      showToast("PDF import library did not load. Check your connection.");
      return;
    }
    var buf;
    try {
      buf = await file.arrayBuffer();
    } catch (e) {
      showToast("Could not read file.");
      return;
    }

    var pdf = null;
    try {
      var loadingTask = pdfjsLib.getDocument({ data: buf });
      pdf = await loadingTask.promise;
      if (typeof pdf.getAttachments !== "function") {
        showToast("PDF import is not available in this browser.");
        return;
      }
      var attachments = await pdf.getAttachments();

      if (!attachments || !Object.keys(attachments).length) {
        showToast("No app data in PDF. Export from this app first.");
        return;
      }

      var decoded = null;
      var key;
      for (key in attachments) {
        if (!Object.prototype.hasOwnProperty.call(attachments, key)) continue;
        var att = attachments[key];
        var content = att && (att.content || att.data);
        if (!content) continue;
        var bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
        var text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
        try {
          var data = JSON.parse(text);
          if (data && data.buildmanExportVersion === 1) {
            decoded = data;
            break;
          }
        } catch (parseErr) {
          /* try next */
        }
      }

      if (!decoded) {
        showToast("No Buildman data in this PDF. Use Export PDF from this app.");
        return;
      }

      applyImportedPayload(decoded);
      showToast("Imported from PDF.");
    } catch (err) {
      console.error(err);
      showToast("Could not read PDF.");
    } finally {
      if (pdf && typeof pdf.destroy === "function") pdf.destroy();
    }
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function freshInvoice() {
    var inv = deepClone(DEFAULT_INVOICE);
    inv.items = buildDefaultInvoiceItems();
    return inv;
  }

  function freshQuote() {
    var q = deepClone(DEFAULT_QUOTE);
    q.scopeLines = buildDefaultQuoteScope();
    return q;
  }

  var state = {
    mode: "invoice",
    autoTotals: true,
    taxRate: TAX_RATE_DEFAULT,
    invoice: freshInvoice(),
    quote: freshQuote(),
  };

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatMultiline(s) {
    return escapeHtml(s).replace(/\r\n|\r|\n/g, "<br />");
  }

  /** @returns {number|null} */
  function parseNum(str) {
    if (str == null) return null;
    var t = String(str).trim();
    if (t === "") return null;
    var n = parseFloat(t.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  /** @returns {string} */
  function formatMoney(n) {
    if (n == null || !Number.isFinite(n)) return "";
    return n.toLocaleString("en-CA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function parseTaxRate(str) {
    var t = String(str ?? "").trim();
    if (t === "") return 0.13;
    var n = parseFloat(t.replace(/%/g, ""));
    if (!Number.isFinite(n)) return 0.13;
    if (n > 1) n = n / 100;
    return n;
  }

  function effectiveInvoiceLineAmount(row) {
    var a = parseNum(row.a);
    if (a !== null) return a;
    if (!state.autoTotals) return null;
    var q = parseNum(row.q);
    var p = parseNum(row.p);
    if (q !== null && p !== null) return q * p;
    return null;
  }

  function displayMoneyOrBlank(strOrNum) {
    if (typeof strOrNum === "number")
      return strOrNum !== null && Number.isFinite(strOrNum)
        ? formatMoney(strOrNum)
        : "";
    var p = parseNum(strOrNum);
    return p !== null ? formatMoney(p) : "";
  }

  function sumInvoiceLines() {
    var inv = state.invoice;
    var sum = 0;
    var any = false;
    var i;
    for (i = 0; i < inv.items.length; i++) {
      var v = effectiveInvoiceLineAmount(inv.items[i]);
      if (v !== null) {
        sum += v;
        any = true;
      }
    }
    return any ? sum : null;
  }

  function applyInvoiceAutoTotals() {
    var inv = state.invoice;
    if (!state.autoTotals || inv.skipAutoTotals) return;
    var sub = sumInvoiceLines();
    var rate = parseTaxRate(state.taxRate);
    if (sub === null) {
      inv.subtotal = "";
      inv.hst = "";
      if (parseNum(inv.pst) === null) inv.pst = "";
      inv.total = "";
      return;
    }
    inv.subtotal = formatMoney(sub);
    var hstVal = sub * rate;
    inv.hst = formatMoney(hstVal);
    var pstVal = parseNum(inv.pst);
    var pstNum = pstVal !== null ? pstVal : 0;
    inv.total = formatMoney(sub + hstVal + pstNum);
  }

  function effectiveQuoteLineAmount(row) {
    return parseNum(row.amt);
  }

  function sumQuoteScope() {
    var q = state.quote;
    var sum = 0;
    var any = false;
    var i;
    for (i = 0; i < q.scopeLines.length; i++) {
      var v = effectiveQuoteLineAmount(q.scopeLines[i]);
      if (v !== null) {
        sum += v;
        any = true;
      }
    }
    return any ? sum : null;
  }

  function applyQuoteAutoTotals() {
    var q = state.quote;
    if (!state.autoTotals || q.skipAutoTotals) return;
    var net = sumQuoteScope();
    var rate = parseTaxRate(state.taxRate);
    if (net === null) {
      q.netTotal = "";
      q.hst = "";
      q.payable = "";
      return;
    }
    q.netTotal = formatMoney(net);
    var hstVal = net * rate;
    q.hst = formatMoney(hstVal);
    q.payable = formatMoney(net + hstVal);
  }

  function renderInvoicePreview() {
    var inv = state.invoice;
    var rowsHtml = "";
    var i;
    for (i = 0; i < inv.items.length; i++) {
      var row = inv.items[i];
      var eff = effectiveInvoiceLineAmount(row);
      var qtyDisp = row.q === "" ? "" : escapeHtml(row.q);
      var priceDisp = displayMoneyOrBlank(row.p);
      var amtDisp =
        row.a !== "" && row.a != null
          ? displayMoneyOrBlank(row.a)
          : eff !== null
            ? formatMoney(eff)
            : "";
      rowsHtml +=
        "<tr><td class=\"col-qty\">" +
        (qtyDisp || "&nbsp;") +
        "</td><td class=\"col-desc\">" +
        formatMultiline(row.d) +
        "</td><td class=\"col-price\">" +
        (priceDisp || "&nbsp;") +
        "</td><td class=\"col-amt\">" +
        (amtDisp || "&nbsp;") +
        "</td></tr>";
    }

    var toLines = inv.toLines.length ? inv.toLines : ["", "", ""];
    while (toLines.length < 3) toLines.push("");

    return (
      '<article class="doc doc--invoice" aria-label="Invoice preview">' +
      '<div class="invoice-top">' +
      '<div class="invoice-left">' +
      '<div class="doc-banner doc-banner--invoice">' +
      '<img src="assets/buildman-banner.jpg" alt="Buildman Inc. — Custom Build" width="320" height="80" />' +
      "</div>" +
      '<div class="invoice-company">' +
      '<div class="invoice-company__name">Buildman Inc.</div>' +
      "<div>HST#811467117 RT0001</div>" +
      "<div>(416) 319-0601</div>" +
      "<div>www.buildman.ca</div>" +
      "<div>alexzax1977@yahoo.com</div>" +
      "</div></div>" +
      '<div class="invoice-meta-block">' +
      '<div class="invoice-stamp">INVOICE</div>' +
      '<div class="invoice-serial">' +
      escapeHtml(inv.invoiceNumber) +
      "</div>" +
      '<dl class="invoice-mini-grid">' +
      "<dt>DATE</dt><dd>" +
      escapeHtml(inv.date) +
      "</dd>" +
      "<dt>SALES PERSON</dt><dd>" +
      escapeHtml(inv.salesperson) +
      "</dd>" +
      "<dt>YOUR ORDER NO.</dt><dd>" +
      escapeHtml(inv.orderNo) +
      "</dd>" +
      "</dl></div></div>" +
      '<div class="inv-to"><div class="inv-to__label">TO:</div>' +
      '<div class="inv-to__line">' +
      formatMultiline(toLines[0]) +
      "</div>" +
      '<div class="inv-to__line">' +
      formatMultiline(toLines[1]) +
      "</div>" +
      '<div class="inv-to__line">' +
      formatMultiline(toLines[2]) +
      "</div></div>" +
      '<table class="table-pad" role="table">' +
      "<thead><tr>" +
      '<th scope="col" class="col-qty">Quantity</th>' +
      '<th scope="col" class="col-desc">Description</th>' +
      '<th scope="col" class="col-price">Price</th>' +
      '<th scope="col" class="col-amt">Amount</th>' +
      "</tr></thead><tbody>" +
      rowsHtml +
      "</tbody></table>" +
      '<div class="invoice-foot">' +
      '<div class="invoice-terms"><div class="invoice-terms__label">TERMS</div>' +
      '<div class="invoice-terms__body">' +
      formatMultiline(inv.terms) +
      "</div></div>" +
      '<table class="totals-grid" role="table">' +
      "<tbody>" +
      "<tr><td>SUBTOTAL</td><td>" +
      (displayMoneyOrBlank(inv.subtotal) || "&nbsp;") +
      "</td></tr>" +
      "<tr><td>HST / GST</td><td>" +
      (displayMoneyOrBlank(inv.hst) || "&nbsp;") +
      "</td></tr>" +
      "<tr><td>&nbsp;</td><td>&nbsp;</td></tr>" +
      "<tr><td>PST</td><td>" +
      (displayMoneyOrBlank(inv.pst) || "&nbsp;") +
      "</td></tr>" +
      '<tr class="total-row"><td>TOTAL</td><td>' +
      (displayMoneyOrBlank(inv.total) || "&nbsp;") +
      "</td></tr>" +
      "</tbody></table></div>" +
      '<p class="thank-you">THANK YOU</p>' +
      "</article>"
    );
  }

  function quotePartyBlock(lines) {
    var html = "";
    var i;
    for (i = 0; i < lines.length; i++) {
      if (lines[i]) html += lines[i];
    }
    return html || "<p>&nbsp;</p>";
  }

  function renderQuotePreview() {
    var q = state.quote;
    var c = q.customer;
    var r = q.rep;
    var custLines = [];
    if (c.name && String(c.name).trim())
      custLines.push("<p><strong>" + escapeHtml(c.name) + "</strong></p>");
    if (c.address && String(c.address).trim())
      custLines.push("<p>" + formatMultiline(c.address) + "</p>");
    if (c.phone && String(c.phone).trim())
      custLines.push("<p>" + escapeHtml(c.phone) + "</p>");
    if (c.email && String(c.email).trim())
      custLines.push("<p>" + escapeHtml(c.email) + "</p>");
    var repLines = [];
    if (r.name && String(r.name).trim())
      repLines.push("<p>" + escapeHtml(r.name) + "</p>");
    if (r.phone && String(r.phone).trim())
      repLines.push("<p>" + escapeHtml(r.phone) + "</p>");
    if (r.email && String(r.email).trim())
      repLines.push("<p>" + escapeHtml(r.email) + "</p>");
    var rowsHtml = "";
    var i;
    if (q.sectionTitle && String(q.sectionTitle).trim()) {
      rowsHtml +=
        '<tr><td colspan="2" class="quote-section-title">' +
        escapeHtml(q.sectionTitle) +
        "</td></tr>";
    }
    for (i = 0; i < q.scopeLines.length; i++) {
      var row = q.scopeLines[i];
      var amt =
        row.amt !== "" && row.amt != null
          ? displayMoneyOrBlank(row.amt)
          : "";
      rowsHtml +=
        "<tr><td>" +
        formatMultiline(row.desc) +
        "</td><td>" +
        (amt || "&nbsp;") +
        "</td></tr>";
    }

    var notesBlock = "";
    if (q.noteInclusion && String(q.noteInclusion).trim())
      notesBlock +=
        "<div class=\"quote-notes\"><h3>Inclusions / exclusions</h3><p>" +
        formatMultiline(q.noteInclusion) +
        "</p></div>";
    if (q.noteTiming && String(q.noteTiming).trim())
      notesBlock +=
        "<div class=\"quote-notes\"><h3>Project timing</h3><p>" +
        formatMultiline(q.noteTiming) +
        "</p></div>";
    if (q.noteLandscape && String(q.noteLandscape).trim())
      notesBlock +=
        "<div class=\"quote-notes\"><h3>Landscaping / additional</h3><p>" +
        formatMultiline(q.noteLandscape) +
        "</p></div>";

    return (
      '<article class="doc doc--quote" aria-label="Quote preview">' +
      '<div class="doc-banner">' +
      '<img src="assets/buildman-banner.jpg" alt="Buildman Inc. — Custom Build" width="520" height="120" />' +
      "</div>" +
      '<div class="quote-meta-row">' +
      '<div class="quote-box"><div class="quote-box__label">Quote date</div><p>' +
      escapeHtml(q.quoteDate) +
      "</p></div>" +
      '<div class="quote-box"><div class="quote-box__label">Quote number</div><p>' +
      escapeHtml(q.quoteNumber) +
      "</p></div></div>" +
      '<div class="quote-two-col">' +
      '<div class="quote-box"><div class="quote-box__label">Customer information</div>' +
      quotePartyBlock(custLines) +
      "</div>" +
      '<div class="quote-box"><div class="quote-box__label">Company representative</div>' +
      quotePartyBlock(repLines) +
      "</div></div>" +
      '<table class="quote-table" role="table">' +
      "<thead><tr><th scope=\"col\">Product / services</th><th scope=\"col\">Amount</th></tr></thead><tbody>" +
      rowsHtml +
      "</tbody></table>" +
      (q.transferEmail && String(q.transferEmail).trim()
        ? '<p class="quote-transfer">Email address for money transfer: ' +
          escapeHtml(q.transferEmail) +
          "</p>"
        : "") +
      notesBlock +
      '<div class="quote-bottom">' +
      '<div class="quote-accept">' +
      (q.acceptHeading && String(q.acceptHeading).trim()
        ? '<div class="quote-accept__head">' +
          escapeHtml(q.acceptHeading) +
          "</div>"
        : "") +
      '<div class="quote-accept__legal">' +
      (q.acceptLegal && String(q.acceptLegal).trim()
        ? formatMultiline(q.acceptLegal)
        : "&nbsp;") +
      "</div>" +
      (q.acceptName && String(q.acceptName).trim()
        ? "<p><strong>Registered owner(s):</strong> " +
          escapeHtml(q.acceptName) +
          "</p>"
        : "") +
      "<div><strong>Customer(s) signature</strong></div>" +
      '<div class="sig-line">&nbsp;</div>' +
      "<div class=\"sig-row\"><strong>Date:</strong> " +
      escapeHtml(q.acceptDate) +
      "</div></div>" +
      '<div class="quote-totals-wrap">' +
      '<table class="quote-totals" role="table">' +
      "<tbody>" +
      "<tr><td>Net total</td><td>" +
      (displayMoneyOrBlank(q.netTotal) || "&nbsp;") +
      "</td></tr>" +
      "<tr><td>HST</td><td>" +
      (displayMoneyOrBlank(q.hst) || "&nbsp;") +
      "</td></tr>" +
      '<tr class="payable"><td>Payable</td><td>' +
      (displayMoneyOrBlank(q.payable) || "&nbsp;") +
      "</td></tr>" +
      "</tbody></table>" +
      '<p class="quote-valid">Quote valid for 30 calendar days</p>' +
      "</div></div>" +
      '<p class="quote-doc-footer">Customer quote</p>' +
      "</article>"
    );
  }

  function renderPreview() {
    var root = document.getElementById("print-root");
    if (!root) return;
    if (state.mode === "invoice") {
      root.innerHTML = renderInvoicePreview();
    } else {
      root.innerHTML = renderQuotePreview();
    }
  }

  function readInvoiceFromEditors() {
    var inv = state.invoice;
    inv.invoiceNumber = document.getElementById("inv-number").value;
    inv.date = document.getElementById("inv-date").value;
    inv.salesperson = document.getElementById("inv-sales").value;
    inv.orderNo = document.getElementById("inv-order").value;
    inv.toLines = [
      document.getElementById("inv-to-1").value,
      document.getElementById("inv-to-2").value,
      document.getElementById("inv-to-3").value,
    ];
    inv.terms = document.getElementById("inv-terms").value;
    inv.subtotal = document.getElementById("inv-subtotal").value;
    inv.hst = document.getElementById("inv-hst").value;
    inv.pst = document.getElementById("inv-pst").value;
    inv.total = document.getElementById("inv-total").value;
    var tbody = document.getElementById("inv-lines-body");
    var rows = tbody.querySelectorAll("tr");
    inv.items = [];
    var i;
    for (i = 0; i < rows.length; i++) {
      var inp = rows[i].querySelectorAll("input, textarea");
      inv.items.push({
        q: inp[0] ? inp[0].value : "",
        d: inp[1] ? inp[1].value : "",
        p: inp[2] ? inp[2].value : "",
        a: inp[3] ? inp[3].value : "",
      });
    }
  }

  function writeInvoiceEditors() {
    var inv = state.invoice;
    document.getElementById("inv-number").value = inv.invoiceNumber;
    document.getElementById("inv-date").value = inv.date;
    document.getElementById("inv-sales").value = inv.salesperson;
    document.getElementById("inv-order").value = inv.orderNo;
    document.getElementById("inv-to-1").value = inv.toLines[0] || "";
    document.getElementById("inv-to-2").value = inv.toLines[1] || "";
    document.getElementById("inv-to-3").value = inv.toLines[2] || "";
    document.getElementById("inv-terms").value = inv.terms;
    document.getElementById("inv-subtotal").value = inv.subtotal;
    document.getElementById("inv-hst").value = inv.hst;
    document.getElementById("inv-pst").value = inv.pst;
    document.getElementById("inv-total").value = inv.total;
    renderInvoiceLineEditors();
  }

  function renderInvoiceLineEditors() {
    var tbody = document.getElementById("inv-lines-body");
    tbody.innerHTML = "";
    var inv = state.invoice;
    var i;
    for (i = 0; i < inv.items.length; i++) {
      var row = inv.items[i];
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td><input type=\"text\" aria-label=\"Quantity row " +
        (i + 1) +
        "\" /></td>" +
        "<td><textarea rows=\"2\" aria-label=\"Description row " +
        (i + 1) +
        "\"></textarea></td>" +
        "<td><input type=\"text\" inputmode=\"decimal\" aria-label=\"Price row " +
        (i + 1) +
        "\" /></td>" +
        "<td><input type=\"text\" inputmode=\"decimal\" aria-label=\"Amount row " +
        (i + 1) +
        "\" /></td>";
      var fields = tr.querySelectorAll("input, textarea");
      fields[0].value = row.q;
      fields[1].value = row.d;
      fields[2].value = row.p;
      fields[3].value = row.a;
      tbody.appendChild(tr);
    }
    bindInvoiceLineInputs();
  }

  function bindInvoiceLineInputs() {
    var tbody = document.getElementById("inv-lines-body");
    tbody.oninput = function () {
      readInvoiceFromEditors();
      if (state.autoTotals && !state.invoice.skipAutoTotals) applyInvoiceAutoTotals();
      writeInvoiceEditorsTotalsOnly();
      renderPreview();
    };
  }

  function writeInvoiceEditorsTotalsOnly() {
    var inv = state.invoice;
    document.getElementById("inv-subtotal").value = inv.subtotal;
    document.getElementById("inv-hst").value = inv.hst;
    document.getElementById("inv-pst").value = inv.pst;
    document.getElementById("inv-total").value = inv.total;
  }

  function readQuoteFromEditors() {
    var q = state.quote;
    q.quoteDate = document.getElementById("qt-date").value;
    q.quoteNumber = document.getElementById("qt-number").value;
    q.customer.name = document.getElementById("qt-cust-name").value;
    q.customer.address = document.getElementById("qt-cust-addr").value;
    q.customer.phone = document.getElementById("qt-cust-phone").value;
    q.customer.email = document.getElementById("qt-cust-email").value;
    q.rep.name = document.getElementById("qt-rep-name").value;
    q.rep.phone = document.getElementById("qt-rep-phone").value;
    q.rep.email = document.getElementById("qt-rep-email").value;
    q.sectionTitle = document.getElementById("qt-section").value;
    q.noteInclusion = document.getElementById("qt-note-inclusion").value;
    q.noteTiming = document.getElementById("qt-note-timing").value;
    q.noteLandscape = document.getElementById("qt-note-landscape").value;
    q.transferEmail = document.getElementById("qt-transfer-email").value;
    q.acceptHeading = document.getElementById("qt-accept-head").value;
    q.acceptLegal = document.getElementById("qt-accept-legal").value;
    q.acceptName = document.getElementById("qt-accept-name").value;
    q.acceptDate = document.getElementById("qt-accept-date").value;
    q.netTotal = document.getElementById("qt-net").value;
    q.hst = document.getElementById("qt-hst").value;
    q.payable = document.getElementById("qt-payable").value;
    var tbody = document.getElementById("qt-lines-body");
    var rows = tbody.querySelectorAll("tr");
    q.scopeLines = [];
    var i;
    for (i = 0; i < rows.length; i++) {
      var ta = rows[i].querySelector("textarea");
      var inp = rows[i].querySelector("input");
      q.scopeLines.push({
        desc: ta ? ta.value : "",
        amt: inp ? inp.value : "",
      });
    }
  }

  function writeQuoteEditors() {
    var q = state.quote;
    document.getElementById("qt-date").value = q.quoteDate;
    document.getElementById("qt-number").value = q.quoteNumber;
    document.getElementById("qt-cust-name").value = q.customer.name;
    document.getElementById("qt-cust-addr").value = q.customer.address;
    document.getElementById("qt-cust-phone").value = q.customer.phone;
    document.getElementById("qt-cust-email").value = q.customer.email;
    document.getElementById("qt-rep-name").value = q.rep.name;
    document.getElementById("qt-rep-phone").value = q.rep.phone;
    document.getElementById("qt-rep-email").value = q.rep.email;
    document.getElementById("qt-section").value = q.sectionTitle;
    document.getElementById("qt-note-inclusion").value = q.noteInclusion;
    document.getElementById("qt-note-timing").value = q.noteTiming;
    document.getElementById("qt-note-landscape").value = q.noteLandscape;
    document.getElementById("qt-transfer-email").value = q.transferEmail;
    document.getElementById("qt-accept-head").value = q.acceptHeading;
    document.getElementById("qt-accept-legal").value = q.acceptLegal;
    document.getElementById("qt-accept-name").value = q.acceptName;
    document.getElementById("qt-accept-date").value = q.acceptDate;
    document.getElementById("qt-net").value = q.netTotal;
    document.getElementById("qt-hst").value = q.hst;
    document.getElementById("qt-payable").value = q.payable;
    renderQuoteLineEditors();
  }

  function renderQuoteLineEditors() {
    var tbody = document.getElementById("qt-lines-body");
    tbody.innerHTML = "";
    var q = state.quote;
    var i;
    for (i = 0; i < q.scopeLines.length; i++) {
      var row = q.scopeLines[i];
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td><textarea rows=\"2\" aria-label=\"Scope line " +
        (i + 1) +
        " description\"></textarea></td>" +
        "<td><input type=\"text\" inputmode=\"decimal\" aria-label=\"Scope line " +
        (i + 1) +
        " amount\" /></td>";
      var ta = tr.querySelector("textarea");
      var inp = tr.querySelector("input");
      ta.value = row.desc;
      inp.value = row.amt;
      tbody.appendChild(tr);
    }
    bindQuoteLineInputs();
  }

  function bindQuoteLineInputs() {
    var tbody = document.getElementById("qt-lines-body");
    tbody.oninput = function () {
      readQuoteFromEditors();
      if (state.autoTotals && !state.quote.skipAutoTotals) applyQuoteAutoTotals();
      writeQuoteEditorsTotalsOnly();
      renderPreview();
    };
  }

  function writeQuoteEditorsTotalsOnly() {
    var q = state.quote;
    document.getElementById("qt-net").value = q.netTotal;
    document.getElementById("qt-hst").value = q.hst;
    document.getElementById("qt-payable").value = q.payable;
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll(".mode-switch__btn").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.mode === mode);
    });
    document.getElementById("editor-invoice").hidden = mode !== "invoice";
    document.getElementById("editor-quote").hidden = mode !== "quote";
    if (mode === "invoice") writeInvoiceEditors();
    else writeQuoteEditors();
    renderPreview();
  }

  function showToast(msg) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      el.hidden = true;
    }, 3200);
  }

  function buildShareText() {
    var lines = [];
    lines.push("Buildman Inc.");
    lines.push("");
    if (state.mode === "invoice") {
      var inv = state.invoice;
      lines.push("INVOICE #" + inv.invoiceNumber);
      lines.push("Date: " + inv.date);
      lines.push("Order: " + inv.orderNo);
      lines.push("");
      lines.push("Bill to:");
      inv.toLines.forEach(function (l) {
        if (l && l.trim()) lines.push(l);
      });
      lines.push("");
      lines.push("Line items:");
      inv.items.forEach(function (row, idx) {
        if (!row.d && !row.q && !row.p && !row.a) return;
        lines.push(
          (idx + 1) + ". " + (row.d || "").replace(/\s+/g, " ").trim()
        );
      });
      lines.push("");
      lines.push("Subtotal: " + (inv.subtotal || "").trim());
      lines.push("HST/GST: " + (inv.hst || "").trim());
      lines.push("PST: " + (inv.pst || "").trim());
      lines.push("Total: " + (inv.total || "").trim());
    } else {
      var q = state.quote;
      lines.push("QUOTE #" + q.quoteNumber);
      lines.push("Date: " + q.quoteDate);
      lines.push("");
      lines.push("Customer: " + q.customer.name);
      lines.push(q.customer.address);
      lines.push("");
      lines.push("Scope:");
      q.scopeLines.forEach(function (row, idx) {
        if (!row.desc || !row.desc.trim()) return;
        lines.push("• " + row.desc.replace(/\s+/g, " ").trim());
      });
      lines.push("");
      lines.push("Net: " + (q.netTotal || "").trim());
      lines.push("HST: " + (q.hst || "").trim());
      lines.push("Payable: " + (q.payable || "").trim());
      lines.push("");
      lines.push("Quote valid for 30 calendar days.");
    }
    return lines.join("\n");
  }

  async function shareDocument() {
    var text = buildShareText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Buildman Inc. document",
          text: text,
        });
        showToast("Shared.");
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast("Summary copied to clipboard.");
    } catch (e2) {
      showToast("Could not copy — select preview and copy manually.");
    }
  }

  function duplicateCurrent() {
    if (state.mode === "invoice") {
      state.invoice = deepClone(state.invoice);
      var invN = String(state.invoice.invoiceNumber || "").trim();
      state.invoice.invoiceNumber = invN ? invN + "-COPY" : "COPY";
      writeInvoiceEditors();
    } else {
      state.quote = deepClone(state.quote);
      var qN = String(state.quote.quoteNumber || "").trim();
      state.quote.quoteNumber = qN ? qN + "-COPY" : "COPY";
      writeQuoteEditors();
    }
    renderPreview();
    showToast("Duplicate created — adjust numbers as needed.");
  }

  function init() {
    document.getElementById("auto-totals").checked = state.autoTotals;
    document.getElementById("tax-rate").value = state.taxRate;

    document.getElementById("mode-invoice").addEventListener("click", function () {
      setMode("invoice");
    });
    document.getElementById("mode-quote").addEventListener("click", function () {
      setMode("quote");
    });

    document.getElementById("btn-new-invoice").addEventListener("click", function () {
      state.invoice = freshInvoice();
      state.invoice.skipAutoTotals = false;
      setMode("invoice");
      showToast("New invoice loaded.");
    });
    document.getElementById("btn-new-quote").addEventListener("click", function () {
      state.quote = freshQuote();
      state.quote.skipAutoTotals = false;
      setMode("quote");
      showToast("New quote loaded.");
    });
    document.getElementById("btn-duplicate").addEventListener("click", duplicateCurrent);
    document.getElementById("btn-reset").addEventListener("click", function () {
      if (state.mode === "invoice") {
        state.invoice = freshInvoice();
        state.invoice.skipAutoTotals = false;
        writeInvoiceEditors();
      } else {
        state.quote = freshQuote();
        state.quote.skipAutoTotals = false;
        writeQuoteEditors();
      }
      if (state.autoTotals) {
        if (state.mode === "invoice") applyInvoiceAutoTotals();
        else applyQuoteAutoTotals();
      }
      if (state.mode === "invoice") writeInvoiceEditors();
      else writeQuoteEditors();
      renderPreview();
      showToast("Template reset.");
    });
    document.getElementById("btn-print").addEventListener("click", function () {
      if (state.mode === "invoice") readInvoiceFromEditors();
      else readQuoteFromEditors();
      renderPreview();
      window.print();
    });
    document.getElementById("btn-export-pdf").addEventListener("click", function () {
      exportPdfFile();
    });
    document.getElementById("import-pdf").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) importPdfFile(f);
      e.target.value = "";
    });
    document.getElementById("btn-share").addEventListener("click", function () {
      if (state.mode === "invoice") readInvoiceFromEditors();
      else readQuoteFromEditors();
      renderPreview();
      shareDocument();
    });

    document.getElementById("auto-totals").addEventListener("change", function (e) {
      state.autoTotals = e.target.checked;
      state.invoice.skipAutoTotals = false;
      state.quote.skipAutoTotals = false;
      if (state.autoTotals) {
        if (state.mode === "invoice") {
          readInvoiceFromEditors();
          applyInvoiceAutoTotals();
          writeInvoiceEditors();
        } else {
          readQuoteFromEditors();
          applyQuoteAutoTotals();
          writeQuoteEditors();
        }
      }
      renderPreview();
    });

    document.getElementById("tax-rate").addEventListener("input", function (e) {
      state.taxRate = e.target.value;
      if (state.autoTotals) {
        if (state.mode === "invoice") {
          readInvoiceFromEditors();
          if (!state.invoice.skipAutoTotals) applyInvoiceAutoTotals();
          writeInvoiceEditorsTotalsOnly();
        } else {
          readQuoteFromEditors();
          if (!state.quote.skipAutoTotals) applyQuoteAutoTotals();
          writeQuoteEditorsTotalsOnly();
        }
      }
      renderPreview();
    });

    document.getElementById("btn-sync-totals").addEventListener("click", function () {
      state.invoice.skipAutoTotals = false;
      state.quote.skipAutoTotals = false;
      if (state.mode === "invoice") readInvoiceFromEditors();
      else readQuoteFromEditors();
      if (state.autoTotals) {
        if (state.mode === "invoice") applyInvoiceAutoTotals();
        else applyQuoteAutoTotals();
      }
      if (state.mode === "invoice") writeInvoiceEditors();
      else writeQuoteEditors();
      renderPreview();
      showToast("Totals synced from lines.");
    });

    function recalcInvoiceTotalFromParts() {
      var inv = state.invoice;
      var s = parseNum(inv.subtotal);
      var h = parseNum(inv.hst);
      if (s === null || h === null) return;
      var p = parseNum(inv.pst);
      var pNum = p !== null ? p : 0;
      inv.total = formatMoney(s + h + pNum);
      writeInvoiceEditorsTotalsOnly();
    }

    function wireInvoiceFields() {
      var ids = [
        "inv-number",
        "inv-date",
        "inv-sales",
        "inv-order",
        "inv-to-1",
        "inv-to-2",
        "inv-to-3",
        "inv-terms",
        "inv-subtotal",
        "inv-hst",
        "inv-pst",
        "inv-total",
      ];
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        el.addEventListener("input", function () {
          readInvoiceFromEditors();
          if (id === "inv-subtotal" || id === "inv-hst" || id === "inv-total") {
            state.invoice.skipAutoTotals = true;
          }
          if (id === "inv-pst" && state.autoTotals && !state.invoice.skipAutoTotals) {
            recalcInvoiceTotalFromParts();
            renderPreview();
            return;
          }
          if (state.autoTotals && !state.invoice.skipAutoTotals) {
            applyInvoiceAutoTotals();
            writeInvoiceEditorsTotalsOnly();
          }
          renderPreview();
        });
      });
    }

    function wireQuoteFields() {
      var ids = [
        "qt-date",
        "qt-number",
        "qt-cust-name",
        "qt-cust-addr",
        "qt-cust-phone",
        "qt-cust-email",
        "qt-rep-name",
        "qt-rep-phone",
        "qt-rep-email",
        "qt-section",
        "qt-note-inclusion",
        "qt-note-timing",
        "qt-note-landscape",
        "qt-transfer-email",
        "qt-accept-head",
        "qt-accept-legal",
        "qt-accept-name",
        "qt-accept-date",
        "qt-net",
        "qt-hst",
        "qt-payable",
      ];
      ids.forEach(function (id) {
        document.getElementById(id).addEventListener("input", function () {
          readQuoteFromEditors();
          if (id === "qt-net" || id === "qt-hst" || id === "qt-payable") {
            state.quote.skipAutoTotals = true;
          }
          if (state.autoTotals && !state.quote.skipAutoTotals) {
            applyQuoteAutoTotals();
            writeQuoteEditorsTotalsOnly();
          }
          renderPreview();
        });
      });
    }

    wireInvoiceFields();
    wireQuoteFields();

    document.getElementById("inv-add-row").addEventListener("click", function () {
      readInvoiceFromEditors();
      state.invoice.items.push({ q: "", d: "", p: "", a: "" });
      if (state.autoTotals && !state.invoice.skipAutoTotals) applyInvoiceAutoTotals();
      writeInvoiceEditors();
      renderPreview();
    });
    document.getElementById("inv-del-row").addEventListener("click", function () {
      readInvoiceFromEditors();
      if (state.invoice.items.length > 1) state.invoice.items.pop();
      if (state.autoTotals && !state.invoice.skipAutoTotals) applyInvoiceAutoTotals();
      writeInvoiceEditors();
      renderPreview();
    });
    document.getElementById("qt-add-row").addEventListener("click", function () {
      readQuoteFromEditors();
      state.quote.scopeLines.push({ desc: "", amt: "" });
      if (state.autoTotals && !state.quote.skipAutoTotals) applyQuoteAutoTotals();
      writeQuoteEditors();
      renderPreview();
    });
    document.getElementById("qt-del-row").addEventListener("click", function () {
      readQuoteFromEditors();
      if (state.quote.scopeLines.length > 1) state.quote.scopeLines.pop();
      if (state.autoTotals && !state.quote.skipAutoTotals) applyQuoteAutoTotals();
      writeQuoteEditors();
      renderPreview();
    });

    writeInvoiceEditors();
    writeQuoteEditors();
    if (state.autoTotals) {
      applyInvoiceAutoTotals();
      if (sumQuoteScope() !== null) applyQuoteAutoTotals();
      writeInvoiceEditors();
      writeQuoteEditors();
    }
    setMode("invoice");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
