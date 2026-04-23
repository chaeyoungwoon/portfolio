import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

// --- STEP 2: Render Latest 3 Projects ---
const projects = await fetchJSON('./lib/projects.json');
const latestProjects = projects.slice(0, 3);
const projectsContainer = document.querySelector('.projects');

if (projectsContainer) {
    renderProjects(latestProjects, projectsContainer, 'h2');
}

// --- STEPS 3, 4 & 5: Fetch and Render GitHub Stats ---
// Uses GitHub username to fetch public data
const githubData = await fetchGitHubData('chaeyoungwoon');
const profileStats = document.querySelector('#profile-stats');

// Step 5: Updating the HTML 
if (profileStats) {
    profileStats.innerHTML = `
        <dl class="github-stats">
            <dt>Public Repos</dt><dd>${githubData.public_repos}</dd>
            <dt>Public Gists</dt><dd>${githubData.public_gists}</dd>
            <dt>Followers</dt><dd>${githubData.followers}</dd>
            <dt>Following</dt><dd>${githubData.following}</dd>
        </dl>
    `;
}