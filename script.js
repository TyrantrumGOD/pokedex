document.addEventListener("DOMContentLoaded", () => {

const pokedex = document.getElementById("pokedex");
const shinyToggleBtn = document.getElementById("shinyToggle");
const prevBtn = document.getElementById("prevPage");
const nextBtn = document.getElementById("nextPage");
const firstBtn = document.getElementById("firstPage");
const lastBtn = document.getElementById("lastPage");
const pageNumbersContainer = document.getElementById("pageNumbers");

const totalPokemon = 1025;
let currentPage = 1;
const pageSize = 20;
let showShiny = false;
const pokemonDivs = [];

function capitalize(word){return word.charAt(0).toUpperCase()+word.slice(1);}
function formatStatName(statName){
  switch(statName.toLowerCase()){
    case "hp": return "HP";
    case "special-attack": return "Special-Attack";
    case "special-defense": return "Special-Defense";
    default: return statName.charAt(0).toUpperCase()+statName.slice(1);
  }
}

// Special forms mapping with string IDs (all lowercase)
const specialFormsMap = {
  412: [ // Burmy
    { id: '412-sandy', name: 'Sandy', spriteId: '412-sandy' },
    { id: '412-trash', name: 'Trash', spriteId: '412-trash' }
  ],
  421: [ //Cherrim
    { id: '421-sunshine', name: 'Sunshine', spriteId: '421-sunshine'}
],
  422: [ // Shellos
    { id: '422-east', name: 'East', spriteId: '422-east' }
  ],
  423: [ // Gastrodon
    { id: '423-east', name: 'East', spriteId: '423-east' }
  ],
  585: [ // Deerling
    { id: '585-autumn', name: 'Autumn', spriteId: '585-autumn'},
    { id: '585-summer', name: 'Summer', spriteId: '585-summer'},
    { id: '585-winter', name: 'Winter', spriteId: '585-winter'}
],
586: [ // Deerling
    { id: '586-autumn', name: 'Autumn', spriteId: '586-autumn'},
    { id: '586-summer', name: 'Summer', spriteId: '586-summer'},
    { id: '586-winter', name: 'Winter', spriteId: '586-winter'}
]

};

// Generate sprite URL for main Pokémon
function getSpriteUrl(data, shiny=false){
    return shiny ? data.sprites.front_shiny : data.sprites.front_default;
}

// Get all forms including Mega/GMax and special string-ID forms
async function getForms(speciesUrl, defaultName, numericId){
    const formsList = [];
    try{
        const speciesData = await fetch(speciesUrl).then(r=>r.json());
        for(let variety of speciesData.varieties){
            const varName = variety.pokemon.name;
            let formName = varName.replace(`${defaultName}-`, '');
            if(formName==='') formName='Default';
            if(formName.toLowerCase().includes("west")) continue;

            const formData = await fetch(variety.pokemon.url).then(r=>r.json());
            formsList.push({
                id: numericId, 
                name: capitalize(formName),
                normalSprite: formData.sprites.front_default,
                shinySprite: formData.sprites.front_shiny
            });
        }

        // Add special string-ID forms manually
        if(specialFormsMap[numericId]){
            specialFormsMap[numericId].forEach(f=>{
                formsList.push({
                    id: f.id,
                    name: f.name,
                    normalSprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${f.spriteId.toLowerCase()}.png`,
                    shinySprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${f.spriteId.toLowerCase()}.png`
                });
            });
        }
    } catch(e){ console.error("Failed to fetch forms:", e); }
    return formsList;
}

// Get next evolution if exists
async function getEvolution(pokemonName){
    try {
        const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonName.toLowerCase()}`);
        const speciesData = await speciesRes.json();
        const evolutionRes = await fetch(speciesData.evolution_chain.url);
        const evolutionData = await evolutionRes.json();
        function findNextEvolution(chain){
            if(chain.species.name===pokemonName.toLowerCase() && chain.evolves_to.length>0){
                return chain.evolves_to.map(e=>capitalize(e.species.name)).join(", ");
            }
            for(let e of chain.evolves_to){
                const res=findNextEvolution(e);
                if(res) return res;
            }
            return null;
        }
        return findNextEvolution(evolutionData.chain);
    } catch(e) { return null; }
}

// Load page of Pokémon
async function loadPage(page){
    pokedex.innerHTML = "";
    pokemonDivs.length = 0;
    const start = (page-1)*pageSize + 1;
    const end = Math.min(start + pageSize - 1, totalPokemon);

    const fetches = [];
    for(let id=start; id<=end; id++){
        fetches.push(fetch(`https://pokeapi.co/api/v2/pokemon/${id}`).then(r=>r.json()));
    }

    const results = await Promise.all(fetches);

    for(const data of results){
        const baseName = data.species.name;
        const types = data.types.map(t=>capitalize(t.type.name)).join(", ");
        let totalStats = 0;
        const stats = data.stats.map(s=>{ totalStats+=s.base_stat; return `<p><strong>${formatStatName(s.stat.name)}:</strong> ${s.base_stat}</p>`; }).join("");

        // Weaknesses
        let weaknesses = [];
        const typeFetches = data.types.map(async t=>{
            const resType = await fetch(t.type.url);
            const typeData = await resType.json();
            typeData.damage_relations.double_damage_from.forEach(w=>{
                const name = capitalize(w.name);
                if(!weaknesses.includes(name)) weaknesses.push(name);
            });
        });
        await Promise.all(typeFetches);

        const evolution = await getEvolution(data.name);
        const evolutionText = evolution ? `Can evolve into: ${evolution}` : "Does not evolve";

        const contentDiv = document.createElement("div");
        contentDiv.classList.add("content");
        contentDiv.innerHTML = `
            <p><strong>Type:</strong> ${types}</p>
            <p><strong>Weak against:</strong> ${weaknesses.join(", ")}</p>
            <div class="stats">
                <h4>Stats:</h4>
                ${stats}
                <p class="total">Total: ${totalStats}</p>
            </div>
            <p class="evolution">${evolutionText}</p>
        `;

        // Forms
        const forms = await getForms(data.species.url, baseName, data.id);
        if(forms.length>0){
            let formsHTML = '<div class="forms"><h4>Forms:</h4><div style="display:flex; gap:5px; flex-wrap:wrap;">';
            forms.forEach(f=>{
                formsHTML += `
                    <div data-id="${f.id}" data-normal="${f.normalSprite}" data-shiny="${f.shinySprite}">
                        <img src="${f.normalSprite}" alt="${f.name}">
                        <p>${f.name}</p>
                    </div>
                `;
            });
            formsHTML += '</div></div>';
            contentDiv.innerHTML += formsHTML;
        }

        const pokemonDiv = document.createElement("div");
        pokemonDiv.classList.add("pokemon");
        pokemonDiv.innerHTML = `
            <img src="${getSpriteUrl(data, showShiny)}" alt="${baseName}" data-normal="${data.sprites.front_default}" data-shiny="${data.sprites.front_shiny}">
            <h3>${capitalize(baseName)}</h3>
        `;
        pokemonDiv.appendChild(contentDiv);

        pokemonDiv.addEventListener("click", e=>{
            if(e.target.closest(".content")) return;
            pokemonDivs.forEach(p=>{if(p.div!==pokemonDiv)p.div.classList.remove("active");});
            pokemonDiv.classList.toggle("active");
        });

        pokedex.appendChild(pokemonDiv);
        pokemonDivs.push({div:pokemonDiv,data:data});
    }

    renderPagination();
}

// Pagination buttons
function renderPagination(){
    const totalPages = Math.ceil(totalPokemon / pageSize);
    pageNumbersContainer.innerHTML = "";
    let startPage = currentPage + 1;
    if(currentPage===1) startPage = 2;
    if(currentPage>=totalPages-1) startPage = Math.max(totalPages-2, 2);
    const pagesToShow = [startPage,startPage+1,startPage+2].filter(p=>p<=totalPages);
    pagesToShow.forEach(p=>{
        const btn = document.createElement("button");
        btn.textContent = p;
        if(p===currentPage) btn.classList.add("activePage");
        btn.addEventListener("click", ()=>{ currentPage=p; loadPage(currentPage); });
        pageNumbersContainer.appendChild(btn);
    });
}

// Shiny toggle
shinyToggleBtn.addEventListener("click", ()=>{
    showShiny = !showShiny;
    shinyToggleBtn.textContent = showShiny ? "Show Normal" : "Show Shiny";

    pokemonDivs.forEach(p=>{
        const img = p.div.querySelector("img");
        img.src = showShiny ? img.dataset.shiny : img.dataset.normal;

        const formsImgs = p.div.querySelectorAll(".forms div img");
        formsImgs.forEach((imgEl)=>{
            const parentDiv = imgEl.parentElement;
            imgEl.src = showShiny ? parentDiv.dataset.shiny : parentDiv.dataset.normal;
        });
    });
});

// Page navigation
prevBtn.addEventListener("click", ()=>{ if(currentPage>1){ currentPage--; loadPage(currentPage); } });
nextBtn.addEventListener("click", ()=>{ if(currentPage*pageSize<totalPokemon){ currentPage++; loadPage(currentPage); } });
firstBtn.addEventListener("click", ()=>{ currentPage=1; loadPage(currentPage); });
lastBtn.addEventListener("click", ()=>{ currentPage=Math.ceil(totalPokemon/pageSize); loadPage(currentPage); });

loadPage(currentPage);

});
