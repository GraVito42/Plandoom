function sendGlando(dic_raw) {
  try {
    var dic = _sg_normalize(dic_raw);          // -> { events:[...] }
    _sg_validate(dic.events);                  // lancia se non valida
    return upsert(dic);                        // usa la tua funzione minimale
  } catch (e) {
    var err = String(e && e.message ? e.message : e);
    try { Logger.log("sendGlando error: " + err); } catch(_){}
    return { ok: false, error: err };
  }
}
function _sg_normalize(input) {
  var obj = input;

  // Se stringa → parse
  if (typeof obj === "string") {
    var trimmed = obj.trim();
    if (!trimmed) throw new Error("Input vuoto.");
    try { obj = JSON.parse(trimmed); }
    catch(e){ throw new Error("Stringa JSON non valida."); }
  }

  // Se array di eventi
  if (Array.isArray(obj)) return { events: obj };

  // Se oggetto con events
  if (obj && typeof obj === "object") {
    if (Array.isArray(obj.events)) return { events: obj.events };
    // Se sembra un singolo evento
    var looksLikeEvent = ("title" in obj) || ("start" in obj) || ("due" in obj);
    if (looksLikeEvent) return { events: [obj] };
  }

  throw new Error("Formato non riconosciuto: usa {events:[...]}, un array di eventi o un singolo evento.");
}

function _sg_validate(events) {
  if (!events || !events.length) throw new Error("Nessun evento trovato.");

  var errs = [];
  for (var i = 0; i < events.length; i++) {
    var ev = events[i] || {};
    var ctx = "evento #" + (i + 1) + ": ";
    // title
    if (typeof ev.title !== "string" || !ev.title.trim())
      errs.push(ctx + "campo 'title' mancante o vuoto.");
    // date: start o due
    var hasStart = typeof ev.start === "string" && _sg_isIsoDate(ev.start);
    var hasDue   = typeof ev.due   === "string" && _sg_isIsoDate(ev.due);

    if (!hasStart && !hasDue)
      errs.push(ctx + "serve almeno 'start' o 'due' in formato ISO (es. 2025-10-21T14:30:00Z).");

    // end opzionale: se presente dev’essere valido ISO
    if (typeof ev.end !== "undefined" && ev.end !== null) {
      if (typeof ev.end !== "string" || !_sg_isIsoDate(ev.end))
        errs.push(ctx + "'end' non è una data ISO valida.");
    }

    // coerenza temporale se start & end presenti
    if (hasStart && typeof ev.end === "string" && _sg_isIsoDate(ev.end)) {
      var s = new Date(ev.start).getTime();
      var e = new Date(ev.end).getTime();
      if (!(e > s)) errs.push(ctx + "'end' deve essere successivo a 'start'.");
    }
  }

  if (errs.length) throw new Error("Validazione fallita:\n- " + errs.join("\n- "));
}

function _sg_isIsoDate(s) {
  // Accetta ISO standard (toISOString-like); Date.parse basta per convalida base
  var t = Date.parse(s);
  return !isNaN(t);
}

function gl_gs_upsert(dic) {
  var p   = PropertiesService.getScriptProperties();
  var sid = p.getProperty("GLANDO_SHEET_ID");
  var sname = p.getProperty("GLANDO_SHEET_NAME") || "Glando";
  if (!sid) throw new Error("GLANDO_SHEET_ID non configurato.");

  var sh = _gs_getSheet_(sid, sname);
  _gs_ensureHeaders_(sh);

  var headers = _gs_readHeaders_(sh);                 // array di header
  var idxExternal = headers.indexOf("ExternalID");    // 0-based
  if (idxExternal < 0) throw new Error("Header 'ExternalID' mancante.");

  var rows = Math.max(sh.getLastRow() - 1, 0);
  var cols = headers.length;
  var existing = rows ? sh.getRange(2, 1, rows, cols).getValues() : [];

  // Mappa ExternalID -> rowIndex (in foglio, 1-based)
  var rowByExt = {};
  for (var r = 0; r < existing.length; r++) {
    var ext = existing[r][idxExternal] || "";
    if (ext) rowByExt[ext] = r + 2; // riga del foglio (2 = prima riga dopo header)
  }

  (dic.events || []).forEach(function(ev) {
    var record = {
      ExternalID: ev.external_id || "",
      Title:      ev.title || "Untitled",
      Start:      ev.start || "",
      End:        ev.end || "",
      Due:        ev.due || "",
      Location:   ev.location || "",
      Status:     ev.status || "",
      Kind:       ev.kind || "Event",
      Scope:      ev.scope || "General",
      Source:     ev.source || "Calendar",
      CalendarEventId: ev.calendar_event_id || "",
      NotionPageId:    ev.notion_page_id || "",
      LastSynced:      new Date().toISOString()
    };

    // crea la riga seguendo l'ordine degli header
    var row = headers.map(function(h){ return (h in record) ? record[h] : ""; });

    var ext = record.ExternalID;
    var rowIndex = ext && rowByExt[ext] ? rowByExt[ext] : null;
    if (rowIndex) {
      sh.getRange(rowIndex, 1, 1, cols).setValues([row]);   // UPDATE
    } else {
      sh.appendRow(row);                                     // INSERT
      var newRow = sh.getLastRow();
      if (ext) rowByExt[ext] = newRow;
    }
  });

  return { ok: true };
}

function _gs_getSheet_(spreadsheetId, sheetName) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  return ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
}

function _gs_ensureHeaders_(sh) {
  var headers = [
    "ExternalID","Title","Start","End","Due","Location",
    "Status","Kind","Scope","Source",
    "CalendarEventId","NotionPageId","LastSynced"
  ];
  var width = headers.length;

  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,width).setValues([headers]);
    sh.setFrozenRows(1);
    return;
  }
  var current = sh.getRange(1,1,1,Math.max(sh.getLastColumn(), width)).getValues()[0];
  var equal = headers.length === current.length && headers.every(function(h,i){ return current[i]===h; });
  if (!equal) {
    sh.clear();
    sh.getRange(1,1,1,width).setValues([headers]);
    sh.setFrozenRows(1);
  }
}

function _gs_readHeaders_(sh) {
  var lastCol = sh.getLastColumn();
  return lastCol ? sh.getRange(1,1,1,lastCol).getValues()[0] : [];
}

function upsert(dic) {
  var p = PropertiesService.getScriptProperties();
  var token = p.getProperty("NOTION_TOKEN");
  var dbId  = p.getProperty("NOTION_DB_ID");
  var cal   = CalendarApp.getDefaultCalendar();

  var results = [];

  dic.events.forEach(function(ev) {
    // === Calendar ===
    var start = new Date(ev.start);
    var end   = new Date(ev.end || start.getTime() + 30*60000);
    var calEv = cal.createEvent(ev.title, start, end, { description: "ExtID:" + ev.external_id });
    var calRes = { eventId: calEv.getId(), action: "created" };

    // === Notion ===
    var props = {
      "Name":       { "title": [{ "text": { "content": ev.title } }] },
      "Start":      { "date": { "start": ev.start } },
      "End":        { "date": { "start": ev.end } },
      "ExternalID": { "rich_text": [{ "text": { "content": ev.external_id } }] }
    };

    var body = {
      parent: { database_id: dbId },
      properties: props
    };

    var resp = UrlFetchApp.fetch("https://api.notion.com/v1/pages", {
      method: "post",
      headers: {
        "Authorization": "Bearer " + token,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(body)
    });

    var notionRes = JSON.parse(resp.getContentText());
    results.push({ externalId: ev.external_id, calendar: calRes, notion: { pageId: notionRes.id, action: "created" } });
  }
  );
  gl_gs_upsert(dic);

  return { ok: true, results: results };
}


function test_local() {
  var base = new Date();
  var events = [];

  for (var i = 0; i < 3; i++) {
    var start = new Date(base.getTime() + (i + 1) * 30 * 60000);
    var end   = new Date(start.getTime() + 30 * 60000);
    events.push({
      title: "Test Event " + (i + 1),
      start: start.toISOString(),
      end:   end.toISOString(),
      external_id: "local_" + Utilities.getUuid().slice(0, 8)
    });
  }

  var dic = { events: events };
  var res = sendGlando(dic);
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}
