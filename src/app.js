// TODO:
// -- Find a way to compose missions data with similar title, but different filenames or title with some prefixes?


var TagsMarkdown = {
    "SPECOPS": {        bg: "#8ab62f", text: "whitesmoke", "tooltip": "Спец. операция силами небольшой группы спецназа" },
    "INFANTRY": {       bg: "#ba2b2b", text: "whitesmoke", "tooltip": "Пехотная операция силами стрелковых или моторизированных подразделений" },
    "COMB.ARMS": {      bg: "#596816", text: "whitesmoke", "tooltip": "Общевойсковая операция с участием разных родов войск" },
    "JTAC/CAS": {       bg: "#6aa29e", text: "whitesmoke", "tooltip": "Операция с привлечением штурмовой авиации" },
    "ARMOR": {          bg: "#6e8fa6", text: "whitesmoke", "tooltip": "Операция с привлечением тяжелой техники (танки, БМП)" },
    "AIRBORNE": {       bg: "#2a6c98", text: "whitesmoke", "tooltip": "Операция с привлечением транспортной авиации (десант)" },
    "MOUT": {           bg: "#aaaaaa", text: "#ffffff",    "tooltip": "Операция в городской среде" },
    "RolePlay":  {      bg: "#59ae42", text: "whitesmoke", "tooltip": "Миссия с ролевым элементом" },
    "EAST GEAR":  {     bg: "#7d2e2e", text: "whitesmoke", "tooltip": "Снаряжение восточного блока (ОВД, РФ)" },
    "WEST GEAR": {      bg: "#1c358b", text: "whitesmoke", "tooltip": "Снаряжение западного блока (NATO и т.п.)" },
    "EXOTIC GEAR": {    bg: "#59ae42", text: "whitesmoke", "tooltip": "Специфическое снаряжение (60-е, 70-е)" },
    "ARTILLERY": {      bg: "#428aae", text: "whitesmoke", "tooltip": "Есть поддержка артиллерии (минометы и круче)" },
    "1950" : {          bg: "#4f593d", text: "whitesmoke", "tooltip": "Время действия: 1950-ые" },
    "1960" : {          bg: "#304a04", text: "whitesmoke", "tooltip": "Время действия: 1960-ые" },
    "1970" : {          bg: "#3d590d", text: "whitesmoke", "tooltip": "Время действия: 1970-ые" },
    "1980" : {          bg: "#778a57", text: "whitesmoke", "tooltip": "Время действия: 1980-ые" },
    "1990" : {          bg: "#59732e", text: "whitesmoke", "tooltip": "Время действия: 1990-ые" },
    "2000" : {          bg: "#737d6a", text: "whitesmoke", "tooltip": "Время действия: 2000-ые" },
    "2010" : {          bg: "#b5ad59", text: "whitesmoke", "tooltip": "Время действия: 2010-ые" },
    "2020" : {          bg: "#829c6e", text: "whitesmoke", "tooltip": "Время действия: 2020-ые" },
    "2030" : {          bg: "#4d6639", text: "whitesmoke", "tooltip": "Время действия: 2030-ые" },
    "FIX NEEDED": {     bg: "#dddd11", text: "#333333",    "tooltip": "Сломано! Пишите в СпортЛото!" },
    "default": {        bg: "#8374aa", text: "whitesmoke", "tooltip": "" }
};

const FIX_NEEDED_TAG = "FIX NEEDED"
const AAR_CONFIG_URL = "/aar/aarListConfig.ini"

var GridModelClass = function (data) {
	this.data = [...data];
	this.size = data.length;
	this.sortedBy = { field: "", order: true };

	this.filteredOut = [];
	this.filter = {
		byString: function (v, vTofind) {
			return (v.toLocaleLowerCase()).indexOf(vTofind.toLocaleLowerCase()) >= 0;
		}
		, byNumberGTE: function (v, vToFind) {
			return vToFind <= v;
		}
		, byNumberLTE: function (v, vToFind) {
			return vToFind >= v;
		}
		, byTags: function (v, vToFind) {
			// Params:	@ArrayOfElementTags, @ArrayOfTagsToFind
			for (let i = 0; i < vToFind.length; ++i) {
				if (!v.includes(vToFind[i])) {
					return false;
				};
			}

			return true;
		}
		, byUnplayedTime: function(v, vToFind) {
			if (v === null) return true;
			return (new Date - v) > vToFind;
		}

		, terrainValues: []
		, tagsValues: []
		, field2filter: {
			title: "byString"
			, terrain: "byString"
			, slotsFrom: "byNumberGTE"
			, slotsTo: "byNumberLTE"
			, tags: "byTags"
			, unplayed: "byUnplayedTime"
		}
		, field2scheme: {
			title: "title"
			, terrain: "terrain"
			, slotsFrom: "player_count"
			, slotsTo: "player_count"
			, tags: "tags"
			, unplayed: "last_played_date"
		},

		currentFilter: {}
	}

	this.view = null;

	this.sortBy = function (param) {
		let order = true;
		if (this.sortedBy.field == param) { // Toggles sort order if already sorted
			order = !this.sortedBy.order;
		}

		this.sortColumnWithOrder(param, order);
	};

	this.sortColumnWithOrder = function (param, isAscending) {
		this.data.sort(function (a,b) {
			let v1 = a[param];
			let v2 = b[param];
			let r = 0;

			if (v1 > v2) {
				r = 1;
			} else if (v1 < v2) {
				r = -1;
			} else {
				r = 0;
			}

			return isAscending ? r : -1 * r;
		});

		this.sortedBy.field = param;
		this.sortedBy.order = isAscending;

		this.refreshView();
		return;
	};

	this.filterBy = function (filterData) {
		// Params: { "title":"...", "tags": [...] }
		this.resetFilter();
		this.filter.currentFilter = filterData;

		filterData = Object.entries(filterData);
		if (filterData.length == 0) { // Exit on filter reset action
			this.refreshView();
			return;
		}

		let filteredIndexes = [];
		for (let i = 0; i < filterData.length; ++i) {
			const filterField = filterData[i][0];
			const filterValue = filterData[i][1];

			const filterType = this.filter.field2filter[filterField];
			const schemeField = this.filter.field2scheme[filterField];

			const filterFunction = this.filter[filterType];
			this.data.forEach(function (el) {
				const result = filterFunction(el[schemeField], filterValue);

				// Add indexes that not correspond to filter value to filteredIndexeses
				if (!result && !filteredIndexes.includes( el["id"] )) {
					filteredIndexes.push( el["id"] );
				}
			});
		}

		this.filteredOut = filteredIndexes;
		this.itrPosition = this.getNextFilteredIteratorPos();

		this.refreshView();
	};

	this.resetFilter = function () {
		this.filtered = [];
		this.filteredOut = [];
		this.resetIterator();
	};

	this.isFiltered = function () {
		return this.filteredOut.length != 0;
	};

	this.prepareFilterData = function () {
		if (this.filter.terrainValues.length == 0 || this.filter.tagsValues.length == 0) {
			const terrains = [];
			const tags = [];
			const terrainsLowerCase = [];
			this.data.forEach(function (el) {
				const terrainName = el.terrain.toLowerCase()
				if (!terrainsLowerCase.includes(terrainName)) {
					terrainsLowerCase.push(terrainName);
					terrains.push(el.terrain)
				}

				for (let i = 0; i < el.tags.length; i++) {
					if (!tags.includes(el.tags[i])) {
						tags.push(el.tags[i]);
					};
				};
			});

			terrains.sort();
			tags.sort();
			this.filter.terrainValues = terrains;
			this.filter.tagsValues = tags;
		};
	};

	this.selectRandomFiltered = function (filterData) {
		this.filterBy(filterData);

		let items = [];
		this.resetIterator();
		while (this.hasNext()) { items.push(this.next()); }

		items = items.filter(function (value, indx, arr) {
			return !(value.tags.includes("FIX NEEDED"))
		});
		if (items.length == 0) { return; };

		let item = items[Math.floor(Math.random() * items.length)];
		this.refreshMissionDetails(item.id);
	};

	/* Update view */
	this.refreshView = function () {
		this.prepareFilterData();
		this.resetIterator();
		this.view.refreshGrid(this);
	};

	this.refreshMissionDetails = function(id) {
		if (id === "") {
			this.view.modal_hidePopup();
			this.updateURL("");
			return;
		}

		let mData = this.data.find(e => e.id == id);
		this.view.modal_showPopup(mData);
		this.updateURL(mData.id);
	};

	this.updateURL = function (guid) {
		let url = window.location.protocol + "//" + window.location.host + window.location.pathname;
		if (guid != "") {
			url = url + '?guid=' + encodeURI(guid);
		}
		window.history.pushState({ path: url }, '', url);
	};

	/* Iterator */
	this.itrPosition = 0;

	this.getNextFilteredIteratorPos = function () {
		let nextPos = this.itrPosition + 1;
		if (nextPos >= this.size) { return -1; }

		nextPosId = this.data[nextPos]["id"];

		while ( this.filteredOut.includes( nextPosId ) ) {
			++nextPos;

			if (nextPos >= this.size) { return -1; };
			nextPosId = this.data[nextPos]["id"];
		}

		if (nextPos < this.size) {
			return nextPos;
		} else {
			return -1;
		}
	};

	this.hasNext = function () {
		let isOutOfBounds = (this.itrPosition >= this.size) || (this.itrPosition < 0);
		if (isOutOfBounds) { return false; }

		let isFilteredOut = this.filteredOut.includes(this.data[this.itrPosition]["id"]);
		return !isFilteredOut;
	};

	this.next = function () {
		let indx = this.itrPosition;

		if (this.isFiltered()) {
			this.itrPosition = this.getNextFilteredIteratorPos();
		} else {
			this.itrPosition++;
		}

		return this.data[indx];
	};

	this.resetIterator = function () {
		this.itrPosition = -1;
		this.itrPosition = this.getNextFilteredIteratorPos();
		return;
	};
};

var GridViewClass = function () {
	this.$grid = "#grid";
	this.$popup = "#popup";

	this.$filter_head = "#grid-filter thead th";
	this.$filter_headTitle = "#grid-filter thead .filter-title";
	this.$filter_headBtnClose = "#grid-filter thead .filter-reset";

	this.$filter_terrain = "#grid-filter tr td[filter-type='terrain'] select";
	this.$filter_tags = "#grid-filter tr td[filter-type='tags']";
	this.$filter_lines = ".filter-line";

	this.header_columns = ["title","tags","player_count","terrain"];
	this.controller = null;

	this.$grid_item_mission = `<tr class="grid-line btn-see-more" mission-id="$id">`
								+ `<td class='td-main-info'>`
								+ `  <img loading='lazy' src='$overview_img'/>`
								+ `  <div class='td-main-info-desc'>`
								+      `<h3>$title</h3>`
								+      `<p>$overview</p>`
								+      "$played_times"
								+ `  </div>`
								+ `</td>`
								+ `<td class="td-tags td-center">$tags</td>`
								+ `<td class="td-center">$player_count</td>`
								+ `<td class='td-center' filter-type='terrain'>`
								+ `  <div class='terrain clickable'>$terrain</div>`
								+ `</td>`
							+ "</tr>"
	this.$played_times_info = "<p class='td-main-info-played'><b>Игралась</b> $played_times $played_times_word, крайний: $last_played_date</p>";


	this.refreshGrid = function(model) {
		this.clearGrid();
		this.filter_prepareFilter(model.filter.terrainValues, model.filter.tagsValues);
		const filterFixNeededExplicitly = this.controller.collectFilterActiveTag().includes(FIX_NEEDED_TAG)

		let gridSize = 0;

		while (model.hasNext()) {
			const info = model.next();
			if (info.tags.includes(FIX_NEEDED_TAG) && !filterFixNeededExplicitly) {
				continue;
			}

			const tags = this.tags_compileTagsHTML(info.tags, true);
			const title = (info.title == "null") ? info.filename : info.title;

			played_times_info = ""
			if (info.played_times > 0) {
				let timesWord = getRightForm(info.played_times);
				played_times_info = this.$played_times_info
					.replace("$played_times", info.played_times)
					.replace("$played_times_word", timesWord)
					.replace("$last_played_date", info.last_played_date.toLocaleDateString(
						"ru-RU", { month: 'long', day:"numeric", year: "numeric"}
					));
			}

			$(this.$grid).append(
				this.$grid_item_mission
					.replace("$id", info.id)
					.replace("$overview_img", info.overview_img)
					.replace("$title", title)
					.replace("$overview", info.overview)
					.replace("$played_times", played_times_info)
					.replace("$tags", tags)
					.replace("$player_count", info.player_count)
					.replace("$terrain", info.terrain)
			);

			++gridSize;
		}

		if (model.isFiltered()) {
			$(this.$filter_head).toggleClass("filter-active", true);
			$(this.$filter_headTitle).html(`Выбрано миссий: ${gridSize}`);
			$(this.$filter_headBtnClose).css('display', 'inline-block');
		} else {
			$(this.$filter_head).toggleClass("filter-active", false);
			$(this.$filter_headTitle).html(`Все миссии (${gridSize})`);
			$(this.$filter_headBtnClose).css('display', 'none');
			this.filter_resetFilter();
		}

		this.header_showSortedIcon(model.sortedBy.field, model.sortedBy.order);
		this.controller.initEvents();
	}

	this.clearGrid = function() {
		this.controller.removeEvents();
		$(this.$grid).find(".grid-line").each(function () { $(this).remove(); });
	}

	this.header_showSortedIcon = function (column, isAscending) {
		let columnList = this.header_columns;

		$(`${this.$grid} th`).each(function (indx) {
			$(this).find("div").each(function () { $(this).remove(); });

			if (column == columnList[indx]) {
				$(this).append(isAscending ? "<div order='asc'>▲</div>" : "<div order='desc'>▼</div>");
			}
		});
	}

	this.filter_prepareFilter = function (valuesTerrain, valuesTags) {
		if ($(`${this.$filter_terrain} option`).length > 0) { return; }

		$(this.$filter_terrain).append(`<option></option>`);
		for (let i = 0; i < valuesTerrain.length; ++i) {
			const displayName = valuesTerrain[i]
			$(this.$filter_terrain).append(`<option value="${displayName.toLowerCase()}">${displayName}</option>`);
		}

		for (let i = 0; i < valuesTags.length; ++i) {
			let tag = valuesTags[i];
			let tagData = TagsMarkdown[tag];
			if (tagData == null) { tagData = TagsMarkdown.default; }

			$(this.$filter_tags).append(
				`<span >` +
				`<input type='checkbox' id="${tag}" style="display:none" />` +
				`<label class='tag clickable td-filter-tag td-inactive-tag' for="${tag}" style="background-color: ${tagData.bg}; color: ${tagData.text}" title="${tagData.tooltip}">${tag}</label>` +
				`</span>`
			);
		}

		$(this.$filter_lines).each(function () { $(this).css("display", "none") })
	}

	this.filter_resetFilter = function () {
		// Clears filter inputs, uncheck all tags and mark them as inactive
		$(`.td-filter-inputs input, .td-filter-inputs select`).each(function () { $(this).val("") });
		$(`.td-filter-inputs input[type="checkbox"]`).each(function () { $(this).prop("checked", false) });
		$(`.td-filter-inputs span`).each(function () {
			$(this).find(`input[type='checkbox']`).prop("checked", false);
			$(this).find(`label`).addClass("td-inactive-tag");
		});
	}

	this.modal_showPopup = function (data) {
		let title = (data.title == "") ? data.filename : data.title;

		$(`${this.$popup} h1`).text(title);
		$(`${this.$popup} p[class='modal-terrain']`).html(
			`на <span>${data.terrain}</span>` +
			((data.mission_date == 'Unknown') ? "" : ` в ${data.mission_date.split('-')[0]} году`) +
			` | до ${data.player_count} игроков` +
			((data.author == 'Unknown') ? "" : ` | by <b>${data.author}</b>, ${data.creation_date}`) 

		);
		$(`${this.$popup} span[class='modal-guid']`).text(
			`[GUID:${data.id}]` +
			`[Filename:${data.filename}]` +
			`[Created:${data.creation_date}]` +
			(data.played_times > 0 ? `[Played:${data.last_played_date.toISOString().split('T')[0]}]` : "")
		);
		$(`${this.$popup} p[class='modal-tags']`).html(this.tags_compileTagsHTML(data.tags, false, true));
		$(`${this.$popup} #overview_img`).attr("src", data.overview_img || "imgs/emptyoverview.jpg");
		$(`${this.$popup} #map_shot`).attr("src", data.map_shot || "");

		aarElements = data.aars.reduce((str, item) => {
			const date = item.date.toLocaleDateString('ru-RU', { month: 'long', day:"numeric", year: "numeric"});
			let dateDiff = Math.floor((new Date() - item.date) / 1000 / 60 / 60 / 24);
			let ago = "";
			if (dateDiff > 365) {
				dateDiff = Math.floor(dateDiff / 365);
				ago = `(${dateDiff} ${getRightForm(dateDiff, form1 = "год назад", form2 = "года назад", form3 = "лет назад")})`;
			} else if (dateDiff > 30) {
				dateDiff = Math.floor(dateDiff / 30);
				ago = `(${dateDiff} ${getRightForm(dateDiff, form1 = "месяц назад", form2 = "месяца назад", form3 = "месяцев назад")})`;
			} else if (dateDiff > 0) {
			 	ago = `(${dateDiff} ${getRightForm(dateDiff, form1 = "день назад", form2 = "дня назад", form3 = "дней назад")})`;
			}
			return str + `<a href="${item.link}" target="_blank"><span>${date}</span> <span>${ago}</span></a>`;
		}, "");
		$(`${this.$popup} .modal-aar-container`).html(
			`<details>
				<summary>After Action Reports (${data.played_times})</summary>
				${aarElements}
			</details>`
		)
		$(`${this.$popup} .modal-briefing`).html(
			`<details>
				<summary>Брифинг</summary>
				${data.briefing}
			</details>`			
		);
		$(this.$popup).css("display","block");
		$(this.$popup).scrollTop(0);
	}

	this.modal_hidePopup = function () {
		$(this.$popup).css("display","none");
	}

	this.tags_compileTagsHTML = function (tags, isClickable = true, showDescription = false) {
		let tagsHtml = [];

		const tagClasses = isClickable ? "tag clickable" : "tag";

		tags.forEach(function (tag) {
			let tagData = TagsMarkdown[tag];
			if (tagData == null) {
				tagData = TagsMarkdown.default;
			}

			let text = "";
			if (!showDescription) {
				text = `<p class="${tagClasses}" style="background-color: ${tagData.bg}; color: ${tagData.text}" title="${tagData.tooltip}">${tag}</p>`
			} else {
				text = `<p class="${tagClasses}" style="background-color: ${tagData.bg}; color: ${tagData.text}" >[${tag}] ${tagData.tooltip}</p>`
			}

			tagsHtml.push(text);
		});

		return tagsHtml.join("");
	};
}

var GridControllerClass = function () {
	this.model = null;
	this.headerEventsSet = false;
	this.filtersCollapsed = true;

	this.$filter_random = "#header-btn-select-random";
	this.$scroll_top = "#header-btn-up";

	this.$popup = "#popup";

	this.$grid_sortable = "#grid th[sortable='true']";
	this.$btn_popupClose = "#popup span[class='close']";
	this.$btn_popupRandom = "#popup span[class='random']";
	this.$btn_seeMore = "#grid tr[class*='btn-see-more']";
	this.$btn_terrain = "#grid tr td[filter-type='terrain']";
	this.$btn_tags = "#grid tr td p[class='tag clickable']";

	this.$filter_head = "#grid-filter thead th";
	this.$filter_headResetBtn = "#grid-filter thead .filter-reset"
	this.$filter_tags = "#grid-filter tr td[filter-type='tags']";
	this.$filter_copyURL = "#btn-filter-url";
	this.$filter_resetFitler = "#btn-reset-filter";
	this.$filter_doFilter = "#btn-filter";
	this.$filter_lines = ".filter-line";

	this.$filter_byTitle = "td[filter-type='title'] input";
	this.$filter_byTerrain = "td[filter-type='terrain'] select";
	this.$filter_bySlotsFrom = "td[filter-type='slots-gte'] input";
	this.$filter_bySlotsTo = "td[filter-type='slots-lte'] input";
	this.$filter_unplayed = "td[filter-type='unplayed'] input";

	this.removeEvents = function () {
		$(this.$btn_seeMore).off();
		$(this.$btn_terrain).off();
		$(this.$btn_tags).off();
	};

	this.initEvents = function () {
		this.removeEvents();

		/* Static elements: Grid header, Filter form, Modal window */
		if (!this.headerEventsSet) {
			/* Sortable header */
			$(this.$grid_sortable).on("click", this, function (event) {
				let cname = $(this).attr("column_name");
				let model = event.data.model;
				model.sortBy(cname);
			})

			/* Filters */
			$(this.$filter_head).on("click", this, function (event) {
				if (event.target.hasAttribute('action')) {
					const model = event.data.model;
					model.filterBy([]);
					return
				}

				const controller = event.data;
				controller.filtersCollapsed = !controller.filtersCollapsed; // Toggle filter collapsed
				if (controller.filtersCollapsed) {
					$(controller.$filter_lines).fadeOut(250);
				} else {
					$(controller.$filter_lines).fadeIn(250);
				}
			});

			$(this.$filter_byTitle).on("change",  this, function (event) {
				let controller = event.data;
				controller.executeFiltering();
			});
			$(this.$filter_byTerrain).on("change",  this, function (event) {
				let controller = event.data;
				controller.executeFiltering();
			});
			$(this.$filter_bySlotsFrom).on("change",  this, function (event) {
				let controller = event.data;
				controller.executeFiltering();
			});
			$(this.$filter_bySlotsTo).on("change",  this, function (event) {
				let controller = event.data;
				controller.executeFiltering();
			});
			$(this.$filter_tags).on("click", this, function (event) {
				if (event.target.id == "") { return };

				const controller = event.data;
				const tagItem = event.target.labels[0];
				if (event.target.checked) {
					$(tagItem).removeClass("td-inactive-tag");
				} else {
					$(tagItem).addClass("td-inactive-tag");
				};
				controller.executeFiltering();
			});
			$(this.$filter_unplayed).on("click", this, function (event) {
				let controller = event.data;
				controller.executeFiltering();
			})

			$(this.$filter_doFilter).on("click", this, function (event) {
				let controller = event.data;
				controller.executeFiltering();
			})

			$(this.$filter_resetFitler).on("click", this, function (event) {
				let model = event.data.model;
				model.filterBy([]);
			})

			$(this.$filter_copyURL).on("click", this, function (event) {
				let controller = event.data;
				controller.copyFilteredURL();
			});

			$(this.$filter_random).on("click", this, function (event) {
				let controller = event.data;
				controller.filterAndSelectRandom();
			});

			$(this.$scroll_top).on("click", this, (event)=> {
				$("#wrapper").animate({scrollTop: 0})
			})


			/* Modal window */
			$(this.$popup).on("click", this, function (event) {
				if (event.target.id !== "popup") return
				event.data.model.refreshMissionDetails("");
			})
			$(this.$btn_popupClose).on("click", this, function (event) {
				let model = event.data.model;
				model.refreshMissionDetails("");
			})
			$(this.$btn_popupRandom).on("click", this, function (event) {
				let controller = event.data;
				controller.filterAndSelectRandom();
			})

			this.headerEventsSet = true;
		}

		/* Details button */
		$(this.$btn_seeMore).on("click", this, function (event) {
			let model = event.data.model;
			let missionId = $(this).attr("mission-id");

			model.refreshMissionDetails(missionId);
		});

		/* Terrain */
		$(this.$btn_terrain).on("click", this, function (event) {
			let controller = event.data;
			let terrainName = event.target.innerText;
			controller.updateAndFilter({"terrain": terrainName});

		});

		/* Tags */
		$(this.$btn_tags).on("click", this, function (event) {
			let controller = event.data;
			let tagname = event.target.innerText;
			controller.updateAndFilter({"tags": [tagname]});
		});
	};

	this.executeFiltering = function () {
		let params = this.collectFilterParams();
		this.model.filterBy(params);
	};

	this.collectFilterActiveTag = function () {
		let byTags = [];
		$(`.td-filter-inputs span`).each(function () {
			let $tagFilter = $(this).find(`input[type='checkbox']`);
			if ($tagFilter.prop("checked")) {
				byTags.push($tagFilter.prop("id"));
			}
		});

		return byTags
	}

	this.collectFilterParams = function () {
		const byTitle = $(this.$filter_byTitle).val();
		const byTerrain = $(this.$filter_byTerrain).val();
		const bySlotsFrom = $(this.$filter_bySlotsFrom).val();
		const bySlotsTo = $(this.$filter_bySlotsTo).val();
		const byTags = this.collectFilterActiveTag();
		const byUnplayed = $(this.$filter_unplayed).is(":checked") ? 90 * 24 * 60 * 60 * 1000 : 0;  // 90 days in milliseconds

		let params = {};
		// Reset filters if empty filter used
		if (byTitle == "" && byTerrain == "" && bySlotsFrom == "" && bySlotsTo == "" && byTags.length == 0 && byUnplayed == 0) {
			return params;
		}

		if (byTitle != "") { params["title"] = byTitle; };
		if (byTerrain != "") { params["terrain"] = byTerrain; };
		if (bySlotsFrom != "") { params["slotsFrom"] = parseInt(bySlotsFrom); };
		if (bySlotsTo != "") { params["slotsTo"] = parseInt(bySlotsTo); };
		if (byTags.length > 0) { params["tags"] = byTags; };
		if (byUnplayed) { params["unplayed"] = byUnplayed;}

		return params;
	};

	this.getCurrentFilterParams = function () {
		const params = this.model.filter.currentFilter;


	}

	this.updatedFilterParams = function (addParams) {
		// Updates current filtering parameters
		// Params: {"tags": [...], "terrain": "Abel"}
		let params = this.collectFilterParams();
		let entries = Object.entries(addParams);

		entries.forEach(function (e) {
			let key = e[0];
			let value = e[1];

			if (params.hasOwnProperty(key)) {
				let currentValue = params[key];
				if (typeof currentValue === "object") {
					// Array (tags)
					let set = new Set();
					currentValue.forEach(function (tag) { set.add(tag); });
					value.forEach(function (tag) { set.add(tag); });

					value = Array.from(set);
				} else {
					// String or number - just overwrite
				}
			}

			params[key] = value;
		});

		return params;
	};

	this.updateFilter = function (addParams) {
		// Updates filter's UI with update params (selected tags and stuff)
		let params = this.updatedFilterParams(addParams);

		// Update UI
		$(this.$filter_byTitle).val( params.hasOwnProperty("title") ? params.title : "" );
		$(this.$filter_byTerrain).val( params.hasOwnProperty("terrain") ? params.terrain.toLowerCase() : "" );
		$(this.$filter_bySlotsFrom).val( params.hasOwnProperty("slotsFrom") ? params.slotsFrom : "" );
		$(this.$filter_bySlotsTo).val( params.hasOwnProperty("slotsTo") ? params.slotsTo : "" );
		if (params.hasOwnProperty("tags")) {
			$(`.td-filter-inputs span`).each(function () {
				if (params.tags.includes( $(this).find(`input[type='checkbox']`).prop("id") )) {
					$(this).find(`input[type='checkbox']`).prop("checked",true);
					$(this).find(`label`).removeClass("td-inactive-tag");
				} else {
					$(this).find(`input[type='checkbox']`).prop("checked",false);
					$(this).find(`label`).addClass("td-inactive-tag");
				};
			});
		} else {
			// Disable tags selection
			$(`.td-filter-inputs span`).each(function () {
				$(this).find(`input[type='checkbox']`).prop("checked",false);
				$(this).find(`label`).addClass("td-inactive-tag");
			});
		};
	};

	this.updateAndFilter = function (addParams) {
		// Params: {"tags": [...], "terrain": "Abel"}
		this.updateFilter(addParams);
		this.model.filterBy(this.collectFilterParams());
	}

	this.copyFilteredURL = function () {
		let params = this.collectFilterParams();
		let entries = Object.entries(params);
		if (entries.length == 0) {
			return;
		}

		let urlParams = [];
		entries.forEach(function (e) {
			let key = e[0];
			let value = e[1];

			if (typeof value === "object") {
				// Array (tags)
				let strTags = encodeURI(value.join(","));
				urlParams.push(`${key}=[${strTags}]`);
			} else {
				let strParam = encodeURI(value);
				urlParams.push(`${key}=${value}`);
			}
		});

		let url = window.location.protocol + "//" + window.location.host + window.location.pathname + "?" + urlParams.join("&");
        sTemp = "<input id=\"copy_to_clipboard\" value=\"" + url + "\" />"
        $("body").append(sTemp);
        $("#copy_to_clipboard").select();
        document.execCommand("copy");
        $("#copy_to_clipboard").remove();
	};

	this.setUpFilterFromURL = function () {
		let url = decodeURI( window.location.href );
		let params = {};
		let validParams = ["title","terrain","slotsFrom","slotsTo","tags"];
		let urlParams = new URLSearchParams(window.location.search);

		validParams.forEach(function (validParam) {
			if (urlParams.has(validParam)) {

				if (validParam == "tags") {
					let tags = urlParams.get(validParam);
					params[validParam] = tags.substring(1, tags.length - 1).split(",")
				} else {
					params[validParam] = urlParams.get(validParam);
				}
			};
		});

		this.model.updateURL("");
		this.updateAndFilter(params);
	};

	this.filterAndSelectRandom = function () {
		let params = this.collectFilterParams();

		if (params.hasOwnProperty("tags")) {
			let indx = params.tags.indexOf("FIX NEEDED");
			if (indx > -1) { params.tags.splice(indx,1); }
		}

		this.model.selectRandomFiltered(params);
	};
}


class AARMissionStat {
	constructor(date) {
		this.last_played_date = date;
		this.links = [];
		this.timesPlayed = 0;
	}
}

class AARLink {
	constructor(link, date) {
		this.link = link;
		this.date = date;
	}
}

const AAR_PREFIXES_TO_CORRECT = [
	"T2 - ", "[T2] ",
	"T4 - ",
	"M1 - ", "M2 - ", "M3 - ",
	"m1 - ", "m2 - ", "m3 - ",
	"NEWYEAR "
]


function init() {
	fetch(AAR_CONFIG_URL).then((response)=>{
		if (!response.ok) {
			console.err("Ошибка HTTP: " + response.status);
			return null
		}
		return response.text()
	}).then((responseText) => {
		responseText = responseText.substring(0, responseText.length - 2).replace('aarConfig = ', '');
		const aars = JSON.parse(responseText);

		const missionToAARMap = {};
		aars.forEach((item) => {
			const date = new Date(item.date);
			let name = item.title	
			for (let prefix of AAR_PREFIXES_TO_CORRECT) {
				if (name.indexOf(prefix) != 0) continue;
				name = name.replace(prefix, "")
			}	

			if (!missionToAARMap.hasOwnProperty(name)) {
				missionToAARMap[name] = new AARMissionStat(new Date(item.date))
			}
			const stat = missionToAARMap[name]

			stat.timesPlayed += 1;
			stat.last_played_date = stat.last_played_date < date ? date : stat.last_played_date;
			stat.links.push(new AARLink(item.link, date));
		})
		return missionToAARMap
	}).then((aarMap) => {
		MissionsInfo.forEach((item) => {
			const name = item.title
			if (!aarMap.hasOwnProperty(name)) {
				item.played_times = 0;
				item.last_played_date = null;
				item.aars = [];
				return;
			}

			const aar = aarMap[name];
			item.played_times = aar.timesPlayed;
			item.last_played_date = aar.last_played_date;
			item.aars = aar.links;
		})

		initGridApp()
	})
}

function initGridApp() {
	GridApp.model = new GridModelClass(MissionsInfo);
	GridApp.view = new GridViewClass();
	GridApp.controller = new GridControllerClass();

	GridApp.model.view = GridApp.view;
	GridApp.view.controller = GridApp.controller;
	GridApp.controller.model = GridApp.model;

	/* Init */
	GridApp.model.refreshView();

	let urlParams = new URLSearchParams(window.location.search);
	if (urlParams.has('guid')) {
		let guid = urlParams.get('guid');
		GridApp.model.refreshMissionDetails(guid);
	} else {
		GridApp.controller.setUpFilterFromURL();
	}
}

function getRightForm(number, form1 = "раз", form2 = "раза", form3 = "раз") {
	let n = Math.trunc(Math.abs(number)) % 100,
	n1 = n % 10;

	if (n > 4 && n < 21) return form3;
	if (n1 === 1) return form1;
	if (n1 > 1 && n1 < 5) return form2;
	return form3;
}

$( document ).ready(function () {
	console.log("KEK Ready");
	$("#header-btn-up").hide()
	$('#wrapper').on("scroll", (e)=>{
		const scrollPos = document.querySelector("#wrapper").scrollTop
		if (scrollPos < 200) {
			$("#header-btn-up").hide()
		} else {
			$("#header-btn-up").show()
		}
	})

	GridApp = {};
	init();
})
