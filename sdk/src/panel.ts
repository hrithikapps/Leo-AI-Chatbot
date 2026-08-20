import type { LeoAIChatbotConfig } from "./types";

/**
 * Serialized into an inline <script> inside the iframe srcdoc. JSON.stringify
 * already escapes quotes; "</script>" inside content is escaped separately so
 * a message can't prematurely close the script tag.
 */
function toInlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/<\/script/gi, "<\\/script");
}

export function buildPanelSrcDoc(config: LeoAIChatbotConfig): string {
  const configJson = toInlineJson({
    backendUrl: config.backendUrl,
    application: config.application,
    externalUserId: config.user?.id ?? null,
  });

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 0; color: #1f2d3d; display: flex; flex-direction: column; height: 100vh; background: #f4f5f7; }

  .header { background: linear-gradient(135deg, #f5a94d 0%, #c9701f 60%, #9a4e12 100%); color: #fff; padding: 20px 16px 40px; flex-shrink: 0; }
  .header .wordmark { font-size: 20px; font-weight: 800; letter-spacing: 1px; }
  .header .back { background: none; border: none; color: #fff; font-size: 14px; cursor: pointer; padding: 0 0 10px; }

  .content { flex: 1; overflow-y: auto; padding: 0 12px 12px; margin-top: -24px; }

  .card { background: #fff; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 12px; overflow: hidden; }
  .card-title { display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 700; padding: 14px 14px 10px; }
  .search-toggle { background: none; border: 1px solid #e2e5ea; border-radius: 999px; width: 28px; height: 28px; cursor: pointer; font-size: 13px; color: #667085; }

  .row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-top: 1px solid #eef0f3; cursor: pointer; }
  .row:hover { background: #fafafa; }
  .icon { width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; }
  .icon.support { background: #b45309; }
  .icon.ai { background: #14b8a6; }
  .icon.faq { background: #dc4a4a; }
  .row-label { font-size: 14px; font-weight: 600; color: #24344d; }

  .search-box { padding: 8px 14px 4px; }
  .search-box input { width: 100%; font-size: 13px; padding: 8px 10px; border: 1px solid #d0d5dd; border-radius: 6px; }

  .faq-empty { padding: 14px; font-size: 13px; color: #98a2b3; }
  .faq-answer { padding: 14px; font-size: 13px; line-height: 1.5; color: #344054; white-space: pre-wrap; }
  .faq-question { padding: 4px 14px 0; font-size: 15px; font-weight: 700; }

  #messages { flex: 1; overflow-y: auto; padding: 12px 12px; display: flex; flex-direction: column; gap: 8px; }
  .msg { font-size: 13px; line-height: 1.4; padding: 6px 10px; border-radius: 10px; max-width: 85%; white-space: pre-wrap; }
  .msg.user { align-self: flex-end; background: #c9701f; color: #fff; }
  .msg.assistant { align-self: flex-start; background: #f2f4f7; color: #1a1a1a; }
  .msg.status { align-self: center; color: #98a2b3; font-size: 11px; background: none; }
  .composer { display: flex; gap: 6px; padding: 10px 12px; border-top: 1px solid #e5e7eb; background: #fff; }
  .composer input { flex: 1; font-size: 13px; padding: 8px 10px; border: 1px solid #d0d5dd; border-radius: 6px; }
  .composer button { font-size: 13px; padding: 8px 14px; border: none; border-radius: 6px; background: #c9701f; color: #fff; cursor: pointer; }
  .composer button:disabled { background: #98a2b3; cursor: not-allowed; }
  .chat-view { display: flex; flex-direction: column; flex: 1; min-height: 0; }

  .form-field { padding: 10px 14px; }
  .form-field label { display: block; font-size: 12px; font-weight: 700; color: #667085; margin-bottom: 4px; }
  .form-field input, .form-field textarea { width: 100%; font-size: 13px; padding: 8px 10px; border: 1px solid #d0d5dd; border-radius: 6px; font-family: inherit; resize: vertical; }
  .form-actions { padding: 6px 14px 14px; }
  .form-actions button { width: 100%; font-size: 13px; padding: 10px; border: none; border-radius: 6px; background: #c9701f; color: #fff; cursor: pointer; font-weight: 600; }
  .form-actions button:disabled { background: #98a2b3; cursor: not-allowed; }
  .form-error { padding: 0 14px 10px; font-size: 12px; color: #dc2626; }
  .ticket-confirm { padding: 20px 14px; text-align: center; }
  .ticket-confirm .big { font-size: 32px; }
  .ticket-confirm h2 { font-size: 15px; margin: 10px 0 4px; }
  .ticket-confirm p { font-size: 12px; color: #667085; margin: 0 0 2px; }
  .ticket-confirm code { font-size: 11px; background: #f2f4f7; padding: 2px 6px; border-radius: 4px; }
</style>
</head>
<body>
  <div id="app"></div>
  <script>
    var config = ${configJson};
    var app = document.getElementById("app");

    function apiUrl(path) {
      return config.backendUrl.replace(/\\/$/, "") + path;
    }

    var faqCache = null;

    function renderHeader(title, showBack, onBack) {
      var header = document.createElement("div");
      header.className = "header";
      if (showBack) {
        var back = document.createElement("button");
        back.type = "button";
        back.className = "back";
        back.textContent = "\\u2190 Back";
        back.addEventListener("click", onBack);
        header.appendChild(back);
      }
      var wordmark = document.createElement("div");
      wordmark.className = "wordmark";
      wordmark.textContent = title;
      header.appendChild(wordmark);
      return header;
    }

    function goHome() {
      renderHome();
    }

    function renderHome() {
      app.innerHTML = "";
      app.style.display = "flex";
      app.style.flexDirection = "column";
      app.style.height = "100%";

      app.appendChild(renderHeader("MOJRO", false, null));

      var content = document.createElement("div");
      content.className = "content";

      var messageCard = document.createElement("div");
      messageCard.className = "card";
      var messageTitle = document.createElement("div");
      messageTitle.className = "card-title";
      messageTitle.textContent = "Message Us";
      messageCard.appendChild(messageTitle);
      messageCard.appendChild(buildRow("support", "S", "Support", function () { renderTicketForm(); }));
      messageCard.appendChild(buildRow("ai", "I", "Interactive AI", function () { renderChat(); }));
      content.appendChild(messageCard);

      var faqCard = document.createElement("div");
      faqCard.className = "card";
      var faqTitle = document.createElement("div");
      faqTitle.className = "card-title";
      var faqTitleText = document.createElement("span");
      faqTitleText.textContent = "FAQs";
      faqTitle.appendChild(faqTitleText);
      var searchBtn = document.createElement("button");
      searchBtn.type = "button";
      searchBtn.className = "search-toggle";
      searchBtn.textContent = "\\u{1F50D}";
      searchBtn.addEventListener("click", function () { renderFaqList(); });
      faqTitle.appendChild(searchBtn);
      faqCard.appendChild(faqTitle);
      faqCard.appendChild(buildRow("faq", "S", "Self Service Portal", function () { renderFaqList(); }));
      content.appendChild(faqCard);

      app.appendChild(content);
    }

    function buildRow(iconClass, iconText, label, onClick) {
      var row = document.createElement("div");
      row.className = "row";
      var icon = document.createElement("div");
      icon.className = "icon " + iconClass;
      icon.textContent = iconText;
      var text = document.createElement("div");
      text.className = "row-label";
      text.textContent = label;
      row.appendChild(icon);
      row.appendChild(text);
      row.addEventListener("click", onClick);
      return row;
    }

    function fetchFaqs(query) {
      var qs = query ? "?q=" + encodeURIComponent(query) : "";
      return fetch(apiUrl("/faq" + qs))
        .then(function (res) {
          if (!res.ok) throw new Error("status " + res.status);
          return res.json();
        })
        .then(function (data) { return data.faqs; });
    }

    function renderFaqList() {
      app.innerHTML = "";
      app.appendChild(renderHeader("FAQs", true, goHome));

      var content = document.createElement("div");
      content.className = "content";

      var card = document.createElement("div");
      card.className = "card";

      var searchBox = document.createElement("div");
      searchBox.className = "search-box";
      var searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.placeholder = "Search FAQs...";
      searchBox.appendChild(searchInput);
      card.appendChild(searchBox);

      var list = document.createElement("div");
      card.appendChild(list);
      content.appendChild(card);
      app.appendChild(content);

      function renderList(faqs) {
        list.innerHTML = "";
        if (faqs.length === 0) {
          var empty = document.createElement("div");
          empty.className = "faq-empty";
          empty.textContent = "No FAQs found.";
          list.appendChild(empty);
          return;
        }
        faqs.forEach(function (faq) {
          list.appendChild(buildRow("faq", "Q", faq.question, function () { renderFaqDetail(faq); }));
        });
      }

      var searchTimer = null;
      searchInput.addEventListener("input", function () {
        clearTimeout(searchTimer);
        var value = searchInput.value.trim();
        searchTimer = setTimeout(function () {
          fetchFaqs(value).then(renderList).catch(function () { renderList([]); });
        }, 250);
      });

      if (faqCache) {
        renderList(faqCache);
      } else {
        fetchFaqs("").then(function (faqs) {
          faqCache = faqs;
          renderList(faqs);
        }).catch(function () { renderList([]); });
      }
    }

    function renderFaqDetail(faq) {
      app.innerHTML = "";
      app.appendChild(renderHeader("FAQs", true, renderFaqList));

      var content = document.createElement("div");
      content.className = "content";
      var card = document.createElement("div");
      card.className = "card";

      var question = document.createElement("div");
      question.className = "faq-question";
      question.textContent = faq.question;
      card.appendChild(question);

      var answer = document.createElement("div");
      answer.className = "faq-answer";
      answer.textContent = faq.answer;
      card.appendChild(answer);

      content.appendChild(card);
      app.appendChild(content);
    }

    function renderChat() {
      app.innerHTML = "";
      app.style.display = "flex";
      app.style.flexDirection = "column";
      app.style.height = "100%";

      app.appendChild(renderHeader("Interactive AI", true, goHome));

      var chatView = document.createElement("div");
      chatView.className = "chat-view";

      var messagesEl = document.createElement("div");
      messagesEl.id = "messages";
      chatView.appendChild(messagesEl);

      var composer = document.createElement("form");
      composer.className = "composer";
      var inputEl = document.createElement("input");
      inputEl.type = "text";
      inputEl.placeholder = "Type a message...";
      inputEl.autocomplete = "off";
      inputEl.disabled = true;
      var sendEl = document.createElement("button");
      sendEl.type = "submit";
      sendEl.textContent = "Send";
      sendEl.disabled = true;
      composer.appendChild(inputEl);
      composer.appendChild(sendEl);
      chatView.appendChild(composer);

      app.appendChild(chatView);

      var conversationId = null;

      function appendMessage(role, content) {
        var el = document.createElement("div");
        el.className = "msg " + role;
        el.textContent = content;
        messagesEl.appendChild(el);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }

      function setComposerEnabled(enabled) {
        inputEl.disabled = !enabled;
        sendEl.disabled = !enabled;
      }

      fetch(apiUrl("/conversations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: config.application + ":ai", externalUserId: config.externalUserId })
      })
        .then(function (res) {
          if (!res.ok) throw new Error("status " + res.status);
          return res.json();
        })
        .then(function (data) {
          conversationId = data.conversationId;
          appendMessage("status", "Conversation started.");
          setComposerEnabled(true);
          inputEl.focus();
        })
        .catch(function (err) {
          appendMessage("status", "Could not start conversation: " + err.message);
        });

      composer.addEventListener("submit", function (event) {
        event.preventDefault();
        var content = inputEl.value.trim();
        if (!content || !conversationId) return;

        appendMessage("user", content);
        inputEl.value = "";
        setComposerEnabled(false);

        fetch(apiUrl("/conversations/" + conversationId + "/messages"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "user", content: content })
        })
          .then(function (res) {
            if (!res.ok) throw new Error("status " + res.status);
            return res.json();
          })
          .then(function (data) {
            appendMessage("assistant", data.aiMessage.content);
          })
          .catch(function (err) {
            appendMessage("status", "Message failed: " + err.message);
          })
          .finally(function () {
            setComposerEnabled(true);
            inputEl.focus();
          });
      });
    }

    function renderTicketForm() {
      app.innerHTML = "";
      app.appendChild(renderHeader("Support", true, goHome));

      var content = document.createElement("div");
      content.className = "content";
      var card = document.createElement("div");
      card.className = "card";

      var form = document.createElement("form");

      var subjectField = document.createElement("div");
      subjectField.className = "form-field";
      var subjectLabel = document.createElement("label");
      subjectLabel.textContent = "Subject";
      var subjectInput = document.createElement("input");
      subjectInput.type = "text";
      subjectInput.placeholder = "Short summary of the issue";
      subjectField.appendChild(subjectLabel);
      subjectField.appendChild(subjectInput);

      var descField = document.createElement("div");
      descField.className = "form-field";
      var descLabel = document.createElement("label");
      descLabel.textContent = "Describe the issue";
      var descInput = document.createElement("textarea");
      descInput.rows = 4;
      descInput.placeholder = "What happened, and what were you trying to do?";
      descField.appendChild(descLabel);
      descField.appendChild(descInput);

      var errorEl = document.createElement("div");
      errorEl.className = "form-error";

      var actions = document.createElement("div");
      actions.className = "form-actions";
      var submitBtn = document.createElement("button");
      submitBtn.type = "submit";
      submitBtn.textContent = "Create ticket";
      actions.appendChild(submitBtn);

      form.appendChild(subjectField);
      form.appendChild(descField);
      form.appendChild(errorEl);
      form.appendChild(actions);
      card.appendChild(form);
      content.appendChild(card);
      app.appendChild(content);

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var subject = subjectInput.value.trim();
        var description = descInput.value.trim();
        errorEl.textContent = "";

        if (!subject || !description) {
          errorEl.textContent = "Please fill in both fields.";
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";

        fetch(apiUrl("/tickets"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicationId: config.application,
            externalUserId: config.externalUserId,
            subject: subject,
            description: description
          })
        })
          .then(function (res) {
            if (!res.ok) throw new Error("status " + res.status);
            return res.json();
          })
          .then(function (data) {
            renderTicketConfirmation(data.ticket);
          })
          .catch(function (err) {
            errorEl.textContent = "Could not create ticket: " + err.message;
            submitBtn.disabled = false;
            submitBtn.textContent = "Create ticket";
          });
      });
    }

    function renderTicketConfirmation(ticket) {
      app.innerHTML = "";
      app.appendChild(renderHeader("Support", true, goHome));

      var content = document.createElement("div");
      content.className = "content";
      var card = document.createElement("div");
      card.className = "card ticket-confirm";

      var big = document.createElement("div");
      big.className = "big";
      big.textContent = "\\u2705";

      var heading = document.createElement("h2");
      heading.textContent = "Ticket created";

      var subjectP = document.createElement("p");
      subjectP.textContent = ticket.subject;

      var idP = document.createElement("p");
      var idCode = document.createElement("code");
      idCode.textContent = ticket.id;
      idP.appendChild(document.createTextNode("Reference: "));
      idP.appendChild(idCode);

      card.appendChild(big);
      card.appendChild(heading);
      card.appendChild(subjectP);
      card.appendChild(idP);
      content.appendChild(card);
      app.appendChild(content);
    }

    renderHome();
  </script>
</body>
</html>`;
}
