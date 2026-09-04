
import {isExcludedCompany, isExcludedTitle} from '../filter';
import AbortablePromise from '../util/abortable-promise';
import {elementAdded, elementRemoved, observeElement} from '../util/observe';
import {splitTerms} from '../util/split';

const selectors = {
  workspace: '#workspace',

  feed: 'div[data-testid=mainFeed]',
  feedItem: 'div > div > div > div > div[role=listitem]',
  feedItemHeaderText:
    'div > div > div:has(+ button[aria-label^="Open control menu for post by "]) > div > p',

  moduleHeadline: 'div > div > p',

  jobSearch: '.jobs-search-two-pane__layout',
  jobList: '.scaffold-layout__list ul:has(> li.scaffold-layout__list-item)',
  activeJob: '.jobs-search-results-list__list-item--active',
  jobClickable: '.job-card-container--clickable',
  jobTitle: '.job-card-list__title--link strong',
  jobCompany: '.artdeco-entity-lockup__subtitle',
  jobLocation: '.artdeco-entity-lockup__caption',

  jobDetails: '.jobs-search__job-details',
  jobDetailsModule: '.job-details-module',
  jobDetailsDescription: '.jobs-description',
  jobDetailsCompany: '*[data-view-name=job-details-about-company-module]',
  fitLevelCard: '.job-details-fit-level-card',
  upsellPremiumContainer: '.upsell-premium-custom-section-card__container',
};

const setGone = (elt, gone) => { elt.classList.toggle('jm-gone', gone); };

const setHidden = (elt, hidden) => {
  elt.classList.toggle('jm-hidden', hidden);
};

const isHidden = elt => elt.classList.contains('jm-hidden');

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
    setGone(module, true);
  }
};

const scrubFeed = feed => {
  const items =
    Array.from(feed.querySelectorAll(selectors.feedItem))
      .filter(it =>
        it.parentNode?.parentNode?.parentNode?.parentNode?.parentNode === feed);
  for (const item of items) {
    setGone(item, isSuggestedPost(item));
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

const isUnitedStatesSearch = () =>
  new URL(document.URL).searchParams.get('geoid') === '103644278';

const isInterestingJob = job => {
  const title = job.querySelector(selectors.jobTitle)?.textContent?.trim();
  if (title && !isInterestingTitle(title)) return false;

  const company =
    job.querySelector(selectors.jobCompany)?.textContent?.trim();
  if (company && isExcludedCompany(company)) return false;

  const location =
    job.querySelector(selectors.jobLocation)?.textContent?.trim();
  if (location === 'United States (Remote)' && !isUnitedStatesSearch()) {
    return false
  }

  return true;
};

const fixSelection = list => {
  const jobs =
    Array.from(list.childNodes)
      .filter(it => it.nodeType == Node.ELEMENT_NODE && it.tagName == 'LI');
  const activeJob = jobs.find(it => it.querySelector(selectors.activeJob));
  if (!activeJob || !isHidden(activeJob)) return;

  // Search forward for another job to select, with wrap-around.
  for (
    let otherJob = activeJob.nextSibling ?? list.firstChild;
    otherJob && otherJob !== activeJob;
    otherJob = otherJob.nextSibling ?? list.firstChild
  ) {
    if (
      otherJob.nodeType == Node.ELEMENT_NODE && otherJob.tagName == 'LI' &&
      !isHidden(otherJob)
    ) {
      otherJob.querySelector(selectors.jobClickable)?.click();
      break;
    }
  }
};

const scrubJobList = list => {
  for (const child of list.childNodes) {
    if (child.nodeType == Node.ELEMENT_NODE && child.tagName == 'LI') {
      setHidden(child, !isInterestingJob(child));
    }
  }
  fixSelection(list);
};

const scrubJobDetails = details => {
  for (const module of details.querySelectorAll(selectors.jobDetailsModule)) {
    if (
      module.id !== 'SALARY' &&
      !module.matches(selectors.jobDetailsDescription) &&
      !module.querySelector(selectors.jobDetailsCompany)
    ) {
      setGone(module, true);
    }
  }
  const upsell = details.querySelector(selectors.upsellPremiumContainer)
  if (upsell) {
    setGone(upsell, true);
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
  }
  return style.sheet;
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
    const element = await elementAdded(layout, selectors.jobList, {signal});
    await observeElement(layout, element, scrubJobList, {signal});
  }
};

const observeJobDetails = async (layout, options) => {
  const signal = options?.signal;
  while (true) {
    const element =
      await elementAdded(layout, selectors.jobDetails, {signal});
    await observeElement(layout, element, scrubJobDetails, {signal});
  }
};

const observeJobSearch = async (options) => {
  const signal = options?.signal;
  while (true) {
    const layout = await elementAdded(document, selectors.jobSearch, {signal});
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

const styleSheet = addStyleSheet(document);

observeWorkspace();
observeJobSearch();
