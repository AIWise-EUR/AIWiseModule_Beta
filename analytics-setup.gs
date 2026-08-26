/**
 * analytics-setup.gs
 * Google Apps Script — Web App backend for AI-Wise analytics.
 *
 * ── HOW TO DEPLOY ─────────────────────────────────────────────
 * 1. Open Google Drive → New → More → Google Apps Script
 * 2. Delete default code and paste this entire file.
 * 3. Deploy → New deployment
 *      Type:           Web app
 *      Execute as:     Me
 *      Who has access: Anyone
 * 4. Authorize → copy the Web App URL.
 * 5. Paste URL into ENDPOINT in analytics.js.
 * ──────────────────────────────────────────────────────────────
 *
 * Spreadsheet structure (auto-created on first event):
 *
 *  Sheet "Prompt Events"
 *    A  Date        (YYYY-MM-DD)
 *    B  Event type  (prompt_copy | prompt_download)
 *    C  Stage       (exploring | searching | … | diagnostic)
 *    D  Prompt type (course_prompt | activity_prompt | …)
 *
 *  Sheet "Diagnostic Results"
 *    A  Date              (YYYY-MM-DD)
 *    B  Recommended stage
 *    C  Checked items count
 *    D  Checked node IDs  (comma-separated, e.g. RQ11,RQ12,RU21)
 *    E  Stage scores JSON (e.g. {"exploring":100,"rq":60,…})
 *
 *  Sheet "Feedback"
 *    A  Date    (YYYY-MM-DD)
 *    B  Page    (path of the page the feedback was submitted from)
 *    C  Text    (free-form feedback text from the widget textarea)
 */

function doGet(e) {
  return ContentService.createTextOutput("ok")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var ok = ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);

  try {
    var raw = e.postData ? e.postData.contents : null;
    if (!raw) return ok;

    var payload   = JSON.parse(raw);
    var eventType = payload.eventType || "";
    var date      = payload.date      || new Date().toISOString().substring(0, 10);
    var data      = payload.data      || {};

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (eventType === "prompt_copy" || eventType === "prompt_download") {
      var pSheet = getOrCreateSheet(ss, "Prompt Events", [
        "Date", "Event Type", "Stage", "Prompt Type"
      ]);
      pSheet.appendRow([date, eventType, data.stage || "", data.promptType || ""]);
    }

    if (eventType === "diagnostic_result") {
      var dSheet = getOrCreateSheet(ss, "Diagnostic Results", [
        "Date", "Recommended Stage", "Checked Count", "Checked Nodes", "Stage Scores"
      ]);
      dSheet.appendRow([
        date,
        data.recommendedStage || "",
        data.checkedCount     || 0,
        (data.checkedNodes    || []).join(","),
        JSON.stringify(data.scores || {})
      ]);
    }

    if (eventType === "feedback") {
      var fSheet = getOrCreateSheet(ss, "Feedback", [
        "Date", "Page", "Text"
      ]);
      fSheet.appendRow([date, data.path || "", data.text || ""]);
    }

  } catch (err) {
    Logger.log("Analytics error: " + err.toString());
  }

  return ok;
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}
