var token = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');; 
var telegramUrl = "https://api.telegram.org/bot" + token; 
var webAppUrl = "https://script.google.com/macros/s/AKfycbylRBQRa_VU-S1iJyRZLzw2BgPDOh51DD8rLYtFJlmXCK3CdEeBqDuzlF77furGfi5b/exec"; 

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

function sendMessage(chat_id, text) {
  var url = telegramUrl + "/sendMessage?chat_id=" + chat_id + "&text=" + encodeURIComponent(text);
  var response = UrlFetchApp.fetch(url);
}

function sendPhoto(chat_id, fileId, caption) {
  var payload = {
    chat_id: chat_id,
    photo: fileId
  };
  if (caption) {
    payload.caption = caption;
  }
  UrlFetchApp.fetch(telegramUrl + "/sendPhoto", {
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
    var bestSize = photo[photo.length - 1];
    if (bestSize && bestSize.file_id) {
      sendPhoto(chat_id, bestSize.file_id, message.caption || "");
    } else {
      sendMessage(chat_id, "❌ Impossibile rinviare la foto ricevuta.");
    }
    return;
  }

  if (document) {
    var fileName = document.file_name || "";
    var mimeType = document.mime_type || "";
    var looksJson = fileName.toLowerCase().endsWith(".json") || mimeType.indexOf("json") !== -1;

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

function setWebhook() {
  const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxab_nYFDG5-gBWZqmSm0zdXgN9uc3X6h7RJZ2Kv8fIG55wVh3xJ8a-CrV-7-cvPpf4/exec';
  const del = `https://api.telegram.org/bot${token}/deleteWebhook`;
  const url = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(WEBAPP_URL)}&drop_pending_updates=true`;
  const respdel = UrlFetchApp.fetch(del);
  const resp = UrlFetchApp.fetch(url);
  Logger.log(respdel.getContentText());
  Logger.log(resp.getContentText());
}
