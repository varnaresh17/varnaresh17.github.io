'use strict';
const year = document.querySelector('#year');
if (year) year.textContent = String(new Date().getFullYear());
document.querySelector('.copy-email')?.addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  try {
    await navigator.clipboard.writeText('varna.naresh@gmail.com');
    status.textContent = 'Email address copied.';
  } catch {
    status.textContent = 'Select the address above to copy it, or click it to email me.';
  }
});
