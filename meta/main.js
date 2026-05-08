import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

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
                value:        lines,
                enumerable:   false,
                writable:     false,
                configurable: false,
            });
            return ret;
        });
}

function renderCommitInfo(data, commits) {
    const dl = d3.select('#stats').append('dl').attr('class', 'stats');

    function addStat(label, value) {
        const div = dl.append('div');
        div.append('dt').text(label);
        div.append('dd').text(value);
    }

    addStat('Total LOC', data.length);
    addStat('Total Commits', commits.length);

    const numFiles = d3.group(data, (d) => d.file).size;
    addStat('Files', numFiles);

    const fileLengths = d3.rollups(data, (v) => d3.max(v, (v) => v.line), (d) => d.file);
    const maxFileLength = d3.max(fileLengths, (d) => d[1]);
    addStat('Longest File (lines)', maxFileLength);

    const avgFileLength = Math.round(d3.mean(fileLengths, (d) => d[1]));
    addStat('Avg File Length', avgFileLength);

    const maxLineLength = d3.max(data, (d) => d.length);
    addStat('Longest Line (chars)', maxLineLength);

    const workByPeriod = d3.rollups(
        data,
        (v) => v.length,
        (d) => new Date(d.datetime).toLocaleString('en', { dayPeriod: 'short' }),
    );
    const maxPeriod = d3.greatest(workByPeriod, (d) => d[1])?.[0];
    addStat('Most Active Period', maxPeriod ?? '—');
}

let xScale, yScale;
let commits;

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

    const svg = d3
        .select('#chart')
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('overflow', 'visible');

    xScale = d3
        .scaleTime()
        .domain(d3.extent(commits, (d) => d.datetime))
        .range([usableArea.left, usableArea.right])
        .nice();

    yScale = d3
        .scaleLinear()
        .domain([0, 24])
        .range([usableArea.bottom, usableArea.top]);

    const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
    const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

    const gridlines = svg
        .append('g')
        .attr('class', 'gridlines')
        .attr('transform', `translate(${usableArea.left}, 0)`);
    gridlines.call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale)
        .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

    svg.append('g')
        .attr('transform', `translate(0, ${usableArea.bottom})`)
        .call(xAxis);

    svg.append('g')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(yAxis);

    const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
    const dots = svg.append('g').attr('class', 'dots');

    dots
        .selectAll('circle')
        .data(sortedCommits)
        .join('circle')
        .attr('cx', (d) => xScale(d.datetime))
        .attr('cy', (d) => yScale(d.hourFrac))
        .attr('r',  (d) => rScale(d.totalLines))
        .attr('fill', 'steelblue')
        .style('fill-opacity', 0.7)
        .on('mouseenter', (event, commit) => {
            d3.select(event.currentTarget).style('fill-opacity', 1);
            renderTooltipContent(commit);
            updateTooltipVisibility(true);
            updateTooltipPosition(event);
        })
        .on('mouseleave', (event) => {
            d3.select(event.currentTarget).style('fill-opacity', 0.7);
            updateTooltipVisibility(false);
        });

    svg.call(d3.brush().on('start brush end', brushed));
    svg.selectAll('.dots, .overlay ~ *').raise();
}

function renderTooltipContent(commit) {
    const tooltip = document.getElementById('commit-tooltip');
    if (!commit || Object.keys(commit).length === 0) return;
    tooltip.innerHTML = `
        <dt>Commit</dt>
        <dd><a href="${commit.url}" target="_blank">${commit.id?.slice(0, 7)}</a></dd>
        <dt>Date</dt>
        <dd>${commit.datetime?.toLocaleString('en', { dateStyle: 'full' })}</dd>
        <dt>Time</dt>
        <dd>${commit.time}</dd>
        <dt>Author</dt>
        <dd>${commit.author}</dd>
        <dt>Lines edited</dt>
        <dd>${commit.totalLines}</dd>
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
        ? commits.filter((d) => isCommitSelected(selection, d))
        : [];
    document.querySelector('#selection-count').textContent =
        `${selectedCommits.length || 'No'} commits selected`;
    return selectedCommits;
}

function renderLanguageBreakdown(selection) {
    const selectedCommits = selection
        ? commits.filter((d) => isCommitSelected(selection, d))
        : [];

    const container = document.getElementById('language-breakdown');
    if (selectedCommits.length === 0) { container.innerHTML = ''; return; }

    const lines = selectedCommits.flatMap((d) => d.lines);
    const breakdown = d3.rollup(lines, (v) => v.length, (d) => d.type);

    container.innerHTML = '';
    for (const [language, count] of breakdown) {
        const proportion = count / lines.length;
        const formatted  = d3.format('.1~%')(proportion);
        container.innerHTML += `<dt>${language}</dt><dd>${count} lines (${formatted})</dd>`;
    }
}

const data = await loadData();
commits = processCommits(data);
renderCommitInfo(data, commits);
renderScatterPlot(data, commits);