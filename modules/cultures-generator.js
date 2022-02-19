"use strict";

window.Cultures = (function () {
  let cells;

  const generate = function () {
    TIME && console.time("generateCultures");
    cells = pack.cells;
    cells.culture = new Uint16Array(cells.i.length); // cell cultures
    let count = Math.min(+culturesInput.value, +culturesSet.selectedOptions[0].dataset.max);

    const populated = cells.i.filter(i => cells.s[i]); // populated cells
    if (populated.length < count * 25) {
      count = Math.floor(populated.length / 50);
      if (!count) {
        WARN && console.warn(`There are no populated cells. Cannot generate cultures`);
        pack.cultures = [{name: "Wildlands", i: 0, base: 1, shield: "round"}];
        alertMessage.innerHTML = `
          The climate is harsh and people cannot live in this world.<br>
          No cultures, states and burgs will be created.<br>
          Please consider changing climate settings in the World Configurator`;
        $("#alert").dialog({
          resizable: false,
          title: "Extreme climate warning",
          buttons: {
            Ok: function () {
              $(this).dialog("close");
            }
          }
        });
        return;
      } else {
        WARN && console.warn(`Not enough populated cells (${populated.length}). Will generate only ${count} cultures`);
        alertMessage.innerHTML = `
          There are only ${populated.length} populated cells and it's insufficient livable area.<br>
          Only ${count} out of ${culturesInput.value} requested cultures will be generated.<br>
          Please consider changing climate settings in the World Configurator`;
        $("#alert").dialog({
          resizable: false,
          title: "Extreme climate warning",
          buttons: {
            Ok: function () {
              $(this).dialog("close");
            }
          }
        });
      }
    }

    const cultures = (pack.cultures = selectCultures(count));
    const centers = d3.quadtree();
    const colors = getColors(count);
    const emblemShape = document.getElementById("emblemShape").value;

    const codes = [];
    cultures.forEach(function (c, i) {
      const cell = (c.center = placeCenter(c.sort ? c.sort : i => cells.s[i]));
      centers.add(cells.p[cell]);
      c.i = i + 1;
      delete c.odd;
      delete c.sort;
      c.color = colors[i];
      c.type = defineCultureType(cell);
      c.expansionism = defineCultureExpansionism(c.type);
      c.origin = 0;
      c.code = abbreviate(c.name, codes);
      codes.push(c.code);
      cells.culture[cell] = i + 1;
      if (emblemShape === "random") c.shield = getRandomShield();
    });

    function placeCenter(v) {
      let c,
        spacing = (graphWidth + graphHeight) / 2 / count;
      const sorted = [...populated].sort((a, b) => v(b) - v(a)),
        max = Math.floor(sorted.length / 2);
      do {
        c = sorted[biased(0, max, 8)];
        spacing *= 0.9;
      } while (centers.find(cells.p[c][0], cells.p[c][1], spacing) !== undefined);
      return c;
    }

    // the first culture with id 0 is for wildlands
    cultures.unshift({name: "Wildlands", i: 0, base: 1, origin: null, shield: "round"});

    // make sure all bases exist in nameBases
    if (!nameBases.length) {
      ERROR && console.error("Name base is empty, default nameBases will be applied");
      nameBases = Names.getNameBases();
    }

    cultures.forEach(c => (c.base = c.base % nameBases.length));

    function selectCultures(c) {
      let def = getDefault(c);
      if (c === def.length) return def;
      if (def.every(d => d.odd === 1)) return def.splice(0, c);

      const count = Math.min(c, def.length);
      const cultures = [];

      for (let culture, rnd, i = 0; cultures.length < count && i < 200; i++) {
        do {
          rnd = rand(def.length - 1);
          culture = def[rnd];
        } while (!P(culture.odd));
        cultures.push(culture);
        def.splice(rnd, 1);
      }
      return cultures;
    }

    // set culture type based on culture center position
    function defineCultureType(i) {
      if (([18].includes(cells.biome[i]) && P(0.9)) || ([17, 24].includes(cells.biome[i]) && P(0.7)) || ([15, 16, 21, 22, 23].includes(cells.biome[i]) && P(0.5)) || ([29, 30, 31, 32, 38].includes(cells.biome[i]) && P(0.3))) return "Elves"; // high penalty in forest biomes and near coastline
      if (([11, 13, 14, 19, 20, 26, 27, 33, 34].includes(cells.biome[i]) && P(0.7)) || ([28, 35, 40].includes(cells.biome[i]) && P(0.5)) || ([8, 9, 36, 37, 39].includes(cells.biome[i]) && P(0.3))) return "Gnomes"; // no penalty for hills and moutains, high for other elevations
      const f = pack.features[cells.f[cells.haven[i]]]; // opposite feature
      if (f.cells > 5 && P(.05)) return "Amphibians"; 
      if (f.cells < 5 && P(.1)) return "Dry Reptiles";
      if ((cells.h[i] > 45) && P(.9)) return "Dwarves";
      if ((cells.harbor[i] && f.type !== "lake" && P(0.1)) || (cells.harbor[i] === 1 && P(0.6)) || (pack.features[cells.f[i]].group === "isle" && P(0.4)) || ((cells.r[i] && cells.fl[i] > 100) && P(0.6))) return "Goblins"; 
      if ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40].includes(cells.biome[i]) && P(0.3)) return "Orcs";
      if (P(0.05)) return "Other";
      return "Human";
    }

    function defineCultureExpansionism(type) {
      let base = 1; // Generic
      if (type === "Elves") base = 0.5;
      else if (type === "Gnomes") base = 0.5;
      else if (type === "Amphibians") base = 1;
      else if (type === "Dry Reptiles") base = 1;
      else if (type === "Dwarves") base = 0.7;
      else if (type === "Goblins") base = 1.2;
      else if (type === "Orcs") base = 1.1;
      return rn(((Math.random() * powerInput.value) / 2 + 1) * base, 1);
    }

    TIME && console.timeEnd("generateCultures");
  };

  const add = function (center) {
    const defaultCultures = getDefault();
    let culture, base, name;

    if (pack.cultures.length < defaultCultures.length) {
      // add one of the default cultures
      culture = pack.cultures.length;
      base = defaultCultures[culture].base;
      name = defaultCultures[culture].name;
    } else {
      // add random culture besed on one of the current ones
      culture = rand(pack.cultures.length - 1);
      name = Names.getCulture(culture, 5, 8, "");
      base = pack.cultures[culture].base;
    }
    const code = abbreviate(
      name,
      pack.cultures.map(c => c.code)
    );
    const i = pack.cultures.length;
    const color = d3.color(d3.scaleSequential(d3.interpolateRainbow)(Math.random())).hex();

    // define emblem shape
    let shield = culture.shield;
    const emblemShape = document.getElementById("emblemShape").value;
    if (emblemShape === "random") shield = getRandomShield();

    pack.cultures.push({name, color, base, center, i, expansionism: 1, type: "Generic", cells: 0, area: 0, rural: 0, urban: 0, origin: 0, code, shield});
  };

  const getDefault = function (count) {
    // generic sorting functions
    const cells = pack.cells,
      s = cells.s,
      sMax = d3.max(s),
      t = cells.t,
      h = cells.h,
      temp = grid.cells.temp;
    const n = cell => Math.ceil((s[cell] / sMax) * 3); // normalized cell score
    const td = (cell, goal) => {
      const d = Math.abs(temp[cells.g[cell]] - goal);
      return d ? d + 1 : 1;
    }; // temperature difference fee
    const bd = (cell, biomes, fee = 4) => (biomes.includes(cells.biome[cell]) ? 1 : fee); // biome difference fee
    const sf = (cell, fee = 4) => (cells.haven[cell] && pack.features[cells.f[cells.haven[cell]]].type !== "lake" ? 1 : fee); // not on sea coast fee

    if (culturesSet.value === "european") {
      return [
        {name: "Shwazen", base: 0, odd: 1, sort: i => n(i) / td(i, 10) / bd(i, [6, 8]), shield: "swiss"},
        {name: "Angshire", base: 1, odd: 1, sort: i => n(i) / td(i, 10) / sf(i), shield: "wedged"},
        {name: "Luari", base: 2, odd: 1, sort: i => n(i) / td(i, 12) / bd(i, [6, 8]), shield: "french"},
        {name: "Tallian", base: 3, odd: 1, sort: i => n(i) / td(i, 15), shield: "horsehead"},
        {name: "Astellian", base: 4, odd: 1, sort: i => n(i) / td(i, 16), shield: "spanish"},
        {name: "Slovan", base: 5, odd: 1, sort: i => (n(i) / td(i, 6)) * t[i], shield: "polish"},
        {name: "Norse", base: 6, odd: 1, sort: i => n(i) / td(i, 5), shield: "heater"},
        {name: "Elladan", base: 7, odd: 1, sort: i => (n(i) / td(i, 18)) * h[i], shield: "boeotian"},
        {name: "Romian", base: 8, odd: 0.2, sort: i => n(i) / td(i, 15) / t[i], shield: "roman"},
        {name: "Soumi", base: 9, odd: 1, sort: i => (n(i) / td(i, 5) / bd(i, [9])) * t[i], shield: "pavise"},
        {name: "Portuzian", base: 13, odd: 1, sort: i => n(i) / td(i, 17) / sf(i), shield: "renaissance"},
        {name: "Vengrian", base: 15, odd: 1, sort: i => (n(i) / td(i, 11) / bd(i, [4])) * t[i], shield: "horsehead2"},
        {name: "Turchian", base: 16, odd: 0.05, sort: i => n(i) / td(i, 14), shield: "round"},
        {name: "Euskati", base: 20, odd: 0.05, sort: i => (n(i) / td(i, 15)) * h[i], shield: "oldFrench"},
        {name: "Keltan", base: 22, odd: 0.05, sort: i => (n(i) / td(i, 11) / bd(i, [6, 8])) * t[i], shield: "oval"}
      ];
    }

    if (culturesSet.value === "oriental") {
      return [
        {name: "Koryo", base: 10, odd: 1, sort: i => n(i) / td(i, 12) / t[i], shield: "round"},
        {name: "Hantzu", base: 11, odd: 1, sort: i => n(i) / td(i, 13), shield: "banner"},
        {name: "Yamoto", base: 12, odd: 1, sort: i => n(i) / td(i, 15) / t[i], shield: "round"},
        {name: "Turchian", base: 16, odd: 1, sort: i => n(i) / td(i, 12), shield: "round"},
        {name: "Berberan", base: 17, odd: 0.2, sort: i => (n(i) / td(i, 19) / bd(i, [1, 2, 3], 7)) * t[i], shield: "oval"},
        {name: "Eurabic", base: 18, odd: 1, sort: i => (n(i) / td(i, 26) / bd(i, [1, 2], 7)) * t[i], shield: "oval"},
        {name: "Efratic", base: 23, odd: 0.1, sort: i => (n(i) / td(i, 22)) * t[i], shield: "round"},
        {name: "Tehrani", base: 24, odd: 1, sort: i => (n(i) / td(i, 18)) * h[i], shield: "round"},
        {name: "Maui", base: 25, odd: 0.2, sort: i => n(i) / td(i, 24) / sf(i) / t[i], shield: "vesicaPiscis"},
        {name: "Carnatic", base: 26, odd: 0.5, sort: i => n(i) / td(i, 26), shield: "round"},
        {name: "Vietic", base: 29, odd: 0.8, sort: i => n(i) / td(i, 25) / bd(i, [7], 7) / t[i], shield: "banner"},
        {name: "Guantzu", base: 30, odd: 0.5, sort: i => n(i) / td(i, 17), shield: "banner"},
        {name: "Ulus", base: 31, odd: 1, sort: i => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i], shield: "banner"}
      ];
    }

    if (culturesSet.value === "english") {
      const getName = () => Names.getBase(1, 5, 9, "", 0);
      return [
        {name: getName(), base: 1, odd: 1, shield: "heater"},
        {name: getName(), base: 1, odd: 1, shield: "wedged"},
        {name: getName(), base: 1, odd: 1, shield: "swiss"},
        {name: getName(), base: 1, odd: 1, shield: "oldFrench"},
        {name: getName(), base: 1, odd: 1, shield: "swiss"},
        {name: getName(), base: 1, odd: 1, shield: "spanish"},
        {name: getName(), base: 1, odd: 1, shield: "hessen"},
        {name: getName(), base: 1, odd: 1, shield: "fantasy5"},
        {name: getName(), base: 1, odd: 1, shield: "fantasy4"},
        {name: getName(), base: 1, odd: 1, shield: "fantasy1"}
      ];
    }

    if (culturesSet.value === "antique") {
      return [
        {name: "Roman", base: 8, odd: 1, sort: i => n(i) / td(i, 14) / t[i], shield: "roman"}, // Roman
        {name: "Roman", base: 8, odd: 1, sort: i => n(i) / td(i, 15) / sf(i), shield: "roman"}, // Roman
        {name: "Roman", base: 8, odd: 1, sort: i => n(i) / td(i, 16) / sf(i), shield: "roman"}, // Roman
        {name: "Roman", base: 8, odd: 1, sort: i => n(i) / td(i, 17) / t[i], shield: "roman"}, // Roman
        {name: "Hellenic", base: 7, odd: 1, sort: i => (n(i) / td(i, 18) / sf(i)) * h[i], shield: "boeotian"}, // Greek
        {name: "Hellenic", base: 7, odd: 1, sort: i => (n(i) / td(i, 19) / sf(i)) * h[i], shield: "boeotian"}, // Greek
        {name: "Macedonian", base: 7, odd: 0.5, sort: i => (n(i) / td(i, 12)) * h[i], shield: "round"}, // Greek
        {name: "Celtic", base: 22, odd: 1, sort: i => n(i) / td(i, 11) ** 0.5 / bd(i, [6, 8]), shield: "round"},
        {name: "Germanic", base: 0, odd: 1, sort: i => n(i) / td(i, 10) ** 0.5 / bd(i, [6, 8]), shield: "round"},
        {name: "Persian", base: 24, odd: 0.8, sort: i => (n(i) / td(i, 18)) * h[i], shield: "oval"}, // Iranian
        {name: "Scythian", base: 24, odd: 0.5, sort: i => n(i) / td(i, 11) ** 0.5 / bd(i, [4]), shield: "round"}, // Iranian
        {name: "Cantabrian", base: 20, odd: 0.5, sort: i => (n(i) / td(i, 16)) * h[i], shield: "oval"}, // Basque
        {name: "Estian", base: 9, odd: 0.2, sort: i => (n(i) / td(i, 5)) * t[i], shield: "pavise"}, // Finnic
        {name: "Carthaginian", base: 17, odd: 0.3, sort: i => n(i) / td(i, 19) / sf(i), shield: "oval"}, // Berber
        {name: "Mesopotamian", base: 23, odd: 0.2, sort: i => n(i) / td(i, 22) / bd(i, [1, 2, 3]), shield: "oval"} // Mesopotamian
      ];
    }

    if (culturesSet.value === "highFantasy") {
      return [
        // fantasy races
        {name: "Quenian (Elfish)", base: 33, odd: 1, sort: i => (n(i) / bd(i, [6, 7, 8, 9], 10)) * t[i], shield: "gondor"}, // Elves
        {name: "Eldar (Elfish)", base: 33, odd: 1, sort: i => (n(i) / bd(i, [6, 7, 8, 9], 10)) * t[i], shield: "noldor"}, // Elves
        {name: "Trow (Dark Elfish)", base: 34, odd: 0.9, sort: i => (n(i) / bd(i, [7, 8, 9, 12], 10)) * t[i], shield: "hessen"}, // Dark Elves
        {name: "Lothian (Dark Elfish)", base: 34, odd: 0.3, sort: i => (n(i) / bd(i, [7, 8, 9, 12], 10)) * t[i], shield: "wedged"}, // Dark Elves
        {name: "Dunirr (Dwarven)", base: 35, odd: 1, sort: i => n(i) + h[i], shield: "ironHills"}, // Dwarfs
        {name: "Khazadur (Dwarven)", base: 35, odd: 1, sort: i => n(i) + h[i], shield: "erebor"}, // Dwarfs
        {name: "Kobold (Goblin)", base: 36, odd: 1, sort: i => t[i] - s[i], shield: "moriaOrc"}, // Goblin
        {name: "Uruk (Orkish)", base: 37, odd: 1, sort: i => h[i] * t[i], shield: "urukHai"}, // Orc
        {name: "Ugluk (Orkish)", base: 37, odd: 0.5, sort: i => (h[i] * t[i]) / bd(i, [1, 2, 10, 11]), shield: "moriaOrc"}, // Orc
        {name: "Yotunn (Giants)", base: 38, odd: 0.7, sort: i => td(i, -10), shield: "pavise"}, // Giant
        {name: "Rake (Drakonic)", base: 39, odd: 0.7, sort: i => -s[i], shield: "fantasy2"}, // Draconic
        {name: "Arago (Arachnid)", base: 40, odd: 0.7, sort: i => t[i] - s[i], shield: "horsehead2"}, // Arachnid
        {name: "Aj'Snaga (Serpents)", base: 41, odd: 0.7, sort: i => n(i) / bd(i, [12], 10), shield: "fantasy1"}, // Serpents
        // fantasy human
        {name: "Anor (Human)", base: 32, odd: 1, sort: i => n(i) / td(i, 10), shield: "fantasy5"},
        {name: "Dail (Human)", base: 32, odd: 1, sort: i => n(i) / td(i, 13), shield: "roman"},
        {name: "Rohand (Human)", base: 16, odd: 1, sort: i => n(i) / td(i, 16), shield: "round"},
        {name: "Dulandir (Human)", base: 31, odd: 1, sort: i => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i], shield: "easterling"}
      ];
    }

    if (culturesSet.value === "darkFantasy") {
      return [
        // common real-world English
        {name: "Angshire", base: 1, odd: 1, sort: i => n(i) / td(i, 10) / sf(i), shield: "heater"},
        {name: "Enlandic", base: 1, odd: 1, sort: i => n(i) / td(i, 12), shield: "heater"},
        {name: "Westen", base: 1, odd: 1, sort: i => n(i) / td(i, 10), shield: "heater"},
        {name: "Nortumbic", base: 1, odd: 1, sort: i => n(i) / td(i, 7), shield: "heater"},
        {name: "Mercian", base: 1, odd: 1, sort: i => n(i) / td(i, 9), shield: "heater"},
        {name: "Kentian", base: 1, odd: 1, sort: i => n(i) / td(i, 12), shield: "heater"},
        // rare real-world western
        {name: "Norse", base: 6, odd: 0.7, sort: i => n(i) / td(i, 5) / sf(i), shield: "oldFrench"},
        {name: "Schwarzen", base: 0, odd: 0.3, sort: i => n(i) / td(i, 10) / bd(i, [6, 8]), shield: "gonfalon"},
        {name: "Luarian", base: 2, odd: 0.3, sort: i => n(i) / td(i, 12) / bd(i, [6, 8]), shield: "oldFrench"},
        {name: "Hetallian", base: 3, odd: 0.3, sort: i => n(i) / td(i, 15), shield: "oval"},
        {name: "Astellian", base: 4, odd: 0.3, sort: i => n(i) / td(i, 16), shield: "spanish"},
        // rare real-world exotic
        {name: "Kiswaili", base: 28, odd: 0.05, sort: i => n(i) / td(i, 29) / bd(i, [1, 3, 5, 7]), shield: "vesicaPiscis"},
        {name: "Yoruba", base: 21, odd: 0.05, sort: i => n(i) / td(i, 15) / bd(i, [5, 7]), shield: "vesicaPiscis"},
        {name: "Koryo", base: 10, odd: 0.05, sort: i => n(i) / td(i, 12) / t[i], shield: "round"},
        {name: "Hantzu", base: 11, odd: 0.05, sort: i => n(i) / td(i, 13), shield: "banner"},
        {name: "Yamoto", base: 12, odd: 0.05, sort: i => n(i) / td(i, 15) / t[i], shield: "round"},
        {name: "Guantzu", base: 30, odd: 0.05, sort: i => n(i) / td(i, 17), shield: "banner"},
        {name: "Ulus", base: 31, odd: 0.05, sort: i => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i], shield: "banner"},
        {name: "Turan", base: 16, odd: 0.05, sort: i => n(i) / td(i, 12), shield: "round"},
        {name: "Berberan", base: 17, odd: 0.05, sort: i => (n(i) / td(i, 19) / bd(i, [1, 2, 3], 7)) * t[i], shield: "round"},
        {name: "Eurabic", base: 18, odd: 0.05, sort: i => (n(i) / td(i, 26) / bd(i, [1, 2], 7)) * t[i], shield: "round"},
        {name: "Slovan", base: 5, odd: 0.05, sort: i => (n(i) / td(i, 6)) * t[i], shield: "round"},
        {name: "Keltan", base: 22, odd: 0.1, sort: i => n(i) / td(i, 11) ** 0.5 / bd(i, [6, 8]), shield: "vesicaPiscis"},
        {name: "Elladan", base: 7, odd: 0.2, sort: i => (n(i) / td(i, 18) / sf(i)) * h[i], shield: "boeotian"},
        {name: "Romian", base: 8, odd: 0.2, sort: i => n(i) / td(i, 14) / t[i], shield: "roman"},
        // fantasy races
        {name: "Eldar", base: 33, odd: 0.5, sort: i => (n(i) / bd(i, [6, 7, 8, 9], 10)) * t[i], shield: "fantasy5"}, // Elves
        {name: "Trow", base: 34, odd: 0.8, sort: i => (n(i) / bd(i, [7, 8, 9, 12], 10)) * t[i], shield: "hessen"}, // Dark Elves
        {name: "Durinn", base: 35, odd: 0.8, sort: i => n(i) + h[i], shield: "erebor"}, // Dwarven
        {name: "Kobblin", base: 36, odd: 0.8, sort: i => t[i] - s[i], shield: "moriaOrc"}, // Goblin
        {name: "Uruk", base: 37, odd: 0.8, sort: i => (h[i] * t[i]) / bd(i, [1, 2, 10, 11]), shield: "urukHai"}, // Orc
        {name: "Yotunn", base: 38, odd: 0.8, sort: i => td(i, -10), shield: "pavise"}, // Giant
        {name: "Drake", base: 39, odd: 0.9, sort: i => -s[i], shield: "fantasy2"}, // Draconic
        {name: "Rakhnid", base: 40, odd: 0.9, sort: i => t[i] - s[i], shield: "horsehead2"}, // Arachnid
        {name: "Aj'Snaga", base: 41, odd: 0.9, sort: i => n(i) / bd(i, [12], 10), shield: "fantasy1"} // Serpents
      ];
    }

    if (culturesSet.value === "random") {
      return d3.range(count).map(function () {
        const rnd = rand(nameBases.length - 1);
        const name = Names.getBaseShort(rnd);
        return {name, base: rnd, odd: 1, shield: getRandomShield()};
      });
    }

    // all-world
    return [
      {name: "Shwazen", base: 0, odd: 0.7, sort: i => n(i) / td(i, 10) / bd(i, [6, 8]), shield: "hessen"},
      {name: "Angshire", base: 1, odd: 1, sort: i => n(i) / td(i, 10) / sf(i), shield: "heater"},
      {name: "Luari", base: 2, odd: 0.6, sort: i => n(i) / td(i, 12) / bd(i, [6, 8]), shield: "oldFrench"},
      {name: "Tallian", base: 3, odd: 0.6, sort: i => n(i) / td(i, 15), shield: "horsehead2"},
      {name: "Astellian", base: 4, odd: 0.6, sort: i => n(i) / td(i, 16), shield: "spanish"},
      {name: "Slovan", base: 5, odd: 0.7, sort: i => (n(i) / td(i, 6)) * t[i], shield: "round"},
      {name: "Norse", base: 6, odd: 0.7, sort: i => n(i) / td(i, 5), shield: "heater"},
      {name: "Elladan", base: 7, odd: 0.7, sort: i => (n(i) / td(i, 18)) * h[i], shield: "boeotian"},
      {name: "Romian", base: 8, odd: 0.7, sort: i => n(i) / td(i, 15), shield: "roman"},
      {name: "Soumi", base: 9, odd: 0.3, sort: i => (n(i) / td(i, 5) / bd(i, [9])) * t[i], shield: "pavise"},
      {name: "Koryo", base: 10, odd: 0.1, sort: i => n(i) / td(i, 12) / t[i], shield: "round"},
      {name: "Hantzu", base: 11, odd: 0.1, sort: i => n(i) / td(i, 13), shield: "banner"},
      {name: "Yamoto", base: 12, odd: 0.1, sort: i => n(i) / td(i, 15) / t[i], shield: "round"},
      {name: "Portuzian", base: 13, odd: 0.4, sort: i => n(i) / td(i, 17) / sf(i), shield: "spanish"},
      {name: "Nawatli", base: 14, odd: 0.1, sort: i => h[i] / td(i, 18) / bd(i, [7]), shield: "square"},
      {name: "Vengrian", base: 15, odd: 0.2, sort: i => (n(i) / td(i, 11) / bd(i, [4])) * t[i], shield: "wedged"},
      {name: "Turchian", base: 16, odd: 0.2, sort: i => n(i) / td(i, 13), shield: "round"},
      {name: "Berberan", base: 17, odd: 0.1, sort: i => (n(i) / td(i, 19) / bd(i, [1, 2, 3], 7)) * t[i], shield: "round"},
      {name: "Eurabic", base: 18, odd: 0.2, sort: i => (n(i) / td(i, 26) / bd(i, [1, 2], 7)) * t[i], shield: "round"},
      {name: "Inuk", base: 19, odd: 0.05, sort: i => td(i, -1) / bd(i, [10, 11]) / sf(i), shield: "square"},
      {name: "Euskati", base: 20, odd: 0.05, sort: i => (n(i) / td(i, 15)) * h[i], shield: "spanish"},
      {name: "Yoruba", base: 21, odd: 0.05, sort: i => n(i) / td(i, 15) / bd(i, [5, 7]), shield: "vesicaPiscis"},
      {name: "Keltan", base: 22, odd: 0.05, sort: i => (n(i) / td(i, 11) / bd(i, [6, 8])) * t[i], shield: "vesicaPiscis"},
      {name: "Efratic", base: 23, odd: 0.05, sort: i => (n(i) / td(i, 22)) * t[i], shield: "diamond"},
      {name: "Tehrani", base: 24, odd: 0.1, sort: i => (n(i) / td(i, 18)) * h[i], shield: "round"},
      {name: "Maui", base: 25, odd: 0.05, sort: i => n(i) / td(i, 24) / sf(i) / t[i], shield: "round"},
      {name: "Carnatic", base: 26, odd: 0.05, sort: i => n(i) / td(i, 26), shield: "round"},
      {name: "Inqan", base: 27, odd: 0.05, sort: i => h[i] / td(i, 13), shield: "square"},
      {name: "Kiswaili", base: 28, odd: 0.1, sort: i => n(i) / td(i, 29) / bd(i, [1, 3, 5, 7]), shield: "vesicaPiscis"},
      {name: "Vietic", base: 29, odd: 0.1, sort: i => n(i) / td(i, 25) / bd(i, [7], 7) / t[i], shield: "banner"},
      {name: "Guantzu", base: 30, odd: 0.1, sort: i => n(i) / td(i, 17), shield: "banner"},
      {name: "Ulus", base: 31, odd: 0.1, sort: i => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i], shield: "banner"}
    ];
  };

  // expand cultures across the map (Dijkstra-like algorithm)
  const expand = function () {
    TIME && console.time("expandCultures");
    cells = pack.cells;

    const queue = new PriorityQueue({comparator: (a, b) => a.p - b.p});
    pack.cultures.forEach(function (c) {
      if (!c.i || c.removed) return;
      queue.queue({e: c.center, p: 0, c: c.i});
    });

    const neutral = (cells.i.length / 5000) * 3000 * neutralInput.value; // limit cost for culture growth
    const cost = [];
    while (queue.length) {
      const next = queue.dequeue(),
        n = next.e,
        p = next.p,
        c = next.c;
      const type = pack.cultures[c].type;
      cells.c[n].forEach(function (e) {
        const biome = cells.biome[e];
        const biomeCost = getBiomeCost(c, biome, type);
        const biomeChangeCost = biome === cells.biome[n] ? 0 : 20; // penalty on biome change
        const heightCost = getHeightCost(e, cells.h[e], type);
        const riverCost = getRiverCost(cells.r[e], e, type);
        const typeCost = getTypeCost(cells.t[e], type);
        const totalCost = p + (biomeCost + biomeChangeCost + heightCost + riverCost + typeCost) / pack.cultures[c].expansionism;

        if (totalCost > neutral) return;

        if (!cost[e] || totalCost < cost[e]) {
          if (cells.s[e] > 0) cells.culture[e] = c; // assign culture to populated cell
          cost[e] = totalCost;
          queue.queue({e, p: totalCost, c});
        }
      });
    }

    TIME && console.timeEnd("expandCultures");
  };

  function getBiomeCost(c, biome, type) {
    if (cells.biome[pack.cultures[c].center] === biome) return 10; // tiny penalty for native biome
    if (type === "Elves") return biomesData.cost[biome] /3;
    if (type === "Gnomes") return biomesData.cost[biome] /2;
    return biomesData.cost[biome] * 2; // general non-native biome penalty
  }

  function getHeightCost(i, h, type) {
    const f = pack.features[cells.f[i]],
      a = cells.area[i];
    if (type === "Goblins" && h < 20) return a * 2;
    if (type === "Amphibians" && h < 20) return a * 2; 
    if (h < 20) return a * 6; // general sea/lake crossing penalty
    if (type === "Dwarves" && h < 40) return 150;
    if (type === "Dwarves" && h < 30) return 500;
    if (type === "Dwarves" && h > 40) return 20;
    if (h >= 67) return 200; // general mountains crossing penalty
    if (h >= 44) return 30; // general hills crossing penalty
    return 0;
  }

  function getRiverCost(r, i, type) {
    if (type === "Amphibians") return 0;
    if (type === "Goblins") return 0;
    if (!r) return 0; // no penalty for others if there is no river
    return minmax(cells.fl[i] / 10, 20, 100); // river penalty from 20 to 100 based on flux
  }

  function getTypeCost(t, type) {
    return 0;
  }

  const getRandomShield = function () {
    const type = rw(COA.shields.types);
    return rw(COA.shields[type]);
  };

  return {generate, add, expand, getDefault, getRandomShield};
})();
