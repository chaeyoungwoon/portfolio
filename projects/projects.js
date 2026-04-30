import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const searchInput = document.querySelector('.searchBar');

let query = '';
let selectedIndex = -1;
let colors = d3.scaleOrdinal(d3.schemeTableau10);

function filterAndRender() {
    let filtered = projects.filter((project) => {
        let values = Object.values(project).join('\n').toLowerCase();
        return values.includes(query.toLowerCase());
    });

    renderPieChart(filtered);

    if (selectedIndex !== -1) {
        let rolledData = d3.rollups(filtered, v => v.length, d => d.year);
        if (rolledData[selectedIndex]) {
            let selectedYear = rolledData[selectedIndex][0];
            filtered = filtered.filter(project => project.year === selectedYear);
        } else {
            selectedIndex = -1;
        }
    }

    renderProjects(filtered, projectsContainer, 'h2');
    
    const titleElement = document.querySelector('.projects-title');
    if (titleElement) {
        titleElement.textContent = `${filtered.length} Projects`;
    }
}

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
        newSVG
            .append('path')
            .attr('d', arc)
            .attr('fill', colors(i))
            .attr('class', i === selectedIndex ? 'selected' : '')
            .on('click', () => {
                selectedIndex = selectedIndex === i ? -1 : i;
                
                newSVG.selectAll('path')
                    .attr('class', (_, idx) => (idx === selectedIndex ? 'selected' : ''));
                legend.selectAll('li')
                    .attr('class', (_, idx) => (idx === selectedIndex ? 'selected' : ''));
                
                filterAndRender(); 
            });
    });

    newData.forEach((d, i) => {
        legend.append('li')
            .attr('style', `--color:${colors(i)}`)
            .attr('class', i === selectedIndex ? 'selected' : '')
            .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
            .on('click', () => {
                selectedIndex = selectedIndex === i ? -1 : i;
                newSVG.selectAll('path')
                    .attr('class', (_, idx) => (idx === selectedIndex ? 'selected' : ''));
                legend.selectAll('li')
                    .attr('class', (_, idx) => (idx === selectedIndex ? 'selected' : ''));
                filterAndRender();
            });
    });
}

searchInput.addEventListener('input', (event) => {
    query = event.target.value;
    selectedIndex = -1; 
    filterAndRender();
});

if (projectsContainer) {
    filterAndRender();
}