var token = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN'); 
var telegramUrl = "https://api.telegram.org/bot" + token; 
var webAppUrl = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL'); 

function _validateJsonCandidate(value) {
  if (value === null || value === undefined) {
    return { valid: false, reason: "Nessun contenuto" };
  }
  if (typeof value === "object") {
    return { valid: true };
  }
  if (typeof value !== "string") {
    return { valid: false, reason: "Formato non supportato" };
  }

  var t = value.trim();
  if (!t) {
    return { valid: false, reason: "Testo vuoto" };
  }

  try {
    JSON.parse(t);
    return { valid: true };
  } catch (err) {
    var msg = err && err.message ? err.message : "JSON non valido";
    return { valid: false, reason: msg };
  }
}

function sendMessage(chat_id, text, parse_mode) {
  var payload = {
    chat_id: String(chat_id),
    text: text
  };
  
  // Aggiunge la modalità di formattazione (es. "HTML") se specificata
  if (parse_mode) {
    payload.parse_mode = parse_mode;
  }

  UrlFetchApp.fetch(telegramUrl + "/sendMessage", {
    method: "post",
    payload: payload,
    muteHttpExceptions: true
  });
}

function sendPhoto(chat_id, fileId, caption) {
  _sendTelegramFile(chat_id, fileId, caption, "sendPhoto", "photo");
}


function _sendTelegramFile(chat_id, fileId, caption, method, field) {
  if (!chat_id || !fileId) {
    throw new Error("Parametri non validi per l'invio del file");
  }

  var payload = {
    chat_id: String(chat_id)
  };
  payload[field] = fileId;
  if (caption) {
    payload.caption = caption;
  }

  var response = UrlFetchApp.fetch(telegramUrl + "/" + method, {
    method: "post",
    payload: payload,
    muteHttpExceptions: true
  });

  var raw = response.getContentText();
  try {
    var parsed = JSON.parse(raw);
    if (!parsed.ok) {
      throw new Error(parsed.description || "Richiesta rifiutata da Telegram");
    }
  } catch (err) {
    if (err && err.message && err.message.indexOf("Richiesta rifiutata da Telegram") === 0) {
      throw err;
    }
    throw new Error("Risposta non valida da Telegram: " + raw);
  }
}

function sendDocument(chat_id, fileId, caption) {
  var payload = {
    chat_id: chat_id,
    document: fileId
  };
  if (caption) {
    payload.caption = caption;
  }
  UrlFetchApp.fetch(telegramUrl + "/sendDocument", {
    method: "post",
    payload: payload
  });
}


function _handleJsonPayload(chatId, payload, source) {
  var check = _validateJsonCandidate(payload);
  if (!check.valid) {
    var target = source === "file" ? "Il file JSON" : "Il testo inviato";
    sendMessage(chatId, "❌ " + target + " non è valido: " + check.reason + ".");
    return;
  }

  var res = sendGlando(payload);

  if (res && res.ok) {
    sendMessage(chatId, "✅ " + (res.summary || "Eventi caricati! Controlla Google Calendar e Notion."));
  } else {
    sendMessage(chatId, "❌ Import fallito: " + (res && res.error ? res.error : "errore sconosciuto"));
  }
}


function doPost(e) {
  var contents = JSON.parse(e.postData.contents);
  var message = _resolveTelegramMessage(contents);
  var chat = message.chat || {};
  var chat_id = chat.id || (message.from && message.from.id);
  var text = _extractTextCandidate(message);
  var document = _extractDocumentCandidate(message);
  var photo = _extractPhotoCandidate(message);


  if (photo) {
    
    // NUOVA LOGICA: Usiamo la foto ORIGINALE (la più grande)
    var originalPhoto = photo[photo.length - 1]; // Indice -1 per l'ultima (più grande)
    Logger.log("Uso la foto originale (index " + (photo.length - 1) + ")");

    if (originalPhoto && originalPhoto.file_id) {
      try {
        // 1. Otteniamo l'URL pubblico della foto
        var imageUrl = _getTelegramFileUrl(originalPhoto.file_id);
        
        // 2. Inviamo l'URL a Seendo (OpenAI)
        var ocrResult = sendSeendo(imageUrl);
        
        if (ocrResult && typeof ocrResult === "string") {
          
          // 3. Inviamo il JSON risultante in chat per ispezione
          var message = "✅ OCR (Alta Risoluzione) completato. Ecco il JSON:\n<pre>" + 
                        _simpleHtmlEscape(ocrResult) +
                        "</pre>";
          
          sendMessage(chat_id, message, "HTML");
          
          // (L'upsert rimane commentato per ora)
          // _handleJsonPayload(chat_id, ocrResult, "ocr"); 

        } else {
          sendMessage(chat_id, "❌ L'OCR (Alta Risoluzione) non ha restituito un risultato valido.");
        }
      } catch (err) {
        sendMessage(chat_id, "❌ Impossibile elaborare la foto (Alta Risoluzione): " + (err && err.message ? err.message : err));
      }
    } else {
      sendMessage(chat_id, "❌ Impossibile elaborare la foto (file_id mancante).");
    }
    return; // Usciamo dopo aver gestito la foto
  }
  

  if (document) {
    var fileName = document.file_name || "";
    var mimeType = document.mime_type || "";
    var lowerName = fileName.toLowerCase();
    var isImageDocument = mimeType.indexOf("image/") === 0 ||
      lowerName.endsWith(".jpg") ||
      lowerName.endsWith(".jpeg") ||
      lowerName.endsWith(".png");

    if (isImageDocument) {
      if (document.file_id) {
        sendDocument(chat_id, document.file_id, message.caption || "");
      } else {
        sendMessage(chat_id, "❌ Impossibile rinviare l'immagine ricevuta.");
      }
      return;
    }

    var looksJson = lowerName.endsWith(".json") || mimeType.indexOf("json") !== -1;

    if (!looksJson) {
      sendMessage(chat_id, "❌ Il file deve essere in formato JSON.");
      return;
    }

    try {
      var payload = fetchTelegramFile(document.file_id);
      _handleJsonPayload(chat_id, payload, "file");
    } catch (err) {
      sendMessage(chat_id, "❌ Impossibile leggere il file: " + (err && err.message ? err.message : err));
    }
    return;
  }

  var textCheck = _validateJsonCandidate(text);

  if (textCheck.valid) {
    _handleJsonPayload(chat_id, text, "text");
    return;
  }

  if (text === "/start") {
    var attivazione = "✅ Bot attivato!\n\nInviami un file .json via 📎 oppure incolla il contenuto JSON direttamente nel messaggio.\n\nTi guiderò passo passo per importare eventi in Notion e Google Calendar.";
    sendMessage(chat_id, attivazione);
    return;
  }

  if (typeof text === "string" && text.trim()) {
    sendMessage(chat_id, "❌ Il testo inviato non è un JSON valido: " + textCheck.reason + ".");
  } else {
    var risposta = "È l'ora di Plan---do!📒😄   " + (typeof text === "string" ? text : "");
    sendMessage(chat_id, risposta);
  }
  // Comando /start → disattiva mute e invia messaggio di attivazione

}

function _resolveTelegramMessage(update) {
  if (!update || typeof update !== "object") return {};
  var message = update.message || update.edited_message || update.channel_post || update.edited_channel_post;
  if (message && typeof message === "object") return message;
  if (update.callback_query && update.callback_query.message) return update.callback_query.message;
  return {};
}

function _extractTextCandidate(message) {
  if (!message || typeof message !== "object") return "";
  if (typeof message.text === "string") return message.text;
  if (typeof message.caption === "string") return message.caption;
  var reply = message.reply_to_message;
  if (reply && typeof reply.text === "string") return reply.text;
  if (reply && typeof reply.caption === "string") return reply.caption;
  return "";
}

function _extractDocumentCandidate(message) {
  if (!message || typeof message !== "object") return null;
  if (message.document) return message.document;
  var reply = message.reply_to_message;
  if (reply && reply.document) return reply.document;
  return null;
}

function _extractPhotoCandidate(message) {
  if (!message || typeof message !== "object") return null;
  if (Array.isArray(message.photo) && message.photo.length) return message.photo;
  var reply = message.reply_to_message;
  if (reply && Array.isArray(reply.photo) && reply.photo.length) return reply.photo;
  return null;
}

function fetchTelegramFile(fileId) {
  var fileResp = UrlFetchApp.fetch(telegramUrl + "/getFile?file_id=" + encodeURIComponent(fileId));
  var fileData = JSON.parse(fileResp.getContentText());
  if (!fileData.ok || !(fileData.result && fileData.result.file_path)) {
    throw new Error("Risposta non valida da Telegram.");
  }

  var filePath = fileData.result.file_path;
  var downloadUrl = "https://api.telegram.org/file/bot" + token + "/" + filePath;
  var contentResp = UrlFetchApp.fetch(downloadUrl);
  return contentResp.getContentText();
}

function _getTelegramFileUrl(fileId) {
  var fileResp = UrlFetchApp.fetch(telegramUrl + '/getFile?file_id=' + encodeURIComponent(fileId));
  var fileData = JSON.parse(fileResp.getContentText());
  
  if (!fileData.ok || !(fileData.result && fileData.result.file_path)) {
    throw new Error('Risposta non valida da Telegram durante il recupero del file path.');
  }

  var filePath = fileData.result.file_path;
  // Costruisce l'URL completo per il download
  return 'https://api.telegram.org/file/bot' + token + '/' + filePath;
}

// NOTA: Se hai ancora una funzione chiamata _downloadTelegramPhotoAsBase64,
// puoi cancellarla, non ci serve più.

function setWebhook() {
  const WEBAPP_URL = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL'); ;
  const del = `https://api.telegram.org/bot${token}/deleteWebhook`;
  const url = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(WEBAPP_URL)}&drop_pending_updates=true`;
  const respdel = UrlFetchApp.fetch(del);
  const resp = UrlFetchApp.fetch(url);
  Logger.log(respdel.getContentText());
  Logger.log(resp.getContentText());
}

function delWebhook() {
  const WEBAPP_URL = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL'); ;
  const del = `https://api.telegram.org/bot${token}/deleteWebhook`;
  const respdel = UrlFetchApp.fetch(del);
  Logger.log(respdel.getContentText());
}
