document.addEventListener('DOMContentLoaded', function() {
	var checkPageButton = document.getElementById('checkPage');
	var keywords = document.getElementById('keywords');
	checkPageButton.addEventListener('click', function() {
		chrome.tabs.query({active: true, currentWindow: true}, tabs => {
			chrome.tabs.executeScript(tabs[0].id,{file: 'inject.js'},()=>{
				chrome.tabs.sendMessage(tabs[0].id,keywords.value); 
			});
		});
	},false);
},false);