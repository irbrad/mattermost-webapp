// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. 1. Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Markdown', () => {
    before(() => {
        cy.apiLogin('user-1');
        cy.visit('/');
    });

    const baseUrl = Cypress.config('baseUrl');

    const inlineImage1 = `<h3 class="markdown__heading">In-line Images</h3><p>Mattermost/platform build status:  <a class="theme markdown__link" href="https://travis-ci.org/mattermost/platform" rel="noreferrer" target="_blank"><button class="style--none" alt="Build Status" aria-label="file thumbnail"><img class="markdown-inline-img" alt="image placeholder" src="${baseUrl}/api/v4/image?url=https%3A%2F%2Ftravis-ci.org%2Fmattermost%2Fplatform.svg%3Fbranch%3Dmaster"></button></a></p>`;
    const inlineImage2 = `<h3 class="markdown__heading">In-line Images</h3><p>GitHub favicon:  <button class="style--none" alt="Github" aria-label="file thumbnail"><img class="markdown-inline-img" alt="image placeholder" src="${baseUrl}/api/v4/image?url=https%3A%2F%2Fgithub.githubassets.com%2Ffavicon.ico"></button></p>`;

    const tests = [
        {name: 'with in-line images 1', fileKey: 'markdown_inline_images_1', expected: inlineImage1},
        {name: 'with in-line images 2', fileKey: 'markdown_inline_images_2', expected: inlineImage2},
    ];

    tests.forEach((test) => {
        it(test.name, () => {
            // #  Post markdown message
            cy.postMessageFromFile(`markdown/${test.fileKey}.md`);

            // * Verify that HTML Content is correct.
            // Note we use the Gigantic timeout to ensure that the large images will load
            cy.getLastPostId().then((postId) => {
                cy.get(`#postMessageText_${postId}`, {timeout: TIMEOUTS.GIGANTIC}).should('have.html', test.expected);
            });
        });
    });
});
