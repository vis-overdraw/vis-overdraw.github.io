import { paperImages } from './src/imageRefs.js';
import { taxonomySections, papers as allPapers } from './src/data.js';

// Reorder sections with ORM Type first
const TAXONOMY_SECTIONS = [
  taxonomySections.find(s => s.id === 'orm-type'),
  taxonomySections.find(s => s.id === 'data'),
  taxonomySections.find(s => s.id === 'design'),
  taxonomySections.find(s => s.id === 'task'),
  taxonomySections.find(s => s.id === 'evidence'),
].filter(Boolean);

const state = {
  papers: [],
  dimensionsById: new Map(),
  selectedDimensions: new Set(),
  yearMin: 0,
  yearMax: 0,
  yearFloor: 0,
  yearCeil: 0,
  sortMode: 'year-desc',
};

const els = {
  app: document.getElementById('app'),
  sidebar: document.getElementById('sidebar'),
  facets: document.getElementById('facets'),
  selectedCount: document.getElementById('selectedCount'),
  yearChart: document.getElementById('yearChart'),
  yearRangeLabel: document.getElementById('yearRangeLabel'),
  yearRangeFill: document.getElementById('yearRangeFill'),
  yearMin: document.getElementById('yearMin'),
  yearMax: document.getElementById('yearMax'),
  yearMinLabel: document.getElementById('yearMinLabel'),
  yearMaxLabel: document.getElementById('yearMaxLabel'),
  clearFilters: document.getElementById('clearFilters'),
  resultCount: document.getElementById('resultCount'),
  sortSelect: document.getElementById('sortSelect'),
  paperGrid: document.getElementById('paperGrid'),
  facetSectionTemplate: document.getElementById('facetSectionTemplate'),
  facetGroupTemplate: document.getElementById('facetGroupTemplate'),
  paperCardTemplate: document.getElementById('paperCardTemplate'),
};

function buildFacetCounts(papers) {
  const counts = new Map();
  for (const paper of papers) {
    for (const dimensionId of paper.taxonomy) {
      counts.set(dimensionId, (counts.get(dimensionId) || 0) + 1);
    }
  }
  return counts;
}

function getSelectedDimensionsBySection() {
  const selectedBySection = new Map();
  for (const section of TAXONOMY_SECTIONS) selectedBySection.set(section.id, []);
  for (const dimensionId of state.selectedDimensions) {
    const dimension = state.dimensionsById.get(dimensionId);
    if (!dimension) continue;
    selectedBySection.get(dimension.sectionId).push(dimensionId);
  }
  return selectedBySection;
}

function paperMatchesFilters(paper) {
  if (paper.year == null) return false;
  if (paper.year < state.yearMin || paper.year > state.yearMax) return false;

  const selectedBySection = getSelectedDimensionsBySection();
  for (const [sectionId, selectedIds] of selectedBySection.entries()) {
    if (!selectedIds.length) continue;
    if (!selectedIds.some((dimensionId) => paper.taxonomy.includes(dimensionId))) return false;
  }

  return true;
}

function getFilteredPapers() {
  const papers = state.papers.filter(paperMatchesFilters);
  const direction = state.sortMode.endsWith('asc') ? 1 : -1;
  const sortField = state.sortMode.startsWith('title') ? 'title' : 'year';

  return papers.sort((left, right) => {
    if (sortField === 'title') {
      return left.title.localeCompare(right.title) * direction;
    }
    const leftYear = left.year ?? 0;
    const rightYear = right.year ?? 0;
    if (leftYear !== rightYear) return (leftYear - rightYear) * direction;
    return left.title.localeCompare(right.title) * direction;
  });
}

function getYearBuckets(papers) {
  const buckets = new Map();
  for (const paper of papers) {
    if (paper.year == null) continue;
    buckets.set(paper.year, (buckets.get(paper.year) || 0) + 1);
  }
  return buckets;
}

function renderSidebar() {
  const counts = buildFacetCounts(state.papers);

  els.facets.innerHTML = '';
  for (const section of TAXONOMY_SECTIONS) {
    const sectionNode = els.facetSectionTemplate.content.firstElementChild.cloneNode(true);
    sectionNode.style.setProperty('--section-accent', section.accent);
    sectionNode.querySelector('.facet-section__eyebrow').textContent = section.id.toUpperCase();
    sectionNode.querySelector('h3').textContent = section.label;
    
    const totalDimensions = section.groups.reduce((total, group) => total + group.dimensions.length, 0);
    sectionNode.querySelector('.facet-section__count').textContent = `${totalDimensions} dimension${totalDimensions === 1 ? '' : 's'}`;

    const groupsHost = sectionNode.querySelector('.facet-groups');
    for (const group of section.groups) {
      const groupNode = els.facetGroupTemplate.content.firstElementChild.cloneNode(true);
      groupNode.querySelector('.facet-group__label').textContent = group.label;
      const pillsHost = groupNode.querySelector('.facet-pills');
      
      for (const dimension of group.dimensions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'facet-pill';
        button.dataset.dimensionId = dimension.id;
        button.style.borderColor = section.accent;
        button.innerHTML = `<span>${dimension.label}</span><span class="facet-pill__count">${counts.get(dimension.id) || 0}</span>`;
        button.setAttribute('aria-pressed', state.selectedDimensions.has(dimension.id) ? 'true' : 'false');
        if (state.selectedDimensions.has(dimension.id)) {
          button.classList.add('is-active');
          button.style.background = `linear-gradient(180deg, color-mix(in srgb, ${section.accent} 34%, rgba(20, 28, 46, 0.9)), rgba(16, 23, 39, 0.98))`;
        }
        button.addEventListener('click', () => {
          if (state.selectedDimensions.has(dimension.id)) {
            state.selectedDimensions.delete(dimension.id);
          } else {
            state.selectedDimensions.add(dimension.id);
          }
          renderAll();
        });
        pillsHost.appendChild(button);
      }
      groupsHost.appendChild(groupNode);
    }
    els.facets.appendChild(sectionNode);
  }
}

function renderYearChart(filteredPapers) {
  const buckets = getYearBuckets(filteredPapers);
  const years = [];
  for (let year = state.yearFloor; year <= state.yearCeil; year += 1) years.push(year);
  const maxCount = Math.max(1, ...years.map((year) => buckets.get(year) || 0));

  els.yearChart.innerHTML = '';
  for (const year of years) {
    const count = buckets.get(year) || 0;
    const bar = document.createElement('div');
    bar.className = 'year-chart__bar';
    bar.dataset.year = String(year);
    bar.style.height = `${Math.max(8, Math.round((count / maxCount) * 100))}%`;
    bar.style.opacity = count ? '1' : '0.22';
    bar.title = `${year}: ${count} paper${count === 1 ? '' : 's'}`;
    els.yearChart.appendChild(bar);
  }
}

function syncYearSliderUi() {
  const min = state.yearFloor;
  const max = state.yearCeil;
  
  // Set input constraints
  els.yearMin.min = String(min);
  els.yearMin.max = String(max);
  els.yearMax.min = String(min);
  els.yearMax.max = String(max);
  
  // Update state from current input values only if they've been changed by user
  const minValue = Math.min(Number(els.yearMin.value), Number(els.yearMax.value) - 1);
  const maxValue = Math.max(Number(els.yearMax.value), Number(els.yearMin.value) + 1);
  state.yearMin = minValue;
  state.yearMax = maxValue;
  
  // Update input elements to reflect state
  els.yearMin.value = String(state.yearMin);
  els.yearMax.value = String(state.yearMax);

  const minPct = ((state.yearMin - min) / (max - min)) * 100;
  const maxPct = ((state.yearMax - min) / (max - min)) * 100;
  els.yearRangeFill.style.setProperty('--from', `${minPct}%`);
  els.yearRangeFill.style.setProperty('--to', `${maxPct}%`);
  els.yearRangeLabel.textContent = `${state.yearMin} - ${state.yearMax}`;
  els.yearMinLabel.textContent = String(min);
  els.yearMaxLabel.textContent = String(max);
}

function renderPapers(filteredPapers) {
  els.paperGrid.innerHTML = '';
  if (!filteredPapers.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<strong>No papers matched the current filters.</strong><p>Clear filters or widen the year range to reveal more results.</p>';
    els.paperGrid.appendChild(empty);
    return;
  }

  for (const paper of filteredPapers) {
    const node = els.paperCardTemplate.content.firstElementChild.cloneNode(true);
    const image = node.querySelector('img');
    const placeholder = node.querySelector('.paper-card__placeholder');
    if (paper.imageSrc) {
      image.src = paper.imageSrc;
      image.alt = `${paper.title} first page preview`;
      image.style.display = 'block';
      placeholder.style.display = 'none';
    } else {
      image.removeAttribute('src');
      image.alt = '';
      image.style.display = 'none';
      placeholder.style.display = 'grid';
    }

    const titleNode = node.querySelector('h3');
    titleNode.innerHTML = '';
    if (paper.link) {
      const titleLink = document.createElement('a');
      titleLink.href = paper.link;
      titleLink.target = '_blank';
      titleLink.rel = 'noreferrer';
      titleLink.className = 'paper-card__title-link';
      titleLink.textContent = paper.title;
      titleNode.appendChild(titleLink);
    } else {
      titleNode.textContent = paper.title;
    }
    node.querySelector('.paper-card__venue').textContent = paper.reference;
    node.querySelector('.year-chip').textContent = String(paper.year ?? '');
    node.querySelector('[data-field="venue"]').textContent = paper.venue;
    node.querySelector('[data-field="year"]').textContent = String(paper.year ?? '');

    const linkNode = node.querySelector('[data-field="link"]');
    linkNode.innerHTML = '';
    if (paper.link) {
      const link = document.createElement('a');
      link.href = paper.link;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.className = 'paper-link';
      link.textContent = paper.link;
      linkNode.appendChild(link);
    } else {
      linkNode.textContent = '—';
    }

    node.querySelector('[data-field="reference"]').textContent = paper.reference || '—';

    const tagList = node.querySelector('[data-field="ormTags"]');
    const ormDimensions = paper.taxonomy
      .map((dimensionId) => state.dimensionsById.get(dimensionId))
      .filter((dimension) => dimension && dimension.sectionId === 'orm-type');

    if (!ormDimensions.length) {
      const emptyTag = document.createElement('span');
      emptyTag.className = 'tag';
      emptyTag.textContent = 'None';
      tagList.appendChild(emptyTag);
    } else {
      for (const dimension of ormDimensions) {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = dimension.label;
        tagList.appendChild(tag);
      }
    }

    els.paperGrid.appendChild(node);
  }
}

function renderToolbar(filteredPapers) {
  els.selectedCount.textContent = String(filteredPapers.length);
  els.resultCount.textContent = `${filteredPapers.length} paper${filteredPapers.length === 1 ? '' : 's'}`;
}

function renderAll() {
  const filteredPapers = getFilteredPapers();
  renderSidebar();
  renderToolbar(filteredPapers);
  renderYearChart(filteredPapers);
  renderPapers(filteredPapers);
}

function initializeControls() {
  els.sortSelect.value = state.sortMode;
  els.sortSelect.addEventListener('change', () => {
    state.sortMode = els.sortSelect.value;
    renderAll();
  });

  const onYearInput = () => {
    const min = Number(els.yearMin.value);
    const max = Number(els.yearMax.value);
    if (min >= max) {
      if (document.activeElement === els.yearMin) {
        els.yearMin.value = String(Math.min(max - 1, state.yearCeil));
      } else {
        els.yearMax.value = String(Math.max(min + 1, state.yearFloor));
      }
    }
    syncYearSliderUi();
    renderAll();
  };

  els.yearMin.addEventListener('input', onYearInput);
  els.yearMax.addEventListener('input', onYearInput);

  els.clearFilters.addEventListener('click', () => {
    state.selectedDimensions.clear();
    state.yearMin = state.yearFloor;
    state.yearMax = state.yearCeil;
    state.sortMode = 'year-desc';
    els.sortSelect.value = state.sortMode;
    renderAll();
  });
}

async function boot() {
  try {
    initializeControls();
    
    // Use pre-generated data from src/data.js
    state.papers = allPapers.map(paper => ({
      ...paper,
      imageSrc: paperImages[paper.title] || '',
    }));
    
    // Build dimension lookup map
    for (const section of TAXONOMY_SECTIONS) {
      for (const group of section.groups) {
        for (const dimension of group.dimensions) {
          state.dimensionsById.set(dimension.id, dimension);
        }
      }
    }
    
    // Set default year range
    state.yearFloor = 1987;
    state.yearCeil = 2026;
    
    state.yearMin = state.yearFloor;
    state.yearMax = state.yearCeil;
    
    // Initialize input element constraints FIRST, then values
    els.yearMin.min = String(state.yearFloor);
    els.yearMin.max = String(state.yearCeil);
    els.yearMax.min = String(state.yearFloor);
    els.yearMax.max = String(state.yearCeil);
    
    els.yearMin.value = String(state.yearFloor);
    els.yearMax.value = String(state.yearCeil);
    
    // Manually update UI without calling syncYearSliderUi()
    const minPct = ((state.yearMin - state.yearFloor) / (state.yearCeil - state.yearFloor)) * 100;
    const maxPct = ((state.yearMax - state.yearFloor) / (state.yearCeil - state.yearFloor)) * 100;
    els.yearRangeFill.style.setProperty('--from', `${minPct}%`);
    els.yearRangeFill.style.setProperty('--to', `${maxPct}%`);
    els.yearRangeLabel.textContent = `${state.yearMin} - ${state.yearMax}`;
    els.yearMinLabel.textContent = String(state.yearFloor);
    els.yearMaxLabel.textContent = String(state.yearCeil);
    
    renderAll();
  } catch (error) {
    console.error(error);
    els.paperGrid.innerHTML = `<div class="empty-state"><strong>Could not load data.</strong><p>${String(error.message || error)}</p></div>`;
  }
}

boot();
