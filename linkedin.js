// ==UserScript==
// @name         LinkedIn search (Android/mobile)
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Filtering script for LinkedIn job search results
// @author       Myles Williams
// @match        https://www.linkedin.com/jobs/search/?*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/rxjs/7.8.1/rxjs.umd.js
// ==/UserScript==

'use strict';

const companyBlacklist = [
    /infote/i,
    /^intelli/i,
    /^tek/i,
    /tek\b/i,
    /resourc/i,
    /solutions/i
];

const selectors = {
    searchResultContainer: '.jobs-search-results-list > ul.scaffold-layout__list-container',
    searchResultItem: 'li.jobs-search-results__list-item',
    jobTitle: '.job-card-list__title',
    jobCompany: '.job-card-container__company-name, .job-card-container__primary-description',
    jobMetadataItem: 'li.job-card-container__metadata-item'
}

const $ = window.jQuery;
const rx = this.rxjs;

const filterTitle = title => {
    title = title.toLowerCase();
    if ((/manager|lead|test/).test(title)) return false;

    const keywords = new URLSearchParams(window.location.search).get('keywords');
    if ((/\bandroid\b/i).test(keywords)) {
        if (!(/\b(android|mobile)\b/i).test(title)) return false;
        if ((/automotive/i).test(title)) return false;
    }

    return true;
};

const isUnwantedResult = element => {
    const $element = $(element);

    const title = $element.find(selectors.jobTitle).text().trim();
    if (title && !filterTitle(title)) {
        return true;
    }

    const searchLocation = new URLSearchParams(window.location.search).get('location');
    const jobLocation = $element.find(selectors.jobMetadataItem).eq(0).text().trim();
    if (jobLocation) {
        const searchLocation = new URLSearchParams(window.location.search).get('location');
        if (jobLocation.toLowerCase() === 'united states' && searchLocation.toLowerCase() !== 'united states') {
            return true;
        }
    }

    const companyName = $element.find(selectors.jobCompany).text().trim();
    if (companyName && companyBlacklist.some(re => { re.lastIndex = 0; return re.test(companyName); })) {
        return true;
    }

    return false;
}

const isResultItem = node =>
    $(node).is(selectors.searchResultItem);

const hideItem = element => {
    $(element).css('visibility', 'hidden');
};

const itemObservations = [];
const changedItems = new rx.Subject();

const observeItem = element => {
    if (isUnwantedResult(element)) {
        hideItem(element);
        return;
    }
    if (itemObservations.some(observation => observation.node === element)) return;
    // Emit this element to the changedItems subject when it changes.
    const observable = new rx.Observable(subscription => {
        const observer = new MutationObserver((mutationList, observer) => {
            mutationList.forEach(mutation => subscription.next(mutation));
        });
        observer.observe(element, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true
        });
        subscription.add(() => observer.disconnect());
    });
    const subscription = observable.subscribe(mutation => changedItems.next(element));
    itemObservations.push({ node: element, subscription });
};

const unobserveItem = node => {
    const index = itemObservations.findIndex(it => it.node === node);
    if (index === -1) return;
    itemObservations[index].subscription.unsubscribe();
    itemObservations.splice(index, 1);
};

const observeList = element => {
    // Track added and removed items.
    const observable = new rx.Observable(subscriber => {
        const observer = new MutationObserver((mutationList, observer) => {
            mutationList.forEach(mutation => subscriber.next(mutation));
        });
        observer.observe(element, { childList: true });
        subscriber.add(() => observer.disconnect());
    });
    const childObservable = observable.pipe(
        rx.filter(mutation => mutation.type === 'childList'),
        rx.share()
    );
    childObservable
        .pipe(
            rx.concatMap(mutation => rx.from(Array.from(mutation.addedNodes))),
            rx.filter(isResultItem)
        )
        .subscribe(observeItem);
    childObservable
        .pipe(rx.concatMap(mutation => rx.from(mutation.removedNodes)))
        .subscribe(unobserveItem);
};

const $list = $(selectors.searchResultContainer)
if ($list.length) {
    observeList($list[0]);
} else {
    // Observe the result list as soon as it appears.
    const observable = new rx.Observable(subscriber => {
        const observer = new MutationObserver((mutationList, observer) => {
            mutationList.forEach(mutation => subscriber.next(mutation));
        });
        observer.observe(document.body, {
            subtree: true,
            childList: true
        });
        subscriber.add(() => observer.disconnect());
    });
    observable
        .pipe(
            rx.filter(mutation => mutation.type === 'childList'),
            rx.concatMap(mutation => rx.from(mutation.addedNodes)),
            rx.filter(node => node.nodeType == Node.ELEMENT_NODE && $(node).is(selectors.searchResultContainer)),
            rx.first()
        )
        .subscribe(observeList);
}

changedItems.subscribe(element => {
    if (isUnwantedResult(element)) {
        hideItem(element);
        unobserveItem(element);
    }
});
