
import {isExcludedCompany, isExcludedTitle} from '../filter';
import AbortablePromise from '../util/abortable-promise';
import {elementAdded, elementRemoved, observeElement} from '../util/observe';
import {splitTerms} from '../util/split';
import {Visibility, Styler} from '../util/styler';

const selectors = {
  workspace: '#workspace',

  feed: 'div[data-testid=mainFeed]',
  feedItem: 'div > div > div > div > div[role=listitem]',
  feedItemHeaderText:
    'div > div > div:has(+ button[aria-label^="Open control menu for post by "]) > div > p',

  moduleHeadline: 'div > div > p',

  jobSearchLayout: 'header:has([componentkey="searchResultsHeaderComponent"]) + div',
  jobList: '[componentkey=SearchResultsMainContent]',
  jobCard: 'div:has([componentkey^="job-card-component-ref-"])',
  jobButton: 'div[role=button][componentkey^="job-card-component-ref-"]',
  jobAttributes: 'figure + div > div > div > div',
  jobDetails: 'div:has(> div > [componentkey=SearchResultsMainContent]) + div *[data-component-type=LazyColumn]',
  jobMatchRef: '[id^="JobMatchRef_"]',
  aboutJob: '[componentkey^="JobDetails_AboutTheJob_"]',
  peopleWhoCanHelp: '[componentkey^="JobDetailsPeopleWhoCanHelpSlot_"]',
  applicantInsights: '[componentkey^="JobDetails_PremiumApplicantInsights_"]',
  companyInsights: '[componentkey^="JobDetails_PremiumCompanyInsights_"]',
  aboutCompany: '[componentkey^="JobDetails_AboutTheCompany_"]',
  expandableTextBox: '[data-testid="expandable-text-box"]',
  expandableTextButton: 'button[data-testid="expandable-text-button"]',
};

let styler;

const getPuzzleModules = parent =>
  Array.from(parent.querySelectorAll(selectors.moduleHeadline))
   .filter(it => it.textContent.trim() === 'Today\u2019s puzzles')
   .map(it => it.parentNode.parentNode.parentNode);

const isSuggestedPost = feedItem =>
  feedItem
    .querySelector(selectors.feedItemHeaderText)
    ?.textContent
    ?.trim() === 'Suggested';

const scrubWorkspace = workspace => {
  const puzzleModules = getPuzzleModules(workspace);
  for (const module of puzzleModules) {
    styler.setVisibility(module, Visibility.GONE);
  }
};

const scrubFeed = feed => {
  const items =
    Array.from(feed.querySelectorAll(selectors.feedItem))
      .filter(it =>
        it.parentNode?.parentNode?.parentNode?.parentNode?.parentNode === feed);
  for (const item of items) {
    styler.setVisibility(
      item, isSuggestedPost(item) ? Visibility.GONE : Visibility.VISIBLE);
  }
};

const isInterestingTitle = title => {
  if (isExcludedTitle(title)) {
    return false;
  }

  const keywordsParam = new URL(document.URL).searchParams.get('keywords');
  if (keywordsParam) {
    const keywords = splitTerms(keywordsParam);
    if (
      keywords.some(it => it.toLowerCase() == 'android') &&
      !title.match(/\b(?:android|mobile)\b/i)
    ) {
      return false;
    }
  }

  return true;
};

const isInterestingJob = job => {
  const attributes = job.querySelector(selectors.jobAttributes);

  const title =
    Array.from(
      attributes
        .childNodes[0]
        ?.querySelector('p > span:nth-child(2)')
        ?.childNodes)
      ?.find(it => it.nodeType == Node.TEXT_NODE)
      ?.data
      ?.trim();
  if (title && !isInterestingTitle(title)) return false;

  const company =
    attributes.childNodes[1]?.querySelector('p')?.textContent?.trim();
  if (company && isExcludedCompany(company)) return false;

  const location = attributes.childNodes[2]?.textContent?.trim();
  if (location?.match(/\bSan Leandro\b/)) return false; // Wells Fargo

  return true;
};

const fixSelection = jobs => {
  if (!styler.enabled) return;
  const currentJobId = new URL(document.URL).searchParams.get('currentJobId');
  if (!currentJobId) return;
  const currentJobIndex = jobs.findIndex(it =>
    it.querySelector('[componentkey^="job-card-component-ref-"]')
      ?.getAttribute('componentkey')
        === `job-card-component-ref-${currentJobId}`);
  if (
    currentJobIndex < 0 ||
      styler.getVisibility(jobs[currentJobIndex]) == Visibility.VISIBLE
  ) {
    return;
  }
  for (
    let i = (currentJobIndex + 1) % jobs.length;
    i != currentJobIndex;
    i = (i + 1) % jobs.length
  ) {
    if (styler.getVisibility(jobs[i]) == Visibility.VISIBLE) {
      const button = jobs[i].querySelector(selectors.jobButton);
      if (button) {
        button.click();
        break;
      }
    }
  }
};

const scrubJobList = list => {
  const jobs =
    Array.from(list.childNodes).filter(
      it => it.nodeType == Node.ELEMENT_NODE && it.matches(selectors.jobCard));
  for (const job of jobs) {
    styler.setVisibility(
      job, isInterestingJob(job) ? Visibility.VISIBLE : Visibility.HIDDEN);
  }
  fixSelection(jobs);
};

const scrubJobDetails = details => {
  const aboutJob = details.querySelector(selectors.aboutJob);

  const peopleWhoCanHelp = details.querySelector(selectors.peopleWhoCanHelp);
  if (peopleWhoCanHelp) {
    styler.setVisibility(peopleWhoCanHelp, Visibility.GONE);
  }

  const jobMatchRef = details.querySelector(selectors.jobMatchRef);
  if (aboutJob && jobMatchRef) {
    for (var elt = jobMatchRef; elt; elt = elt.parentNode) {
      if (elt.parentNode == aboutJob.parentNode) {
        styler.setVisibility(elt, Visibility.GONE);
        break;
      }
    }
  }

  details
    .querySelector(selectors.aboutJob)
    ?.querySelector(selectors.expandableTextBox)
    ?.querySelector(selectors.expandableTextButton)
    ?.click();

  const applicantInsights = details.querySelector(selectors.applicantInsights);
  if (applicantInsights) {
    styler.setVisibility(applicantInsights, Visibility.GONE);
  }

  const companyInsights = details.querySelector(selectors.companyInsights);
  if (companyInsights) {
    styler.setVisibility(companyInsights, Visibility.GONE);
  }

  const aboutCompany = details.querySelector(selectors.aboutCompany);
  if (aboutCompany) {
    styler.setVisibility(aboutCompany, Visibility.GONE);
  }
};

const observeFeed = async (parent, options) => {
  const signal = options?.signal;
  while (true) {
    const feed = await elementAdded(parent, selectors.feed, {signal});
    await observeElement(parent, feed, scrubFeed, {signal});
  }
};

const observeWorkspace = async (options) => {
  const signal = options?.signal;
  while (true) {
    const workspace = await elementAdded(document, selectors.workspace, {signal});
    scrubWorkspace(workspace);
    const localController = new AbortController();
    const observer =
      new MutationObserver(mutationList => { scrubWorkspace(workspace); });
    try {
      const localSignal =
        signal ? AbortSignal.any([signal, localController.signal]) :
        localController.signal;

      observer.observe(
        workspace, {attributes: true, childList: true, subtree: true});
      observeFeed(workspace, {signal: localSignal});

      await elementRemoved(document, workspace, {signal});
    } finally {
      observer.disconnect();
      localController.abort(Error('Task complete'));
    }
  }
};

const observeJobList = async (layout, options) => {
  const signal = options?.signal;
  while (true) {
    const list = await elementAdded(layout, selectors.jobList, {signal});
    await observeElement(layout, list, scrubJobList, {signal});
  }
};

const observeJobDetails = async (layout, options) => {
  const signal = options?.signal;
  while (true) {
    const details =
      await elementAdded(layout, selectors.jobDetails, {signal});
    await observeElement(layout, details, scrubJobDetails, {signal});
  }
};

const observeJobSearch = async (options) => {
  const signal = options?.signal;
  while (true) {
    const layout =
      await elementAdded(document, selectors.jobSearchLayout, {signal});
    const localController = new AbortController();
    try {
      const localSignal =
        signal ? AbortSignal.any([signal, localController.signal]) :
        localController.signal;
      observeJobList(layout, {signal: localSignal});
      observeJobDetails(layout, {signal: localSignal});
      await elementRemoved(document, layout, {signal});
    } finally {
      localController.abort(Error('Task complete'));
    }
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
      if (styler.enabled) {
        fixSelection();
      }
    }
  });

  observeWorkspace();
  observeJobSearch();
})();
