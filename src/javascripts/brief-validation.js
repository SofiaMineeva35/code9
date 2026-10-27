import { fileRules } from './brief-data'
import { answer } from './brief-state'
export function validateStep(draft, step) {
  const id = step === 0 ? 'existing' : 'goal'
  return answer(draft, id) ? {} : { [id]: 'Выберите ответ или опишите своими словами.' }
}
export function validateContact(channel, value) {
  const text = value.trim()
  if (channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return 'Проверьте адрес: например, anna@example.com'
  if (channel === 'phone' && (!/^[+\d\s()–-]+$/.test(text) || text.replace(/\D/g, '').length < 10 || text.replace(/\D/g, '').length > 15)) return 'Проверьте номер телефона: например, +7 999 123-45-67'
  if (channel === 'telegram' && !/^@[a-zA-Z0-9_]{5,32}$/.test(text)) return 'Укажите Telegram: например, @username'
  return ''
}
export function validateLink(value) {
  if (!value.trim()) return ''
  try { const u = new URL(value); if (['https:', 'http:'].includes(u.protocol) && u.hostname.includes('.')) return '' } catch { /* ошибка ниже */ }
  return 'Укажите полную ссылку: например, https://example.com/brief'
}
export function validateFile(file) {
  if (!fileRules.extensions.includes(file.name.split('.').pop().toLowerCase())) return 'Формат не поддерживается. Выберите PDF, DOCX, TXT, PNG или JPG.'
  if (file.size > fileRules.maxSize) return 'Больше 20 МБ. Удалите файл и добавьте ссылку на него.'
  return ''
}
export function validateBrief(draft, files) {
  const errors = {}
  if (draft.mode === 'short' && !draft.shortText.trim()) errors.shortText = 'Коротко опишите, что хотите создать или изменить.'
  if (draft.mode === 'interactive') Object.assign(errors, validateStep(draft, 0), validateStep(draft, 1))
  const contactError = validateContact(draft.channel, draft[draft.channel])
  if (contactError) errors[draft.channel] = contactError
  const linkError = validateLink(draft.link)
  if (linkError) errors.link = linkError
  if (!draft.consent) errors.consent = 'Подтвердите согласие на обработку персональных данных.'
  if (files.some(f => f.status !== 'ready')) errors.files = 'Дождитесь подготовки файлов. Ошибочные файлы удалите или добавьте повторно.'
  return errors
}
