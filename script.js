(() => {
  'use strict';
  const stageButtons = Array.from(document.querySelectorAll('[data-stage]'));
  const panels = ['stage-listen', 'stage-order', 'stage-transcript'].map((id) => document.getElementById(id));
  stageButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      stageButtons.forEach((item, itemIndex) => {
        item.classList.toggle('active', itemIndex === index);
        item.setAttribute('aria-pressed', String(itemIndex === index));
        panels[itemIndex].hidden = itemIndex !== index;
      });
      document.getElementById('stage-counter').textContent = `0${index + 1} / 03`;
    });
  });

  const answers = Array.from(document.querySelectorAll('[data-answer]'));
  answers.forEach((button) => {
    button.addEventListener('click', () => {
      answers.forEach((item) => { item.classList.remove('correct', 'incorrect'); item.setAttribute('aria-pressed', 'false'); });
      const correct = button.dataset.answer === 'correct';
      button.classList.add(correct ? 'correct' : 'incorrect');
      button.setAttribute('aria-pressed', 'true');
      document.getElementById('answer-feedback').textContent = correct
        ? '答对了！原音说的是 “for one year”。再试试第二遍的词句练习。'
        : '再听一次，留意 “It will be closed…” 后面的时间。';
    });
  });

  const words = Array.from(document.querySelectorAll('#word-options button'));
  const selection = [];
  const correctOrder = ['The city university', 'will fix', 'its main library', 'next year.'];
  words.forEach((button) => {
    button.addEventListener('click', () => {
      selection.push(button.textContent.trim());
      button.disabled = true;
      document.getElementById('word-answer').textContent = selection.join(' ');
      if (selection.length === correctOrder.length) {
        const correct = selection.every((word, index) => word === correctOrder[index]);
        document.getElementById('word-feedback').textContent = correct
          ? '拼对了！去第三遍对照字幕，核对更多信息。'
          : '顺序还差一点。点击「重来」，再听一遍首句。';
      }
    });
  });
  document.getElementById('reset-words').addEventListener('click', () => {
    selection.length = 0;
    words.forEach((button) => { button.disabled = false; });
    document.getElementById('word-answer').textContent = '';
    document.getElementById('word-feedback').textContent = '听清主体、动作和时间。';
  });

  const audio = document.getElementById('sample-audio');
  const demoCard = document.querySelector('.demo-card');
  audio.addEventListener('play', () => demoCard.classList.add('playing'));
  ['pause', 'ended', 'error'].forEach((event) => audio.addEventListener(event, () => demoCard.classList.remove('playing')));
  audio.addEventListener('error', () => {
    document.getElementById('answer-feedback').textContent = '音频暂时无法播放，请确认 assets 文件夹与页面一起保留。';
  });

  const flipCard = document.querySelector('[data-card-flip]');
  flipCard.addEventListener('click', () => {
    const flipped = flipCard.classList.toggle('is-flipped');
    flipCard.setAttribute('aria-pressed', String(flipped));
    flipCard.setAttribute('aria-label', flipped ? '查看卡牌背面' : '查看卡牌正面');
    flipCard.querySelector('.flip-back').setAttribute('aria-hidden', String(flipped));
    flipCard.querySelector('.flip-front').setAttribute('aria-hidden', String(!flipped));
    document.getElementById('flip-hint').textContent = flipped
      ? '双鱼座 · 来自产品星座收藏，再点一次看卡背 ↻'
      : '点击卡背，翻开一份小惊喜 ↻';
  });

  const feedbackForm = document.getElementById('feedback-form');
  const feedbackMessage = document.getElementById('feedback-message');
  feedbackMessage.addEventListener('input', () => {
    document.getElementById('feedback-count').textContent = `${feedbackMessage.value.length} / 2000`;
  });
  const feedbackReceiver = (feedbackForm.dataset.receiver || '').trim();
  const feedbackStatus = document.getElementById('feedback-status');
  const feedbackSubmit = document.getElementById('feedback-submit');
  const feedbackSubmitLabel = document.getElementById('feedback-submit-label');
  let feedbackEndpoint = '';
  try {
    const configured = (window.LINGUA_FEEDBACK_ENDPOINT || '').trim();
    if (/^https:\/\//i.test(configured) || /^\/(?!\/)/.test(configured)) {
      const url = new URL(configured, window.location.href);
      const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
        && ['localhost', '127.0.0.1'].includes(window.location.hostname);
      if (url.protocol === 'https:' || localHttp) feedbackEndpoint = url.href;
    }
  } catch { /* An invalid endpoint keeps automatic submission disabled. */ }
  feedbackSubmit.disabled = !feedbackEndpoint;
  if (feedbackEndpoint) feedbackStatus.textContent = '点击发送后，意见会直接提交至我们的邮箱。联系方式选填，仅用于回复你的意见。';
  let sending = false;
  const buildFeedback = () => {
    const category = document.getElementById('feedback-category').value;
    const message = feedbackMessage.value.trim();
    const contact = document.getElementById('feedback-contact').value.trim();
    return {
      subject: `Lingua Quest 用户意见 · ${category}`,
      body: `反馈类型：${category}\n\n${message}\n\n联系方式：${contact || '未填写'}`,
    };
  };
  feedbackForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending || !feedbackEndpoint || !feedbackForm.reportValidity()) return;
    if (feedbackMessage.value.trim().length < 5) {
      feedbackStatus.dataset.state = 'error';
      feedbackStatus.textContent = '请填写至少 5 字的意见。';
      feedbackMessage.focus();
      return;
    }
    sending = true;
    feedbackSubmit.disabled = true;
    feedbackSubmitLabel.textContent = '正在发送…';
    feedbackForm.setAttribute('aria-busy', 'true');
    feedbackStatus.dataset.state = 'pending';
    feedbackStatus.textContent = '正在提交，请稍等。';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    try {
      const response = await fetch(feedbackEndpoint, {
        method: 'POST', mode: 'cors', credentials: 'omit', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: document.getElementById('feedback-category').value,
          message: feedbackMessage.value.trim(),
          contact: document.getElementById('feedback-contact').value.trim(),
          website: document.getElementById('feedback-website').value,
        }),
      });
      let result;
      try { result = await response.json(); } catch { result = null; }
      if (!response.ok || result?.ok !== true) {
        const knownError = result?.ok === false && typeof result.message === 'string' && result.message.length <= 200;
        const message = knownError ? result.message : '暂时无法发送，文字已保留。请稍后再试，或复制意见通过邮箱联系。';
        throw new Error(message);
      }
      feedbackStatus.dataset.state = 'success';
      feedbackStatus.textContent = '意见已提交给邮件服务器，谢谢你的建议！';
      // Keep the visitor's text even after success so it can be copied or reviewed.
    } catch (error) {
      feedbackStatus.dataset.state = 'error';
      feedbackStatus.textContent = error.name === 'AbortError'
        ? '等待超时，暂时无法确认发送结果。文字已保留，请稍后查看或复制意见通过邮箱联系。'
        : error instanceof TypeError
          ? '暂时无法连接，文字已保留。请稍后再试，或复制意见通过邮箱联系。'
          : error.message;
    } finally {
      clearTimeout(timeout);
      sending = false;
      feedbackSubmit.disabled = false;
      feedbackSubmitLabel.textContent = '发送建议';
      feedbackForm.setAttribute('aria-busy', 'false');
    }
  });
  document.getElementById('feedback-copy').addEventListener('click', async () => {
    if (!feedbackForm.reportValidity()) return;
    const feedback = buildFeedback();
    const content = `收件人：${feedbackReceiver}\n主题：${feedback.subject}\n\n${feedback.body}`;
    try {
      await navigator.clipboard.writeText(content);
      feedbackStatus.dataset.state = 'info';
      feedbackStatus.textContent = '意见已复制。请打开 QQ 邮箱，粘贴内容并发送给 2036702567@qq.com。';
    } catch {
      feedbackStatus.dataset.state = 'info';
      feedbackMessage.focus();
      feedbackMessage.select();
      feedbackStatus.textContent = '浏览器未允许自动复制，已选中意见。请手动复制，并发到 2036702567@qq.com。';
    }
  });
})();
