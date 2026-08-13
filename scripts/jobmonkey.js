
const selectors = {
  workspace: '#workspace',

  feed: 'div[data-testid=mainFeed]',
  feedItem: 'div > div > div > div > div[role=listitem]',
  feedItemHeaderText:
    'div > div > div:has(+ button[aria-label^="Open control menu for post by "]) > div > p',

  moduleHeadline: 'div > div > p',

  jobList: '*[componentkey=SearchResultsMainContent]',
  jobCard: '*[componentkey^="job-card-component-ref-"][role=button]',
  jobInfo: 'figure + div > div > div > div',
  jobTitle: '*:nth-child(1) > p > span[aria-hidden=true]',
  jobCompany: '*:nth-child(2) > p',
  jobLocation: '*:nth-child(3) > p',
  jobDetails: '*[data-sdui-screen="com.linkedin.sdui.flagshipnav.jobs.SemanticJobDetails"]',
  jobDetailModules: 'div:has(> div[componentkey^="JobDetails_AboutTheJob_"])',
  components: '*[componentkey]',
};

// No offense.
const companyExclusions = [
  /Braintrust/,
  /Capgemini/,
  /Cognizant/,
  /Compunnel/,
  /GlobalLogic/,
  /HCLTech/,
  /Infojini/,
  /Infosys/,
  /Jobs via Dice/,
  /Motion Recruitment/,
  /Net2Source/,
  /NTT DATA/,
  /Robert Half/,
  /The Mom Project/,
  /Verticalmove/,
  /Wipro/,

  /Amazon/,
  /Anthropic/,
  /Apple/,
  /Applied Intuition/,
  /^Block$/,
  /ByteDance/,
  /Canonical/,
  /Cash App/,
  /Grindr/,
  /Kohler Ventures/,
  /LinkedIn/,
  /Lucid Motors/,
  /Meta/,
  /Microsoft/,
  /Monogram/,
  /Neuralink/,
  /Nextdoor/,
  /OKX/,
  // /OSI Engineering/,
  /Perplexity/,
  /Rivian/,
  /Roblox/,
  /SiriusXM/,
  /SpaceX/,
  /Tesla/,
  /TikTok/,
  /^World$/,

  /\w+AI\b/,
  /\bai\b/i,
  /^coin/i,
  /consult/i,
  // /\bgroup\b/i,
  /infote/i,
  /^intelli/i,
  // / llc$/i,
  // /resourc/i,
  // /solutions/i,
  // /staffing/i,
  /^tek/i,
  /tek\b/i,
];

class AbortablePromise extends Promise {
  constructor(executor, signal) {
    if (!signal) {
      super(executor);
      return;
    }
    if (typeof executor != 'function') {
      throw TypeError('executor is not callable');
    }
    if (!(signal instanceof AbortSignal)) {
      throw TypeError('signal is not an AbortSignal');
    }
    super((resolve, reject) => {
      signal?.throwIfAborted(Error('Aborted'));
      const listener = evt => reject(Error('Aborted'));
      signal?.addEventListener('abort', listener);
      try {
        executor(
          value => {
            signal?.removeEventListener('abort', listener);
            resolve(value);
          },
          reason => {
            signal?.removeEventListener('abort', listener);
            reject(reason);
          });
      } catch (e) {
        signal?.removeEventListener('abort', listener);
        throw e;
      }
    });
  }

  static withResolvers(signal) {
    let resolve, reject
    const promise = new AbortablePromise(
      (res, rej) => {
        resolve = res;
        reject = rej;
      },
      signal);
    return {promise, resolve, reject};
  }
}

const setGone = (elt, gone) => {
  elt.classList.toggle('jm-gone', gone);
};

const setHidden = (elt, hidden) => {
  elt.classList.toggle('jm-hidden', hidden);
};

const isHidden = elt => elt.classList.contains('jm-hidden');

const splitTerms = str => {
  const terms = [];
  while (str = str.trimStart()) {
    const re =
      str.startsWith('\'') ? /^'([^']*)'?/ :
      str.startsWith('"') ? /^"([^"]*)"?/ :
      /^(\S*)/;
    const match = re.exec(str);
    terms.push(match[1]);
    str = str.substr(match[0].length);
  }
  return terms;
};


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
  if (title.match(/\b(?:manager|principal|lead|leader|test|tester|ai|qa|security|analyst|researcher)\b/i)) {
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

const isInterestingCompany = company =>
  !companyExclusions.some(it => company.match(it));

const isUnitedStatesSearch = () =>
  new URL(document.URL).searchParams.get('geoid') === '103644278';

const isInterestingJob = job => {
  const jobInfo = job.querySelector(selectors.jobInfo);

  const title =
    jobInfo?.querySelector(selectors.jobTitle)?.textContent?.trim();
  if (title && !isInterestingTitle(title)) return false;

  const company =
    jobInfo?.querySelector(selectors.jobCompany)?.textContent?.trim();
  if (company && !isInterestingCompany(company)) return false;

  const location =
    jobInfo?.querySelector(selectors.jobLocation)?.textContent?.trim();
  if (location === 'United States (Remote)' && !isUnitedStatesSearch()) {
    return false
  }

  return true;
};

const getBorderedParent = elt => {
  while (elt) {
    const window = elt?.ownerDocument?.defaultView;
    if (!window) return;
    const styles = window.getComputedStyle(elt);
    if (styles.borderWidth && styles.borderWidth != '0px') {
      return elt;
    }
    elt = elt.parentNode;
  }
};

const scrubJobList = list => {
  const jobs = Array.from(list.querySelectorAll(selectors.jobCard));
  for (const job of jobs) {
    setHidden(job, !isInterestingJob(job));
  }
};

const scrubJobDetails = details => {
  const jobMatch = details.querySelector('*[componentkey^="JobMatchRef_"]');
  if (jobMatch) {
    setGone(getBorderedParent(jobMatch) || jobMatch, true);
  }

  const tips =
    Array.from(details.querySelectorAll('p'))
      .filter(it =>
        it.textContent.trim() ==
          'Get personalized tips to stand out to hirers');
  if (tips[0]) {
    setGone(getBorderedParent(tips[0]) || tips[0], true);
  }

  const moduleContainer = details.querySelector(selectors.jobDetailModules);
  const modules =
    (moduleContainer ? Array.from(moduleContainer.childNodes) : [])
      .filter(it => it.nodeType == Node.ELEMENT_NODE)
  for (const module of modules) {
    const componentKey = module.getAttribute('componentkey');
    setGone(
        module,
        !!(componentKey?.startsWith('JobDetailsPeopleWhoCanHelpSlot_') ||
          componentKey?.startsWith('JobDetails_PremiumApplicantInsights_') ||
          componentKey?.startsWith('JobDetails_PremiumCompanyInsights_')));
  }

  const employeeContent =
    Array.from(details.querySelectorAll('p'))
      .filter(it => it.textContent.trim() == 'Trending employee content');
  if (employeeContent[0]) {
    setGone(employeeContent[0].parentNode, true);
  }
};

const elementAdded = async (parent, selector, options) => {
  const signal = options?.signal;
  signal?.throwIfAborted();

  const element = parent.querySelector(selector);
  if (element) return element;

  const {promise, resolve, reject} = AbortablePromise.withResolvers(signal);
  const observer = new MutationObserver(mutationList => {
    const element = parent.querySelector(selector);
    if (element) resolve(element);
  });
  try {
    observer.observe(
      parent, {attributes: true, childList: true, subtree: true});
    return await promise;
  } finally {
    observer.disconnect();
  }
};

const elementRemoved = async (parent, element, options) => {
  const signal = options?.signal;
  signal?.throwIfAborted();

  if (!document.contains(parent) || !parent.contains(element)) return;

  const {promise, resolve, reject} = AbortablePromise.withResolvers(signal);
  const observer = new MutationObserver(mutationList => {
    if (!document.contains(parent) || !parent.contains(element)) resolve();
  });
  try {
    observer.observe(document, {childList: true, subtree: true});
    return await promise;
  } finally {
    observer?.disconnect();
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

const observeElement = async (parent, element, callback, options) => {
  const signal = options?.signal;
  signal?.throwIfAborted();

  if (!document.contains(parent) || !parent.contains(element)) return;

  callback(element);
  const observer = new MutationObserver(mutationList => {
    if (document.contains(parent) && parent.contains(element)) {
      callback(element);
    }
  });
  try {
    observer.observe(
      element, {attributes: true, childList: true, subtree: true});
    await elementRemoved(parent, element, {signal});
  } finally {
    observer.disconnect();
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
    const jobList = await elementAdded(document, selectors.jobList, {signal});
    const layout = jobList.parentNode.parentNode.parentNode;

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
