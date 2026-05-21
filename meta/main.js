import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

// ── Load & parse CSV ──────────────────────────────────────────────────────────
async function loadData() {
    const data = await d3.csv('loc.csv', (row) => ({
        ...row,
        line:     Number(row.line),
        depth:    Number(row.depth),
        length:   Number(row.length),
        date:     new Date(row.date + 'T00:00' + row.timezone),
        datetime: new Date(row.datetime),
    }));
    return data;
}

// ── Build per-commit objects ───────────────────────────────────────────────────
function processCommits(data) {
    return d3
        .groups(data, (d) => d.commit)
        .map(([commit, lines]) => {
            let first = lines[0];
            let { author, date, time, timezone, datetime } = first;
            let ret = {
                id:         commit,
                url:        'https://github.com/chaeyoungwoon/portfolio/commit/' + commit,
                author,
                date,
                time,
                timezone,
                datetime,
                hourFrac:   datetime.getHours() + datetime.getMinutes() / 60,
                totalLines: lines.length,
            };
            Object.defineProperty(ret, 'lines', {
                value: lines, enumerable: false, writable: false, configurable: false,
            });
            return ret;
        });
}

// ── Summary stats ─────────────────────────────────────────────────────────────
function renderCommitInfo(data, commits) {
    d3.select('#stats').selectAll('dl').remove();
    const dl = d3.select('#stats').append('dl').attr('class', 'stats');

    function addStat(label, value) {
        const div = dl.append('div');
        div.append('dt').text(label);
        div.append('dd').text(value);
    }

    addStat('Commits', commits.length);
    const numFiles = d3.group(data, (d) => d.file).size;
    addStat('Files', numFiles);
    addStat('Total LOC', data.length);

    const maxDepth = d3.max(data, (d) => d.depth);
    addStat('Max Depth', maxDepth);

    const maxLineLength = d3.max(data, (d) => d.length);
    addStat('Longest Line', maxLineLength);

    const fileLengths = d3.rollups(data, (v) => d3.max(v, (v) => v.line), (d) => d.file);
    const maxFileLength = d3.max(fileLengths, (d) => d[1]);
    addStat('Max Lines', maxFileLength);
}

// ── Scatterplot globals ───────────────────────────────────────────────────────
let xScale, yScale;
let allCommits = [];

// ── Draw initial scatterplot (run once) ───────────────────────────────────────
function renderScatterPlot(data, commits) {
    const width  = 1000;
    const height = 600;
    const margin = { top: 10, right: 10, bottom: 30, left: 50 };

    const usableArea = {
        top:    margin.top,
        right:  width  - margin.right,
        bottom: height - margin.bottom,
        left:   margin.left,
        width:  width  - margin.left - margin.right,
        height: height - margin.top  - margin.bottom,
    };

    const svg = d3.select('#chart')
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('overflow', 'visible');

    xScale = d3.scaleTime()
        .domain(d3.extent(commits, (d) => d.datetime))
        .range([usableArea.left, usableArea.right])
        .nice();

    yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.bottom, usableArea.top]);

    // Gridlines
    svg.append('g').attr('class', 'gridlines')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

    // X axis
    svg.append('g').attr('class', 'x-axis')
        .attr('transform', `translate(0, ${usableArea.bottom})`)
        .call(d3.axisBottom(xScale));

    // Y axis
    svg.append('g').attr('class', 'y-axis')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(d3.axisLeft(yScale).tickFormat((d) => String(d % 24).padStart(2, '0') + ':00'));

    // Dots group
    svg.append('g').attr('class', 'dots');

    // Brush
    svg.call(d3.brush().on('start brush end', brushed));
    svg.selectAll('.dots, .overlay ~ *').raise();
}

// ── Update scatterplot with filtered commits (called on slider + scrollama) ───
function updateScatterPlot(data, commits) {
    const svg = d3.select('#chart svg');

    // Update x scale domain to filtered commits
    xScale.domain(d3.extent(commits, (d) => d.datetime)).nice();

    // Re-render x axis
    const width  = 1000;
    const height = 600;
    const margin = { top: 10, right: 10, bottom: 30, left: 50 };
    const usableArea = {
        bottom: height - margin.bottom,
        left:   margin.left,
        right:  width - margin.right,
        top:    margin.top,
        width:  width - margin.left - margin.right,
    };

    const xAxisGroup = svg.select('g.x-axis');
    xAxisGroup.selectAll('*').remove();
    xAxisGroup.call(d3.axisBottom(xScale));

    const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
    const rScale = d3.scaleSqrt().domain([minLines ?? 0, maxLines ?? 1]).range([2, 30]);

    const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
    const dots = svg.select('g.dots');

    dots.selectAll('circle')
        .data(sortedCommits, (d) => d.id)
        .join(
            (enter) => enter.append('circle')
                .attr('cx', (d) => xScale(d.datetime))
                .attr('cy', (d) => yScale(d.hourFrac))
                .attr('r', 0)
                .attr('fill', 'steelblue')
                .style('fill-opacity', 0.7)
                .call((enter) => enter.transition().duration(300).attr('r', (d) => rScale(d.totalLines)))
                .on('mouseenter', (event, commit) => {
                    d3.select(event.currentTarget).style('fill-opacity', 1);
                    renderTooltipContent(commit);
                    updateTooltipVisibility(true);
                    updateTooltipPosition(event);
                })
                .on('mouseleave', (event) => {
                    d3.select(event.currentTarget).style('fill-opacity', 0.7);
                    updateTooltipVisibility(false);
                }),
            (update) => update
                .attr('cx', (d) => xScale(d.datetime))
                .attr('cy', (d) => yScale(d.hourFrac))
                .attr('r',  (d) => rScale(d.totalLines)),
            (exit) => exit.remove(),
        );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function renderTooltipContent(commit) {
    const tooltip = document.getElementById('commit-tooltip');
    if (!commit || Object.keys(commit).length === 0) return;
    tooltip.innerHTML = `
        <dt>Commit</dt><dd><a href="${commit.url}" target="_blank">${commit.id?.slice(0, 7)}</a></dd>
        <dt>Date</dt><dd>${commit.datetime?.toLocaleString('en', { dateStyle: 'full' })}</dd>
        <dt>Time</dt><dd>${commit.time}</dd>
        <dt>Author</dt><dd>${commit.author}</dd>
        <dt>Lines edited</dt><dd>${commit.totalLines}</dd>
    `;
}
function updateTooltipVisibility(isVisible) {
    document.getElementById('commit-tooltip').hidden = !isVisible;
}
function updateTooltipPosition(event) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.style.left = `${event.clientX + 12}px`;
    tooltip.style.top  = `${event.clientY + 12}px`;
}

// ── Brush ─────────────────────────────────────────────────────────────────────
function isCommitSelected(selection, commit) {
    if (!selection) return false;
    const [[x0, y0], [x1, y1]] = selection;
    const cx = xScale(commit.datetime);
    const cy = yScale(commit.hourFrac);
    return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
}

function brushed(event) {
    const selection = event.selection;
    d3.selectAll('circle').classed('selected', (d) => isCommitSelected(selection, d));
    renderSelectionCount(selection);
    renderLanguageBreakdown(selection);
}

function renderSelectionCount(selection) {
    const selectedCommits = selection
        ? allCommits.filter((d) => isCommitSelected(selection, d))
        : [];
    document.querySelector('#selection-count').textContent =
        `${selectedCommits.length || 'No'} commits selected`;
}

function renderLanguageBreakdown(selection) {
    const selectedCommits = selection
        ? allCommits.filter((d) => isCommitSelected(selection, d))
        : [];
    const container = document.getElementById('language-breakdown');
    if (selectedCommits.length === 0) { container.innerHTML = ''; return; }
    const lines = selectedCommits.flatMap((d) => d.lines);
    const breakdown = d3.rollup(lines, (v) => v.length, (d) => d.type);
    container.innerHTML = '';
    for (const [language, count] of breakdown) {
        const proportion = count / lines.length;
        container.innerHTML += `<dt>${language}</dt><dd>${count} lines (${d3.format('.1~%')(proportion)})</dd>`;
    }
}

// ── Step 2: File unit visualization ──────────────────────────────────────────
const colors = d3.scaleOrdinal(d3.schemeTableau10);

function updateFileDisplay(filteredCommits) {
    const lines = filteredCommits.flatMap((d) => d.lines);

    let files = d3.groups(lines, (d) => d.file)
        .map(([name, lines]) => ({ name, lines }))
        .sort((a, b) => b.lines.length - a.lines.length);

    const filesContainer = d3.select('#files')
        .selectAll('div')
        .data(files, (d) => d.name)
        .join(
            (enter) => {
                const div = enter.append('div');
                div.append('dt').append('code');
                div.append('dd');
                return div;
            }
        );

    filesContainer.select('dt code').text((d) => d.name);

    filesContainer.select('dd')
        .selectAll('div')
        .data((d) => d.lines)
        .join('div')
        .attr('class', 'loc')
        .attr('style', (d) => `--color: ${colors(d.type)}`);
}

// ── Step 1.1: Time slider ─────────────────────────────────────────────────────
let commitProgress = 100;
let commitMaxTime;
let data, commits;

const timeScale = () => d3.scaleTime()
    .domain([
        d3.min(commits, (d) => d.datetime),
        d3.max(commits, (d) => d.datetime),
    ])
    .range([0, 100]);

function onTimeSliderChange() {
    commitProgress = Number(document.getElementById('commit-progress').value);
    commitMaxTime  = timeScale().invert(commitProgress);

    const timeEl = document.getElementById('commit-time');
    timeEl.textContent = commitMaxTime.toLocaleString('en', {
        dateStyle: 'long',
        timeStyle: 'short',
    });

    const filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
    const filteredData    = data.filter((d) => d.datetime <= commitMaxTime);

    renderCommitInfo(filteredData, filteredCommits);
    updateScatterPlot(filteredData, filteredCommits);
    updateFileDisplay(filteredCommits);
}

// ── Step 3: Scrollytelling ────────────────────────────────────────────────────
function generateStorySteps(commits) {
    d3.select('#scatter-story')
        .selectAll('.step')
        .data(commits)
        .join('div')
        .attr('class', 'step')
        .html((d, i) => {
            const fileCount = d3.rollups(d.lines, (v) => v.length, (l) => l.file).length;
            return `
                <p>On ${d.datetime.toLocaleString('en', { dateStyle: 'full', timeStyle: 'short' })},
                I made <a href="${d.url}" target="_blank">${i > 0 ? 'another glorious commit' : 'my first commit'}</a>.
                I edited ${d.totalLines} lines across ${fileCount} ${fileCount === 1 ? 'file' : 'files'}.
                Then I looked over all I had made, and I saw that it was very good.</p>
            `;
        });
}

function onStepEnter(response) {
    const commit = response.element.__data__;
    const filteredCommits = commits.filter((d) => d.datetime <= commit.datetime);
    const filteredData    = data.filter((d) => d.datetime <= commit.datetime);

    renderCommitInfo(filteredData, filteredCommits);
    updateScatterPlot(filteredData, filteredCommits);
    updateFileDisplay(filteredCommits);
}

// ── Main ──────────────────────────────────────────────────────────────────────
data    = await loadData();
commits = processCommits(data);
allCommits = commits;

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);
updateScatterPlot(data, commits);
updateFileDisplay(commits);

// Attach slider
document.getElementById('commit-progress').addEventListener('input', onTimeSliderChange);
onTimeSliderChange();

// Generate story steps
generateStorySteps(commits);

// Set up Scrollama
const scroller = scrollama();
scroller
    .setup({ container: '#scrolly-1', step: '#scatter-story .step', offset: 0.5 })
    .onStepEnter(onStepEnter);