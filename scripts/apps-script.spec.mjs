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
