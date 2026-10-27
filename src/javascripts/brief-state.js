import { questions } from './brief-data'
export const STORAGE_KEY = 'code9.brief.v1'
export const RESULT_KEY = 'code9.brief.result.v1'
export function emptyDraft() {
  return { mode: 'short', step: 0, editing: false, shortText: '', shortEdited: false, lastGenerated: '', existing: '', existingText: '', goal: '', goalText: '', details: '', channel: 'email', email: '', phone: '', telegram: '', name: '', company: '', link: '', linkVisible: false, consent: false, context: '', contextDismissed: false, fileNames: [] }
}
export function readDraft() {
  const initial = emptyDraft()
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY))
    if (!value || typeof value !== 'object') return initial
    for (const key of Object.keys(initial)) {
      if (typeof initial[key] === typeof value[key]) initial[key] = value[key]
    }
    if (!['short', 'interactive'].includes(initial.mode)) initial.mode = 'short'
    if (![0, 1, 2].includes(initial.step)) initial.step = 0
    if (!['email', 'phone', 'telegram'].includes(initial.channel)) initial.channel = 'email'
    initial.fileNames = Array.isArray(initial.fileNames) ? initial.fileNames.filter(name => typeof name === 'string') : []
    for (const q of questions) if (!q.options.includes(initial[q.id])) initial[q.id] = ''
    return initial
  } catch { return initial }
}
export function saveDraft(draft) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); return true } catch { return false }
}
export function answer(draft, id) { return [draft[id], draft[id + 'Text'].trim()].filter(Boolean).join('. ') }
export function combinedText(draft) {
  return [answer(draft, 'existing') && 'Что уже есть: ' + answer(draft, 'existing'), answer(draft, 'goal') && 'Что должно измениться: ' + answer(draft, 'goal'), draft.details.trim()].filter(Boolean).join('\n\n')
}
// Не затираем отредактированный краткий текст при переключении.
export function switchMode(draft, mode) {
  const next = { ...draft, mode, editing: false }
  if (mode === 'short' && !draft.shortEdited) {
    next.shortText = combinedText(draft)
    next.lastGenerated = next.shortText
  }
  return next
}
export function makeSnapshot(draft, files, now = new Date()) {
  return { date: now.toISOString(), mode: draft.mode, description: draft.mode === 'short' ? draft.shortText.trim() : draft.details.trim(), answers: draft.mode === 'interactive' ? questions.map(q => ({ question: q.title, answer: answer(draft, q.id) })) : [], contact: { channel: draft.channel, value: draft[draft.channel].trim() }, name: draft.name.trim(), company: draft.company.trim(), context: draft.context, files: files.map(f => ({ name: f.name, size: f.size })), link: draft.link.trim() }
}
// Результат хранится отдельно: перезагрузка не возвращает пользователя к форме.
export function readResult() {
  try {
    const value = JSON.parse(sessionStorage.getItem(RESULT_KEY))
    if (!value || !['short', 'interactive'].includes(value.mode) || !Number.isFinite(Date.parse(value.date))) return null
    if (typeof value.description !== 'string' || !Array.isArray(value.answers) || !Array.isArray(value.files)) return null
    if (!['email', 'phone', 'telegram'].includes(value.contact?.channel) || typeof value.contact.value !== 'string') return null
    if (!value.answers.every(a => typeof a.question === 'string' && typeof a.answer === 'string')) return null
    if (!value.files.every(f => typeof f.name === 'string' && Number.isFinite(f.size))) return null
    return value
  } catch { return null }
}
export function saveResult(snapshot) {
  try { sessionStorage.setItem(RESULT_KEY, JSON.stringify(snapshot)); return true } catch { return false }
}
export function clearResult() {
  try { sessionStorage.removeItem(RESULT_KEY) } catch { /* Работа в памяти остаётся доступной. */ }
}
