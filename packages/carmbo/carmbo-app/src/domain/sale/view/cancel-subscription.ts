import {hebrew} from '../../../commons/hebrew.ts'
import {html} from '../../../commons/html-templates.ts'

export function showSubscriptionCancelled(email: string, studentName: string, productName: string) {
  return (
    '<!DOCTYPE html>' +
    html`
      <html lang="he" dir="rtl">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>ביטול מנוי</title>
        </head>
        <body>
          <h1>
            ${hebrew('בוטל מנוי productName עבור מנוי studentName - email', {
              studentName,
              productName,
              email,
            })}
          </h1>
        </body>
      </html>
    `
  )
}

export function showErrorCancellingSubscription(
  email: string,
  identifier: {salesEventNumber: number} | {productNumber: number},
) {
  const identifierText =
    'salesEventNumber' in identifier
      ? hebrew('ארוע salesEventNumber', {salesEventNumber: identifier.salesEventNumber})
      : hebrew('מוצר productNumber', {productNumber: identifier.productNumber})

  return (
    '<!DOCTYPE html>' +
    html`
      <html lang="he" dir="rtl">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>שגיאה בביטול מנוי</title>
        </head>
        <body>
          <h1>
            ${hebrew('שגיאה בביטול מנוי email עבור identifierText', {
              email,
              identifierText,
            })}
          </h1>
          <p>נתקלנו בשגיאה בעת ניסיון לבטל את המנוי שלך. אנא נסו שוב מאוחר יותר או פנה לתמיכה.</p>
        </body>
      </html>
    `
  )
}

export function showErrorSubscriptionNotFound({
  email,
  identifier,
  studentName,
  productName,
}: {
  email: string
  identifier: {salesEventNumber: number} | {productNumber: number}
  studentName: string | undefined
  productName: string | undefined
}) {
  const identifierText =
    'salesEventNumber' in identifier
      ? hebrew('ארוע salesEventNumber', {salesEventNumber: identifier.salesEventNumber})
      : hebrew('מוצר productNumber', {productNumber: identifier.productNumber})

  return (
    '<!DOCTYPE html>' +
    html`
      <html lang="he" dir="rtl">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>שגיאה בביטול מנוי</title>
        </head>
        <body>
          <h1></h1>
          ${hebrew('שגיאה בביטול מנוי email עבור identifierText', {email, identifierText})}
          <p>
            ${!studentName && hebrew('אימייל email לא נמצא', {email})}
            ${studentName && !productName && hebrew('מנוי עבור אימייל email לא נמצא', {email})}
          </p>
        </body>
      </html>
    `
  )
}

export function showErrorMultipleSalesFound(email: string) {
  return (
    '<!DOCTYPE html>' +
    html`
      <html lang="he" dir="rtl">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>שגיאה בביטול מנוי</title>
        </head>
        <body>
          <h1>${hebrew('שגיאה בביטול מנוי email', {email})}</h1>
          <p>נמצאו מספר מנויים עבור אימייל זה. אנא פנה למנהל המערכת לקבלת עזרה.</p>
        </body>
      </html>
    `
  )
}
