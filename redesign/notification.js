(function (root) {
  async function sendRedesignNotification(notification) {
    // Keep the recipient fixed even if a malformed API response is received.
    const url = 'https://formsubmit.co/ajax/smmd999a@gmail.com';
    if (notification.url !== url) throw new Error('Unable to send your request notification.');

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(notification.body),
          signal: AbortSignal.timeout(8000),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || (result.success !== true && result.success !== 'true')) {
          throw new Error('Email notification was not accepted.');
        }
        return;
      } catch {
        if (attempt === 2) {
          throw new Error('Your request was saved, but the notification could not be sent. Please try again shortly.');
        }
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { sendRedesignNotification };
  } else {
    root.sendRedesignNotification = sendRedesignNotification;
  }
})(typeof window !== 'undefined' ? window : undefined);
