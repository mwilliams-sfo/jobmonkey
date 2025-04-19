
const selectors = {
  feed: 'div[data-finite-scroll-hotkey-context=FEED]',
  feedItemHeaderText: '.update-components-header .update-components-header__text-view',

  jobDetails: '.jobs-search__job-details',
  jobDetailsModule: '.job-details-module',
};

const isSuggestedPost = feedItem =>
  feedItem.querySelector(selectors.feedItemHeaderText)?.textContent?.trim() === 'Suggested';

const hideSuggestedPosts = feed => {
  for (const child of feed.childNodes) {
    if (child.nodeType != Node.ELEMENT_NODE) continue;
    if (child.tagName == 'DIV' && isSuggestedPost(child)) {
      child.classList.toggle('jm-gone', true);
    }
  }
};

let feedObserver = null;

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
});
bodyObserver.observe(document.body, {
  childList: true,
  attributes: true,
  subtree: true,
});
