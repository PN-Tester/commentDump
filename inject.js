/*
    Comment Dump V3
    Created by : Pierre-Nicolas Allard-Coutu
*/

/*
   TODO: Silently handle 400 or other XHR errors i.e. dont print them to the console if the extension caused them, its confusing
*/

/*regex for matching ANY type of HTML/CSS/JS comment including : <!-- comment --> , //inline-comment , /*Multi Line Comment*\/, without matching false positives like HTML tags, CDATA, weird javascript, relative links with two slashes, etc.*/
var regex = /\w*(?<!(:|"|'|\\))\/\/[^\n\r]+?(?:\*\)|[\n\r])|(\/\*([^*]|[\r\n]|(\*+([^*\/]|[\r\n])))*\*+\/)|( )*<!--((.*)|[^<]*|a|[^!]*|[^-]*|[^>]*)-->\n*/gm;
/*regex for finding keywords*/
var reDefaultKeywords = /(ADMIN|PASSWORD|CREDENTIALS|DEBUG|ADMINISTRATOR|PASSWD|PWD|APIKEY|USERNAME|UPLOAD|INTERNAL|AUTH)/i; 
/*regex for finding files that cannot contain comments*/
var reFiles = /(https?:\/\/.*\.(?:jpg|img|gif|png|ico|gz|svg|woff|woff2|ttf|jpeg|tif|mp4))/; // weird problem of alternating true/false results on regex test using this are because of /g at end of regex!
/*regex for finding valid URLs*/
var reNames = /https?:\/\/.*/;
/*regex to detect JFIF keyword indicating a jpg file that passed through previous filters. the content here causes catastrophic backtracking when matched against main regex*/
var reAvoidCrash = /(JFIF|RIFF|WOF2|2EXIF|PNG|EXIF)/i

//aquire entire document and serialize for parsing with regex
var data = new XMLSerializer().serializeToString(document);
var results = data.match(regex);
//Print Banner Message
console.clear();
console.log('%c' + '/**/ Comment Dump V3 /**/', 'font-family:arial; font-size:50px; color:white; font-weight:bold; background: linear-gradient(white 10%,rgb(0,102,164),white); border-radius: 5px; padding: 20px');

//CURRENT WORKING data pass between popup.js and content script
//response contains text data from popup's input box
//for this to work, entire main() needs to be inside the chrome.runtime.onMessage listener function, so as to access the reKeywords variable without closing the listener
var reWords = chrome.runtime.onMessage.addListener(function (response, sendResponse) {
    //first, check if response is empty. If it is, user hasnt entered keywords and we should use default list automatically.
    if(response.length>0){
        var keywordString = response.replaceAll(',','|');
        var reKeywords = new RegExp('('+keywordString+')','i');
    }
    else{
        var reKeywords = reDefaultKeywords;
    }
    chrome.runtime.onMessage.removeListener(arguments.callee);
    try{
        for (var i=0;i<results.length;i++){
            console.log(results[i]);
        }
    }
    catch(err){};

    function removeDuplicates(data){
        return data.filter((value, index) => data.indexOf(value) === index);
    }

    /* GET ADDITIONAL SOURCES FOR PARSING */
    var raw = window.performance.getEntries()
    var sources = []
    for (var n=0;n<raw.length;n++){
        if(reNames.test(raw[n].name)){ //this check is required to filter out garbage from window.performance.getEntries(), which returns name values that sometimes are not URLs. This regex will only match strings starting with http:// or https://
            sources.push(raw[n].name);
        }
    }
    semiCleanSources = removeDuplicates(sources) //no more duplicate entries

    //async fetch external resources and parse them using the initial comment finding regex 
    for(var u=0;u<semiCleanSources.length;u++){
        if(reFiles.test(semiCleanSources[u]) == false){ // this check is required to eliminate ressource URLs of filetypes that cannot contain comments. This check avoids network overhead when fetching these files. 
            let xhr = new XMLHttpRequest();
            xhr.timeout = 2000;
            xhr.onerror = function(e) {}
            try{
                xhr.open('GET', semiCleanSources[u]);
                xhr.send();
            }
            catch(err){};
            xhr.onload = function() {
                if(xhr.status==200){
                    try{
                        if(reAvoidCrash.test(xhr.response)==false){ //this line prevents catastrophic backtracking on JPG data
                            var comments = xhr.response.match(regex);
                            //at this point, comments is an array of comment strings that have been extracted from the current resource
                            if (comments.length >= 1){
                                console.log('%c *** COMMENTS DETECTED IN RESOURCE FILE *** ', 'background: #222; color: #bada55; font-size: 15px');
                                var location = "Location : "+xhr.responseURL;
                                console.log('%c'+location,'font-size:8px;');
                                for(var y=0;y<comments.length;y++){
                                    //added logic to find interesting keywords
                                    if(reKeywords.test(comments[y])){
                                        console.log('%c *** INTERESTING KEYWORD DETECTED *** ', 'background: red; color: white; font-size: 18')
                                        var location = "Location : "+xhr.responseURL;
                                        console.log('%c'+location,'font-size:8px;');
                                        console.log('%c'+comments[y],'color:red');
                                    }
                                    else{
                                        console.log(comments[y]);
                                    }
                                }
                            }
                        }
                    }
                    catch(err){}
                }
            }
        }
    }
          
});

