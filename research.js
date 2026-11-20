'use strict';
const entries = document.body.classList.contains('publication-template') ? [] : [...document.querySelectorAll('.research-entry')];
const areaButtons = [...document.querySelectorAll('.area-filter')];
const search = document.querySelector('#research-search');
const typeFilter = document.querySelector('#type-filter');
const params = new URLSearchParams(window.location.search);
let area = areaButtons.some(button => button.dataset.area === params.get('area')) ? params.get('area') : 'all';
function updateResearch() {
  const words = (search?.value || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  const type = typeFilter?.value || 'all';
  let count = 0;
  entries.forEach(entry => {
    const matchesArea = area === 'all' || entry.dataset.areas.split(' ').includes(area);
    const matchesType = type === 'all' || entry.dataset.type === type || (type === 'conference' && entry.dataset.type === 'proceeding');
    const matchesSearch = words.every(word => entry.dataset.search.includes(word));
    entry.hidden = !(matchesArea && matchesType && matchesSearch);
    if (!entry.hidden) count += 1;
  });
  document.querySelectorAll('.publication-group').forEach(group => {
    const groupEntries = [...group.querySelectorAll('.research-entry')];
    const visible = groupEntries.filter(entry => !entry.hidden).length;
    group.hidden = visible === 0;
    group.querySelector('.publication-group-count').textContent = visible === groupEntries.length ? `${visible} entries` : `${visible} of ${groupEntries.length} entries`;
  });
  areaButtons.forEach(button => {
    const selected = button.dataset.area === area;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const status = document.querySelector('#results-status');
  if (status) status.textContent = `${count} of ${entries.length} ${typeFilter ? 'publications and activities' : 'research highlights'} shown`;
  const empty = document.querySelector('#no-results');
  if (empty) empty.hidden = count !== 0;
}
areaButtons.forEach(button => button.addEventListener('click', () => {
  area = button.dataset.area;
  updateResearch();
  const next = new URL(window.location.href);
  if (area === 'all') next.searchParams.delete('area');
  else next.searchParams.set('area', area);
  history.replaceState(null, '', next);
}));
search?.addEventListener('input', updateResearch);
typeFilter?.addEventListener('change', updateResearch);
document.querySelector('#reset-filters')?.addEventListener('click', () => {
  area = 'all';
  search.value = '';
  if (typeFilter) typeFilter.value = 'all';
  const next = new URL(window.location.href);
  next.searchParams.delete('area');
  history.replaceState(null, '', next);
  updateResearch();
});
if (entries.length) updateResearch();
document.querySelectorAll('figure img').forEach(img => img.addEventListener('error', () => {
  if (img.parentElement.parentElement.querySelector('.image-failed-note')) return;
  const note = document.createElement('p');
  note.className = 'image-failed-note';
  note.textContent = 'Figure could not load. Read the linked paper for the original figure.';
  img.parentElement.parentElement.appendChild(note);
}));

document.querySelectorAll('.publication-jump-links a').forEach(link => link.addEventListener('click', () => {
  area = 'all';
  if (search) search.value = '';
  if (typeFilter) typeFilter.value = 'all';
  const next = new URL(window.location.href);
  next.searchParams.delete('area');
  history.replaceState(null, '', next);
  updateResearch();
}));

