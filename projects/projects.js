import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm'; [cite: 663]

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const searchInput = document.querySelector('.searchBar');

let query = ''; [cite: 1060]
let selectedIndex = -1; [cite: 1297]
let colors = d3.scaleOrdinal(d3.schemeTableau10); [cite: 824]

function filterAndRender() {
    let filtered = projects.filter((project) => {
        let values = Object.values(project).join('\n').toLowerCase(); [cite: 1128]
        return values.includes(query.toLowerCase()); [cite: 1129]
    });

    renderPieChart(filtered); [cite: 1164]

    if (selectedIndex !== -1) { [cite: 1367]
        let rolledData = d3.rollups(filtered, v => v.length, d => d.year);
        if (rolledData[selectedIndex]) {
            let selectedYear = rolledData[selectedIndex][0];
            filtered = filtered.filter(project => project.year === selectedYear);
        } else {
            selectedIndex = -1;
        }
    }

    renderProjects(filtered, projectsContainer, 'h2'); [cite: 1191]
    
    const titleElement = document.querySelector('.projects-title');
    if (titleElement) {
        titleElement.textContent = `${filtered.length} Projects`;
    }
}

function renderPieChart(projectsGiven) {
    let newSVG = d3.select('svg'); [cite: 1195]
    newSVG.selectAll('path').remove(); [cite: 1196]
    
    let legend = d3.select('.legend'); [cite: 891]
    legend.selectAll('li').remove(); 

    let newRolledData = d3.rollups( [cite: 1166]
        projectsGiven,
        (v) => v.length,
        (d) => d.year
    );

    let newData = newRolledData.map(([year, count]) => { [cite: 1173]
        return { value: count, label: year };
    });

    let newSliceGenerator = d3.pie().value((d) => d.value); [cite: 866]
    let newArcData = newSliceGenerator(newData);
    let arcGenerator = d3.arc().innerRadius(0).outerRadius(50); [cite: 668]
    let newArcs = newArcData.map((d) => arcGenerator(d)); [cite: 709]

    newArcs.forEach((arc, i) => { [cite: 1303]
        newSVG
            .append('path')
            .attr('d', arc)
            .attr('fill', colors(i))
            .attr('class', i === selectedIndex ? 'selected' : '') [cite: 1340]
            .on('click', () => { [cite: 1310]
                selectedIndex = selectedIndex === i ? -1 : i; [cite: 1337]
                
                newSVG.selectAll('path')
                    .attr('class', (_, idx) => (idx === selectedIndex ? 'selected' : '')); [cite: 1339]
                legend.selectAll('li')
                    .attr('class', (_, idx) => (idx === selectedIndex ? 'selected' : '')); [cite: 1347]
                
                filterAndRender(); 
            });
    });

    newData.forEach((d, i) => { [cite: 890]
        legend.append('li')
            .attr('style', `--color:${colors(i)}`) [cite: 894]
            .attr('class', i === selectedIndex ? 'selected' : '') [cite: 1349]
            .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`) [cite: 895]
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

searchInput.addEventListener('input', (event) => { [cite: 1133]
    query = event.target.value; [cite: 1135]
    selectedIndex = -1; 
    filterAndRender();
});

if (projectsContainer) {
    filterAndRender(); [cite: 1183]
}