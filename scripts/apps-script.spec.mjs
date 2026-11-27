import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

function fixture() {
  const row = [
    'time',
    'Test visitor',
    'visitor@example.com',
    '+1 2025550100',
    '',
    '',
    'Web application',
    'Let’s discuss',
    'A useful project brief.',
    '2027-01-15',
    '14:30',
    'UTC',
    'summary',
    'PENDING',
    '',
    'PENDING',
    '',
    '',
    '',
    '',
  ];
  let denied = false;
  const sent = [];
  const sheet = {
    getRange(_row, column, _height, width) {
      return {
        getValues: () => [row.slice(column - 1, column - 1 + width)],
        setValues: ([values]) =>
          values.forEach((value, i) => {
            row[column - 1 + i] = value;
          }),
        setValue: (value) => {
          row[column - 1] = value;
        },
      };
    },
  };
  const context = vm.createContext({
    console: { log() {}, error() {} },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: {
      sendEmail(message) {
        if (denied) throw new Error('You do not have permission to call MailApp.sendEmail');
        sent.push(message);
      },
    },
  });
  vm.runInContext(readFileSync('google-apps-script/Code.gs', 'utf8'), context);
  return {
    context,
    row,
    sent,
    sheet,
    deny: (value) => {
      denied = value;
    },
  };
}

test('mail authorization failure preserves the lead and records a safe error', () => {
  const f = fixture();
  f.deny(true);
  assert.equal(f.context.sendSavedNotification(f.sheet, 2), false);
  assert.equal(f.row[13], 'FAILED');
  assert.equal(f.row[14], 'MAIL_AUTHORIZATION_REQUIRED');
  assert.equal(f.row[1], 'Test visitor');
  assert.equal(f.sent.length, 0);
});

function calendarFixture() {
  const f = fixture();
  const created = [];
  const busy = [];
  f.row[11] = 'Asia/Kolkata';
  f.context.Date = class extends Date {
    static now() {
      return Date.parse('2026-11-27T00:00:00Z');
    }
  };
  f.context.PropertiesService = {
    getScriptProperties: () => ({ getProperty: () => 'owner@example.com' }),
  };
  f.context.Utilities = {
    parseDate(local, timezone) {
      assert.equal(timezone, 'Asia/Kolkata');
      assert.equal(local, '2027-01-15 14:30');
      return new Date('2027-01-15T09:00:00Z');
    },
    formatDate: () => '2027-01-15 14:30',
  };
  f.context.CalendarApp = {
    EventTransparency: { TRANSPARENT: 'transparent' },
    Visibility: { PRIVATE: 'private' },
    getCalendarById: () => ({
      getEvents: () => busy,
      createEvent(title, start, end, options) {
        const entry = { title, start, end, options, visibility: '' };
        created.push(entry);
        return {
          getId: () => 'event-123',
          setVisibility: (value) => {
            entry.visibility = value;
          },
        };
      },
    }),
  };
  return { ...f, created, busy };
}

test('calendar hold uses the visitor time zone, lasts 30 minutes, and is private', () => {
  const f = calendarFixture();
  assert.equal(f.context.createSavedCalendarHold(f.sheet, 2), 'HELD');
  assert.equal(f.created.length, 1);
  assert.equal(f.created[0].start.toISOString(), '2027-01-15T09:00:00.000Z');
  assert.equal(f.created[0].end.toISOString(), '2027-01-15T09:30:00.000Z');
  assert.equal(f.created[0].visibility, 'private');
  assert.equal(f.created[0].options.guests, undefined);
  assert.equal(f.row[16], 'event-123');
  assert.equal(f.context.createSavedCalendarHold(f.sheet, 2), 'HELD');
  assert.equal(f.created.length, 1);
});

test('an occupied slot is recorded without creating a second calendar event', () => {
  const f = calendarFixture();
  f.busy.push({
    getTransparency: () => 'opaque',
    getStartTime: () => new Date('2027-01-15T08:45:00Z'),
    getEndTime: () => new Date('2027-01-15T09:15:00Z'),
  });
  assert.equal(f.context.createSavedCalendarHold(f.sheet, 2), 'CONFLICT');
  assert.equal(f.created.length, 0);
  assert.equal(f.row[15], 'CONFLICT');
});

test('calendar access failures preserve the lead and report a failed hold', () => {
  const f = calendarFixture();
  f.context.CalendarApp.getCalendarById = () => null;
  assert.equal(f.context.createSavedCalendarHold(f.sheet, 2), 'FAILED');
  assert.equal(f.row[17], 'CALENDAR_ACCESS_OR_WRITE_FAILED');
  assert.equal(f.row[1], 'Test visitor');
});

test('a saved failed lead can be retried, and sent notifications are skipped', () => {
  const f = fixture();
  f.deny(true);
  f.context.sendSavedNotification(f.sheet, 2);
  f.deny(false);
  assert.equal(f.context.sendSavedNotification(f.sheet, 2), true);
  assert.equal(f.row[13], 'SENT');
  assert.equal(f.row[14], '');
  assert.equal(f.sent[0].to, 'torpheltony06@gmail.com');
  assert.equal(f.sent[0].replyTo, 'visitor@example.com');
  assert.equal(f.context.sendSavedNotification(f.sheet, 2), true);
  assert.equal(f.sent.length, 1);
});
