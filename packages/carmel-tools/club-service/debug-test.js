import {Temporal} from 'temporal-polyfill'
import {processDailyMessages} from './src/process-daily-messages.ts'

const todayStr = Temporal.Now.zonedDateTimeISO('Asia/Jerusalem')
  .toPlainDate()
  .toLocaleString('en-GB')
const yesterdayStr = Temporal.Now.zonedDateTimeISO('Asia/Jerusalem')
  .subtract({days: 1})
  .toPlainDate()
  .toLocaleString('en-GB')

const pastTime = '00:01'
const futureTime = '23:59'
const validMessage = 'Valid message'
const rows = [
  [todayStr, pastTime, 'x', 'Already sent'],
  [yesterdayStr, pastTime, '', 'Wrong date'],
  [todayStr, futureTime, '', 'Wrong time'],
  [todayStr, pastTime, '', ''], // Empty message
  [todayStr, pastTime, '', validMessage],
]

console.log('Input rows:')
rows.forEach((row, i) => {
  console.log(`  ${i}: [${row.join(', ')}]`)
})

console.log('\nProcessing result:')
const result = processDailyMessages(rows)
console.log(result)
