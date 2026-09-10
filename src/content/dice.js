
import {isExcludedCompany, isExcludedTitle} from '../filter';
import {elementAdded, elementRemoved, observeElement} from '../util/observe';
import {splitTerms} from '../util/split';

const selectors = {
  jobList: 'div.\\@container\\/job-list > div[role=list]',
  jobTitle: 'a[data-testid="job-search-job-detail-link"]',
  jobCompany: 'p[data-testid="job-card-company-name"]',
  jobLocation: 'a:has(> p[data-testid="job-card-company-name"]) + p',
};

const setHidden = (elt, hidden) => {
  elt.classList.toggle('jm-hidden', hidden);
};

const isInterestingTitle = title => {
  if (title && isExcludedTitle(title)) return false;

  const url = new URL(document.URL);
  if (url.pathname == '/jobs') {
    const keywordsParam = url.searchParams.get('q');
    if (keywordsParam) {
      const keywords = splitTerms(keywordsParam);
      if (
        keywords.some(it => it.toLowerCase() == 'android') &&
        !title.match(/\b(?:android|mobile)\b/i)
      ) {
        return false;
      }
    }
  }

  return true;
};

const isInterestingJob = job => {
  const title = job.querySelector(selectors.jobTitle)?.textContent?.trim();
  if (title && !isInterestingTitle(title)) return false;

  const company =
    job.querySelector(selectors.jobCompany)?.textContent?.trim();
  if (company && isExcludedCompany(company)) return false;

  const location =
    Array.from(job.querySelector(selectors.jobLocation)?.childNodes ?? [])
      ?.filter(it => it.nodeType == Node.TEXT_NODE)
      ?.[0]
      ?.data
      ?.trim();
  const url = new URL(document.URL);
  if (url.pathname == '/jobs') {
    const locationParam = url.searchParams.get('location');
    if (locationParam && location === 'Remote') {
      return false;
    }
  }

  return true;
};

const scrubJobList = list => {
  const jobs =
    Array.from(list.childNodes)
      .filter(it => it.nodeType == Node.ELEMENT_NODE)
      .filter(it => it.getAttribute('role') === 'listitem');
  for (const job of jobs) {
    setHidden(job, !isInterestingJob(job));
  }
};

const addStyleSheet = document => {
  let style = document.querySelector('#jobmonkey-style');
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('id', 'jobmonkey-style');
    style.appendChild(
      document.createTextNode(
        '.jm-gone { display: none !important; }\n' +
        '.jm-hidden { visibility: hidden !important; }\n'));
    document.head.appendChild(style);
    style.sheet.disabled = true;
  }
  return style.sheet;
};

const observeJobList = async (options) => {
  const signal = options?.signal;
  while (true) {
    const list = await elementAdded(document, selectors.jobList, {signal});
    await observeElement(document, list, scrubJobList, {signal});
  }
};


window.addEventListener('load', function loadListener(evt) {
  evt.target.defaultView.removeEventListener('load', loadListener);

  const styleSheet = addStyleSheet(document);
  (async () => {
    styleSheet.disabled =
      (await chrome.storage.local.get({filterEnabled: true}))
        ?.filterEnabled !== true;
    chrome.storage.local.onChanged.addListener(changes => {
      if ('filterEnabled' in changes) {
        styleSheet.disabled = changes.filterEnabled.newValue !== true;
      }
    });
  })();

  observeJobList();
});
