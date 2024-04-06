

var Validator = function () {
	this.validateForDuplicates = function () {
		let guids = [];
		let duplicates = [];
		for (i = 0; i < MissionsInfo.length; i++) {
			let guid = MissionsInfo[i].id;
			if (guids.includes(guid)) {
				console.log("Duplicate GUID: " + guid);
				console.log(MissionsInfo[i]);
				
				duplicates.push(MissionsInfo[i]);
			}
			guids.push(guid);
		}
		
		if (duplicates.length == 0) {
			console.log("Validator found no duplicates");
		} else {
			console.log("Validator found [" + duplicates.length + "] duplicates");
		}
	};
};
/*
function Convert() {
	for (i = 0; i < missionsInfo.length; i++) {
		let item = missionsInfo[i];
		
		item['overview_img'] = "imgs/" + item.filename + "_overview.jpg";
	};
};

function ExportConverted() {
	let jsonArray = missionsInfo.map(function(item) {
		return JSON.stringify(item);
	});
	
	console.log(jsonArray);
	
	let blob = new Blob([jsonArray], {type: "text/plain"})
	let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "missionInfo_Converted.txt";
    a.click();
};
*/

$( document ).ready(function () {
	console.log("Validator Ready");

	VApp = new Validator();
	VApp.validateForDuplicates();
})