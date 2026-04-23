console.log("IT'S ALIVE!");

// Helper for selecting elements
export function $$(selector, context = document) {
    return Array.from(context.querySelectorAll(selector));
}

// --- STEP 3: AUTOMATIC NAVIGATION ---
let pages = [
    { url: '', title: 'Home' },
    { url: 'projects/', title: 'Projects' },
    { url: 'contact/', title: 'Contact' },
    { url: 'resume/', title: 'Resume' },
    { url: 'https://github.com/chaeyoungwoon', title: 'GitHub' }
];

let nav = document.createElement('nav');
document.body.prepend(nav);

const BASE_PATH = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? '/' : '/portfolio/';

for (let p of pages) {
    let url = p.url;
    url = !url.startsWith('http') ? BASE_PATH + url : url;

    let a = document.createElement('a');
    a.href = url;
    a.textContent = p.title;

    // Highlight current page and handle external links
    a.classList.toggle('current', a.host === location.host && a.pathname === location.pathname);
    if (a.host !== location.host) a.target = "_blank";

    nav.append(a);
}

// --- STEP 4: DARK MODE SWITCHER ---
document.body.insertAdjacentHTML('afterbegin', `
    <label class="color-scheme">
        Theme:
        <select id="theme-select">
            <option value="light dark">Automatic</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
        </select>
    </label>`);

const select = document.querySelector('#theme-select');

function setColorScheme(color) {
    document.documentElement.style.setProperty('color-scheme', color);
    select.value = color;
    localStorage.colorScheme = color; // Save preference
}

if ("colorScheme" in localStorage) {
    setColorScheme(localStorage.colorScheme);
}

select.addEventListener('input', (e) => setColorScheme(e.target.value));

// --- STEP 5: BETTER CONTACT FORM ---
let form = document.querySelector('form');
form?.addEventListener('submit', (e) => {
    e.preventDefault();
    let data = new FormData(form);
    let url = form.action + "?";
    for (let [name, value] of data) {
        url += `${name}=${encodeURIComponent(value)}&`;
    }
    location.href = url;
});

// --- LAB 4 ADDITIONS ---

export async function fetchJSON(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch projects: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching or parsing JSON data:', error);
    }
}

export function renderProjects(project, containerElement, headingLevel = 'h2') {
    if (!containerElement) return;
    containerElement.innerHTML = ''; // Clear existing content [cite: 236-237]
    
    for (let p of project) {
        const article = document.createElement('article');
        article.innerHTML = `
            <${headingLevel}>${p.title}</${headingLevel}>
            <img src="${p.image}" alt="${p.title}">
            <p>${p.description}</p>
            <p class="project-year" style="font-size: 0.8em; color: gray;">${p.year}</p>
        `;
        containerElement.appendChild(article);
    }
}

export async function fetchGitHubData(username) {
    return fetchJSON(`https://api.github.com/users/${username}`);
}