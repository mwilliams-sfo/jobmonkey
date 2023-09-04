// ==UserScript==
// @name         LinkedIn search (Android/mobile)
// @namespace    https://github.com/mwilliams-sfo/jobmonkey
// @version      0.1
// @description  Filtering script for LinkedIn job search results
// @author       Myles Williams
// @match        https://www.linkedin.com/jobs/*
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

const searchTerms = location => {
    const terms = [];
    const match = (/^\/jobs\/([^/]+)\//).exec(location.pathname);
    pathMatch:
    if (match) {
        const searchString = decodeURIComponent(match[1]);
        if (searchString === 'search') break pathMatch;
        const pathTerms = searchString.split(/-+/);
        for (let term of pathTerms) {
            term = (term || '').trim();
            if (term && !terms.includes(term)) {
                terms.push(term);
            }
        }
    }
    const keywordsParam = new URLSearchParams(location.search).get('keywords')
    if (keywordsParam) {
        const queryTerms = decodeURIComponent(keywordsParam).split(/\s+/);
        for (let term of queryTerms) {
            term = (term || '').trim();
            if (term && !terms.includes(term)) {
                terms.push(term);
            }
        }
    }
    return terms;
};

const filterTitle = title => {
    title = title.toLowerCase();
    if ((/manager|lead|test/).test(title)) return false;

    const terms = searchTerms(window.location).map(s => s.toLowerCase());
    if (terms.includes('android')) {
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

    const jobLocation = $element.find(selectors.jobMetadataItem).eq(0).text().trim();
    if (jobLocation) {
        const searchLocation = (new URLSearchParams(window.location.search).get('location') || '').trim();
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

const hideItem = element => {
    $(element).css('visibility', 'hidden');
};

const itemObservations = [];
const changedItems = new rx.Subject();

const mutationObservable = (target, options) =>
    new rx.Observable(subscriber => {
        const observer = new MutationObserver((mutationList, observer) => {
            subscriber.next(mutationList);
        });
        observer.observe(target, options);
        subscriber.add(() => observer.disconnect());
    });

const observeItem = element => {
    if (itemObservations.some(observation => observation.node === element)) return;
    // Emit this element to the changedItems subject now and each time it changes.
    changedItems.next(element);
    const observable = mutationObservable(element, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true
    });
    const subscription = observable.subscribe(mutations => changedItems.next(element));
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
    const itemObservable = mutationObservable(element, { childList: true })
        .pipe(
            rx.concatAll(),
            rx.filter(mutation => mutation.type === 'childList'),
            rx.share()
        );
    itemObservable
        .pipe(
            rx.concatMap(mutation => rx.from(mutation.addedNodes)),
            rx.filter(node => node.nodeType === Node.ELEMENT_NODE)
        )
        .subscribe(observeItem);
    itemObservable
        .pipe(
            rx.concatMap(mutation => rx.from(mutation.removedNodes)),
            rx.filter(node => node.nodeType === Node.ELEMENT_NODE)
        )
        .subscribe(unobserveItem);
};

// Start observing the result list as soon as it appears.
const $list = $(selectors.searchResultContainer)
const observable = $list.length ? rx.observable.of($list[0]) :
    mutationObservable(document.body, { subtree: true, childList: true }).pipe(
        rx.concatAll(),
        rx.filter(mutation => mutation.type === 'childList'),
        rx.concatMap(mutation => rx.from(mutation.addedNodes)),
        rx.filter(node => node.nodeType == Node.ELEMENT_NODE && $(node).is(selectors.searchResultContainer)),
        rx.first()
    );
observable.subscribe(observeList);

// Subscribe to search result item changes and hide any undesirable item.
changedItems.subscribe(element => {
    if (isUnwantedResult(element)) {
        hideItem(element);
        //unobserveItem(element);
    }
});
