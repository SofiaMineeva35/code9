# Сдача проекта КОД9

Обновление V5 опубликовано и проверено 27 октября 2026. Код: коммит 39cefd9. Сборка и публикация успешны: https://github.com/SofiaMineeva35/code9/actions/runs/40509891098.

На публичном сайте повторно выполнен полный тест V5: оба брифа, сохранение ответов, прямое редактирование, вложения, результат после перезагрузки, новое обращение, скачивание краткого и длинного PDF, клавиатура и ширины 320/390/768/1440 px. Ошибок JavaScript и HTTP-ошибок ресурсов нет. Отчёт: [v5-public-browser-report.json](v5-public-browser-report.json).

Актуальный сценарий: [DEMO.md](DEMO.md), результаты проверок: [VERIFICATION.md](VERIFICATION.md). Ниже сохранена история первой публикации от 25 октября.

Исходный проект: `/Users/sofamineeva/Desktop/Code9`.
Рабочая копия: `/Users/sofamineeva/Documents/ChatGPT/КОД9 2`.

Репозиторий: https://github.com/SofiaMineeva35/code9

Работающая страница: https://sofiamineeva35.github.io/code9/

Публикация подтверждена 25 октября 2026. GitHub Actions: установка, тесты, сборка и deploy — success.
Успешный запуск: https://github.com/SofiaMineeva35/code9/actions/runs/40222064494

На публичной странице выполнен полный сценарий `BASE_URL=https://sofiamineeva35.github.io/code9 npm run test:browser`: оба брифа, сохранение ответов, шаги, контакты, проверки, вложения, результат и скачивание трёх PDF. Проверены 320, 390, 768 и 1440 px. Ошибок JavaScript и HTTP-ошибок ресурсов в сценарии нет. Отчёт — `public-browser-report.json`.

Первый запуск остановился из-за выключенного Pages. После выбора Source → GitHub Actions публикация выполнена успешно. Готовая локальная сборка также находится в `docs/`.

Для самостоятельной публикации, если потребуется:

1. В GitHub Desktop откройте репозиторий `code9` и нажмите **Push origin**.
2. На GitHub откройте репозиторий → **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Откройте **Actions → Build and publish CODE9**. Если запуск не появился, нажмите **Run workflow → main → Run workflow**.
4. Дождитесь зелёных заданий build и deploy. Ссылку сайта покажет задание deploy и страница Settings → Pages.

Что показать: [сценарий демонстрации](DEMO.md).
Как менять тексты и как работают данные: [README](../README.md).
Что проверено: [VERIFICATION.md](VERIFICATION.md).
Как использовали ИИ и что исправили: [AI-LOG.md](AI-LOG.md).

Ограничения: это учебный бриф без сервера. Запрос и письмо не отправляются; PDF формируется в браузере. Текст политики и адреса остальных страниц сайта не предоставлены. Платные сервисы и секретные ключи не используются.
