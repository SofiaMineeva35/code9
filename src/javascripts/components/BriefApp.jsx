import React, { useEffect, useRef, useState } from 'react'
import { questions, channels, fileRules, fileHint, intro } from '../brief-data'
import { readDraft, saveDraft, answer, combinedText, switchMode, makeSnapshot } from '../brief-state'
import { validateStep, validateBrief, validateFile, validateLink } from '../brief-validation'
import { createBriefPdf, downloadPdf } from '../brief-pdf'
import logo from '../../assets/logo.svg'
import radio from '../../assets/radio.svg'
import radioSelected from '../../assets/radio-selected.svg'
import check from '../../assets/check.svg'

function Field({ id, label, value, onChange, error, multiline = false, ...props }) {
  const Tag = multiline ? 'textarea' : 'input'
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <Tag id={id} value={value} onChange={e => onChange(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? id + '-error' : undefined} {...props} />
    {error && <p id={id + '-error'} className="error" role="alert">{error}</p>}
  </div>
}
function ContactLinks() {
  return <><a href="mailto:hello@code9.studio">hello@code9.studio</a><a href="tel:88005338988">8 (800) 533–89–88</a><a href="https://t.me/edcode9" target="_blank" rel="noreferrer">Telegram: @edcode9</a></>
}
function SiteNavigation() {
  // Остальные страницы сайта не входят в переданные макеты компонента.
  return <><span title="Страница кейсов не предоставлена">Кейсы</span><span title="Страница направлений не предоставлена">Что разрабатываем</span><span title="Страница команды не предоставлена">Команда и работа</span><a href="#brief">Обсудить задачу</a></>
}
export default function BriefApp() {
  const [draft, setDraft] = useState(() => {
    const value = readDraft()
    const context = new URLSearchParams(location.search).get('project')
    if (context && !value.contextDismissed) value.context = context.slice(0, 150)
    return value
  })
  const [files, setFiles] = useState([])
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState(() => readDraft().fileNames.length ? 'После перезагрузки прикрепите файлы повторно: ' + readDraft().fileNames.join(', ') : '')
  const [storageNotice, setStorageNotice] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [pdf, setPdf] = useState(null)
  const [pdfState, setPdfState] = useState('idle')
  const [policyOpen, setPolicyOpen] = useState(false)
  const stepHeading = useRef(null)
  const resultHeading = useRef(null)
  const fileInput = useRef(null)
  const readers = useRef(new Map())
  const busyRef = useRef(false)
  const pdfGeneration = useRef(0)
  const focusPending = useRef(false)
  const firstMount = useRef(true)
  const policyButton = useRef(null)
  const policyPanel = useRef(null)
  useEffect(() => {
    if (!saveDraft(draft)) setStorageNotice('Браузер не разрешил сохранить черновик. Ответы останутся до перезагрузки страницы.')
  }, [draft])
  useEffect(() => {
    if (firstMount.current) { firstMount.current = false; return }
    if (focusPending.current) { stepHeading.current?.focus(); focusPending.current = false }
  }, [draft.step, draft.mode, result])
  useEffect(() => { if (result) resultHeading.current?.focus() }, [result])
  useEffect(() => { if (policyOpen) policyPanel.current?.focus() }, [policyOpen])
  function update(key, value) {
    const next = { ...draft, [key]: value }
    if (key === 'shortText') next.shortEdited = true
    setDraft(next)
    if (Object.keys(errors).length) {
      const checked = validateBrief(next, files)
      setErrors(Object.fromEntries(Object.keys(errors).filter(id => checked[id]).map(id => [id, checked[id]])))
    }
  }
  function goStep(step) {
    setErrors({}); focusPending.current = true
    setDraft(previous => ({ ...previous, step }))
  }
  function changeMode(mode) {
    if (mode === draft.mode || busy) return
    setErrors({}); focusPending.current = true
    setDraft(previous => switchMode(previous, mode))
  }
  function focusError(found) {
    requestAnimationFrame(() => {
      const key = Object.keys(found)[0]
      const target = document.getElementById(key) || document.querySelector('[aria-invalid="true"]')
      target?.focus()
      target?.scrollIntoView({ block: 'center', behavior: 'instant' })
    })
  }
  function nextStep() {
    const found = validateStep(draft, draft.step)
    setErrors(found)
    if (Object.keys(found).length) { focusError(found); return }
    goStep(draft.step + 1)
  }
  function removeFile(id) {
    readers.current.get(id)?.abort(); readers.current.delete(id)
    setFiles(previous => previous.filter(f => f.id !== id))
    setDraft(previous => ({ ...previous, fileNames: files.filter(f => f.id !== id).map(f => f.name) }))
    setErrors(previous => { const next = { ...previous }; delete next.files; return next })
    requestAnimationFrame(() => document.getElementById('files')?.focus())
  }
  function readFile(item) {
    const reader = new FileReader()
    readers.current.set(item.id, reader)
    const finish = patch => setFiles(previous => previous.map(f => f.id === item.id ? { ...f, ...patch } : f))
    reader.onload = () => { readers.current.delete(item.id); finish({ status: 'ready', progress: 100 }) }
    reader.onerror = () => { readers.current.delete(item.id); finish({ status: 'error', error: 'Не удалось прочитать файл. Повторите попытку или удалите файл.' }) }
    reader.onprogress = e => { if (e.lengthComputable) finish({ progress: Math.round(e.loaded / e.total * 100) }) }
    // Чтение локальное: файл не загружается на сервер и не сохраняется в sessionStorage.
    reader.readAsArrayBuffer(item.file)
  }
  function addFiles(event) {
    const selected = Array.from(event.target.files || [])
    event.target.value = ''
    const available = fileRules.maxCount - files.length
    if (selected.length > available) setNotice('Можно прикрепить до 5 файлов. Лишние файлы не добавлены.')
    else setNotice('')
    const items = selected.slice(0, available).map(file => {
      const error = validateFile(file)
      return { id: crypto.randomUUID(), file, name: file.name, size: file.size, error, status: error ? 'error' : 'reading', progress: 0 }
    })
    setFiles(previous => [...previous, ...items])
    setDraft(previous => ({ ...previous, fileNames: [...files, ...items].map(f => f.name) }))
    items.filter(f => f.status === 'reading').forEach(readFile)
  }
  async function generatePdf(snapshot) {
    const generation = ++pdfGeneration.current
    setPdfState('creating'); setPdf(null)
    try {
      const blob = await createBriefPdf(snapshot)
      if (generation !== pdfGeneration.current) return
      setPdf(blob); setPdfState('ready')
    } catch { if (generation === pdfGeneration.current) setPdfState('error') }
  }
  function submit(event) {
    event.preventDefault()
    if (busyRef.current) return
    const found = validateBrief(draft, files)
    setErrors(found)
    if (Object.keys(found).length) {
      if (found.existing || found.goal) { focusPending.current = true; setDraft(previous => ({ ...previous, step: found.existing ? 0 : 1 })) }
      focusError(found); return
    }
    busyRef.current = true; setBusy(true)
    const snapshot = makeSnapshot(draft, files)
    // Учебная обработка завершена локально. Черновик не очищаем без подтверждения сервера.
    setResult(snapshot); setBusy(false); busyRef.current = false
    generatePdf(snapshot)
  }
  function policyLink() {
    return <button type="button" className="text-link inline" onClick={event => { policyButton.current = event.currentTarget; setPolicyOpen(true) }} >Политика обработки данных.</button>
  }
  function renderContacts() {
    return <>
      <fieldset className="contact-choices"><legend>Как с вами связаться?</legend>
        <div className="channel-row">{Object.entries(channels).map(([id, label]) => <label key={id} className="channel-choice"><input type="radio" name="channel" checked={draft.channel === id} onChange={() => { setErrors({}); update('channel', id) }} /><span>{draft.channel === id ? '[ ' + label + ' ]' : label}</span></label>)}</div>
      </fieldset>
      <Field key={draft.channel} id={draft.channel} label={channels[draft.channel]} value={draft[draft.channel]} onChange={value => update(draft.channel, value)} error={errors[draft.channel]} type={draft.channel === 'email' ? 'email' : draft.channel === 'phone' ? 'tel' : 'text'} autoComplete={draft.channel === 'telegram' ? 'off' : draft.channel === 'phone' ? 'tel' : 'email'} required />
      <Field id="name" label="Имя — необязательно" value={draft.name} onChange={value => update('name', value)} autoComplete="name" />
      <Field id="company" label="Компания — необязательно" value={draft.company} onChange={value => update('company', value)} autoComplete="organization" />
    </>
  }
  function renderFiles() {
    return <section className="attachments stack" aria-labelledby="files-label">
      <h3 id="files-label" className="label">Файл или ссылка — необязательно</h3>
      {files.map(file => <div className={'attachment' + (file.status === 'error' ? ' invalid' : '')} key={file.id}>
        <span className="file-format">{file.name.includes('.') ? file.name.split('.').pop().toUpperCase() : 'ФАЙЛ'}</span>
        <div className="file-description"><p>{file.name}</p><p className="label">{new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(file.size / (file.size >= 1048576 ? 1048576 : 1024))} {file.size >= 1048576 ? 'МБ' : 'КБ'} · {file.status === 'ready' ? 'Прикреплён' : file.status === 'reading' ? 'Подготовка… ' + file.progress + '%' : 'Не прикреплён'}</p>
          {file.error && <p className="error" role="alert">{file.error}</p>}
        </div>
        <div className="file-actions">{file.status === 'error' && !validateFile(file.file) && <button type="button" className="outline" onClick={() => { setFiles(previous => previous.map(f => f.id === file.id ? { ...f, status: 'reading', error: '' } : f)); readFile(file) }}>Повторить</button>}
          <button type="button" className="outline" aria-label={(file.status === 'reading' ? 'Отменить ' : 'Удалить ') + file.name} onClick={() => removeFile(file.id)}>{file.status === 'reading' ? 'Отменить' : 'Удалить'}</button>
        </div>
      </div>)}
      <div className="attachment-links"><button type="button" className="text-link" id="files" onClick={() => fileInput.current?.click()} disabled={files.length >= 5}>{files.length ? 'Добавить ещё файл' : 'Добавить файл'}</button>
        <button type="button" className="text-link" onClick={() => { update('linkVisible', true); requestAnimationFrame(() => document.getElementById('link')?.focus()) }}>Добавить ссылку</button>
        <input className="visually-hidden" tabIndex={-1} type="file" multiple accept=".pdf,.docx,.txt,.png,.jpg,.jpeg" ref={fileInput} aria-label="Выбрать файлы" onChange={addFiles} />
      </div>
      {files.length >= 5 && <p className="label" role="status">Выбрано 5 из 5 файлов. Удалите один, чтобы прикрепить другой.</p>}
      <p className="label">{fileHint}</p>
      {(draft.linkVisible || draft.link) && <Field id="link" label="Ссылка на материалы" value={draft.link} onChange={value => update('link', value)} error={errors.link} type="url" onBlur={() => { const error = validateLink(draft.link); if (error) setErrors(previous => ({ ...previous, link: error })) }} />}
      {errors.files && <p className="error" role="alert">{errors.files}</p>}
    </section>
  }
  function renderConsent() {
    return <div className="consent-field"><div className="consent-row"><label className="checkbox-label"><input id="consent" type="checkbox" checked={draft.consent} onChange={e => update('consent', e.target.checked)} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? 'consent-error' : undefined} required /><span className="checkbox-mark">{draft.consent && <img src={check} width="24" height="24" alt="" />}</span><span>Даю согласие на обработку персональных данных.</span></label> {policyLink()}</div>
      {errors.consent && <p className="error" id="consent-error" role="alert">{errors.consent}</p>}
    </div>
  }
  function renderQuestion() {
    const question = questions[draft.step]
    const unknown = draft.step === 1 && draft.goal === 'Пока не знаю'
    return <>
      <p className="label">Шаг {draft.step + 1} из 3</p>
      <h2 ref={stepHeading} tabIndex={-1}>{question.title}</h2>
      <p>{question.hint}</p>
      <fieldset id={question.id} tabIndex={-1} className="answer-list" aria-label={question.title} aria-invalid={Boolean(errors[question.id])} aria-describedby={errors[question.id] ? question.id + '-error' : undefined}>
        {question.options.map(option => <label className={'answer' + (draft[question.id] === option ? ' selected' : '')} key={option}>
          <input type="radio" name={question.id} value={option} checked={draft[question.id] === option} onChange={() => update(question.id, option)} />
          <img src={draft[question.id] === option ? radioSelected : radio} width="20" height="20" alt="" /><span>{option}</span>
        </label>)}
      </fieldset>
      {errors[question.id] && <p id={question.id + '-error'} className="error" role="alert">{errors[question.id]}</p>}
      <Field id={question.id + 'Text'} label={unknown ? 'Что сейчас не получается? — необязательно' : question.label} multiline value={draft[question.id + 'Text']} onChange={value => update(question.id + 'Text', value)} />
      {unknown && <p>Это нормально. Обсудим задачу вместе — можно продолжить без подробного ответа.</p>}
      <div className="actions">{draft.step > 0 && <button type="button" className="primary back" onClick={() => goStep(draft.step - 1)}>Назад</button>}<button type="button" className="primary" disabled={!answer(draft, question.id)} onClick={nextStep}>Дальше</button></div>
    </>
  }
  function renderForm() {
    if (draft.mode === 'interactive' && draft.step < 2) return renderQuestion()
    return <form noValidate onSubmit={submit} className="stack">
      {Object.keys(errors).length > 0 && <p className="error" role="alert">Проверьте запрос, контакт и согласие. Исправьте отмеченные поля и отправьте ещё раз.</p>}
      {draft.mode === 'interactive' ? <>
        <p className="label">Шаг 3 из 3</p><h2 tabIndex={-1} ref={stepHeading}>Проверьте запрос</h2>
        {questions.map((q, index) => <div className="review-answer" key={q.id}><p>{index === 0 ? 'Что уже есть: ' : 'Что должно измениться: '}{answer(draft, q.id)}</p><button type="button" className="text-link body-link" onClick={() => goStep(index)}>Изменить ответ</button></div>)}
        {draft.context && <p className="label">Связанный проект: {draft.context} · <button type="button" className="text-link inline" onClick={() => setDraft(previous => ({ ...previous, context: '', contextDismissed: true }))}>Убрать</button></p>}
        <Field id="details" label="Дополнительные сведения — необязательно" multiline value={draft.details} onChange={value => update('details', value)} />
      </> : <>
        {combinedText(draft) && <div className="stack switch-notice"><h2 className="subheading">Ваши ответы сохранены</h2><p>Вы перешли из интерактивного брифа. Проверьте собранный текст или вернитесь к вопросам.</p><button type="button" className="text-link" onClick={() => changeMode('interactive')}>Вернуться к интерактивному брифу</button></div>}
        {draft.context && <p className="label">Связанный проект: {draft.context} · <button type="button" className="text-link inline" onClick={() => setDraft(previous => ({ ...previous, context: '', contextDismissed: true }))}>Убрать</button></p>}
        <div ref={stepHeading} tabIndex={-1}><Field id="shortText" label="Что хотите создать или изменить?" multiline value={draft.shortText} onChange={value => update('shortText', value)} error={errors.shortText} required /></div>
      </>}
      {renderContacts()}{renderFiles()}{renderConsent()}
      <div className="actions">{draft.mode === 'interactive' && <button type="button" className="primary back" onClick={() => goStep(1)}>Назад</button>}<button className="primary" type="submit" disabled={busy || files.some(f => f.status === 'reading')}>{busy ? 'Обрабатываем…' : 'Отправить запрос'}</button></div>
    </form>
  }
  function renderResult() {
    return <div className="stack result"><h2 ref={resultHeading} tabIndex={-1}>Бриф подготовлен</h2><p role="status">Учебный режим: ответы обработаны в браузере. Запрос не отправлен. Письмо не отправлялось.</p>
      <section className="pdf-card stack" aria-labelledby="pdf-title"><h3 id="pdf-title">Копия вашего брифа</h3><p>Ответы, контакты и список приложенных материалов — в одном PDF.</p>
        <div className="attachment pdf-file"><span className="file-format">PDF</span><div><p>КОД9 — ваш бриф.pdf</p><p className="label" role="status">{pdfState === 'ready' ? 'Готов к скачиванию' : pdfState === 'error' ? 'Копия пока не готова' : 'Подготовка PDF…'}</p></div></div>
        {pdfState === 'ready' && <button className="primary" onClick={() => downloadPdf(pdf)}>Скачать PDF</button>}
        {pdfState === 'error' && <><p className="error" role="alert">Не удалось создать PDF. Ваши ответы сохранены.</p><button className="outline" onClick={() => generatePdf(result)}>Создать PDF повторно</button></>}
        <p className="label">PDF создаётся на вашем устройстве. Отправка на почту не подключена.</p>
      </section>
      <div className="result-summary stack"><h3>Ваш запрос</h3>{result.answers.map(a => <div key={a.question}><p className="label">{a.question}</p><p className="pre-wrap">{a.answer}</p></div>)}{result.description && <p className="pre-wrap">{result.description}</p>}<p>{channels[result.contact.channel]}: {result.contact.value}</p>{result.name && <p>Имя: {result.name}</p>}{result.company && <p>Компания: {result.company}</p>}{result.files.map((file, i) => <p key={i}>{file.name}</p>)}{result.link && <p className="pre-wrap">{result.link}</p>}</div>
      <button className="primary" onClick={() => { pdfGeneration.current++; setResult(null); setPdf(null); setPdfState('idle'); focusPending.current = true }}>Вернуться к брифу</button>
    </div>
  }
  return <>
    <a className="skip-link" href="#brief">Перейти к брифу</a>
    <header className="site-header"><div className="header-content"><img src={logo} width="180" height="44" alt="КОД9" /><nav aria-label="Основная навигация"><SiteNavigation /></nav></div></header>
    <main id="brief" className="page"><div className="intro"><h1>{intro.title}</h1><p>{intro.description}</p><div className="brief-tabs" role="group" aria-label="Вариант брифа">{[['short', 'Краткий бриф'], ['interactive', 'Интерактивный бриф']].map(([id, label]) => <button key={id} type="button" className="text-link" aria-pressed={draft.mode === id} onClick={() => { if (result) { pdfGeneration.current++; setResult(null); setPdf(null) }; changeMode(id) }}>{draft.mode === id ? '[ ' + label + ' ]' : label}</button>)}</div></div>
      <div className="brief-layout"><div className="form-column stack">{notice && <p className="label" role="status">{notice}</p>}{storageNotice && <p className="label" role="status">{storageNotice}</p>}{result ? renderResult() : renderForm()}</div>
        <aside className="direct-contact stack"><h2 className="subheading">Можно написать напрямую</h2><div className="contact-links"><ContactLinks /></div><hr /><p>Есть ТЗ — приложите его. Нет — расскажите, что хотите изменить.</p></aside>
      </div>
      {!result && <p className="demo-note">Учебный режим. Файлы и ответы остаются в браузере. Отправка запросов и писем не подключена.</p>}
    </main>
    <footer className="site-footer"><div className="footer-content stack"><div className="footer-contacts"><ContactLinks /></div><nav aria-label="Навигация в подвале"><SiteNavigation /></nav><div className="footer-meta"><span>© КОД9</span>{policyLink()}<span title="Документ с реквизитами не предоставлен">Реквизиты</span><span>ИНН 5050163338</span></div></div></footer>
    {policyOpen && <section className="policy-notice" tabIndex={-1} ref={policyPanel} aria-labelledby="policy-title" onKeyDown={e => { if (e.key === 'Escape') { setPolicyOpen(false); policyButton.current?.focus() } }}><h2 id="policy-title" className="subheading">Политика обработки данных</h2><p>Текст и адрес политики не предоставлены. В этой учебной версии данные не передаются на сервер.</p><button className="outline" onClick={() => { setPolicyOpen(false); policyButton.current?.focus() }}>Закрыть</button></section>}
  </>
}
