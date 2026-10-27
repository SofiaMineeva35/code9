import React, { useEffect, useRef, useState } from 'react'
import { questions, channels, channelFields, fileRules, fileHint, formatFileSize, demoNotice, intro } from '../brief-data'
import { emptyDraft, readDraft, saveDraft, readResult, saveResult, clearResult, answer, switchMode, makeSnapshot } from '../brief-state'
import { validateStep, validateBrief, validateFile, validateLink } from '../brief-validation'
import { createBriefPdf, downloadPdf } from '../brief-pdf'
import logo from '../../assets/logo.svg'
import radio from '../../assets/radio.svg'
import radioSelected from '../../assets/radio-selected.svg'
import channelIcon from '../../assets/channel.svg'
import channelSelected from '../../assets/channel-selected.svg'
import check from '../../assets/check.svg'

function Field({ id, label, value, onChange, error, multiline = false, ...props }) {
  const Tag = multiline ? 'textarea' : 'input'
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <Tag id={id} value={value} onChange={e => onChange(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? id + '-error' : undefined} {...props} />
    {error && <p id={id + '-error'} className="error" role="alert">{error}</p>}
  </div>
}
function Steps({ step }) {
  return <div className="brief-steps" aria-label={`Шаг ${step + 1} из 3`}>
    <p className="control">Шаг {step + 1} из 3</p>
    <ol>{['Что уже есть', 'Что изменить', 'Проверка'].map((label, index) => <li key={label} className={index <= step ? 'reached' : ''} aria-current={index === step ? 'step' : undefined}>{label}</li>)}</ol>
  </div>
}
function SiteNavigation({ header = false }) {
  // Другие страницы сайта не входят в этот проект компонента брифа.
  return <><span>Кейсы</span><span>Что разрабатываем</span><span>Команда и работа</span><a className={header ? 'button primary contact-cta' : ''} href="#brief">Обсудить задачу</a></>
}
export default function BriefApp() {
  const [draft, setDraft] = useState(() => {
    const value = readDraft()
    const context = new URLSearchParams(location.search).get('project')
    if (context && !value.contextDismissed) value.context = context.slice(0, 150)
    return value
  })
  const [result, setResult] = useState(readResult)
  const [files, setFiles] = useState([])
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState(() => readDraft().fileNames.length ? 'После перезагрузки прикрепите файлы повторно: ' + readDraft().fileNames.join(', ') : '')
  const [storageNotice, setStorageNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [prepareError, setPrepareError] = useState(false)
  const [pdf, setPdf] = useState(null)
  const [pdfState, setPdfState] = useState('idle')
  const [info, setInfo] = useState(null)
  const stepHeading = useRef(null)
  const resultHeading = useRef(null)
  const fileInput = useRef(null)
  const readers = useRef(new Map())
  const busyRef = useRef(false)
  const pdfGeneration = useRef(0)
  const focusPending = useRef(false)
  const dialog = useRef(null)
  const infoTrigger = useRef(null)
  const restoringResult = useRef(true)

  useEffect(() => {
    if (!saveDraft(draft)) setStorageNotice('Браузер не разрешил сохранить черновик. Ответы останутся до перезагрузки страницы.')
  }, [draft])
  useEffect(() => {
    if (focusPending.current) {
      stepHeading.current?.focus({ preventScroll: true })
      focusPending.current = false
    }
  }, [draft.step, draft.mode, draft.editing, result])
  useEffect(() => {
    if (result) resultHeading.current?.focus({ preventScroll: true })
    if (result && restoringResult.current) generatePdf(result)
    restoringResult.current = false
  }, [result])
  useEffect(() => { if (info) dialog.current?.showModal() }, [info])
  useEffect(() => () => {
    pdfGeneration.current++
    readers.current.forEach(reader => reader.abort())
  }, [])

  function update(key, value) {
    const next = { ...draft, [key]: value }
    if (key === 'shortText') next.shortEdited = true
    setDraft(next)
    if (Object.keys(errors).length) {
      const checked = validateBrief(next, files)
      setErrors(Object.fromEntries(Object.keys(errors).filter(id => checked[id]).map(id => [id, checked[id]])))
    }
  }
  function goStep(step, editing = false) {
    setErrors({}); setPrepareError(false); focusPending.current = true
    setDraft(previous => ({ ...previous, step, editing }))
  }
  function changeMode(mode) {
    if (mode === draft.mode || busy || result) return
    setErrors({}); setPrepareError(false); focusPending.current = true
    setDraft(previous => switchMode(previous, mode))
  }
  function focusError(found) {
    requestAnimationFrame(() => {
      const key = Object.keys(found)[0]
      const target = document.getElementById(key) || document.querySelector('[aria-invalid="true"]')
      target?.focus({ preventScroll: true })
      target?.scrollIntoView({ block: 'center', behavior: 'instant' })
    })
  }
  function nextStep() {
    const found = validateStep(draft, draft.step)
    setErrors(found)
    if (Object.keys(found).length) { focusError(found); return }
    goStep(draft.editing ? 2 : draft.step + 1)
  }
  function removeFile(id) {
    readers.current.get(id)?.abort(); readers.current.delete(id)
    const remaining = files.filter(f => f.id !== id)
    setFiles(remaining)
    setDraft(previous => ({ ...previous, fileNames: remaining.map(f => f.name) }))
    setErrors(previous => { const next = { ...previous }; delete next.files; return next })
    requestAnimationFrame(() => document.getElementById('files')?.focus({ preventScroll: true }))
  }
  function readFile(item) {
    const finish = patch => setFiles(previous => previous.map(f => f.id === item.id ? { ...f, ...patch } : f))
    try {
      const reader = new FileReader()
      readers.current.set(item.id, reader)
      reader.onload = () => { readers.current.delete(item.id); finish({ status: 'ready', progress: 100 }) }
      reader.onerror = () => { readers.current.delete(item.id); finish({ status: 'error', error: 'Не удалось прочитать файл. Повторите попытку или удалите файл.' }) }
      reader.onprogress = event => { if (event.lengthComputable) finish({ progress: Math.round(event.loaded / event.total * 100) }) }
      // Local: читаем на устройстве. Серверная загрузка не подключена.
      reader.readAsArrayBuffer(item.file)
    } catch { finish({ status: 'error', error: 'Не удалось прочитать файл. Повторите попытку или удалите файл.' }) }
  }
  function addFiles(event) {
    const selected = Array.from(event.target.files || [])
    event.target.value = ''
    const available = fileRules.maxCount - files.length
    setNotice(selected.length > available ? 'Можно прикрепить до 5 файлов. Лишние файлы не добавлены.' : '')
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
  async function submit(event) {
    event.preventDefault()
    if (busyRef.current) return
    const found = validateBrief(draft, files)
    setErrors(found)
    if (Object.keys(found).length) {
      if (found.existing || found.goal) goStep(found.existing ? 0 : 1, true)
      setErrors(found); focusError(found); return
    }
    busyRef.current = true; setBusy(true); setPrepareError(false)
    try {
      const snapshot = makeSnapshot(draft, files)
      if (!saveResult(snapshot)) setStorageNotice('Результат доступен в этой вкладке до перезагрузки. Скачайте PDF, чтобы сохранить копию.')
      // Снимок зафиксирован один раз. Повтор PDF не создаёт новое обращение.
      await generatePdf(snapshot)
      setResult(snapshot)
    } catch { setPrepareError(true) }
    finally { setBusy(false); busyRef.current = false }
  }
  function startNew() {
    pdfGeneration.current++
    readers.current.forEach(reader => reader.abort()); readers.current.clear()
    clearResult(); setResult(null); setPdf(null); setPdfState('idle')
    setFiles([]); setErrors({}); setNotice(''); setStorageNotice(''); setPrepareError(false)
    focusPending.current = true
    setDraft(emptyDraft())
  }
  function openInfo(kind, event) { infoTrigger.current = event.currentTarget; setInfo(kind) }
  function closeInfo() { dialog.current?.close(); setInfo(null); infoTrigger.current?.focus({ preventScroll: true }) }
  function policyButton(inverse = false) {
    return <button type="button" className={`button ${inverse ? 'inverse' : 'quiet'} policy-button`} onClick={event => openInfo('policy', event)}>Политика обработки данных</button>
  }
  function renderModes() {
    return <div className="brief-mode">
      <div className="brief-tabs" role="group" aria-label="Вариант брифа">{[['short', 'Краткий бриф'], ['interactive', 'Интерактивный бриф']].map(([id, label]) => <button key={id} type="button" aria-pressed={draft.mode === id} onClick={() => changeMode(id)} disabled={busy}>{label}</button>)}</div>
      <p className="caption">{draft.mode === 'short' ? 'Опишите задачу своими словами.' : 'Ответьте на вопросы по шагам.'}</p>
    </div>
  }
  function renderContacts() {
    const field = channelFields[draft.channel]
    return <>
      <div className="contact-fields">
        <fieldset className="contact-choices"><legend>Как с вами связаться?</legend>
          <div className="channel-row">{Object.entries(channels).map(([id, label]) => <label key={id} className={`channel-choice ${draft.channel === id ? 'selected' : ''}`}><input type="radio" name="channel" checked={draft.channel === id} onChange={() => { setErrors({}); update('channel', id) }} /><img src={draft.channel === id ? channelSelected : channelIcon} width="20" height="20" alt="" /><span>{label}</span></label>)}</div>
        </fieldset>
        <Field key={draft.channel} id={draft.channel} {...field} value={draft[draft.channel]} onChange={value => update(draft.channel, value)} error={errors[draft.channel]} required />
      </div>
      <div className="name-company"><Field id="name" label="Имя — необязательно" placeholder="Как вас зовут" value={draft.name} onChange={value => update('name', value)} autoComplete="name" /><Field id="company" label="Компания — необязательно" placeholder="Название компании" value={draft.company} onChange={value => update('company', value)} autoComplete="organization" /></div>
    </>
  }
  function renderFiles() {
    return <section className="attachments stack" aria-labelledby="files-label">
      <h3 id="files-label" className="control">Материалы — необязательно</h3>
      {files.map(file => <div className={`attachment ${file.status === 'error' ? 'invalid' : ''}`} key={file.id}>
        <span className="file-format">{file.name.includes('.') ? file.name.split('.').pop().toUpperCase() : 'ФАЙЛ'}</span>
        <div className="file-description"><p className="control">{file.name}</p><p className="caption">{formatFileSize(file.size)} · {file.status === 'ready' ? 'выбран на устройстве' : file.status === 'reading' ? 'читаем файл на устройстве…' : 'не выбран'}</p>{file.error && <p className="error" role="alert">{file.error}</p>}</div>
        <div className="file-actions">{file.status === 'error' && !validateFile(file.file) && <button type="button" className="button quiet" onClick={() => { setFiles(previous => previous.map(f => f.id === file.id ? { ...f, status: 'reading', error: '', progress: 0 } : f)); readFile(file) }}>Повторить</button>}<button type="button" className="button quiet" aria-label={(file.status === 'reading' ? 'Отменить ' : 'Удалить ') + file.name} onClick={() => removeFile(file.id)}>{file.status === 'reading' ? 'Отменить' : 'Удалить'}</button></div>
      </div>)}
      <div className="attachment-links"><button type="button" className="button outline" id="files" onClick={() => fileInput.current?.click()} disabled={files.length >= 5}>{files.length ? 'Добавить ещё файл' : 'Добавить файл'}</button><button type="button" className="button quiet" onClick={() => { update('linkVisible', true); requestAnimationFrame(() => document.getElementById('link')?.focus({ preventScroll: true })) }}>Добавить ссылку</button><input className="visually-hidden" tabIndex={-1} type="file" multiple accept=".pdf,.docx,.txt,.png,.jpg,.jpeg" ref={fileInput} aria-label="Выбрать файлы" onChange={addFiles} /></div>
      {files.length >= 5 && <p className="caption" role="status">Выбрано 5 из 5 файлов. Удалите один, чтобы прикрепить другой.</p>}
      <p className="caption">{fileHint}</p>
      {(draft.linkVisible || draft.link) && <Field id="link" label="Ссылка на материалы" placeholder="https://example.com/brief" value={draft.link} onChange={value => update('link', value)} error={errors.link} type="url" onBlur={() => { const error = validateLink(draft.link); if (error) setErrors(previous => ({ ...previous, link: error })) }} />}
      {errors.files && <p className="error" role="alert">{errors.files}</p>}
    </section>
  }
  function renderConsent() {
    return <div className="consent-field"><label className="checkbox-label"><input id="consent" type="checkbox" checked={draft.consent} onChange={e => update('consent', e.target.checked)} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? 'consent-error' : undefined} required /><span className="checkbox-mark">{draft.consent && <img src={check} width="24" height="24" alt="" />}</span><span>Даю согласие на обработку персональных данных.</span></label>{policyButton()}{errors.consent && <p className="error" id="consent-error" role="alert">{errors.consent}</p>}</div>
  }
  function renderContext() {
    return draft.context && <p className="caption">Связанный проект: {draft.context} · <button type="button" className="button quiet context-remove" onClick={() => setDraft(previous => ({ ...previous, context: '', contextDismissed: true }))}>Убрать</button></p>
  }
  function renderQuestion() {
    const question = questions[draft.step]
    return <>
      <Steps step={draft.step} />
      <div className="question-body">
        <h2 ref={stepHeading} tabIndex={-1}>{question.title}</h2><p className="muted">{question.hint}</p>
        <fieldset id={question.id} tabIndex={-1} className="answer-list" aria-label={question.title} aria-invalid={Boolean(errors[question.id])} aria-describedby={errors[question.id] ? question.id + '-error' : undefined}>
          {question.options.map(option => <label className={`answer ${draft[question.id] === option ? 'selected' : ''}`} key={option}><input type="radio" name={question.id} value={option} checked={draft[question.id] === option} onChange={() => update(question.id, option)} /><img src={draft[question.id] === option ? radioSelected : radio} width="24" height="24" alt="" /><span>{option}</span></label>)}
        </fieldset>
        <Field id={question.id + 'Text'} label={question.label} placeholder={question.placeholder} multiline value={draft[question.id + 'Text']} onChange={value => update(question.id + 'Text', value)} />
        {errors[question.id] && <p id={question.id + '-error'} className="error" role="alert">{errors[question.id]}</p>}
      </div>
      <div className="actions question-actions">{draft.editing ? <button type="button" className="button outline" onClick={() => goStep(2)}>К проверке запроса</button> : draft.step > 0 ? <button type="button" className="button outline" onClick={() => goStep(0)}>Назад</button> : <span className="reserved-action" aria-hidden="true" />}<button type="button" className="button primary" disabled={!answer(draft, question.id)} onClick={nextStep}>{draft.editing ? 'Сохранить ответ' : 'Далее'}</button></div>
    </>
  }
  function renderForm() {
    if (draft.mode === 'interactive' && draft.step < 2) return renderQuestion()
    return <form noValidate onSubmit={submit}>
      <fieldset disabled={busy} className="stack form-fields" aria-busy={busy}>
        {draft.mode === 'interactive' ? <>
          <Steps step={2} /><h2 tabIndex={-1} ref={stepHeading}>Проверьте запрос</h2>
          {questions.map((question, index) => <div className="review-answer" key={question.id}><h3 className="control">{index === 0 ? 'Что уже есть' : 'Что должно измениться'}</h3><p className="pre-wrap">{answer(draft, question.id) || 'Ответ ещё не выбран'}</p><button type="button" className="button quiet" onClick={() => goStep(index, true)}>{index === 0 ? 'Изменить исходные данные' : 'Изменить цель проекта'}</button></div>)}
          {renderContext()}<Field id="details" label="Дополнительные сведения — необязательно" placeholder="Дополнительные сведения — необязательно" multiline value={draft.details} onChange={value => update('details', value)} />
        </> : <>
          {renderContext()}<div ref={stepHeading} tabIndex={-1}><Field id="shortText" label="Что хотите создать или изменить?" placeholder="Например: хотим заменить таблицы и переписку приложением для сотрудников." multiline value={draft.shortText} onChange={value => update('shortText', value)} error={errors.shortText} required /></div>
        </>}
        {renderContacts()}{renderFiles()}{renderConsent()}<p className="caption">{demoNotice}</p>
        {prepareError && <p className="error" role="alert">Не удалось подготовить бриф. Ответы и выбранные файлы сохранены. Повторите попытку.</p>}
        <div className="actions form-actions">{draft.mode === 'interactive' && <button type="button" className="button outline back" onClick={() => goStep(1)}>Назад</button>}<button className="button primary prepare" type="submit" disabled={busy || files.some(file => file.status === 'reading')}>{busy ? 'Обрабатываем…' : prepareError ? 'Повторить подготовку' : 'Подготовить бриф'}</button></div>
      </fieldset>
    </form>
  }
  function renderResult() {
    return <div className="stack result"><h2 className="result-title" ref={resultHeading} tabIndex={-1}>Бриф подготовлен</h2><p role="status">Ответы сохранены в этой вкладке. Запрос в КОД9 не отправлен, письмо не отправлялось.</p>
      <section className="pdf-card" aria-labelledby="pdf-title"><h3 id="pdf-title">Копия вашего брифа</h3><p>Ответы, контакты и список выбранных файлов.</p>
        {pdfState !== 'error' && <div className="pdf-file"><span className="file-format">PDF</span><div><p className="control">КОД9 — ваш бриф.pdf</p><p className="caption" role="status">{pdfState === 'ready' ? 'Готов к скачиванию' : 'Подготовка PDF…'}</p></div></div>}
        {pdfState === 'ready' && <button className="button primary" onClick={() => downloadPdf(pdf)}>Скачать PDF</button>}
        {pdfState === 'error' && <><p className="error" role="alert">Не удалось создать PDF. Ваши ответы сохранены.</p><button className="button outline retry-pdf" onClick={() => generatePdf(result)}>Создать PDF повторно</button></>}
      </section>
      <p>Отправить материалы можно письмом на <a href="mailto:hello@code9.studio">hello@code9.studio</a> или в Telegram <a href="https://t.me/edcode9" target="_blank" rel="noreferrer">@edcode9</a>.</p>
      <button className="button outline new-request" onClick={startNew}>Начать новое обращение</button>
    </div>
  }
  return <>
    <a className="skip-link" href="#brief">Перейти к брифу</a>
    <header className="site-header"><div className="header-content"><img src={logo} width="180" height="44" alt="КОД9" /><nav aria-label="Основная навигация"><SiteNavigation header /></nav></div></header>
    <main id="brief" className="page"><div className="intro"><h1>{intro.title}</h1><p>{intro.description}</p></div>
      <div className="brief-layout"><div className="form-column stack">
        {!result && renderModes()}
        {storageNotice && <p className="caption" role="status">{storageNotice}</p>}
        {!result && notice && <p className="caption" role="status">{notice}</p>}
        {result ? renderResult() : renderForm()}
      </div>
        <aside className="direct-contact stack"><h2>Можно написать напрямую</h2><a className="button outline" href="mailto:hello@code9.studio">Написать на hello@code9.studio</a><a className="button outline" href="tel:88005338988">Позвонить: 8 (800) 533–89–88</a><a className="button outline" href="https://t.me/edcode9" target="_blank" rel="noreferrer">Написать в Telegram</a><hr /><p>Ответим не позднее следующего рабочего дня.</p><p>Приглашение в тендер можно прислать письмом вместе с условиями и материалами.</p></aside>
      </div>
    </main>
    <footer className="site-footer"><div className="footer-content stack"><a className="footer-email" href="mailto:hello@code9.studio">hello@code9.studio</a><div className="footer-contacts"><a href="tel:88005338988">8 (800) 533–89–88</a><a href="https://t.me/edcode9" target="_blank" rel="noreferrer">Telegram: @edcode9</a></div><hr /><nav aria-label="Навигация в подвале"><SiteNavigation /></nav><div className="footer-meta"><span>© КОД9</span>{policyButton(true)}<button className="button inverse requisites" type="button" onClick={event => openInfo('requisites', event)}>Реквизиты</button><span>ИНН 5050163338</span></div></div></footer>
    {info && <dialog className="info-dialog" ref={dialog} aria-labelledby="info-title" onCancel={event => { event.preventDefault(); closeInfo() }}><h2 id="info-title">{info === 'policy' ? 'Политика обработки данных' : 'Реквизиты'}</h2><p>{info === 'policy' ? 'Текст политики и адрес документа ещё не предоставлены. В этой демонстрации данные не передаются на сервер.' : 'ИНН 5050163338. Документ с полными реквизитами ещё не предоставлен.'}</p><button className="button quiet" onClick={closeInfo}>Закрыть</button></dialog>}
  </>
}
