/** Set SHEET_ID, RECAPTCHA_SECRET, and WEBHOOK_KEY in Script Properties. */
const HEADERS = ['Timestamp', 'Full Name', 'Email', 'Phone/WhatsApp', 'Company', 'Website/Instagram', 'Project Type', 'Budget Range', 'Project Details', 'Preferred Date', 'Preferred Time', 'Time Zone', 'Brief Summary', 'Notification Status', 'Notification Error', 'Calendar Status', 'Calendar Event ID', 'Calendar Error', 'Start UTC', 'End UTC'];
const NOTIFICATION_TO = 'torpheltony06@gmail.com';

function doPost(e) {
  try {
    const properties = PropertiesService.getScriptProperties();
    const sheetId = properties.getProperty('SHEET_ID');
    const captchaSecret = properties.getProperty('RECAPTCHA_SECRET');
    const webhookKey = properties.getProperty('WEBHOOK_KEY');
    if (!sheetId || !captchaSecret || !webhookKey) return reply(false, 'Configuration missing.');
    const data = JSON.parse(e.postData.contents || '{}');
    if (data.webhookKey !== webhookKey) return reply(false, 'Unauthorized.');
    if (data.website_check) return reply(true);
    const clean = {};
    const fields = {fullName:100,email:254,dialCode:4,phone:24,company:100,website:200,projectType:40,budget:40,projectBrief:2000,preferredDate:10,preferredTime:5,timezone:80};
    Object.keys(fields).forEach(function (key) {
      clean[key] = typeof data[key] === 'string' ? data[key].trim().slice(0, fields[key]) : '';
    });
    if (clean.fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean.email) ||
        !/^\+\d{1,4}$/.test(clean.dialCode) || clean.phone.replace(/\D/g, '').length < 7 ||
        clean.projectBrief.length < 20 || !/^\d{4}-\d{2}-\d{2}$/.test(clean.preferredDate) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(clean.preferredTime)) return reply(false, 'Invalid form fields.');
    if (['Web application','Angular architecture','AI integration','Consulting','Other'].indexOf(clean.projectType) < 0 ||
        ['Under $2,000','$2,000–$5,000','$5,000–$10,000','$10,000+','Let’s discuss'].indexOf(clean.budget) < 0) return reply(false, 'Invalid project selection.');
    const age = Date.now() - Number(data.startedAt);
    if (!isFinite(age) || age < 2000 || age > 7200000) return reply(false, 'Invalid submission timing.');
    if (!data.recaptchaToken || typeof data.recaptchaToken !== 'string') return reply(false, 'Captcha is required.');
    const verification = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
      method:'post', payload:{secret:captchaSecret,response:data.recaptchaToken}, muteHttpExceptions:true
    });
    const checked = JSON.parse(verification.getContentText());
    if (!checked.success) return reply(false, 'Captcha failed.');
    const cache = CacheService.getScriptCache();
    const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, clean.email.toLowerCase())
      .map(function (n) { return ('0' + (n & 255).toString(16)).slice(-2); }).join('');
    const rateKey = 'lead-' + hash;
    if (cache.get(rateKey)) return reply(false, 'Please wait before sending again.');
    const brief = [clean.projectType, clean.budget, clean.projectBrief, clean.preferredDate + ' ' + clean.preferredTime + ' ' + clean.timezone].join(' | ');
    const sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    let row;
    try {
      if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
      sheet.getRange(1, 14, 1, 7).setValues([HEADERS.slice(13)]);
      sheet.appendRow([new Date(),clean.fullName,clean.email,clean.dialCode + ' ' + clean.phone,clean.company,clean.website,clean.projectType,clean.budget,clean.projectBrief,clean.preferredDate,clean.preferredTime,clean.timezone,brief,'PENDING','','PENDING','','','',''].map(safeCell));
      row = sheet.getLastRow();
      sheet.getRange(row, 10, 1, 3).setNumberFormat('@').setValues([[clean.preferredDate,clean.preferredTime,clean.timezone]]);
      cache.put(rateKey, '1', 60);
    } finally { lock.releaseLock(); }
    const calendarStatus = createSavedCalendarHold(sheet, row);
    const notificationSent = sendSavedNotification(sheet, row);
    return ContentService.createTextOutput(JSON.stringify({ok:true,notificationSent:notificationSent,calendarStatus:calendarStatus})).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error(error);
    return reply(false, 'Submission failed.');
  }
}

/** Run once from the Apps Script editor to grant Mail permission and test delivery. */
function authorizeAndTestEmail() {
  const sheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  const quota = MailApp.getRemainingDailyQuota();
  if (quota < 1) throw new Error('Mail quota is exhausted. Retry after the Google quota resets.');
  MailApp.sendEmail({to:NOTIFICATION_TO,subject:'Portfolio email setup test',body:'Email delivery is authorized for the portfolio linked to ' + sheet.getName() + '.'});
  console.log('Google accepted the setup test email for ' + NOTIFICATION_TO + '. Check its Inbox and Spam.');
}

/** Set CALENDAR_ID, then run this once in the editor to grant Calendar access. */
function authorizeAndCheckCalendar() {
  const calendarId = PropertiesService.getScriptProperties().getProperty('CALENDAR_ID');
  if (!calendarId) throw new Error('Set CALENDAR_ID in Script Properties first.');
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) throw new Error('The execution account cannot access CALENDAR_ID.');
  calendar.getEvents(new Date(), new Date(Date.now() + 30 * 60000));
  console.log('Calendar access authorized: ' + calendar.getName() + ' (' + calendar.getTimeZone() + '). No event was created.');
}

function requestedCalendarSlot(date, time, timezone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !timezone) throw new Error('INVALID_TIME');
  const local = date + ' ' + time;
  const start = Utilities.parseDate(local, timezone, 'yyyy-MM-dd HH:mm');
  if (Utilities.formatDate(start, timezone, 'yyyy-MM-dd HH:mm') !== local || start.getTime() <= Date.now() || start.getTime() > Date.now() + 90 * 86400000) throw new Error('INVALID_TIME');
  return {start:start,end:new Date(start.getTime() + 30 * 60000)};
}

function createSavedCalendarHold(sheet, row) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const values = sheet.getRange(row, 1, 1, 20).getValues()[0];
    if (values[16]) return String(values[15]);
    const calendarId = PropertiesService.getScriptProperties().getProperty('CALENDAR_ID');
    if (!calendarId) {
      sheet.getRange(row, 16, 1, 5).setValues([['NOT_CONFIGURED','','CALENDAR_ID_MISSING','','']]);
      return 'NOT_CONFIGURED';
    }
    let slot;
    try { slot = requestedCalendarSlot(String(values[9]), String(values[10]), String(values[11])); }
    catch (_) {
      sheet.getRange(row, 16, 1, 5).setValues([['INVALID_TIME','','INVALID_TIME','','']]);
      return 'INVALID_TIME';
    }
    try {
      const calendar = CalendarApp.getCalendarById(calendarId);
      if (!calendar) throw new Error('Calendar unavailable');
      const busy = calendar.getEvents(slot.start, slot.end).some(function (event) {
        return event.getTransparency() !== CalendarApp.EventTransparency.TRANSPARENT && event.getStartTime().getTime() < slot.end.getTime() && event.getEndTime().getTime() > slot.start.getTime();
      });
      if (busy) {
        sheet.getRange(row, 16, 1, 5).setValues([['CONFLICT','','SLOT_UNAVAILABLE',slot.start.toISOString(),slot.end.toISOString()]]);
        return 'CONFLICT';
      }
      const event = calendar.createEvent('Portfolio discovery call — ' + String(values[1]), slot.start, slot.end, {
        description:'Portfolio inquiry\nName: ' + values[1] + '\nEmail: ' + values[2] + '\nProject: ' + values[6] + '\nBudget: ' + values[7] + '\nBrief: ' + values[8] + '\nRequested time: ' + values[9] + ' ' + values[10] + ' (' + values[11] + ')\nLead row: ' + row + '\nPrivate hold. Meeting details are to be confirmed.',
        location:'Online — meeting details to be confirmed'
      });
      // Persist the event ID before further updates so a retry cannot create a duplicate.
      sheet.getRange(row, 16, 1, 5).setValues([['HELD',event.getId(),'',slot.start.toISOString(),slot.end.toISOString()]]);
      event.setVisibility(CalendarApp.Visibility.PRIVATE);
      return 'HELD';
    } catch (_) {
      sheet.getRange(row, 16).setValue('FAILED');
      sheet.getRange(row, 18).setValue('CALENDAR_ACCESS_OR_WRITE_FAILED');
      console.error('Calendar hold failed: CALENDAR_ACCESS_OR_WRITE_FAILED');
      return 'FAILED';
    }
  } finally { lock.releaseLock(); }
}

function sendSavedNotification(sheet, row) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const values = sheet.getRange(row, 1, 1, 20).getValues()[0];
    if (values[13] === 'SENT') return true;
    const details = [['Name',values[1]],['Email',values[2]],['Phone / WhatsApp',values[3]],['Company',values[4]],['Website / Instagram',values[5]],['Project type',values[6]],['Budget',values[7]],['Project brief',values[8]],['Preferred time',values[9] + ' ' + values[10] + ' (' + values[11] + ')'],['Calendar status',values[15] || 'Not requested'],['Calendar event ID',values[16] || '']];
    try {
      const html = '<h2>New portfolio inquiry</h2><table cellpadding="8" cellspacing="0">' + details.map(function (item) { return '<tr><th align="left">' + escapeHtml(item[0]) + '</th><td>' + escapeHtml(item[1]) + '</td></tr>'; }).join('') + '</table>';
      MailApp.sendEmail({to:NOTIFICATION_TO,replyTo:String(values[2]),subject:'New portfolio inquiry from ' + String(values[1]),body:details.map(function (item) { return item[0] + ': ' + item[1]; }).join('\n'),htmlBody:html});
      sheet.getRange(row, 14, 1, 2).setValues([['SENT','']]);
      return true;
    } catch (error) {
      const message = String(error && error.message || error);
      const reason = /authoriz|permission|scope/i.test(message) ? 'MAIL_AUTHORIZATION_REQUIRED' : /quota|limit|too many/i.test(message) ? 'MAIL_QUOTA_EXCEEDED' : 'MAIL_SEND_FAILED';
      sheet.getRange(row, 14, 1, 2).setValues([['FAILED',reason]]);
      console.error('Notification failed: ' + reason);
      return false;
    }
  } finally { lock.releaseLock(); }
}

/** Run manually after fixing mail permissions. Sends PENDING/FAILED rows only. */
function retryPendingNotifications() {
  const sheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID')).getSheets()[0];
  if (sheet.getLastRow() < 2) return;
  const values = sheet.getRange(2, 14, sheet.getLastRow() - 1, 1).getValues();
  let sent = 0;
  values.forEach(function (row, index) {
    if ((row[0] === 'PENDING' || row[0] === 'FAILED') && MailApp.getRemainingDailyQuota() > 0 && sendSavedNotification(sheet, index + 2)) sent++;
  });
  console.log('Retried notifications sent: ' + sent);
}

function safeCell(value) {
  if (typeof value !== 'string') return value;
  return /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (char) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]; });
}
function reply(ok, message) {
  return ContentService.createTextOutput(JSON.stringify({ok:ok,message:message || ''})).setMimeType(ContentService.MimeType.JSON);
}
