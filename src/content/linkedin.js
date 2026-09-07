
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

  jobSearchLayout: 'header:has([componentkey="searchResultsHeaderComponent"]) + div',
  jobList: '[componentkey=SearchResultsMainContent]',
  jobCard: 'div:has([componentkey^="job-card-component-ref-"])',
  jobAttributes: 'figure + div > div > div > div',
  jobDetails: 'div:has(> div > [componentkey=SearchResultsMainContent]) + div *[data-component-type=LazyColumn]',
  jobMatch: '[data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.jobMatch"]',
  aboutJob: '[componentkey^="JobDetails_AboutTheJob_"]',
  peopleWhoCanHelp: '[componentkey^="JobDetailsPeopleWhoCanHelpSlot_"]',
  applicantInsights: '[componentkey^="JobDetails_PremiumApplicantInsights_"]',
  companyInsights: '[componentkey^="JobDetails_PremiumCompanyInsights_"]',
  aboutCompany: '[componentkey^="JobDetails_AboutTheCompany_"]',
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

const isInterestingJob = job => {
  const attributes = job.querySelector(selectors.jobAttributes);

  const title =
    attributes.childNodes[0]?.querySelector('p > span')?.textContent?.trim();
  if (title && !isInterestingTitle(title)) return false;

  const company =
    attributes.childNodes[1]?.querySelector('p')?.textContent?.trim();
  if (company && isExcludedCompany(company)) return false;

  const location = attributes.childNodes[2]?.textContent?.trim();
  if (location === 'United States (Remote)') return false;

  return true;
};

const scrubJobList = list => {
  const jobs =
    Array.from(list.childNodes).filter(
      it => it.nodeType == Node.ELEMENT_NODE && it.matches(selectors.jobCard));
  for (const job of jobs) {
    setHidden(job, !isInterestingJob(job));
  }
};

const scrubJobDetails = details => {
  const aboutJob = details.querySelector(selectors.aboutJob);

  const peopleWhoCanHelp = details.querySelector(selectors.peopleWhoCanHelp);
  if (peopleWhoCanHelp) {
    setGone(peopleWhoCanHelp, true);
  }

  const jobMatch = details.querySelector(selectors.jobMatch);
  if (aboutJob && jobMatch) {
    for (var elt = jobMatch; elt; elt = elt.parentNode) {
      if (elt.parentNode == aboutJob.parentNode) {
        setGone(elt, true);
        break;
      }
    }
  }

  const applicantInsights = details.querySelector(selectors.applicantInsights);
  if (applicantInsights) {
    setGone(applicantInsights, true);
  }

  const companyInsights = details.querySelector(selectors.companyInsights);
  if (companyInsights) {
    setGone(companyInsights, true);
  }

  const aboutCompany = details.querySelector(selectors.aboutCompany);
  if (aboutCompany) {
    setGone(aboutCompany, true);
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

window.addEventListener('load', function loadListener(evt) {
  evt.target.defaultView.removeEventListener('load', loadListener);
  const styleSheet = addStyleSheet(document);
  observeWorkspace();
  observeJobSearch();
});
