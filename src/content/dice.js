
import {isExcludedCompany, isExcludedTitle} from '../filter';
import {elementAdded, elementRemoved, observeElement} from '../util/observe';
import {splitTerms} from '../util/split';
import {Visibility, Styler} from '../util/styler';

const selectors = {
  intercomContainer: '#intercom-container',
  jobList: 'div.\\@container\\/job-list > div[role=list]',
  jobCard: 'div[data-testid=job-card]',
  jobCardLink: 'a[data-testid=job-search-job-card-link]',
  jobTitle: 'a[data-testid="job-search-job-detail-link"]',
  jobCompany: 'p[data-testid="job-card-company-name"]',
  jobLocation: 'a:has(> p[data-testid="job-card-company-name"]) + p',
};

let styler;

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
  if (location?.match(/\bSan Leandro\b/)) return false; // Wells Fargo
  const url = new URL(document.URL);
  if (url.pathname == '/jobs') {
    const locationParam = url.searchParams.get('location');
    if (locationParam && location === 'Remote') {
      return false;
    }
  }

  return true;
};

const fixSelection = jobs => {
  if (!styler.enabled) return;
  const selectedJobId = new URL(document.URL).searchParams.get('selectedJobId');
  if (!selectedJobId) return;
  const selectedJobIndex = jobs.findIndex(job =>
    job.querySelector(selectors.jobCard)?.getAttribute('data-job-guid')
      === selectedJobId);
  if (
    selectedJobIndex < 0 ||
      styler.getVisibility(jobs[selectedJobIndex]) == Visibility.VISIBLE
  ) {
    return;
  }
  for (
    let i = (selectedJobIndex + 1) % jobs.length;
    i != selectedJobIndex;
    i = (i + 1) % jobs.length
  ) {
    if (styler.getVisibility(jobs[i]) == Visibility.VISIBLE) {
      const link = jobs[i].querySelector(selectors.jobCardLink);
      if (link) {
        link.click();
        break;
      }
    }
  }
};

const scrubJobList = list => {
  const jobs =
    Array.from(list.childNodes)
      .filter(it => it.nodeType == Node.ELEMENT_NODE)
      .filter(it => it.getAttribute('role') === 'listitem');
  for (const job of jobs) {
    styler.setVisibility(
      job, isInterestingJob(job) ? Visibility.VISIBLE : Visibility.HIDDEN);
  }
};

const observeIntercom = async(options) => {
  const signal = options?.signal;
  while (true) {
    const container =
      await elementAdded(document, selectors.intercomContainer, {signal});
    styler.setVisibility(container, Visibility.GONE);
    await elementRemoved(document, container, {signal});
  }
};

const observeJobList = async (options) => {
  const signal = options?.signal;
  while (true) {
    const list = await elementAdded(document, selectors.jobList, {signal});
    await observeElement(document, list, scrubJobList, {signal});
  }
};

(async () => {
  if (document.readyState == 'loading') {
    await new Promise(resolve => {
      document.addEventListener('DOMContentLoaded', function listener(evt) {
        document.removeEventListener('DOMContentLoaded', listener);
        resolve();
      });
    });
  }

  styler = new Styler(document);
  styler.enabled = false;
  styler.enabled =
    (await chrome.storage.local.get({filterEnabled: true}))
      ?.filterEnabled === true;
  chrome.storage.local.onChanged.addListener(changes => {
    if ('filterEnabled' in changes) {
      styler.enabled = changes.filterEnabled.newValue === true;
    }
  });

  observeIntercom();
  observeJobList();
})();
