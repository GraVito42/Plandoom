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
    var row = existing[r] || [];
    var ext = row[idxExternal] || "";
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

    var normalizedColor = _gl_normalizeColorId_(ev.colorId, ev.color_id);
    if (normalizedColor) {
      ev.colorId = normalizedColor;
      ev.color_id = normalizedColor;
    }

    var remindersInfo = _gl_parseReminders_(ev.reminders);
    var reminderTexts = remindersInfo.texts || [];
    var reminderValues = remindersInfo.values || [];
    ev.reminders = reminderValues;

    var calendarEvent = {
      summary: ev.title,
      description: "ExtID:" + (ev.external_id || ""),
      start: _gl_buildCalendarTime_(startIso),
      end: _gl_buildCalendarTime_(endIso)
    };

    if (normalizedColor) {
      calendarEvent.colorId = normalizedColor;
    }

    if (ev.location) {
      calendarEvent.location = ev.location;
    }

    var calendarReminders = _gl_buildCalendarReminders_(remindersInfo.overrides);
    if (calendarReminders) {
      calendarEvent.reminders = calendarReminders;
    }

    var insertedEvent = Calendar.Events.insert(calendarEvent, calendarId);
    ev.calendar_event_id = insertedEvent.id;
    var calRes = { eventId: insertedEvent.id, action: "created" };

    // === Notion ===
    var notionRes = null;
    if (token && dbId) {
      notionRes = _gl_upsertNotionPage_(ev, token, dbId, normalizedColor, reminderTexts, notionSchema);
      if (notionRes && notionRes.id) {
        ev.notion_page_id = notionRes.id;
      }
    }

    results.push({
      externalId: ev.external_id,
      calendar: calRes,
      notion: notionRes ? { pageId: notionRes.id, action: notionRes.action } : null
    });
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

function _gl_upsertNotionPage_(ev, token, dbId, colorValue, reminderTexts, notionSchema) {
  var externalId = ev.external_id || "";
  var colorText = colorValue ? String(colorValue) : "";
  var remindersArray = Array.isArray(reminderTexts) ? reminderTexts : [];

  var nameProperty = _gl_findNotionPropertyInfo_(notionSchema, "Name");
  var startProperty = _gl_findNotionPropertyInfo_(notionSchema, "Start");
  var endProperty = _gl_findNotionPropertyInfo_(notionSchema, "End");
  var externalProperty = _gl_findNotionPropertyInfo_(notionSchema, "ExternalID");

  var props = {};
  var nameKey = nameProperty ? nameProperty.name : "Name";
  props[nameKey] = { "title": _gl_makeRichTextArray_(ev.title) };

  var startKey = startProperty ? startProperty.name : "Start";
  props[startKey] = { "date": { "start": ev.start, "end": ev.end || null } };

  var externalKey = externalProperty ? externalProperty.name : "ExternalID";
  props[externalKey] = { "rich_text": externalId ? _gl_makeRichTextArray_(externalId) : [] };

  if (ev.end) {
    var endKey = endProperty ? endProperty.name : "End";
    props[endKey] = { "date": { "start": ev.end } };
  }

  var pageId = ev.notion_page_id || ev.notionPageId;
  var path = pageId ? "/pages/" + pageId : "/pages";
  var method = pageId ? "patch" : "post";
  var body = pageId ? { properties: props } : { parent: { database_id: dbId }, properties: props };

  _gl_assignColorProperty_(props, notionSchema, colorText);
  _gl_assignRemindersProperty_(props, notionSchema, remindersArray);

  var response = UrlFetchApp.fetch("https://api.notion.com/v1" + path, {
    method: method,
    headers: {
      "Authorization": "Bearer " + token,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json"
    },
    muteHttpExceptions: true,
    payload: JSON.stringify(body)
  });

  // Compatibilità con versioni precedenti che si aspettavano una variabile `resp`.
  // Evita ReferenceError in caso qualche flusso utilizzi ancora il vecchio nome.
  var resp = response;

  var status = response.getResponseCode();
  var text = response.getContentText();
  if (status === 401) {
    var unauthorizedMessage = text;
    try {
      var unauthorizedParsed = JSON.parse(text);
      if (unauthorizedParsed && unauthorizedParsed.message) {
        unauthorizedMessage = unauthorizedParsed.message;
      }
    } catch (_) {}
    throw new Error("Notion API unauthorized (401). Verifica NOTION_TOKEN e NOTION_DB_ID. Dettagli: " + unauthorizedMessage);
  }

  if (status < 200 || status >= 300) {
    throw new Error("Notion API error (" + status + "): " + text);
  }

  var parsed = JSON.parse(text);
  parsed.action = pageId ? "updated" : "created";
  return parsed;
}

var _gl_cachedNotionSchemas_ = {};

function _gl_getNotionDbSchema_(token, dbId) {
  if (_gl_cachedNotionSchemas_[dbId]) {
    return _gl_cachedNotionSchemas_[dbId];
  }

  var response = UrlFetchApp.fetch("https://api.notion.com/v1/databases/" + dbId, {
    headers: {
      "Authorization": "Bearer " + token,
      "Notion-Version": "2022-06-28"
    },
    muteHttpExceptions: true
  });

  // Compatibilità con versioni precedenti che si aspettavano `resp`.
  var resp = response;

  var status = response.getResponseCode();
  var text = response.getContentText();
  if (status === 401) {
    var unauthorizedMessage = text;
    try {
      var unauthorizedParsed = JSON.parse(text);
      if (unauthorizedParsed && unauthorizedParsed.message) {
        unauthorizedMessage = unauthorizedParsed.message;
      }
    } catch (_) {}
    throw new Error("Notion API unauthorized (401). Verifica NOTION_TOKEN e NOTION_DB_ID. Dettagli: " + unauthorizedMessage);
  }

  if (status < 200 || status >= 300) {
    throw new Error("Notion API error (" + status + "): " + text);
  }

  var parsed = JSON.parse(text);
  _gl_cachedNotionSchemas_[dbId] = parsed;
  return parsed;
}

function _gl_normalizePropertyName_(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[\s_\-]+/g, "");
}

function _gl_findNotionPropertyInfo_(schema, targetName) {
  if (!schema || !schema.properties) return null;
  if (schema.properties[targetName]) {
    return { name: targetName, definition: schema.properties[targetName] };
  }

  var lowerTarget = String(targetName).toLowerCase();
  var normalizedTarget = _gl_normalizePropertyName_(targetName);

  for (var key in schema.properties) {
    if (!schema.properties.hasOwnProperty(key)) continue;
    var def = schema.properties[key];
    if (String(key).toLowerCase() === lowerTarget) {
      return { name: key, definition: def };
    }
    if (_gl_normalizePropertyName_(key) === normalizedTarget) {
      return { name: key, definition: def };
    }
  }
  return null;
}

function _gl_makeRichTextArray_(value) {
  var text = String(value || "");
  if (!text) return [];
  return [{ text: { content: text } }];
}

function _gl_assignColorProperty_(props, schema, colorValue) {
  var info = _gl_findNotionPropertyInfo_(schema, "colorId");
  var key = info ? info.name : "colorId";
  var def = info ? info.definition : null;
  var hasValue = colorValue !== null && colorValue !== undefined && String(colorValue).trim() !== "";
  var stringValue = hasValue ? String(colorValue).trim() : "";

  if (def && def.type === "number") {
    var num = hasValue ? Number(stringValue) : null;
    if (hasValue && isNaN(num)) {
      num = null;
    }
    props[key] = { number: num };
    return;
  }

  if (def && def.type === "select") {
    props[key] = hasValue ? { select: { name: stringValue } } : { select: null };
    return;
  }

  if (def && def.type === "multi_select") {
    props[key] = hasValue ? { multi_select: [{ name: stringValue }] } : { multi_select: [] };
    return;
  }

  props[key] = hasValue ? { rich_text: _gl_makeRichTextArray_(stringValue) } : { rich_text: [] };
}

function _gl_assignRemindersProperty_(props, schema, reminders) {
  var info = _gl_findNotionPropertyInfo_(schema, "reminders");
  var key = info ? info.name : "reminders";
  var def = info ? info.definition : null;
  var values = Array.isArray(reminders) ? reminders.filter(function(item){
    return item !== null && item !== undefined && String(item).trim() !== "";
  }) : [];

  if (def && def.type === "multi_select") {
    props[key] = { multi_select: values.map(function(val){ return { name: String(val) }; }) };
    return;
  }

  if (def && def.type === "select") {
    var first = values.length ? String(values[0]) : "";
    props[key] = first ? { select: { name: first } } : { select: null };
    return;
  }

  if (def && def.type === "number") {
    if (values.length) {
      var candidate = Number(values[0]);
      props[key] = { number: isNaN(candidate) ? null : candidate };
    } else {
      props[key] = { number: null };
    }
    return;
  }

  props[key] = values.length ? { rich_text: _gl_makeRichTextArray_(values.join(", ")) } : { rich_text: [] };
}

function _gl_normalizeColorId_(primaryValue, fallbackValue) {
  var value = primaryValue;
  if (value === null || value === undefined || String(value).trim() === "") {
    value = fallbackValue;
  }
  if (value === null || value === undefined) return "";
  var stringValue = String(value).trim();
  if (!stringValue) return "";
  if (!isNaN(Number(stringValue))) {
    var numeric = Number(stringValue);
    if (!isNaN(numeric)) {
      return String(Math.floor(numeric));
    }
  }
  return stringValue;
}

function _gl_parseReminders_(input) {
  var rawItems = [];
  if (Array.isArray(input)) {
    rawItems = input;
  } else if (input !== undefined && input !== null) {
    if (typeof input === "string") {
      var trimmed = input.trim();
      if (trimmed) {
        if (trimmed[0] === "[" && trimmed[trimmed.length - 1] === "]") {
          try {
            var parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
              rawItems = parsed;
            } else {
              rawItems = [trimmed];
            }
          } catch (_) {
            rawItems = [trimmed];
          }
        } else if (trimmed.indexOf(",") > -1) {
          rawItems = trimmed.split(",");
        } else {
          rawItems = [trimmed];
        }
      }
    } else {
      rawItems = [input];
    }
  }

  var overrides = [];
  var texts = [];
  var values = [];

  rawItems.forEach(function(item) {
    if (item === null || item === undefined) return;

    var method = "popup";
    var minutes = null;
    var textValue = "";
    var storedValue = null;

    if (typeof item === "number") {
      if (!isNaN(item)) {
        minutes = Math.max(0, Math.round(item));
        textValue = String(minutes);
        storedValue = minutes;
      }
    } else if (typeof item === "string") {
      var trimmed = item.trim();
      if (!trimmed) return;
      textValue = trimmed;

      var colon = trimmed.indexOf(":");
      if (colon > -1) {
        var methodPart = trimmed.substring(0, colon).trim().toLowerCase();
        var valuePart = trimmed.substring(colon + 1).trim();
        var parsedMinutes = parseInt(valuePart, 10);
        if (!isNaN(parsedMinutes)) {
          minutes = Math.max(0, parsedMinutes);
          if (methodPart === "email" || methodPart === "popup") {
            method = methodPart;
          }
        }
        storedValue = trimmed;
      }

      if (minutes === null) {
        var numeric = parseInt(trimmed, 10);
        if (!isNaN(numeric)) {
          minutes = Math.max(0, numeric);
          storedValue = minutes;
        }
      }

      if (storedValue === null) {
        storedValue = trimmed;
      }
    } else if (typeof item === "object") {
      var objMethod = item.method ? String(item.method).toLowerCase() : "popup";
      var objMinutes = item.minutes;
      if (typeof objMinutes === "number" && !isNaN(objMinutes)) {
        minutes = Math.max(0, Math.round(objMinutes));
        if (objMethod === "email" || objMethod === "popup") {
          method = objMethod;
        }
        textValue = objMethod + ":" + minutes;
        storedValue = textValue;
      }
    }

    if (textValue) {
      texts.push(textValue);
    }

    if (storedValue !== null) {
      values.push(storedValue);
    } else if (textValue) {
      values.push(textValue);
    }

    if (minutes !== null) {
      overrides.push({ method: method, minutes: minutes });
    }
  });

  return { overrides: overrides, texts: texts, values: values };
}

function _gl_buildCalendarReminders_(overrides) {
  if (!overrides || !overrides.length) return null;
  return { useDefault: false, overrides: overrides };
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
