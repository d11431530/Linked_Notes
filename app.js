// -------- data
const LOCAL_STORAGE_KEY = 'linkedNotesData';
let nodes = [];
let links = [];

function loadData() { 
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            nodes = (parsed.nodes || []).map(n => {
                if (n.image && !n.images) {
                    n.images = [n.image];
                    delete n.image;
                } else if (!n.images) {
                    n.images = [];
                }
                return n;
            });
            links = parsed.links || [];
            return;
        } catch (e) {
            console.error("Failed to parse saved data.", e);
        }
    }
    

    nodes = [
        { id: 'root-1', title: 'Center', type: 'hub', level: 1, content: '', images: [] },
        { id: 'sub-1', title: 'Topics', type: 'hub', level: 2, content: '', images: [] },
        { id: 'note-1', title: 'Notes', type: 'note', level: 3, content: '', images: [] }
    ];
    links = [
        { source: 'root-1', target: 'sub-1' },
        { source: 'sub-1', target: 'note-1' }
    ];
    saveData();
}


function saveData() {
    try {
        const cleanLinks = links.map(l => ({
            source: typeof l.source === 'object' ? l.source.id : l.source,
            target: typeof l.target === 'object' ? l.target.id : l.target
        }));
        
        const cleanNodes = nodes.map(n => ({
            id: n.id, title: n.title, type: n.type, level: n.level, 
            content: n.content, images: n.images, 
            x: n.x, y: n.y, vx: n.vx, vy: n.vy
        }));

        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ nodes: cleanNodes, links: cleanLinks }));
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            alert('Storage limit reached! The total size of your images exceeds the browser limit. Please remove some images.');
        }
    }
}

loadData();


// ------------ tension
const container = document.getElementById('canvas-container');
let width = container.clientWidth;
let height = container.clientHeight;

const svg = d3.select("#canvas-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .on("click", hideContextMenu);

const gMain = svg.append("g");

const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", (event) => {
        gMain.attr("transform", event.transform);
        hideContextMenu();
    });
svg.call(zoom).on("dblclick.zoom", null);

const gLinks = gMain.append("g").attr("class", "links");
const gNodes = gMain.append("g").attr("class", "nodes");

const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id).distance(d => {
        if(d.source.type === 'hub' && d.target.type === 'hub') return 180;
        return 120;
    }))
    .force("charge", d3.forceManyBody().strength(-800))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius(d => d.type === 'hub' ? 50 : 30).iterations(2));




// -------------- rendering
let linkElements, nodeElements;

function updateGraph() {
    linkElements = gLinks.selectAll(".link")
        .data(links, d => {
            const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
            const targetId = typeof d.target === 'object' ? d.target.id : d.target;
            return sourceId + "-" + targetId;
        });
    linkElements.exit().remove();
    const linkEnter = linkElements.enter().append("line").attr("class", "link");
    linkElements = linkEnter.merge(linkElements);

    nodeElements = gNodes.selectAll(".node").data(nodes, d => d.id);
    nodeElements.exit().remove();

    const nodeEnter = nodeElements.enter()
        .append("g")
        .attr("class", d => `node cursor-pointer ${d.type === 'hub' ? 'node-hub' : 'node-note'}`)
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended))
        .on("contextmenu", handleNodeContextMenu)
        .on("dblclick", handleNodeDoubleClick);

    nodeEnter.each(function(d) {
        const el = d3.select(this);
        // Robust check: Does it have text OR does it have images?
        const hasData = (d.content && d.content.trim() !== '') || (d.images && d.images.length > 0);
        
        if (d.type === 'hub') {
            const radius = d.level === 1 ? 40 : 25;
            el.append("circle")
                .attr("r", radius)
                .attr("class", hasData ? "node-has-content" : "");
        } else {
            el.append("rect")
                .attr("width", 50)
                .attr("height", 36)
                .attr("x", -25)
                .attr("y", -18)
                .attr("rx", 8)
                .attr("class", hasData ? "node-has-content" : "");
        }
        
        el.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", d.type === 'hub' ? (d.level === 1 ? 60 : 45) : 35)
            .text(d.title);
    });

    nodeElements = nodeEnter.merge(nodeElements);


    nodeElements.selectAll("circle").attr("class", d => {
        const hasData = (d.content && d.content.trim() !== '') || (d.images && d.images.length > 0);
        return hasData ? "node-has-content" : "";
    });
    nodeElements.selectAll("rect").attr("class", d => {
        const hasData = (d.content && d.content.trim() !== '') || (d.images && d.images.length > 0);
        return hasData ? "node-has-content" : "";
    });
    nodeElements.selectAll("text").text(d => d.title);

    simulation.nodes(nodes).on("tick", ticked);
    simulation.force("link").links(links);
    simulation.alpha(1).restart();
    
    saveData();
}

function ticked() {
    linkElements
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
    nodeElements
        .attr("transform", d => `translate(${d.x},${d.y})`);
}




// ----------- drag nodes
function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x; d.fy = d.y;
}
function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null; d.fy = null;
    saveData();
}

window.addEventListener('resize', () => {
    width = container.clientWidth; height = container.clientHeight;
    svg.attr("width", width).attr("height", height);
    simulation.force("center", d3.forceCenter(width / 2, height / 2));
    simulation.alpha(0.3).restart();
});




// ------------- right click
const menuEl = document.getElementById('context-menu');
const menuNodeOptions = document.getElementById('menu-node-options');
const menuBgOptions = document.getElementById('menu-bg-options');
let rightClickedNode = null;
let rightClickCoords = { x: 0, y: 0 };

function handleNodeContextMenu(event, d) {
    event.preventDefault(); event.stopPropagation();
    rightClickedNode = d;
    menuNodeOptions.classList.remove('hidden');
    menuBgOptions.classList.add('hidden');
    positionAndShowMenu(event.pageX, event.pageY);
}

svg.on("contextmenu", (event) => {
    event.preventDefault(); rightClickedNode = null;
    const [x, y] = d3.pointer(event, gMain.node());
    rightClickCoords = { x, y };
    menuNodeOptions.classList.add('hidden');
    menuBgOptions.classList.remove('hidden');
    positionAndShowMenu(event.pageX, event.pageY);
});

function positionAndShowMenu(x, y) {
    menuEl.style.left = `${x}px`; menuEl.style.top = `${y}px`;
    menuEl.classList.remove('hidden');
}

function hideContextMenu() { menuEl.classList.add('hidden'); rightClickedNode = null; }

function handleMenuAction(action) {
    const targetNode = rightClickedNode; 
    hideContextMenu();
    
    if (action === 'delete' && targetNode) {
        nodes = nodes.filter(n => n.id !== targetNode.id);
        links = links.filter(l => l.source.id !== targetNode.id && l.target.id !== targetNode.id);
    } else if (action === 'add-hub' && targetNode) {
        const newId = 'hub-' + Date.now();
        nodes.push({ id: newId, title: 'New Topic', type: 'hub', level: 2, content: '', images: [], x: targetNode.x + Math.random() * 50 - 25, y: targetNode.y + Math.random() * 50 - 25 });
        links.push({ source: targetNode.id, target: newId });
    } else if (action === 'add-note' && targetNode) {
        const newId = 'note-' + Date.now();
        nodes.push({ id: newId, title: 'New Note', type: 'note', level: 3, content: '', images: [], x: targetNode.x + Math.random() * 50 - 25, y: targetNode.y + Math.random() * 50 - 25 });
        links.push({ source: targetNode.id, target: newId });
    } else if (action === 'add-floating-hub') {
        nodes.push({ id: 'hub-' + Date.now(), title: 'New Concept', type: 'hub', level: 1, content: '', images: [], x: rightClickCoords.x, y: rightClickCoords.y });
    }
    updateGraph();
}

// ------------------- double click 
const modalOverlay = document.getElementById('note-modal');
const modalContentBox = document.getElementById('modal-content-box');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalTypeIndicator = document.getElementById('modal-type-indicator');

const imageUpload = document.getElementById('modal-image-upload');
const imagePreviewContainer = document.getElementById('modal-image-preview-container');

let editingNode = null;
let currentTempImages = []; 

function renderImagePreviews() {
    imagePreviewContainer.innerHTML = '';
    
    if (currentTempImages.length === 0) {
        imagePreviewContainer.classList.add('hidden');
        return;
    }
    
    imagePreviewContainer.classList.remove('hidden');
    
    currentTempImages.forEach((imgSrc, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'relative inline-block group';
        
        const img = document.createElement('img');
        img.src = imgSrc;
        img.className = 'h-24 w-24 object-cover rounded-md border border-slate-200 bg-white shadow-sm';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow hover:bg-red-600';
        removeBtn.innerHTML = '✕';
        removeBtn.onclick = (e) => {
            e.preventDefault();
            currentTempImages.splice(index, 1);
            renderImagePreviews();
        };
        
        wrapper.appendChild(img);
        wrapper.appendChild(removeBtn);
        imagePreviewContainer.appendChild(wrapper);
    });
}

function handleNodeDoubleClick(event, d) {
    event.stopPropagation();
    hideContextMenu();
    editingNode = d;
    
    modalTitle.value = d.title;
    modalBody.value = d.content || '';
    modalTypeIndicator.innerText = d.type === 'hub' ? 'Edit' : 'Edit';
    
    currentTempImages = d.images ? [...d.images] : [];
    renderImagePreviews();
    
    imageUpload.value = ''; 
    
    modalOverlay.classList.remove('hidden');
    setTimeout(() => {
        modalContentBox.classList.remove('scale-95', 'opacity-0');
        modalContentBox.classList.add('scale-100', 'opacity-100');
        modalTitle.focus();
    }, 10);
}

imageUpload.addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(event) {
            currentTempImages.push(event.target.result);
            renderImagePreviews();
        };
        reader.readAsDataURL(file);
    });
    
    imageUpload.value = '';
});

function closeModal() {
    modalContentBox.classList.remove('scale-100', 'opacity-100');
    modalContentBox.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modalOverlay.classList.add('hidden');
        editingNode = null;
        currentTempImages = [];
    }, 200);
}

function saveModal() {
    if (editingNode) {
        editingNode.title = modalTitle.value.trim() || 'Untitled';
        editingNode.content = modalBody.value;
        editingNode.images = [...currentTempImages]; 
        updateGraph(); 
    }
    closeModal();
}

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});




// ----------- reset data
document.getElementById('reset-btn').addEventListener('click', () => {
    const confirmReset = window.confirm ? window.confirm("Are you sure you want to reset all data back to defaults? This cannot be undone.") : true;
    if (confirmReset) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        nodes = []; links = [];
        loadData();
        updateGraph();
        svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    }
});

updateGraph();