/**
 * =================================================================
 * FILE: Plando.gs
 * RUOLO: Gestore della logica di Telegram.
 * =================================================================
 */
var Plando = (function() {

  // --- Variabili Private (Spostate da Code.gs vecchio) ---
  var token = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
  var telegramUrl = "https://api.telegram.org/bot" + token;

  // --- Funzioni Pubbliche (Esposte) ---

  /**
   * Gestisce la richiesta POST in arrivo da Telegram (chiamata da doPost).
   * Questa è la logica principale del vecchio file Code.gs/doPost.
   */
  function handleTelegramPost(e) {
    var contents;
    try {
      contents = JSON.parse(e.postData.contents);
    } catch (err) {
      console.error("Errore nel parsing del JSON da Telegram: " + e.postData.contents, err);
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Invalid JSON input" })).setMimeType(ContentService.MimeType.JSON);
    }

    var message = _resolveTelegramMessage(contents);
    var chat = message.chat || {};
    var chat_id = chat.id || (message.from && message.from.id);

    if (!chat_id) {
      console.warn("Nessun chat_id trovato nell'update: " + e.postData.contents);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, info: "No chat_id" })).setMimeType(ContentService.MimeType.JSON);
    }

    try {
      var text = _extractTextCandidate(message);
      var document = _extractDocumentCandidate(message);
      var photo = _extractPhotoCandidate(message);

      if (photo) {
        _handlePhoto(chat_id, photo);
      } else if (document) {
        _handleDocument(chat_id, document, message.caption);
      } else if (text) {
        _handleText(chat_id, text);
      } else {
        // Messaggio non gestito (es. sticker)
        // sendMessage(chat_id, "ℹ️ Tipo di messaggio non supportato.");
      }

    } catch (err) {
      console.error("Errore in Plando.handleTelegramPost: " + err.message, err.stack);
      try {
        // Tenta di inviare l'errore all'utente
        sendMessage(chat_id, "❌ Si è verificato un errore critico: " + err.message);
      } catch (sendErr) {
        console.error("Impossibile inviare il messaggio di errore: " + sendErr.message);
      }
    }
    
    // Rispondi a Telegram che l'update è stato ricevuto e processato.
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  }

  /**
   * Imposta il webhook di Telegram sull'URL di questa WebApp.
   * (Migliorata per usare l'URL dinamico)
   */
  function setWebhook() {
    var webAppUrl = ScriptApp.getService().getUrl();
    var delUrl = telegramUrl + "/deleteWebhook";
    var setUrl = telegramUrl + "/setWebhook?url=" + encodeURIComponent(webAppUrl) + "&drop_pending_updates=true";
    
    var respDel = UrlFetchApp.fetch(delUrl, { muteHttpExceptions: true });
    var respSet = UrlFetchApp.fetch(setUrl, { muteHttpExceptions: true });
    
    var logMsg = "Webhook impostato a: " + webAppUrl + "\nRisposte:\nDelete: " + respDel.getContentText() + "\nSet: " + respSet.getContentText();
    Logger.log(logMsg);
    return logMsg;
  }

  // --- Gestori Logici (Privati) ---

  /**
   * Gestisce un messaggio di testo.
   */
  function _handleText(chat_id, text) {
    if (text === "/start") {
      var attivazione = "✅ Bot attivato!\n\nInviami un file .json via 📎 oppure incolla il contenuto JSON direttamente nel messaggio.\n\nTi guiderò passo passo per importare eventi in Notion e Google Calendar.";
      sendMessage(chat_id, attivazione);
      return;
    }

    var textCheck = _validateJsonCandidate(text);
    if (textCheck.valid) {
      _handleJsonPayload(chat_id, text, "text");
    } else {
      sendMessage(chat_id, "❌ Il testo inviato non è un JSON valido: " + textCheck.reason + ".");
    }
  }

  /**
   * Gestisce un documento.
   */
  function _handleDocument(chat_id, document, caption) {
    var fileName = document.file_name || "";
    var mimeType = document.mime_type || "";
    var lowerName = fileName.toLowerCase();
    
    var isImageDocument = mimeType.indexOf("image/") === 0 ||
        lowerName.endsWith(".jpg") ||
        lowerName.endsWith(".jpeg") ||
        lowerName.endsWith(".png");

    if (isImageDocument) {
      // È un'immagine inviata come file, trattala come una foto per l'OCR
      // NOTA: il vecchio codice qui faceva `sendDocument`, che era un semplice re-invio.
      // Questa nuova logica invia all'OCR (Glando.sendSeendo), che è l'intento corretto.
      _handlePhoto(chat_id, [document]); // Invia come array, _handlePhoto prenderà l'ultimo
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
  }
  
  /**
   * Gestisce una foto (per OCR).
   */
  function _handlePhoto(chat_id, photoSizes) {
    // photoSizes è un array, prendiamo l'ultimo (qualità migliore) o l'unico (se da documento)
    var bestSize = photoSizes[photoSizes.length - 1]; 
    if (bestSize && bestSize.file_id) {
      try {
        // Assumiamo che Glando.gs contenga la funzione sendSeendo per l'OCR
        var ocrResult = Glando.sendSeendo(bestSize); 
        if (ocrResult && typeof ocrResult === "string") {
          sendMessage(chat_id, ocrResult);
        } else {
          sendMessage(chat_id, "❌ L'OCR non ha restituito un risultato valido.");
        }
      } catch (err) {
        sendMessage(chat_id, "❌ Impossibile elaborare la foto ricevuta: " + (err && err.message ? err.message : err));
      }
    } else {
      sendMessage(chat_id, "❌ Impossibile elaborare la foto ricevuta (file_id mancante).");
    }
  }

  /**
   * Gestisce un payload JSON valido (da testo o file).
   */
  function _handleJsonPayload(chatId, payload, source) {
    var check = _validateJsonCandidate(payload);
    if (!check.valid) {
      var target = source === "file" ? "Il file JSON" : "Il testo inviato";
      sendMessage(chatId, "❌ " + target + " non è valido: " + check.reason + ".");
      return;
    }

    // Assumiamo che Glando.gs contenga la funzione sendGlando per l'import
    var res = Glando.sendGlando(payload);

    if (res && res.ok) {
      sendMessage(chatId, "✅ " + (res.summary || "Eventi caricati! Controlla Google Calendar e Notion."));
    } else {
      sendMessage(chatId, "❌ Import fallito: " + (res && res.error ? res.error : "errore sconosciuto"));
    }
  }

  // --- Funzioni di utilità Telegram (Spostate) ---

  function sendMessage(chat_id, text) {
    var url = telegramUrl + "/sendMessage?chat_id=" + encodeURIComponent(String(chat_id)) + "&text=" + encodeURIComponent(text);
    UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  }

  function sendPhoto(chat_id, fileId, caption) {
    _sendTelegramFile(chat_id, fileId, caption, "sendPhoto", "photo");
  }

  function sendDocument(chat_id, fileId, caption) {
    _sendTelegramFile(chat_id, fileId, caption, "sendDocument", "document");
  }

  function _sendTelegramFile(chat_id, fileId, caption, method, field) {
    if (!chat_id || !fileId) {
      throw new Error("Parametri non validi per l'invio del file");
    }

    var payload = { chat_id: String(chat_id) };
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

  function fetchTelegramFile(fileId) {
    var fileResp = UrlFetchApp.fetch(telegramUrl + "/getFile?file_id=" + encodeURIComponent(fileId));
    var fileData = JSON.parse(fileResp.getContentText());
    if (!fileData.ok || !(fileData.result && fileData.result.file_path)) {
      throw new Error("Risposta non valida da Telegram (getFile).");
    }

    var filePath = fileData.result.file_path;
    var downloadUrl = "https://api.telegram.org/file/bot" + token + "/" + filePath;
    var contentResp = UrlFetchApp.fetch(downloadUrl);
    return contentResp.getContentText();
  }

  /**
   * Scarica un file da Telegram come Blob (dati binari).
   * Necessario per immagini, PDF, ecc.
   */
  function fetchTelegramFileAsBlob(fileId) {
    var fileResp = UrlFetchApp.fetch(telegramUrl + "/getFile?file_id=" + encodeURIComponent(fileId));
    var fileData = JSON.parse(fileResp.getContentText());
    if (!fileData.ok || !(fileData.result && fileData.result.file_path)) {
      throw new Error("Risposta non valida da Telegram (getFile).");
    }

    var filePath = fileData.result.file_path;
    var downloadUrl = "https://api.telegram.org/file/bot" + token + "/" + filePath;
    
    // La differenza chiave è qui: .getBlob() invece di .getContentText()
    var contentResp = UrlFetchApp.fetch(downloadUrl);
    var blob = contentResp.getBlob();
    
    // Potrebbe essere utile impostare un nome file, le API lo apprezzano
    blob.setName(filePath.split('/').pop()); 
    
    return blob;
  }

  // --- Funzioni di utilità per il parsing (Spostate) ---

  function _validateJsonCandidate(value) {
    if (value === null || value === undefined) {
      return { valid: false, reason: "Nessun contenuto" };
    }
    if (typeof value === "object") {
      return { valid: true }; // Già parsato
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

  // --- Esposizione delle funzioni pubbliche ---
  return {
    handleTelegramPost: handleTelegramPost,
    setWebhook: setWebhook,
    // Esponiamo anche queste per un eventuale uso da Glando.gs (es. per notifiche)
    sendMessage: sendMessage,
    sendPhoto: sendPhoto,
    sendDocument: sendDocument,
    fetchTelegramFile: fetchTelegramFile, // Essenziale per l'OCR in Glando
    fetchTelegramFileAsBlob: fetchTelegramFileAsBlob
  };

})();
