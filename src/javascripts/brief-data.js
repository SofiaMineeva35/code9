// Тексты и варианты из Figma. Здесь меняются вопросы, а не в компонентах.
export const questions = [
  {
    id: 'existing', title: 'Что у вас уже есть?',
    hint: 'Выберите один ответ или опишите своими словами.',
    label: 'Дополните ответ — необязательно',
    placeholder: 'Например: у нас уже есть приложение.',
    options: ['Есть идея нового продукта', 'Есть техническое задание', 'Есть продукт, который нужно изменить', 'Пока не знаю, с чего начать']
  },
  {
    id: 'goal', title: 'Что должно измениться?',
    hint: 'Выберите один ответ или опишите своими словами.',
    label: 'Что сейчас важно — необязательно',
    placeholder: 'Например: хотим упростить работу сотрудников.',
    options: ['Запустить первую рабочую версию', 'Упростить работу команды', 'Улучшить существующий продукт', 'Пока не знаю']
  }
]
export const channels = { email: 'Почта', phone: 'Телефон', telegram: 'Telegram' }
export const fileRules = { extensions: ['pdf', 'docx', 'txt', 'png', 'jpg', 'jpeg'], maxSize: 20 * 1024 * 1024, maxCount: 5 }
export const fileHint = 'PDF, DOCX, TXT, PNG, JPG · до 20 МБ · до 5 файлов'
export const intro = { title: 'Обсудить задачу', description: 'Расскажите, что хотите создать или изменить. Готовое техническое задание необязательно.' }
export const channelFields = {
  email: { label: 'Почта', placeholder: 'you@example.com', type: 'email', autoComplete: 'email' },
  phone: { label: 'Телефон', placeholder: '+7 999 123-45-67', type: 'tel', autoComplete: 'tel' },
  telegram: { label: 'Имя пользователя в Telegram', placeholder: '@username', type: 'text', autoComplete: 'off' }
}
export const demoNotice = 'Учебный режим: данные остаются в браузере. Можно скачать PDF; отправка запросов и писем не подключена.'
export function formatFileSize(size) {
  const unit = size >= 1048576 ? 'МБ' : size >= 1024 ? 'КБ' : 'Б'
  const divisor = unit === 'МБ' ? 1048576 : unit === 'КБ' ? 1024 : 1
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(size / divisor) + ' ' + unit
}
