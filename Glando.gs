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

// Variabile globale mantenuta per compatibilità con script esterni che
// leggono l'ultimo `resp` della comunicazione con le API Notion.
var resp;

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

  var sheetMeta = _gs_getSheetMetadata_(sid, sname);
  var sheetId = sheetMeta.sheetId;

  var headers = _gs_ensureHeaders_(sid, sname, sheetId);
  var idxExternal = headers.indexOf("ExternalID");
  if (idxExternal < 0) throw new Error("Header 'ExternalID' mancante.");

  var colLetter = _gs_columnLetter_(headers.length);
  var dataRange = sname + "!A2:" + colLetter;
  var dataResp = Sheets.Spreadsheets.Values.get(sid, dataRange);
  var existing = dataResp.values || [];

  var rowByExt = {};
  for (var r = 0; r < existing.length; r++) {
    var ext = existing[r][idxExternal] || "";
    if (ext) rowByExt[ext] = r + 2; // offset header
  }

  var updates = [];
  var appends = [];

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
      ColorId:         ev.color_id || ev.colorId || "",
      Reminders:       (ev.reminders && ev.reminders.length) ? JSON.stringify(ev.reminders) : "",
      LastSynced:      new Date().toISOString()
    };

    var row = headers.map(function(h){ return (h in record) ? record[h] : ""; });

    var ext = record.ExternalID;
    var rowIndex = ext && rowByExt[ext] ? rowByExt[ext] : null;
    if (rowIndex) {
      updates.push({
        range: sname + "!A" + rowIndex + ":" + colLetter + rowIndex,
        values: row
      });
    } else {
      appends.push(row);
      if (ext) {
        var newRowIndex = existing.length + appends.length + 1; // 1 for header, existing offset
        rowByExt[ext] = newRowIndex;
      }
    }
  });

  updates.forEach(function(update) {
    Sheets.Spreadsheets.Values.update({ values: [update.values] }, sid, update.range, {
      valueInputOption: "RAW"
    });
  });

  if (appends.length) {
    Sheets.Spreadsheets.Values.append({ values: appends }, sid, sname + "!A1", {
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS"
    });
  }

  return { ok: true };
}

function _gs_getSheetMetadata_(spreadsheetId, sheetName) {
  var spreadsheet = Sheets.Spreadsheets.get(spreadsheetId);
  var sheet = null;
  if (spreadsheet.sheets) {
    for (var i = 0; i < spreadsheet.sheets.length; i++) {
      var candidate = spreadsheet.sheets[i];
      if (candidate && candidate.properties && candidate.properties.title === sheetName) {
        sheet = candidate.properties;
        break;
      }
    }
  }

  if (!sheet) {
    Sheets.Spreadsheets.batchUpdate({
      requests: [{ addSheet: { properties: { title: sheetName } } }]
    }, spreadsheetId);
    var refreshed = Sheets.Spreadsheets.get(spreadsheetId);
    for (var j = 0; j < refreshed.sheets.length; j++) {
      var props = refreshed.sheets[j].properties;
      if (props && props.title === sheetName) {
        sheet = props;
        break;
      }
    }
  }

  if (!sheet) throw new Error("Impossibile ottenere il foglio '" + sheetName + "'.");

  return sheet;
}

function _gs_ensureHeaders_(spreadsheetId, sheetName, sheetId) {
  var headers = [
    "ExternalID","Title","Start","End","Due","Location",
    "Status","Kind","Scope","Source",
    "CalendarEventId","NotionPageId","ColorId","Reminders","LastSynced"
  ];

  var desiredRange = sheetName + "!1:1";
  var current = Sheets.Spreadsheets.Values.get(spreadsheetId, desiredRange).values;
  var currentRow = current && current.length ? current[0] : [];
  var equal = currentRow.length === headers.length && headers.every(function(h, i){ return currentRow[i] === h; });

  if (!equal) {
    Sheets.Spreadsheets.Values.update({ values: [headers] }, spreadsheetId, desiredRange, {
      valueInputOption: "RAW"
    });
    Sheets.Spreadsheets.batchUpdate({
      requests: [{
        updateSheetProperties: {
          properties: { sheetId: sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: "gridProperties.frozenRowCount"
        }
      }]
    }, spreadsheetId);
  }

  return headers;
}

function _gs_columnLetter_(index) {
  var letters = "";
  var n = index;
  while (n > 0) {
    var remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters || "A";
}

function upsert(dic) {
  var p = PropertiesService.getScriptProperties();
  var token = p.getProperty("NOTION_TOKEN");
  var dbId  = p.getProperty("NOTION_DB_ID");
  var calendarId = p.getProperty("GLANDO_CALENDAR_ID") || "primary";

  var results = [];
  var notionSchema = null;
  if (token && dbId) {
    notionSchema = _gl_getNotionDbSchema_(token, dbId);
  }

  dic.events.forEach(function(ev) {
    // === Calendar (Google Calendar API) ===
    var startIso = ev.start || ev.due;
    if (!startIso) throw new Error("Evento privo di data di inizio o scadenza.");

    var endIso = ev.end;
    if (!endIso) {
      var startDate = new Date(startIso);
      if (isNaN(startDate.getTime())) {
        throw new Error("Data di inizio non valida per l'evento '" + ev.title + "'.");
      }
      var defaultEnd = new Date(startDate.getTime() + 30 * 60000);
      endIso = defaultEnd.toISOString();
    }

    ev.start = startIso;
    ev.end = endIso;

    var calendarEvent = {
      summary: ev.title,
      description: "ExtID:" + (ev.external_id || ""),
      start: _gl_buildCalendarTime_(startIso),
      end: _gl_buildCalendarTime_(endIso)
    };

    var colorValue = ev.colorId || ev.color_id;
    if (colorValue) {
      calendarEvent.colorId = String(colorValue);
    }

    if (ev.location) {
      calendarEvent.location = ev.location;
    }

    var insertedEvent = Calendar.Events.insert(calendarEvent, calendarId);
    ev.calendar_event_id = insertedEvent.id;
    ev.color_id = colorValue || ev.color_id;
    var calRes = { eventId: insertedEvent.id, action: "created" };

    // === Notion ===
    var externalId = ev.external_id || "";
    var colorText = colorValue ? String(colorValue) : "";

    var props = {
      "Name":       { "title": [{ "text": { "content": ev.title } }] },
      "Start":      { "date": { "start": ev.start } },
      "End":        { "date": { "start": ev.end } },
      "ExternalID": { "rich_text": externalId ? [{ "text": { "content": externalId } }] : [] },
      "colorId":    { "rich_text": colorText ? [{ "text": { "content": colorText } }] : [] }
    };

    var calendarEvent = {
      summary: ev.title,
      description: "ExtID:" + (ev.external_id || ""),
      start: _gl_buildCalendarTime_(startIso),
      end: _gl_buildCalendarTime_(endIso)
    };

    var colorValue = ev.colorId || ev.color_id;
    if (colorValue) {
      colorValue = String(colorValue);
      calendarEvent.colorId = colorValue;
      ev.color_id = colorValue;
      ev.colorId = colorValue;
    }

    if (ev.location) {
      calendarEvent.location = ev.location;
    }

    var insertedEvent = Calendar.Events.insert(calendarEvent, calendarId);
    ev.calendar_event_id = insertedEvent.id;
    ev.color_id = colorValue || ev.color_id;
    var calRes = { eventId: insertedEvent.id, action: "created" };

    // === Notion ===
    var notionRes = null;
    if (token && dbId) {
      notionRes = _gl_upsertNotionPage_(ev, token, dbId, colorValue);
      if (notionRes && notionRes.id) {
        ev.notion_page_id = notionRes.id;
      }
    }

    var notionRes = JSON.parse(resp.getContentText());
    ev.notion_page_id = notionRes.id;
    results.push({ externalId: ev.external_id, calendar: calRes, notion: { pageId: notionRes.id, action: "created" } });
  }
  );
  gl_gs_upsert(dic);

  return { ok: true, results: results };
}

function _gl_buildCalendarTime_(isoString) {
  if (!isoString) return null;
  var isDateOnly = isoString.length <= 10 || (isoString.indexOf("T") === -1);
  if (isDateOnly) {
    return { date: isoString.substring(0, 10) };
  }
  return { dateTime: isoString };
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
