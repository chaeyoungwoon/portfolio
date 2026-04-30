import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const searchInput = document.querySelector('.searchBar');

let query = '';
let selectedIndex = -1;
let colors = d3.scaleOrdinal(d3.schemeTableau10);

// Handles search bar updates: Redraws both pie chart and list
function setQuery(newQuery) {
    query = newQuery;
    selectedIndex = -1; 
    
    let filtered = projects.filter((project) => {
        let values = Object.values(project).join('\n').toLowerCase();
        return values.includes(query.toLowerCase());
    });

    renderPieChart(filtered);
    renderProjects(filtered, projectsContainer, 'h2');
    
    const titleElement = document.querySelector('.projects-title');
    if (titleElement) {
        titleElement.textContent = `${filtered.length} Projects`;
    }
}

// Draws the pie chart and handles click events (Updates CSS and list ONLY)
function renderPieChart(projectsGiven) {
    let newSVG = d3.select('svg');
    newSVG.selectAll('path').remove();
    let legend = d3.select('.legend');
    legend.selectAll('li').remove(); 

    let newRolledData = d3.rollups(
        projectsGiven,
        (v) => v.length,
        (d) => d.year
    );

    let newData = newRolledData.map(([year, count]) => {
        return { value: count, label: year };
    });

    let newSliceGenerator = d3.pie().value((d) => d.value);
    let newArcData = newSliceGenerator(newData);
    let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
    let newArcs = newArcData.map((d) => arcGenerator(d));

    newArcs.forEach((arc, i) => {
        newSVG.append('path')
            .attr('d', arc)
            .attr('fill', colors(i))
            .on('click', () => {
                selectedIndex = selectedIndex === i ? -1 : i;
                
                // ONLY update CSS classes, do NOT redraw the pie chart
                newSVG.selectAll('path').attr('class', (_, idx) => (idx === selectedIndex ? 'selected' : ''));
                legend.selectAll('li').attr('class', (_, idx) => (idx === selectedIndex ? 'selected' : ''));
                
                // Filter the project list
                let filtered = projects.filter((project) => {
                    let values = Object.values(project).join('\n').toLowerCase();
                    return values.includes(query.toLowerCase());
                });
                
                if (selectedIndex !== -1) {
                    let selectedYear = newData[selectedIndex].label;
                    filtered = filtered.filter(p => p.year === selectedYear);
                }

                renderProjects(filtered, projectsContainer, 'h2');
                
                const titleElement = document.querySelector('.projects-title');
                if (titleElement) {
                    titleElement.textContent = `${filtered.length} Projects`;
                }
            });
    });

    newData.forEach((d, i) => {
        legend.append('li')
            .style('--color', colors(i))
            .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
            .on('click', () => {
                selectedIndex = selectedIndex === i ? -1 : i;
                
                newSVG.selectAll('path').attr('class', (_, idx) => (idx === selectedIndex ? 'selected' : ''));
                legend.selectAll('li').attr('class', (_, idx) => (idx === selectedIndex ? 'selected' : ''));
                
                let filtered = projects.filter((project) => {
                    let values = Object.values(project).join('\n').toLowerCase();
                    return values.includes(query.toLowerCase());
                });
                
                if (selectedIndex !== -1) {
                    let selectedYear = newData[selectedIndex].label;
                    filtered = filtered.filter(p => p.year === selectedYear);
                }

                renderProjects(filtered, projectsContainer, 'h2');
                
                const titleElement = document.querySelector('.projects-title');
                if (titleElement) {
                    titleElement.textContent = `${filtered.length} Projects`;
                }
            });
    });
}

searchInput.addEventListener('input', (event) => {
    setQuery(event.target.value);
});

if (projectsContainer) {
    setQuery('');
}