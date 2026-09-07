
window.addEventListener('load', async function loadListener(evt) {
  evt.target.defaultView.removeEventListener('load', loadListener);

  const filterEnabled = document.getElementById('filter');
  filterEnabled.disabled = filterEnabled.indeterminate = true;
  filterEnabled.checked =
    (await chrome.storage.local.get({filterEnabled: true}))
      ?.filterEnabled === true;
  filterEnabled.disabled = filterEnabled.indeterminate = false;
  chrome.storage.local.onChanged.addListener(changes => {
    if ('filterEnabled' in changes) {
      filterEnabled.checked = changes.filterEnabled.newValue;
    }
  });
  filterEnabled.addEventListener('input', evt => {
    evt.preventDefault();
    chrome.storage.local.set({filterEnabled: filterEnabled.checked});
  });
});
