import assert from 'node:assert/strict'
import {test} from 'node:test'
import {initializei18next} from '@giltayar/carmbo-commons/commons/i18next-utils'
import {registrationEmailContent} from '../../src/registration-email.ts'

test('registration emails include names, escape HTML and use the selected language', async () => {
  await initializei18next('en')
  const names = {studentName: 'Alice <script>&', communityName: 'Community <b>&'}
  const english = registrationEmailContent({...names, language: 'en'})
  assert.equal(english.subject, 'Welcome to Community <b>&')
  assert.ok(english.text.includes('Hello Alice <script>&,'))
  assert.ok(english.text.includes('Community <b>&'))
  assert.ok(english.html.includes('Alice &lt;script&gt;&amp;'))
  assert.ok(english.html.includes('Community &lt;b&gt;&amp;'))
  assert.ok(english.html.includes('dir="ltr"'))
  assert.ok(!english.html.includes('<script>'))
  const hebrew = registrationEmailContent({...names, language: 'he'})
  assert.equal(hebrew.subject, 'ברוכים הבאים לקהילת Community <b>&')
  assert.ok(hebrew.text.includes('שלום Alice <script>&,'))
  assert.ok(hebrew.html.includes('lang="he" dir="rtl"'))
})
