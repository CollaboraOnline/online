const fs = require('fs');
const fetch = require('node-fetch');

const REPO = 'CollaboraOnline/online';
const PER_PAGE = 100; // Maximum allowed per page
const API_URL = `https://api.github.com/repos/${REPO}/contributors`;

let page = 1;

// Fixed text to be added at the start of the markdown file
const fixedText = `
+++
authors = [
    "Collabora",
]
title = "Contributors"
date = "2023-07-04"
home_pos = "11"
description = "COOL Contributors"
tags = [
    "build",
    "make",
]
images = [
    "debug-code.jpg",
]
type = "sidebar"
layout = "sidebar"
showimage = false
+++

# Contributors
A huge shoutout to our incredible contributors! Your dedication and hard work are the backbone of the COOL project.

<!--more-->
This page is dedicated to showcasing your invaluable contributions.

Welcome to the **COOL project** Contributors page! We’re grateful for our amazing team’s dedication. Each contributor’s name, role, and Gravatar mugshot are featured below.

Thank you all for making COOL a success!

## Meet Our Contributors:

`;

async function fetchContributors(page) {
    try {
        const response = await fetch(`${API_URL}?per_page=${PER_PAGE}&page=${page}`, {
            headers: {
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching page ${page}:`, error.message);
        return [];
    }
}

async function getAllContributors() {
    let contributors = [];
    let morePages = true;

    while (morePages) {
        console.log(`Fetching page ${page}...`);
        const data = await fetchContributors(page);

        if (data.length === 0) {
            morePages = false;
        } else {
            contributors = contributors.concat(data);
            page++;
        }
    }

    // Sort contributors by the number of contributions
    contributors.sort((a, b) => b.contributions - a.contributions);

    // Generate HTML content
    let htmlContent = `
<div class="contributors-list" style="display: flex; flex-wrap: wrap; gap: 50px; justify-content: center; padding: 20px 0px;">
`;

    contributors.forEach(contributor => {
        htmlContent += `
<div class="contributor" style="width: 140px; text-align: center; font-family: Arial, sans-serif;">
    <img src="${contributor.avatar_url}" alt="${contributor.login}" style="border-radius: 50%; width: 100px; height: 100px; box-shadow: 0 3px 6px rgba(0, 0, 0, 0.1);">
    <h3 style="font-size: 1rem; margin: 10px 0 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${contributor.login}</h3>
    <p style="font-size: 0.9rem; margin: 0;">Contributions: ${contributor.contributions}</p>
</div>
`;
    });

    htmlContent += `</div>`;

    // Combine fixed text with the generated HTML content
    const finalContent = fixedText + '\n\n' + htmlContent;

    // Write the final content to a Markdown file
    fs.writeFileSync('contributors.md', finalContent, 'utf8');
    console.log('Contributors section generated in contributors.md');
}

// Run the function to fetch and generate the contributors section
getAllContributors();
