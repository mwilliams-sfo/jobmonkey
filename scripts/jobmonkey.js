
const selectors = {
  feed: 'div[data-finite-scroll-hotkey-context=FEED]',
  feedItemHeaderText: '.update-components-header .update-components-header__text-view',

  jobDetails: '.jobs-search__job-details',
  jobDetailsModule: '.job-details-module',
  fitLevelCard: '.job-details-fit-level-card',

  upsellPremiumContainer: '.upsell-premium-custom-section-card__container',
};

const setGone = elt => { elt.classList.toggle('jm-gone', true); }

const isSuggestedPost = feedItem =>
  feedItem.querySelector(selectors.feedItemHeaderText)
    ?.textContent?.trim() === 'Suggested';

const hideSuggestedPosts = feed => {
  for (const child of feed.childNodes) {
    if (child.nodeType != Node.ELEMENT_NODE) continue;
    if (child.tagName == 'DIV' && isSuggestedPost(child)) {
      setGone(child);
    }
  }
};

const scrubJobDetails = details => {
  for (const module of details.querySelectorAll(selectors.jobDetailsModule)) {
    if (module.querySelector(selectors.fitLevelCard)) {
      setGone(module);
    }
  }
  const upsell = details.querySelector(selectors.upsellPremiumContainer)
  if (upsell) {
    setGone(upsell);
  }
};

let feedObserver = null, jobDetailsObserver = null;

const bodyObserver = new MutationObserver((mutationList, observer) => {
  const feed = document.querySelector(selectors.feed);
  if (feed && !feedObserver) {
    feedObserver = new MutationObserver((mutationList, observer) => {
      hideSuggestedPosts(feed);
    });
    feedObserver.observe(feed, {
      childList: true,
      attributes: true,
      subtree: true,
    });
  } else if (!feed && feedObserver) {
    feedObserver.disconnect();
    feedObserver = null;
  }

  const details = document.querySelector(selectors.jobDetails);
  if (details && !jobDetailsObserver) {
    jobDetailsObserver = new MutationObserver((mutationList, observer) => {
      scrubJobDetails(details);
    });
    jobDetailsObserver.observe(details, {
      childList: true,
      attributes: true,
      subtree: true,
    });
  } else if (!details && jobDetailsObserver) {
    jobDetailsObserver.disconnect();
    jobDetailsObserver = null;
  }
});
bodyObserver.observe(document.body, {
  childList: true,
  attributes: true,
  subtree: true,
});
