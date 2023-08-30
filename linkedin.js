// ==UserScript==
// @name         LinkedIn search (Android/mobile)
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Filtering script for LinkedIn job search results
// @author       Myles Williams
// @match        https://www.linkedin.com/jobs/search/?*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// @require      http://code.jquery.com/jquery-latest.js
// ==/UserScript==

(function() {
    'use strict';

    const $ = window.$;
    const itemObservations = [];

    // Company names matching these patterns will be hidden.
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

    const observeItem = element => {
        if (isUnwantedResult(element)) {
            hideItem(element);
            return;
        }
        if (itemObservations.some(observation => observation.node === element)) return;
        const observer = new MutationObserver((mutationList, observer) => {
            if (isUnwantedResult(element)) {
                hideItem(element);
                unobserveItem(element);
            }
        });
        observer.observe(element, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true
        });
        itemObservations.push({
            node: element,
            observer
        });
    };

    const unobserveItem = node => {
        const index = itemObservations.findIndex(it => it.node === node);
        if (index === -1) return;
        itemObservations[index].observer.disconnect();
        itemObservations.splice(index, 1);
    };

    const observeList = element => {
        const listObserver = new MutationObserver((mutationList, observer) => {
            mutationList.forEach(mutation => {
                if (mutation.type !== 'childList') return;
                Array.from(mutation.removedNodes).forEach(unobserveItem);
                Array.from(mutation.addedNodes).forEach(node => {
                    if (isResultItem(node)) {
                        observeItem(node);
                    }
                });
            });
        });
        listObserver.observe(element, { childList: true });
        $(element).find(selectors.searchResultItem)
            .each((index, element) => observeItem(element));
    };

    const $list = $(selectors.searchResultContainer)
    if ($list.length) {
        observeList($list[0]);
    } else {
        const bodyObserver = new MutationObserver((mutationList, observer) => {
            mutationList.forEach(mutation => {
                if (mutation.type !== 'childList') return;
                Array.from(mutation.addedNodes).forEach(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    if ($(node).is(selectors.searchResultContainer)) {
                        observeList(node);
                    }
                });
            });
        });
        bodyObserver.observe(document.body, {
            subtree: true,
            childList: true
        });
    }
})();
