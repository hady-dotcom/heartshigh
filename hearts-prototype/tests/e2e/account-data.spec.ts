import { expect, test } from '@playwright/test'
import { SETTINGS, joinLearner, mailLink, uniqueEmail, waitForMail } from './account-helpers'

test('A20: Download my data emails a zip link that contains data.json and my-hearts.html', async ({ page }) => {
  const email = uniqueEmail('a20-data')
  await joinLearner(page, 'Data Learner', email, 'data-zip-1')
  await page.goto(`${SETTINGS}?account=data`)
  await page.getByTestId('download-data-submit').click()
  await expect(page.getByTestId('notice')).toContainText('download')

  const mail = await waitForMail(email, 'data is ready')
  const href = mailLink(mail, '/api/hearts/my-data')
  expect(href, 'download link').toBeTruthy()
  const zip = await page.request.get(href!)
  expect(zip.ok()).toBeTruthy()
  const bytes = await zip.body()
  expect(bytes.subarray(0, 2).toString()).toBe('PK')

  const JSZip = (await import('jszip')).default
  const archive = await JSZip.loadAsync(bytes)
  expect(Object.keys(archive.files)).toEqual(expect.arrayContaining(['data.json', 'my-hearts.html']))
  const data = JSON.parse(await archive.file('data.json')!.async('string'))
  expect(data.profile.email).toBe(email)
})
