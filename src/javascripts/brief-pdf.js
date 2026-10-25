import fontUrl from '../assets/fonts/IBMPlexMono-Regular.ttf'
import { channels } from './brief-data'
// Лениво загружаем библиотеку: до завершения брифа она не нужна.
export async function createBriefPdf(snapshot) {
  const [{ jsPDF }, response] = await Promise.all([import('jspdf'), fetch(fontUrl)])
  if (!response.ok) throw new Error('Не удалось загрузить шрифт для PDF')
  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.addFileToVFS('IBMPlexMono-Regular.ttf', btoa(binary))
  doc.addFont('IBMPlexMono-Regular.ttf', 'IBM', 'normal')
  doc.setFont('IBM', 'normal')
  doc.setTextColor(12, 12, 12)
  let y = 22
  const write = (text, size = 11) => {
    doc.setFontSize(size)
    // Сохраняем абзацы; длинные слова и ссылки также переносятся.
    const lines = doc.splitTextToSize(String(text), 170)
    for (const line of lines) {
      if (y > 275) { doc.addPage(); y = 22 }
      doc.text(line, 20, y); y += size * 0.46 + 1
    }
    y += 4
  }
  write('КОД9 — ваш бриф', 20)
  write('Учебная копия. Запрос не отправлен. Письмо не отправлялось.', 10)
  write('Дата обработки: ' + new Date(snapshot.date).toLocaleString('ru-RU'))
  write('Вариант: ' + (snapshot.mode === 'short' ? 'Краткий бриф' : 'Интерактивный бриф'))
  snapshot.answers.forEach(a => { write(a.question, 13); write(a.answer) })
  if (snapshot.description) { write(snapshot.mode === 'short' ? 'Ваш запрос' : 'Дополнительные сведения', 13); write(snapshot.description) }
  write('Как с вами связаться', 13)
  write(channels[snapshot.contact.channel] + ': ' + snapshot.contact.value)
  if (snapshot.name) write('Имя: ' + snapshot.name)
  if (snapshot.company) write('Компания: ' + snapshot.company)
  if (snapshot.context) write('Связанный проект: ' + snapshot.context)
  write('Приложенные материалы', 13)
  write(snapshot.files.length ? snapshot.files.map(f => f.name).join('\n') : 'Файлы не приложены')
  if (snapshot.link) write('Ссылка: ' + snapshot.link)
  write('В копию включены имена файлов. Содержимое вложений не встроено.', 10)
  return doc.output('blob')
}
export function downloadPdf(blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = 'КОД9 — ваш бриф.pdf'; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
